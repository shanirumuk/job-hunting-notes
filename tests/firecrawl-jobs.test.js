import test from 'node:test';import assert from 'node:assert/strict';
import {firecrawlPlan,firecrawlSearchBatch,normalizeFirecrawlJob,publicListingURL,listingIndexURL,searchFirecrawlJobs} from '../server/firecrawl-jobs.js';
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
 const plan=firecrawlPlan({development:true});assert(plan.length>=5);assert(plan.every(q=>q.length<=500));
 for(const group of searchRoleGroups)for(const title of group.titles){
  assert(plan.filter(q=>!q.includes('site:linkedin.com')).some(q=>q.includes('"'+title+'"')),title+' absent from employer search');
  assert(plan.filter(q=>q.includes('site:linkedin.com')).some(q=>q.includes('"'+title+'"')),title+' absent from LinkedIn search');
 }
 assert.match(plan.join(' '),/project coordinator/);assert.match(plan.join(' '),/change analyst/);assert.match(plan.join(' '),/functional consultant/);
});
test('legacy related-role settings never narrow automatic discovery',()=>{
 const plan=firecrawlPlan({includeAdjacent:false,development:true}).join(' ');
 assert.equal(searchRoleGroups.length,8);
 for(const group of searchRoleGroups)for(const title of group.titles)assert(plan.includes('"'+title+'"'));
});
test('the jobs endpoint searches broadly even for old clients sending a related-role setting',async()=>{
 const queries=[],handler=createJobsHandler({fetcher:async(url,options)=>{queries.push(JSON.parse(options.body).query);return response({web:[]});}});
 const cursor=firecrawlPlan({region:'asia'}).findIndex(q=>q.includes('\"functional consultant\"'));
 for(const adjacent of ['0','1']){
  const res={setHeader(){},status(code){this.code=code;return this;},json(data){this.data=data;}};
  await handler({method:'GET',url:'/api/jobs?region=asia&search=fc:'+cursor+'&adjacent='+adjacent,headers:{}},res);
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
 const handler=createJobsHandler({pause:async()=>{},fetcher:async()=>({ok:false,status:429,json:async()=>({success:false,error:'secret-key'})})});
 const res={setHeader(){},status(code){this.code=code;return this;},json(data){this.data=data;}};
 await handler({method:'GET',url:'/api/jobs?region=africa&skills=python&search=start',headers:{}},res);assert.equal(res.code,429);assert.equal(res.data.code,'FIRECRAWL_RATE_LIMIT');assert.match(res.data.error,/retry/);assert(!JSON.stringify(res.data).includes('secret-key'));
 await handler({method:'GET',url:'/api/jobs?skills=private-email',headers:{}},res);assert.equal(res.code,400);
});
test('all CV search combinations stay within Firecrawl’s 500-character query limit',()=>{
 for(const region of ['international','europe','asia','north-america']){
  const plan=firecrawlPlan({region,skills:['api','sql','requirements','workflows'],junior:true,development:true});
  assert(plan.every(q=>q.length<=500));
  for(const group of searchRoleGroups)for(const title of group.titles)assert(plan.some(q=>q.includes('"'+title+'"')));
 }
});
test('job search indexes cannot become vacancies or consume paid page extractions',async()=>{
 for(const url of ['https://uk.indeed.com/q-implementation-consultant-entry-level-l-london-jobs.html','https://linkedin.com/jobs/search/?keywords=analyst','https://example.org/careers','https://example.org/jobs/search','https://www.ziprecruiter.com/Jobs/Junior-Full-Stack-Developer-Jobs-Canada','https://www.roberthalf.com/au/en/jobs/all/junior-full-stack-developer']){
  assert(listingIndexURL(url));assert.equal(normalizeFirecrawlJob(document,url),null);
 }
 assert.equal(listingIndexURL('https://linkedin.com/jobs/view/developer-1234567890/'),false);
 let scrapes=0;
 const result=await firecrawlSearchBatch('index test',{fetcher:async url=>{if(url.endsWith('/search'))return response({web:[{url:'https://uk.indeed.com/q-developer-jobs.html'},{url:'https://linkedin.com/jobs/search/'}]});scrapes++;return response(document);}});
 assert.equal(scrapes,0);assert.deepEqual(result.jobs,[]);
});
test('source verification handles markdown links without accepting invented skills',()=>{
 const linked={...document,markdown:document.markdown.replace('API integrations','[API](https://example.org/docs) integrations')};
 assert(normalizeFirecrawlJob(linked,'https://example.org/job/linked'));
 assert.throws(()=>normalizeFirecrawlJob({...linked,json:{...json,description:description+'\nInvented certification mandatory.'}},'https://example.org/job/linked'),/verified/);
});
test('unreadable adverts do not stop other search batches, but exhausted credits remain visible',async()=>{
 const urls={web:[{url:'https://example.org/job/unreadable'}]};
 const result=await firecrawlSearchBatch('unreadable batch',{fetcher:async url=>url.endsWith('/search')?response(urls):{ok:false,status:500,json:async()=>({success:false})}});
 assert.equal(result.partial,true);assert.deepEqual(result.jobs,[]);
 await assert.rejects(()=>firecrawlSearchBatch('credit limit batch',{fetcher:async url=>url.endsWith('/search')?response(urls):{ok:false,status:402,json:async()=>({success:false})}}),/credits/);
});
test('unsupported LinkedIn pages cannot become credential failures or halt employer discovery',async()=>{
 let active=0,peak=0;
 const result=await firecrawlSearchBatch('unsupported LinkedIn and direct employers',{fetcher:async(url,opts)=>{
  if(url.endsWith('/search'))return response({web:[{url:'https://www.linkedin.com/jobs/view/test-1234567890/'},{url:'https://www.remoterocketship.com/country/europe/jobs/junior-analyst/'},{url:'https://example.org/job/direct-employer'}]});
  const target=JSON.parse(opts.body).url;active++;peak=Math.max(peak,active);await new Promise(r=>setTimeout(r,2));active--;
  return target.includes('linkedin.com')?{ok:false,status:403,json:async()=>({success:false,error:'We apologize for the inconvenience but we do not support this site.'})}:response(document);
 }});
 assert.equal(result.jobs.length,1);assert(result.partial);assert(peak<=2);assert(result.jobs[0].link.includes('direct-employer'));
});
test('temporary rate limits back off once, while genuine credit exhaustion is a separate error',async()=>{
 let attempts=0;const delays=[];
 const result=await firecrawlSearchBatch('temporary rate test',{pause:async ms=>delays.push(ms),fetcher:async()=>++attempts===1?{ok:false,status:429,headers:{get:()=>2},json:async()=>({success:false})}:response({web:[]})});
 assert.deepEqual(result.jobs,[]);assert.deepEqual(delays,[2000]);assert.equal(attempts,2);
});
test('a partial rate failure retains verified adverts and the same cursor for retry',async()=>{
 const input={region:'asia',skills:['testing'],cursor:'fc:3'};
 const result=await searchFirecrawlJobs(input,{pause:async()=>{},fetcher:async(url,opts)=>{
  if(url.endsWith('/search'))return response({web:[{url:'https://example.org/job/retained-after-limit'},{url:'https://example.org/job/rate-limited'}]});
  return JSON.parse(opts.body).url.includes('rate-limited')?{ok:false,status:429,headers:{get:()=>20},json:async()=>({success:false})}:response({...document,json:{...json,location:'Singapore'}});
 }});
 assert.equal(result.jobs.length,1);assert.equal(result.nextSearch,'fc:3');assert.equal(result.sourceIssue.code,'FIRECRAWL_RATE_LIMIT');
});
test('known unsupported sites are not repeatedly requested, and another account is not affected',async()=>{
 let scrapes=0;
 const options={apiKey:'blocked-site-test-account',fetcher:async url=>{
  if(url.endsWith('/search'))return response({web:[{url:'https://blocked.example.org/job/'+scrapes}]});
  scrapes++;return {ok:false,status:403,json:async()=>({success:false,code:'UNSUPPORTED_SITE',error:'We do not support this site.'})};
 }};
 await firecrawlSearchBatch('first blocked source',options);await firecrawlSearchBatch('second blocked source',options);assert.equal(scrapes,1);
 await firecrawlSearchBatch('different account source',{...options,apiKey:'another-test-account'});assert.equal(scrapes,2);
});
test('limited page reads prioritise non-senior employer adverts over senior search hits',async()=>{
 const read=[];const result=await firecrawlSearchBatch('prioritised source test',{fetcher:async(url,opts)=>{
  if(url.endsWith('/search'))return response({web:[{title:'Senior Frontend Engineer',url:'https://example.org/job/prioritise-senior'},{title:'Principal Engineer',url:'https://example.org/job/prioritise-principal'},{title:'Frontend Engineer',url:'https://example.org/job/prioritise-frontend'},{title:'Junior Developer',url:'https://example.org/job/prioritise-junior'},{title:'Software Engineer',url:'https://example.org/job/prioritise-software'}]});
  read.push(JSON.parse(opts.body).url);return response(document);
 }});assert.equal(read.length,3);assert.equal(result.jobs.length,1);assert(read.every(url=>!url.includes('senior')&&!url.includes('principal')));
});
test('first search round covers different career areas and uses junior developer terms',()=>{
 const plan=firecrawlPlan({region:'europe',development:true,junior:true,skills:['javascript','api']});
 assert.match(plan[0],/junior/);assert.match(plan[0],/Germany/);
 assert.match(plan[1],/implementation consultant/);assert.match(plan[2],/business analyst/);assert.match(plan[3],/technology consultant/);
 assert(plan.every(q=>q.length<=500));
});

test('source results enforce continent and country filters before returning candidates',async()=>{
 const load=async input=>searchFirecrawlJobs(input,{fetcher:async(url,opts)=>url.endsWith('/search')?response({web:[{url:'https://example.org/job/strict-scope'}]}):response({...document,json:{...json,location:'Argentina - Fully Remote'}})});
 const result=await load({region:'europe',skills:['python'],cursor:'start'});assert.equal(result.jobs.length,0);assert(result.nextSearch);
});
