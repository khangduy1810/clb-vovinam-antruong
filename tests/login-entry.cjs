const vm=require('vm'),fs=require('fs'),assert=require('assert');
const nodes=new Map(),stored=new Map(),redirects=[],events=[];
function node(id){if(!nodes.has(id))nodes.set(id,{value:'',textContent:'',dataset:{},disabled:false,type:'password',attrs:{},handlers:{},addEventListener(name,fn){this.handlers[name]=fn;},setAttribute(name,value){this.attrs[name]=value;}});return nodes.get(id);}
const flags={enabled:true,metaStatus:200,dataStatus:401,error:null,authError:null,failWrite:false,profile:{uid:'u1',id:'ACC1',name:'HLV',status:'active',permissions:{attendance_manage:true}}};let authCalls=0;
const context={console,URLSearchParams,AbortController,setTimeout,clearTimeout,Date,document:{getElementById:node},localStorage:{setItem(){},removeItem(){}},location:{replace(url){events.push('redirect');redirects.push(url);}},fetch:async(url,options={})=>{
 if(flags.error)throw flags.error;
 const reply=(status,value)=>({ok:status>=200&&status<300,status,json:async()=>value});
 if(url.includes('/meta.json'))return reply(flags.metaStatus,{enabled:flags.enabled,version:2});
 if(url.includes('/data.json'))return reply(flags.dataStatus,null);
 if(url.includes('signInWithPassword')){authCalls++;if(flags.authError)return reply(400,{error:{message:flags.authError}});return reply(200,{localId:'u1',email:'hlv@accounts.clb-vovinam-antruong.invalid',idToken:'test_id_token',refreshToken:'test_refresh',expiresIn:'3600'});}
 if(url.includes('/profiles/'))return reply(200,flags.profile);
 throw Error('Unexpected URL');
},indexedDB:{open(){const open={};setImmediate(()=>{const names=new Set();const db={objectStoreNames:{contains:name=>names.has(name)},createObjectStore(name){names.add(name);},close(){},transaction(){const tx={};let item;tx.objectStore=()=>({put(value){item=value;setImmediate(()=>{if(flags.failWrite){tx.onabort?.();return;}stored.set(value.key,value);events.push('storage-commit');tx.oncomplete?.();});}});return tx;}};open.result=db;open.onupgradeneeded?.();open.onsuccess?.();});return open;}}};
context.window=context;vm.createContext(context);vm.runInContext(fs.readFileSync('firebase-config.js','utf8'),context);vm.runInContext(fs.readFileSync('login-entry.js','utf8'),context);const api=context.VovinamLoginEntry;
let passed=0;async function test(name,fn){try{await fn();console.log('PASS',name);passed++;}catch(error){console.error('FAIL',name,error.stack);process.exitCode=1;}}
const tick=()=>new Promise(resolve=>setImmediate(resolve));const event={preventDefault(){}};
function reset(){stored.clear();redirects.length=0;events.length=0;flags.enabled=true;flags.metaStatus=200;flags.dataStatus=401;flags.error=null;flags.authError=null;flags.failWrite=false;flags.profile={uid:'u1',id:'ACC1',name:'HLV',status:'active',permissions:{attendance_manage:true}};node('signin-user').value='hlv';node('signin-password').value='CorrectPass123';}
(async()=>{
await tick();
await test('Login names with a leading @ match central aliases',async()=>{assert.equal(api.normalizeEmail(' @@HLV_TRI '),'hlv_tri@accounts.clb-vovinam-antruong.invalid');assert.equal(api.normalizeEmail('ADMIN@EXAMPLE.COM'),'admin@example.com');});
await test('Unactivated server is reported before credentials are sent',async()=>{reset();flags.enabled=false;const calls=authCalls;await api.submit(event);assert.equal(authCalls,calls);assert.equal(api.ready,false);assert.ok(node('signin-status').textContent.includes('chưa được kích hoạt'));assert.equal(redirects.length,0);});
await test('Public data Rules block login instead of falling back to local accounts',async()=>{reset();flags.dataStatus=200;const calls=authCalls;await api.submit(event);assert.equal(authCalls,calls);assert.equal(api.ready,false);assert.equal(redirects.length,0);assert.ok(node('signin-status').textContent.includes('chưa được bảo vệ'));});
await test('Missing discovery permissions has an actionable administrator message',async()=>{reset();flags.metaStatus=401;await api.check();assert.ok(node('signin-status').textContent.includes('Publish đúng Rules'));});
await test('Invalid password does not redirect or save a session',async()=>{reset();flags.authError='INVALID_LOGIN_CREDENTIALS';await api.submit(event);assert.equal(stored.size,0);assert.equal(redirects.length,0);assert.ok(node('signin-status').textContent.includes('không đúng'));});
await test('Valid Firebase identity without a club profile cannot enter',async()=>{reset();flags.profile=null;await api.submit(event);assert.equal(stored.size,0);assert.equal(redirects.length,0);assert.ok(node('signin-status').textContent.includes('chưa được cấp hồ sơ quyền'));});
await test('Locked profile cannot enter',async()=>{reset();flags.profile.status='locked';await api.submit(event);assert.equal(stored.size,0);assert.equal(redirects.length,0);assert.ok(node('signin-status').textContent.includes('bị khóa'));});
await test('Approved account redirects only after confirmed session storage',async()=>{reset();await api.submit(event);assert.equal(stored.get('vovinam_central_auth_v1').value.uid,'u1');assert.ok(stored.get('vovinam_central_auth_v1').value.expiresAt>Date.now());assert.deepEqual(events,['storage-commit','redirect']);assert.deepEqual(redirects,['index.html?entry=central-v2']);assert.ok(!redirects[0].includes('token'));assert.equal(node('signin-password').value,'');});
await test('Storage failure keeps the login page open',async()=>{reset();flags.failWrite=true;await api.submit(event);assert.equal(stored.size,0);assert.equal(redirects.length,0);assert.ok(node('signin-status').textContent.includes('Chưa lưu được phiên'));});
await test('Timeout ends the loading state and permits retry',async()=>{reset();flags.error={name:'AbortError',message:'aborted'};await api.check();assert.equal(node('signin-retry').disabled,false);assert.equal(api.ready,false);assert.ok(node('signin-status').textContent.includes('15 giây'));flags.error=null;await api.check();assert.equal(api.ready,true);});
console.log('TOTAL',passed,'login entry checks passed');
})().catch(error=>{console.error(error);process.exitCode=1;});
