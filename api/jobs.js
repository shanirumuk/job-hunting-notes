import {searchJobs,validSearchCursor} from '../server/job-search.js';
import {regions,europeanCountries,sourceGeography} from '../lib/geography.js';
import {plainText,safeURL,descriptionText,sameJob} from '../lib/model.js';
const cache=new Map(),pending=new Map();
const TTL=60*60*1000;
let remoteCache,remotePending;
export async function fetchRemoteJobs(fetcher=fetch){
 const response=await fetcher('https://remotive.com/api/remote-jobs',{signal:AbortSignal.timeout(12000),headers:{Accept:'application/json'}});
 if(!response.ok)throw new Error('Remotive unavailable');
 const data=await response.json();if(!Array.isArray(data.jobs))throw new Error('Invalid Remotive response');
 return data.jobs.filter(j=>j.id&&j.title&&j.company_name&&safeURL(j.url)).map(j=>({id:`remotive-${j.id}`,company:plainText(j.company_name),title:plainText(j.title),location:plainText(j.candidate_required_location||'Location not stated'),remote:true,link:safeURL(j.url),description:descriptionText(j.description).slice(0,23000)+(j.salary?'\nSalary: '+plainText(j.salary):''),publishedAt:Number.isFinite(Date.parse(j.publication_date))?new Date(j.publication_date).toISOString():'',source:'Remotive',fetchedAt:new Date().toISOString()}));
}
async function remoteJobs(){
 if(remoteCache&&Date.now()-remoteCache.time<6*TTL)return remoteCache.jobs;
 remotePending ||= fetchRemoteJobs().then(jobs=>{remoteCache={jobs,time:Date.now()};return jobs;}).finally(()=>remotePending=null);
 return remotePending;
}
const internationalCache=new Map(),internationalPending=new Map();
export async function fetchInternationalJobs(fetcher=fetch,geo=''){
 const response=await fetcher('https://jobicy.com/api/v2/remote-jobs?count=200'+(geo?'&geo='+encodeURIComponent(geo):''),{signal:AbortSignal.timeout(12000),headers:{Accept:'application/json'}});
 if(!response.ok)throw new Error('Jobicy unavailable');
 const data=await response.json();if(!Array.isArray(data.jobs))throw new Error('Invalid Jobicy response');
 return data.jobs.filter(j=>j&&j.id&&j.jobTitle&&j.companyName&&safeURL(j.url)).map(j=>({
  id:`jobicy-${j.id}`,company:plainText(j.companyName),title:plainText(j.jobTitle),location:plainText(j.jobGeo||'Location not stated'),remote:true,link:safeURL(j.url),
  description:descriptionText(j.jobDescription).slice(0,23000)+(j.salaryMin||j.salaryMax?'\nSalary: '+[j.salaryMin,j.salaryMax].filter(v=>v!=null).join('–')+' '+plainText(j.salaryCurrency||'')+' '+plainText(j.salaryPeriod||'period not stated'):''),
  publishedAt:Number.isFinite(Date.parse(j.pubDate))?new Date(j.pubDate).toISOString():'',source:'Jobicy',fetchedAt:new Date().toISOString()
 }));
}
async function internationalJobs(geo=''){
 const old=internationalCache.get(geo);
 if(old&&Date.now()-old.time<6*TTL)return old.jobs;
 if(!internationalPending.has(geo))internationalPending.set(geo,fetchInternationalJobs(fetch,geo).then(jobs=>{internationalCache.set(geo,{jobs,time:Date.now()});return jobs;}).finally(()=>internationalPending.delete(geo)));
 return internationalPending.get(geo);
}
export async function fetchJobs(fetcher=fetch,start=1){
 const pages=[start,start+1,start+2];
 const results=await Promise.allSettled(pages.map(async page=>{
  const response=await fetcher(`https://www.arbeitnow.com/api/job-board-api?page=${page}`,{signal:AbortSignal.timeout(12000),headers:{Accept:'application/json'}});
  if(!response.ok)throw new Error('Source unavailable');
  const data=await response.json();if(!Array.isArray(data.data))throw new Error('Invalid source response');
  return {rows:data.data,end:!data.data.length||!data.links?.next};
 }));
 const success=results.filter(r=>r.status==='fulfilled');if(!success.length)throw new Error('Job source unavailable');
 const endIndex=results.findIndex(r=>r.status==='fulfilled'&&r.value.end);
 const last=endIndex<0?2:endIndex;
 const failure=results.findIndex((r,i)=>i<=last&&r.status==='rejected');
 const seen=new Set();
 const jobs=results.slice(0,last+1).filter(r=>r.status==='fulfilled').flatMap(r=>r.value.rows).filter(j=>{
  if(!j.slug||!j.title||!j.company_name||!safeURL(j.url)||seen.has(j.slug))return false;seen.add(j.slug);return true;
 }).map(j=>({id:`arbeitnow-${j.slug}`,company:plainText(j.company_name),title:plainText(j.title),location:plainText(j.location||'Location not stated'),remote:!!j.remote,link:safeURL(j.url),description:descriptionText(j.description).slice(0,24000),publishedAt:Number.isFinite(Number(j.created_at))&&Number(j.created_at)>0&&Number(j.created_at)<1e11?new Date(Number(j.created_at)*1000).toISOString():'',source:'Arbeitnow',fetchedAt:new Date().toISOString()}));
 return {jobs,fetchedAt:new Date().toISOString(),partial:failure>=0,retryPage:failure>=0?pages[failure]:null,nextPage:failure>=0?pages[failure]:endIndex>=0?null:start+3,source:'Arbeitnow'};
}
export default async function handler(req,res){
 if(req.method!=='GET'){res.setHeader('Allow','GET');return res.status(405).json({error:'Method not allowed'});}
 const params=new URL(req.url||'/api/jobs','https://local.invalid').searchParams;
 const region=params.get('region')||'international',country=params.get('country')||'';
 if(!Object.hasOwn(regions,region)||(country&&(region!=='europe'||!europeanCountries.some(c=>c.value===country))))return res.status(400).json({error:'Invalid location filter'});
 const searchCursor=params.get('search')||'start',searchOnly=params.get('searchOnly')==='1',broad=params.get('broad')==='1';
 if(searchCursor.length>16000||!validSearchCursor(searchCursor,region,country))return res.status(400).json({error:'Invalid search cursor'});
 const raw=params.get('page')||'1';
 if(!/^\d+$/.test(raw)||Number(raw)<1||Number(raw)>10000)return res.status(400).json({error:'Invalid page'});
 const page=Number(raw),key=`${region}:${country}:${page}:${searchOnly}:${broad}:${searchCursor}`,old=cache.get(key);
 const useMain=!searchOnly&&(region==='international'||region==='europe')&&(!country||country==='germany');
 try{
  if(!old||Date.now()-old.time>(old.data.partial?60000:TTL)){
   if(!pending.has(key))pending.set(key,(async()=>{
    const results=await Promise.allSettled([useMain?fetchJobs(fetch,page):Promise.resolve({jobs:[],nextPage:null,partial:false,fetchedAt:new Date().toISOString()}),page===1&&!searchOnly?remoteJobs():Promise.resolve([]),page===1&&!searchOnly?internationalJobs():Promise.resolve([]),page===1&&!searchOnly?internationalJobs(sourceGeography(region,country)):Promise.resolve([]),searchJobs({region,country,cursor:searchCursor,broad})]);
    const search=results[4];
    const [main,...extras]=results.slice(0,4);
    if(results.every(r=>r.status==='rejected')&&search.status==='rejected')throw new Error('Sources unavailable');
    if(main.status==='rejected'&&!extras.some(r=>r.status==='fulfilled'&&r.value.length)&&!(search.status==='fulfilled'&&search.value.jobs.length))throw new Error('Sources unavailable');
    const data=main.status==='fulfilled'?main.value:{jobs:[],nextPage:page,retryPage:page,partial:true,fetchedAt:new Date().toISOString()};
    data.sourceErrors=[];
    if(main.status==='rejected'||data.retryPage)data.sourceErrors.push('Arbeitnow');
    for(const [i,result] of extras.entries()){
     if(result.status==='rejected'){data.sourceErrors.push(['Remotive','Jobicy','Jobicy'][i]);data.partial=true;}
     else for(const job of result.value)if(!data.jobs.some(existing=>sameJob(existing,job)))data.jobs.push(job);
    }
    if(search.status==='fulfilled'){
     data.nextSearch=search.value.nextSearch;data.searchQueries=search.value.searchQueries;
     if(search.value.partial){data.sourceErrors.push('Himalayas');data.partial=true;}
     for(const job of search.value.jobs)if(!data.jobs.some(existing=>sameJob(existing,job)))data.jobs.push(job);
    }else{data.nextSearch=searchCursor==='done'?null:searchCursor;data.sourceErrors.push('Himalayas');data.partial=true;}
    data.sourceErrors=[...new Set(data.sourceErrors)];
    data.source=page===1?'Arbeitnow + Remotive + Jobicy + Himalayas':'Arbeitnow + Himalayas';
    cache.set(key,{time:Date.now(),data});if(cache.size>100)cache.delete(cache.keys().next().value);
   })().finally(()=>pending.delete(key)));
   await pending.get(key);
  }
  const data=cache.get(key).data;
  res.setHeader('Cache-Control',`public, s-maxage=${data.partial?60:3600}`);
  return res.status(200).json(data);
 }catch{
  res.setHeader('Cache-Control','no-store');
  if(old)return res.status(200).json({...old.data,stale:true});
  return res.status(503).json({error:'Job sources are temporarily unavailable. Your saved roles are safe; retry shortly.'});
 }
}
