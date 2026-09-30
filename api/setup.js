import {gunzipSync} from 'node:zlib';
import {authorized} from '../server/access.js';
export default function handler(req,res){
 res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');
 if(req.method!=='POST')return res.status(405).json({error:'Use POST.'});
 if(!authorized(req))return res.status(401).json({error:'Connect this device using your private setup first.'});
 if(req.body?.action==='profile-corrections'){
  try{return res.status(200).json({correction:JSON.parse(process.env.JOB_NOTEBOOK_PROFILE_CORRECTIONS||'null')});}
  catch{return res.status(500).json({error:'Profile corrections could not be loaded.'});}
 }
 if(!process.env.JOB_NOTEBOOK_CV_SETUP)return res.status(503).json({error:'Saved CVs are not configured.'});
 try{return res.status(200).json(JSON.parse(gunzipSync(Buffer.from(process.env.JOB_NOTEBOOK_CV_SETUP,'base64'),{maxOutputLength:2000000}).toString()));}
 catch{return res.status(500).json({error:'Saved CVs could not be loaded.'});}
}
