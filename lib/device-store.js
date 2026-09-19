import {KEY,PROFILE_KEY,DISCOVERY_KEY} from './model.js';
import {CV_TYPES,base64,bytes,digest,fingerprint,validateNotebook} from './device-crypto.js';
const DATA_KEYS=[KEY,PROFILE_KEY,DISCOVERY_KEY];
let database;
export function db(){return database ||= new Promise((resolve,reject)=>{const request=indexedDB.open('job-notebook-cvs',1);request.onupgradeneeded=()=>request.result.createObjectStore('files');request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});}
export async function getItem(key){const database=await db();return new Promise((resolve,reject)=>{const tx=database.transaction('files','readonly');const req=tx.objectStore('files').get(key);tx.oncomplete=()=>resolve(req.result);tx.onabort=tx.onerror=()=>reject(tx.error);});}
export async function transaction(updates){const database=await db();return new Promise((resolve,reject)=>{const tx=database.transaction('files','readwrite'),store=tx.objectStore('files');for(const [key,value] of updates)value===undefined?store.delete(key):store.put(value,key);tx.oncomplete=resolve;tx.onabort=tx.onerror=()=>reject(tx.error);});}
export const setItem=(key,value)=>transaction([[key,value]]);
export async function capture(state){
 const data=structuredClone(state());const cvs={};
 for(const type of CV_TYPES){const cv=await getItem(type);if(cv){const data=new Uint8Array(await cv.blob.arrayBuffer());cvs[type]={name:cv.name,base64:base64(data),sha256:await digest(data)};}}
 return validateNotebook({version:1,entries:data.entries,profile:data.profile,discovery:data.discovery,cvs,connection:await getItem('connection')||null});
}
const values=pack=>[JSON.stringify(pack.entries),JSON.stringify(pack.profile),JSON.stringify(pack.discovery)];
async function writeFiles(pack,extras=[]){const updates=CV_TYPES.map(type=>[type,pack.cvs[type]?{name:pack.cvs[type].name,blob:new Blob([bytes(pack.cvs[type].base64)],{type:'application/pdf'})}:undefined]);updates.push(['connection',pack.connection||undefined],...extras);await transaction(updates);}
function writeData(pack){const next=values(pack);for(let i=0;i<DATA_KEYS.length;i++)localStorage.setItem(DATA_KEYS[i],next[i]);}
async function restore(journal){
 // Remove the staged values first so quota failures cannot prevent restoring smaller originals.
 for(const key of DATA_KEYS)localStorage.removeItem(key);
 writeData(journal.before);await writeFiles(journal.before,[['device-sync',journal.previousSync],['device-import-journal',undefined]]);
}
export async function recoverImport(){return navigator.locks.request('job-notebook-device-import',async()=>{const journal=await getItem('device-import-journal');if(journal)await restore(journal);localStorage.removeItem('job-notebook-importing');return !!journal;});}
export async function installNotebook(pack,{state,sync,expectedHash,updates=[]}={}){
 await validateNotebook(pack);
 return navigator.locks.request('job-notebook-device-import',async()=>{
  const before=await capture(state);
  if(expectedHash&&await fingerprint(before)!==expectedHash)throw Error('This device changed while you were reviewing. Review the transfer again.');
  const journal={before,previousSync:await getItem('device-sync')};
  // The journal is durable before any existing CV or localStorage record changes.
  await setItem('device-import-journal',journal);
  localStorage.setItem('job-notebook-importing','1');
  try{
   await writeFiles(pack);writeData(pack);
   const reread=await capture(()=>({entries:JSON.parse(localStorage.getItem(KEY)),profile:JSON.parse(localStorage.getItem(PROFILE_KEY)),discovery:JSON.parse(localStorage.getItem(DISCOVERY_KEY))}));
   if(await fingerprint(reread)!==await fingerprint(pack))throw Error('Saved data did not match the transferred notebook.');
   await transaction([['device-recovery',journal],['device-sync',sync],['device-import-journal',undefined],...updates]);
  }catch(error){try{await restore(journal);}catch{throw Error('Import interrupted. Close and reopen the app to restore the recovery copy before continuing.');}throw error;}finally{localStorage.removeItem('job-notebook-importing');}
  try{localStorage.setItem('job-notebook-device-updated',String(Date.now()));}catch{}
 });
}
