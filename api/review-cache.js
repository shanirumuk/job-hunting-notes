import {authorized} from '../server/access.js';
import {reviewInput} from '../server/fit-review.js';
import {reviewCache} from '../server/review-cache.js';
import {reviewClearsDiscovery} from '../lib/fit-review.js';
export function createReviewCacheHandler(cache=reviewCache){return async(req,res)=>{
 res.setHeader('Cache-Control','no-store');
 if(req.method!=='POST')return res.status(405).json({error:'Use POST.'});
 if(!authorized(req))return res.status(401).json({error:'Connect your private device to load checked matches.'});
 let profile;try{profile=reviewInput.shape.profile.parse(req.body?.profile);}catch{return res.status(400).json({error:'Saved CV details are needed.'});}
 const saved=(await cache.list(profile)).filter(e=>e.listing).sort((a,b)=>Number(reviewClearsDiscovery(b.review))-Number(reviewClearsDiscovery(a.review))||b.savedAt-a.savedAt),records=[];let bytes=0;
 for(const e of saved){const item={hash:e.hash,job:e.listing,review:e.review,savedAt:e.savedAt},size=Buffer.byteLength(JSON.stringify(item));if(records.length>=20||bytes+size>1500000)continue;records.push(item);bytes+=size;}
 return res.json({records});
};}
export default createReviewCacheHandler();
