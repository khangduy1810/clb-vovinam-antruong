export function convertBackup(x:any){
 if(x.format==='antruong-v2'&&Array.isArray(x.records))return {rows:x.records.map((r:any)=>({kind:r.kind,id:r.id,data:clean(r.data)})),warnings:[],counts:{students:x.records.filter((r:any)=>r.kind==='student').length,classes:x.records.filter((r:any)=>r.kind==='class').length,accounts:x.records.filter((r:any)=>r.kind==='account').length}};
 if(!Array.isArray(x.students)||!Array.isArray(x.classes)||!Array.isArray(x.accounts))throw new Error('Không phải bản sao lưu đầy đủ của CLB.');
 const rows:any[]=[],warnings:any[]=[];const classes=new Map(x.classes.map((c:any)=>[c.name,String(c.id)]));
 x.classes.forEach((c:any)=>rows.push({kind:'class',id:String(c.id),data:clean(c)}));
 const students=x.students.map((s:any,i:number)=>({...clean(s),uid:'student-'+String(i+1).padStart(4,'0'),classId:classes.get(s.className)||''}));
 students.forEach((s:any)=>{if(!s.classId)throw new Error('Có võ sinh chưa xác định được lớp.');rows.push({kind:'student',id:s.uid,data:s})});
 x.accounts.forEach((original:any)=>{const a=clean(original),allClasses=!!a.isSuperAdmin||a.assignedClasses==='Tất cả các lớp',classIds=allClasses?[]:[classes.get(a.assignedClasses)].filter(Boolean);if(!allClasses&&!classIds.length)warnings.push({type:'class-scope',accountId:a.id,message:'Lớp được gán trong bản cũ không tồn tại. Cần chọn lại lớp.'});rows.push({kind:'account',id:a.id,data:{...a,email:'',allClasses,classIds}})});
 Object.entries(x.attendanceRecords||{}).forEach(([key,raw]:any)=>{const date=key.slice(0,10),classId=classes.get(key.slice(11))||'';const converted=raw.map((r:any)=>{const matches=students.filter((s:any)=>s.classId===classId&&(String(s.id)===String(r.studentId)||s.name===r.studentId));if(matches.length!==1)throw new Error('Không liên kết chắc chắn một dòng điểm danh; chưa nhập dữ liệu.');return {...r,studentUid:matches[0].uid,makeup:false}});rows.push({kind:'attendance',id:date+'_'+classId,data:{date,classId,rows:converted,status:'final'}})});
 Object.entries(x.tuitionRecords||{}).forEach(([month,raw]:any)=>Object.entries(raw).forEach(([sid,t]:any)=>{const s=students.filter((s:any)=>String(s.id)===String(sid));if(s.length!==1)throw new Error('Không liên kết chắc chắn dòng học phí.');rows.push({kind:'tuition',id:month+'_'+s[0].uid,data:{...t,month,studentUid:s[0].uid,classId:s[0].classId}})}));
 for(const [key,kind] of [['gearOrders','gear'],['tournamentEntries','tournament'],['pendingRequests','approval']]) (x[key]||[]).forEach((r:any,i:number)=>rows.push({kind,id:String(r.id||kind+'-'+i),data:clean(r)}));
 rows.push({kind:'config',id:'club',data:clean(x.siteConfig||{})});
 return {rows,warnings,counts:{students:students.length,classes:x.classes.length,accounts:x.accounts.length}};
}
function clean(a:any){const {password,passwordHash,secret,databaseSecret,...rest}=a;return rest}
