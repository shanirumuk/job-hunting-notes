import {test} from 'node:test';import assert from 'node:assert/strict';
import {createReviewCacheHandler} from '../api/review-cache.js';
const profile={evidence:'SQL reports.',languages:'English C1',workRights:'Germany route.',salaryTarget:'',motivation:'',workStyle:'',startDate:'',relocation:''};
const response=()=>({code:200,setHeader(){},status(code){this.code=code;return this;},json(data){this.data=data;}});
test('checked CV matches require owner access before reading private storage',async()=>{
 const previous=process.env.JOB_NOTEBOOK_ACCESS_TOKEN;process.env.JOB_NOTEBOOK_ACCESS_TOKEN='r'.repeat(43);let reads=0;
 const handler=createReviewCacheHandler({list:async()=>{reads++;return [];}}),res=response();
 try{await handler({method:'POST',headers:{},body:{profile}},res);assert.equal(res.code,401);assert.equal(reads,0);}finally{if(previous===undefined)delete process.env.JOB_NOTEBOOK_ACCESS_TOKEN;else process.env.JOB_NOTEBOOK_ACCESS_TOKEN=previous;}
});
test('checked matches are prioritised over rejected comparisons and response size is bounded',async()=>{
 const previous=process.env.JOB_NOTEBOOK_ACCESS_TOKEN;process.env.JOB_NOTEBOOK_ACCESS_TOKEN='r'.repeat(43);
 const review=skills=>({version:7,skills,skillsLower:skills,points:[],factors:[]});
 const records=Array.from({length:30},(_,i)=>({hash:String(i),savedAt:i,listing:{id:String(i),description:'x'.repeat(80000)},review:review(i===0?8:2)}));
 const handler=createReviewCacheHandler({list:async()=>records}),res=response();
 try{await handler({method:'POST',headers:{authorization:'Bearer '+'r'.repeat(43)},body:{profile}},res);assert.equal(res.code,200);assert.equal(res.data.records[0].review.skills,8);assert(Buffer.byteLength(JSON.stringify(res.data))<1501000);assert(res.data.records.length<=20);}finally{if(previous===undefined)delete process.env.JOB_NOTEBOOK_ACCESS_TOKEN;else process.env.JOB_NOTEBOOK_ACCESS_TOKEN=previous;}
});
