/* Central sign-in and class-scoped storage. No credential/password database is sent between browsers. */
(function(root){
'use strict';
const config=root.VOVINAM_FIREBASE_CONFIG||Object.freeze({apiKey:'AIzaSyBVLei7bl_BQGQYSfNvqkhHnTfgYcckLj4',authDomain:'clb-vovinam-antruong.firebaseapp.com',databaseURL:'https://clb-vovinam-antruong-default-rtdb.asia-southeast1.firebasedatabase.app',projectId:'clb-vovinam-antruong',appId:'1:333636723863:web:3b82f17394d0bec89475d2'});
const PREFIX='central_v2',AUTH_KEY='vovinam_central_auth_v1',FIELDS=['classes','students','attendanceRecords','tuitionRecords','gearOrders','tournamentEntries','pendingRequests','confirmedDuplicates'];
let active=false,verified=false,session=null,profile=null,meta=null,base={},profiles=[],legacyProfiles=[],directory={},streams=[],poll=null,sendTimer=null,refreshTimer=null,refreshPromise=null,syncTask=null,rerun=false,generation=0,setupSession=null,pullTimer=null,accountEdit=null,setupRunning=false;
const clone=value=>value===undefined?undefined:JSON.parse(JSON.stringify(value));
const eq=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const $=id=>document.getElementById(id);
const isAdmin=()=>Boolean(profile && (profile.isSuperAdmin || profile.permissions?.full_access));
const errorText=error=>({EMAIL_EXISTS:'Email đã tồn tại. Chọn đăng nhập tài khoản Firebase đã có.',INVALID_LOGIN_CREDENTIALS:'Email/tên đăng nhập hoặc mật khẩu không đúng.',EMAIL_NOT_FOUND:'Email/tên đăng nhập hoặc mật khẩu không đúng.',INVALID_PASSWORD:'Email/tên đăng nhập hoặc mật khẩu không đúng.',USER_DISABLED:'Tài khoản Firebase đã bị vô hiệu hóa.',TOO_MANY_ATTEMPTS_TRY_LATER:'Có quá nhiều lần thử. Vui lòng thử lại sau.',OPERATION_NOT_ALLOWED:'Chưa bật Email/Password trong Firebase Authentication.'}[String(error.message).split(' : ')[0]] || cloudSafeReason(error.message));
function authenticated(){return Boolean(active && verified && session?.uid && profile?.uid===session.uid && profile.status==='active' && session.expiresAt>Date.now() && localStorage.getItem('vovinam_session_locked')!=='1');}
async function request(url,options={}){
 const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),15000);
 try{return await fetch(url,{...options,signal:controller.signal});}finally{clearTimeout(timeout);}
}
async function authCall(method,body){
 const response=await request('https://identitytoolkit.googleapis.com/v1/accounts:'+method+'?key='+encodeURIComponent(config.apiKey),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
 const result=await response.json();if(!response.ok)throw new Error(result.error?.message||'Firebase Authentication chưa phản hồi.');return result;
}
function toSession(result,email){return {uid:result.localId,email:result.email||email,idToken:result.idToken,refreshToken:result.refreshToken,expiresAt:Date.now()+Number(result.expiresIn||3600)*1000};}
async function token(){
 if(!session)throw new Error('Vui lòng đăng nhập Firebase.');
 if(session.expiresAt>Date.now()+60000)return session.idToken;
 if(refreshPromise)return refreshPromise;
 const owner=session.uid,epoch=generation,previous=session;
 refreshPromise=(async()=>{
  const response=await request('https://securetoken.googleapis.com/v1/token?key='+encodeURIComponent(config.apiKey),{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'refresh_token',refresh_token:previous.refreshToken}).toString()});
  const result=await response.json();if(!response.ok)throw new Error('Phiên Firebase đã hết hạn; vui lòng đăng nhập lại.');
  if(epoch!==generation || session?.uid!==owner)throw new Error('Phiên đăng nhập đã thay đổi.');
  session={...previous,idToken:result.id_token,refreshToken:result.refresh_token,expiresAt:Date.now()+Number(result.expires_in||3600)*1000};
  if(!await idbSetItem(AUTH_KEY,session))throw new Error('Chưa lưu được phiên đăng nhập.');
  restartStreams();return session.idToken;
 })().finally(()=>{refreshPromise=null;});return refreshPromise;
}
async function db(path,options={},auth=true){
 const credential=auth?await token():null;
 const url=config.databaseURL+'/'+PREFIX+(path?'/'+path:'')+'.json'+(credential?'?auth='+encodeURIComponent(credential):'');
 const response=await request(url,{cache:'no-store',...options,headers:{...(options.body?{'Content-Type':'application/json'}:{}),...options.headers}});
 if(!response.ok)throw await cloudHttpError(response,options.method?'ghi':'đọc');return response;
}
const read=async(path,auth=true)=>await (await db(path,{},auth)).json();
const write=async(path,value)=>await db(path,{method:'PUT',body:JSON.stringify(value)});
async function hash(text){const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text));return Array.from(new Uint8Array(bytes),b=>b.toString(16).padStart(2,'0')).join('');}
const classKey=id=>'c_'+Array.from(new TextEncoder().encode(String(id)),b=>b.toString(16).padStart(2,'0')).join('');
function pack(key,value,revision=1){
 const json=JSON.stringify(value),chunks=[];
 for(let start=0;start<json.length;){let end=Math.min(start+240000,json.length);if(end<json.length && /[\uD800-\uDBFF]/.test(json[end-1]))end--;chunks.push(json.slice(start,end));start=end;}
 if(new Blob([json]).size>8*1024*1024)throw new Error('Một hồ sơ vượt 8 MB. Hãy giảm dung lượng tệp đính kèm trước khi gửi.');
 return {key:String(key),chunks,revision,updatedAt:new Date().toISOString()};
}
function unpack(packet){
 if(!packet || typeof packet.key!=='string' || !Array.isArray(packet.chunks) || !packet.chunks.length || packet.chunks.length>40 || packet.chunks.some(x=>typeof x!=='string' || x.length>240000))throw new Error('Bản ghi máy chủ không hợp lệ.');
 const json=packet.chunks.join('');if(new Blob([json]).size>8*1024*1024)throw new Error('Bản ghi máy chủ quá lớn.');return JSON.parse(json);
}
function profileToAccount(value){return {...value,assignedClassIds:Object.values(value.assignedClassIds||{}),permissions:value.permissions||{},passwordHash:'firebase-auth:'+value.uid,firebaseUid:value.uid};}
function blankPayload(){return {version:'4.0',students:[],classes:[],accounts:[],attendanceRecords:{},tuitionRecords:{},gearOrders:[],tournamentEntries:[],pendingRequests:[],siteConfig:clone(DEFAULT_SITE_CONFIG),confirmedDuplicates:{names:{},ids:{},uids:{}},deletedRegistry:{students:{},classes:{},accounts:{},requests:{},gear:{},tournaments:{},restored:{}}};}
function selectedClasses(){return isAdmin() || profile?.allClasses?Object.keys(directory):Object.keys(profile?.assignedClassKeys||{}).filter(key=>profile.assignedClassKeys[key]===true);}
function canReadField(field){if(field==='pendingRequests' && profile?.permissions?.students_request)return true;return isAdmin() || field==='classes' || field==='students' || field==='confirmedDuplicates' || Boolean(profile?.permissions?.[{attendanceRecords:'attendance_manage',tuitionRecords:'tuition_manage',gearOrders:'gear_manage',tournamentEntries:'tournaments_manage',pendingRequests:'approvals_manage'}[field]]);}
async function layout(payload){
 const result={},roster=payload.students||[],classForName=name=>{const item=(payload.classes||[]).find(c=>c.name===name || c.previousNames?.includes(name));return item?classKey(item.id):'unassigned';};
 const routeForRecord=record=>{const person=roster.find(s=>s._uid===(record.studentUid||record.data?._uid)) || (roster.filter(s=>s.id===record.studentId).length===1?roster.find(s=>s.id===record.studentId):null);return classForName(person?.className||record.className||record.data?.className);};
 const add=async(field,key,value,group,path)=>{const route='data/'+group+'/'+field+'/'+await hash(String(key));result[route]={field,key:String(key),value:clone(value),group,path};};
 for(const item of payload.classes||[])await add('classes',item.id,item,classKey(item.id),['classes',item.id]);
 for(const item of roster)await add('students',item._uid,item,classForName(item.className),['students',item._uid]);
 for(const [key,value] of Object.entries(payload.attendanceRecords||{})){
  const known=Object.keys(directory).find(k=>key.endsWith('_'+directory[k].name));
  const classItem=(payload.classes||[]).find(c=>key.endsWith('_'+c.name));
  await add('attendanceRecords',key,value,classItem?classKey(classItem.id):known||'unassigned',['attendanceRecords',key]);
 }
 for(const [month,items] of Object.entries(payload.tuitionRecords||{}))for(const [uid,value] of Object.entries(items))await add('tuitionRecords',month+'|'+uid,{month,uid,record:value},routeForRecord({...value,studentUid:value.studentUid||uid}),['tuitionRecords',month,uid]);
 for(const field of ['gearOrders','tournamentEntries','pendingRequests'])for(const item of payload[field]||[])await add(field,item.reqId||item.id,item,routeForRecord(item),[field,item.reqId||item.id]);
 for(const cls of payload.classes||[]){
  const people=roster.filter(s=>s.className===cls.name || cls.previousNames?.includes(s.className)),uids=new Set(people.map(s=>s._uid));
  const confirmations={names:{},ids:{},uids:{}};
  for(const person of people){const name=normalizeDupName(person.name),id=normalizeDupId(person.id);if(payload.confirmedDuplicates?.names?.[name])confirmations.names[name]=payload.confirmedDuplicates.names[name];if(payload.confirmedDuplicates?.ids?.[id])confirmations.ids[id]=payload.confirmedDuplicates.ids[id];}
  for(const [key,value] of Object.entries(payload.confirmedDuplicates?.uids||{}))if([...uids].some(uid=>key.startsWith(uid+':')))confirmations.uids[key]=value;
  if(Object.values(confirmations).some(items=>Object.keys(items).length) || Object.values(base).some(entry=>entry.field==='confirmedDuplicates' && entry.group===classKey(cls.id)))await add('confirmedDuplicates','confirmations',confirmations,classKey(cls.id),['confirmedDuplicates']);
 }
 result.siteConfig={field:'siteConfig',key:'siteConfig',value:clone(payload.siteConfig),group:'__config',path:['siteConfig']};
 return result;
}
function entriesPayload(entries){
 const payload=blankPayload();payload.accounts=profiles.map(profileToAccount);
 if(isAdmin())for(const old of legacyProfiles)if(!payload.accounts.some(a=>a.id===old.id))payload.accounts.push({...old,passwordHash:'central-pending',firebaseUid:'',isSuperAdmin:false,permissions:old.permissions||{}});
 for(const entry of Object.values(entries)){
  const {field,key,value}=entry;if(value===undefined)continue;
  if(['classes','students','gearOrders','tournamentEntries','pendingRequests'].includes(field)){
   const idField=field==='students'?'_uid':field==='pendingRequests'?'reqId':'id';
   if(payload[field].some(item=>item[idField]===value[idField]))throw new Error('Máy chủ có bản ghi trùng mã nội bộ ở nhiều lớp. Liên hệ quản trị viên để xử lý.');
   payload[field].push(clone(value));
  }else if(field==='siteConfig')payload.siteConfig=clone(value);
  else if(field==='confirmedDuplicates'){for(const kind of ['names','ids','uids'])Object.assign(payload.confirmedDuplicates[kind],value[kind]||{});}
  else if(field==='attendanceRecords')payload.attendanceRecords[key]=clone(value);
  else if(field==='tuitionRecords'){payload.tuitionRecords[value.month]??={};payload.tuitionRecords[value.month][value.uid]=clone(value.record);}
 }
 return payload;
}
function mergeEntry(before,local,remote){
 const target=local||remote||before;if(!target)return undefined;
 let value;
 const path=target.path.map(encodeURIComponent).join('/');
 if(target.field==='attendanceRecords' && before && local && remote)value=safetyMergeRows(before.value,local.value,remote.value,'studentUid',path);
 else if(target.field==='tuitionRecords'){
  const record=safetyThreeWay(before?.value?.record,local?.value?.record,remote?.value?.record,path);value=record===undefined?undefined:{...(local?.value||remote?.value||before.value),record};
 }else value=safetyThreeWay(before?.value,local?.value,remote?.value,path);
 return value===undefined?undefined:{...target,value};
}
function cacheEntry(payload){if(!active || !session || !profile)return null;return {key:'vovinam_central_cache_'+session.uid,value:{uid:session.uid,base:clone(base),payload:clone(payload)}};}
async function applyPayload(payload,pending=false){
 if(Object.keys(STORAGE_FIELDS).every(field=>eq(payload[field],buildFullDatabasePayload()[field]))){const cache=cacheEntry(payload);if(cache && !await idbSetItem(cache.key,cache.value))throw new Error('Chưa lưu được mốc đồng bộ của tài khoản.');durablePendingCloud=pending;if(!pending)await durableAcknowledgeCloud(payload);return;}
 payload.updatedAt=new Date().toISOString();payload.updatedBy=profile?.name||'';payload.hasUserEdits=false;
 safetyValidate(payload,'replace');safetyMigrateLinks(payload);safetyAssertCompleteMedia(payload);
 const committed=durableEnabled?await durablePersist(payload,{source:pending?'local':'cloud'}):null;
 if(!durableEnabled)safetyPersist(payload);
 safetyAssign(committed||payload);currentAccountId=profile.id;currentUserRole=isAdmin()?'admin':'staff';
 durablePendingCloud=pending;if(!pending && durableEnabled)await durableAcknowledgeCloud(committed||payload);
 refreshAllUiViewsSafely(true);updateLoginUI();
}

function wipeUI(){
 safetySyncConflicts=[];safetyShowConflicts();currentAccountId='';currentUserRole='staff';students=[];classes=[];accounts=[];attendanceRecords={};tuitionRecords={};gearOrders=[];tournamentEntries=[];pendingRequests=[];
 deletedRegistry=blankPayload().deletedRegistry;confirmedDuplicates={names:{},ids:{},uids:{}};
 try{refreshAllUiViewsSafely(false);}catch{}updateLoginUI();
}
function revoke(){stop();generation++;session=null;profile=null;base={};idbSetItem(AUTH_KEY,null);wipeUI();}

async function fetchState(){
 const own=await read('profiles/'+session.uid);
 if(!own || own.uid!==session.uid || own.status!=='active'){revoke();throw new Error('Tài khoản chưa được cấp quyền hoặc đã bị khóa. Liên hệ quản trị viên.');}
 const oldScope=profile?JSON.stringify([profile.permissions,profile.assignedClassKeys,profile.allClasses]):null;profile=own;
 directory=await read('classDirectory')||{};
 profiles=isAdmin()?Object.values(await read('profiles')||{}):[own];legacyProfiles=isAdmin()?Object.values(await read('legacyAccounts')||{}):[];
 const result={};
 const jobs=[];
 for(const group of selectedClasses())for(const field of FIELDS){
  if(!canReadField(field))continue;
  jobs.push(async()=>{const packets=await read('data/'+group+'/'+field)||{};for(const [key,packet] of Object.entries(packets)){
   const value=unpack(packet),path=field==='tuitionRecords'?['tuitionRecords',value.month,value.uid]:field==='confirmedDuplicates'?['confirmedDuplicates']:[field,packet.key];
   result['data/'+group+'/'+field+'/'+key]={field,key:packet.key,value,group,path,revision:packet.revision};
  }});
 }
 // Bound concurrent REST calls on mobile; a failure never applies a partial database.
 let cursor=0;await Promise.all(Array.from({length:Math.min(4,jobs.length)},async()=>{while(cursor<jobs.length)await jobs[cursor++]();}));
 const settings=await read('siteConfig');if(settings)result.siteConfig={field:'siteConfig',key:'siteConfig',value:unpack(settings),group:'__config',path:['siteConfig'],revision:settings.revision};return {records:result,siteConfig:settings?unpack(settings):clone(DEFAULT_SITE_CONFIG),scopeChanged:oldScope!==null && oldScope!==JSON.stringify([profile.permissions,profile.assignedClassKeys,profile.allClasses])};
}
async function pull(manual=false,first=false){
 if(!authenticated())return;
 if(syncTask){rerun=true;return syncTask;}
 const epoch=generation;
 syncTask=(async()=>{
  if(durableEnabled){await durableMutationQueue.catch(()=>{});await durableSerial.catch(()=>{});}
  const state=await fetchState();if(epoch!==generation)return;
  if(state.scopeChanged){await idbSetItem('vovinam_central_recovery_'+session.uid,{at:Date.now(),reason:'Thay đổi phạm vi quyền',payload:clone(buildFullDatabasePayload()),base:clone(base)});safetySyncConflicts=[];safetyShowConflicts();}
  const task=durableMutationQueue.catch(()=>{}).then(async()=>{
   if(epoch!==generation)return;
   const local=first?null:await layout(buildFullDatabasePayload()),merged={};
   if(state.scopeChanged)showToast('Quyền hoặc lớp được giao đã thay đổi. Đã tải lại dữ liệu theo quyền mới.','info');
   for(const route of new Set([...Object.keys(base),...Object.keys(local||{}),...Object.keys(state.records)])){
    const value=first || state.scopeChanged?state.records[route]:mergeEntry(base[route],local?.[route],state.records[route]);if(value)merged[route]=value;
   }
   base=clone(state.records);const payload=entriesPayload(merged);const pending=[...new Set([...Object.keys(base),...Object.keys(merged)])].some(route=>pendingDifferent(base[route],merged[route]));await applyPayload(payload,pending);
  });durableMutationQueue=task;await task;
  if(safetySyncConflicts.length)safetyShowConflicts();
  if(manual)showToast('Đã tải dữ liệu theo tài khoản và lớp được giao.','success');
  updateCloudStatusUI('connected','• Đăng nhập tập trung');
 })().catch(error=>{updateCloudStatusUI('error');showCloudDiagnostic('error',errorText(error));if(manual)showToast(errorText(error),'error');throw error;}).finally(()=>{syncTask=null;if(rerun){rerun=false;if(durablePendingCloud)schedule();else schedulePull();}});
 return syncTask;
}
function pendingDifferent(a,b){return !eq(a?.value,b?.value);}
async function push(manual=false){
 if(!authenticated() || safetySyncConflicts.length)return;
 if(syncTask){rerun=true;return syncTask;}
 const epoch=generation;
 syncTask=(async()=>{
  if(durableEnabled){await durableMutationQueue.catch(()=>{});await durableSerial;}
  const desired=await layout(buildFullDatabasePayload()),routes=[...new Set([...Object.keys(base),...Object.keys(desired)])].filter(route=>pendingDifferent(base[route],desired[route]));
  updateCloudStatusUI('syncing');const changedGroups=new Set();
  for(const route of routes){
   if(epoch!==generation)throw new Error('Phiên đăng nhập đã thay đổi.');
   const before=base[route],local=desired[route];
   for(let attempt=0;attempt<4;attempt++){
    const response=await db(route,{headers:{'X-Firebase-ETag':'true'}}),packet=await response.json(),etag=response.headers.get('ETag');
    if(!etag)throw new Error('Máy chủ không cung cấp phiên bản kiểm soát ghi.');
    const remote=packet?{...(local||before),key:packet.key,value:unpack(packet),revision:packet.revision}:undefined;
    const count=safetySyncConflicts.length,merged=mergeEntry(before,local,remote);
    if(safetySyncConflicts.length>count){if(remote)base[route]=remote;else delete base[route];await idbSetItem('vovinam_central_cache_'+session.uid,{uid:session.uid,base:clone(base),payload:clone(buildFullDatabasePayload())});safetyShowConflicts();throw new Error('Có thay đổi cùng một bản ghi. Hãy chọn phiên bản cần giữ.');}
    if(!pendingDifferent(merged,remote)){if(remote)base[route]=remote;else delete base[route];break;}
    const value=merged?pack(merged.key,merged.value,(packet?.revision||0)+1):null;
    const credential=await token();const result=await request(config.databaseURL+'/'+PREFIX+'/'+route+'.json?auth='+encodeURIComponent(credential),{method:'PUT',headers:{'Content-Type':'application/json','if-match':etag},body:JSON.stringify(value)});
    if(result.status===412){if(attempt===3)throw new Error('Bản ghi liên tục thay đổi; sẽ gửi lại sau.');continue;}
    if(!result.ok)throw await cloudHttpError(result,'ghi');
    if(merged)base[route]={...merged,revision:value.revision};else delete base[route];changedGroups.add((local||before).group);
    if((local||before).field==='classes'){const item=merged?.value||before.value;await write('classDirectory/'+(local||before).group,{id:item.id,name:item.name,archived:!merged});}
    break;
   }
  }
  for(const group of changedGroups)await write('revisions/'+group,new Date().toISOString());
  const finalize=durableMutationQueue.catch(()=>{}).then(async()=>{
   if(epoch!==generation)return;
   const current=await layout(buildFullDatabasePayload()),reconciled={};
   for(const route of new Set([...Object.keys(desired),...Object.keys(current),...Object.keys(base)])){
    const value=mergeEntry(desired[route],current[route],base[route]);if(value)reconciled[route]=value;
   }
   const payload=entriesPayload(reconciled);
   const pending=[...new Set([...Object.keys(base),...Object.keys(reconciled)])].some(route=>pendingDifferent(base[route],reconciled[route]));
   await applyPayload(payload,pending);durablePendingCloud=pending;
   if(!await idbSetItem('vovinam_central_cache_'+session.uid,{uid:session.uid,base:clone(base),payload:clone(buildFullDatabasePayload())}))throw new Error('Chưa lưu được mốc đồng bộ của tài khoản.');
   if(!pending)await durableAcknowledgeCloud(buildFullDatabasePayload());
  });durableMutationQueue=finalize;await finalize;
  updateCloudStatusUI('connected','• Máy chủ đã xác nhận');if(manual)showToast('Máy chủ đã xác nhận lưu các thay đổi.','success');
 })().catch(error=>{durablePendingCloud=true;updateCloudStatusUI('error');showCloudDiagnostic('error',errorText(error));if(manual)showToast(errorText(error),'error');throw error;}).finally(()=>{syncTask=null;if(rerun){rerun=false;schedule();}else schedulePull();});return syncTask;
}
function schedule(){if(!active || !authenticated())return;if(sendTimer)clearTimeout(sendTimer);sendTimer=setTimeout(()=>{sendTimer=null;push(false).catch(()=>{});},200);}
function schedulePull(){if(pullTimer || !authenticated() || safetySyncConflicts.length)return;pullTimer=setTimeout(()=>{pullTimer=null;pull(false).catch(()=>{});},250);}
function stop(){for(const stream of streams)stream.close();streams=[];for(const id of [sendTimer,pullTimer,refreshTimer])if(id)clearTimeout(id);if(poll)clearInterval(poll);sendTimer=pullTimer=refreshTimer=poll=null;}
async function restartStreams(){
 if(!authenticated())return;for(const stream of streams)stream.close();streams=[];
 const credential=await token();if(typeof EventSource==='undefined')return;
 const paths=['profiles/'+session.uid,...(isAdmin()?['revisions','profiles']:selectedClasses().map(key=>'revisions/'+key))];
 for(const path of paths){const stream=new EventSource(config.databaseURL+'/'+PREFIX+'/'+path+'.json?auth='+encodeURIComponent(credential));streams.push(stream);const update=path.startsWith('profiles')?()=>pull(false).catch(()=>{}):()=>schedulePull();stream.addEventListener('put',update);stream.addEventListener('patch',update);}
}
function start(){if(!active || !authenticated())return;stop();if(durablePendingCloud)schedule();restartStreams().catch(()=>{});poll=setInterval(()=>{if(!authenticated())return;if(durablePendingCloud)push(false).catch(()=>{});else pull(false).catch(()=>{});},5000);refreshTimer=setTimeout(()=>token().then(start).catch(()=>logout()),Math.max(1000,session.expiresAt-Date.now()-45000));}
function updateLoginUI(){
 if(!active)return;
 $('central-setup-card')?.classList.add('hidden');
 $('cloud-db-url')?.closest('.grid')?.classList.add('hidden');
 $('quick-login-toggle-label')?.closest('button')?.parentElement?.classList.add('hidden');
 const title=$('quick-login-toggle-label');if(title)title.textContent='Đăng nhập bằng tài khoản được cấp';
 const quick=$('quick-login-dropdown-panel');if(quick)quick.classList.add('hidden');
 const input=$('login-username');if(input)input.placeholder='Email hoặc tên đăng nhập được cấp';
 const modal=$('login-modal');if(modal)modal.classList.toggle('hidden',authenticated());
 const note=$('central-login-note');if(note)note.textContent='Tài khoản và quyền được tải từ máy chủ. Không cần ghép máy.';
}
const loginEmail=username=>{const text=String(username||'').trim().replace(/^@+/,'');return text.includes('@')?text.toLowerCase():sanitizeUsername(text)+'@accounts.clb-vovinam-antruong.invalid';};
async function login(username,password){
 try{
  if(!verified)throw new Error('Máy chủ đăng nhập trung tâm chưa được xác nhận an toàn hoặc đang bảo trì. Vui lòng liên hệ quản trị viên.');
  stop();if(durableEnabled){await durableMutationQueue.catch(()=>{});await durableSerial.catch(()=>{});}if(syncTask)await syncTask.catch(()=>{});
  const result=await authCall('signInWithPassword',{email:loginEmail(username),password:String(password),returnSecureToken:true});
  generation++;session=toSession(result,loginEmail(username));profile=null;base={};wipeUI();
  await enter();recordSuccessfulLogin(username);$('login-password').value='';showToast('Đã đăng nhập và tải dữ liệu được cấp quyền.','success');
 }catch(error){if($('login-error-box'))$('login-error-box').classList.remove('hidden');if($('login-error-msg'))$('login-error-msg').textContent=errorText(error);showToast(errorText(error),'error');revoke();updateLoginUI();}
}
async function enter(){
 const own=await read('profiles/'+session.uid);if(!own || own.uid!==session.uid || own.status!=='active')throw new Error('Tài khoản chưa được cấp quyền hoặc đã bị khóa. Liên hệ quản trị viên.');
 profile=own;currentAccountId=own.id;profiles=[own];localStorage.removeItem('vovinam_session_locked');safetySyncConflicts=[];safetyShowConflicts();
 const saved=await idbGetItem('vovinam_central_cache_'+session.uid);base=saved?.uid===session.uid?saved.base||{}:{};
 const primary=await idbGetItem('vovinam_primary_central_'+session.uid);durableRevision=primary?.revision||0;durableBase=primary?.payload?clone(primary.payload):null;
 if(!await idbSetItem(AUTH_KEY,session))throw new Error('Trình duyệt chưa lưu được phiên đăng nhập.');
 // Seed only this principal's cache; never merge another account's browser database.
 if(saved?.payload){safetyAssign(saved.payload);await pull(false,false);}else await pull(false,true);
 localStorage.removeItem('vovinam_session_locked');$('login-modal').classList.add('hidden');resetInactivityTimer();start();
}
async function logout(){
 stop();if(durableEnabled){await durableMutationQueue.catch(()=>{});await durableSerial.catch(()=>{});}if(syncTask)await syncTask.catch(()=>{});
 safetySyncConflicts=[];safetyShowConflicts();generation++;session=null;profile=null;base={};profiles=[];durableBase=null;durableRevision=0;await idbSetItem(AUTH_KEY,null);currentAccountId='';currentUserRole='staff';
 const empty=blankPayload();students=[];classes=[];accounts=[];attendanceRecords={};tuitionRecords={};gearOrders=[];tournamentEntries=[];pendingRequests=[];deletedRegistry=empty.deletedRegistry;confirmedDuplicates=empty.confirmedDuplicates;
 localStorage.removeItem('vovinam_auth_session');localStorage.removeItem('vovinam_session_locked');$('session-lock-modal')?.classList.add('hidden');
 refreshAllUiViewsSafely(false);updateLoginUI();
}
async function unlock(password){try{const result=await authCall('signInWithPassword',{email:session.email,password,returnSecureToken:true});if(result.localId!==session.uid)throw new Error('Tài khoản không khớp.');session=toSession(result,session.email);await idbSetItem(AUTH_KEY,session);localStorage.removeItem('vovinam_session_locked');$('session-lock-modal').classList.add('hidden');resetInactivityTimer();start();}catch(error){$('lock-screen-error').classList.remove('hidden');$('lock-screen-error').textContent=errorText(error);}}
async function changePassword(){try{const next=$('cp-new-password').value;if(next!==$('cp-confirm-password').value || next.length<8)throw new Error('Mật khẩu mới cần ít nhất 8 ký tự và xác nhận trùng nhau.');await authCall('signInWithPassword',{email:session.email,password:$('cp-current-password').value,returnSecureToken:true});const result=await authCall('update',{idToken:await token(),password:next,returnSecureToken:true});session=toSession(result,session.email);await idbSetItem(AUTH_KEY,session);closeChangePasswordModal();showToast('Đã đổi mật khẩu Firebase.','success');}catch(error){showToast(errorText(error),'error');}}
async function resetPassword(id){try{const target=accounts.find(a=>a.id===id);if(!isAdmin() || !target?.authEmail || target.authEmail.endsWith('.invalid'))throw new Error('Tài khoản này dùng tên đăng nhập nội bộ. Đặt lại mật khẩu trong Firebase Authentication → Users.');await authCall('sendOobCode',{requestType:'PASSWORD_RESET',email:target.authEmail});showToast('Firebase đã nhận yêu cầu gửi email đặt lại mật khẩu.','success');}catch(error){showToast(errorText(error),'error');}}
function captureAccount(id){
 const account=accounts.find(a=>a.id===id);accountEdit=account?.firebaseUid?clone(profiles.find(p=>p.uid===account.firebaseUid)):null;
 setTimeout(()=>{const source=$('acc-password');if(!source || $('central-account-hint'))return;const hint=document.createElement('p');hint.id='central-account-hint';hint.className='text-xs text-blue-700';hint.textContent='Tài khoản chưa liên kết Firebase: nhập mật khẩu khởi tạo ít nhất 8 ký tự rồi lưu. Tài khoản đã liên kết: để trống mật khẩu khi chỉnh quyền.';source.parentElement?.appendChild(hint);},0);
}
async function saveAccountForm(){
 try{
  if(!isAdmin() || !authenticated())throw new Error('Chỉ tài khoản toàn quyền được quản lý tài khoản trung tâm.');
  const id=$('acc-id').value,old=accounts.find(a=>a.id===id),username=sanitizeUsername($('acc-username').value),name=$('acc-name').value.trim(),password=$('acc-password').value;
  if(!name || !username)throw new Error('Cần họ tên và tên đăng nhập.');
  if(accounts.some(a=>a.id!==id && a.username===username))throw new Error('Tên đăng nhập đã tồn tại.');
  if(old?.firebaseUid && username!==old.username)throw new Error('Tên đăng nhập đã liên kết Firebase không thể đổi tại đây.');
  const grant=rbacReadAccountControls();if(!rbacValidateAccountGrant(id,grant.permissions,grant.assignedClassIds,grant.allClasses))return;
  let uid=old?.firebaseUid,profileEtag=null;
  if(uid){const response=await db('profiles/'+uid,{headers:{'X-Firebase-ETag':'true'}}),latest=await response.json();profileEtag=response.headers.get('ETag');if(!profileEtag || !accountEdit || !eq(latest,accountEdit))throw new Error('Quyền tài khoản đã thay đổi trên máy chủ. Đóng biểu mẫu, tải lại danh sách rồi sửa tiếp.');}
  let authEmail=old?.authEmail||username+'@accounts.clb-vovinam-antruong.invalid';
  if(!uid){if(password.length<8)throw new Error('Cần mật khẩu khởi tạo ít nhất 8 ký tự để tạo tài khoản Firebase.');const result=await authCall('signUp',{email:authEmail,password,returnSecureToken:true});uid=result.localId;}
  else if(password)throw new Error('Dùng chức năng đặt lại mật khẩu Firebase; không thay mật khẩu người khác trong biểu mẫu phân quyền.');
  const allClasses=uid===meta.adminUid || grant.allClasses;
  const value={id:id||'ACC-'+uid,uid,name,username,authEmail,roleTitle:$('acc-role-title').value.trim(),isSuperAdmin:uid===meta.adminUid,status:uid===meta.adminUid?'active':$('acc-status').value,allClasses,assignedClassIds:grant.assignedClassIds,assignedClassKeys:Object.fromEntries(grant.assignedClassIds.map(key=>[classKey(key),true])),assignedClasses:allClasses?'Tất cả các lớp':grant.assignedClassIds.map(id=>classes.find(c=>c.id===id)?.name).filter(Boolean).join(', '),permissions:uid===meta.adminUid?{...grant.permissions,full_access:true}:grant.permissions,avatar:sanitizeImageUrl(currentAccountModalAvatar||'')};
  if(profileEtag)await db('profiles/'+uid,{method:'PUT',headers:{'if-match':profileEtag},body:JSON.stringify(value)});else await write('profiles/'+uid,value);if(old && !old.firebaseUid)await write('legacyAccounts/'+await hash(old.id),null);
  closeAccountModal();await pull(false);showToast('Đã lưu tài khoản và quyền trên máy chủ. Các máy khác đăng nhập dùng ngay.','success');
 }catch(error){showToast(errorText(error),'error');}
}
async function setAccount(id,transform){try{
 if(!isAdmin())throw new Error('Cần quyền toàn hệ thống.');const target=accounts.find(a=>a.id===id);if(!target?.firebaseUid)throw new Error('Hãy tạo tài khoản Firebase bằng biểu mẫu Cập nhật trước.');
 const response=await db('profiles/'+target.firebaseUid,{headers:{'X-Firebase-ETag':'true'}}),value=await response.json(),etag=response.headers.get('ETag');
 if(!value || !etag)throw new Error('Không đọc được phiên bản quyền trên máy chủ.');
 const next=transform(clone(value));if(!next && value.uid===meta.adminUid)throw new Error('Không thể xóa quản trị viên gốc.');
 await db('profiles/'+target.firebaseUid,{method:'PUT',headers:{'if-match':etag},body:JSON.stringify(next)});await pull(false);
 }catch(error){showToast(errorText(error),'error');}}

async function saveAvatar(){try{const id=$('personal-avatar-acc-id').value||currentAccountId,target=accounts.find(a=>a.id===id);if(!target?.firebaseUid || target.id!==currentAccountId && !isAdmin())throw new Error('Không có quyền thay ảnh tài khoản này.');const avatar=sanitizeImageUrl(currentPersonalDraftAvatar||$('personal-avatar-url')?.value||'');await write('profiles/'+target.firebaseUid+'/avatar',avatar);closePersonalAvatarModal();await pull(false);}catch(error){showToast(errorText(error),'error');}}
async function prepare(){
 installSetupUI();
 let found;
 try{found=await read('meta',false);}catch(error){if(localStorage.getItem('vovinam_central_enabled')==='1' || (await idbGetItem(AUTH_KEY))?.uid){active=true;durableBase=null;durableRevision=0;wipeUI();showToast('Chưa kiểm tra được máy chủ đăng nhập trung tâm. Vui lòng thử lại khi có mạng.','error');}return;}
 if(!found?.enabled){if(localStorage.getItem('vovinam_central_enabled')==='1' || new URLSearchParams(location.search).get('entry')==='central-v2'){active=true;durableBase=null;durableRevision=0;wipeUI();showToast('Máy chủ đăng nhập trung tâm đang bảo trì. Vui lòng liên hệ quản trị viên.','error');}return;}
 let protectedCheck;try{protectedCheck=await request(config.databaseURL+'/'+PREFIX+'/data.json?shallow=true');}catch(error){active=true;durableBase=null;durableRevision=0;wipeUI();showToast('Chưa kiểm tra được Rules máy chủ. Thử tải lại trang khi có mạng.','error');return;}
 if(![401,403].includes(protectedCheck.status)){active=true;durableBase=null;durableRevision=0;wipeUI();showToast('Chưa xác nhận được Rules bảo vệ dữ liệu trung tâm. Liên hệ quản trị viên để kiểm tra trước khi đăng nhập.','error');return;}
 meta=found;verified=true;active=true;localStorage.setItem('vovinam_central_enabled','1');stopCloudRealtimeSync();durableBase=null;durableRevision=0;
 session=await idbGetItem(AUTH_KEY);
 if(session?.uid){try{const wasLocked=localStorage.getItem('vovinam_session_locked')==='1';await token();await enter();if(wasLocked)triggerInactivityLock();}catch(error){session=null;profile=null;durableBase=null;durableRevision=0;wipeUI();showToast(errorText(error),'error');}}
 else wipeUI();
 updateLoginUI();
}
function installSetupUI(){
 if($('central-setup-card'))return;const host=$('tab-settings');if(!host)return;
 const shared=document.createElement('div');shared.id='central-login-link-card';shared.className='bg-white p-5 rounded-2xl border border-blue-200 space-y-3';
 shared.innerHTML='<h2 class="font-bold text-slate-800">Link đăng nhập chung cho mọi thiết bị</h2><a id="central-login-link" class="block text-sm text-blue-700 break-all font-semibold"></a><p class="text-sm text-slate-600">Gửi link cùng tài khoản được cấp. Người dùng đăng nhập để nhận đúng lớp và quyền; không phải ghép máy.</p><button type="button" id="central-copy-login-link" class="px-4 py-2 rounded-xl bg-blue-700 text-white font-bold">Sao chép link đăng nhập</button>';
 host.prepend(shared);const link=$('central-login-link');link.href=new URL('dang-nhap.html',location.href).href;link.textContent=link.href;
 $('central-copy-login-link').onclick=async()=>{try{await navigator.clipboard.writeText(link.href);showToast('Đã sao chép link đăng nhập chung.','success');}catch{showToast('Nhấn giữ link đăng nhập để sao chép.','info');}};
 const card=document.createElement('div');card.id='central-setup-card';card.className='bg-white p-5 rounded-2xl border border-blue-200 space-y-3';
 card.innerHTML='<h2 class="font-bold text-slate-800">Chuyển sang đăng nhập tập trung</h2><p class="text-sm text-slate-600">Thực hiện một lần trên máy có dữ liệu đầy đủ. Sau khi chuyển, các máy dùng cùng link và tài khoản được cấp.</p><button type="button" id="central-setup-open" class="px-4 py-2 rounded-xl bg-blue-700 text-white font-bold">Thiết lập quản trị viên Firebase</button><div id="central-setup-form" class="hidden space-y-3"><label class="block text-sm">Email quản trị viên<input id="central-setup-email" type="email" autocomplete="username" class="block w-full border rounded-lg p-2"></label><label class="block text-sm">Mật khẩu Firebase<input id="central-setup-password" type="password" autocomplete="new-password" class="block w-full border rounded-lg p-2"></label><label class="flex gap-2 text-sm"><input id="central-setup-existing" type="checkbox">Email này đã có trong Firebase Authentication</label><button type="button" id="central-setup-auth" class="px-4 py-2 bg-blue-700 text-white rounded-lg">Đăng ký / xác nhận tài khoản Firebase</button><p id="central-setup-status" role="status" class="text-sm break-words"></p><div id="central-setup-next" class="hidden space-y-3"><button type="button" id="central-setup-rules" class="border rounded-lg p-2">Tải Rules dành cho quản trị viên này</button><p class="text-sm">Tải bản JSON đầy đủ trước. Trong Firebase Console → Realtime Database → Rules, dán toàn bộ nội dung tệp Rules rồi Publish. Quy tắc mới khóa truy cập công khai và cho tài khoản quản trị vừa xác nhận quyền chuyển dữ liệu.</p><button type="button" id="central-setup-backup" class="border rounded-lg p-2">Tải JSON dữ liệu máy này</button><p id="central-setup-counts" class="text-sm font-semibold"></p><label class="flex gap-2 text-sm"><input id="central-setup-confirm" type="checkbox">Tôi đã kiểm tra đây là dữ liệu đầy đủ cần dùng chung và đã tải bản JSON độc lập.</label><button type="button" id="central-setup-import" class="px-4 py-2 bg-emerald-700 text-white rounded-lg">Kiểm tra Rules và chuyển dữ liệu</button></div></div>';
 host.prepend(card);
 $('central-setup-open').onclick=()=>{if(!rbacGlobalAdmin() || !safetyAuthenticated())return rbacDeny();setupRunning=true;stopCloudRealtimeSync();if(autoCloudSyncTimer){clearTimeout(autoCloudSyncTimer);autoCloudSyncTimer=null;}document.getElementById('safety-sync-alert')?.classList.add('hidden');$('central-setup-form').classList.remove('hidden');};
 $('central-setup-auth').onclick=setupAuth;$('central-setup-rules').onclick=()=>{if(setupSession)downloadFile(root.vovinamCentralRules(setupSession.uid),'firebase-central-rules.json','application/json');};
 $('central-setup-backup').onclick=()=>downloadFile(JSON.stringify(buildFullDatabasePayload(),null,2),'Vovinam_TruocChuyenDangNhap_'+new Date().toISOString().slice(0,10)+'.json','application/json');
 $('central-setup-import').onclick=setupImport;
}
async function setupAuth(){
 try{if(active || !rbacGlobalAdmin() || !safetyAuthenticated())throw new Error('Cần đăng nhập quản trị viên trên bản dữ liệu hiện tại.');
  const email=$('central-setup-email').value.trim(),password=$('central-setup-password').value;if(password.length<8)throw new Error('Mật khẩu cần ít nhất 8 ký tự.');
  const result=await authCall($('central-setup-existing').checked?'signInWithPassword':'signUp',{email,password,returnSecureToken:true});setupSession=toSession(result,email);$('central-setup-password').value='';
  $('central-setup-status').textContent='Đã xác nhận Firebase UID: '+setupSession.uid;$('central-setup-next').classList.remove('hidden');
  $('central-setup-counts').textContent=`Dữ liệu máy này: ${students.length} võ sinh · ${classes.length} lớp · ${Object.keys(attendanceRecords).length} buổi điểm danh.`;
 }catch(error){$('central-setup-status').textContent=errorText(error);}
}
async function setupImport(){
 const status=$('central-setup-status');
 try{
  if(active || !setupSession || !rbacGlobalAdmin() || !safetyAuthenticated())throw new Error('Cần xác nhận tài khoản quản trị viên trước.');
  if(!$('central-setup-confirm').checked)throw new Error('Hãy kiểm tra dữ liệu và tải JSON trước khi chuyển.');
  const old=clone(buildFullDatabasePayload());safetyAssertCompleteMedia(old);safetyValidate(old,'replace');
  if(durableEnabled){await durableMutationQueue.catch(()=>{});await durableSerial;}
  // Anonymous access must already be denied. Never upload private data into public Rules.
  const anonymous=await request(config.databaseURL+'/'+PREFIX+'/data.json?shallow=true');if(anonymous.ok)throw new Error('Rules vẫn cho đọc công khai. Dán Rules đã tải và Publish trước khi tiếp tục.');
  if(![401,403].includes(anonymous.status))throw new Error('Chưa xác nhận được Rules bảo mật.');
  session=setupSession;
  const probe=await db('',{headers:{'X-Firebase-ETag':'true'}}),existing=await probe.json(),etag=probe.headers.get('ETag');
  if(existing || !etag)throw new Error('Đã có dữ liệu trung tâm hoặc thiếu phiên bản máy chủ. Không ghi đè.');
  status.textContent='Đang chuyển dữ liệu. Giữ trang mở cho đến khi hoàn tất…';
  const oldAdmin=getCurrentAccount(),owner={id:oldAdmin.id,uid:session.uid,authEmail:session.email,name:oldAdmin.name,username:oldAdmin.username,isSuperAdmin:true,status:'active',allClasses:true,assignedClassIds:[],assignedClassKeys:{},assignedClasses:'Tất cả các lớp',permissions:{...oldAdmin.permissions,full_access:true},roleTitle:oldAdmin.roleTitle||'Super Admin',avatar:oldAdmin.avatar||''};
  const nextDirectory=Object.fromEntries(old.classes.map(c=>[classKey(c.id),{id:c.id,name:c.name}]));nextDirectory.unassigned={id:'unassigned',name:'Chưa xác định lớp'};
  const priorDirectory=directory;directory=nextDirectory;const entries=await layout(old);directory=priorDirectory;
  const data={};for(const [route,entry] of Object.entries(entries)){if(route==='siteConfig')continue;const [,group,field,key]=route.split('/');data[group]??={};data[group][field]??={};data[group][field][key]=pack(entry.key,entry.value);}
  const pending={};for(const account of old.accounts.filter(a=>a.id!==owner.id)){const {passwordHash,password,...clean}=account;pending[await hash(clean.id)]=clean;}
  const initial={meta:{enabled:true,version:2,adminUid:session.uid,activatedAt:new Date().toISOString()},profiles:{[session.uid]:owner},classDirectory:nextDirectory,data,siteConfig:pack('siteConfig',old.siteConfig),legacyAccounts:pending};
  const body=JSON.stringify(initial);if(new Blob([body]).size>30*1024*1024)throw new Error('Dữ liệu quá lớn cho một lần chuyển. Cần chia đợt chuyển trước khi kích hoạt.');
  await db('',{method:'PUT',headers:{'if-match':etag},body});
  await idbSetItem(AUTH_KEY,session);status.textContent='Chuyển dữ liệu thành công. Đang mở lại trang với tài khoản trung tâm…';location.reload();
 }catch(error){status.textContent=errorText(error);session=null;profile=null;}
}
function openSetupIfRequested(){
 if(new URLSearchParams(location.search).get('setup')!=='central-v2' || active || !rbacGlobalAdmin() || !safetyAuthenticated())return;
 switchTab('settings');$('central-setup-open')?.click();
}
root.VovinamCentral={config,openSetupIfRequested,captureAccount,accountsSnapshot:()=>entriesPayload({}).accounts,get setupRunning(){return setupRunning;},get active(){return active;},get uid(){return session?.uid||'';},authenticated,prepare,login,logout,unlock,changePassword,resetPassword,saveAccountForm,setAccount,saveAvatar,schedule,push,pull,start,stop,cacheEntry,updateLoginUI,classKey,pack,unpack,layout,entriesPayload,mergeEntry};
})(window);
