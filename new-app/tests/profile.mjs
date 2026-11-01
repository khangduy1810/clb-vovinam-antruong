import assert from 'node:assert/strict';
import {normalizeActor,requireAuditName} from '../src/profile.ts';
const user={email:'Owner@Example.test',uid:'owner-uid'};
for(const bad of [undefined,null,'',5,{},[]]){
 const profile={id:'ACC-ADMIN',isSuperAdmin:true,status:'active',...(bad===undefined?{}:{name:bad})};
 const actor=normalizeActor(profile,user);
 assert.equal(actor.name,'owner@example.test');assert.equal(actor.auditName,null);
 assert.throws(()=>requireAuditName(actor),/thiếu tên/);
 assert.equal(actor.isSuperAdmin,true);
}
const good=normalizeActor({name:'Duy Khang',isSuperAdmin:true},user);
assert.equal(requireAuditName(good),'Duy Khang');
assert.equal(JSON.stringify({actor:requireAuditName(good)}),'{"actor":"Duy Khang"}');
const staff=normalizeActor({name:'HLV',isSuperAdmin:false,allClasses:false,classIds:['C1'],permissions:{}},user);
assert.deepEqual(staff.classIds,['C1']);assert.equal(staff.isSuperAdmin,false);
console.log('PASS: missing/invalid names display a safe identity and block writes before undefined audit values; valid canonical names preserve existing Rules and permissions');
