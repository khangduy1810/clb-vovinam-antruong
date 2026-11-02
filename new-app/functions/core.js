import {gzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
export const ZONE='Asia/Ho_Chi_Minh';
export const PREFIX='weekly/antruong-v2/';
export function localDate(now){return new Intl.DateTimeFormat('en-CA',{timeZone:ZONE,year:'numeric',month:'2-digit',day:'2-digit'}).format(now)}
export function weekId(now){const day=new Date(localDate(now)+'T00:00:00Z');day.setUTCDate(day.getUTCDate()-day.getUTCDay());return day.toISOString().slice(0,10)}
export function archiveId(name){const m=/^weekly\/antruong-v2\/(\d{4}-\d{2}-\d{2})\.json\.gz$/.exec(name);return m?.[1]||null}
export function isOwnerProfile(profile){return profile?.status==='active'&&profile?.isSuperAdmin===true}
export async function performBackup({now,readArchive,loadSnapshot,writeArchive,saveManifest}){
 const id=weekId(now),object=PREFIX+id+'.json.gz';let archive=await readArchive(object);
 if(!archive){const snapshot=await loadSnapshot();const text=JSON.stringify({format:'antruong-v2',backupType:'weekly-server',exportedAt:now.toISOString(),weekId:id,...snapshot});if(Buffer.byteLength(text)>100*1024*1024)throw new Error('backup_exceeds_100mb');const bytes=gzipSync(text);const details={createdAt:now.toISOString(),recordCount:String(snapshot.records?.length||0),sha256:createHash('sha256').update(bytes).digest('hex')};archive=await writeArchive(object,bytes,details)}
 const manifest={id,object,createdAt:archive.createdAt,bytes:archive.bytes,recordCount:Number(archive.recordCount||0),sha256:archive.sha256};await saveManifest(manifest);return manifest;
}
