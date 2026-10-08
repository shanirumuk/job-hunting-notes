import {reviewProvider} from './openai-review.js';

// Best-effort per-worker cooldowns; each serverless worker may probe once.
const cooldowns=new Map();
export function fallbackReason(error){
 if(error.serviceCode==='REVIEW_QUOTA_EXHAUSTED'||error.status===402)return 'allowance exhausted';
 if(error.serviceCode==='REVIEW_BUSY'||error.status===429)return 'temporarily busy';
 if(error.serviceCode==='REVIEW_PROVIDER_UNAVAILABLE'||error.status>=500||['TimeoutError','AbortError'].includes(error.name)||['ECONNRESET','ETIMEDOUT','ECONNREFUSED'].includes(error.cause?.code)){
  // Setup, refusals, invalid outputs and evidence validation are not outages.
  if(error.serviceCode&&!['REVIEW_PROVIDER_UNAVAILABLE'].includes(error.serviceCode))return null;
  return 'temporarily unavailable';
 }
 return null;
}
export async function withProviderFallback(run,{budgetMs=270000,primaryShare=.5,now=Date.now,state=cooldowns,providers}={}){
 const primary=reviewProvider();
 providers??=[primary,...['openai','browserbase'].filter(name=>name!==primary.provider).map(name=>reviewProvider(name)).filter(p=>p.configured)];
 const deadline=now()+budgetMs,failures=[];
 for(let i=0;i<providers.length;i++){
  const provider=providers[i],held=state.get(provider.provider);
  if(held&&held.until>now()){failures.push({provider:provider.provider,reason:held.reason});continue;}
  const remaining=deadline-now();
  if(remaining<5000)break;
  // Reserve time for a backup and cleanup. Extractors use this deadline for
  // each attempt, including a validation retry, rather than resetting it.
  const slots=providers.length-i;
  const share=i===0&&slots>1?Math.max(1/slots,Math.min(.85,primaryShare)):1/slots;
  const attemptDeadline=now()+Math.floor(remaining*share);
  try{
   const value=await run(provider,()=>{
    const left=attemptDeadline-now()-5000;
    if(left<1000)throw Object.assign(new Error('Review provider timed out.'),{serviceCode:'REVIEW_PROVIDER_UNAVAILABLE',status:503});
    return left;
   });
   state.delete(provider.provider);
   return {value,provider,fallback:failures.length?{from:failures[0].provider,reason:failures[0].reason}:null};
  }catch(error){
   const reason=fallbackReason(error);
   if(!reason)throw error;
   console.warn('Review provider fallback',{provider:provider.provider,code:error.serviceCode||error.name,status:error.status,reason});
   failures.push({provider:provider.provider,reason});
   state.set(provider.provider,{reason,until:now()+(reason==='allowance exhausted'?300000:30000)});
  }
 }
 const quota=failures.length&&failures.every(f=>f.reason==='allowance exhausted');
 const details=failures.map(f=>`${f.provider==='openai'?'OpenAI':'Browserbase'}: ${f.reason}`).join('; ');
 throw Object.assign(new Error(quota?'Full reviews are paused: all configured providers have exhausted their allowance. Add credit or restore an allowance, then retry. Your saved CVs are unchanged.':`No configured review provider is available right now. ${details}. Please retry shortly.`),{serviceCode:quota?'REVIEW_QUOTA_EXHAUSTED':'REVIEW_BUSY',status:quota?402:429});
}
