import {validateEntries,validateProfile,safeURL} from './model.js';
export const CV_TYPES=['consulting','analyst','developer'];
export const MAX_CIPHER=3500000;
const encoder=new TextEncoder();
export function base64(bytes){let s='';for(let i=0;i<bytes.length;i+=8192)s+=String.fromCharCode(...bytes.subarray(i,i+8192));return btoa(s);}
export function bytes(value){return Uint8Array.from(atob(value),c=>c.charCodeAt(0));}
export function secret(){return base64(crypto.getRandomValues(new Uint8Array(32))).replaceAll('+','-').replaceAll('/','_').replaceAll('=','');}
export function secretBytes(value){if(!/^[A-Za-z0-9_-]{43}$/.test(value))throw Error('Use the complete private pairing code.');return bytes(value.replaceAll('-','+').replaceAll('_','/')+'=');}
export async function digest(value){const data=typeof value==='string'?encoder.encode(value):value;return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',data)),b=>b.toString(16).padStart(2,'0')).join('');}
export const pairId=key=>digest('job-notebook-pair:'+key);
export const vaultId=key=>digest('job-notebook-vault:'+key);
export function canonical(value){if(Array.isArray(value))return '['+value.map(canonical).join(',')+']';if(value&&typeof value==='object')return '{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+canonical(value[k])).join(',')+'}';return JSON.stringify(value);}
export const fingerprint=value=>digest(canonical(value));
async function limited(stream,max){const reader=stream.getReader();const chunks=[];let size=0;try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>max)throw Error('Notebook exceeds the transfer size limit.');chunks.push(value);}}finally{await reader.cancel();}const result=new Uint8Array(size);let pos=0;for(const c of chunks){result.set(c,pos);pos+=c.length;}return result;}
export async function seal(value,key,purpose){
 const plain=encoder.encode(canonical(value));if(plain.length>32000000)throw Error('Notebook exceeds the transfer size limit.');
 const compressed=await limited(new Blob([plain]).stream().pipeThrough(new CompressionStream('gzip')),2600000);
 const iv=crypto.getRandomValues(new Uint8Array(12));
 const cryptoKey=await crypto.subtle.importKey('raw',secretBytes(key),'AES-GCM',false,['encrypt']);
 const ciphertext=base64(new Uint8Array(await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:encoder.encode('job-notebook:'+purpose+':v1')},cryptoKey,compressed)));
 if(ciphertext.length>MAX_CIPHER)throw Error('This notebook is too large for transfer (about 2.5 MB compressed). No data was changed.');
 return {version:1,iv:base64(iv),ciphertext};
}
export async function open(envelope,key,purpose){
 if(envelope?.version!==1||typeof envelope.ciphertext!=='string'||envelope.ciphertext.length>MAX_CIPHER||typeof envelope.iv!=='string')throw Error('Invalid encrypted notebook.');
 try{
  const cryptoKey=await crypto.subtle.importKey('raw',secretBytes(key),'AES-GCM',false,['decrypt']);
  const compressed=await crypto.subtle.decrypt({name:'AES-GCM',iv:bytes(envelope.iv),additionalData:encoder.encode('job-notebook:'+purpose+':v1')},cryptoKey,bytes(envelope.ciphertext));
  const plain=await limited(new Blob([compressed]).stream().pipeThrough(new DecompressionStream('gzip')),32000000);
  return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(plain));
 }catch{throw Error('The code or encrypted notebook could not be verified. Nothing was imported.');}
}
export async function validateNotebook(value){
 if(value?.version!==1||!Array.isArray(value.entries)||!value.profile||!value.discovery||!value.cvs)throw Error('Incomplete notebook. Nothing was imported.');
 validateEntries(value.entries);validateProfile(value.profile);
 const d=value.discovery;
 if(!Array.isArray(d.jobs)||!d.decisions||typeof d.decisions!=='object'||Array.isArray(d.decisions))throw Error('Invalid swipe history.');
 if(d.jobs.some(j=>!j||typeof j.id!=='string'||typeof j.title!=='string'||typeof j.company!=='string'||!safeURL(j.link)))throw Error('Invalid job in the notebook.');
 if(Object.keys(value.cvs).some(k=>!CV_TYPES.includes(k)))throw Error('Unknown CV type.');
 for(const cv of Object.values(value.cvs)){
  if(!cv||typeof cv.name!=='string'||cv.name.length>512||typeof cv.base64!=='string'||cv.base64.length>14000000)throw Error('Invalid CV file.');
  const data=bytes(cv.base64);if(new TextDecoder().decode(data.subarray(0,5))!=='%PDF-'||await digest(data)!==cv.sha256)throw Error('A CV failed its integrity check.');
 }
 if(value.connection!==null&&(typeof value.connection?.token!=='string'||!/^[-\w]{40,100}$/.test(value.connection.token)))throw Error('Invalid private connection.');
 return value;
}
export function counts(value){return {applications:value.entries.length,drafts:value.entries.filter(e=>e.preparation).length,pdfs:Object.keys(value.cvs).length,swipes:Object.keys(value.discovery.decisions).length};}
