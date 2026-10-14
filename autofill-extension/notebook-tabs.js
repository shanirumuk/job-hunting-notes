// This bridge runs only on Job Notebook, and only accepts a recent trusted gesture.
const origins=['https://job-hunting-notes.vercel.app','http://127.0.0.1:4190','http://localhost:4190'];
if(window===top&&origins.includes(location.origin)){
 let gestureAt=0;
 for(const name of ['pointerup','keydown','wheel'])window.addEventListener(name,event=>{if(event.isTrusted)gestureAt=Date.now();},{capture:true,passive:true});
 window.addEventListener('message',event=>{
  const message=event.data;
  if(event.source!==window||event.origin!==location.origin||message?.channel!=='job-notebook-tabs-open'||typeof message.requestId!=='string'||message.requestId.length>100)return;
  const reply=opened=>window.postMessage({channel:'job-notebook-tabs-result',requestId:message.requestId,opened},location.origin);
  if(!gestureAt||Date.now()-gestureAt>2000){reply(false);return;}gestureAt=0;
  chrome.runtime.sendMessage({channel:message.channel,url:message.url}).then(result=>reply(result?.opened===true),()=>reply(false));
 });
 document.documentElement.dataset.jobNotebookBackgroundTabs='1';
 document.dispatchEvent(new Event('job-notebook-helper-ready'));
}
