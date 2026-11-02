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
 tx.set(assignment.memberRef,assignment.member);
 tx.set(audit,{actor:actor.name,actorUid:actor.uid,action:'update',kind:'account',record_id:record.id,at:serverTimestamp()});
}
