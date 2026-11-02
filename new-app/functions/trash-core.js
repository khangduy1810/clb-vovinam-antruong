export const TRASH_RETENTION_DAYS=15;
export const TRASH_RETENTION_MS=TRASH_RETENTION_DAYS*24*60*60*1000;
export const TRASH_KINDS=['student','class','attendance','tuition','account','gear','tournament','approval'];
export function deletedTime(value){try{const seconds=value?.seconds??value?._seconds,nanos=value?.nanoseconds??value?._nanoseconds??0;const date=typeof value?.toDate==='function'?value.toDate():typeof seconds==='number'&&Number.isFinite(seconds)&&Number.isInteger(nanos)&&nanos>=0&&nanos<1e9?new Date(seconds*1000+nanos/1e6):value;if(!(date instanceof Date)&&typeof date!=='string')return NaN;return new Date(date).getTime()}catch{return NaN}}
export function purgeable(record){return record?.data?.deleted===true&&!record.data.isSuperAdmin&&TRASH_KINDS.includes(record.kind)&&typeof record.id==='string'&&record.id.length>0&&Number.isInteger(record.version)&&record.version>0}
export function trashExpiry(record){const at=deletedTime(record?.data?.deletedAt);return Number.isFinite(at)?at+TRASH_RETENTION_MS:null}
export function expiredTrash(record,now=Date.now()){const expires=trashExpiry(record);return purgeable(record)&&expires!==null&&expires<=now}
export async function cleanExpiredTrash({now,listRecords,purgeOne}){
 const time=now.getTime(),records=await listRecords();let removed=0,skipped=0,expired=0;
 for(const record of records){if(!expiredTrash(record,time))continue;expired++;if(await purgeOne(record,time))removed++;else skipped++}
 return {retentionDays:TRASH_RETENTION_DAYS,cutoff:new Date(time-TRASH_RETENTION_MS).toISOString(),scanned:records.length,expired,removed,skipped};
}

export function trashTarget(record){const at=deletedTime(record?.data?.deletedAt);return {kind:record.kind,id:record.id,version:record.version,deletedAtMs:Number.isFinite(at)?at:null}}
export function sameTrashRevision(record,target){const current=trashTarget(record);return current.kind===target.kind&&current.id===target.id&&current.version===target.version&&current.deletedAtMs===target.deletedAtMs}
