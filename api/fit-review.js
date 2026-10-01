import {reviewServiceError} from '../server/review-service.js';
import {authorized} from '../server/access.js';
import {reviewInput,generateReview} from '../server/fit-review.js';
export const config={maxDuration:300};
export function createFitReviewHandler(generate=generateReview,now=Date.now){
 const pending=new Map();
 return async(req,res)=>{
  res.setHeader('Cache-Control','no-store');
  if(req.method!=='POST'){res.setHeader('Allow','POST');return res.status(405).json({error:'Use POST.'});}
  if(!authorized(req))return res.status(401).json({error:'Connect your private setup in My profile for a full CV review.'});
  let input;try{input=reviewInput.parse(typeof req.body==='string'?JSON.parse(req.body):req.body);}catch{return res.status(400).json({error:'Complete CV details and listing text are needed for a review.'});}
  // A terminated serverless request may never reach finally. Expire its slot
  // after the platform's maximum request lifetime rather than blocking forever.
  for(const [id,started] of pending)if(now()-started>=300000)pending.delete(id);
  if(pending.size>=2){res.setHeader('Retry-After','15');return res.status(429).json({error:'The review service is busy. Your review will retry shortly.'});}
  const id=Symbol();pending.set(id,now());
  try{return res.status(200).json({review:await generate(input)});}
  catch(error){const serviceError=reviewServiceError(error);if(serviceError)return res.status(serviceError.status).json(serviceError);console.error('Fit review unavailable',{name:error.name,status:error.status});return res.status(503).json({error:'The full review could not be completed. The quick check is still available; retry the review.'});}
  finally{pending.delete(id);}
 };
}
export default createFitReviewHandler();
