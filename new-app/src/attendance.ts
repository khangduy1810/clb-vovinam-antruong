import {isStudying} from './student-policy';
// Keep marks and makeup students; reconcile only an unfinished class roster.
export function reconcileAttendance(att:any,students:any[]){
 if(!att||att.status==='final')return att;
 const byId=new Map(students.map(s=>[s.id,s]));
 const rows=(att.rows||[]).filter((r:any)=>{const s=byId.get(r.studentUid);return s&&!s.data.deleted&&(isStudying(s)||r.status!=='unmarked'||String(r.note||'').trim()!=='')&&(r.makeup||s.data.classId===att.classId)});
 const ids=new Set(rows.map((r:any)=>r.studentUid));
 for(const s of students)if(isStudying(s)&&s.data.classId===att.classId&&!ids.has(s.id))rows.push({studentUid:s.id,status:'unmarked',note:'',makeup:false});
 return JSON.stringify(rows)===JSON.stringify(att.rows)?att:{...att,rows};
}
