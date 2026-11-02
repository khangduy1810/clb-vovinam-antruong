import {FieldValue,Timestamp} from 'firebase-admin/firestore';
import {randomUUID} from 'node:crypto';
import {backupCutoff,backupCutoffTime,backupKey,oldBackup,expiredBackup,validBackupSource} from './backup-core.js';
import {deletedTime} from './trash-core.js';
const PREFIX='weekly/antruong-v2/';
const fileName=id=>/^\d{4}-\d{2}-\d{2}$/.test(id)?PREFIX+id+'.json.gz':null;
const ready=(maintenance,importState)=>(!maintenance.exists||maintenance.data().state==='ready')&&importState.exists&&importState.data().status==='ready';
function fileInfo(meta){return {createdAt:meta.metadata?.createdAt||meta.timeCreated,generation:String(meta.generation||''),sha256:meta.metadata?.sha256||'',bytes:Number(meta.size||0)}}
export async function listOldBackupSources(db,bucket,root,now){
 const result=[];let last=null;const base=db.collection(root+'/snapshots').where('at','<',Timestamp.fromMillis(backupCutoffTime(now))).orderBy('at');
 while(true){let q=base.limit(40);if(last)q=q.startAfter(last);const page=await q.get();for(const d of page.docs){const data=d.data();result.push({sourceKind:'snapshot',sourceId:d.id,createdAt:data.at,bytes:Buffer.byteLength(data.data||'')})}if(page.size<40)break;last=page.docs.at(-1)}
 let storageError=null;try{const [files]=await bucket.getFiles({prefix:PREFIX});for(const file of files){const match=/^weekly\/antruong-v2\/(\d{4}-\d{2}-\d{2})\.json\.gz$/.exec(file.name);if(!match)continue;const [meta]=await file.getMetadata();const info=fileInfo(meta);result.push({sourceKind:'weekly',sourceId:match[1],createdAt:info.createdAt,bytes:info.bytes,generation:info.generation,sha256:info.sha256})}}catch(e){storageError=String(e.code||'storage_unavailable')}
 return {items:result.filter(item=>oldBackup(item,now)),storageError};
}
export async function markBackupTrash(db,root,item,now,actor){
 if(!oldBackup(item,now))return false;const key=backupKey(item),ref=db.doc(root+'/backupTrash/'+key),source=db.doc(root+'/'+(item.sourceKind==='snapshot'?'snapshots':'weeklyBackups')+'/'+item.sourceId),audit=db.collection(root+'/audit').doc();
 return db.runTransaction(async tx=>{const maintenance=await tx.get(db.doc(root+'/meta/maintenance')),importState=await tx.get(db.doc(root+'/meta/import')),existing=await tx.get(ref),original=await tx.get(source);
  if(!ready(maintenance,importState)||existing.exists)return false;if(item.sourceKind==='snapshot'&&(!original.exists||deletedTime(original.data().at)!==deletedTime(item.createdAt)))return false;
  const at=deletedTime(item.createdAt);if(!Number.isFinite(at))return false;tx.set(ref,{...item,createdAt:new Date(at).toISOString(),token:randomUUID(),deletedAt:FieldValue.serverTimestamp(),deletedBy:actor.name});tx.set(audit,{actor:actor.name,actorUid:actor.uid,action:'archive',kind:'backup',record_id:key,at:FieldValue.serverTimestamp()});return true;
 });
}
export async function purgeBackupTrash(db,bucket,root,target,now,actor,expiredOnly=false){
 const ref=db.doc(root+'/backupTrash/'+target.id),initial=await ref.get();if(!initial.exists||initial.data().token!==target.token)return false;const item=initial.data();if(!validBackupSource(item)||backupKey(item)!==target.id||expiredOnly&&!expiredBackup(item,now))return false;
 if(item.sourceKind==='weekly'){
  const [maintenance,importState]=await Promise.all([db.doc(root+'/meta/maintenance').get(),db.doc(root+'/meta/import').get()]);if(!ready(maintenance,importState))return false;const name=fileName(item.sourceId);if(!name)return false;
  const file=bucket.file(name);try{const [meta]=await file.getMetadata(),info=fileInfo(meta);if(item.generation&&info.generation!==item.generation||!item.generation&&(deletedTime(info.createdAt)!==deletedTime(item.createdAt)||item.sha256&&item.sha256!==info.sha256))return false;await file.delete({ignoreNotFound:true,ifGenerationMatch:info.generation})}catch(e){if(Number(e.code)!==404){if(Number(e.code)===412)return false;throw e}}
 }
 return db.runTransaction(async tx=>{const maintenance=await tx.get(db.doc(root+'/meta/maintenance')),importState=await tx.get(db.doc(root+'/meta/import')),current=await tx.get(ref),sourceRef=db.doc(root+'/'+(item.sourceKind==='snapshot'?'snapshots':'weeklyBackups')+'/'+item.sourceId),source=await tx.get(sourceRef);
  if(!ready(maintenance,importState)||!current.exists||current.data().token!==target.token||expiredOnly&&!expiredBackup(current.data(),now))return false;
  if(source.exists){const data=source.data(),sourceAt=item.sourceKind==='snapshot'?data.at:data.createdAt;if(deletedTime(sourceAt)!==deletedTime(item.createdAt))return false;if(item.sourceKind==='weekly'&&data.generation&&item.generation&&data.generation!==item.generation)return false;tx.delete(sourceRef)}
  const audit=db.collection(root+'/audit').doc();tx.delete(ref);tx.set(audit,{actor:actor.name,actorUid:actor.uid,action:'purge',kind:'backup',record_id:target.id,at:FieldValue.serverTimestamp()});return true;
 });
}
export async function rotateBackups(db,bucket,root,now,actor={name:'Tự động dọn bản sao lưu',uid:'system:backup-retention'}){
 const sources=await listOldBackupSources(db,bucket,root,now);let archived=0,removed=0,skipped=0;
 for(const item of sources.items)if(await markBackupTrash(db,root,item,now,actor))archived++;
 const trash=await db.collection(root+'/backupTrash').get();for(const d of trash.docs){const item=d.data();if(!expiredBackup(item,now))continue;if(item.sourceKind==='weekly'&&sources.storageError){skipped++;continue}if(await purgeBackupTrash(db,bucket,root,{id:d.id,token:item.token},now,actor,true))removed++;else skipped++}
 const result={months:3,cutoff:backupCutoff(now),archived,removed,skipped,storageError:sources.storageError};await db.doc(root+'/meta/backupRetention').set({...result,lastRunAt:FieldValue.serverTimestamp()},{merge:true});return result;
}
