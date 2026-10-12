import test from 'node:test';import assert from 'node:assert/strict';
import {recoverSubmittedApplications,validateApplicationRecovery} from '../lib/application-recovery.js';
import setup from '../api/setup.js';
const entry=(id)=>({id,company:id,title:'Developer',location:'Berlin',link:'https://example.org/jobs/'+id,status:'Applied',applicationDate:'2026-10-08'});
const recovery={version:1,id:'submitted-october',entries:['Bloom','individee','Delivery'].map(entry)};
test('authenticated recovery adds all missing submissions, is repeatable and preserves existing recruitment stages',()=>{
 const originals=Array.from({length:17},(_,i)=>({...entry('existing-'+i),notes:'Keep '+i}));
 const next=recoverSubmittedApplications(originals,recovery);assert.equal(next.entries.length,20);assert.deepEqual(next.entries.slice(3),originals);assert.deepEqual(recoverSubmittedApplications(next.entries,recovery).entries,next.entries);
 for(const status of ['Rejected','Interview','Offer','Archived']){const current={...entry('Bloom'),id:'local-bloom',status,notes:'Keep status and notes'};const out=recoverSubmittedApplications([current],recovery);assert.deepEqual(out.entries.find(e=>e.id==='local-bloom'),current);}
});
test('the complete recovery is validated before use',()=>{
 for(const change of [p=>{p.entries[2].status='Rejected'},p=>{p.entries[2].link='javascript:bad'},p=>{p.id='../../bad'},p=>{p.entries=[]}]){const p=structuredClone(recovery);change(p);assert.throws(()=>validateApplicationRecovery(p));}
});
test('server recovery remains private and is returned only to the authorised owner',()=>{
 const previous=Object.fromEntries(['JOB_NOTEBOOK_ACCESS_TOKEN','JOB_NOTEBOOK_APPLICATION_RECOVERY','JOB_NOTEBOOK_PROFILE_CORRECTIONS'].map(k=>[k,process.env[k]]));
 try{
  process.env.JOB_NOTEBOOK_ACCESS_TOKEN='x'.repeat(43);process.env.JOB_NOTEBOOK_APPLICATION_RECOVERY=JSON.stringify(recovery);delete process.env.JOB_NOTEBOOK_PROFILE_CORRECTIONS;
  const call=token=>{const res={setHeader(){},status(n){this.code=n;return this;},json(d){this.data=d;}};setup({method:'POST',headers:{authorization:'Bearer '+token},body:{action:'profile-corrections'}},res);return res;};
  const denied=call('wrong');assert.equal(denied.code,401);assert.equal(denied.data.applicationRecovery,undefined);
  const result=call('x'.repeat(43));assert.equal(result.code,200);assert.equal(result.data.applicationRecovery.entries.length,3);assert(!JSON.stringify(result.data).includes('x'.repeat(43)));
 }finally{for(const [k,v] of Object.entries(previous))v===undefined?delete process.env[k]:process.env[k]=v;}
});
