import Browserbase from '@browserbasehq/sdk';
import {authorized,supportedURL} from '../server/access.js';
export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store');
 if(req.method!=='POST')return res.status(405).json({error:'Use POST.'});
 if(!authorized(req))return res.status(401).json({error:'Private connection required.'});
 let body;try{body=typeof req.body==='string'?JSON.parse(req.body):req.body;}catch{return res.status(400).json({error:'Invalid request.'});}
 const {sessionId,action,text}=body||{};
 if(!/^[0-9a-f-]{36}$/i.test(sessionId||'')||!['end','type','backspace','tab'].includes(action)||(action==='type'&&(typeof text!=='string'||!text||text.length>5000)))return res.status(400).json({error:'Invalid browser action.'});
 try{
  if(action==='end')await new Browserbase({apiKey:process.env.BROWSERBASE_API_KEY}).sessions.update(sessionId,{status:'REQUEST_RELEASE'});
  else await sendInput(sessionId,action,text);
  return res.status(200).json({ok:true});
 }catch{return res.status(502).json({error:'Browser action failed. The session may have ended.'});}
}
async function sendInput(sessionId,action,text){
 const url=new URL('wss://connect.browserbase.com');url.searchParams.set('apiKey',process.env.BROWSERBASE_API_KEY);url.searchParams.set('sessionId',sessionId);
 const socket=new WebSocket(url);let next=0;const pending=new Map();
 const timer=setTimeout(()=>{for(const item of pending.values())item.reject(new Error('Timeout'));socket.close();},15000);
 try{
  await new Promise((resolve,reject)=>{socket.addEventListener('open',resolve,{once:true});socket.addEventListener('error',()=>reject(new Error('Connection failed')),{once:true});socket.addEventListener('close',()=>reject(new Error('Connection closed')),{once:true});});
  socket.addEventListener('message',event=>{const response=JSON.parse(event.data);const item=pending.get(response.id);if(item){pending.delete(response.id);response.error?item.reject(new Error('Browser command failed')):item.resolve(response.result);}});
  socket.addEventListener('close',()=>{for(const item of pending.values())item.reject(new Error('Connection closed'));pending.clear();});
  const command=(method,params={},target)=>new Promise((resolve,reject)=>{const id=++next;pending.set(id,{resolve,reject});socket.send(JSON.stringify({id,method,params,...(target?{sessionId:target}:{})}));});
  const {targetInfos}=await command('Target.getTargets');
  const pages=targetInfos.filter(t=>t.type==='page');if(pages.length!==1)throw new Error('Select a single application tab');
  supportedURL(pages[0].url,{allowSource:false});
  const attached=await command('Target.attachToTarget',{targetId:pages[0].targetId,flatten:true});
  // Explicit user input only. Never synthesize Enter or click a submission button.
  if(action==='type')await command('Input.insertText',{text},attached.sessionId);
  else {const key=action==='tab'?'Tab':'Backspace';const code=action==='tab'?9:8;await command('Input.dispatchKeyEvent',{type:'keyDown',key,code:key,windowsVirtualKeyCode:code},attached.sessionId);await command('Input.dispatchKeyEvent',{type:'keyUp',key,code:key,windowsVirtualKeyCode:code},attached.sessionId);}
 }finally{clearTimeout(timer);socket.close();}
}
