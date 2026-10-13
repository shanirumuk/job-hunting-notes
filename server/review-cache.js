import {createHash,createHmac} from 'node:crypto';
import {get,put} from '@vercel/blob';
import {REVIEW_VERSION} from '../lib/fit-review.js';
const fields=['evidence','languages','workRights','salaryTarget','motivation','workStyle','startDate','relocation'];
export const normalizedProfile=profile=>Object.fromEntries(fields.map(k=>[k,profile[k]||'']));
export const normalizedInput=input=>({job:{title:input.job.title,location:input.job.location||'',remote:!!input.job.remote,description:input.job.description},profile:normalizedProfile(input.profile)});
export const reviewHash=(input,now=Date.now())=>createHash('sha256').update(JSON.stringify([REVIEW_VERSION,new Date(now).toISOString().slice(0,7),normalizedInput(input)])).digest('hex');
export function createReviewCache({read=get,write=put,enabled=()=>!!process.env.BLOB_READ_WRITE_TOKEN,secret=()=>process.env.JOB_NOTEBOOK_ACCESS_TOKEN,now=Date.now}={}){
 const path=profile=>'review-cache/'+createHmac('sha256',secret()).update(JSON.stringify([REVIEW_VERSION,new Date(now()).toISOString().slice(0,7),normalizedProfile(profile)])).digest('hex')+'.json';
 async function bank(profile){
  const item=await read(path(profile),{access:'private',useCache:false,headers:{'Accept-Encoding':'identity'}});
  if(!item)return {entries:[],etag:null};
  const data=await new Response(item.stream).json();
  return {entries:(Array.isArray(data.entries)?data.entries:[]).filter(e=>e.review?.version===REVIEW_VERSION&&e.savedAt>now()-30*86400000),etag:item.blob.etag};
 }
 return {
  async find(input){if(!enabled())return null;try{return (await bank(input.profile)).entries.find(e=>e.hash===reviewHash(input,now()))?.review||null;}catch{return null;}},
  async list(profile){if(!enabled())return [];try{return (await bank(profile)).entries;}catch{return [];}},
  async save(input,review,listing){
   if(!enabled())return;
   const hash=reviewHash(input,now());
   for(let attempt=0;attempt<4;attempt++){
    const current=await bank(input.profile),entries=current.entries.filter(e=>e.hash!==hash);
    entries.push({hash,input:normalizedInput(input),review,listing,savedAt:now()});
    try{await write(path(input.profile),JSON.stringify({version:1,entries:entries.slice(-100)}),{access:'private',addRandomSuffix:false,contentType:'application/json',...(current.etag?{allowOverwrite:true,ifMatch:current.etag}:{})});return;}
    catch(error){if(!['BlobPreconditionFailedError','BlobAlreadyExistsError'].includes(error.name)||attempt===3)throw error;}
   }
  }
 };
}
export const reviewCache=createReviewCache();
