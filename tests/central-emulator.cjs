const assert=require('assert'),{randomUUID}=require('crypto');require('../central-rules.js');
const DB='http://127.0.0.1:9100',AUTH='http://127.0.0.1:9199',NS='demo-vovinam-default-rtdb';
let passed=0;
async function authUser(label){const r=await fetch(AUTH+'/identitytoolkit.googleapis.com/v1/accounts:signUp?key=fake',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:label+'-'+randomUUID()+'@example.test',password:'CorrectPass123',returnSecureToken:true})});const b=await r.json();assert.equal(r.status,200,JSON.stringify(b));return {uid:b.localId,token:b.idToken,email:b.email};}
async function request(path,token,method='GET',value,headers={}){assert.ok(DB.startsWith('http://127.0.0.1:'));return fetch(DB+'/'+path+'.json?ns='+NS+(token&&token!=='owner'?'&auth='+encodeURIComponent(token):''),{method,headers:{'Content-Type':'application/json',...(method==='GET'?{'X-Firebase-ETag':'true'}:{}),...(token==='owner'?{Authorization:'Bearer owner'}:{}),...headers},...(value!==undefined?{body:JSON.stringify(value)}:{})});}
async function test(name,fn){try{await fn();passed++;console.log('PASS',name);}catch(e){console.error('FAIL',name,e.stack);process.exitCode=1;}}
(async()=>{
const owner=await authUser('owner'),staff=await authUser('cash'),unknown=await authUser('unapproved');
const rules=JSON.parse(globalThis.vovinamCentralRules(owner.uid));
await test('Generated Rules compile in the real Firebase Database emulator',async()=>{const r=await request('.settings/rules','owner','PUT',rules);assert.equal(r.status,200,await r.text());});
if(process.exitCode)throw new Error('Rules failed to compile; stopping dependent tests');
const ownerProfile={id:'ACC-ADMIN',uid:owner.uid,name:'Admin',username:'admin',status:'active',isSuperAdmin:true,allClasses:true,permissions:{full_access:true}};
const staffProfile={id:'cashA',uid:staff.uid,name:'Thu ngân A',username:'cash_a',status:'active',isSuperAdmin:false,allClasses:false,assignedClassKeys:{cA:true},permissions:{tuition_manage:true}};
const packet=value=>({key:'record',revision:1,chunks:[JSON.stringify(value)]});
const initial={meta:{enabled:true,version:2,adminUid:owner.uid},profiles:{[owner.uid]:ownerProfile,[staff.uid]:staffProfile},classDirectory:{cA:{id:'A',name:'Lớp A'},cB:{id:'B',name:'Lớp B'}},data:{cA:{students:{a:packet({_uid:'a',id:'A',name:'An'})},tuitionRecords:{a:packet({month:'2026-11',uid:'a',record:{status:'unpaid',amount:350000}})}},cB:{students:{b:packet({_uid:'b',id:'B',name:'Bình'})}}},siteConfig:packet({title:'CLB'})};
await test('Owner initializes profiles and data in one conditional write',async()=>{const read=await request('central_v2',owner.token);assert.equal(read.status,200);const etag=read.headers.get('etag');const r=await request('central_v2',owner.token,'PUT',initial,{'if-match':etag});assert.equal(r.status,200,await r.text());});
await test('Anonymous user can discover activation but cannot read club data',async()=>{assert.equal((await request('central_v2/meta')).status,200);assert.equal((await request('central_v2/data')).status,401);assert.equal((await request('central_v2/profiles')).status,401);});
await test('An authenticated but unapproved account cannot read any class data',async()=>{assert.equal((await request('central_v2/data/cA/students',unknown.token)).status,401);});
await test('Normal account reads only its own permission profile',async()=>{assert.equal((await request('central_v2/profiles/'+staff.uid,staff.token)).status,200);assert.equal((await request('central_v2/profiles/'+owner.uid,staff.token)).status,401);assert.equal((await request('central_v2/profiles',staff.token)).status,401);});
await test('Normal account reads assigned-class students and tuition',async()=>{assert.equal((await request('central_v2/data/cA/students',staff.token)).status,200);assert.equal((await request('central_v2/data/cA/tuitionRecords',staff.token)).status,200);});
await test('Normal account cannot read another class or ungranted attendance records',async()=>{assert.equal((await request('central_v2/data/cB/students',staff.token)).status,401);assert.equal((await request('central_v2/data/cA/attendanceRecords',staff.token)).status,401);});
await test('Tuition permission writes only tuition in the assigned class',async()=>{assert.equal((await request('central_v2/data/cA/tuitionRecords/a',staff.token,'PUT',packet({status:'paid',amount:400000}))).status,200);assert.equal((await request('central_v2/data/cB/tuitionRecords/b',staff.token,'PUT',packet({status:'paid'}))).status,401);assert.equal((await request('central_v2/data/cA/students/a',staff.token,'PUT',packet({name:'Forged'}))).status,401);});
await test('Normal account cannot grant itself full access or change class assignment',async()=>{assert.equal((await request('central_v2/profiles/'+staff.uid,staff.token,'PUT',{...staffProfile,isSuperAdmin:true,allClasses:true,permissions:{full_access:true}})).status,401);assert.equal((await request('central_v2/profiles/'+staff.uid+'/assignedClassKeys/cB',staff.token,'PUT',true)).status,401);});
await test('Normal account cannot replace the entire central database or settings',async()=>{assert.equal((await request('central_v2',staff.token,'PUT',initial)).status,401);assert.equal((await request('central_v2/siteConfig',staff.token,'PUT',packet({title:'Forged'}))).status,401);});
await test('Firebase-invalid keys inside serialized records are accepted without data loss',async()=>{const value={'Lớp T2/4/6':[1],'.#$[]':{},empty:[]};const path='central_v2/data/cA/tuitionRecords/special';assert.equal((await request(path,staff.token,'PUT',packet(value))).status,200);const r=await request(path,staff.token);assert.deepEqual(JSON.parse((await r.json()).chunks.join('')),value);});
await test('Stale conditional writes are rejected by Firebase with HTTP 412',async()=>{const path='central_v2/data/cA/tuitionRecords/a',etag=(await request(path,staff.token)).headers.get('etag');assert.equal((await request(path,staff.token,'PUT',{...packet({paid:true}),revision:2},{'if-match':etag})).status,200);assert.equal((await request(path,staff.token,'PUT',packet({paid:false}),{'if-match':etag})).status,412);});
await test('Profiles reject copied password hashes even from an admin',async()=>{const r=await request('central_v2/profiles/'+staff.uid,owner.token,'PUT',{...staffProfile,passwordHash:'must-not-store'});assert.equal(r.status,401);});
await test('Maintenance flag blocks previously authenticated class access',async()=>{assert.equal((await request('central_v2/meta/enabled',owner.token,'PUT',false)).status,200);assert.equal((await request('central_v2/data/cA/students',staff.token)).status,401);assert.equal((await request('central_v2/meta/enabled',owner.token,'PUT',true)).status,200);});
await test('Locked account immediately loses data access while it can see its own lock status',async()=>{assert.equal((await request('central_v2/profiles/'+staff.uid,owner.token,'PUT',{...staffProfile,status:'locked'})).status,200);assert.equal((await request('central_v2/data/cA/students',staff.token)).status,401);assert.equal((await request('central_v2/data/cA/tuitionRecords/a',staff.token,'PUT',packet({paid:true}))).status,401);assert.equal((await request('central_v2/profiles/'+staff.uid,staff.token)).status,200);});

await test('Application adapter signs in against actual Firebase Auth and loads scoped data',async()=>{
 const fs=require('fs'),vm=require('vm'),Module=require('module'),path=require('path');
 const appContext=require('./browser-harness.cjs');
 const ctx=appContext.context;ctx.URLSearchParams=URLSearchParams;
 const storage=new Map();ctx.centralPrivateStorage=storage;appContext.run('idbGetItem=async k=>centralPrivateStorage.get(k)||null;idbSetItem=async(k,v)=>{centralPrivateStorage.set(k,v);return true;};');
 vm.runInContext(fs.readFileSync('central-rules.js','utf8'),ctx);vm.runInContext(fs.readFileSync('central.js','utf8'),ctx);
 const api=appContext.run('VovinamCentral'),keyA=api.classKey('A'),keyB=api.classKey('B');
 const oldOwner={...ownerProfile,authEmail:owner.email},oldStaff={...staffProfile,assignedClassKeys:{[keyA]:true},assignedClassIds:['A'],authEmail:staff.email};
 const root={meta:{enabled:true,version:2,adminUid:owner.uid},profiles:{[owner.uid]:oldOwner,[staff.uid]:oldStaff},classDirectory:{[keyA]:{id:'A',name:'Lớp A'},[keyB]:{id:'B',name:'Lớp B'}},data:{[keyA]:{classes:{a:api.pack('A',{id:'A',name:'Lớp A'})},students:{a:api.pack('a',{_uid:'a',id:'A1',name:'An',className:'Lớp A'})},tuitionRecords:{a:api.pack('2026-11|a',{month:'2026-11',uid:'a',record:{studentUid:'a',studentId:'A1',status:'unpaid',amount:350000}})}},[keyB]:{classes:{b:api.pack('B',{id:'B',name:'Lớp B'})},students:{b:api.pack('b',{_uid:'b',id:'B1',name:'Bình',className:'Lớp B'})}}},siteConfig:api.pack('siteConfig',appContext.run('DEFAULT_SITE_CONFIG'))};
 // Use application-generated record hashes, exactly as the migration produces them.
 for(const group of [keyA,keyB])for(const field of Object.keys(root.data[group])){
  const next={};for(const packet of Object.values(root.data[group][field])){const key=require('crypto').createHash('sha256').update(packet.key).digest('hex');next[key]=packet;}root.data[group][field]=next;
 }
 await request('central_v2','owner','PUT',root);
 ctx.fetch=async(url,options={})=>{
  if(url.startsWith('https://identitytoolkit.googleapis.com/')){const u=new URL(url);return fetch(AUTH+'/identitytoolkit.googleapis.com'+u.pathname+'?key=fake',options);}
  if(url.startsWith(api.config.databaseURL+'/')){const u=new URL(url);u.searchParams.set('ns',NS);const result=await fetch(DB+u.pathname+'?'+u.searchParams.toString(),options);return result;}
  throw new Error('Unexpected non-emulator URL');
 };
 await api.prepare();await api.login(staff.email,'CorrectPass123');assert.equal(api.authenticated(),true);assert.equal(appContext.run('students.length'),1);assert.equal(appContext.run('students[0]._uid'),'a');assert.equal(appContext.run('accounts.length'),1);
 globalThis.centralSmoke={api,appContext,ctx,staffEmail:staff.email,ownerEmail:owner.email};
});
await test('Application adapter writes a payment through actual permission Rules and conditional writes',async()=>{
 const {api,appContext}=globalThis.centralSmoke;appContext.run('tuitionRecords["2026-11"].a.status="paid";tuitionRecords["2026-11"].a.amount=420000;');await api.push(true);assert.equal(appContext.run('tuitionRecords["2026-11"].a.amount'),420000);
});
await test('Another account on a clean application session receives the saved payment',async()=>{
 const {api,appContext,ownerEmail}=globalThis.centralSmoke;await api.logout();assert.equal(appContext.run('students.length'),0);await api.login(ownerEmail,'CorrectPass123');assert.equal(api.authenticated(),true);assert.equal(appContext.run('students.length'),2);assert.equal(appContext.run('tuitionRecords["2026-11"].a.amount'),420000);
});
console.log('TOTAL',passed,'actual Firebase emulator checks passed');

})().catch(e=>{console.error('FAIL',e.stack);process.exitCode=1;});
