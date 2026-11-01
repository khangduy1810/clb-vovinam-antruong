const fs=require('fs'),Module=require('module'),path=require('path');let h=fs.readFileSync('tests/browser-harness.cjs','utf8');h+=String.raw`
context.URLSearchParams=URLSearchParams;
const privateStore=new Map();context.privateStore=privateStore;
run('idbSetItem=async(k,v)=>{privateStore.set(k,JSON.parse(JSON.stringify(v)));return true;};idbGetItem=async k=>privateStore.get(k)||null;');
vm.runInContext(fs.readFileSync('central-rules.js','utf8'),context);vm.runInContext(fs.readFileSync('central.js','utf8'),context);
const api=run('VovinamCentral');const cA=api.classKey('cA'),cB=api.classKey('cB');const dbData={meta:{enabled:true,version:2,adminUid:'owner'},profiles:{owner:{uid:'owner',id:'ACC-ADMIN',username:'admin',name:'Admin',authEmail:'owner@example.com',status:'active',isSuperAdmin:true,allClasses:true,assignedClassIds:[],assignedClassKeys:{},permissions:{full_access:true}},staff:{uid:'staff',id:'cashA',username:'cash_a',name:'Thu ngân A',authEmail:'cash_a@accounts.clb-vovinam-antruong.invalid',status:'active',isSuperAdmin:false,allClasses:false,assignedClassIds:['cA'],assignedClassKeys:{[cA]:true},permissions:{tuition_manage:true,students_view:true}}},classDirectory:{[cA]:{id:'cA',name:'Lớp A'},[cB]:{id:'cB',name:'Lớp B'}},data:{},siteConfig:api.pack('siteConfig',run('DEFAULT_SITE_CONFIG')),legacyAccounts:{}};
const clone=x=>x===undefined?undefined:JSON.parse(JSON.stringify(x));
function getAt(parts){let value=dbData;for(const p of parts){value=value?.[p];}return clone(value??null);}
function putAt(parts,value){let obj=dbData;for(const p of parts.slice(0,-1))obj=obj[p]??={};if(value===null)delete obj[parts.at(-1)];else obj[parts.at(-1)]=clone(value);}
const etagAt=parts=>'"'+require('crypto').createHash('sha1').update(JSON.stringify(getAt(parts))).digest('hex')+'"';
const response=(status,value,etag)=>({ok:status>=200&&status<300,status,headers:{get:k=>k.toLowerCase()==='etag'?etag:null},json:async()=>clone(value),text:async()=>JSON.stringify(value)});
let writes=[],allowRace=null;
context.fetch=async(url,options={})=>{
 if(url.includes('identitytoolkit.googleapis.com')){
  const body=JSON.parse(options.body);if(url.includes('signInWithPassword')){
   const uid=body.email==='owner@example.com'?'owner':body.email==='cash_a@accounts.clb-vovinam-antruong.invalid'?'staff':null;
   if(!uid||body.password!=='CorrectPass123')return response(400,{error:{message:'INVALID_LOGIN_CREDENTIALS'}});
   return response(200,{localId:uid,email:body.email,idToken:'token_'+uid,refreshToken:'refresh_'+uid,expiresIn:'3600'});
  }
  throw Error('Unexpected auth mutation');
 }
 if(!url.includes('/central_v2'))throw Error('Unexpected URL');
 const parsed=new URL(url),uid=parsed.searchParams.get('auth')?.replace('token_',''),profile=dbData.profiles[uid],admin=uid==='owner'||profile?.permissions?.full_access;
 const part=parsed.pathname.split('/central_v2')[1].replace(/^\//,'').replace(/\.json$/,'');const parts=part?part.split('/'):[];
 let allowed=parts[0]==='meta';
 if(parts[0]==='profiles')allowed=Boolean(uid&&(admin||parts[1]===uid));
 if(['classDirectory','siteConfig'].includes(parts[0]))allowed=Boolean(profile?.status==='active');
 if(parts[0]==='legacyAccounts')allowed=Boolean(admin);
 if(parts[0]==='data')allowed=Boolean(profile?.status==='active'&&(admin||profile.allClasses||profile.assignedClassKeys?.[parts[1]]));
 if(parts[0]==='revisions')allowed=Boolean(profile?.status==='active'&&(admin||profile.assignedClassKeys?.[parts[1]]));
 if(!allowed)return response(401,{error:'Permission denied'});
 if(options.method){
  if(parts[0]==='profiles'&&!admin)return response(401,{error:'Permission denied'});
  if(parts[0]==='data'&&!admin&&parts[2]!=='tuitionRecords')return response(401,{error:'Permission denied'});
  const version=etagAt(parts);
  if(options.headers?.['if-match']&&options.headers['if-match']!==version)return response(412,{error:'Changed'});
  if(allowRace){const race=allowRace;allowRace=null;race(parts);return response(412,{error:'Changed'});}
  const value=JSON.parse(options.body);putAt(parts,value);writes.push({uid,parts,value});return response(200,value);
 }
 return response(200,getAt(parts),etagAt(parts));
};
async function seed(){
 const payload=run('safetyClone(buildFullDatabasePayload())');payload.classes=[{id:'cA',name:'Lớp A'},{id:'cB',name:'Lớp B'}];payload.students=[{_uid:'a1',id:'A1',name:'An',className:'Lớp A'},{_uid:'b1',id:'B1',name:'Bình',className:'Lớp B'}];payload.attendanceRecords={};payload.tuitionRecords={'2026-11':{a1:{studentUid:'a1',studentId:'A1',status:'unpaid',amount:350000},b1:{studentUid:'b1',studentId:'B1',status:'paid',amount:400000}}};payload.gearOrders=[];payload.tournamentEntries=[];payload.pendingRequests=[];payload.confirmedDuplicates={names:{},ids:{},uids:{}};
 for(const [route,entry] of Object.entries(await api.layout(payload))){if(route==='siteConfig')continue;putAt(route.split('/'),api.pack(entry.key,entry.value));}
}
async function atest(name,fn){try{await fn();count++;console.log('PASS',name);}catch(e){console.error('FAIL',name,e.stack);process.exitCode=1;}}
(async()=>{
await seed();
test('Rules are closed by default and reject unsafe owner UID',()=>{const rules=JSON.parse(context.vovinamCentralRules('owner')).rules;assert.equal(rules['.read'],false);assert.equal(rules['.write'],false);assert.equal(rules.central_v2.meta['.read'],true);assert.throws(()=>context.vovinamCentralRules("owner' || true"));});
test('Data pack preserves Firebase-invalid keys and empty collections',()=>{const data={'class/with.dot':[],empty:{}};assert.deepEqual(clone(api.unpack(api.pack('session/name',data))),data);});
await atest('Central activation requires published server metadata',async()=>{dbData.meta.enabled=false;await api.prepare();assert.equal(api.active,false);dbData.meta.enabled=true;await api.prepare();assert.equal(api.active,true);assert.equal(run('students.length'),0);});
await atest('Fresh device signs in without local accounts or Cloud settings',async()=>{run('accounts=[];cloudConfig.url="";');await api.login('cash_a','CorrectPass123');assert.equal(api.authenticated(),true);assert.equal(run('currentAccountId'),'cashA');assert.equal(run('students.length'),1);assert.equal(run('students[0]._uid'),'a1');assert.equal(run('accounts.length'),1);assert.equal(run('accounts[0].isSuperAdmin'),false);assert.equal(run('tuitionRecords["2026-11"].b1'),undefined);});
await atest('Payment upload touches only assigned-class tuition records',async()=>{writes=[];run('tuitionRecords["2026-11"].a1.status="paid";tuitionRecords["2026-11"].a1.amount=450000;');await api.push(true);const dataWrites=writes.filter(w=>w.parts[0]==='data');assert.equal(dataWrites.length,1);assert.equal(dataWrites[0].parts[1],cA);assert.equal(dataWrites[0].parts[2],'tuitionRecords');assert.equal(writes.some(w=>w.parts[0]==='profiles'),false);});
await atest('A fresh admin login receives both classes and server profiles',async()=>{await api.logout();assert.equal(run('students.length'),0);assert.equal(run('accounts.length'),0);await api.login('owner@example.com','CorrectPass123');assert.equal(run('students.length'),2);assert.equal(run('tuitionRecords["2026-11"].a1.amount'),450000);assert.equal(run('accounts.length'),2);});
await atest('Server permission changes replace peer permissions without account conflicts',async()=>{dbData.profiles.staff.permissions.settings_manage=false;await api.pull(true);assert.equal(run('accounts.find(a=>a.id==="cashA").permissions.settings_manage'),false);assert.equal(run('safetySyncConflicts.some(c=>c.path.startsWith("accounts/"))'),false);});
await atest('Accounts cannot be replaced by a peer JSON import',async()=>{run('globalThis.imported=safetyClone(buildFullDatabasePayload());imported.accounts=[];applyFullDatabasePayload(imported,"replace",true);');assert.equal(run('accounts.length'),2);});
await atest('Concurrent independent payment fields merge without losing remote changes',async()=>{
 const data=await api.layout(run('buildFullDatabasePayload()'));const route=Object.keys(data).find(route=>data[route].field==='tuitionRecords'&&data[route].value.uid==='a1');const packet=getAt(route.split('/'));const remote=api.unpack(packet);remote.record.receipt='REMOTE RECEIPT';putAt(route.split('/'),api.pack(packet.key,remote,packet.revision+1));
 run('tuitionRecords["2026-11"].a1.amount=500000;');await api.push(true);assert.equal(run('tuitionRecords["2026-11"].a1.receipt'),'REMOTE RECEIPT');assert.equal(run('tuitionRecords["2026-11"].a1.amount'),500000);
});
await atest('Conditional write retries a racing revision',async()=>{allowRace=parts=>{const packet=getAt(parts);if(packet){const value=api.unpack(packet);if(value.record)value.record.receipt='RACING RECEIPT';putAt(parts,api.pack(packet.key,value,packet.revision+1));}};run('tuitionRecords["2026-11"].a1.amount=550000;');await api.push(true);assert.equal(run('tuitionRecords["2026-11"].a1.amount'),550000);assert.equal(run('tuitionRecords["2026-11"].a1.receipt'),'RACING RECEIPT');});
await atest('Normal account cannot edit server permission profiles',async()=>{await api.logout();await api.login('cash_a','CorrectPass123');writes=[];await api.setAccount('cashA',p=>({...p,permissions:{full_access:true}}));assert.equal(writes.some(w=>w.parts[0]==='profiles'),false);assert.equal(dbData.profiles.staff.permissions.full_access,undefined);});
await atest('A profile revocation is applied even while local data conflicts are pending',async()=>{
 const streams=[];context.EventSource=class {constructor(url){this.url=url;this.handlers={};streams.push(this);}addEventListener(name,fn){this.handlers[name]=fn;}close(){}};
 api.start();await new Promise(resolve=>setImmediate(resolve));
 const event=streams.find(s=>s.url.includes('/profiles/staff.json'));assert.ok(event);
 run('safetySyncConflicts=[{path:"tuitionRecords/2026-11/a1/amount",local:1,remote:2}];');dbData.profiles.staff.status='locked';
 await event.handlers.put({data:'{}'});assert.equal(api.authenticated(),false);assert.equal(run('students.length'),0);assert.equal(run('safetySyncConflicts.length'),0);
 dbData.profiles.staff.status='active';await api.login('cash_a','CorrectPass123');
});
await atest('Revoking an account removes cached data from the visible application',async()=>{dbData.profiles.staff.status='locked';await assert.rejects(api.pull(true));assert.equal(api.authenticated(),false);assert.equal(run('students.length'),0);assert.equal(run('accounts.length'),0);});
await atest('Incorrect login never exposes another account cache',async()=>{await api.login('cash_a','incorrect');assert.equal(api.authenticated(),false);assert.equal(run('students.length'),0);assert.equal(run('currentAccountId'),'');});
console.log('TOTAL',count,'central auth/data checks passed');
})().catch(e=>{console.error('FAIL',e.stack);process.exitCode=1;});
`;new Module('central-tests',module)._compile(h,path.resolve('tests/central-generated.cjs'));
