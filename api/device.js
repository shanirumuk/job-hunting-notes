import {get,put,BlobPreconditionFailedError} from '@vercel/blob';
import {createHash} from 'node:crypto';
import {authorized} from '../server/access.js';
const hash=s=>createHash('sha256').update(s).digest('hex');
const valid=s=>typeof s==='string'&&/^[\w-]{43}$/.test(s);
const envelope=e=>e?.version===1&&typeof e.iv==='string'&&e.iv.length===16&&typeof e.ciphertext==='string'&&e.ciphertext.length<=3500000;
export function createDeviceHandler(storage={get,put}){
 const {get:read,put}=storage;
 // Compressed HTTP responses have weak ETags that cannot be used for conditional writes.
 const get=(path,options)=>read(path,{...options,headers:{'Accept-Encoding':'identity'}});
 return async function handler(req,res){
 res.setHeader('Cache-Control','no-store');res.setHeader('Referrer-Policy','no-referrer');
 if(req.method!=='POST')return res.status(405).json({error:'Use POST.'});
 const b=req.body||{}, token=(req.headers.authorization||'').replace(/^Bearer /,'');
 if(typeof b.action!=='string')return res.status(400).json({error:'Missing operation.'});
 if(!/^[a-f0-9]{64}$/.test(b.id||''))return res.status(400).json({error:'Invalid connection.'});
 const path=`${b.action.startsWith('pair-')?'pairings':'notebooks'}/${b.id}.json`;
 try{
 if(b.action.startsWith('pair-')){
  if(b.action==='pair-create'){
   if(!authorized(req))return res.status(401).json({error:'Connect your laptop first.'});
   if(!envelope(b.encrypted))return res.status(400).json({error:'Invalid transfer.'});
   await put(path,JSON.stringify({encrypted:b.encrypted,expires:Date.now()+900000,receiver:null,confirmed:false}),{access:'private',addRandomSuffix:false});
   return res.json({ok:true});
  }
  const item=await get(path,{access:'private',useCache:false});
  if(!item)return res.status(404).json({error:'Pairing not found.'});
  const pair=await new Response(item.stream).json();
  if(b.action==='pair-status'){
   if(!authorized(req))return res.status(401).json({error:'Connect your laptop first.'});
   return res.json({confirmed:pair.confirmed,expired:pair.expires<Date.now()});
  }
  if(!valid(token))return res.status(401).json({error:'Invalid receiving device.'});
  if(pair.expires<Date.now()&&!pair.confirmed){if(pair.encrypted)await put(path,JSON.stringify({...pair,encrypted:null}),{access:'private',addRandomSuffix:false,allowOverwrite:true,ifMatch:item.blob.etag});return res.status(410).json({error:'Pairing expired. Create a new code on the laptop.'});}
  if(pair.receiver&&pair.receiver!==hash(token))return res.status(410).json({error:'Pairing code already used by another device.'});
  if(b.action==='pair-claim'){
   if(pair.confirmed)return res.status(410).json({error:'Pairing code already used.'});
   pair.receiver=hash(token);
  }else if(b.action==='pair-confirm'){
   if(pair.receiver!==hash(token))return res.status(403).json({error:'Claim this transfer first.'});
   pair.confirmed=true;pair.encrypted=null;
  }else return res.status(400).json({error:'Unknown pairing operation.'});
  await put(path,JSON.stringify(pair),{access:'private',addRandomSuffix:false,allowOverwrite:true,ifMatch:item.blob.etag});
  return res.json({encrypted:pair.encrypted,confirmed:pair.confirmed});
 }
 if(b.action==='create'){
  if(!authorized(req))return res.status(401).json({error:'Connect your laptop using its private CV setup first.'});
  if(!envelope(b.encrypted)||!valid(b.access)||hash('job-notebook-vault:'+b.access)!==b.id)return res.status(400).json({error:'Invalid notebook.'});
  const result=await put(path,JSON.stringify({encrypted:b.encrypted,claim:null}),{access:'private',addRandomSuffix:false,contentType:'application/json'});
  return res.json({etag:result.etag});
 }
 if(!valid(token)||hash('job-notebook-vault:'+token)!==b.id)return res.status(401).json({error:'Invalid private connection.'});
 const result=await get(path,{access:'private',useCache:false,...(b.action==='read'&&typeof b.etag==='string'?{ifNoneMatch:b.etag}:{})});
 if(result?.statusCode===304)return res.json({unchanged:true,etag:b.etag});
 if(!result)return res.status(404).json({error:'Connection no longer exists.'});
 const data=await new Response(result.stream).json(), etag=result.blob.etag;
 if(b.action==='read')return res.json({etag,...data});
 if(b.etag!==etag)return res.status(409).json({error:'Another device changed. Check again before continuing.'});
 if(b.action==='write'){
  if(!envelope(b.encrypted))return res.status(400).json({error:'Notebook is too large or invalid.'});data.encrypted=b.encrypted;
 }else return res.status(400).json({error:'Unknown operation.'});
 const written=await put(path,JSON.stringify(data),{access:'private',addRandomSuffix:false,allowOverwrite:true,ifMatch:etag,contentType:'application/json'});
 return res.json({etag:written.etag,...data});
 }catch(e){console.error('Device storage operation failed:',e.name,String(e.message).replace(/https?:\/\/\S+/g,'[storage URL]').replace(/[A-Za-z0-9_-]{32,}/g,'[redacted]'));return res.status(e instanceof BlobPreconditionFailedError||e.name==='BlobPreconditionFailedError'||e.name==='BlobAlreadyExistsError'?409:503).json({error:'Private storage changed or is unavailable. Your local notebook is safe; retry.'});}
}

}
export default createDeviceHandler();
