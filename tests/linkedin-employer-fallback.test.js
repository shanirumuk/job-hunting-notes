import test from 'node:test';import assert from 'node:assert/strict';
import {listingsFromAlert,mergeAlertJobs} from '../lib/job-alerts.js';
import {sameJob} from '../lib/model.js';
import {resolveEmployerListing} from '../server/firecrawl-jobs.js';
import {matchingEmployerListing} from '../server/employer-listing-match.js';
const url='https://www.linkedin.com/jobs/view/4473218727/',hint={title:'Business Analyst (m/w/d)',company:'Example GmbH',location:'Greater Munich Metropolitan Area'};
const description='Requirements:\nSQL reporting experience.\nEnglish proficiency.\nResponsibilities:\nDocument requirements and improve workflows.';
const document=(company='Example GmbH',title='Business Analyst (m/w/d)',location='München, Germany',extra='')=>({markdown:`# ${title}\n${company}\n${location}\n${description}${extra}`,json:{isJobPosting:true,isClosed:false,company,title,location,remote:false,description:description+extra,publishedAt:'2026-10-01',expiresAt:''}});
const response=data=>({ok:true,status:200,json:async()=>({success:true,data})});
test('email metadata stays inside each explicit job card, excludes private text and tracking',()=>{
 const html=`PRIVATE CONTACT DETAILS<a href="${url}?tracking=secret"><img alt="Logo" /></a><a href="${url}?tracking=secret">Business Analyst (m/w/d)</a><p>Example GmbH &middot; Greater Munich Metropolitan Area</p><a href="https://www.linkedin.com/jobs/view/4473218728/">Systems Analyst</a><p>Other Employer &middot; Berlin</p>`;
 assert.deepEqual(listingsFromAlert({html}),[{url,hint},{url:'https://www.linkedin.com/jobs/view/4473218728/',hint:{title:'Systems Analyst',company:'Other Employer',location:'Berlin'}}]);
 assert(!JSON.stringify(listingsFromAlert({html})).includes('secret'));assert(!JSON.stringify(listingsFromAlert({html})).includes('PRIVATE CONTACT'));
 const missing=`<a href="${url}">Business Analyst</a><a href="https://www.linkedin.com/jobs/view/4473218728/">Different role</a><p>Wrong Employer &middot; Berlin</p>`;
 assert.deepEqual(listingsFromAlert({html:missing})[0],{url});
});
test('fallback searches and reads employer pages and preserves LinkedIn provenance',async()=>{
 const calls=[];
 const job=await resolveEmployerListing(url,hint,{apiKey:'fixture',fetcher:async(endpoint,options)=>{
  const body=JSON.parse(options.body);calls.push({endpoint,body});
  if(endpoint.endsWith('/search'))return response({web:[{url:'https://www.linkedin.com/jobs/view/1234567890/'},{url:'https://jobs.lever.co/example/fallback-unique'}]});
  return response(document());
 }});
 assert.equal(job.company,hint.company);assert.equal(job.link,'https://jobs.lever.co/example/fallback-unique');assert.equal(job.linkedInURL,url);assert.equal(calls.length,2);assert(calls[0].body.query.includes('Example'));assert(!calls.some(c=>c.body.url?.includes('linkedin.com')));
 const saved={id:'saved',company:'Example',title:'Analyst',location:'Munich',link:url,status:'Applied',notes:'Keep my notes'};
 assert(sameJob(saved,job));assert.equal(mergeAlertJobs([job],[{...job,id:'another-source-id'}]).length,1);
});
test('title, company and city must match; a shared country cannot hide a regional mismatch',()=>{
 const base=document().json;
 assert(matchingEmployerListing(base,hint));assert(!matchingEmployerListing({...base,company:'Other Employer'},hint));assert(!matchingEmployerListing({...base,title:'Senior Business Analyst'},hint));assert(!matchingEmployerListing({...base,location:'Berlin, Germany'},hint));
 assert(matchingEmployerListing(base,{...hint,location:'Germany'}));
});
test('wrong and ambiguous employer adverts remain unresolved',async()=>{
 for(const kind of ['wrong','ambiguous']){
  const target={...hint,title:kind==='wrong'?'Data Analyst':'Business Analyst (m/w/d)'};
  await assert.rejects(resolveEmployerListing(url,target,{apiKey:kind,fetcher:async(endpoint,options)=>{
   if(endpoint.endsWith('/search'))return response({web:[{url:`https://jobs.lever.co/example/${kind}-1`},{url:`https://jobs.lever.co/example/${kind}-2`}]});
   return response(document('Example GmbH','Business Analyst (m/w/d)','München, Germany',JSON.parse(options.body).url.endsWith('-2')?'\nRequired: German C1 proficiency.':''));
  }}),/No matching open|Several employer adverts/);
 }
});
test('employer JobPosting data preserves verbatim requirements instead of generated replacements',async()=>{
 const {normalizeFirecrawlJob}=await import('../server/firecrawl-jobs.js');
 const exact='Requirements:\nSQL reporting experience.\nEnglish proficiency.';
 const source={"@type":"JobPosting",title:'Business Analyst',hiringOrganization:{name:'Example GmbH'},description:exact,jobLocation:{address:{addressLocality:'Munich',addressCountry:'Germany'}},datePosted:'2026-10-01',url:'https://example.org/jobs/source'};
 const rawHtml='<script type="application/ld+json">'+JSON.stringify(source)+'</script>';
 const result=normalizeFirecrawlJob({rawHtml,markdown:'# Business Analyst\nExample GmbH',json:{...document().json,description:'Invented: ten years of experience in another industry.'}},source.url);
 assert.equal(result.description,'Requirements:\n\nSQL reporting experience.\n\nEnglish proficiency.');assert(!result.description.includes('Invented'));
 const expired={...source,validThrough:'2020-01-01'};assert.equal(normalizeFirecrawlJob({rawHtml:'<script type="application/ld+json">'+JSON.stringify(expired)+'</script>',markdown:'# Job'},source.url),null);
});
