/* Generates closed-by-default Rules. The project owner publishes these in Firebase Console. */
(function(root){
'use strict';
root.vovinamCentralRules=function(ownerUid){
 if(!/^[A-Za-z0-9_-]{1,128}$/.test(ownerUid))throw new Error('UID Firebase không hợp lệ.');
 const profile="root.child('central_v2/profiles').child(auth.uid)";
 const active=`auth != null && root.child('central_v2/meta/enabled').val() === true && ${profile}.child('status').val() === 'active'`;
 const admin=`auth != null && (auth.uid === '${ownerUid}' || (${active} && (${profile}.child('isSuperAdmin').val() === true || ${profile}.child('permissions/full_access').val() === true)))`;
 const scope=`${profile}.child('allClasses').val() === true || ${profile}.child('assignedClassKeys').child($class).val() === true`;
 const readPermissions={classes:null,students:null,attendanceRecords:'attendance_manage',tuitionRecords:'tuition_manage',gearOrders:'gear_manage',tournamentEntries:'tournaments_manage',pendingRequests:'approvals_manage',confirmedDuplicates:null};
 const writePermissions={classes:'classes_manage',students:'students_direct',attendanceRecords:'attendance_manage',tuitionRecords:'tuition_manage',gearOrders:'gear_manage',tournamentEntries:'tournaments_manage',pendingRequests:'students_request',confirmedDuplicates:'students_direct'};
 const fieldRules={};
 for(const field of Object.keys(readPermissions)){
  let readPerm=readPermissions[field]?` && ${profile}.child('permissions/${readPermissions[field]}').val() === true`:'';
  if(field==='pendingRequests')readPerm=` && (${profile}.child('permissions/approvals_manage').val() === true || ${profile}.child('permissions/students_request').val() === true)`;
  let writePerm=`${profile}.child('permissions/${writePermissions[field]}').val() === true`;
  if(field==='students')writePerm=`(${writePerm} || ${profile}.child('permissions/approvals_manage').val() === true)`;
  if(field==='pendingRequests')writePerm=`(${writePerm} || ${profile}.child('permissions/approvals_manage').val() === true)`;
  fieldRules[field]={'.read':`(${admin}) || (${active} && (${scope})${readPerm})`,'$record':{'.write':`(${admin}) || (${active} && (${scope}) && ${writePerm})`,'.validate':"newData.hasChildren(['key','chunks','revision']) && newData.child('key').isString() && newData.child('revision').isNumber() && newData.child('revision').val() > 0 && newData.child('chunks').hasChildren()"}};
 }
 fieldRules['$other']={'.validate':false};
 const rules={rules:{'.read':false,'.write':false,central_v2:{'.read':admin,'.write':`auth != null && auth.uid === '${ownerUid}'`,
  meta:{'.read':true,'.write':`auth != null && auth.uid === '${ownerUid}'`},
  profiles:{'.read':admin,'$uid':{'.read':`auth != null && (auth.uid === $uid || (${admin}))`,'.write':admin,'.validate':`newData.hasChildren(['id','uid','name','username','status','permissions']) && newData.child('uid').val() === $uid && !newData.child('passwordHash').exists() && !newData.child('password').exists() && (($uid === '${ownerUid}' && newData.child('isSuperAdmin').val() === true && newData.child('status').val() === 'active') || ($uid !== '${ownerUid}' && newData.child('isSuperAdmin').val() === false))`,avatar:{'.write':`(${admin}) || (${active} && auth.uid === $uid)`,'.validate':'newData.isString() && newData.val().length < 1500000'}}},
  classDirectory:{'.read':active,'.write':admin,'$class':{'.write':`(${active}) && (${scope}) && ${profile}.child('permissions/classes_manage').val() === true && data.exists()`,'.validate':"newData.hasChildren(['id','name']) && newData.child('id').isString() && newData.child('name').isString() && (!data.exists() || newData.child('id').val() === data.child('id').val())"}},
  data:{'.read':admin,'.write':admin,'$class':fieldRules},
  siteConfig:{'.read':active,'.write':admin},
  legacyAccounts:{'.read':admin,'.write':admin},
  revisions:{'.read':admin,'$class':{'.read':`(${admin}) || (${active} && (${scope}))`,'.write':`(${admin}) || (${active} && (${scope}))`,'.validate':'newData.isString()'}},
  '$other':{'.validate':false}
 }}};
 return JSON.stringify(rules,null,2);
};
})(typeof window==='undefined'?globalThis:window);
