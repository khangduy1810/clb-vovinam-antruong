import {cpSync,mkdirSync,readdirSync,rmSync,existsSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const target=resolve(root,'../v2');
if(!existsSync(resolve(root,'dist/index.html')))throw new Error('Chạy npm run build trước.');
mkdirSync(target,{recursive:true});
// Generated v2 assets only; never touches the old root index or its files.
if(existsSync(resolve(target,'assets')))rmSync(resolve(target,'assets'),{recursive:true});
cpSync(resolve(root,'dist'),target,{recursive:true});
console.log('Đã cập nhật bản chạy v2. Commit new-app/ và v2/ cùng nhau.');
