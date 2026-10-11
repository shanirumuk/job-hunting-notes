import {KEY,PROFILE_KEY,DISCOVERY_KEY,defaultProfile,validateEntries,validateProfile} from './model.js';
import {applicationsFromFragment,addLinkedApplication} from './application-link.js';
import {secret,secretBytes,pairId,open,fingerprint,validateNotebook} from './device-crypto.js';
import {capture,getItem,setItem,installNotebook} from './device-store.js';

const PREFIX='#restore-notebook=';
const FACTS=['name','email','phone','linkedin','languages','evidence','cvImportSources','workRights'];
const CV_FIELDS={consulting:'consultingCV',analyst:'analystCV',developer:'developerCV'};
const emptyDiscovery=()=>({jobs:[],decisions:{},fetchedAt:''});

// This recovery fills missing data. Existing applications, preferences, CVs
// and recruitment stages always take precedence over the recovery source.
export async function mergePrivateRecovery(current,payload){
 if(payload?.kind!=='job-notebook-private-recovery'||payload.version!==1)throw Error('Invalid private recovery. Your notebook is unchanged.');
 const source=await validateNotebook(payload.notebook);
 const incoming=applicationsFromFragment('#add-applications='+encodeURIComponent(JSON.stringify(source.entries)));
 if(!source.connection)throw Error('The recovery has no private connection.');
 await validateNotebook(current);
 const next=structuredClone(current);
 for(const entry of incoming)next.entries=addLinkedApplication(next.entries,entry).entries;
 for(const key of FACTS)if(!next.profile[key]?.trim()&&source.profile[key])next.profile[key]=source.profile[key];
 for(const [type,cv] of Object.entries(source.cvs))if(!next.cvs[type]){next.cvs[type]=cv;next.profile[CV_FIELDS[type]]=cv.name;}
 next.profile=validateProfile(next.profile);
 next.connection=source.connection;
 // Retry discovery with the restored connection, retaining saved adverts,
 // swipe decisions and listing highlights.
 next.discovery={...next.discovery,nextPage:1,nextSearch:null,fetchedAt:'',sourceErrors:[]};
 return validateNotebook(next);
}

export async function restorePrivateLink(){
 const fragment=location.hash;
 let code;
 if(fragment.startsWith(PREFIX)){
  code=fragment.slice(PREFIX.length);
  history.replaceState(null,'',location.pathname+location.search+'#notebook');
 }
 let pending=await getItem('private-recovery-pending');
 if(!code&&!pending)return null;
 try{
  if(code){
   secretBytes(code);
   const id=await pairId(code);
   if(await getItem('private-recovery-receipt:'+id))return {ok:true,message:'This recovery is already saved in this browser. Existing applications kept.'};
   if(pending?.id!==id){pending={id,code,receiver:secret()};await setItem('private-recovery-pending',pending);}
  }
  async function api(action){
   const r=await fetch('/api/device',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+pending.receiver},body:JSON.stringify({action,id:pending.id}),signal:AbortSignal.timeout(30000)});
   const data=await r.json();if(!r.ok)throw Error(data.error||'Private recovery could not connect.');return data;
  }
  if(!pending.imported){
   const data=await api('pair-claim');
   const payload=await open(data.encrypted,pending.code,'transfer');
   const state=()=>({entries:validateEntries(JSON.parse(localStorage.getItem(KEY)||'[]')),profile:validateProfile(JSON.parse(localStorage.getItem(PROFILE_KEY)||JSON.stringify(defaultProfile))),discovery:JSON.parse(localStorage.getItem(DISCOVERY_KEY)||JSON.stringify(emptyDiscovery()))});
   const current=await capture(state),next=await mergePrivateRecovery(current,payload);
   pending={...pending,imported:true};
   await installNotebook(next,{state,sync:await getItem('device-sync'),expectedHash:await fingerprint(current),updates:[['private-recovery-pending',pending]]});
  }
  try{
   await api('pair-confirm');
   await setItem('private-recovery-receipt:'+pending.id,{savedAt:Date.now()});
   await setItem('private-recovery-pending',undefined);
  }catch{
   return {ok:true,message:'Applications and missing CVs restored. Existing statuses kept. Reopen this page to finish confirming the private transfer.'};
  }
  return {ok:true,message:'Applications and missing CVs restored. Existing notes and rejection statuses kept. LinkedIn alerts connected.'};
 }catch(error){
  // Failed claims/validation never install anything. Clear an uninstalled
  // expired link so ordinary future visits can load normally.
  if(!pending?.imported)await setItem('private-recovery-pending',undefined);
  return {ok:false,message:'Recovery could not finish: '+error.message};
 }
}
