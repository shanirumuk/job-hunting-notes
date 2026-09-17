import {authorized,validateRequest} from '../server/access.js';
import {prepareInBrowser} from '../server/prepare.js';
export const config={maxDuration:300};
export default async function handler(req,res) {
  res.setHeader('Cache-Control','no-store');
  if(req.method!=='POST'){res.setHeader('Allow','POST');return res.status(405).json({error:'Use POST.'});}
  if(!authorized(req))return res.status(401).json({error:'Import your private connection setup in My profile first.'});
  if(!process.env.BROWSERBASE_API_KEY)return res.status(503).json({error:'Browser connection is not configured.'});
  let input;
  try{input=validateRequest(typeof req.body==='string'?JSON.parse(req.body):req.body);}catch(error){return res.status(400).json({error:error.name==='ZodError'?'Check your saved name, email and PDF (maximum 2.5 MB).':error.message});}
  res.setHeader('Content-Type','application/x-ndjson');res.setHeader('X-Content-Type-Options','nosniff');
  const controller=new AbortController();
  const emit=data=>{if(!res.destroyed&&!res.writableEnded)res.write(JSON.stringify(data)+'\n');};
  const heartbeat=setInterval(()=>emit({type:'heartbeat'}),10000);
  const deadline=setTimeout(()=>controller.abort(),270000);
  const close=()=>controller.abort();res.on('close',close);
  try {
    await prepareInBrowser(input,{emit,signal:controller.signal,reviewMilliseconds:180000});
    emit({type:'ended',message:'Browser session ended. Your notebook and CVs are still saved.'});
  } catch(error) {
    console.error('Browser preparation failure', {name:error.name,status:error.status,code:error.code,causeStatus:error.cause?.status,causeCode:error.cause?.code});
    // Do not return SDK errors: they can contain session capabilities or applicant text.
    if(!controller.signal.aborted)emit({type:'error',message:'This page could not be prepared. It may be unsupported, blocked, or your Browserbase allowance may be exhausted. Nothing was submitted. Use Open original to continue manually.'});
  } finally {
    clearInterval(heartbeat);clearTimeout(deadline);res.removeListener('close',close);if(!res.writableEnded)res.end();
  }
}
