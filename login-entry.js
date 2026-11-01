(function(root){
'use strict';
const config=root.VOVINAM_FIREBASE_CONFIG,AUTH_KEY='vovinam_central_auth_v1';
let ready=false,checking=false,submitting=false;
const $=id=>document.getElementById(id);
function status(text,state='pending'){$('signin-status').textContent=text;$('signin-status').dataset.state=state;}
function buttons(){$('signin-submit').disabled=!ready||checking||submitting;$('signin-retry').disabled=checking||submitting;$('signin-submit').textContent=submitting?'Đang đăng nhập…':'Đăng nhập';}
const normalizeEmail=value=>{const text=String(value||'').trim().replace(/^@+/,'').toLowerCase();if(text.includes('@'))return text;const name=text.replace(/\s+/g,'_').replace(/[^a-z0-9._-]/g,'');if(!name)throw new Error('Vui lòng nhập tài khoản hoặc email được cấp.');return name+'@accounts.clb-vovinam-antruong.invalid';};
async function request(url,options={}){const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),15000);try{return await fetch(url,{...options,signal:controller.signal,cache:'no-store'});}finally{clearTimeout(timer);}}
async function readJson(response){try{return await response.json();}catch{throw new Error('Máy chủ trả về dữ liệu không hợp lệ. Hãy thử lại sau.');}}
function friendly(error){
 const code=String(error.message||'').split(' : ')[0];
 if(error.name==='AbortError')return 'Máy chủ chưa phản hồi sau 15 giây. Bấm Kiểm tra kết nối lại để thử lại.';
 if(error instanceof TypeError)return 'Không nhận được phản hồi mạng. Kiểm tra Internet rồi thử lại.';
 return ({INVALID_LOGIN_CREDENTIALS:'Tài khoản hoặc mật khẩu không đúng. Dùng tài khoản trung tâm do quản trị viên cấp.',EMAIL_NOT_FOUND:'Tài khoản hoặc mật khẩu không đúng. Dùng tài khoản trung tâm do quản trị viên cấp.',INVALID_PASSWORD:'Tài khoản hoặc mật khẩu không đúng. Dùng tài khoản trung tâm do quản trị viên cấp.',INVALID_EMAIL:'Tài khoản hoặc email không hợp lệ.',USER_DISABLED:'Tài khoản Firebase đã bị vô hiệu hóa. Liên hệ quản trị viên.',TOO_MANY_ATTEMPTS_TRY_LATER:'Có quá nhiều lần thử đăng nhập. Vui lòng thử lại sau.',OPERATION_NOT_ALLOWED:'Chưa bật Email/Password trong Firebase Authentication. Quản trị viên cần hoàn tất thiết lập.'})[code]||error.message||'Chưa thể đăng nhập. Vui lòng thử lại.';
}
async function check(){
 if(checking)return false;checking=true;ready=false;buttons();status('Đang kiểm tra máy chủ đăng nhập…');
 try{
  if(!config?.apiKey||!config.databaseURL)throw new Error('Chưa tải được cấu hình đăng nhập. Hãy tải lại trang.');
  const response=await request(config.databaseURL+'/central_v2/meta.json');
  if([401,403].includes(response.status))throw new Error('Quản trị viên chưa Publish đúng Rules cho đăng nhập trung tâm. Mở phần Dành cho quản trị viên để hoàn tất thiết lập.');
  if(!response.ok)throw new Error('Máy chủ trả HTTP '+response.status+'. Hãy thử kiểm tra kết nối lại.');
  const meta=await readJson(response);
  if(!meta?.enabled){status('Hệ thống đăng nhập trung tâm chưa được kích hoạt hoặc đang bảo trì. Quản trị viên cần hoàn tất chuyển dữ liệu trên máy chính.','pending');return false;}
  if(meta.version!==2)throw new Error('Phiên bản máy chủ chưa phù hợp với trang này. Liên hệ quản trị viên.');
  const protectedResponse=await request(config.databaseURL+'/central_v2/data.json?shallow=true');
  if(![401,403].includes(protectedResponse.status))throw new Error(protectedResponse.ok?'Dữ liệu trung tâm chưa được bảo vệ bằng Rules. Quản trị viên cần hoàn tất thiết lập trước khi đăng nhập.':'Chưa xác nhận được quyền bảo vệ dữ liệu. Thử kiểm tra kết nối lại.');
  ready=true;status('Máy chủ sẵn sàng. Nhập tài khoản được quản trị viên cấp.','ready');return true;
 }catch(error){status(friendly(error),'error');return false;}
 finally{checking=false;buttons();}
}
async function persistSession(value){
 if(!root.indexedDB)throw new Error('Trình duyệt chưa cho phép lưu phiên đăng nhập. Hãy dùng trình duyệt thông thường có hỗ trợ IndexedDB.');
 const database=await new Promise((resolve,reject)=>{
  const open=root.indexedDB.open('VovinamHighCapacityDB',2);
  open.onupgradeneeded=()=>{const db=open.result;if(!db.objectStoreNames.contains('kv_store'))db.createObjectStore('kv_store',{keyPath:'key'});if(!db.objectStoreNames.contains('media_vault'))db.createObjectStore('media_vault',{keyPath:'mediaKey'});};
  open.onsuccess=()=>resolve(open.result);open.onerror=()=>reject(new Error('Không mở được bộ nhớ phiên đăng nhập.'));open.onblocked=()=>reject(new Error('Bộ nhớ đang bị một tab cũ giữ. Đóng tab cũ rồi thử lại.'));
 });
 try{await new Promise((resolve,reject)=>{const tx=database.transaction(['kv_store'],'readwrite');tx.objectStore('kv_store').put({key:AUTH_KEY,value,updatedAt:Date.now()});tx.oncomplete=resolve;tx.onerror=()=>reject(new Error('Chưa lưu được phiên đăng nhập trên trình duyệt.'));tx.onabort=tx.onerror;});}finally{database.close();}
}
async function submit(event){
 event.preventDefault();if(submitting||checking)return;
 const email=(()=>{try{return normalizeEmail($('signin-user').value);}catch(error){status(friendly(error),'error');return null;}})();
 const password=$('signin-password').value;if(!email)return;if(!password){status('Vui lòng nhập mật khẩu.','error');return;}
 submitting=true;buttons();
 try{
  // Recheck activation and Rules immediately before accepting any credentials.
  if(!await check())return;
  status('Đang xác thực tài khoản và quyền truy cập…');
  const response=await request('https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key='+encodeURIComponent(config.apiKey),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,password,returnSecureToken:true})});
  const result=await readJson(response);if(!response.ok)throw new Error(result.error?.message||'Firebase Authentication chưa xác nhận đăng nhập.');
  if(!result.localId||!result.idToken||!result.refreshToken)throw new Error('Phản hồi đăng nhập thiếu thông tin phiên.');
  const profileResponse=await request(config.databaseURL+'/central_v2/profiles/'+encodeURIComponent(result.localId)+'.json?auth='+encodeURIComponent(result.idToken));
  if([401,403].includes(profileResponse.status))throw new Error('Tài khoản chưa có quyền đọc hồ sơ trên hệ thống trung tâm. Quản trị viên cần kiểm tra Rules và quyền tài khoản.');
  if(!profileResponse.ok)throw new Error('Chưa tải được quyền tài khoản: HTTP '+profileResponse.status);
  const profile=await readJson(profileResponse);
  if(!profile || profile.uid!==result.localId || !profile.id)throw new Error('Tài khoản đã xác thực nhưng chưa được cấp hồ sơ quyền cho CLB. Quản trị viên cần liên kết tài khoản trong Tài khoản / Phân quyền.');
  if(typeof profile.id!=='string' || typeof profile.name!=='string' || !profile.permissions || typeof profile.permissions!=='object' || Array.isArray(profile.permissions))throw new Error('Hồ sơ quyền của tài khoản chưa hợp lệ. Quản trị viên cần cập nhật lại hồ sơ.');
  if(profile.status!=='active')throw new Error('Tài khoản đã bị khóa hoặc tạm dừng. Liên hệ quản trị viên.');
  const session={uid:result.localId,email:result.email||email,idToken:result.idToken,refreshToken:result.refreshToken,expiresAt:Date.now()+Number(result.expiresIn||3600)*1000};
  await persistSession(session);
  try{localStorage.setItem('vovinam_central_enabled','1');localStorage.removeItem('vovinam_session_locked');}catch{}
  $('signin-password').value='';status('Đăng nhập thành công. Đang mở dữ liệu theo quyền tài khoản…','ready');
  location.replace('index.html?entry=central-v2');
 }catch(error){status(friendly(error),'error');}
 finally{submitting=false;buttons();}
}
$('signin-form').addEventListener('submit',submit);$('signin-retry').addEventListener('click',check);
$('signin-show-password').addEventListener('click',()=>{const field=$('signin-password'),show=field.type==='password';field.type=show?'text':'password';$('signin-show-password').textContent=show?'Ẩn':'Hiện';$('signin-show-password').setAttribute('aria-pressed',String(show));$('signin-show-password').setAttribute('aria-label',show?'Ẩn mật khẩu':'Hiện mật khẩu');});
root.VovinamLoginEntry={check,submit,normalizeEmail,persistSession,get ready(){return ready;}};check();
})(window);
