const KEY = 'job-notebook-v1';
const APPLICATION_STATUS_MIGRATION = 'job-notebook-applied-status-2026-09-15';
const seed = [
  {id:'deliverect', company:'Deliverect', title:'Implementation Consultant', location:'Berlin · Hybrid', status:'Applied', applicationDate:'2026-09-15', interviewDate:'', link:'https://jobs.lever.co/deliverect/a2a206c9-9ecf-4a24-8db9-32cc6d6a11b1/apply', materials:'Consulting CV PDF', requirements:'Strong fit: client implementation, onboarding, APIs/webhooks, troubleshooting, technical communication. Work-right question must be answered accurately for Germany.', notes:'Applied on 15 September 2026.'},
  {id:'allianz', company:'Allianz Technology', title:'Technical Business Analyst', location:'Barcelona · Hybrid', status:'Applied', applicationDate:'2026-09-15', interviewDate:'', link:'https://career5.successfactors.eu/careers?company=AZGROUPPROD&career_job_req_id=91937&career_ns=job_application', materials:'Business Analyst CV PDF', requirements:'Strong business-to-technology fit. Gap: contact-centre technology. Confirm Spanish work-authorisation pathway before investing heavily.', notes:'Applied on 15 September 2026.'},
  {id:'pointclickcare', company:'PointClickCare', title:'Software Implementation Consultant, Clinical', location:'Mississauga, Canada · Remote', status:'To apply', applicationDate:'', interviewDate:'', link:'https://jobs.lever.co/pointclickcare/6b7f5c7a-372b-4a4a-8187-b2c347157e14/apply', materials:'Consulting CV PDF', requirements:'Customer discovery, workflows, configuration, testing, training and change management. Canadian work-right/sponsorship is unconfirmed; includes up to 30% travel.', notes:'Apply only if no automatic sponsorship exclusion.'}
];
let entries = load();
let activeFilter = 'all';
const $ = (id) => document.getElementById(id);
const apps = $('applications');
const editor = $('editor-dialog');
const backup = $('backup-dialog');
const form = $('application-form');

function load(){ try { const saved = JSON.parse(localStorage.getItem(KEY)); return Array.isArray(saved) ? saved : seed; } catch { return seed; } }
function save(){ localStorage.setItem(KEY, JSON.stringify(entries)); }
function applyConfirmedStatuses(){
  if(localStorage.getItem(APPLICATION_STATUS_MIGRATION)) return;
  const confirmed = new Set(['deliverect','allianz']);
  entries = entries.map(entry => confirmed.has(entry.id) ? {...entry,status:'Applied',applicationDate:'2026-09-15',notes:`${entry.notes||''}${entry.notes?' ':''}Applied on 15 September 2026.`} : entry);
  save();
  localStorage.setItem(APPLICATION_STATUS_MIGRATION,'done');
}
function esc(value=''){ return String(value).replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c])); }
function dateText(value){ if(!value) return '—'; const [y,m,d]=value.split('-'); return `${d}.${m}.${y}`; }
function statusClass(status){ return `status-${status.toLowerCase().replace(/\s+/g,'-')}`; }
function visibleEntries(){ const q = $('search-input').value.trim().toLowerCase(); return entries.filter(e => (activeFilter === 'all' || e.status.toLowerCase() === activeFilter) && (!q || [e.company,e.title,e.location,e.notes,e.requirements].join(' ').toLowerCase().includes(q))); }
function render(){ const filtered = visibleEntries(); const applied = entries.filter(e=>e.status==='Applied').length; $('summary-text').textContent = `${entries.length} role${entries.length===1?'':'s'} · ${applied} applied`;
  apps.innerHTML = filtered.map(e=>`<button class="table-row" type="button" data-id="${esc(e.id)}" role="row" aria-label="Open ${esc(e.company)} ${esc(e.title)}"><span role="cell"><span class="role-title">${esc(e.title)}</span><span class="company-name">${esc(e.company)}</span></span><span role="cell"><span class="status-pill ${statusClass(e.status)}">${esc(e.status)}</span></span><span class="cell-muted" role="cell">${esc(e.location||'—')}</span><span class="cell-muted" role="cell">${dateText(e.applicationDate)}</span></button>`).join('');
  $('empty-state').hidden = filtered.length !== 0;
}
function openEditor(entry){ form.reset(); $('save-status').textContent = ''; $('delete-button').hidden = !entry; $('editor-title').textContent = entry ? 'Edit application' : 'Add application';
  const map={id:'entry-id',company:'company',title:'title',location:'location',status:'status',applicationDate:'application-date',interviewDate:'interview-date',link:'link',materials:'materials',requirements:'requirements',notes:'notes'};
  if(entry) Object.entries(map).forEach(([key,id])=>$(id).value=entry[key]||'');
  editor.showModal(); $('company').focus();
}
function closeEditor(){ editor.close(); }
function upsert(event){ event.preventDefault(); const value = id => $(id).value.trim(); const data={id:value('entry-id')||crypto.randomUUID(),company:value('company'),title:value('title'),location:value('location'),status:$('status').value,applicationDate:$('application-date').value,interviewDate:$('interview-date').value,link:value('link'),materials:value('materials'),requirements:value('requirements'),notes:value('notes')};
  const index=entries.findIndex(e=>e.id===data.id); if(index>=0) entries[index]=data; else entries.unshift(data); save(); $('save-status').textContent='Saved on this device'; render(); setTimeout(closeEditor,350);
}
function exportData(){ const blob=new Blob([JSON.stringify({version:1,exportedAt:new Date().toISOString(),entries},null,2)],{type:'application/json'}); const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download=`job-notebook-backup-${new Date().toISOString().slice(0,10)}.json`; a.click(); URL.revokeObjectURL(url); $('backup-message').textContent='Backup downloaded. Keep it somewhere private.'; }
function importData(file){ const reader=new FileReader(); reader.onload=()=>{try{const parsed=JSON.parse(reader.result);if(!Array.isArray(parsed.entries)) throw new Error(); entries=parsed.entries;save();render();$('backup-message').textContent='Backup restored successfully.';}catch{$('backup-message').textContent='That file is not a valid Job notebook backup.';}}; reader.readAsText(file); }
$('add-button').addEventListener('click',()=>openEditor()); $('empty-add-button').addEventListener('click',()=>openEditor()); $('close-editor').addEventListener('click',closeEditor); form.addEventListener('submit',upsert);
$('delete-button').addEventListener('click',()=>{const id=$('entry-id').value; entries=entries.filter(e=>e.id!==id);save();render();closeEditor();});
apps.addEventListener('click',e=>{const row=e.target.closest('[data-id]'); if(row)openEditor(entries.find(item=>item.id===row.dataset.id));});
$('search-input').addEventListener('input',render); document.querySelectorAll('.filter').forEach(button=>button.addEventListener('click',()=>{activeFilter=button.dataset.filter;document.querySelectorAll('.filter').forEach(b=>b.classList.toggle('active',b===button));render();}));
$('backup-button').addEventListener('click',()=>backup.showModal()); $('close-backup').addEventListener('click',()=>backup.close()); $('export-button').addEventListener('click',exportData); $('import-input').addEventListener('change',e=>{if(e.target.files[0])importData(e.target.files[0]);e.target.value='';});
if('serviceWorker' in navigator) window.addEventListener('load',()=>navigator.serviceWorker.register('service-worker.js'));
applyConfirmedStatuses();
render();
