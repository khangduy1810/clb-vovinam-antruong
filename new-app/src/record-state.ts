// A delayed save acknowledgement must not overwrite a newer realtime revision
// or move an edited row to the end of the list.
export function applyConfirmedRecord(records:any[],record:any){
 const index=records.findIndex(r=>r.kind===record.kind&&r.id===record.id);
 if(index<0)return [...records,record];
 if(records[index].version>=record.version)return records;
 return records.map((r,i)=>i===index?record:r);
}
