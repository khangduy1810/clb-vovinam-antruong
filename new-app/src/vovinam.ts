export const VOVINAM_BELTS=['Tự vệ nhập môn','Lam đai','Lam đai nhất cấp','Lam đai nhị cấp','Lam đai tam cấp','Chuẩn hoàng đai','Hoàng đai','Hoàng đai nhất cấp','Hoàng đai nhị cấp','Hoàng đai tam cấp','Chuẩn hồng đai','Hồng đai nhất cấp','Hồng đai nhị cấp','Hồng đai tam cấp','Hồng đai tứ cấp','Hồng đai ngũ cấp','Hồng đai lục cấp','Bạch đai'];
export const vvnCode=(n:number)=>'VVN.'+String(n).padStart(3,'0');
export const isVvnCode=(code:string)=>/^VVN\.(?:00[1-9]|0[1-9]\d|[1-9]\d{2,})$/.test(code);
// Keep existing canonical numbers and legacy numeric order; never sort the actual roster.
export function vvnPlan(records:any[],reserved:Map<string,string>){
 const rows=records.filter(r=>r.kind==='student');const used=new Map(reserved);const result:{record:any;code:string}[]=[];
 const ordered=[...rows].sort((a,b)=>{const num=(r:any)=>Number(String(r.data.id).match(/^VVN\.?0*(\d+)$/i)?.[1]||Number.MAX_SAFE_INTEGER);return num(a)-num(b)||String(a.id).localeCompare(String(b.id))});
 let next=1;
 for(const record of ordered){if(isVvnCode(record.data.id))continue;const legacy=Number(String(record.data.id).match(/^VVN\.?0*(\d+)$/i)?.[1]);let code=legacy>0?vvnCode(legacy):'';if(!code||used.has(code.toLowerCase())&&used.get(code.toLowerCase())!==record.id){while(used.has(vvnCode(next).toLowerCase()))next++;code=vvnCode(next++)}used.set(code.toLowerCase(),record.id);result.push({record,code});}
 return result;
}
