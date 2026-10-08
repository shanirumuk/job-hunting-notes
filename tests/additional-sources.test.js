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

test('jobs endpoint uses Firecrawl rather than the previous feeds',async()=>{
 const {createJobsHandler}=await import('../api/jobs.js');const requested=[];
 const description='Requirements:\nSQL experience.\nAPI integrations experience.\nEnglish proficiency.';
 const handler=createJobsHandler({fetcher:async(url,options)=>{requested.push(url);return {ok:true,status:200,json:async()=>({success:true,data:url.endsWith('/search')?{web:[{url:'https://example.org/new-source'}]}:{markdown:'Example Business Analyst\n'+description,json:{isJobPosting:true,isClosed:false,title:'Business Analyst',company:'Example',location:'Canada',remote:true,description,publishedAt:'2026-10-01',expiresAt:''}}})};}});
 const res={setHeader(){},status(code){this.code=code;return this;},json(data){this.data=data;}};
 await handler({method:'GET',url:'/api/jobs?region=north-america&skills=sql',headers:{}},res);
 assert.equal(res.code,200);assert.equal(res.data.source,'Firecrawl');assert.equal(res.data.jobs[0].source,'Firecrawl · example.org');assert(requested.every(url=>url.startsWith('https://api.firecrawl.dev/v2/')));
});
