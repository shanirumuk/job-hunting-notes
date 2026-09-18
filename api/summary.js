import {authorized} from '../server/access.js';
import {summarizeJobs} from '../server/summarize.js';
import {createHash} from 'node:crypto';
import {z} from 'zod';
const input=z.object({title:z.string().min(1).max(500),location:z.string().max(500),description:z.string().min(50).max(24000)});
const cache=new Map();let pending=false;
export const config={maxDuration:120};
export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store');
 if(req.method!=='POST'){res.setHeader('Allow','POST');return res.status(405).json({error:'Use POST.'});}
 if(!authorized(req))return res.status(401).json({error:'Connect your private setup in My profile to generate summaries.'});
 let job;try{job=input.parse(typeof req.body==='string'?JSON.parse(req.body):req.body);}catch{return res.status(400).json({error:'A complete listing is needed.'});}
 const key=createHash('sha256').update(JSON.stringify(job)).digest('hex');
 if(cache.has(key))return res.status(200).json({summary:cache.get(key)});
 if(pending)return res.status(429).json({error:'Another summary is being prepared. Try again shortly.'});
 pending=true;
 try{const [summary]=await summarizeJobs([job]);cache.set(key,summary);if(cache.size>200)cache.delete(cache.keys().next().value);return res.status(200).json({summary});}
 catch(error){console.error('Summary unavailable',{name:error.name,status:error.status});return res.status(503).json({error:'Summary temporarily unavailable. Try again or open the original listing.'});}
 finally{pending=false;}
}
