import test from 'node:test';import assert from 'node:assert/strict';import {getFirestore,Timestamp} from 'firebase-admin/firestore';
if(!process.env.FIRESTORE_EMULATOR_HOST)throw new Error('This test requires the Firestore emulator.');
process.env.GCLOUD_PROJECT='demo-antruong-v2';
const {cleanupClubTrash}=await import('./index.js'),db=getFirestore(),root='clubs/antruong-v2';
test('scheduled cleanup runs without a signed-in owner, skips live/protected records and pauses during recovery',async()=>{
 await db.recursiveDelete(db.doc(root));await db.doc(root+'/meta/import').set({status:'ready'});await db.doc(root+'/meta/maintenance').set({state:'ready'});const old=Timestamp.fromMillis(Date.now()-16*86400000),recent=Timestamp.fromMillis(Date.now()-86400000);
 const put=(id,deletedAt,extra={})=>db.doc(root+'/records/student--'+id).set({kind:'student',id,version:1,data:{id,name:id,deleted:true,deletedAt,...extra}});
 await put('OLD',old);await put('RECENT',recent);await put('ACTIVE',old,{deleted:false});await put('PROTECTED',old,{isSuperAdmin:true});await put('BADDATE','bad');await db.doc(root+'/studentCodes/code-old').set({studentUid:'OLD'});
 assert.equal(typeof cleanupClubTrash.run,'function');await cleanupClubTrash.run({});assert.equal((await db.doc(root+'/records/student--OLD').get()).exists,false);for(const id of ['RECENT','ACTIVE','PROTECTED','BADDATE'])assert.equal((await db.doc(root+'/records/student--'+id).get()).exists,true);assert.equal((await db.doc(root+'/studentCodes/code-old').get()).exists,true);assert.equal((await db.collection(root+'/audit').get()).size,1);assert.equal((await db.doc(root+'/meta/trashCleanup').get()).data().retentionDays,15);
 await put('WAIT',old);await db.doc(root+'/meta/maintenance').set({state:'restoring'});await cleanupClubTrash.run({});assert.equal((await db.doc(root+'/records/student--WAIT').get()).exists,true);assert.equal((await db.collection(root+'/audit').get()).size,1);
 await db.doc(root+'/meta/maintenance').set({state:'ready'});await db.doc(root+'/records/student--WAIT').update({'data.deleted':false,version:2});await cleanupClubTrash.run({});assert.equal((await db.doc(root+'/records/student--WAIT').get()).exists,true);assert.equal((await db.collection(root+'/audit').get()).size,1);
 await db.terminate();
});
