import {createHash,createHmac} from 'node:crypto';
import {get,put,list as listBlobs} from '@vercel/blob';
import {REVIEW_VERSION,reviewClearsDiscovery} from '../lib/fit-review.js';
const fields=['evidence','languages','workRights','salaryTarget','motivation','workStyle','startDate','relocation'];
export const normalizedProfile=profile=>Object.fromEntries(fields.map(k=>[k,profile[k]||'']));
export const normalizedInput=input=>({job:{title:input.job.title,location:input.job.location||'',remote:!!input.job.remote,description:input.job.description},profile:normalizedProfile(input.profile)});
export const reviewHash=(input,now=Date.now())=>createHash('sha256').update(JSON.stringify([REVIEW_VERSION,new Date(now).toISOString().slice(0,7),normalizedInput(input)])).digest('hex');
const clears=review=>Array.isArray(review?.points)&&Array.isArray(review?.factors)&&reviewClearsDiscovery(review);
export function createReviewCache({read=get,write=put,enumerate=listBlobs,enabled=()=>!!process.env.BLOB_READ_WRITE_TOKEN,secret=()=>process.env.JOB_NOTEBOOK_ACCESS_TOKEN,now=Date.now}={}){
 const prefix=profile=>'review-cache/'+createHmac('sha256',secret()).update(JSON.stringify([REVIEW_VERSION,new Date(now()).toISOString().slice(0,7),normalizedProfile(profile)])).digest('hex');
 const current=entry=>entry?.review?.version===REVIEW_VERSION&&entry.savedAt>now()-30*86400000;
 async function load(path){
  const item=await read(path,{access:'private',useCache:false,headers:{'Accept-Encoding':'identity'}});
  return item?new Response(item.stream).json():null;
 }
 async function legacy(profile){return ((await load(prefix(profile)+'.json'))?.entries||[]).filter(current);}
 async function recent(profile,group){
  const blobs=[];let cursor;
  do{const page=await enumerate({prefix:prefix(profile)+'/'+group+'/',limit:1000,...(cursor?{cursor}:{})});blobs.push(...page.blobs);cursor=page.hasMore?page.cursor:null;}while(cursor);
  const latest=blobs.filter(b=>Date.parse(b.uploadedAt)>now()-30*86400000).sort((a,b)=>Date.parse(b.uploadedAt)-Date.parse(a.uploadedAt)).slice(0,20);
  const entries=[];
  // Bound private reads so a large checked bank does not delay ready matches.
  for(let i=0;i<latest.length;i+=5){const batch=await Promise.allSettled(latest.slice(i,i+5).map(b=>load(b.pathname)));for(const r of batch)if(r.status==='fulfilled'&&current(r.value))entries.push(r.value);}
  return entries;
 }
 return {
  async find(input){
   if(!enabled())return null;const hash=reviewHash(input,now());
   const results=await Promise.allSettled(['ready','checked'].map(group=>load(prefix(input.profile)+'/'+group+'/'+hash+'.json')));
   const entries=results.filter(r=>r.status==='fulfilled'&&current(r.value)).map(r=>r.value).sort((a,b)=>b.savedAt-a.savedAt);
   if(entries.length)return entries[0].review;
   try{return (await legacy(input.profile)).find(e=>e.hash===hash)?.review||null;}catch{return null;}
  },
  async list(profile){
   if(!enabled())return [];
   const results=await Promise.allSettled([legacy(profile),recent(profile,'ready'),recent(profile,'checked')]),entries=new Map();
   for(const result of results)if(result.status==='fulfilled')for(const entry of result.value){const old=entries.get(entry.hash);if(!old||entry.savedAt>=old.savedAt)entries.set(entry.hash,entry);}
   return [...entries.values()];
  },
  async save(input,review,listing){
   if(!enabled())return;
   const hash=reviewHash(input,now()),group=clears(review)?'ready':'checked';
   // Each comparison owns its file. Parallel serverless requests cannot replace
   // another completed review by writing an older copy of a shared bank.
   await write(prefix(input.profile)+'/'+group+'/'+hash+'.json',JSON.stringify({hash,review,listing,savedAt:now()}),{access:'private',addRandomSuffix:false,allowOverwrite:true,contentType:'application/json'});
  }
 };
}
export const reviewCache=createReviewCache();
