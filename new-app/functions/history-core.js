export const HISTORY_MONTHS=3;
export const HISTORY_KINDS=['attendance','tuition'];
const calendar=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Ho_Chi_Minh',year:'numeric',month:'2-digit',calendar:'gregory',numberingSystem:'latn'});
export function historyCutoff(now=new Date()){
 const parts=calendar.formatToParts(now);const year=Number(parts.find(p=>p.type==='year').value),month=Number(parts.find(p=>p.type==='month').value);
 return new Date(Date.UTC(year,month-HISTORY_MONTHS,1)).toISOString().slice(0,10);
}
export function historyDate(record){
 const data=record?.data||{};
 if(record?.kind==='tuition'&&/^\d{4}-(0[1-9]|1[0-2])$/.test(data.month||''))return data.month+'-01';
 if(record?.kind==='attendance'&&/^\d{4}-(0[1-9]|1[0-2])-\d{2}$/.test(data.date||'')){const date=new Date(data.date+'T00:00:00Z');if(Number.isFinite(date.getTime())&&date.toISOString().slice(0,10)===data.date)return data.date;}
 return null;
}
export function oldHistory(record,now=new Date()){
 const date=historyDate(record);return !!date&&date<historyCutoff(now)&&record.data.deleted!==true&&!record.data.isSuperAdmin&&typeof record.id==='string'&&Number.isInteger(record.version)&&record.version>0;
}
export async function archiveOldHistory({now,listRecords,archiveOne}){const records=await listRecords();let archived=0,skipped=0;for(const record of records){if(!oldHistory(record,now))continue;if(await archiveOne(record,now))archived++;else skipped++}return {months:HISTORY_MONTHS,cutoff:historyCutoff(now),archived,skipped}}
