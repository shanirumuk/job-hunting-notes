import {mkdir,writeFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {prepareInBrowser} from '../server/prepare.js';
import {validateRequest,SITE} from '../server/access.js';
const env=process.env;
if(!env.BROWSERBASE_API_KEY)throw new Error('Set BROWSERBASE_API_KEY in the environment before running this smoke test.');
const controller=new AbortController();let sessionId,reviewed=false;
const input=validateRequest({url:SITE+'/practice-application.html',title:'Implementation Consultant',company:'Job Notebook Practice',demo:true,fields:{name:'Test Applicant',email:'test@example.org',phone:'+49 000000',linkedin:'https://www.linkedin.com/in/test-applicant'},cv:{name:'practice-cv.pdf',base64:Buffer.from('%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\n%%EOF').toString('base64')}});
try {
 await prepareInBrowser(input,{signal:controller.signal,recordDemo:true,reviewMilliseconds:45000,emit(event){
  if(event.type==='progress')console.log(event.message);
  if(event.type==='session'){sessionId=event.sessionId;console.log(event.replayUrl);}
  if(event.type==='review'){
    if(event.filled.length!==5||!event.cvAttached)throw new Error('Expected five contact fields and a CV attachment.');
    reviewed=true;console.log(JSON.stringify({fieldsFilled:event.filled,cvAttached:event.cvAttached,remaining:event.remaining,replayUrl:event.replayUrl}));
    const cdp=`wss://connect.browserbase.com?apiKey=${env.BROWSERBASE_API_KEY}&sessionId=${sessionId}`;
    const result=spawnSync('browse',['snapshot','--cdp',cdp,'--session','job-notebook-smoke','--compact'],{encoding:'utf8',timeout:25000,env:process.env});
    const output=((result.stdout||'')+(result.stderr||'')).split(env.BROWSERBASE_API_KEY).join('[REDACTED]').split(cdp).join('[PRIVATE CONNECTION]');
    console.log('Live practice form inspection:',output);
    spawnSync('browse',['stop','--session','job-notebook-smoke'],{encoding:'utf8',timeout:10000,env:process.env});
    controller.abort();
  }
 }});
 if(!reviewed)throw new Error('Did not reach review.');
 const result=spawnSync('browse',['cloud','sessions','list'],{encoding:'utf8',timeout:15000,env:process.env});
 const output=(result.stdout||'');const start=output.indexOf('[');const end=output.lastIndexOf(']');
 let sessions;try{sessions=JSON.parse(output.slice(start,end+1));}catch{throw new Error('Could not parse session verification.');}
 const session=sessions.find(s=>s.id===sessionId);if(!session)throw new Error('Created session not found.');
 console.log(JSON.stringify({verifiedSession:session.id,status:session.status}));
 await mkdir(new URL('../private/',import.meta.url),{recursive:true});
 await writeFile(new URL('../private/browserbase-smoke-result.json',import.meta.url),JSON.stringify({sessionId,status:session.status,reviewed}),{mode:0o600});
}catch(error){console.error(String(error.message).split(env.BROWSERBASE_API_KEY).join('[REDACTED]'));process.exitCode=1;}
