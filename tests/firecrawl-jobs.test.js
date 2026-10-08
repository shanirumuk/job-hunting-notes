import test from 'node:test';import assert from 'node:assert/strict';
import {firecrawlPlan,firecrawlSearchBatch,normalizeFirecrawlJob,publicListingURL,searchFirecrawlJobs} from '../server/firecrawl-jobs.js';
import {cvSearchSkills,searchRoleGroups} from '../lib/job-search-profile.js';import {createJobsHandler} from '../api/jobs.js';
const description='Requirements:\nAPI integrations experience.\nSQL experience.\nEnglish proficiency.\nResponsibilities:\nCoordinate implementation rollouts.';
const json={isJobPosting:true,isClosed:false,title:'Implementation Consultant',company:'Example',location:'Germany',remote:false,description,publishedAt:'2026-10-01',expiresAt:''};
const document={markdown:'# Example Implementation Consultant\n'+description,json};
const response=data=>({ok:true,status:200,json:async()=>({success:true,data})});
test('search terms use a bounded CV skill vocabulary without contact details or employer names',()=>{
 const skills=cvSearchSkills({evidence:'Applicant at Private Employer built API integrations, SQL reports and tested workflows.',email:'private@example.org'});
 const query=firecrawlPlan({region:'europe',skills,junior:true}).join(' ');
 assert.match(query,/API integrations/);assert.match(query,/junior/);assert.match(query,/linkedin.com\/jobs\/view/);assert.doesNotMatch(query,/Private Employer|private@example/);
});
test('every displayed search area is searched in both employer and LinkedIn batches',()=>{
 const plan=firecrawlPlan();assert.equal(plan.length,5);
 for(const group of searchRoleGroups)for(const title of group.titles){
  assert(plan[group.batch].includes('"'+title+'"'),title+' absent from employer search');
  assert(plan[4].includes('"'+title+'"'),title+' absent from LinkedIn search');
 }
 assert.match(plan[3],/project coordinator/);assert.match(plan[3],/change analyst/);assert.match(plan[2],/functional consultant/);
});
test('legacy related-role settings never narrow automatic discovery',()=>{
 const plan=firecrawlPlan({includeAdjacent:false}).join(' ');
 assert.equal(searchRoleGroups.length,7);
 for(const group of searchRoleGroups)for(const title of group.titles)assert(plan.includes('"'+title+'"'));
});
test('the jobs endpoint searches broadly even for old clients sending a related-role setting',async()=>{
 const queries=[],handler=createJobsHandler({fetcher:async(url,options)=>{queries.push(JSON.parse(options.body).query);return response({web:[]});}});
 for(const adjacent of ['0','1']){
  const res={setHeader(){},status(code){this.code=code;return this;},json(data){this.data=data;}};
  await handler({method:'GET',url:'/api/jobs?region=asia&search=fc:2&adjacent='+adjacent,headers:{}},res);
  assert.equal(res.code,200);
 }
 assert(queries.length>=1);assert(queries.every(query=>query.includes('"functional consultant"')));
});
test('full-advert extraction rejects fabricated skills, closed jobs, invalid types and private URLs',()=>{
 const job=normalizeFirecrawlJob(document,'https://example.org/job/1');assert.equal(job.company,'Example');assert.equal(job.source,'Firecrawl · example.org');assert.equal(job.description,description.replace(/\n/g,'\n\n'));
 assert.equal(normalizeFirecrawlJob({...document,json:{...json,isClosed:true}},job.link),null);
 assert.equal(normalizeFirecrawlJob({...document,json:{...json,isJobPosting:false}},job.link),null);
 assert.throws(()=>normalizeFirecrawlJob({...document,json:{...json,description:description+'\nSalesforce certification required.'}},job.link),/verified/);
 assert.throws(()=>normalizeFirecrawlJob({...document,json:{...json,remote:'true'}},job.link),/Incomplete/);
 for(const url of ['http://127.0.0.1/job','http://10.0.0.1/job','http://localhost/job','file:///tmp/job','https://user:password@example.org/job'])assert.throws(()=>publicListingURL(url));
});
test('Firecrawl is the only network provider and duplicate or unreadable pages are handled independently',async()=>{
 const calls=[];const result=await firecrawlSearchBatch('test query',{apiKey:'server-only-key',fetcher:async(url,options)=>{
  calls.push(url);assert.equal(options.headers.Authorization,'Bearer server-only-key');const body=JSON.parse(options.body);
  if(url.endsWith('/search'))return response({web:[{url:'https://example.org/job/1'},{url:'https://example.org/job/1'},{url:'https://example.org/blocked'}]});
  if(body.url.endsWith('blocked'))return {ok:false,status:500,json:async()=>({success:false})};
  assert.equal(body.maxAge,0);assert.equal(body.formats[1].type,'json');return response(document);
 }});
 assert.equal(result.jobs.length,1);assert.equal(result.partial,true);assert.equal(calls.length,3);assert(calls.every(u=>u.startsWith('https://api.firecrawl.dev/v2/')));assert(!JSON.stringify(result).includes('server-only-key'));
});
test('search continuation advances only after a successful batch and reuses cached extraction',async()=>{
 let calls=0;const options={fetcher:async url=>{calls++;return url.endsWith('/search')?response({web:[{url:'https://example.org/job/cursor'}]}):response(document);}};
 const input={region:'oceania',skills:['python'],cursor:'start'};
 const first=await searchFirecrawlJobs(input,options);assert.equal(first.nextSearch,'fc:1');assert.equal(first.nextPage,null);
 await searchFirecrawlJobs(input,options);assert.equal(calls,2);
 assert.equal((await searchFirecrawlJobs({...input,cursor:'done'},options)).nextSearch,null);
 await assert.rejects(searchFirecrawlJobs({...input,cursor:'fc:999'},options),/cursor/);assert.equal(calls,2);
});
test('API errors are actionable and provider response details cannot leak credentials',async()=>{
 const handler=createJobsHandler({fetcher:async()=>({ok:false,status:429,json:async()=>({success:false,error:'secret-key'})})});
 const res={setHeader(){},status(code){this.code=code;return this;},json(data){this.data=data;}};
 await handler({method:'GET',url:'/api/jobs?region=africa&skills=python',headers:{}},res);assert.equal(res.code,429);assert.match(res.data.error,/allowance|rate/);assert(!JSON.stringify(res.data).includes('secret-key'));
 await handler({method:'GET',url:'/api/jobs?skills=private-email',headers:{}},res);assert.equal(res.code,400);
});
