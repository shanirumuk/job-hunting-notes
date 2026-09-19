import {secret,seal,open,pairId,vaultId,fingerprint,counts,validateNotebook} from './device-crypto.js';
import {capture,getItem,setItem,installNotebook} from './device-store.js';
const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const summary=p=>{const c=counts(p);return `${c.applications} applications · ${c.pdfs} PDFs · ${c.drafts} drafts · ${c.swipes} swipe decisions`;};
export function startDeviceSync({state,applied,notify}){
 let busy=false,conflict=null,preview=null,timer,receiving=false;
 const dialog=document.getElementById('device-dialog'),content=document.getElementById('device-content'),status=document.getElementById('device-status');
 const say=s=>{status.textContent=s;};
 async function api(action,id,token,extra={}){const r=await fetch('/api/device',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},body:JSON.stringify({action,id,...extra})});const data=await r.json();if(!r.ok)throw Error(data.error||'Connection unavailable.');return data;}
 const owner=async()=>{const c=await getItem('connection');if(!c?.token)throw Error('Use your connected laptop to create a transfer.');return c.token;};
 async function current(){return capture(state);}
 async function install(pack,sync,expectedHash,updates=[]){await installNotebook(pack,{state,sync,expectedHash,updates});applied(pack);}
 function differences(a,b){const rows=[];for(const k of new Set([...Object.keys(a.profile),...Object.keys(b.profile)])){if(JSON.stringify(a.profile[k])!==JSON.stringify(b.profile[k]))rows.push(`Profile ${k}: ${a.profile[k]} → ${b.profile[k]}`);}for(const id of new Set([...a.entries.map(e=>e.id),...b.entries.map(e=>e.id)])){const x=a.entries.find(e=>e.id===id),y=b.entries.find(e=>e.id===id);if(JSON.stringify(x)!==JSON.stringify(y))rows.push(`${(x||y).company} — ${(x||y).title}: ${!x?'only on other device':!y?'only on this device':'application details or draft changed'}`);}for(const k of new Set([...Object.keys(a.cvs),...Object.keys(b.cvs)]))if(a.cvs[k]?.sha256!==b.cvs[k]?.sha256)rows.push(`${k} PDF changed`);if(JSON.stringify(a.discovery.decisions)!==JSON.stringify(b.discovery.decisions))rows.push('Swipe decisions differ');return '<ul>'+rows.map(r=>'<li>'+escape(r)+'</li>').join('')+'</ul>';}
 function show(){if(!dialog.open)dialog.showModal();}
 function home(){preview=null;receiving=false;content.innerHTML='<p>Start on the laptop with your complete notebook. Transfer includes your profile, applications, drafts, swipe history and original PDFs.</p><button class="primary-button" data-device="send">Send to another device</button><label>Private pairing code<input id="device-code" autocomplete="off" spellcheck="false" placeholder="Paste the code from your laptop"></label><button class="secondary-button" data-device="receive">Preview transfer</button><button class="secondary-button" data-device="sync">Sync now</button><button class="text-button" data-device="disconnect">Stop sync on this device</button><button class="text-button" data-device="recovery">Restore previous local copy</button><p class="small-note">Codes expire after 15 minutes and can pair one device. Keep the code private. Sync runs while this app is open and online. Conflicting changes require your choice.</p>';}
 async function send(){
  const token=await owner(),pack=await current(),baseline=await fingerprint(pack);
  let sync=await getItem('device-sync');
  if(sync){await check(true);if(conflict)throw Error('Resolve the conflicting edits before pairing another device.');sync=await getItem('device-sync');}
  if(!sync){const access=secret(),key=secret(),id=await vaultId(access);const result=await api('create',id,token,{access,encrypted:await seal(pack,key,'vault')});sync={id,access,key,etag:result.etag,baseline,active:false};await setItem('device-sync',sync);}
  const latest=await current(),code=secret(),id=await pairId(code);
  const latestHash=await fingerprint(latest);
  if(latestHash!==sync.baseline){const r=await api('write',sync.id,sync.access,{etag:sync.etag,encrypted:await seal(latest,sync.key,'vault')});sync={...sync,etag:r.etag,baseline:latestHash};await setItem('device-sync',sync);} 
  // Include the exact vault revision in the snapshot. Any later edits use normal conflict checks.
  const payload={notebook:latest,sync:{...sync,baseline:await fingerprint(latest),active:true}};
  await api('pair-create',id,token,{encrypted:await seal(payload,code,'transfer')});
  await setItem('device-sending',{id,created:Date.now()});
  content.innerHTML=`<p>${escape(summary(latest))}</p><p>On your phone, open this app → Transfer & sync → paste this code.</p><textarea id="device-share-code" readonly aria-label="Private pairing code">${code}</textarea><button class="primary-button" data-device="copy">Copy pairing code</button><p>Your laptop keeps everything. Waiting for the phone to confirm its saved files…</p>`;
  say('Pairing ready. Keep this code private.');
 }
 async function receive(code){
  code=code.trim();const id=await pairId(code); // open() also validates the complete encryption key.
  let pending=await getItem('device-receiving');
  if(pending?.id!==id){pending={id,code,receiver:secret()};await setItem('device-receiving',pending);}
  if(pending.imported){await acknowledge(pending);return;}
  const data=await api('pair-claim',id,pending.receiver);
  const payload=await open(data.encrypted,code,'transfer');await validateNotebook(payload.notebook);
  const s=payload.sync;if(!s||await vaultId(s.access)!==s.id||typeof s.key!=='string'||s.baseline!==await fingerprint(payload.notebook))throw Error('Invalid device connection.');
  preview={...pending,...payload,oldHash:await fingerprint(await current())};receiving=true;
  content.innerHTML=`<h3>Found on your laptop</h3><p><strong>${escape(summary(payload.notebook))}</strong></p><ul>${Object.values(payload.notebook.cvs).map(c=>`<li>${escape(c.name)}</li>`).join('')}</ul><p>This replaces the notebook on this phone. Its previous local copy is retained for recovery. The laptop is kept intact.</p><button class="primary-button" data-device="confirm">Confirm import & enable sync</button><button class="secondary-button" data-device="home">Cancel</button>`;
  say('Nothing has been imported yet. Review the counts and PDFs.');
 }
 async function acknowledge(p){await api('pair-confirm',p.id,p.receiver);const sync=await getItem('device-sync');await setItem('device-sync',{...sync,active:true});await setItem('device-receiving',undefined);receiving=false;home();say('Transfer verified and confirmed. This device is now synchronised.');}
 async function confirm(){const p=preview;if(!p)throw Error('Preview the transfer first.');
  const pending={id:p.id,code:p.code,receiver:p.receiver,imported:true};
  await install(p.notebook,{...p.sync,active:false},p.oldHash,[['device-receiving',pending]]);
  await acknowledge(p);
 }
 async function check(manual=false){
  if(receiving||conflict)return;
  const incoming=await getItem('device-receiving');
  if(incoming?.imported){await acknowledge(incoming);return;}
  const pending=await getItem('device-sending');let sync=await getItem('device-sync');
  if(pending){const result=await api('pair-status',pending.id,await owner());if(result.confirmed){await setItem('device-sending',undefined);sync={...sync,active:true};await setItem('device-sync',sync);say('Phone confirmed the complete transfer. Sync enabled.');}else if(result.expired){await setItem('device-sending',undefined);say('Pairing expired. Create a new code; your data is unchanged.');}}
  if(!sync?.active){if(manual)say('Pair a device first to enable sync.');return;}
  const local=await current(),localHash=await fingerprint(local),remote=await api('read',sync.id,sync.access,{etag:sync.etag});
  if(remote.unchanged){if(localHash!==sync.baseline){const written=await api('write',sync.id,sync.access,{etag:sync.etag,encrypted:await seal(local,sync.key,'vault')});await setItem('device-sync',{...sync,etag:written.etag,baseline:localHash});say('Changes encrypted and saved for your other device.');}else say('Both devices are up to date.');return;}
  const other=await validateNotebook(await open(remote.encrypted,sync.key,'vault')),otherHash=await fingerprint(other);
  if(localHash===otherHash){await setItem('device-sync',{...sync,etag:remote.etag,baseline:localHash});say('Both devices are up to date.');return;}
  if(localHash!==sync.baseline&&otherHash!==sync.baseline){conflict={local,localHash,other,remote,sync};show();content.innerHTML=`<h3>Both devices have changed</h3><p>This device: ${escape(summary(local))}</p><p>Other device: ${escape(summary(other))}</p>${differences(local,other)}<p>Choose which complete notebook to keep on both devices. The previous copy is retained for recovery.</p><button class="primary-button" data-device="keep">Keep this device on both</button><button class="secondary-button" data-device="other">Use the other device on both</button><button class="text-button" data-device="compare">Download both copies to compare</button>`;say('Sync paused until you resolve conflicting edits.');return;}
  if(localHash===sync.baseline){await install(other,{...sync,baseline:otherHash,etag:remote.etag},localHash);say('Changes from your other device saved and verified.');}
  else {const written=await api('write',sync.id,sync.access,{etag:remote.etag,encrypted:await seal(local,sync.key,'vault')});await setItem('device-sync',{...sync,etag:written.etag,baseline:localHash});say('Changes encrypted and saved for your other device.');}
 }
 async function resolve(keep){const c=conflict;if(!c)return;
  if(await fingerprint(await current())!==c.localHash){conflict=null;await check();return;}
  const latest=await api('read',c.sync.id,c.sync.access);if(latest.etag!==c.remote.etag){conflict=null;await check();return;}
  if(keep){await setItem('device-recovery',{before:c.other,previousSync:c.sync});const r=await api('write',c.sync.id,c.sync.access,{etag:c.remote.etag,encrypted:await seal(c.local,c.sync.key,'vault')});await setItem('device-sync',{...c.sync,etag:r.etag,baseline:c.localHash});}
  else await install(c.other,{...c.sync,etag:latest.etag,baseline:await fingerprint(c.other)},c.localHash);
  conflict=null;home();say('Conflict resolved. Sync resumed.');
 }
 async function run(fn){if(busy)return;busy=true;dialog.setAttribute('aria-busy','true');try{await navigator.locks.request('job-notebook-sync',fn);}catch(e){say(e.message);if(!dialog.open)notify('Device sync needs attention. Open Transfer & sync.');}finally{busy=false;dialog.removeAttribute('aria-busy');}}
 dialog.addEventListener('click',e=>{const action=e.target.closest('[data-device]')?.dataset.device;if(!action)return;run(async()=>{
  if(action==='send')await send();if(action==='receive')await receive(document.getElementById('device-code').value);
  if(action==='confirm')await confirm();if(action==='sync')await check(true);
  if(action==='keep'||action==='other')await resolve(action==='keep');
  if(action==='home')home();
  if(action==='copy'){await navigator.clipboard.writeText(document.getElementById('device-share-code').value);say('Private pairing code copied.');}
  if(action==='disconnect'){await setItem('device-sync',undefined);await setItem('device-sending',undefined);conflict=null;home();say('Sync stopped on this device. Local data is kept.');}
  if(action==='compare'&&conflict){const url=URL.createObjectURL(new Blob([JSON.stringify({thisDevice:conflict.local,otherDevice:conflict.other},null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='PRIVATE-notebook-conflict.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);say('Comparison downloaded privately to this device. It contains personal data and PDFs.');}
  if(action==='recovery'){const r=await getItem('device-recovery');if(!r)throw Error('No previous local copy is available.');if(!confirmRecovery(r))return;await install(r.before,undefined,await fingerprint(await current()));home();say('Previous copy restored. Sync stopped so it cannot overwrite your other device.');}
 });});
 function confirmRecovery(r){return window.confirm(`Restore ${summary(r.before)}? Sync will stop on this device.`);}
 document.getElementById('device-open').onclick=()=>{document.getElementById('backup-dialog').close();if(!conflict)home();show();};
 document.getElementById('device-close').onclick=()=>dialog.close();
 function schedule(){clearTimeout(timer);timer=setTimeout(()=>run(()=>check()),2000);}
 document.addEventListener('notebook-change',schedule);window.addEventListener('online',schedule);document.addEventListener('visibilitychange',()=>{if(!document.hidden)schedule();});
 setInterval(()=>{if(!document.hidden&&navigator.onLine)run(()=>check());},60000);
 setInterval(()=>{if(dialog.open&&!document.hidden&&!receiving)run(async()=>{if(await getItem('device-sending'))await check();});},5000);
 home();schedule();
 return {open:()=>{home();show();}};
}
