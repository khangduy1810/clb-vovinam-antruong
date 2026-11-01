// Run in Google Cloud Shell as the Firebase project's owner. Never asks for a password.
import {execFileSync} from 'node:child_process';
const project='clb-vovinam-antruong';const email=String(process.argv[2]||'').trim().toLowerCase();
if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){console.error('Cách dùng: node scripts/bootstrap-owner.mjs EMAIL_CHU_CLB');process.exit(1)}
const token=execFileSync('gcloud',['auth','print-access-token'],{encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();
async function call(url,method='GET',body){const r=await fetch(url,{method,headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});const data=await r.json();if(!r.ok)throw new Error(data.error?.message||'Google API chưa chấp nhận yêu cầu.');return data}
try{
 const users=await call('https://identitytoolkit.googleapis.com/v1/projects/'+project+'/accounts:lookup','POST',{email:[email]});if(!users.users?.some(u=>u.email?.toLowerCase()===email&&!u.disabled))throw new Error('Tạo tài khoản email này trong Firebase Authentication trước.');
 const fields={id:{stringValue:'ACC-ADMIN'},name:{stringValue:'Chủ CLB'},email:{stringValue:email},status:{stringValue:'active'},isSuperAdmin:{booleanValue:true},allClasses:{booleanValue:true},classIds:{arrayValue:{values:[]}},permissions:{mapValue:{fields:{}}},roleTitle:{stringValue:'Chủ CLB'}};
 // exists=false prevents accidentally replacing an existing membership document.
 await call('https://firestore.googleapis.com/v1/projects/'+project+'/databases/(default)/documents/clubs/antruong-v2/members/'+encodeURIComponent(email)+'?currentDocument.exists=false','PATCH',{fields});
 console.log('Đã tạo quyền chủ CLB. Mở link v2 và đăng nhập bằng email đã tạo.');
}catch(e){console.error(e.message);process.exitCode=1}
