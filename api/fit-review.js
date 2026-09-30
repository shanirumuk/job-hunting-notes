import {authorized} from '../server/access.js';
import {reviewInput,generateReview} from '../server/fit-review.js';
export const config={maxDuration:300};
export function createFitReviewHandler(generate=generateReview){
 let pending=0;
 return async(req,res)=>{
  res.setHeader('Cache-Control','no-store');
  if(req.method!=='POST'){res.setHeader('Allow','POST');return res.status(405).json({error:'Use POST.'});}
  if(!authorized(req))return res.status(401).json({error:'Connect your private setup in My profile for a full CV review.'});
  let input;try{input=reviewInput.parse(typeof req.body==='string'?JSON.parse(req.body):req.body);}catch{return res.status(400).json({error:'Complete CV details and listing text are needed for a review.'});}
  if(pending>=2)return res.status(429).json({error:'A review is already running. Try again shortly.'});
  pending++;
  try{return res.status(200).json({review:await generate(input)});}
  catch(error){console.error('Fit review unavailable',{name:error.name,status:error.status});return res.status(503).json({error:'The full review could not be completed. The quick check is still available; retry the review.'});}
  finally{pending--;}
 };
}
export default createFitReviewHandler();
