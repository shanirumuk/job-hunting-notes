import {z} from 'zod';
export const OPENAI_REVIEW_MODEL='gpt-6-luna';
export function reviewProvider(selected){
 const provider=selected||process.env.JOB_NOTEBOOK_REVIEW_PROVIDER||(process.env.OPENAI_API_KEY?'openai':'browserbase');
 return {provider,model:provider==='openai'?OPENAI_REVIEW_MODEL:'anthropic/claude-sonnet-4-6',configured:!!(provider==='openai'?process.env.OPENAI_API_KEY:process.env.BROWSERBASE_API_KEY)};
}
const serviceError=(code,message,status=503)=>Object.assign(new Error(message),{serviceCode:code,status});
export async function extractStructured({instructions,input,schema,name='job_review',maxOutputTokens=16000,timeout=120000},{fetcher=fetch,apiKey=process.env.OPENAI_API_KEY}={}){
 if(!apiKey)throw serviceError('REVIEW_SETUP_REQUIRED','Add OPENAI_API_KEY to the production server settings to enable GPT-6 Luna reviews.');
 const jsonSchema=z.toJSONSchema(schema);delete jsonSchema.$schema;
 let response;try{response=await fetcher('https://api.openai.com/v1/responses',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${apiKey}`},body:JSON.stringify({model:OPENAI_REVIEW_MODEL,store:false,instructions,input,reasoning:{effort:'medium'},max_output_tokens:maxOutputTokens,text:{format:{type:'json_schema',name,strict:true,schema:jsonSchema}}}),signal:AbortSignal.timeout(timeout)});}catch{throw serviceError('REVIEW_PROVIDER_UNAVAILABLE','OpenAI is temporarily unreachable. Trying an available backup.');}
 const data=await response.json().catch(()=>({}));
 if(!response.ok){
  // Never expose provider messages: they can contain key/account fragments.
  if(['insufficient_quota','credit_balance_exhausted','billing_hard_limit_reached'].includes(data.error?.code)||response.status===402)throw serviceError('REVIEW_QUOTA_EXHAUSTED','OpenAI API credit or allowance is exhausted. Add API credit or check the account limit. Your saved CVs are unchanged.',402);
  if(response.status===401)throw serviceError('REVIEW_SETUP_REQUIRED','The OpenAI API key was not accepted. Check OPENAI_API_KEY in the production server settings.');
  if(response.status===403||response.status===404)throw serviceError('REVIEW_MODEL_UNAVAILABLE','This OpenAI project cannot access GPT-6 Luna. Check its model permissions.');
  if(response.status===429){
   // Keep diagnostic limits, never raw error text/account IDs/key fragments.
   const message=String(data.error?.message||'');
   const diagnostics={code:/^[a-z_]{1,60}$/.test(data.error?.code||'')?data.error.code:'unknown',limit:Number(message.match(/Limit[:\s]+([\d.]+)/i)?.[1])||null,requested:Number(message.match(/Requested[:\s]+([\d.]+)/i)?.[1])||null,unit:/tokens per min/i.test(message)?'tokens/min':/requests per min/i.test(message)?'requests/min':'unknown'};
   console.warn('OpenAI review rate limit',diagnostics);
   throw serviceError('REVIEW_BUSY','OpenAI is temporarily rate-limiting reviews. Retrying shortly.',429);
  }
  if(response.status<500)throw serviceError('REVIEW_REQUEST_INVALID','The review request was rejected. Check the server configuration.');
  throw serviceError('REVIEW_PROVIDER_UNAVAILABLE','OpenAI could not complete the request. Please retry shortly.');
 }
 if(data.status!=='completed')throw serviceError('REVIEW_INCOMPLETE','The review response was incomplete. Please retry.');
 const blocks=(data.output||[]).filter(item=>item.type==='message').flatMap(item=>item.content||[]);
 if(blocks.some(block=>block.type==='refusal'))throw serviceError('REVIEW_REFUSED','The review provider declined this comparison. The local checklist remains available.');
 const text=blocks.filter(block=>block.type==='output_text').map(block=>block.text).join('');
 let result;try{result=JSON.parse(text);}catch{throw serviceError('REVIEW_INCOMPLETE','The review response could not be read. Please retry.');}
 return schema.parse(result);
}
