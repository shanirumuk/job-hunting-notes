import test from 'node:test';import assert from 'node:assert/strict';
import {fetchJobs,fetchRemoteJobs} from '../api/jobs.js';
const row=n=>({slug:'job-'+n,title:'Business Analyst',company_name:'Employer '+n,url:'https://example.org/'+n,description:'Analyse workflows',location:'Berlin'});
const response=(page,end=false)=>({ok:true,json:async()=>({data:[row(page)],links:{next:end?null:'https://www.arbeitnow.com/api/job-board-api?page='+(page+1)}})});
test('continues beyond the first three pages and stops at the source end',async()=>{
 const requested=[];const data=await fetchJobs(async url=>{const page=Number(new URL(url).searchParams.get('page'));requested.push(page);return response(page,page===5);},4);
 assert.deepEqual(requested,[4,5,6]);assert.equal(data.nextPage,null);assert.equal(data.jobs.length,2);
});
test('failed middle pages remain retryable and successful jobs are retained',async()=>{
 const data=await fetchJobs(async url=>{const page=Number(new URL(url).searchParams.get('page'));if(page===5)throw Error('network');return response(page);},4);
 assert.equal(data.nextPage,5);assert.equal(data.retryPage,5);assert.equal(data.partial,true);assert.equal(data.jobs.length,2);
});
test('failures after an explicit source end do not create endless retries',async()=>{
 const data=await fetchJobs(async url=>{const page=Number(new URL(url).searchParams.get('page'));if(page>4)throw Error('past end');return response(4,true);},4);
 assert.equal(data.nextPage,null);assert.equal(data.partial,false);
});
test('Remotive keeps geographic restrictions, source attribution and salary units',async()=>{
 const data=await fetchRemoteJobs(async()=>({ok:true,json:async()=>({jobs:[{id:1,company_name:'Remote Co',title:'Implementation Consultant',url:'https://remotive.com/remote-jobs/a',candidate_required_location:'Europe',description:'<p>Configure systems</p>',salary:'€50,000/year'},{id:2,title:'Invalid',company_name:'X',url:'javascript:alert(1)'}]})}));
 assert.equal(data.length,1);assert.equal(data[0].source,'Remotive');assert.equal(data[0].location,'Europe');assert.match(data[0].description,/€50,000\/year/);assert.equal(data[0].remote,true);
});
test('invalid paging inputs are rejected before any source request',async()=>{
 const {default:handler}=await import('../api/jobs.js');
 for(const page of ['0','-1','1.5','https://example.org','10001']){
  const res={setHeader(){},status(code){this.code=code;return this;},json(){}};
  await handler({method:'GET',url:'/api/jobs?page='+encodeURIComponent(page)},res);assert.equal(res.code,400);
 }
});
