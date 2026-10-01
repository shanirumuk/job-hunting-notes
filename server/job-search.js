import {listingDate} from '../lib/listing-freshness.js';
import {plainText,descriptionText,safeURL,sameJob} from '../lib/model.js';
import {europeanCountries,searchCountryCodes} from '../lib/geography.js';

// Query countries explicitly: a continent name is not a supported provider country filter.
const queries=['implementation','business analyst','customer success','operations','consultant','project manager'];
export function searchPlan(region,country,broad=false){
 const places=country?[europeanCountries.find(c=>c.value===country)?.label||country]:region==='international'?['']:region==='europe'?europeanCountries.map(c=>c.label):searchCountryCodes[region];
 return queries.flatMap(q=>places.map(country=>({q,country,broad})));
}
function decodeCursor(cursor,count){
 if(!cursor||cursor==='start')return Array.from({length:count},(_,i)=>[i,1]);
 if(cursor==='done')return [];
 let state;try{state=JSON.parse(Buffer.from(cursor,'base64url').toString());}catch{throw new Error('Invalid search cursor');}
 if(!Array.isArray(state)||state.length>count||new Set(state.map(row=>row?.[0])).size!==state.length||state.some(row=>!Array.isArray(row)||row.length!==2||!Number.isInteger(row[0])||row[0]<0||row[0]>=count||!Number.isInteger(row[1])||row[1]<1||row[1]>10000))throw new Error('Invalid search cursor');
 return state;
}
export function validSearchCursor(cursor,region,country){try{decodeCursor(cursor,searchPlan(region,country).length);return true;}catch{return false;}}
const cursorFor=state=>state.length?Buffer.from(JSON.stringify(state)).toString('base64url'):null;
const cache=new Map(),pending=new Map();
const TTL=6*60*60*1000;
export async function fetchSearchPage(query,page,fetcher=fetch){
 const params=new URLSearchParams({q:query.q,sort:'recent',page:String(page)});
 if(query.country){params.set('country',query.country);params.set('exclude_worldwide',query.broad?'false':'true');}
 const response=await fetcher('https://himalayas.app/jobs/api/search?'+params,{headers:{Accept:'application/json'},signal:AbortSignal.timeout(12000)});
 if(!response.ok)throw new Error('Himalayas unavailable');
 const data=await response.json();
 if(!Array.isArray(data.jobs)||!Number.isInteger(data.totalCount)||data.totalCount<0||!Number.isInteger(data.limit)||data.limit<1||!Number.isInteger(data.offset)||data.offset<0)throw new Error('Invalid Himalayas response');
 const jobs=data.jobs.filter(j=>j&&j.guid&&j.title&&j.companyName&&safeURL(j.guid)&&(!listingDate(j.expiryDate)||Date.parse(listingDate(j.expiryDate))>Date.now())).map(j=>{
  const restrictions=Array.isArray(j.locationRestrictions)?j.locationRestrictions.filter(v=>typeof v==='string'):[];
  const zones=j.timezoneRestrictions||j.timezoneRestriction;
  const salary=j.minSalary||j.maxSalary?'\nSalary: '+[j.minSalary,j.maxSalary].filter(v=>v!=null).join('–')+' '+plainText(j.currency||'')+' '+plainText(j.salaryPeriod||'annual'):'';
  return {id:'himalayas-'+j.guid,company:plainText(j.companyName),title:plainText(j.title),location:restrictions.length?restrictions.map(plainText).join(', '):'Worldwide (check timezone restrictions)',remote:true,locationCountries:restrictions,link:safeURL(j.guid),description:descriptionText(j.description).slice(0,23000)+salary+(Array.isArray(zones)&&zones.length?'\nAdvertised UTC offsets: '+zones.map(plainText).join(', '):''),publishedAt:listingDate(j.pubDate),expiresAt:listingDate(j.expiryDate),source:'Himalayas',fetchedAt:new Date().toISOString()};
 });
 return {jobs,more:data.offset+data.jobs.length<data.totalCount&&data.jobs.length>0,total:data.totalCount};
}
async function cachedPage(query,page){
 const key=JSON.stringify([query,page]),old=cache.get(key);
 if(old&&Date.now()-old.time<TTL)return old.data;
 if(!pending.has(key))pending.set(key,fetchSearchPage(query,page).then(data=>{cache.set(key,{time:Date.now(),data});if(cache.size>300)cache.delete(cache.keys().next().value);return data;}).finally(()=>pending.delete(key)));
 return pending.get(key);
}
export async function searchJobs({region='international',country='',cursor,broad=false},getPage=cachedPage){
 const plan=searchPlan(region,country,broad),queue=decodeCursor(cursor,plan.length);
 const batch=queue.splice(0,3),results=await Promise.allSettled(batch.map(([index,page])=>getPage(plan[index],page)));
 const jobs=[],failed=[];
 for(const [i,result] of results.entries()){
  const [index,page]=batch[i];
  if(result.status==='rejected'){failed.push([index,page]);continue;}
  for(const job of result.value.jobs)if(!jobs.some(existing=>sameJob(existing,job)))jobs.push(job);
  if(result.value.more)queue.push([index,page+1]);
 }
 // Keep failed work retryable, and rotate successful queries so several countries surface early.
 queue.unshift(...failed);
 return {jobs,nextSearch:cursorFor(queue),partial:failed.length>0,searchQueries:batch.map(([index,page])=>({...plan[index],page})),searchedCount:results.filter(r=>r.status==='fulfilled').reduce((n,r)=>n+r.value.jobs.length,0)};
}
