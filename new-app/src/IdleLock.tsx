import {useEffect,useState,type ReactNode} from 'react';
import {signOut} from 'firebase/auth';
import {LockKeyhole} from 'lucide-react';
import {auth} from './firebase';
import {idleSession,idleKey,startIdleSession} from './idle-session';
import {unlockOwnSession} from './personal-service';
export default function IdleLock({uid,children}:{uid:string;children:ReactNode}){
 const [locked,setLocked]=useState(()=>idleSession.status(uid).locked),[password,setPassword]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 useEffect(()=>{
  const check=()=>{const next=idleSession.status(uid).locked;setLocked(next);return next};
  const activity=(e:Event)=>{if(check()){if((e.target as Element)?.closest?.('[data-idle-lock]'))return;e.preventDefault();e.stopImmediatePropagation();return;}if(e.isTrusted)idleSession.touch(uid);};
  const storage=(e:StorageEvent)=>{if(e.key===idleKey(uid)||e.key===null)check()};
  const events=['pointerdown','keydown','wheel','touchstart','scroll','input'];
  events.forEach(n=>window.addEventListener(n,activity,{capture:true,passive:false}));
  window.addEventListener('focus',check,true);document.addEventListener('visibilitychange',check,true);window.addEventListener('storage',storage);
  const timer=setInterval(check,1000);
  return()=>{clearInterval(timer);events.forEach(n=>window.removeEventListener(n,activity,true));window.removeEventListener('focus',check,true);document.removeEventListener('visibilitychange',check,true);window.removeEventListener('storage',storage)};
 },[uid]);
 async function unlock(e:any){e.preventDefault();setError('');setBusy(true);try{await unlockOwnSession(auth,uid,password);setPassword('');startIdleSession(uid);setLocked(false)}catch(e:any){const messages:Record<string,string>={'auth/invalid-credential':'Mật khẩu chưa đúng.','auth/wrong-password':'Mật khẩu chưa đúng.','auth/too-many-requests':'Thử quá nhiều lần. Vui lòng chờ rồi thử lại.','auth/network-request-failed':'Không có kết nối. Cần kết nối mạng để mở khóa.','auth/user-disabled':'Tài khoản đã bị khóa.'};setError(messages[e.code]||e.message||'Chưa mở khóa được. Vui lòng thử lại.')}finally{setBusy(false)}}
 if(!locked)return <>{children}</>;
 return <div className="idle-lock-page" data-idle-lock><form className="login-form idle-lock-card" onSubmit={unlock}><div className="brand-seal"><LockKeyhole size={30}/></div><span className="eyebrow">BẢO VỆ TÀI KHOẢN</span><h2>Phiên làm việc đã khóa</h2><p>Trang tự khóa sau 10 phút không thao tác. Nhập mật khẩu để tiếp tục.</p><p className="personal-email">{auth.currentUser?.email}</p><label className="field"><span>Mật khẩu tài khoản</span><input autoFocus type="password" autoComplete="current-password" required value={password} onChange={e=>setPassword(e.target.value)} disabled={busy}/></label>{error&&<div className="alert error" role="alert">{error}</div>}<button className="primary" disabled={busy}>{busy?'Đang xác thực…':'Mở khóa'}</button><button className="secondary" type="button" disabled={busy} onClick={()=>signOut(auth)}>Đăng xuất / Đổi tài khoản</button><p className="personal-hint">Bản điểm danh đang sửa được giữ trên máy này. Bấm Lưu tạm sau khi mở khóa để tiếp tục trên máy khác.</p></form></div>
}
