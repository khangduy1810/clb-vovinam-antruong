import {collection,doc,serverTimestamp} from 'firebase/firestore';
// Read every affected record before any transaction writes.
export async function readCoachAssignment(tx:any,db:any,root:string,classId:string,coachId:string){
 if(!coachId||coachId.includes('/'))throw new Error('Chọn tài khoản HLV hợp lệ.');
 const ref=doc(db,root+'/records/account--'+coachId),snap=await tx.get(ref);
 if(!snap.exists())throw new Error('Tài khoản HLV không còn tồn tại.');
 const record=snap.data(),data=record.data,email=String(data.email||'').trim().toLowerCase();
 if(data.deleted||data.status!=='active')throw new Error('Chọn tài khoản HLV đang hoạt động.');
 if(data.isSuperAdmin)return {ref,record,data,changed:false};
 if(!email)throw new Error('Gắn email đăng nhập cho tài khoản HLV trước.');
 const memberRef=doc(db,root+'/members/'+email),memberSnap=await tx.get(memberRef);
 if(!memberSnap.exists()||memberSnap.data().id!==coachId||memberSnap.data().isSuperAdmin||memberSnap.data().status!=='active')throw new Error('Hồ sơ đăng nhập của HLV chưa khớp. Mở Tài khoản và lưu lại email, quyền trước.');
 const member=memberSnap.data(),classIds=[...new Set([...(data.classIds||[]),classId])],memberClasses=[...new Set([...(member.classIds||[]),classId])];
 return {ref,memberRef,record,data:{...data,classIds},member:{...member,classIds:memberClasses},changed:!(data.classIds||[]).includes(classId)||!(member.classIds||[]).includes(classId)};
}
export function writeCoachAssignment(tx:any,db:any,root:string,assignment:any,actor:{name:string;uid:string}){
 if(!assignment?.changed)return;
 const audit=doc(collection(db,root+'/audit')),record=assignment.record;
 tx.set(assignment.ref,{kind:'account',id:record.id,data:assignment.data,version:record.version+1,updatedAt:serverTimestamp(),auditId:audit.id});
 if(assignment.memberRef)tx.set(assignment.memberRef,assignment.member);
 tx.set(audit,{actor:actor.name,actorUid:actor.uid,action:'update',kind:'account',record_id:record.id,at:serverTimestamp()});
}
export function coachIds(data:any):string[]{return Array.isArray(data?.coachAccountIds)?data.coachAccountIds:data?.coachAccountId?[data.coachAccountId]:[]}
export function primaryCoach(data:any){const ids=coachIds(data);return data?.primaryCoachId||data?.coachAccountId||ids[0]||''}
export function coachTeamChanged(before:any,after:any){return JSON.stringify([...coachIds(before)].sort())!==JSON.stringify([...coachIds(after)].sort())||primaryCoach(before)!==primaryCoach(after)}
export async function readCoachTeam(tx:any,db:any,root:string,classId:string,before:any,after:any){
 const ids=coachIds(after),primary=primaryCoach(after);if(ids.some(id=>typeof id!=='string'||!id||id.includes('/'))||new Set(ids).size!==ids.length)throw new Error('Danh sách HLV không hợp lệ hoặc bị trùng.');
 if(ids.length&&!ids.includes(primary))throw new Error('Chọn đúng một HLV phụ trách chính.');
 const assignments:any[]=[],names:Record<string,string>={};
 for(const id of ids){const assignment=await readCoachAssignment(tx,db,root,classId,id);assignments.push(assignment);names[id]=assignment.data.name;}
 for(const id of coachIds(before).filter(id=>!ids.includes(id))){
  if(typeof id!=='string'||id.includes('/'))continue;
  const ref=doc(db,root+'/records/account--'+id),snap=await tx.get(ref);if(!snap.exists())continue;
  const record=snap.data(),data=record.data;if(data.isSuperAdmin)continue;
  const classIds=(data.classIds||[]).filter((c:string)=>c!==classId),email=String(data.email||'').trim().toLowerCase();let memberRef:any=null,member:any=null,memberChanged=false;
  if(email){const candidate=doc(db,root+'/members/'+email),m=await tx.get(candidate);if(m.exists()&&m.data().id===id&&!m.data().isSuperAdmin){memberRef=candidate;memberChanged=(m.data().classIds||[]).includes(classId);member={...m.data(),classIds:(m.data().classIds||[]).filter((c:string)=>c!==classId)}}}
  const changed=classIds.length!==(data.classIds||[]).length||memberChanged;
  assignments.push({ref,record,data:{...data,classIds},memberRef,member,changed});
 }
 return {assignments,fields:{coachAccountIds:ids,primaryCoachId:ids.length?primary:'',coachAccountId:ids.length?primary:'',coachNames:names,coach:ids.length?names[primary]:after.coach||''}};
}
