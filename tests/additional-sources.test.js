import test from 'node:test';import assert from 'node:assert/strict';
import {fetchRemoteOK,fetchEmployerBoard,additionalSources,employerBoards} from '../server/additional-sources.js';
const response=data=>({ok:true,json:async()=>data});
const row={id:'a',title:'Implementation Specialist',isListed:true,isRemote:true,location:'Canada',jobUrl:'https://jobs.ashbyhq.com/example/a',descriptionHtml:'<h2>Requirements</h2><p>SQL experience.</p>',publishedAt:'2026-09-30'};
test('Remote OK discards metadata and unsafe links, preserves attribution, dates and unknown location',async()=>{
 const jobs=await fetchRemoteOK(async()=>response([{legal:'Attribute each job'},{id:1,position:'Business Analyst',company:'Example',url:'https://remoteok.com/remote-jobs/1',date:'2026-09-30',description:'<p>Requirements</p><p>SQL experience.</p>'},{id:2,position:'Bad',company:'Bad',url:'javascript:alert(1)'}]));
 assert.equal(jobs.length,1);assert.equal(jobs[0].link,'https://remoteok.com/remote-jobs/1');assert.equal(jobs[0].source,'Remote OK');assert.equal(jobs[0].location,'Location not stated');assert.equal(jobs[0].publishedAt,'2026-09-30T00:00:00.000Z');assert.match(jobs[0].description,/Requirements\n\nSQL/);
});
test('employer boards preserve multiple countries and compensation without exposing unlisted jobs',async()=>{
 const jobs=await fetchEmployerBoard({slug:'example',company:'Example'},async()=>response({jobs:[{...row,secondaryLocations:[{location:'Cape Town',address:{postalAddress:{addressCountry:'South Africa'}}}],compensation:{compensationTierSummary:'CAD 60,000 per year'}},{...row,id:'unlisted',isListed:false},{...row,id:'unsafe',jobUrl:'javascript:alert(1)'}]}));
 assert.equal(jobs.length,1);assert.match(jobs[0].location,/Canada; Cape Town, South Africa/);assert.equal(jobs[0].employerBoard,'example');assert.match(jobs[0].description,/CAD 60,000 per year/);assert.equal(jobs[0].publishedAt,'2026-09-30T00:00:00.000Z');
 const missing=await fetchEmployerBoard({slug:'example',company:'Example'},async()=>response({jobs:[{...row,publishedAt:undefined,location:undefined}]}));assert.equal(missing[0].publishedAt,'');assert.equal(missing[0].location,'Location not stated');
});
test('one failed employer feed retains other results and only marks successful boards refreshed',async()=>{
 const result=await additionalSources(async url=>{
  if(url.includes('/linear?'))throw Error('Unavailable');
  if(url.includes('remoteok'))return response([]);
  return response({jobs:[row]});
 },{useCache:false});
 assert.equal(result.jobs.length,employerBoards.length-1);assert.deepEqual(result.sourceErrors,['Linear careers']);assert(!result.refreshedEmployerBoards.includes('linear'));assert(result.refreshedEmployerBoards.includes('Ashby'));
});

test('an explicit US-only employer address is not expanded to North America',async()=>{
 const {matchJob,defaultProfile}=await import('../lib/model.js');
 const jobs=await fetchEmployerBoard({slug:'example',company:'Example'},async()=>response({jobs:[{...row,location:'North America',address:{postalAddress:{addressCountry:'USA'}}}]}));
 assert.equal(jobs[0].location,'United States');assert.equal(matchJob(jobs[0],defaultProfile).eligible,false);
});

test('jobs endpoint includes both new sources and successful-board refresh metadata',async()=>{
 const original=globalThis.fetch;
 globalThis.fetch=async url=>{
  if(url.includes('remoteok'))return response([{id:'remote',position:'Business Analyst',company:'Remote Source',url:'https://remoteok.com/remote-jobs/remote',location:'Canada',description:'Requirements: SQL experience.'}]);
  if(url.includes('ashbyhq'))return response({jobs:[row]});
  if(url.includes('himalayas'))return response({jobs:[],totalCount:0,offset:0,limit:20});
  if(url.includes('arbeitnow'))return response({data:[],links:{next:null}});
  return response({jobs:[]});
 };
 try{
  const {default:handler}=await import('../api/jobs.js?additional-sources-test');
  const res={setHeader(){},status(code){this.code=code;return this;},json(data){this.data=data;}};
  await handler({method:'GET',url:'/api/jobs'},res);
  assert.equal(res.code,200);assert(res.data.jobs.some(j=>j.source==='Remote OK'));assert(res.data.jobs.some(j=>j.source==='Employer careers · Ashby'));
  assert.equal(res.data.refreshedEmployerBoards.length,employerBoards.length);assert.deepEqual(res.data.sourceErrors,[]);
 }finally{globalThis.fetch=original;}
});
