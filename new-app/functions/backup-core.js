import {historyCutoff} from './history-core.js';
import {deletedTime,TRASH_RETENTION_MS} from './trash-core.js';
export const BACKUP_RETENTION_MONTHS=3;
export function backupCutoff(now=new Date()){return historyCutoff(now)}
export function backupCutoffTime(now=new Date()){return Date.parse(backupCutoff(now)+'T00:00:00+07:00')}
export function validBackupSource(item){return ['snapshot','weekly'].includes(item?.sourceKind)&&typeof item.sourceId==='string'&&item.sourceId.length>0&&item.sourceId.length<250&&!item.sourceId.includes('/')}
export function oldBackup(item,now=new Date()){const at=deletedTime(item?.createdAt);return validBackupSource(item)&&Number.isFinite(at)&&at<backupCutoffTime(now)}
export function backupKey(item){if(!validBackupSource(item))throw new Error('invalid_backup_source');return item.sourceKind+'--'+item.sourceId}
export function expiredBackup(item,now=new Date()){const at=deletedTime(item?.deletedAt);return Number.isFinite(at)&&at+TRASH_RETENTION_MS<=now.getTime()}
export function isBackupTrash(record){return record?.kind==='backup'&&record.data?.deleted===true&&validBackupSource(record.data)&&typeof record.data.token==='string'}
export function backupTarget(record){return {kind:'backup',id:record.id,token:record.data.token}}
