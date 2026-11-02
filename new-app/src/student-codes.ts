import {collection,doc,getDoc,getDocsFromServer,runTransaction,serverTimestamp,setDoc,writeBatch} from 'firebase/firestore';
export const codeKey=(code:string)=>'code-'+String(code).trim().toLowerCase();
export function codeReservations(records:any[]){const codes=new Map<string,string>();for(const r of records.filter(r=>r.kind==='student')){const code=String(r.data.id||'').trim();if(!code||code.length>80||code.includes('/'))throw new Error('Có mã võ sinh không hợp lệ. Cần sửa trước khi lập danh mục mã.');const key=codeKey(code);if(codes.has(key)&&codes.get(key)!==r.id)throw new Error('Mã võ sinh bị trùng: '+code+'. Không tự gộp hay đổi hồ sơ.');codes.set(key,r.id)}return codes;}
export async function ensureStudentCodes(db:any,root:string){
 const meta=doc(db,root+'/meta/studentCodes'),lock=doc(db,root+'/meta/maintenance');if((await getDoc(meta)).data()?.ready)return;
 await runTransaction(db,async tx=>{const [m,l]=await Promise.all([tx.get(meta),tx.get(lock)]);if(m.data()?.ready)return;if(l.exists()&&l.data().state!=='ready'&&l.data().state!=='indexing')throw new Error('Đang khôi phục dữ liệu. Hãy hoàn tất trước.');tx.set(lock,{state:'indexing',at:serverTimestamp()})});
 try{const records=(await getDocsFromServer(collection(db,root+'/records'))).docs.map(d=>d.data());const codes=codeReservations(records);for(const [key,id] of codes)await setDoc(doc(db,root+'/studentCodes/'+key),{studentUid:id});const b=writeBatch(db);b.set(meta,{ready:true,at:serverTimestamp()});b.set(lock,{state:'ready',at:serverTimestamp()});await b.commit();}
 catch(e){await setDoc(lock,{state:'ready',at:serverTimestamp()});throw e;}
}
