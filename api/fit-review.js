import {reviewServiceError} from '../server/review-service.js';
import {authorized} from '../server/access.js';
import {reviewInput,generateReview} from '../server/fit-review.js';
import {reviewCache,reviewHash} from '../server/review-cache.js';
import {z} from 'zod';
const listingSchema=z.object({id:z.string().max(300),company:z.string().max(300),link:z.string().url().max(4000).refine(v=>/^https?:\/\//.test(v)),source:z.string().max(100).optional(),publishedAt:z.string().max(100).optional(),employerBoard:z.string().max(100).optional(),availability:z.enum(['listed']).optional(),availabilityCheckedAt:z.string().max(100).optional()});
export const config={maxDuration:300};
export function createFitReviewHandler(generate=generateReview,now=Date.now,cache=reviewCache){
 const pending=new Map();
 return async(req,res)=>{
  res.setHeader('Cache-Control','no-store');
  if(req.method!=='POST'){res.setHeader('Allow','POST');return res.status(405).json({error:'Use POST.'});}
  if(!authorized(req))return res.status(401).json({error:'Connect your private setup in My profile for a full CV review.'});
  let input,purpose,listing;try{const body=typeof req.body==='string'?JSON.parse(req.body):req.body;input=reviewInput.parse(body);purpose=body.purpose==='discovery'?'discovery':'detail';const meta=listingSchema.safeParse(body.listing);if(meta.success)listing={...meta.data,...input.job};}catch{return res.status(400).json({error:'Complete CV details and listing text are needed for a review.'});}
  const cached=await cache.find(input);if(cached)return res.status(200).json({review:cached,cached:true});
  // A terminated serverless request may never reach finally. Expire its slot
  // after the platform's maximum request lifetime rather than blocking forever.
  for(const [id,value] of pending)if(now()-value.started>=300000)pending.delete(id);
  const id=reviewHash(input,now()),existing=pending.get(id);
  if(existing){try{return res.status(200).json({review:await existing.result,cached:true});}catch(error){const e=reviewServiceError(error);return res.status(e?.status||503).json(e||{error:'The full review could not finish. It will retry automatically.'});}}
  if(pending.size>=2){res.setHeader('Retry-After','15');return res.status(429).json({error:'The review service is busy. Your review will retry shortly.'});}
  const result=Promise.resolve().then(()=>generate(input,{purpose}));pending.set(id,{started:now(),result});
  try{const review=await result;await cache.save(input,review,listing).catch(()=>console.warn('Review cache write unavailable'));return res.status(200).json({review});}
  catch(error){const serviceError=reviewServiceError(error);if(serviceError)return res.status(serviceError.status).json(serviceError);console.error('Fit review unavailable',{name:error.name,status:error.status});return res.status(503).json({error:'The full review could not be completed. The quick check is still available; retry the review.'});}
  finally{if(pending.get(id)?.result===result)pending.delete(id);}
 };
}
export default createFitReviewHandler();
