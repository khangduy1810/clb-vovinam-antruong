import {build} from 'esbuild';
import {resolve} from 'node:path';
const setup=String.raw`
import {readFileSync} from 'node:fs';import {initializeTestEnvironment} from '@firebase/rules-unit-testing';
let rules=readFileSync('firestore.rules','utf8');
if(process.env.LEGACY_STUDENT_RULES==='1'){
 const begin=rules.indexOf('  match /clubs/antruong-v2/studentCodes/{code} {'),end=rules.indexOf('  match /clubs/antruong-v2/recovery/{id}',begin);rules=rules.slice(0,begin)+rules.slice(end);
 rules=rules.replace(/function reserved\(r\) \{[^\n]+/, 'function reserved(r) { return true; }');
 rules=rules.replace('match /clubs/antruong-v2/meta/{id} { allow read: if owner()', "match /clubs/antruong-v2/meta/{id} { allow read: if (owner() && id != 'studentBeltsSelfDefense20261102')");
 rules=rules.replace('allow write: if owner(); }', "allow write: if owner() && id != 'studentBeltsSelfDefense20261102'; }");
}
export const test=await initializeTestEnvironment({projectId:'demo-antruong-v2',firestore:{host:'127.0.0.1',port:8088,rules}});
export const db=test.authenticatedContext('owner',{email:'owner@example.test',email_verified:true}).firestore();
export const auth={currentUser:{uid:'owner',email:'owner@example.test',emailVerified:true}},clubId='antruong-v2';
`;
const source=`
import assert from 'node:assert/strict';import {doc,setDoc,getDocs,collection,deleteDoc} from 'firebase/firestore';
import {test,db} from 'test:firebase';import {standardizeStudentCodes,resetCurrentStudentBelts,updateStudentRecords} from './src/gateway';
const root='clubs/antruong-v2';
try{
await test.clearFirestore();await test.withSecurityRulesDisabled(async ctx=>{const db=ctx.firestore();await setDoc(doc(db,root+'/members/owner@example.test'),{id:'OWNER',email:'owner@example.test',name:'Owner',status:'active',isSuperAdmin:true,allClasses:true,classIds:[],permissions:{}});await setDoc(doc(db,root+'/meta/import'),{status:'ready'});await setDoc(doc(db,root+'/meta/maintenance'),(process.env.LEGACY_STUDENT_RULES==='1'?{state:'renumbering',operation:'student-renumber-v4',runId:'previous-interrupted-run'}:{state:'ready'}));await setDoc(doc(db,root+'/records/config--club'),{kind:'config',id:'club',version:1,data:{title:'Test club'},updatedAt:new Date()});for(let n=1;n<=156;n++)await setDoc(doc(db,root+'/records/student--S'+n),{kind:'student',id:'S'+n,version:1,data:{id:'VVN'+String(n).padStart(3,'0'),name:'Student '+n,classId:'C1',belt:n%2?'Lam đai':'Nhập Môn'},updatedAt:new Date(),imported:true});});
let codes=0,belts=0;
if(process.env.LEGACY_STUDENT_RULES==='1'){const result=await updateStudentRecords();assert.equal(result.errors.length,1,JSON.stringify(result));assert.ok(result.errors[0].startsWith('Mã võ sinh:'));belts=result.belts;assert.equal(belts,156);console.log('PASS: legacy Rules deny registry and new meta access; belt correction still completes independently.');}
else{codes=await standardizeStudentCodes();console.log('Renumbered',codes);await test.withSecurityRulesDisabled(async ctx=>deleteDoc(doc(ctx.firestore(),root+'/studentCodes/code-vvn.0001')));belts=await resetCurrentStudentBelts();console.log('PASS: missing code reservation repaired atomically with belt correction.');}
console.log('Corrected belts',belts);
const students=(await getDocs(collection(db,root+'/records'))).docs.map(d=>d.data()).filter(r=>r.kind==='student');assert.equal(students.length,156);assert.ok(students.every(r=>r.data.belt==='Tự vệ nhập môn'));assert.equal(new Set(students.map(r=>r.data.id)).size,156);console.log('PASS: Firestore Rules accept 156-student belt correction with unique student codes retained.');
}finally{await test.cleanup()}
`;
await build({stdin:{contents:source,resolveDir:process.cwd(),sourcefile:'student-maintenance-rules.ts'},bundle:true,format:'esm',platform:'node',packages:'external',outfile:'tests/.student-maintenance-rules-built.mjs',plugins:[{name:'real-firestore-rules',setup(b){b.onResolve({filter:/^(test:firebase|\.\/firebase)$/},()=>({path:'firebase',namespace:'rules-test'}));b.onLoad({filter:/.*/,namespace:'rules-test'},()=>({contents:setup,loader:'js',resolveDir:process.cwd()}));}}]});
await import(resolve('tests/.student-maintenance-rules-built.mjs'));
