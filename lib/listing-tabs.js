// Background tabs require the browser helper. Normal pages can only request focus.
export function backgroundTabsAvailable(){return document.documentElement.dataset.jobNotebookBackgroundTabs==='1';}
export function openListingTab(url,{background=false}={}){
 if(background&&backgroundTabsAvailable())return new Promise(resolve=>{
  const requestId=crypto.randomUUID();let timer;
  const finish=result=>{clearTimeout(timer);window.removeEventListener('message',receive);resolve(result);};
  const receive=event=>{
   if(event.source!==window||event.origin!==location.origin||event.data?.channel!=='job-notebook-tabs-result'||event.data.requestId!==requestId)return;
   finish({opened:event.data.opened===true,background:event.data.opened===true});
  };
  window.addEventListener('message',receive);
  timer=setTimeout(()=>finish({opened:false,background:false}),3000);
  window.postMessage({channel:'job-notebook-tabs-open',requestId,url},location.origin);
 });
 // Open synchronously during the gesture so popup blockers can recognize it.
 let tab;try{tab=window.open(url,'_blank');}catch{}
 if(tab){tab.opener=null;if(background){try{tab.blur();window.focus();}catch{}}}
 return Promise.resolve({opened:!!tab,background:false});
}
