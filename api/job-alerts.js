import {authorized} from '../server/access.js';
import {listingsFromAlert} from '../lib/job-alerts.js';
const id=value=>typeof value==='string'&&/^[a-z0-9_-]{1,100}$/i.test(value);
const email=value=>typeof value==='string'&&/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(value);
export function createJobAlertsHandler({fetcher=fetch,pause=ms=>new Promise(resolve=>setTimeout(resolve,ms)),settings=()=>({key:process.env.RESEND_API_KEY,address:process.env.JOB_NOTEBOOK_ALERT_EMAIL})}={}){
 return async(req,res)=>{
  res.setHeader('Cache-Control','no-store');
  if(req.method!=='POST')return res.status(405).json({error:'Use POST.'});
  if(!authorized(req))return res.status(401).json({error:'Connect your private device in My profile to read job alerts.'});
  const config=settings(),configured=!!config.key&&email(config.address);
  const body=req.body||{};
  if(body.action==='status')return res.json({configured,address:email(config.address)?config.address:'',provider:'resend'});
  if(body.action!=='list')return res.status(400).json({error:'Choose an alert operation.'});
  if(!configured)return res.status(503).json({error:'Email alerts need a receiving address and a server connection. Complete LinkedIn alerts setup in My profile.'});
  if(!Array.isArray(body.seen)||body.seen.length>500||body.seen.some(v=>!id(v))||(body.cursor!=null&&body.cursor!==''&&!id(body.cursor)))return res.status(400).json({error:'Invalid alert cursor.'});
  let requested=false;
  const request=async path=>{
   if(requested)await pause(600);requested=true;
   let r;try{r=await fetcher('https://api.resend.com'+path,{headers:{Authorization:'Bearer '+config.key},signal:AbortSignal.timeout(15000)});}catch{throw Error('The email receiver could not be reached. Retry later.');}
   if(r.status===401||r.status===403)throw Error('The email receiver needs a valid server API key with receiving access.');
   if(r.status===429)throw Error('The email receiver rate limit was reached. Retry later.');
   if(!r.ok)throw Error('The email receiver could not read this inbox. Retry later.');
   try{return await r.json();}catch{throw Error('The email receiver returned unreadable data.');}
  };
  try{
   const params=new URLSearchParams({limit:'20'});if(body.cursor)params.set('after',body.cursor);
   const page=await request('/emails/receiving?'+params);
   if(!Array.isArray(page.data)||typeof page.has_more!=='boolean')throw Error('The email receiver returned unreadable data.');
   const seen=new Set(body.seen),address=config.address.toLowerCase();
   const matches=page.data.filter(e=>e&&id(e.id)&&Array.isArray(e.to)&&e.to.some(to=>typeof to==='string'&&to.toLowerCase()===address)&&!seen.has(e.id));
   const selected=matches.slice(0,3),processed=[],links=[],errors=[];
   for(const item of selected){
    try{
     const message=await request('/emails/receiving/'+encodeURIComponent(item.id));
     if(!Array.isArray(message.to)||!message.to.some(to=>typeof to==='string'&&to.toLowerCase()===address))throw Error('This message was not sent to your alert address.');
     for(const listing of listingsFromAlert(message))if(!links.some(e=>e.url===listing.url))links.push({...listing,messageId:item.id,receivedAt:item.created_at||''});
     processed.push(item.id);
    }catch(error){errors.push(error.message);break;}
   }
   const remaining=matches.length>processed.length;
   const nextCursor=remaining?(body.cursor||''):(page.has_more&&id(page.data.at(-1)?.id)?page.data.at(-1).id:null);
   return res.json({links,processed,nextCursor,more:remaining||page.has_more,errors:[...new Set(errors)]});
  }catch(error){return res.status(503).json({error:error.message});}
 };
}
export default createJobAlertsHandler();
