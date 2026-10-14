import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createReviewCache,reviewHash} from '../server/review-cache.js';
import {createFitReviewHandler} from '../api/fit-review.js';
const input={job:{title:'Analyst',location:'Germany',remote:false,description:'Requirements: SQL reporting and gathering business requirements.'},profile:{evidence:'SQL reporting.',languages:'English C1',workRights:'Germany route.',salaryTarget:'',motivation:'',workStyle:'',startDate:'',relocation:''}};
const memoryCache=()=>{
 const blobs=new Map(),now=()=>Date.parse('2026-10-14');
 const cache=createReviewCache({enabled:()=>true,secret:()=> 'cache-test-secret',now,
  read:async key=>{const v=blobs.get(key);return v?{stream:new Blob([v]).stream()}:null;},
  write:async(key,body)=>{await Promise.resolve();blobs.set(key,body);},
  enumerate:async({prefix})=>({blobs:[...blobs.keys()].filter(k=>k.startsWith(prefix)).map(pathname=>({pathname,uploadedAt:new Date(now())})),hasMore:false})});
 return {cache,blobs,now};
};
test('private review cache keeps 72 simultaneous completions and isolates changed CV profiles',async()=>{
 const {cache,blobs,now}=memoryCache();
 const inputs=Array.from({length:72},(_,i)=>({...input,job:{...input.job,title:'Consultant '+i}}));
 await Promise.all(inputs.map((job,i)=>cache.save(job,{version:7,skills:i%10},{id:String(i)})));
 assert.equal(blobs.size,72);
 for(let i=0;i<inputs.length;i++)assert.equal((await cache.find(inputs[i])).skills,i%10);
 assert.equal((await cache.list(input.profile)).length,20);
 assert.equal(await cache.find({...inputs[0],profile:{...input.profile,evidence:'Different CV'}}),null);
 assert.notEqual(reviewHash(input,now()),reviewHash({...input,job:{...input.job,description:input.job.description+' Extra requirement.'}},now()));
});
test('ready comparisons are restored before newer rejected adverts and legacy reviews remain readable',async()=>{
 const {cache,blobs,now}=memoryCache(),ready={version:7,skills:8,points:[],factors:[]};
 await cache.save(input,ready,{id:'ready'});
 const readyPath=[...blobs.keys()][0],bankPath=readyPath.split('/ready/')[0]+'.json';
 const old={...input,job:{...input.job,title:'Legacy role'}},oldEntry={hash:reviewHash(old,now()),review:ready,listing:{id:'legacy'},savedAt:now()};
 blobs.set(bankPath,JSON.stringify({entries:[oldEntry]}));
 for(let i=0;i<25;i++)await cache.save({...input,job:{...input.job,title:'Rejected '+i}},{version:7,skills:3,points:[],factors:[]},{id:String(i)});
 const entries=await cache.list(input.profile);
 assert(entries.some(e=>e.listing.id==='ready'));assert(entries.some(e=>e.listing.id==='legacy'));
 assert.equal((await cache.find(old)).skills,8);
 await cache.save(old,{...ready,skills:9},{id:'legacy-updated'});
 assert.equal((await cache.find(old)).skills,9);
 assert.equal((await cache.list(input.profile)).filter(e=>e.hash===oldEntry.hash).length,1);
});
test('concurrent requests for the same CV and advert share one paid comparison',async()=>{
 const previous=process.env.JOB_NOTEBOOK_ACCESS_TOKEN;process.env.JOB_NOTEBOOK_ACCESS_TOKEN='s'.repeat(43);
 let calls=0,release;const gate=new Promise(r=>release=r),cache={find:async()=>null,save:async()=>{}};
 const handler=createFitReviewHandler(async()=>{calls++;await gate;return {version:7,skills:8};},Date.now,cache);
 const response=()=>({setHeader(){},status(code){this.code=code;return this;},json(data){this.data=data;}});
 const a=response(),b=response(),request={method:'POST',headers:{authorization:'Bearer '+'s'.repeat(43)},body:input};
 try{const first=handler(request,a),second=handler(request,b);await new Promise(r=>setImmediate(r));assert.equal(calls,1);release();await Promise.all([first,second]);assert.equal(a.code,200);assert.equal(b.code,200);assert(b.data.cached);}finally{if(previous===undefined)delete process.env.JOB_NOTEBOOK_ACCESS_TOKEN;else process.env.JOB_NOTEBOOK_ACCESS_TOKEN=previous;}
});
