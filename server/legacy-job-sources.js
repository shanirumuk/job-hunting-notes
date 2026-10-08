// Retained for existing source-adapter regression fixtures. Live discovery uses Firecrawl.
import {listingDate} from '../lib/listing-freshness.js';
import {plainText,safeURL,descriptionText} from '../lib/model.js';

export async function fetchRemoteJobs(fetcher=fetch){
 const response=await fetcher('https://remotive.com/api/remote-jobs',{signal:AbortSignal.timeout(12000),headers:{Accept:'application/json'}});
 if(!response.ok)throw new Error('Remotive unavailable');
 const data=await response.json();if(!Array.isArray(data.jobs))throw new Error('Invalid Remotive response');
 return data.jobs.filter(j=>j.id&&j.title&&j.company_name&&safeURL(j.url)).map(j=>({id:`remotive-${j.id}`,company:plainText(j.company_name),title:plainText(j.title),location:plainText(j.candidate_required_location||'Location not stated'),remote:true,link:safeURL(j.url),description:descriptionText(j.description).slice(0,23000)+(j.salary?'\nSalary: '+plainText(j.salary):''),publishedAt:listingDate(j.publication_date),source:'Remotive',fetchedAt:new Date().toISOString()}));
}

export async function fetchInternationalJobs(fetcher=fetch,geo=''){
 const response=await fetcher('https://jobicy.com/api/v2/remote-jobs?count=200'+(geo?'&geo='+encodeURIComponent(geo):''),{signal:AbortSignal.timeout(12000),headers:{Accept:'application/json'}});
 if(!response.ok)throw new Error('Jobicy unavailable');
 const data=await response.json();if(!Array.isArray(data.jobs))throw new Error('Invalid Jobicy response');
 return data.jobs.filter(j=>j&&j.id&&j.jobTitle&&j.companyName&&safeURL(j.url)).map(j=>({
  id:`jobicy-${j.id}`,company:plainText(j.companyName),title:plainText(j.jobTitle),location:plainText(j.jobGeo||'Location not stated'),remote:true,link:safeURL(j.url),
  description:descriptionText(j.jobDescription).slice(0,23000)+(j.salaryMin||j.salaryMax?'\nSalary: '+[j.salaryMin,j.salaryMax].filter(v=>v!=null).join('–')+' '+plainText(j.salaryCurrency||'')+' '+plainText(j.salaryPeriod||'period not stated'):''),
  publishedAt:listingDate(j.pubDate),source:'Jobicy',fetchedAt:new Date().toISOString()
 }));
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
 }).map(j=>({id:`arbeitnow-${j.slug}`,company:plainText(j.company_name),title:plainText(j.title),location:plainText(j.location||'Location not stated'),remote:!!j.remote,link:safeURL(j.url),description:descriptionText(j.description).slice(0,24000),publishedAt:listingDate(j.created_at),source:'Arbeitnow',fetchedAt:new Date().toISOString()}));
 return {jobs,fetchedAt:new Date().toISOString(),partial:failure>=0,retryPage:failure>=0?pages[failure]:null,nextPage:failure>=0?pages[failure]:endIndex>=0?null:start+3,source:'Arbeitnow'};
}
