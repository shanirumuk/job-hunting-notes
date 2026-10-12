import test from 'node:test';import assert from 'node:assert/strict';
import {publicJobFeeds} from '../server/public-job-feeds.js';
import {createJobsHandler} from '../api/jobs.js';
const response=data=>({ok:true,status:200,json:async()=>data});
const description='Requirements:\nSQL experience.\nEnglish proficiency.\n2 years of software development experience.';
const row=(id,location='Berlin',years=2)=>({slug:id,title:'Frontend Developer',company_name:id,url:'https://example.org/jobs/'+id,location,description:description.replace('2 years',years+' years')});
const fetcher=async url=>{
 if(url.includes('arbeitnow.com'))return response({data:[row('german'),row('senior','Berlin',5),row('london','London'),row('us','United States')],links:{next:null}});
 if(url.includes('remotive.com'))return response({jobs:[{id:1,title:'Frontend Developer',company_name:'german',url:'https://example.org/jobs/german',candidate_required_location:'Berlin',description}]});
 if(url.includes('jobicy.com'))return response({jobs:[{id:2,jobTitle:'Implementation Consultant',companyName:'African employer',url:'https://example.org/jobs/africa',jobGeo:'South Africa',jobDescription:'Requirements:\nSQL experience.\nEnglish proficiency.'}]});
 return response(url.includes('remoteok.com')?[]:{jobs:[]});
};
test('initial feeds use CV role coverage, dated years and actual geography without duplicate adverts',async()=>{
 const d=await publicJobFeeds({region:'europe',country:'germany',development:true,months:31},{fetcher,useCache:false});
 assert.deepEqual(d.jobs.map(j=>j.company),['german']);assert.equal(d.nextSearch,'start');assert.equal(d.nextPage,null);assert.equal(d.sourcesChecked.length,4);
 assert.equal((await publicJobFeeds({region:'europe',development:false},{fetcher,useCache:false})).jobs.length,0);
 const africa=await publicJobFeeds({region:'africa',development:true,months:31},{fetcher,useCache:false});assert.deepEqual(africa.jobs.map(j=>j.company),['African employer']);
});
test('a failed feed retains other adverts and hands continuation to Firecrawl',async()=>{
 const d=await publicJobFeeds({region:'africa'},{useCache:false,fetcher:async url=>{if(url.includes('arbeitnow.com'))throw Error('Unavailable');return fetcher(url);}});
 assert.equal(d.jobs.length,1);assert(d.sourceErrors.includes('Arbeitnow'));assert.equal(d.nextSearch,'start');
});
test('the actual jobs handler serves an initial feed batch and validates dated experience before network work',async()=>{
 const calls=[];const handler=createJobsHandler({useCache:false,fetcher:async(...args)=>{calls.push(args[0]);return fetcher(...args);}});
 const request=async url=>{const res={setHeader(){},status(code){this.code=code;return this;},json(data){this.data=data;}};await handler({method:'GET',url,headers:{}},res);return res;};
 const d=await request('/api/jobs?region=europe&country=germany&development=1&months=31');assert.equal(d.code,200);assert.equal(d.data.jobs.length,1);assert(calls.every(u=>!u.includes('api.firecrawl.dev')));
 const count=calls.length;assert.equal((await request('/api/jobs?months=wrong')).code,400);assert.equal(calls.length,count);
});
