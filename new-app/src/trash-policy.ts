import {trashTarget as makeTarget} from '../functions/trash-core.js';
export {TRASH_RETENTION_DAYS,TRASH_RETENTION_MS,TRASH_KINDS,deletedTime,purgeable,trashExpiry,expiredTrash,sameTrashRevision} from '../functions/trash-core.js';
export type TrashTarget={kind:string;id:string;version:number;deletedAtMs:number|null};
export function trashTarget(record:any):TrashTarget{return makeTarget(record) as TrashTarget}
