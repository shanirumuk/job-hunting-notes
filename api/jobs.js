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
 const raw=new URL(req.url||'/api/jobs','https://local.invalid').searchParams.get('page')||'1';
 if(!/^\d+$/.test(raw)||Number(raw)<1||Number(raw)>10000)return res.status(400).json({error:'Invalid page'});
 const page=Number(raw),old=cache.get(page);
 try{
  if(!old||Date.now()-old.time>(old.data.partial?60000:TTL)){
   if(!pending.has(page))pending.set(page,(async()=>{
    const [main,remote]=await Promise.allSettled([fetchJobs(fetch,page),page===1?remoteJobs():Promise.resolve([])]);
    if(main.status==='rejected'&&(remote.status==='rejected'||!remote.value.length))throw new Error('Sources unavailable');
    const data=main.status==='fulfilled'?main.value:{jobs:[],nextPage:1,retryPage:1,partial:true,fetchedAt:new Date().toISOString()};
    data.sourceErrors=[];
    if(main.status==='rejected')data.sourceErrors.push('Arbeitnow');
    if(remote.status==='rejected'){data.sourceErrors.push('Remotive');data.partial=true;}
    else for(const job of remote.value)if(!data.jobs.some(existing=>sameJob(existing,job)))data.jobs.push(job);
    data.source=page===1?'Arbeitnow + Remotive':'Arbeitnow';
    cache.set(page,{time:Date.now(),data});if(cache.size>100)cache.delete(cache.keys().next().value);
   })().finally(()=>pending.delete(page)));
   await pending.get(page);
  }
  const data=cache.get(page).data;
  res.setHeader('Cache-Control',`public, s-maxage=${data.partial?60:3600}`);
  return res.status(200).json(data);
 }catch{
  res.setHeader('Cache-Control','no-store');
  if(old)return res.status(200).json({...old.data,stale:true});
  return res.status(503).json({error:'Job sources are temporarily unavailable. Your saved roles are safe; retry shortly.'});
 }
}
