export const IDLE_TIMEOUT=10*60*1000;
export const idleKey=(uid:string)=>'antruong-v2:idle:'+uid;
type State={lastActivity:number;locked:boolean};
export function createIdleSession(read:(key:string)=>string|null,write:(key:string,value:string)=>void,now:()=>number=Date.now){
 const store=(uid:string,s:State)=>{write(idleKey(uid),JSON.stringify(s));return s};
 function status(uid:string):State{
  const raw=read(idleKey(uid)),time=now();if(raw===null)return store(uid,{lastActivity:time,locked:false});
  try{const s=JSON.parse(raw);if(typeof s.locked!=='boolean'||!Number.isFinite(s.lastActivity)||s.lastActivity>time||s.lastActivity<0)throw new Error('invalid');if(!s.locked&&time-s.lastActivity>=IDLE_TIMEOUT)return store(uid,{...s,locked:true});return s}catch{return store(uid,{lastActivity:time,locked:true})}
 }
 return {status,start:(uid:string)=>store(uid,{lastActivity:now(),locked:false}),touch:(uid:string)=>{const s=status(uid);return s.locked?s:store(uid,{lastActivity:now(),locked:false})}};
}
const fallback=new Map<string,string>();
function read(key:string){try{const value=localStorage.getItem(key);if(value!==null)return value}catch{}try{const value=sessionStorage.getItem(key);if(value!==null)return value}catch{}return fallback.get(key)||null;}
function write(key:string,value:string){fallback.set(key,value);try{localStorage.setItem(key,value)}catch{}try{sessionStorage.setItem(key,value)}catch{}}
export const idleSession=createIdleSession(read,write);
export const startIdleSession=(uid:string)=>idleSession.start(uid);
