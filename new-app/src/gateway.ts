import {collection,doc,getDoc,getDocsFromServer,query,where,orderBy,limit,onSnapshot,runTransaction,writeBatch,serverTimestamp,deleteDoc,addDoc} from 'firebase/firestore';
import {auth,db,clubId} from './firebase';
import {convertBackup} from './convert';
const path='clubs/'+clubId;
const recordRef=(kind:string,id:string)=>doc(db,path+'/records/'+kind+'--'+id);
const profileRef=(email:string)=>doc(db,path+'/members/'+email.trim().toLowerCase());
const stamp=(t:any)=>t?.toDate?t.toDate().toISOString():typeof t==='string'?t:new Date().toISOString();
const row=(d:any)=>({...d.data(),updatedAt:stamp(d.data().updatedAt)});
export const can=(a:any,p:string)=>a.isSuperAdmin||a.permissions?.[p]===true;
export async function getActor():Promise<any>{const u=auth.currentUser;if(!u?.email)throw new Error('Vui lòng đăng nhập.');const s=await getDoc(profileRef(u.email));if(!s.exists()||s.data().status!=='active')throw new Error('Tài khoản chưa được cấp quyền hoặc đã bị khóa. Nhờ chủ CLB gắn đúng email đăng nhập.');return {...s.data(),email:u.email.toLowerCase(),identityId:u.uid}}
function queries(a:any){
 const all=a.isSuperAdmin||a.allClasses,scopes=all?null:(a.classIds||[]),qs:any[]=[];
 const scoped=(kind:string,field='data.classId')=>{if(all)qs.push(query(collection(db,path+'/records'),where('kind','==',kind)));else for(let i=0;i<scopes.length;i+=30)qs.push(query(collection(db,path+'/records'),where('kind','==',kind),where(field,'in',scopes.slice(i,i+30))))};
 scoped('class','id');qs.push(query(collection(db,path+'/records'),where('kind','==','config')));
 if(a.isSuperAdmin)qs.push(query(collection(db,path+'/records'),where('kind','==','account')));else qs.push(query(collection(db,path+'/records'),where('kind','==','account'),where('id','==',a.id)));
 if(['students_direct','attendance_manage','tuition_manage','reports_export','gear_manage','tournaments_manage','approvals_manage'].some(p=>can(a,p)))scoped('student');
 if(can(a,'attendance_manage')||can(a,'reports_export'))scoped('attendance');
 for(const [kind,p] of [['tuition','tuition_manage'],['gear','gear_manage'],['tournament','tournaments_manage'],['approval','approvals_manage']])if(can(a,p))scoped(kind);
 return qs;
}
let cached:any=null,revision=0;
async function assemble(a:any,docs:any[]){let audit:any[]=[],backups:any[]=[],migration:any=null;if(a.isSuperAdmin){const [logs,copies,meta]=await Promise.all([getDocsFromServer(query(collection(db,path+'/audit'),orderBy('at','desc'),limit(30))),getDocsFromServer(query(collection(db,path+'/snapshots'),orderBy('at','desc'),limit(30))),getDoc(doc(db,path+'/meta/import'))]);audit=logs.docs.map(d=>({...d.data(),id:d.id,at:stamp(d.data().at)}));backups=copies.docs.map(d=>({id:d.id,at:stamp(d.data().at),bytes:d.data().data?.length||0}));migration=meta.exists()?meta.data():null}cached={actor:a,records:docs,revision:++revision,serverAt:new Date().toISOString(),audit,backups,migration};return cached}
export async function readState(){const a=await getActor();const snapshots=await Promise.all(queries(a).map(q=>getDocsFromServer(q)));return assemble(a,snapshots.flatMap(s=>s.docs.map(row)))}
export function watchState(onState:(s:any)=>void,onError:(e:any)=>void){let unsubscribers:(()=>void)[]=[],cancelled=false,generation=0;const u=auth.currentUser;if(!u?.email)return ()=>{};
 const stopMember=onSnapshot(profileRef(u.email),async member=>{const generationId=++generation;unsubscribers.forEach(f=>f());unsubscribers=[];if(!member.exists()||member.data().status!=='active'){onError(new Error('Tài khoản chưa được cấp quyền hoặc đã bị khóa.'));return}const a={...member.data(),email:u.email!.toLowerCase(),identityId:u.uid};const qs=queries(a);const chunks=new Map<number,any[]>();let running=false,again=false;
 const emit=async()=>{if(running){again=true;return}running=true;try{do{again=false;if(cancelled||generationId!==generation)return;const state=await assemble(a,Array.from(chunks.values()).flat());if(!cancelled&&generationId===generation)onState(state)}while(again)}catch(e){onError(e)}finally{running=false}};
 unsubscribers=qs.map((q,i)=>onSnapshot(q,{includeMetadataChanges:true},(snap:any)=>{if(snap.metadata.fromCache)return;chunks.set(i,snap.docs.map(row));if(chunks.size===qs.length)emit()},onError));
 },onError);return ()=>{cancelled=true;stopMember();unsubscribers.forEach(f=>f())};}
function validate(kind:string,id:string,data:any,state:any){
 if(kind==='student'&&(!data.name?.trim()||!data.id?.trim()||!data.classId))throw new Error('Cần nhập họ tên, mã võ sinh và lớp.');
 if(kind==='student'&&state?.records.some((r:any)=>r.kind==='student'&&r.id!==id&&!r.data.deleted&&r.data.id===data.id))throw new Error('Mã võ sinh đã được sử dụng.');
 if(kind==='attendance'){if(!data.rows?.length)throw new Error('Buổi tập chưa có võ sinh.');if(data.status==='final'&&data.rows.some((r:any)=>r.status==='unmarked'))throw new Error('Cần điểm danh đầy đủ trước khi chốt.');const ids=new Set(data.rows.map((r:any)=>r.studentUid));if(ids.size!==data.rows.length)throw new Error('Danh sách có dòng trùng.');for(const r of data.rows)if(!state?.records.some((s:any)=>s.kind==='student'&&s.id===r.studentUid))throw new Error('Có võ sinh ngoài phạm vi lớp được cấp.');if(data.status==='final'&&state?.records.some((r:any)=>r.kind==='student'&&!r.data.deleted&&r.data.classId===data.classId&&!ids.has(r.id)))throw new Error('Danh sách lớp đã thay đổi. Tải lại trước khi chốt.');}
 if(kind==='account'&&data.isSuperAdmin)throw new Error('Hồ sơ chủ CLB được bảo vệ.');
}
export async function mutate(input:any){
 const a=await getActor(),{kind,id,version}=input;let data={...input.data};delete data.password;delete data.passwordHash;delete data.secret;delete data.databaseSecret;
 validate(kind,id,data,cached);if(a.isSuperAdmin)await snapshotDaily();
 if(kind==='account'){data.email=String(data.email||'').trim().toLowerCase();if(data.email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email))throw new Error('Email chưa đúng định dạng.');if(data.email===a.email)throw new Error('Email chủ CLB đã được sử dụng.');}
 const auditRef=doc(collection(db,path+'/audit'));const ref=recordRef(kind,id);
 const result=await runTransaction(db,async tx=>{const current=await tx.get(ref);const existing=current.exists()?current.data():null;if((existing?.version||0)!==version)throw new Error('Bản ghi vừa được máy khác thay đổi. Tải phiên bản mới rồi sửa lại.');
  let oldMember:any=null,newMember:any=null;const oldEmail=existing?.data?.email||'';
  if(kind==='account'&&data.email){newMember=await tx.get(profileRef(data.email));if(newMember.exists()&&newMember.data().id!==id)throw new Error('Email đã gắn với hồ sơ khác.');}
  if(kind==='account'&&oldEmail&&oldEmail!==data.email){oldMember=await tx.get(profileRef(oldEmail));if(oldMember.exists()&&oldMember.data().isSuperAdmin)throw new Error('Tài khoản chủ CLB được bảo vệ.');}
  const next={kind,id,data,version:version+1,updatedAt:serverTimestamp(),auditId:auditRef.id};tx.set(ref,next);tx.set(auditRef,{actor:a.name,actorUid:a.identityId,action:existing?'update':'create',kind,record_id:id,at:serverTimestamp()});
  if(kind==='account'){if(oldMember?.exists())tx.delete(profileRef(oldEmail));if(data.email)tx.set(profileRef(data.email),{id,name:data.name,email:data.email,status:data.status,isSuperAdmin:false,allClasses:!!data.allClasses,classIds:data.classIds||[],permissions:data.permissions||{},roleTitle:data.roleTitle||'Thành viên'});}
  return {...next,updatedAt:new Date().toISOString()};
 });return {ok:true,record:result};
}
async function allRecords(){const s=await getDocsFromServer(collection(db,path+'/records'));return s.docs.map(row)}
export async function snapshotDaily(force=false){const a=await getActor();if(!a.isSuperAdmin)throw new Error('Chỉ chủ CLB được sao lưu toàn bộ.');const id=force?new Date().toISOString():new Date().toISOString().slice(0,10);const ref=doc(db,path+'/snapshots/'+id);if((await getDoc(ref)).exists())return id;const data=JSON.stringify({format:'antruong-v2',exportedAt:new Date().toISOString(),records:await allRecords()});if(data.length>850000)throw new Error('Bản sao lớn. Hãy tải JSON thay vì lưu bản sao trực tuyến.');await runTransaction(db,async tx=>{if(!(await tx.get(ref)).exists())tx.set(ref,{at:serverTimestamp(),data})});const copies=await getDocsFromServer(query(collection(db,path+'/snapshots'),orderBy('at','desc')));await Promise.all(copies.docs.slice(30).map(d=>deleteDoc(d.ref)));return id}
export async function downloadBackup(id?:string){const a=await getActor();if(!a.isSuperAdmin)throw new Error('Bạn không có quyền sao lưu.');let text;if(id){const s=await getDoc(doc(db,path+'/snapshots/'+id));if(!s.exists())throw new Error('Không tìm thấy bản sao.');text=s.data().data}else{text=JSON.stringify({format:'antruong-v2',exportedAt:new Date().toISOString(),records:await allRecords()},null,2)}const url=URL.createObjectURL(new Blob([text],{type:'application/json'}));const link=document.createElement('a');link.href=url;link.download='AnTruong_Backup_'+new Date().toISOString().slice(0,10)+'.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),10000)}
export async function importBackup(file:File){
 const a=await getActor();if(!a.isSuperAdmin)throw new Error('Chỉ chủ CLB được nhập dữ liệu.');if(file.size>5000000)throw new Error('File vượt quá 5 MB.');const text=await file.text();const normalized=convertBackup(JSON.parse(text));const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text)))).map(x=>x.toString(16).padStart(2,'0')).join('');const marker=doc(db,path+'/meta/import');
 const existing=await getDoc(marker);if(!existing.exists()&&(await getDocsFromServer(query(collection(db,path+'/records'),limit(1)))).size)throw new Error('Vùng dữ liệu đã có hồ sơ. Không nhập đè.');
 await runTransaction(db,async tx=>{const mark=await tx.get(marker);if(mark.exists()&&(mark.data().status!=='in_progress'||mark.data().hash!==hash))throw new Error('Đã nhập trước đó hoặc đang nhập file khác. Hãy chọn đúng file để tiếp tục.');if(!mark.exists())tx.set(marker,{status:'in_progress',hash,source:file.name,counts:normalized.counts,warnings:normalized.warnings,at:serverTimestamp()})});
 // Small transactions stay below Rules expression limits. A hash locks resumable imports;
 // staff access stays blocked until the final ready marker commits.
 for(let i=0;i<normalized.rows.length;i+=4){const chunk=normalized.rows.slice(i,i+4);await runTransaction(db,async tx=>{const current=await Promise.all(chunk.map(r=>tx.get(recordRef(r.kind,r.id))));chunk.forEach((r,n)=>{if(!current[n].exists())tx.set(recordRef(r.kind,r.id),{...r,version:1,updatedAt:serverTimestamp(),imported:true})})})}
 const done=writeBatch(db);done.set(marker,{status:'ready',hash,source:file.name,counts:normalized.counts,warnings:normalized.warnings,at:serverTimestamp()});const event=doc(collection(db,path+'/audit'));done.set(event,{actor:a.name,actorUid:a.identityId,action:'import',kind:'backup',record_id:'initial',at:serverTimestamp()});await done.commit();return normalized.counts;
}
