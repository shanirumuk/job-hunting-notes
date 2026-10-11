import test from 'node:test';
import assert from 'node:assert/strict';
import {linkedInJobURL,linksFromAlert,mergeAlertJobs} from '../lib/job-alerts.js';
import {sameJob,defaultProfile,discoveryDecision} from '../lib/model.js';
import {createJobAlertsHandler} from '../api/job-alerts.js';
test('forwarded alerts extract only canonical job links and remove tracking duplicates',()=>{
 const url='https://www.linkedin.com/jobs/view/4473218727/';
 const links=linksFromAlert({html:'<a href="https://www.linkedin.com/comm/jobs/view/4473218727?ref=a&amp;tracking=b">Netto</a> <a href="https://www.linkedin.com/jobs/view/a-role-4473218727/?x=y">Same</a>',text:url+' https://www.linkedin.com/jobs/search/?keywords=netto https://www.linkedin.com/feed/ https://evil.example/jobs/view/4473218727/ https://www.linkedin.com.evil.example/jobs/view/4473218727/'});
 assert.deepEqual(links,[url]);
 for(const input of ['https://user:secret@www.linkedin.com/jobs/view/4473218727/','http://www.linkedin.com/jobs/view/4473218727/','https://www.linkedin.com:999/jobs/view/4473218727/','https://localhost/jobs/view/4473218727/'])assert.equal(linkedInJobURL(input),'');
});
test('alert candidates deduplicate LinkedIn slug and notification URLs without changing a saved identity',()=>{
 const old={id:'old',company:'Netto',title:'Analyst',location:'Berlin',link:'https://www.linkedin.com/jobs/view/a-role-4473218727/?ref=a',description:'Old text'};
 const incoming={id:'new',company:'Netto',title:'Business Analyst',location:'Berlin, Germany',link:'https://www.linkedin.com/comm/jobs/view/4473218727/',description:'New verified text'};
 assert(sameJob(old,incoming));assert.deepEqual(mergeAlertJobs([old],[incoming]),[{...old,...incoming,id:'old'}]);assert.equal(old.description,'Old text');
});
test('alert provenance cannot bypass the skills threshold or turn a listing into an application',()=>{
 const profile={...defaultProfile,geography:'europe',evidence:'ETS International\nFull Stack Developer\nSeptember 2024–Present\nSQL, data analysis, stakeholder communication.',languages:'English C1'};
 const poor={id:'poor',title:'Technical Project Manager',company:'Netto',location:'Berlin, Germany',description:'Requirements\n5+ years managing distributed delivery teams.\nOwn budgets and margins.',link:'https://www.linkedin.com/jobs/view/4473218727/',source:'LinkedIn email alert'};
 assert.equal(discoveryDecision(poor,profile).eligible,false);
 const imported=mergeAlertJobs([], [poor]);assert.equal(imported[0].status,undefined);assert.equal(imported[0].applicationDate,undefined);
});
test('email receiver rejects unauthorised access and reads only the configured recipient, without returning bodies',async()=>{
 const previous=process.env.JOB_NOTEBOOK_ACCESS_TOKEN;process.env.JOB_NOTEBOOK_ACCESS_TOKEN='test-owner-token-'.repeat(3);
 const calls=[],address='alerts@example.resend.app';
 const handler=createJobAlertsHandler({pause:async()=>{},settings:()=>({key:'server-secret-key',address}),fetcher:async(url,options)=>{
  calls.push(url);assert.equal(options.headers.Authorization,'Bearer server-secret-key');
  const data=url.includes('?')?{has_more:false,data:[{id:'other',to:['other@example.resend.app']},{id:'mine',to:[address],created_at:'2026-10-11T12:00:00Z'}]}:{to:[address],text:'PRIVATE CONTACT DETAILS https://www.linkedin.com/comm/jobs/view/4473218727/?tracking=private'};
  return {ok:true,status:200,json:async()=>data};
 }});
 const call=async(body,authorised=true)=>{const res={code:200,setHeader(){},status(c){this.code=c;return this;},json(data){this.data=data;return this;}};await handler({method:'POST',headers:{authorization:authorised?'Bearer '+process.env.JOB_NOTEBOOK_ACCESS_TOKEN:''},body},res);return res;};
 try{
  assert.equal((await call({action:'list',seen:[]},false)).code,401);assert.equal(calls.length,0);
  const status=await call({action:'status'});assert.equal(status.data.address,address);assert.equal(calls.length,0);assert(!JSON.stringify(status.data).includes('server-secret-key'));
  const result=await call({action:'list',seen:[]});assert.equal(result.code,200);assert.equal(calls.length,2);assert(!calls.some(u=>u.endsWith('/other')));
  assert.deepEqual(result.data.links,[{url:'https://www.linkedin.com/jobs/view/4473218727/',messageId:'mine',receivedAt:'2026-10-11T12:00:00Z'}]);assert.deepEqual(result.data.processed,['mine']);assert(!JSON.stringify(result.data).includes('PRIVATE CONTACT'));
  const repeated=await call({action:'list',seen:['mine']});assert.deepEqual(repeated.data.links,[]);assert.equal(calls.length,3);
 }finally{previous===undefined?delete process.env.JOB_NOTEBOOK_ACCESS_TOKEN:process.env.JOB_NOTEBOOK_ACCESS_TOKEN=previous;}
});
test('receiver batches retain failed messages for retry and use cursor pagination without leaking provider errors',async()=>{
 const previous=process.env.JOB_NOTEBOOK_ACCESS_TOKEN;process.env.JOB_NOTEBOOK_ACCESS_TOKEN='test-owner-token-'.repeat(3);
 const address='alerts@example.resend.app',rows=Array.from({length:5},(_,i)=>({id:'email-'+i,to:[address]}));
 let fail=false;
 const handler=createJobAlertsHandler({pause:async()=>{},settings:()=>({key:'secret-key',address}),fetcher:async url=>url.includes('?')?{ok:true,status:200,json:async()=>({has_more:true,data:rows})}:fail?{ok:false,status:429,json:async()=>({error:'secret-key'})}:{ok:true,status:200,json:async()=>({to:[address],html:'No job links in this confirmation message'})}});
 const call=async body=>{const res={code:200,setHeader(){},status(c){this.code=c;return this;},json(data){this.data=data;}};await handler({method:'POST',headers:{authorization:'Bearer '+process.env.JOB_NOTEBOOK_ACCESS_TOKEN},body},res);return res;};
 try{
  let result=await call({action:'list',seen:[]});assert.equal(result.data.processed.length,3);assert.equal(result.data.nextCursor,'');assert.equal(result.data.more,true);
  result=await call({action:'list',seen:['email-0','email-1','email-2']});assert.deepEqual(result.data.processed,['email-3','email-4']);assert.equal(result.data.nextCursor,'email-4');
  fail=true;result=await call({action:'list',seen:[]});assert.deepEqual(result.data.processed,[]);assert.equal(result.data.nextCursor,'');assert(!JSON.stringify(result.data).includes('secret-key'));assert.match(result.data.errors[0],/rate limit/);
  assert.equal((await call({action:'list',seen:[],cursor:'../../private'})).code,400);
 }finally{previous===undefined?delete process.env.JOB_NOTEBOOK_ACCESS_TOKEN:process.env.JOB_NOTEBOOK_ACCESS_TOKEN=previous;}
});
