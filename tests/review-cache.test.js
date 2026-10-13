import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createReviewCache,reviewHash} from '../server/review-cache.js';
import {createFitReviewHandler} from '../api/fit-review.js';
const input={job:{title:'Analyst',location:'Germany',remote:false,description:'Requirements: SQL reporting and gathering business requirements.'},profile:{evidence:'SQL reporting.',languages:'English C1',workRights:'Germany route.',salaryTarget:'',motivation:'',workStyle:'',startDate:'',relocation:''}};
test('private review cache merges simultaneous writes and isolates changed CV profiles',async()=>{
 const blobs=new Map();let version=0;
 const cache=createReviewCache({enabled:()=>true,secret:()=> 'cache-test-secret',now:()=>Date.parse('2026-10-13'),read:async key=>{const v=blobs.get(key);return v?{stream:new Blob([v.body]).stream(),blob:{etag:v.etag}}:null;},write:async(key,body,options)=>{await Promise.resolve();const old=blobs.get(key);if(old&&options.ifMatch!==old.etag)throw Object.assign(Error('Conflict'),{name:options.ifMatch?'BlobPreconditionFailedError':'BlobAlreadyExistsError'});blobs.set(key,{body,etag:String(++version)});}});
 const other={...input,job:{...input.job,title:'Consultant'}};
 await Promise.all([cache.save(input,{version:7,skills:8},{id:'a'}),cache.save(other,{version:7,skills:7},{id:'b'})]);
 assert.equal((await cache.list(input.profile)).length,2);assert.equal((await cache.find(input)).skills,8);
 assert.equal(await cache.find({...input,profile:{...input.profile,evidence:'Different CV'}}),null);
 assert.notEqual(reviewHash(input),reviewHash({...input,job:{...input.job,description:input.job.description+' Extra requirement.'}}));
});
test('concurrent requests for the same CV and advert share one paid comparison',async()=>{
 const previous=process.env.JOB_NOTEBOOK_ACCESS_TOKEN;process.env.JOB_NOTEBOOK_ACCESS_TOKEN='s'.repeat(43);
 let calls=0,release;const gate=new Promise(r=>release=r),cache={find:async()=>null,save:async()=>{}};
 const handler=createFitReviewHandler(async()=>{calls++;await gate;return {version:7,skills:8};},Date.now,cache);
 const response=()=>({setHeader(){},status(code){this.code=code;return this;},json(data){this.data=data;}});
 const a=response(),b=response(),request={method:'POST',headers:{authorization:'Bearer '+'s'.repeat(43)},body:input};
 try{const first=handler(request,a),second=handler(request,b);await new Promise(r=>setImmediate(r));assert.equal(calls,1);release();await Promise.all([first,second]);assert.equal(a.code,200);assert.equal(b.code,200);assert(b.data.cached);}finally{if(previous===undefined)delete process.env.JOB_NOTEBOOK_ACCESS_TOKEN;else process.env.JOB_NOTEBOOK_ACCESS_TOKEN=previous;}
});
