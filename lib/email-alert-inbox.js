import {linkedInJobURL} from './job-alerts.js?v=88';
const KEY='job-notebook-email-alerts-v1',INTERVAL=10*60*1000;
export function mountEmailAlertInbox({getToken,hasCV,knownJobs,acceptJob,fetcher=fetch}){
 const $=id=>document.getElementById(id),status=$('email-alert-status');
 let state;try{state=JSON.parse(localStorage.getItem(KEY)||'null');}catch{}
 if(!state||!Array.isArray(state.seen)||!Array.isArray(state.queue))state={enabled:true,seen:[],queue:[],cursor:null,lastChecked:0,day:'',automaticReads:0};
 state.seen=state.seen.filter(id=>typeof id==='string').slice(-500);
 state.queue=state.queue.filter(e=>e&&linkedInJobURL(e.url)).slice(-500);
 // Re-read existing emails once to enrich legacy URL-only queue entries.
 if(state.hintVersion!==1){state.hintVersion=1;state.seen=[];state.cursor=null;state.lastChecked=0;for(const item of state.queue)item.attempts=0;}
 let busy=false,configured=false,address='',lastStatus=0;
 const save=()=>{localStorage.setItem(KEY,JSON.stringify(state));};
 const tell=message=>{status.textContent=message;};
 function render(){
  $('email-alert-enabled').checked=state.enabled;
  $('email-alert-address').textContent=address||'Not connected yet';
  $('email-alert-copy').hidden=!address;
  $('email-alert-check').disabled=busy||!configured||!getToken();
  $('email-alert-queue').textContent=state.queue.length?state.queue.length+' alert links waiting to be read.':'';
  const list=$('email-alert-unreadable');list.replaceChildren();
  for(const record of state.queue.filter(e=>e.attempts>=3).slice(0,5)){
   const row=document.createElement('p'),a=document.createElement('a');
   a.href=record.url;a.textContent='Open unreadable LinkedIn listing ↗';a.target='_blank';a.rel='noopener noreferrer';row.append(a);list.append(row);
  }
 }
 async function api(path,body){
  const token=getToken();if(!token)throw Error('Connect your private device in My profile first.');
  const r=await fetcher(path,{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},body:JSON.stringify(body),signal:AbortSignal.timeout(path==='/api/import-job'?75000:60000)});
  const data=await r.json();if(!r.ok)throw Error(data.error||'Job alerts could not be checked.');return data;
 }
 async function connectionChanged(){
  configured=false;
  if(!getToken()){address='';tell('Connect your private device to set up LinkedIn email alerts.');render();return;}
  try{
   const data=await api('/api/job-alerts',{action:'status'});configured=data.configured===true;address=data.address||'';lastStatus=Date.now();
   tell(configured?'Email receiver connected. Forward your LinkedIn job alerts to the address below.':'Email receiver not connected yet. Complete the Gmail setup below.');render();
   if(configured&&state.enabled&&!document.hidden)await check();
  }catch(error){tell(error.message);render();}
 }
 async function check(manual=false){
  if(busy||!getToken()||!state.enabled&&!manual)return;
  if(!configured){if(manual||Date.now()-lastStatus>INTERVAL)await connectionChanged();return;}
  if(!manual&&Date.now()-state.lastChecked<INTERVAL)return;
  busy=true;render();tell('Checking LinkedIn email alerts…');
  try{
   const data=await api('/api/job-alerts',{action:'list',seen:state.seen,cursor:state.cursor});
   if(!Array.isArray(data.links)||!Array.isArray(data.processed))throw Error('The email receiver returned unreadable data.');
   // Save links before marking their emails processed, so a reload cannot lose them.
   for(const link of data.links){const url=linkedInJobURL(link.url);if(!url||knownJobs().some(e=>linkedInJobURL(e.link)===url||linkedInJobURL(e.linkedInURL)===url))continue;
    const queued=state.queue.find(e=>e.url===url);if(queued){if(link.hint)queued.hint=link.hint;continue;}
    if(state.queue.length>=500)throw Error('Your alert queue is full. Review the waiting listings before checking more emails.');
    state.queue.push({...link,url,attempts:0});
   }
   state.seen=[...new Set([...state.seen,...data.processed])].slice(-500);state.cursor=data.nextCursor??null;state.lastChecked=Date.now();save();
   if(!hasCV()){tell('Alerts received. Upload your CVs to compare these listings.');return;}
   const day=new Date().toISOString().slice(0,10);if(state.day!==day){state.day=day;state.automaticReads=0;for(const item of state.queue)item.attempts=0;}
   let read=0,added=0,unreadable=0;
   if(manual)for(const item of state.queue)if(item.attempts>=3)item.attempts=0;
   for(const item of [...state.queue]){
    if(knownJobs().some(e=>linkedInJobURL(e.link)===item.url||linkedInJobURL(e.linkedInURL)===item.url)){state.queue=state.queue.filter(e=>e!==item);continue;}
    if(read>=3||!manual&&state.automaticReads>=12)break;
    if(item.attempts>=3)continue;
    // Persist an attempt before calling a paid reader; reloads retain the limit.
    item.attempts++;state.automaticReads+=manual?0:1;save();read++;
    try{
     const result=await api('/api/import-job',{url:item.url,...(item.hint?{hint:item.hint}:{})});
     if(!result.job?.id||!result.job?.description)throw Error('The full advert could not be read.');
     await acceptJob({...result.job,linkedInURL:item.url,alertReceivedAt:item.receivedAt,source:result.job.source+' · LinkedIn email alert'});
     state.queue=state.queue.filter(e=>e!==item);save();added++;
    }catch{unreadable++;}
   }
   save();
   tell((added?added+' adverts added for CV matching. ':'No new adverts read. ')+(unreadable?'Some employer adverts are not verified yet; waiting links will retry automatically. ':'')+(data.errors?.length?data.errors.join(' ')+' ':'')+(!manual&&state.automaticReads>=12?'Automatic reading paused after 12 attempts today and resumes tomorrow. ':'')+'Only matches above 6/10 appear in Discover.');
  }catch(error){tell(error.message);}finally{busy=false;render();}
 }
 $('email-alert-enabled').addEventListener('change',()=>{state.enabled=$('email-alert-enabled').checked;try{save();tell(state.enabled?'Automatic alerts enabled while this notebook is open.':'Automatic alerts paused on this browser.');if(state.enabled)check();}catch{tell('Could not save this setting on your device.');}});
 $('email-alert-check').addEventListener('click',()=>check(true));
 $('email-alert-copy').addEventListener('click',async()=>{try{await navigator.clipboard.writeText(address);tell('Forwarding address copied.');}catch{tell('Select and copy the address shown below.');}});
 setInterval(()=>{if(!document.hidden&&state.enabled)check();},INTERVAL);
 document.addEventListener('visibilitychange',()=>{if(!document.hidden&&state.enabled)check();});
 render();connectionChanged();
 return {connectionChanged,check};
}
