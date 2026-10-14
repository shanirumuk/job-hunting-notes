function notebookOrigin(value){try{return ['https://job-hunting-notes.vercel.app','http://127.0.0.1:4190','http://localhost:4190'].includes(new URL(value).origin);}catch{return false;}}
function listingURL(value){try{if(typeof value!=='string'||value.length>4000)return null;const url=new URL(value);return ['https:','http:'].includes(url.protocol)&&!url.username&&!url.password?url.href:null;}catch{return null;}}
chrome.runtime.onMessage.addListener((message,sender,respond)=>{
 if(message?.channel!=='job-notebook-tabs-open')return;
 const url=listingURL(message.url);
 if(sender.frameId!==0||!sender.tab?.active||!notebookOrigin(sender.url)||!url){respond({opened:false});return;}
 // No openerTabId: employer pages cannot control the notebook through window.opener.
 chrome.tabs.create({url,active:false,windowId:sender.tab.windowId}).then(()=>respond({opened:true}),()=>respond({opened:false}));
 return true;
});
