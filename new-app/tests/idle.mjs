import assert from 'node:assert/strict';
import {createIdleSession,IDLE_TIMEOUT,idleKey} from '../src/idle-session.ts';
let time=1000;const saved=new Map();const make=()=>createIdleSession(k=>saved.get(k)??null,(k,v)=>saved.set(k,v),()=>time);
const tab=make();assert.equal(IDLE_TIMEOUT,600000);assert.equal(tab.status('A').locked,false);time+=IDLE_TIMEOUT-1;assert.equal(tab.status('A').locked,false);time+=1;assert.equal(tab.status('A').locked,true);assert.equal(tab.touch('A').locked,true);
tab.start('A');time+=300000;tab.touch('A');time+=300001;assert.equal(tab.status('A').locked,false);time+=300000;assert.equal(tab.status('A').locked,true);
tab.start('A');time+=600001;const reopened=make();assert.equal(reopened.status('A').locked,true);assert.equal(reopened.touch('A').locked,true);
assert.equal(reopened.status('B').locked,false);tab.start('A');assert.equal(reopened.status('A').locked,false);time+=600000;assert.equal(reopened.status('A').locked,true);assert.equal(tab.status('A').locked,true);
saved.set(idleKey('A'),'bad JSON');assert.equal(tab.status('A').locked,true);tab.start('A');time-=10;assert.equal(tab.status('A').locked,true);
console.log('PASS: exact 10-minute expiry; real activity extends timeout; wake/reopen and cross-tab expiry stay locked; input cannot unlock; accounts isolated; corrupt state/clock rollback fail closed');
