export const SELF_DEFENSE_BELT='Tự vệ nhập môn';
export const VOVINAM_BELTS=[SELF_DEFENSE_BELT,'Lam đai','Lam đai nhất cấp','Lam đai nhị cấp','Lam đai tam cấp','Chuẩn hoàng đai','Hoàng đai','Hoàng đai nhất cấp','Hoàng đai nhị cấp','Hoàng đai tam cấp','Chuẩn hồng đai','Hồng đai nhất cấp','Hồng đai nhị cấp','Hồng đai tam cấp','Hồng đai tứ cấp','Hồng đai ngũ cấp','Hồng đai lục cấp','Bạch đai'];
export const vvnCode=(n:number)=>'VVN.'+String(n).padStart(4,'0');
export const isVvnCode=(code:string)=>/^VVN\.(?:000[1-9]|00[1-9]\d|0[1-9]\d{2}|[1-9]\d{3,})$/.test(code);
// Freeze the complete assignment without changing roster order or internal IDs.
export function vvnPlan(records:any[]){
 const rows=records.filter(r=>r.kind==='student');
 const ordered=[...rows].sort((a,b)=>{const num=(r:any)=>Number(String(r.data.id).match(/^VVN\.?0*(\d+)$/i)?.[1]||Number.MAX_SAFE_INTEGER);return num(a)-num(b)||String(a.id).localeCompare(String(b.id))});
 return ordered.map((record,i)=>({record,code:vvnCode(i+1)}));
}
