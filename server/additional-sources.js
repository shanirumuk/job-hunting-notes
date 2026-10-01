import {plainText,descriptionText,safeURL} from '../lib/model.js';
import {listingDate} from '../lib/listing-freshness.js';
export const employerBoards=[
 {slug:'Ashby',company:'Ashby'}, {slug:'linear',company:'Linear'},
 {slug:'supabase',company:'Supabase'}, {slug:'n8n',company:'n8n'},
 {slug:'lightspeedhq',company:'Lightspeed Commerce'}, {slug:'gt-hq',company:'GT'},
 {slug:'neara',company:'Neara'}, {slug:'choco',company:'Choco'}
];
async function json(url,fetcher){const response=await fetcher(url,{headers:{Accept:'application/json'},signal:AbortSignal.timeout(10000)});if(!response.ok)throw Error('Source unavailable');return response.json();}
export async function fetchRemoteOK(fetcher=fetch){
 const data=await json('https://remoteok.com/api',fetcher);if(!Array.isArray(data))throw Error('Invalid Remote OK response');
 // The first entry is feed metadata. Keep the original post URL for attribution.
 return data.filter(j=>j&&j.id&&typeof j.position==='string'&&typeof j.company==='string'&&safeURL(j.url)).map(j=>({
  id:'remoteok-'+j.id,title:plainText(j.position),company:plainText(j.company),location:plainText(j.location||'Location not stated'),remote:true,
  link:safeURL(j.url),description:descriptionText(j.description).slice(0,24000),publishedAt:listingDate(j.date)||listingDate(j.epoch),source:'Remote OK',fetchedAt:new Date().toISOString()
 }));
}
function location(row){
 const address=row.address?.postalAddress||row.address||{};
 const country=/^(?:US|USA|United States(?: of America)?)$/i.test(address.addressCountry||'')?'United States':address.addressCountry;
 // An explicit US address must not be widened to all of North America.
 const display=country==='United States'?null:row.location;
 return [...new Set([display,address.addressLocality,address.addressRegion,country].filter(v=>typeof v==='string'&&v.trim()).map(plainText))].join(', ');
}
export async function fetchEmployerBoard(board,fetcher=fetch){
 const data=await json('https://api.ashbyhq.com/posting-api/job-board/'+encodeURIComponent(board.slug)+'?includeCompensation=true',fetcher);
 if(!Array.isArray(data.jobs))throw Error('Invalid employer response');
 return data.jobs.filter(j=>j&&j.isListed===true&&j.id&&typeof j.title==='string'&&safeURL(j.jobUrl)).map(j=>{
  const locations=[location(j),...(Array.isArray(j.secondaryLocations)?j.secondaryLocations.filter(Boolean).map(location):[])].filter(Boolean);
  const salary=j.compensation?.compensationTierSummary||j.compensation?.scrapeableCompensationSalarySummary;
  return {id:'ashby-'+board.slug+'-'+j.id,company:board.company,title:plainText(j.title),location:[...new Set(locations)].join('; ')||'Location not stated',remote:j.isRemote===true||j.workplaceType==='Remote',
   link:safeURL(j.jobUrl),description:(descriptionText(j.descriptionHtml||j.descriptionPlain)+(salary?'\nCompensation: '+plainText(salary):'')).slice(0,24000),publishedAt:listingDate(j.publishedAt),source:'Employer careers · Ashby',employerBoard:board.slug,fetchedAt:new Date().toISOString()};
 });
}
const cache=new Map(),pending=new Map(),TTL=60*60*1000;
async function cached(key,fetcher){
 const old=cache.get(key);if(old&&Date.now()-old.time<TTL)return old.jobs;
 if(!pending.has(key))pending.set(key,fetcher().then(jobs=>{cache.set(key,{jobs,time:Date.now()});return jobs;}).finally(()=>pending.delete(key)));
 return pending.get(key);
}
export async function additionalSources(fetcher=fetch,{useCache=true}={}){
 const sources=[{name:'Remote OK',key:'remoteok',load:()=>fetchRemoteOK(fetcher)},...employerBoards.map(board=>({name:board.company+' careers',key:board.slug,board:board.slug,load:()=>fetchEmployerBoard(board,fetcher)}))];
 const results=await Promise.allSettled(sources.map(s=>useCache?cached(s.key,s.load):s.load()));
 const jobs=[],sourceErrors=[],refreshedEmployerBoards=[];
 for(const [i,result] of results.entries()){
  const source=sources[i];
  if(result.status==='rejected'){sourceErrors.push(source.name);continue;}
  if(source.board)refreshedEmployerBoards.push(source.board);
  // Avoid downloading hundreds of unrelated engineering and sales postings.
  jobs.push(...result.value.filter(j=>/analyst|implement|consult|success|operations|project|product|solutions|support|integration|delivery|business systems/i.test(j.title)));
 }
 return {jobs,sourceErrors,refreshedEmployerBoards};
}
