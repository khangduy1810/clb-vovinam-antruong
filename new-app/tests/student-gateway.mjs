// Exercise the real gateway with a deterministic in-memory Firestore adapter.
// This checks allocation/recovery behavior; deployed Rules have separate tests.
import {build} from 'esbuild';
import {resolve} from 'node:path';
const database=`
export const root='clubs/antruong-v2',store=new Map();let serial=0,queue=Promise.resolve();export let transactions=0;
export const auth={currentUser:{uid:'staff',email:'staff@example.test',emailVerified:true}},db={},clubId='antruong-v2';
export const collection=(_db,path)=>({path});
export const doc=(base,path)=>({path:path||base.path+'/generated-'+(++serial),id:(path||'generated-'+serial).split('/').at(-1)});
export const serverTimestamp=()=>new Date().toISOString();
const snapshot=ref=>({ref,id:ref.path.split('/').at(-1),exists:()=>store.has(ref.path),data:()=>structuredClone(store.get(ref.path))});
export const getDoc=async ref=>snapshot(ref),getDocFromServer=getDoc;
export const where=(field,op,value)=>({field,op,value}),orderBy=()=>null,limit=()=>null;
export const query=(ref,...filters)=>({...ref,filters:filters.filter(Boolean)});
export const getDocsFromServer=async ref=>({docs:[...store.keys()].filter(k=>k.startsWith(ref.path+'/')&&!k.slice(ref.path.length+1).includes('/')).map(k=>snapshot({path:k})).filter(s=>(ref.filters||[]).every(f=>{const v=f.field.split('.').reduce((x,k)=>x?.[k],s.data());return f.op==='in'?f.value.includes(v):v===f.value}))});
export const setDoc=async(ref,data)=>{store.set(ref.path,structuredClone(data))};
export const deleteDoc=async ref=>{store.delete(ref.path)};
export const addDoc=async(ref,data)=>{const r=doc(ref);await setDoc(r,data);return r};
export const onSnapshot=()=>()=>{};
export async function runTransaction(_db,fn){const previous=queue;let release;queue=new Promise(r=>release=r);await previous;transactions++;const writes=[];let writing=false;const tx={get:async ref=>{if(writing)throw Error('Read after write');return snapshot(ref)},set:(ref,data)=>{writing=true;writes.push(()=>store.set(ref.path,structuredClone(data)))},delete:ref=>{writing=true;writes.push(()=>store.delete(ref.path))},update:(ref,data)=>{writing=true;writes.push(()=>store.set(ref.path,{...store.get(ref.path),...data}))}};try{const result=await fn(tx);writes.forEach(f=>f());return result}finally{release()}}
export function writeBatch(){const tasks=[];return {set:(r,d)=>tasks.push(()=>setDoc(r,d)),delete:r=>tasks.push(()=>deleteDoc(r)),commit:async()=>{for(const t of tasks)await t()}}}
`;
const test=`
import assert from 'node:assert/strict';
import {mutate,readState} from './src/gateway';
import {ensureStudentCodes} from './src/student-codes';
import {restoreApp} from './src/recovery';
import {store,root,transactions} from 'test:database';
const seed=(path,data)=>store.set(root+'/'+path,structuredClone(data));
const student=(id,code,extra={})=>({kind:'student',id,version:1,data:{id:code,name:'Cùng tên An',classId:'C1',...extra}});
seed('members/staff@example.test',{id:'STAFF',email:'staff@example.test',name:'HLV',status:'active',isSuperAdmin:false,allClasses:true,classIds:[],permissions:{students_direct:true}});
seed('meta/studentCodes',{ready:true});seed('meta/maintenance',{state:'ready'});seed('meta/import',{status:'ready'});
seed('records/class--C1',{kind:'class',id:'C1',version:1,data:{name:'C1'}});
seed('records/student--A',student('A','VVN.0001'));seed('studentCodes/code-vvn.0001',{studentUid:'A'});
seed('studentCodes/code-vvn.0002',{studentUid:'purged'});
seed('records/student--B',student('B','VVN.0003',{enrollmentStatus:'withdrawn'}));seed('studentCodes/code-vvn.0003',{studentUid:'B'});
await readState();const before=transactions;
const add=id=>mutate({kind:'student',id,version:0,data:{name:'Cùng tên An',id:'manually-entered',classId:'C1'}});
const results=await Promise.all([add('C'),add('D')]);
assert.deepEqual(results.map(r=>r.record.data.id).sort(),['VVN.0004','VVN.0005']);assert.ok(transactions-before>=3,'One competing writer must retry');
assert.equal(store.get(root+'/studentCodes/code-vvn.0002').studentUid,'purged');assert.equal(store.get(root+'/studentCodes/code-vvn.0003').studentUid,'B');
const highest=results.find(r=>r.record.data.id==='VVN.0005').record;store.delete(root+'/records/student--'+highest.id);await readState();
const next=await add('E');assert.equal(next.record.data.id,'VVN.0006');
const owner=store.get(root+'/members/staff@example.test');owner.isSuperAdmin=true;seed('members/staff@example.test',owner);seed('meta/studentCodes',{ready:false});
await ensureStudentCodes({},root);assert.equal(store.get(root+'/studentCodes/code-vvn.0002').studentUid,'purged');assert.ok(store.has(root+'/studentCodes/code-vvn.0005'));
await restoreApp({hash:'test-restore',name:'test.json',plan:{rows:[{kind:'class',id:'C1',data:{name:'C1'}},student('A','VVN.0001')],members:null,profiles:null}},()=>{});
for(let i=1;i<=6;i++)assert.ok(store.has(root+'/studentCodes/code-vvn.'+String(i).padStart(4,'0')),'Recovery must retain retired code '+i);
await readState();const afterRestore=await add('F');assert.equal(afterRestore.record.data.id,'VVN.0007');
console.log('PASS: real gateway concurrent adds/retry, deleted and withdrawn code reservations, indexing/recovery never free used IDs, next code after restore.');
`;
await build({stdin:{contents:test,resolveDir:process.cwd(),sourcefile:'student-gateway-test.ts'},bundle:true,format:'esm',platform:'node',outfile:'tests/.student-gateway-built.mjs',plugins:[{name:'memory-firestore',setup(b){b.onResolve({filter:/^(test:database|firebase\/firestore)$/},()=>({path:'database',namespace:'test'}));b.onResolve({filter:/^\.\/firebase$/},()=>({path:'database',namespace:'test'}));b.onLoad({filter:/.*/,namespace:'test'},()=>({contents:database,loader:'js'}))}}]});
await import(resolve('tests/.student-gateway-built.mjs'));
