import {fetchJobs,fetchRemoteJobs,fetchInternationalJobs} from './legacy-job-sources.js';
import {additionalSources} from './additional-sources.js';
import {geographicMatch,locationInfo} from '../lib/geography.js';
import {isSeniorRole,experienceRequirement} from '../lib/experience-filter.js';
import {sameJob} from '../lib/model.js';
import {diverseAdverts} from '../lib/discovery-candidates.js';

const cache=new Map(),pending=new Map();
export async function publicJobFeeds(input,{fetcher=fetch,useCache=true}={}){
 const {region='international',country='',development=false,broad=false,months=null}=input;
 const skills=input.skills||[],key=JSON.stringify([region,country,development,broad,months,skills]),old=cache.get(key);
 if(useCache&&old&&Date.now()-old.time<15*60*1000)return old.value;
 const load=async()=>{
  const sources=[['Arbeitnow',()=>fetchJobs(fetcher)],['Remotive',()=>fetchRemoteJobs(fetcher)],['Jobicy',()=>fetchInternationalJobs(fetcher)],['Employer careers',()=>additionalSources(fetcher,{useCache,development})]];
  const results=await Promise.allSettled(sources.map(([,load])=>load()));
  const jobs=[],sourceErrors=[],refreshedEmployerBoards=[],sourcesChecked=[];
  for(const [i,result] of results.entries()){
   if(result.status==='rejected'){sourceErrors.push(sources[i][0]);continue;}
   sourcesChecked.push(sources[i][0]);const value=result.value;
   const rows=Array.isArray(value)?value:value.jobs;
   sourceErrors.push(...(value.sourceErrors||[]));refreshedEmployerBoards.push(...(value.refreshedEmployerBoards||[]));
   for(const job of rows){
    if(/\b(?:United States|USA|US)\b/i.test(job.location)&&!locationInfo(job).continents.length)continue;
    const role=/analyst|implement|consult|onboard|project|process|product|operations|integration|application|customer success/i.test(job.title)||development&&/developer|(?:software|front[ -]?end|back[ -]?end|full[ -]?stack) engineer/i.test(job.title);
    if(!role||!geographicMatch(job,{geography:region,country,includeBroadRemote:broad}).matches)continue;
    const minimum=experienceRequirement(job).minimum;
    if(months!==null&&minimum!==null&&minimum>months/12)continue;
    if(!jobs.some(other=>sameJob(other,job)))jobs.push(job);
   }
  }
  const patterns={javascript:/\b(?:JavaScript|TypeScript|React|Next[ .]?js|Node[ .]?js)\b/i,python:/\bPython\b/i,api:/\bAPIs?\b/i,sql:/\b(?:SQL|PostgreSQL|MySQL)\b/i,crm:/\bCRM\b/i,requirements:/requirements|business analysis/i,testing:/testing|automated tests?/i,workflows:/workflow|process improvement/i};
  const priority=job=>skills.reduce((n,key)=>n+(patterns[key]?.test(job.description||'')?(key===skills[0]?2:1):0),0);
  jobs.sort((a,b)=>Number(isSeniorRole(a))-Number(isSeniorRole(b))||priority(b)-priority(a));
  const value={jobs:diverseAdverts(jobs,100),sourceErrors,refreshedEmployerBoards,sourcesChecked,nextPage:null,nextSearch:'start',source:'Employer careers and public job feeds',fetchedAt:new Date().toISOString()};
  if(useCache&&(jobs.length||!sourceErrors.length)){cache.set(key,{time:Date.now(),value});if(cache.size>30)cache.delete(cache.keys().next().value);}
  return value;
 };
 if(!useCache)return load();
 if(!pending.has(key))pending.set(key,load().finally(()=>pending.delete(key)));
 return pending.get(key);
}
