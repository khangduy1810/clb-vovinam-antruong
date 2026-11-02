const vietnameseNames=new Intl.Collator('vi',{sensitivity:'base',numeric:true});
const cleanName=(name:any)=>String(name||'').trim().replace(/\s+/g,' ');
export const givenName=(name:any)=>cleanName(name).split(' ').at(-1)||'';
export function compareStudents(a:any,b:any){
 return vietnameseNames.compare(givenName(a?.data?.name),givenName(b?.data?.name))||
  vietnameseNames.compare(cleanName(a?.data?.name),cleanName(b?.data?.name))||
  vietnameseNames.compare(String(a?.data?.id||''),String(b?.data?.id||''))||
  String(a?.id||'').localeCompare(String(b?.id||''));
}
export const sortStudents=(students:any[])=>[...students].sort(compareStudents);
export const isStudying=(student:any)=>!!student&&!student.data?.deleted&&student.data?.enrollmentStatus!=='withdrawn';
