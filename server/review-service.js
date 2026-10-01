import {browserbase} from '@browserbasehq/stagehand';
import Browserbase from '@browserbasehq/sdk';

export function reviewServiceError(error){
 if(error.serviceCode)return {status:error.status||503,code:error.serviceCode,error:error.message};
 if(error.status===402)return {status:402,code:'REVIEW_QUOTA_EXHAUSTED',error:'Full reviews are paused because the Browserbase allowance is exhausted. Restore the provider allowance or configure another review provider. Your saved CVs are unchanged.'};
 return null;
}

// Stagehand hides session-create HTTP errors. On failure only, ask the provider
// directly so a billing limit is distinguishable from an interrupted review.
// The diagnostic session contains no CV/job data and is released immediately.
export async function launchReviewBrowser(options,{launch=browserbase.launch,client=new Browserbase({apiKey:options.apiKey,maxRetries:0})}={}){
 try{return await launch(options);}
 catch(error){
  if(error.name!=='BrowserbaseSessionError')throw error;
  let session;
  try{session=await client.sessions.create({timeout:60,browserSettings:{recordSession:false,logSession:false}});}
  catch(cause){if(cause.status===402||cause.status===429||cause.status>=500)throw Object.assign(new Error('Review provider unavailable'),{status:cause.status});}
  finally{if(session)await client.sessions.update(session.id,{projectId:session.projectId,status:'REQUEST_RELEASE'}).catch(()=>{});}
  throw error;
 }
}
