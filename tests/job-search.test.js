import test from 'node:test';import assert from 'node:assert/strict';
import {fetchSearchPage,searchJobs,validSearchCursor} from '../server/job-search.js';
const row=(id,location=['South Africa'])=>({guid:'https://himalayas.app/companies/example/jobs/'+id,title:'Implementation Consultant',companyName:'Example '+id,locationRestrictions:location,description:'<p>Configure systems.</p><p>Train customers.</p>',pubDate:1700000000});
test('search adapter targets the requested country and preserves location, timezone, pay and source attribution',async()=>{
 let url;const result=await fetchSearchPage({q:'implementation',country:'ZA'},2,async u=>{url=new URL(u);return {ok:true,json:async()=>({jobs:[{...row('one'),timezoneRestrictions:[2,3],minSalary:40000,maxSalary:50000,currency:'ZAR',salaryPeriod:'monthly'},row('world',[]),{...row('old'),expiryDate:1}],offset:20,limit:20,totalCount:50})};});
 assert.equal(url.searchParams.get('country'),'ZA');assert.equal(url.searchParams.get('exclude_worldwide'),'true');assert.equal(url.searchParams.get('page'),'2');
 assert.equal(result.more,true);assert.equal(result.jobs.length,2);assert.equal(result.jobs[0].location,'South Africa');assert.equal(result.jobs[0].source,'Himalayas');assert.match(result.jobs[0].description,/40000–50000 ZAR monthly/);assert.match(result.jobs[0].description,/UTC offsets: 2, 3/);assert.match(result.jobs[1].location,/Worldwide/);
});
test('search pagination visits additional role queries and subsequent pages instead of stopping after one batch',async()=>{
 const calls=[];const fetchPage=async(query,page)=>{calls.push([query.q,page]);return {jobs:[{id:query.q+page,company:query.q,title:'Implementation Consultant',location:'Portugal',link:'https://example.org/'+query.q+page}],more:query.q==='implementation'&&page===1};};
 const first=await searchJobs({region:'europe',country:'portugal'},fetchPage);assert.ok(first.nextSearch);
 const second=await searchJobs({region:'europe',country:'portugal',cursor:first.nextSearch},fetchPage);assert.ok(second.nextSearch);
 const third=await searchJobs({region:'europe',country:'portugal',cursor:second.nextSearch},fetchPage);assert.equal(third.nextSearch,null);assert.deepEqual(calls.at(-1),['implementation',2]);
 assert.equal(calls.length,7);
});
test('failed search pages stay retryable without dropping successful results',async()=>{
 let fail=true;const getPage=async(query,page)=>{if(query.q==='implementation'&&fail)throw Error('429');return {jobs:[{id:query.q,company:query.q,title:'Implementation Consultant',location:'Portugal',link:'https://example.org/'+query.q}],more:false};};
 const first=await searchJobs({region:'europe',country:'portugal'},getPage);assert.equal(first.partial,true);assert.equal(first.jobs.length,2);assert.ok(first.nextSearch);
 fail=false;const second=await searchJobs({region:'europe',country:'portugal',cursor:first.nextSearch},getPage);assert.equal(second.partial,false);assert.equal(second.searchQueries[0].q,'implementation');assert.equal(second.searchQueries[0].page,1);
});
test('malformed cursors are rejected before reaching upstream endpoints',async()=>{
 for(const value of ['bad',Buffer.from('[[-1,1]]').toString('base64url'),Buffer.from('[[0,1],[0,2]]').toString('base64url')]){
  assert.equal(validSearchCursor(value,'africa',''),false);await assert.rejects(searchJobs({region:'africa',cursor:value},()=>{throw Error('Should not fetch');}),/Invalid search cursor/);
 }
});

test('every continent searches its own countries, keeps continuation and advances to subsequent pages',async()=>{
 const initialCountries={europe:['Albania','Andorra','Austria'],africa:['ZA','KE','NG'],asia:['IN','SG','PH'],oceania:['AU','NZ','FJ'],'north-america':['CA','MX','CR'],'south-america':['BR','AR','CL']};
 for(const [region,expected] of Object.entries(initialCountries)){
  const calls=[];
  const getPage=async(query,page)=>{calls.push({country:query.country,page,broad:query.broad});return {jobs:[],more:page===1&&query.country===expected[0]&&query.q==='implementation'};};
  let result=await searchJobs({region},getPage);assert.deepEqual(calls.slice(0,3).map(c=>c.country),expected,region);assert.ok(result.nextSearch,region);
  let batches=0;
  while(result.nextSearch){result=await searchJobs({region,cursor:result.nextSearch},getPage);assert.ok(++batches<150,region);}
  assert.ok(calls.some(c=>c.country===expected[0]&&c.page===2),region);assert.ok(calls.every(c=>c.broad===false),region);
 }
});
