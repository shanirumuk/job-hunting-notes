import {experienceRequirement,experienceWithinLimit,isSeniorRole} from './lib/experience-filter.js';
import {listingFreshness} from './lib/listing-freshness.js';
import {mountListingHighlights,validHighlights} from './lib/listing-highlights.js';
import {applyProfileCorrections} from './lib/profile-corrections.js';
import {REVIEW_VERSION,reviewInsights,factorLabels,reviewClearsDiscovery} from './lib/fit-review.js';
import {parseCVJSON,mergeCVImports} from './lib/cv-json.js';
import {parseCVPDF} from './lib/cv-pdf.js';
import {cvSearchSkills,searchRoleGroups} from './lib/job-search-profile.js';
import {recordedEmploymentMonths} from './lib/insights.js';
import {regions,europeanCountries,geographicMatch,scopedLocation} from './lib/geography.js';
import {recoverImport,getItem as deviceItem,setItem as deviceSetItem} from './lib/device-store.js';
import {startDeviceSync} from './lib/device-sync.js';
await recoverImport();
import {publishedSummaries} from './lib/summaries.js';
import {roleInsights, jobFitReport, descriptionText, STATUSES, changeApplicationStatus, KEY, DISCOVERY_KEY, PROFILE_KEY, defaultProfile, safeURL, matchJob, sameJob, prepareApplication, validateEntries, validateProfile, cvKey, rankJobs, discoveryFit, discoveryDecision} from './lib/model.js?v=68';
const seed = [
  {id:'deliverect', company:'Deliverect', title:'Implementation Consultant', location:'Berlin · Hybrid', status:'Applied', applicationDate:'2026-09-15', interviewDate:'', link:'https://jobs.lever.co/deliverect/a2a206c9-9ecf-4a24-8db9-32cc6d6a11b1/apply', materials:'Consulting CV PDF', requirements:'Strong fit: client implementation, onboarding, APIs/webhooks, troubleshooting, technical communication. Work-right question must be answered accurately for Germany.', notes:'Applied on 15 September 2026.'},
  {id:'allianz', company:'Allianz Technology', title:'Technical Business Analyst', location:'Barcelona · Hybrid', status:'Applied', applicationDate:'2026-09-15', interviewDate:'', link:'https://career5.successfactors.eu/careers?company=AZGROUPPROD&career_job_req_id=91937&career_ns=job_application', materials:'Business Analyst CV PDF', requirements:'Strong business-to-technology fit. Gap: contact-centre technology. Confirm Spanish work-authorisation pathway before investing heavily.', notes:'Applied on 15 September 2026.'},
  {id:'pointclickcare', company:'PointClickCare', title:'Software Implementation Consultant, Clinical', location:'Mississauga, Canada · Remote', status:'To apply', applicationDate:'', interviewDate:'', link:'https://jobs.lever.co/pointclickcare/6b7f5c7a-372b-4a4a-8187-b2c347157e14/apply', materials:'Consulting CV PDF', requirements:'Customer discovery, workflows, configuration, testing, training and change management. Canadian work-right/sponsorship is unconfirmed; includes up to 30% travel.', notes:'Apply only if no automatic sponsorship exclusion.'}
];
const $ = id => document.getElementById(id);
const esc = (value = '') => String(value).replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
const today = () => {const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;};
const dateText = value => value ? new Date(`${String(value).slice(0,10)}T12:00:00`).toLocaleDateString(undefined,{day:'numeric',month:'short',year:'numeric'}) : 'Not set';
let storageError = false;
function read(key, fallback) {try {const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : structuredClone(fallback);} catch {storageError = true; return structuredClone(fallback);} }
let entries;
try {entries = validateEntries(read(KEY, seed));} catch {entries = structuredClone(seed); storageError = true;}
let profile;
try {profile = validateProfile(read(PROFILE_KEY, defaultProfile));} catch {profile = {...defaultProfile}; storageError = true;}
let discovery = read(DISCOVERY_KEY, {jobs: [], decisions: {}, fetchedAt: ''});
if (!discovery || !Array.isArray(discovery.jobs) || !discovery.decisions || typeof discovery.decisions !== 'object') {discovery = {jobs: [], decisions: {}, fetchedAt: ''}; storageError = true;}
let listingHighlights=null;
let activeFilter = 'all', activeView = 'discover', undoAction = null, preparationId = null, loading = false, toastTimer, selectedRole = null, decisionPending = false;
let pinnedJobId=null, feedError=false, autoBudget=12,feedController=null,feedRequestId=0;
if(!Object.hasOwn(discovery,'nextPage'))discovery.nextPage=discovery.fetchedAt?4:1;
feedError=!!discovery.sourceErrors?.length&&discovery.nextPage===null;
let matchCache = new WeakMap(), cachedProfile = profile;
const editor = $('editor-dialog'), backup = $('backup-dialog'), form = $('application-form');
function toast(message) {$('toast').textContent = message; $('toast').hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => $('toast').hidden = true, 5500);}
function persist(key, value) {
  try {if(localStorage.getItem('job-notebook-importing'))throw Error('Import in progress');localStorage.setItem(key, JSON.stringify(value));document.dispatchEvent(new Event('notebook-change')); return true;}
  catch {toast('Could not save on this device. Download a backup before closing this page.'); return false;}
}
function saveEntries() {return persist(KEY, entries);}
function saveDiscovery() {return persist(DISCOVERY_KEY, discovery);}
// Apply the requested wider search once; later explicit geography choices are retained.
try {
 const migration='job-notebook-international-v23';
 if(!localStorage.getItem(migration)&&!storageError){
  profile={...profile,geography:'international'};
  discovery.nextPage=1;discovery.nextSearch=null;discovery.fetchedAt='';
  if(persist(PROFILE_KEY,profile)&&saveDiscovery())localStorage.setItem(migration,'1');
 }
 if(!localStorage.getItem('job-notebook-firecrawl-v64')&&!storageError){
  discovery.jobs=[];discovery.nextPage=1;discovery.nextSearch=null;discovery.fetchedAt='';discovery.sourceErrors=[];
  if(saveDiscovery())localStorage.setItem('job-notebook-firecrawl-v64','1');
 }
 if(!localStorage.getItem('job-notebook-role-search-v67')&&!storageError){
  discovery.nextPage=1;discovery.nextSearch=null;discovery.fetchedAt='';
  if(saveDiscovery())localStorage.setItem('job-notebook-role-search-v67','1');
 }
 if(!localStorage.getItem('job-notebook-discovery-v26')&&!storageError){
  discovery.nextPage=1;discovery.nextSearch=null;discovery.fetchedAt='';discovery.sourceErrors=[];feedError=false;
  if(saveDiscovery())localStorage.setItem('job-notebook-discovery-v26','1');
 }
}catch{storageError=true;}
// Keep the original one-time status migration, including its original storage marker.
try {
  const migration = 'job-notebook-applied-status-2026-09-15';
  if (!localStorage.getItem(migration) && !storageError) {
    entries = entries.map(e => ['deliverect','allianz'].includes(e.id) && e.status === 'To apply' ? {...e, status: 'Applied', applicationDate: '2026-09-15'} : e);
    if (saveEntries()) localStorage.setItem(migration, 'done');
  }
} catch {storageError = true;}
function setView(view) {
  const changedProfile=readSavedProfile();
  if (!['discover','notebook','profile'].includes(view)) view = 'discover';
  activeView = view;
  document.body.dataset.view = view;
  window.scrollTo(0, 0);
  $('main-content').scrollTop = 0;
  document.querySelectorAll('.view').forEach(el => el.hidden = el.id !== `${view}-view`);
  document.querySelectorAll('.nav-button').forEach(el => {el.classList.toggle('active',el.dataset.view === view); if (el.dataset.view === view) el.setAttribute('aria-current','page'); else el.removeAttribute('aria-current');});
  if (view === 'profile') populateProfile();
  if(changedProfile)render();
  if(view==='discover')maybeLoadMore(deckJobs().length);
  history.replaceState(null, '', `#${view}`);
}
function followUpDue(entry) {return ['Applied','Interview','Offer'].includes(entry.status) && /^\d{4}-\d{2}-\d{2}$/.test(entry.followUpDate||'') && entry.followUpDate<=today();}
function render() {
  const applied = entries.filter(e => ['Applied','Interview','Offer'].includes(e.status)).length;
  $('nav-count').textContent = entries.length;
  for (const [id,status] of Object.entries({saved:'To apply',preparing:'Preparing'})) {
    $('progress-'+id).textContent = entries.filter(e => e.status === status).length;
  }
  $('progress-follow-up').textContent = entries.filter(followUpDue).length;
  $('summary-text').textContent = `${entries.length} roles · ${applied} submitted`;
  $('compass-location').textContent = '◎ '+scopeLabel();
  const filterCount=['geography','country','includeConditional','hideSeniorRoles','includeBroadRemote','includeOlderListings'].filter(key=>profile[key]!==defaultProfile[key]).length;
  $('location-filter').textContent='Filters'+(filterCount?' · '+filterCount:'')+' ▾';
  $('profile-search-filters').textContent=scopeLabel()+' · Edit filters →';
  $('location-filter').title='Search filters · '+scopeLabel();
  const cvFit=discoveryFit({title:'Business Analyst',description:''},profile);
  $('experience-filter').textContent='CV match > 6/10 · How it works';
  $('compass-cv').textContent=cvFit.months!==null?'Dated CV history: '+(cvFit.months/12).toFixed(1)+' years':'Add dated CV details for experience checks';
  $('search-role-areas').innerHTML=searchRoleGroups.map(group=>`<span>${esc(group.label)}</span>`).join('');
  const q = $('search-input').value.trim().toLowerCase();
  const filtered = entries.filter(e => (activeFilter === 'all' || (activeFilter === 'follow-up' ? followUpDue(e) : e.status.toLowerCase() === activeFilter)) && (!q || [e.company,e.title,e.location,e.notes,e.requirements].join(' ').toLowerCase().includes(q)));
  if(activeFilter==='follow-up')filtered.sort((a,b)=>a.followUpDate.localeCompare(b.followUpDate));
  $('applications').innerHTML = filtered.map(e => `<article class="application-item"><div><span class="company-name">${esc(e.company)}</span><h2>${esc(e.title)}</h2><p>${esc(e.location)}${e.applicationDate ? ' · Applied '+esc(dateText(e.applicationDate)) : ''}</p>${e.followUpDate?`<p class="follow-up-note">Follow-up: ${esc(dateText(e.followUpDate))}${followUpDue(e)?' · Due':''}</p>`:''}</div><div class="application-actions"><label class="application-status-control status-${esc(e.status.toLowerCase().replaceAll(' ','-'))}"><span class="sr-only">Status</span><select data-status-id="${esc(e.id)}" aria-label="Status for ${esc(e.company)} — ${esc(e.title)}">${STATUSES.map(status=>`<option value="${esc(status)}" ${status===e.status?'selected':''}>${status==='To apply'?'Saved':esc(status)}</option>`).join('')}<option value="delete">Delete…</option></select><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m7 10 5 5 5-5" /></svg></label><div class="application-action-links"><button class="text-button" data-edit="${esc(e.id)}">Edit notes</button>${e.description||e.requirements?`<button class="text-button" data-fit-entry="${esc(e.id)}">Review fit</button>`:''}${safeURL(e.link) ? `<a class="text-button" href="${esc(safeURL(e.link))}" target="_blank" rel="noopener noreferrer">Listing ↗</a>` : ''}</div></div></article>`).join('');
  $('empty-state').hidden = filtered.length > 0;
  $('empty-state').querySelector('h2').textContent=activeFilter==='follow-up'?'No follow-ups due':'No applications here yet';
  $('empty-state').querySelector('p').textContent=activeFilter==='follow-up'?'Set a follow-up date using Edit notes on a submitted application.':'Save a role from Discover, or add one yourself.';
  $('empty-add-button').hidden=activeFilter==='follow-up';
  renderDeck();
}
function scopeLabel(){return profile.country?europeanCountries.find(c=>c.value===profile.country)?.label:profile.geography==='international'?'International · excluding the US':profile.geography==='europe'?'Across Europe':regions[profile.geography];}
function restartDiscovery(){
 feedController?.abort();feedRequestId++;loading=false;
 pinnedJobId=null;candidateReviewBudget=6;autoBudget=12;feedError=false;discovery.nextPage=1;discovery.nextSearch=null;discovery.sourceErrors=[];discovery.fetchedAt='';
 saveDiscovery();render();refreshJobs();
}
function openLocations(showRules=false){
 $('filter-region').innerHTML=Object.entries(regions).map(([value,label])=>`<option value="${value}">${esc(label)}</option>`).join('');
 $('filter-country').innerHTML='<option value="">All European countries</option>'+europeanCountries.map(c=>`<option value="${c.value}">${esc(c.label)}</option>`).join('');
 $('filter-broad-remote').checked=profile.includeBroadRemote;
 $('filter-older-listings').checked=profile.includeOlderListings;
 const months=recordedEmploymentMonths(profile);
 $('filter-cv-experience').textContent=months===null?'Upload a CV with dated experience to check required years.':'CV matching: '+(months/12).toFixed(1)+' years of dated employment. Specialist experience is checked separately.';
 $('filter-conditional').checked=profile.includeConditional;
 $('filter-rules').open=showRules;
 $('filter-more').open=false;
 $('filter-hide-senior').checked=profile.hideSeniorRoles;
 $('filter-region').value=profile.geography;$('filter-country').value=profile.country;
 $('filter-country-group').hidden=profile.geography!=='europe';
 $('location-dialog').showModal();
}
function applyLocations(reset=false){
 const values=reset?Object.fromEntries(['geography','country','includeConditional','hideSeniorRoles','includeBroadRemote','includeOlderListings'].map(key=>[key,defaultProfile[key]])):{geography:$('filter-region').value,country:$('filter-country').value,includeConditional:$('filter-conditional').checked,hideSeniorRoles:$('filter-hide-senior').checked,includeOlderListings:$('filter-older-listings').checked,includeBroadRemote:$('filter-broad-remote').checked};
 const next=validateProfile({...profile,...values});
 if(!persist(PROFILE_KEY,next))return;
 profile=next;$('location-dialog').close();restartDiscovery();
}
function hasMoreJobs(){return !!(discovery.nextPage||discovery.nextSearch);}
function deckJobs() {
  if (cachedProfile !== profile) {matchCache = new WeakMap(); cachedProfile = profile;}
  const historical = entries.filter(e => e.status === 'To apply' && !e.preparation).map(e => ({...e, description: e.description||e.requirements, source: e.source||'Your notebook', historical: !e.description}));
  const all = [...discovery.jobs, ...historical];
  const result = [];
  const reviewed=Object.values(discovery.reviewed||{}).filter(j=>discovery.decisions[j.id]);
  for (const job of all) {
    if(!listingFreshness(job,{includeOlder:profile.includeOlderListings}).visible)continue;
    if(profile.hideSeniorRoles&&isSeniorRole(job))continue;
    if (discovery.decisions[job.id] || reviewed.some(j=>sameJob(j,job)) || result.some(j => sameJob(j,job))) continue;
    if (entries.some(e => sameJob(e,job) && (e.status !== 'To apply' || e.preparation))) continue;
    let match = matchCache.get(job);
    if (!match) {const fit=discoveryFit(job,profile);match = {...matchJob(job,profile),experience:experienceRequirement(job),cvFit:fit}; matchCache.set(job,match);}
    const reviewedFit=fullReview(job);
    const decision=discoveryDecision(job,profile,{review:reviewedFit,fit:match.cvFit,match});
    if(!decision.eligible)continue;
    // Previously saved roles remain accessible in the notebook even outside current search preferences.
    if (match.eligible) result.push({...job, match:{...match,skillsScore:decision.skillsScore,score:match.score+(decision.skillsScore??0)*2}});
  }
  const ranked=rankJobs(result);
  const pinned=ranked.findIndex(j=>j.id===pinnedJobId);if(pinned>0)ranked.unshift(...ranked.splice(pinned,1));
  return ranked;
}
const storedSummaries=read('job-notebook-summaries-v1',{});
const summaryCache=storedSummaries&&typeof storedSummaries==='object'&&!Array.isArray(storedSummaries)?storedSummaries:{};
const summaryErrors=new Map();
const summaryHashes=new Map();
let summaryBusy=false;
const summarySource=job=>JSON.stringify([job.title,job.location,job.description||'']);
function savedSummary(job){
 const source=summarySource(job);
 if(summaryCache[job.id]?.source===source)return summaryCache[job.id].summary;
 const published=publishedSummaries[job.id];
 return published?.sourceHash&&published.sourceHash===summaryHashes.get(source)?published.summary:null;
}
function listingExcerpt(job){
 const duties=roleInsights(job,profile).duties;
 const excerpt=(duties.length?duties.join(' '):descriptionText(job.description||'').split(/\n+/).filter(p=>p.length>70).slice(0,1).join(' '));
 return excerpt?`<p class="job-overview">${esc(excerpt.length>360?excerpt.slice(0,360)+'…':excerpt)}</p>`:'';
}
function summaryMarkup(job){
 if(job.historical)return '<p>Only your saved notes are available for this role. Open the listing for current details.</p>';
 const summary=savedSummary(job);
 if(summary)return `<p class="job-overview">${esc(summary.overview)}</p><div class="summary-essential"><strong>Before you apply</strong><p>${esc(summary.essentials)}</p></div><div class="summary-benefits"><strong>Pay & benefits</strong><p>${esc(summary.benefits)}</p></div>`;
 if(reviewServiceIssue)return `${listingExcerpt(job)}<p class="source-note" role="status">${esc(reviewServiceIssue)}</p>`;
 if(browserConnection&&profile.evidence.trim())return '<p role="status">Your full CV review will include a summary.</p>';
 const message=summaryErrors.get(job.id);
 return `${listingExcerpt(job)}<p class="source-note" role="status">${esc(message|| (browserConnection?'Writing a short summary…':'Connect your saved setup in My profile to generate a short summary.'))}</p>${message?'<button class="text-button" data-retry-summary>Retry summary</button>':''}`;
}
async function requestSummary(job){
 if(job.historical||fullReview(job)||savedSummary(job)||summaryBusy||reviewServiceIssue||browserConnection&&profile.evidence.trim())return;
 summaryBusy=true;
 try{
  const source=summarySource(job);
  if(crypto.subtle&&!summaryHashes.has(source)){const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(source));summaryHashes.set(source,Array.from(new Uint8Array(bytes),b=>b.toString(16).padStart(2,'0')).join(''));}
  if(savedSummary(job)||summaryErrors.has(job.id)||!browserConnection)return;
  const response=await fetch('/api/summary',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${browserConnection}`},body:JSON.stringify({title:job.title,location:job.location,description:job.description||''}),signal:AbortSignal.timeout(115000)});
  const data=await response.json();if(['REVIEW_QUOTA_EXHAUSTED','REVIEW_SETUP_REQUIRED','REVIEW_MODEL_UNAVAILABLE'].includes(data.code))reviewServiceIssue=data.error;if(!response.ok)throw new Error(data.error||'Summary unavailable.');
  if(!data.summary||!['overview','essentials','benefits'].every(key=>typeof data.summary[key]==='string'))throw new Error('Summary unavailable.');
  summaryCache[job.id]={source:summarySource(job),summary:data.summary};
  const keys=Object.keys(summaryCache);while(keys.length>80)delete summaryCache[keys.shift()];
  persist('job-notebook-summaries-v1',summaryCache);
 }catch(error){summaryErrors.set(job.id,error.name==='TimeoutError'?'Summary took too long. Please retry.':error.message);}
 finally{
  summaryBusy=false;
  const current=deckJobs()[0];
  if(current?.id===job.id){const region=$('role-summary');if(region&&!fullReview(current))region.innerHTML=summaryMarkup(current);if(summarySource(current)!==summarySource(job)){summaryErrors.delete(current.id);requestSummary(current);}}
  else if(current)requestSummary(current);
 }
}
let candidateReviewBudget=6;
const fitReviewCache=new Map(),fitReviewErrors=new Map(),fitReviewRetries=new Map();let fitReviewBusy=false,fitReviewTimer,activeReviewKey=null,reviewServiceIssue=null;
function reviewInputFor(job){return {job:{title:job.title,location:job.location||'',remote:!!job.remote,description:job.description||job.requirements||''},profile:Object.fromEntries(['evidence','languages','workRights','salaryTarget','motivation','workStyle','startDate','relocation'].map(key=>[key,profile[key]||'']))};}
const fitReviewKey=job=>JSON.stringify([REVIEW_VERSION,new Date().toISOString().slice(0,10),reviewInputFor(job)]);
function fullReview(job){return fitReviewCache.get(fitReviewKey(job));}
function nextReviewCandidate(){
 if(!candidateReviewBudget||!profile.evidence.trim()||!browserConnectionVerified||reviewServiceIssue)return null;
 const candidates=[];
 for(const job of discovery.jobs){
  if(discovery.decisions[job.id]||(profile.hideSeniorRoles&&isSeniorRole(job))||!listingFreshness(job,{includeOlder:profile.includeOlderListings}).visible||entries.some(e=>sameJob(e,job))||fullReview(job)||fitReviewErrors.has(fitReviewKey(job)))continue;
  let match=matchCache.get(job);if(!match){const base=matchJob(job,profile);if(!base.eligible)continue;match={...base,experience:experienceRequirement(job),cvFit:discoveryFit(job,profile)};matchCache.set(job,match);}
  if(match.eligible&&match.cvFit.reason!=='experience')candidates.push({job,match,fit:match.cvFit});
 }
 candidates.sort((a,b)=>(b.fit.report.skillsScore||0)-(a.fit.report.skillsScore||0)||b.match.score-a.match.score);
 return candidates[0]?.job||null;
}
function reviewStatusMarkup(job){
 if(fullReview(job))return '<span>CV review of supplied advert</span>';
 if(reviewServiceIssue)return `${esc(reviewServiceIssue)} <button class="text-button" data-retry-fit>Check availability</button>`;
 if(!profile.evidence.trim())return 'Import and save CV details (JSON) in My profile to enable a full review. PDFs alone do not provide comparison details.';
 const error=fitReviewErrors.get(fitReviewKey(job));
 if(error)return `${esc(error)} <button class="text-button" data-retry-fit>Retry review</button>`;
 if(!browserConnection)return 'Quick qualification check. <button class="text-button" data-view="profile">Connect private setup for a full review</button>';
 if(!browserConnectionVerified)return 'Private connection not verified yet. Check the connection status in My profile.';
 if(!job.description)return 'Full review needs listing text. Open the original listing for details.';
 if(fitReviewRetries.get(fitReviewKey(job))?.retryAt>Date.now())return 'Review service busy. Retrying automatically shortly; you can keep browsing.';
 if(fitReviewBusy&&activeReviewKey!==fitReviewKey(job))return 'Waiting for the previous review to finish. This job will be reviewed next.';
 return 'Full CV review in progress. This can take 1–4 minutes. You can keep browsing.';
}
function updateReviewStatus(){
 const current=deckJobs()[0];if(current&&$('full-review-status'))$('full-review-status').innerHTML=reviewStatusMarkup(current);
 if(selectedRole&&$('fit-dialog-review-status'))$('fit-dialog-review-status').innerHTML=reviewStatusMarkup(selectedRole);
}
function scheduleFitReview(job){
 clearTimeout(fitReviewTimer);
 if(fullReview(job)){applyFitReview(job);return;}
 const retryAt=fitReviewRetries.get(fitReviewKey(job))?.retryAt||0;
 fitReviewTimer=setTimeout(()=>requestFitReview(job),Math.max(1400,retryAt-Date.now()));
}
async function requestFitReview(job){
 const key=fitReviewKey(job),input=reviewInputFor(job);
 if(fitReviewBusy||reviewServiceIssue||fullReview(job)||fitReviewErrors.has(key)||!profile.evidence.trim()||!browserConnectionVerified||!browserConnection||!job.description)return;
 if(fitReviewRetries.get(key)?.retryAt>Date.now()){scheduleFitReview(job);return;}
 fitReviewBusy=true;activeReviewKey=key;if(!deckJobs().some(j=>j.id===job.id)&&!fitReviewRetries.has(key))candidateReviewBudget--;updateReviewStatus();
 try{
  const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(key))),b=>b.toString(16).padStart(2,'0')).join('');
  const stored=await deviceItem('fit-reviews')||{};
  let review=stored[hash];
  if(!review){
   const response=await fetch('/api/fit-review',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${browserConnection}`},body:JSON.stringify(input),signal:AbortSignal.timeout(295000)});
   if(response.status===429){
    const attempts=(fitReviewRetries.get(key)?.attempts||0)+1;
    if(attempts>6)throw Error('The review service is still busy. Please retry in a few minutes.');
    const seconds=Math.max(1,Math.min(60,Number(response.headers.get('Retry-After'))||15));
    fitReviewRetries.set(key,{attempts,retryAt:Date.now()+seconds*1000});return;
   }
   const data=await response.json();if(['REVIEW_QUOTA_EXHAUSTED','REVIEW_SETUP_REQUIRED','REVIEW_MODEL_UNAVAILABLE'].includes(data.code)){reviewServiceIssue=data.error;$('browser-connection-status').textContent='Private connection verified. '+reviewServiceIssue;const region=$('role-summary');if(region)region.innerHTML=summaryMarkup(job);}
   if(!response.ok)throw Error(data.error||'Review unavailable.');
   review=data.review;
   if(review?.version!==REVIEW_VERSION||!Array.isArray(review.points)||!Array.isArray(review.factors))throw Error('Review response was incomplete. Retry it.');
   stored[hash]=review;const hashes=Object.keys(stored);while(hashes.length>20)delete stored[hashes.shift()];
   await deviceSetItem('fit-reviews',stored);
  }
  fitReviewRetries.delete(key);fitReviewCache.set(key,review);if(fitReviewCache.size>30)fitReviewCache.delete(fitReviewCache.keys().next().value);
  if(key===fitReviewKey(job))applyFitReview(job);
 }catch(error){fitReviewErrors.set(key,error.name==='TimeoutError'?'The full review took too long. Retry it.':error.message);}
 finally{
  fitReviewBusy=false;activeReviewKey=null;
  renderDeck();
  const current=deckJobs()[0]||nextReviewCandidate();
  updateReviewStatus();
  if(current&&(fitReviewKey(current)!==key||fitReviewRetries.has(key)&&!fitReviewErrors.has(key)))scheduleFitReview(current);
 }
}
function applyFitReview(job){
 const review=fullReview(job);if(!review)return;
 if(!reviewClearsDiscovery(review)){if(selectedRole?.id===job.id&&$('role-dialog').open)openFullReview(job,review);pinnedJobId=null;renderDeck();toast('Full CV review found insufficient skills or experience evidence, or a required conflict. It has been removed from Discover.');return;}
 if(!$('active-card'))renderDeck();
 if($('active-card')?.dataset.jobId===job.id){
  const old=document.querySelector('.qualification-details'),wasOpen=old?.open,scroll=$('active-card').scrollTop;
  if(old){old.outerHTML=qualificationMarkup(reviewInsights(review));document.querySelector('.qualification-details').open=!!wasOpen;listingHighlights?.refresh();}
  document.querySelector('.card-fit-summary').textContent=review.skills===null?'Skills evidence needs review':`Skills evidence: ${review.skills}/10 · Full CV review${review.provisional?' · Provisional':''}`;
  document.querySelector('.listing-info small').textContent=review.skills===null?'Fit':review.skills+'/10';
  $('role-summary').innerHTML=`<p class="job-overview">${esc(review.summary)}</p>`;
  const tag=document.querySelector('.cv-tag');if(tag?.firstChild)tag.firstChild.textContent=review.cv;
  if($('full-review-status'))$('full-review-status').innerHTML=reviewStatusMarkup(job);
  $('active-card').scrollTop=scroll;
 }
 if(selectedRole?.id===job.id&&$('role-dialog').open)openFullReview(job,review);
}
function openFullReview(job,review){
 selectedRole=job;$('role-title').textContent=job.company;
 const factorStatus={match:'✓',partial:'?',gap:'×',unknown:'?'};
 $('role-content').innerHTML=`<h3 class="role-heading">${esc(job.title)}</h3><p class="prep-meta">${esc(job.location)}</p><section class="fit-rating"><p class="eyebrow">OVERALL APPLICATION FIT</p><div class="fit-score">${review.overall===null?'More evidence needed':review.overall+(review.overallUpper>review.overall?'–'+review.overallUpper:'')+'<span> / 10</span>'}${review.provisional?'<small class="fit-provisional">Provisional</small>':''}</div><p>${esc(review.summary)}</p><p class="fit-coverage">Qualification fit: ${review.skills===null?'Unresolved':review.skills+'/10'} · Daily work: ${review.work==null?'Unresolved':review.work+'/10'} · ${review.coverage}% overall evidence coverage</p></section>
 <section class="fit-section">${qualificationMarkup(reviewInsights(review))}</section><section class="fit-section"><h3>Rating breakdown</h3><ul>${(review.breakdown||[]).map(g=>`<li>${esc(g.label)}: <strong>${g.applicable?g.earned+' / '+g.max:'Not stated'}</strong></li>`).join('')}</ul>${review.availablePoints<10?`<p>Applicable subtotal: ${review.earnedPoints} / ${review.availablePoints}, scaled to 10.</p>`:''}${review.cap?`<p>${esc(review.cap)}</p>`:''}</section>
 <section class="fit-section fit-cv"><h3>CV to use</h3><p class="fit-cv-name">${esc(review.cv)}</p><p>${esc(review.cvReason)}</p><p id="fit-cv-status" role="status"></p><button class="secondary-button" id="fit-download-cv" hidden>Download recommended CV</button></section>
 <section class="fit-section"><h3>What affects the rating</h3><div class="review-factor-list">${review.factors.map(f=>`<article data-factor="${esc(f.key)}"><h4><span aria-hidden="true">${factorStatus[f.status]}</span> ${factorLabels[f.key]}</h4><p>${esc(f.note)}</p></article>`).join('')}</div></section>
 ${review.issues.length?`<section class="fit-section"><h3>Still uncertain</h3>${fitList(review.issues,'')}</section>`:''}
 <details class="fit-section"><summary>How the rating is calculated</summary><p>Core requirements 4 points, secondary requirements 2, experience level 2, and work style &amp; career 2. The skills score uses core required skills only; optional extras, years and personal preferences do not lower it. Each requirement earns full credit for direct evidence, half for transferable evidence, and none for missing evidence. The overall range separates currently evidenced credit from the upper bound if every unresolved point is confirmed; it is not an expected outcome. Years and role seniority are scored under experience, without counting them again as core skills. Mandatory tools stay core. Work style and career contribute one point each; contract length and balance inform work style. Pay remains a separate practical consideration. A category with no advertised requirements is marked not stated and excluded; the applicable subtotal is scaled to 10. Unknowns remain provisional. Confirmed eligibility conflicts cap the score at 3; unclear eligibility and willingness to relocate do not. ${esc(review.cap)} Results are rounded to half a point and are not hiring odds.</p><p>${review.model?'Review model: '+esc(review.model)+'. ':''}${review.fallback?'Backup provider used ('+esc(review.fallback.from)+': '+esc(review.fallback.reason)+'). ':''}The review accounts for ${review.audit.length} supplied advert paragraphs and validates supporting quotes against your saved details. It cannot verify that the source feed contains the entire current employer advert.</p></details>
 <button class="secondary-button" id="fit-show-checks">See qualification checklist</button><button class="text-button" data-view="profile" id="full-fit-profile">Update my profile</button>`;
 $('role-source').href=safeURL(job.link);if(!$('role-dialog').open)$('role-dialog').showModal();
 $('fit-show-checks').onclick=()=>{const section=$('role-content').querySelector('.qualification-details');if(section){section.open=true;section.scrollIntoView({block:'start'});}};
 $('role-content').querySelectorAll('[data-role-details]').forEach(button=>button.remove());
 $('full-fit-profile').onclick=()=>$('role-dialog').close();updateFitCV(job,review.cv);
}
document.addEventListener('click',event=>{if(event.target.closest('[data-more-reviews]')){candidateReviewBudget=6;renderDeck();return;}const fitEntry=event.target.closest('[data-fit-entry]');if(fitEntry){const entry=entries.find(e=>e.id===fitEntry.dataset.fitEntry);if(entry)openRoleDetails({...entry,description:entry.description||entry.requirements});return;}if(event.target.closest('[data-retry-fit]')){reviewServiceIssue=null;candidateReviewBudget=6;const job=$('role-dialog').open?selectedRole:deckJobs()[0]||nextReviewCandidate();if(job){fitReviewErrors.delete(fitReviewKey(job));fitReviewRetries.delete(fitReviewKey(job));requestFitReview(job);if($('full-review-status'))$('full-review-status').innerHTML=reviewStatusMarkup(job);}}});

const qualificationStates={match:['✓','Supported'],partial:['?','Partly supported'],gap:['×','Gap'],unknown:['?','Unclear']};
function qualificationMarkup(insights){
 const required=insights.requirements.filter(r=>!r.preferred),optional=insights.requirements.filter(r=>r.preferred);
 const mark=r=>r.missing?['?','Not recorded in your CV']:qualificationStates[r.status];
 const count=symbol=>required.filter(r=>mark(r)[0]===symbol).length;
 const group=(title,rows,key)=>rows.length?`<section class="qualification-group" data-qualification-group="${key}"><h3>${title}</h3><ul class="qualification-list">${rows.map(r=>{
  const [symbol,label]=mark(r),note=r.note||r.detail;
  return `<li class="qualification ${r.status}${r.missing?' missing':''}"><span class="qualification-icon" role="img" aria-label="${esc(label)}" title="${esc(symbol==='✓'?r.checks.filter(c=>c.evidence).map(c=>c.evidence).join(' · '):note)}">${symbol}</span><div class="qualification-comparison"><p class="requirement-text" data-highlight-kind="requirement">${esc(r.label)}</p>${symbol==='?'?`<p class="qualification-note">${esc(note)}</p>`:''}${symbol==='×'?`<p class="qualification-note">${esc(note)}</p>`:''}</div></li>`;
 }).join('')}</ul></section>`:'';
 return `<details class="qualification-details"><summary>Your qualification match${insights.requirements.length?' ('+insights.requirements.length+')':''}</summary>
 <p class="qualification-overview">✓ ${count('✓')} · × ${count('×')} · ? ${count('?')} <span>required points</span></p>
 <p class="check-legend">✓ Supported · × Confirmed gap · ? Partial, missing or unclear. Missing CV evidence does not mean you cannot do it.</p>
 ${!insights.hasExperience?'<p class="profile-evidence-notice">Your experience is empty on this device. Upload your CVs to compare it.</p>':''}
 ${group('Requirements',required,'required')}${group('Nice to have',optional,'optional')}
 ${group('Day-to-day duties',insights.dutyAssessments||[],'duties')}
 ${!insights.requirements.length?'<p class="qualification-empty">There isn’t enough requirement text in this listing to assess your fit. Read the full advert.</p>':''}
 <button class="text-button" data-edit-evidence>${insights.hasExperience?'Update my experience':'Add my experience'}</button>
 </details>`;
}
function renderDeck() {
  if (decisionPending) return;
  document.querySelectorAll('.swipe-button').forEach(button => button.disabled = false);
  const jobs = deckJobs(), job = jobs[0];
  pinnedJobId=job?.id||null;
  maybeLoadMore(jobs.length);
  $('deck-count').textContent = `${jobs.length} role${jobs.length === 1 ? '' : 's'} to explore`;
  $('load-more-jobs').hidden=!hasMoreJobs()||!job||feedError||!!discovery.sourceErrors?.length;
  $('load-more-jobs').disabled=loading;
  $('undo-swipe').disabled = !undoAction;
  $('swipe-actions').hidden = !job;
  if (!job) {
  listingHighlights?.destroy();listingHighlights=null;
  $('job-deck').innerHTML = `<div class="deck-empty"><span aria-hidden="true">✧</span><h2>${!profile.evidence.trim()?'Let’s start with your CV.' : loading ? 'Finding your next possibility…' : feedError ? 'The search paused.' : hasMoreJobs() ? 'More results to search.' : discovery.fetchedAt ? 'No unreviewed matches in this search.' : 'Let’s find your kind of work.'}</h2><p>${!profile.evidence.trim()?'Upload your CVs in My profile. Suggestions need a documented skills match above 6/10 and experience within your dated CV history.' : loading ? 'Looking for roles with skills evidence above 6/10 and suitable experience requirements.' : feedError ? 'A source could not be reached. Retry to keep searching; your saved roles are safe.' : hasMoreJobs() ? 'No matches in the batches checked so far. More source searches or pages remain; keep searching or adjust your filters.' : 'No more matching roles in the listings retrieved so far for '+esc(scopeLabel())+'. This is a limited set of public sources, not every vacancy. Change filters, check for new postings later, or revisit roles you passed.'}</p><button class="primary-button" id="empty-refresh" ${loading ? 'disabled' : ''}>${loading ? 'Finding roles…' : feedError?'Retry search':hasMoreJobs()?'Keep searching':'Check for new jobs'}</button><button class="secondary-button" data-view="profile">Review my CV details</button>${browserConnectionVerified&&!candidateReviewBudget?'<button class="text-button" data-more-reviews>Review more candidates</button>':''}${reviewServiceIssue?'<p role="status">'+esc(reviewServiceIssue)+' <button class="text-button" data-retry-fit>Retry full review</button></p>':''}${Object.keys(discovery.decisions).length ? '<button class="text-button" id="revisit-passed">Revisit passed roles</button>' : ''}<button class="text-button" data-change-locations>Change search filters</button><p class="source-note">Listings found with Firecrawl across employer sites and public job pages, including LinkedIn when readable. Your location, experience, role and listing-age filters still apply.</p></div>`;
    const candidate=nextReviewCandidate();if(candidate){$('feed-status').textContent='Comparing promising roles with your full CV. Only skills matches above 6/10 will appear.';scheduleFitReview(candidate);}
    return;
  }
  const previousCard=$('active-card');
  const signature=JSON.stringify([job.id,job.company,job.title,job.location,job.link,job.description,job.requirements,job.source,job.remote,job.publishedAt,job.expiresAt,job.match,profile,fullReview(job)]);
  if(previousCard?.listingSignature===signature){if(!previousCard.classList.contains('highlighting'))listingHighlights?.refresh();requestSummary(job);scheduleFitReview(job);return;}
  const reading=previousCard?.dataset.jobId===job.id?{scroll:previousCard.scrollTop,open:Object.fromEntries([...previousCard.querySelectorAll('details')].map(el=>[el.className,el.open]))}:null;
  const {match}=job,insights=roleInsights(job,profile),baseFit=jobFitReport(job,profile),review=fullReview(job),fit={...baseFit,skillsScore:match.skillsScore,provisional:review?.provisional??baseFit.provisional};
  $('job-deck').innerHTML=`<article class="job-card" id="active-card" data-job-id="${esc(job.id)}" aria-label="${esc(job.title)} at ${esc(job.company)}"><span class="swipe-label" aria-hidden="true"></span><div class="card-top"><div class="company-line"><span class="company-monogram" aria-hidden="true">${esc(job.company.slice(0,1))}</span><div class="company-info"><strong>${esc(job.company)}</strong><small>${job.historical?'Saved role · check availability':'From the employer’s listing'}</small></div><button class="listing-info" data-role-details type="button" aria-label="Job fit, rating and recommended CV" title="Job fit, rating and recommended CV"><svg class="ui-icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-10v1"/></svg><small>${fit.skillsScore===null?'Fit':(Math.round(fit.skillsScore*10)/10)+'/10'}</small></button></div><h2>${esc(job.title)}</h2><p class="source-note listing-date">${esc(listingFreshness(job,{includeOlder:profile.includeOlderListings}).label)}</p><p class="job-location">◎ ${esc(scopedLocation(job,profile))}${job.remote?' · Remote option':''}</p>${profile.geography!=='international'?`<p class="location-evidence">${esc(geographicMatch(job,profile).label)}</p>`:''}</div><div class="card-body"><section class="inline-role" aria-label="Role details"><p class="card-fit-summary">${fit.skillsScore!==null?`Skills evidence: ${Math.round(fit.skillsScore*10)/10}/10 · ${fit.provisional?'Needs review':'Supported'}`:'CV evidence needed'}</p><div class="match-reasons"><span class="mini-label">WHY IT’S HERE</span><p>${esc(match.reasons.slice(0,2).join(' · '))}</p></div><h3>In brief</h3>${scopedLocation(job,profile)!==job.location?`<details class="source-locations"><summary>All advertised locations</summary><p>${esc(job.location)}</p></details>`:''}<div id="role-summary">${summaryMarkup(job)}</div>${insights.commercial?'<p class="fit-caution">Commercial / sales focus — lower priority for your consulting direction.</p>':''}${qualificationMarkup(insights)}<p id="full-review-status" class="source-note" role="status">${reviewStatusMarkup(job)}</p><details class="source-description"><summary>Full employer advert</summary><p class="source-note">The complete source text, including responsibilities, requirements and benefits.</p><p class="source-advert-text" data-highlight-kind="advert">${esc(descriptionText(job.description||job.requirements||'No description supplied.'))}</p></details></section></div><div class="card-footer"><span class="cv-tag">${esc(match.cv)}<br><a href="${esc(safeURL(job.link))}" target="_blank" rel="noopener noreferrer">${esc(job.source||'Original listing')} ↗</a></span><button class="text-button" data-read-role type="button">Read role ↓</button></div></article>`;
  const card=$('active-card');card.listingSignature=signature;
  listingHighlights?.destroy();
  listingHighlights=mountListingHighlights(card,{read:()=>discovery.highlights?.[job.id],write:highlights=>{const next={...discovery,highlights:{...discovery.highlights,[job.id]:highlights}};if(!persist(DISCOVERY_KEY,next))return false;discovery=next;return true;},notify:toast});
  if(reading){card.querySelectorAll('details').forEach(el=>el.open=!!reading.open[el.className]);card.scrollTop=reading.scroll;}
  wireSwipe();
  requestSummary(job);scheduleFitReview(job);
}
function fitList(items,empty){return items.length?`<ul>${items.map(value=>`<li>${esc(value)}</li>`).join('')}</ul>`:`<p>${esc(empty)}</p>`;}
function readSavedProfile(){
 try{
  const raw=localStorage.getItem(PROFILE_KEY);if(!raw)return false;
  const saved=validateProfile(JSON.parse(raw));
  if(JSON.stringify(saved)===JSON.stringify(profile))return false;
  profile=saved;matchCache=new WeakMap();return true;
 }catch{return false;}
}
function cvDetectionMessage(){
 const files=profile.cvImportSources.split('\n').filter(Boolean).length;
 if(profile.evidence.trim())return files?`${files} CV ${files===1?'file':'files'} detected. Your saved CV details are being used for this comparison.`:'Saved profile experience detected and used for this comparison.';
 return files?`${files} CV ${files===1?'import is':'imports are'} recorded, but the saved experience text is empty. Check your imported details in My profile.`:'No saved CV experience detected on this browser. PDF availability is checked separately below.';
}
function openRoleDetails(jobToShow=deckJobs()[0]) {
 readSavedProfile();
 selectedRole=jobToShow;if(!selectedRole)return;
 const job=selectedRole,report=jobFitReport(job,profile);
 if(fullReview(job)){openFullReview(job,fullReview(job));return;}
 scheduleFitReview(job);
 $('role-title').textContent=job.company;
 $('role-content').innerHTML=`<h3 class="role-heading">${esc(job.title)}</h3><p class="prep-meta">${esc(job.location)}</p>
 <p id="fit-dialog-review-status" role="status">${reviewStatusMarkup(job)}</p><section class="fit-rating" aria-label="Qualification fit rating"><p class="eyebrow">LOCAL REQUIREMENT EVIDENCE</p><div class="fit-score">${report.score===null?(report.ratingState==='missing-profile'?'Add CV details':'Advert details needed'):report.score+(report.scoreUpper>report.score?'–'+report.scoreUpper:'')+'<span> / 10</span>'}${report.provisional?'<small class="fit-provisional">Provisional</small>':''}</div><p class="fit-skills-score">Skills evidence: ${report.skillsScore===null?'Not enough information':(Math.round(report.skillsScore*10)/10)+'/10'} · required skills only</p><p class="fit-verdict">${esc(report.priority)}</p><details class="fit-score-explanation"><summary>What this score means</summary><p>The range separates documented evidence from unresolved requirements. The lower end credits only supported or partial evidence; the upper end shows what could be possible if all unresolved points are confirmed. It is not a prediction. The skills score used for discovery excludes years, work rights and optional extras. Unresolved points earn no evidence credit; they are not proven gaps. The full review considers transferable work and practical factors separately. ${esc(report.ratingReason)} This is not your probability of getting the job.</p></details><p class="fit-coverage">${report.fullyAssessed} of ${report.total} required points resolved · ${report.counts.partial} partial · ${report.counts.unknown} unknown.</p></section>
 <section class="fit-review fit-section" aria-label="Application assessment"><p class="eyebrow">APPLICATION ASSESSMENT</p><h4>${esc(report.review.verdict)}</h4><p>${esc(report.review.summary)}</p><p class="source-note">${report.review.requiredCount} core requirements · ${report.review.optionalCount} optional advantages. The score measures skills evidence; practical trade-offs are assessed separately.</p></section><p class="fit-cv-detection" role="status">${esc(cvDetectionMessage())}</p><p class="fit-priorities">Your priorities: skills & eligibility · pay & career growth</p>
 <section class="fit-section">${qualificationMarkup(roleInsights(job,profile))}</section><details class="source-description"><summary>Full employer advert</summary><p class="source-advert-text">${esc(descriptionText(job.description||job.requirements||'No description supplied.'))}</p></details><div class="fit-stats" aria-label="Required qualification breakdown">${[['Supported',report.counts.match],['Partial',report.counts.partial],['Gaps',report.counts.gap],['Not evidenced',report.counts.unknown]].map(([label,n])=>`<div><strong>${n}</strong><span>${label}</span></div>`).join('')}</div>
 ${report.bonus.total?`<p class="source-note">${report.bonus.supported} of ${report.bonus.total} optional bonuses supported. Bonuses are excluded from the score.</p>`:''}
 ${!report.hasExperience?'<p class="profile-evidence-notice">Your work experience is empty on this device. The comparison currently has limited evidence.</p>':''}
 <section class="fit-section fit-cv"><h3>Recommended CV</h3><p class="fit-cv-name">${esc(report.cv)}</p><p>${esc(report.cvReason)}</p><p id="fit-cv-status" role="status">Checking your saved PDF…</p><button class="secondary-button" id="fit-download-cv" hidden>Download recommended CV</button></section>
 <section class="fit-section fit-tradeoffs"><h3>Before you apply</h3>${fitList(report.review.concerns,'No specific practical conflict was identified; confirm the advertised terms.')}<p><strong>Next step:</strong> ${esc(report.review.nextStep)}</p></section>
 <details class="fit-section fit-work"><summary>Day-to-day work overlap</summary><p>Related CV examples support parts of these duties; this does not establish your preferred working style or confirm the whole task.</p>${report.review.workEvidence.length?`<ul class="fit-work-evidence">${report.review.workEvidence.map(c=>`<li><strong>${esc(c.label)}</strong><details><summary>Advertised task</summary><p>${esc(c.task)}</p></details><blockquote>${esc(c.evidence)}</blockquote></li>`).join('')}</ul>`:'<p>No supported duty comparison is available.</p>'}</details>
 <section class="fit-section"><h3>What supports your application</h3>${report.evidenceMatches.length?`<ul class="fit-evidence-list">${[...new Map(report.evidenceMatches.map(c=>[c.label+'|'+c.evidence,c])).values()].map(c=>`<li><strong>${esc(c.label)}</strong><span class="source-note">${c.status==='match'?'Direct evidence':'Transferable experience · partial credit'}</span><blockquote>${esc(c.evidence)}</blockquote></li>`).join('')}</ul>`:'<p>No supporting evidence found for these requirements in your saved CV details. This is a documented-evidence score, not a judgement of your ability.</p>'}</section>
 ${report.gaps.length?`<section class="fit-section fit-gaps"><h3>Known gaps</h3>${fitList(report.gaps,'')}</section>`:''}
 <details class="fit-section"><summary>Partial matches & missing evidence (${report.partial.length+report.unknown.length})</summary>${fitList([...report.partial.map(s=>'Partly supported: '+s),...report.unknown.map(s=>'Needs evidence: '+s)],'All identified required points have been assessed.')}</details>
 <section class="fit-section"><h3>Practical factors</h3><p class="source-note">Eligibility, pay and growth come first. Compare advertised pay with your saved target; missing pay or progression details stay unresolved.</p><div class="fit-factors">${report.factors.map(f=>`<article class="fit-factor" data-factor="${f.key}"><div class="fit-factor-heading"><h4>${esc(f.label)}</h4><span class="factor-status ${f.status==='gap'?'factor-gap':''}">${esc(f.status)}</span></div><p>${esc(f.detail)}</p>${f.profileEvidence?`<p class="source-note">Your profile: ${esc(f.profileEvidence)}</p>`:''}${f.evidence.length?`<details><summary>See supporting details</summary>${fitList(f.evidence,'')}</details>`:''}</article>`).join('')}</div></section>
 <div class="flag-box"><strong>Questions to resolve</strong>${fitList(report.questions,'No additional missing details were identified.')}</div>
 <details class="fit-section"><summary>How this rating works</summary><p>Each required point receives 1 for supported evidence, ½ for a partial match, or 0 for a confirmed gap or missing evidence. The score uses every required point, scales the total to 10 and rounds to the nearest half-point. Optional bonuses do not change it. A zero means no documented match was found, not that you cannot do the job. Partial matches include related experience with a quoted CV excerpt; they do not confirm specialist knowledge, seniority or every condition. The score is provisional while any point is partial or unknown. Coverage shows the share with at least some evidence or a confirmed gap. An advert with no identifiable requirements needs more detail before a meaningful score is possible.</p><p>Work rights, pay and career growth remain separate priority checks; missing information is never assigned invented points.</p><p>Hiring odds are unavailable: applicant competition, employer screening and interview performance are unknown.</p></details>
 <div class="fit-profile-actions"><button class="secondary-button" data-fit-profile>Update my profile & CVs</button><button class="text-button" id="fit-show-checks">See each qualification check</button></div>`;
 $('role-content').querySelectorAll('[data-role-details]').forEach(button=>button.remove());
 $('role-source').href=safeURL(job.link);$('role-dialog').showModal();$('role-content').scrollTop=0;
 $('fit-show-checks').onclick=()=>{const section=$('role-content').querySelector('.qualification-details');if(section){section.open=true;section.scrollIntoView({block:'start'});}};
 $('role-content').querySelectorAll('[data-role-details]').forEach(button=>button.remove());
 $('role-content').querySelector('[data-fit-profile]').onclick=()=>{$('role-dialog').close();setView('profile');const field=$('profile-evidence');field.closest('details').open=true;field.focus();};
 updateFitCV(job,report.cv);
}
async function updateFitCV(job,cv){
 try{
  const library=await Promise.all(['consulting','analyst','developer'].map(key=>cvStore('get',key)));
  const stored=library[['consulting','analyst','developer'].indexOf(cvKey(cv))];
  const pdfCount=library.filter(file=>file?.blob instanceof Blob).length;
  if(selectedRole?.id!==job.id||!$('role-dialog').open)return;
  $('fit-cv-status').textContent=`${pdfCount} PDF${pdfCount===1?'':'s'} detected on this browser. `+(stored?.blob?stored.name+' · Recommended PDF ready.':'No PDF saved for this CV on this device. Upload it in My profile.');
  $('fit-download-cv').hidden=!stored?.blob;
  $('fit-download-cv').onclick=()=>download(stored.blob,stored.name,'application/pdf');
 }catch{if(selectedRole?.id===job.id&&$('fit-cv-status'))$('fit-cv-status').textContent='Could not read saved PDFs. Check your CV library in My profile.';}
}
function maybeLoadMore(count){
 if(!profile.evidence.trim()||count>4||loading||feedError||autoBudget<=0||!discovery.fetchedAt||!hasMoreJobs()||activeView!=='discover')return;
 queueMicrotask(()=>{if(!loading&&!feedError&&autoBudget>0&&hasMoreJobs()&&activeView==='discover'){autoBudget--;refreshJobs(true);}});
}
async function refreshJobs(more=false) {
 more=more===true;
 if (loading) return;
 if(!profile.evidence.trim()){renderDeck();return;}
 if(!more)autoBudget=4;
 if(more&&!hasMoreJobs())return;
 const page=more?(discovery.nextPage||1):1,searchOnly=more&&!discovery.nextPage;
 const previousPage=discovery.nextPage,previousSearch=discovery.nextSearch;
 const requestId=++feedRequestId;feedController=new AbortController();
 const params=new URLSearchParams();if(more)params.set('search',discovery.nextSearch||'done');if(searchOnly)params.set('searchOnly','1');if(page!==1)params.set('page',page);if(profile.geography!=='international')params.set('region',profile.geography);if(profile.country)params.set('country',profile.country);if(profile.includeBroadRemote)params.set('broad','1');
 const skills=cvSearchSkills(profile);if(skills.length)params.set('skills',skills.join(','));const months=recordedEmploymentMonths(profile);if(months!==null&&months<=36)params.set('junior','1');
 loading=true;feedError=false;$('refresh-jobs').disabled=true;$('feed-status').textContent=more?'Finding more matching roles…':'Checking for new jobs…';
 if(!$('active-card'))renderDeck();
 try {
  const token=browserConnection||(await cvStore('get','connection').catch(()=>null))?.token;
  const response=await fetch('/api/jobs'+(params.size?'?'+params:''),{headers:token?{Authorization:'Bearer '+token}:{},signal:AbortSignal.any([feedController.signal,AbortSignal.timeout(80000)])});
  const data=await response.json();
  if(requestId!==feedRequestId)return;
  if(!response.ok||!Array.isArray(data.jobs))throw new Error(data.error||'Could not load jobs.');
  const incoming=data.jobs.filter(j=>j&&typeof j.id==='string'&&typeof j.company==='string'&&typeof j.title==='string'&&safeURL(j.link));
  discovery.reviewed ||= {};
  for(const job of discovery.jobs)if(discovery.decisions[job.id])discovery.reviewed[job.id]={id:job.id,company:job.company,title:job.title,location:job.location,link:job.link};
  const refreshedBoards=new Set(data.stale?[]:data.refreshedEmployerBoards||[]),incomingIds=new Set(incoming.map(j=>j.id));
  const retained=discovery.jobs.filter(j=>!j.employerBoard||!refreshedBoards.has(j.employerBoard)||incomingIds.has(j.id)||discovery.decisions[j.id]);
  const merged=new Map(retained.map(j=>[j.id,j]));for(const job of incoming)merged.set(job.id,job);
  // Keep full descriptions for relevant roles, plus recent reviewed cards for undo/revisit.
  const all=[...merged.values()];
  discovery.jobs=[...all.filter(j=>!discovery.decisions[j.id]&&matchJob(j,{...profile,geography:'international',country:''}).eligible),...all.filter(j=>discovery.decisions[j.id]).slice(-50)];
  discovery.nextSearch=typeof data.nextSearch==='string'?data.nextSearch:null;
  discovery.nextPage=Number.isInteger(data.nextPage)&&data.nextPage>0?data.nextPage:null;
  if(more&&discovery.nextPage===previousPage&&discovery.nextSearch===previousSearch)autoBudget=0;
  if(data.stale){discovery.nextPage=previousPage;discovery.nextSearch=previousSearch;feedError=true;}
  if(data.retryPage)feedError=true;
  discovery.sourceErrors=more?[...new Set([...(discovery.sourceErrors||[]).filter(source=>!['Firecrawl page extraction'].includes(source)),...(data.sourceErrors||[])])]:data.sourceErrors||[];
  discovery.fetchedAt=typeof data.fetchedAt==='string'&&Number.isFinite(Date.parse(data.fetchedAt))?data.fetchedAt:new Date().toISOString();saveDiscovery();
  const failures=(discovery.sourceErrors||[]).length;
  if(failures&&(!hasMoreJobs()||discovery.sourceErrors.includes('Firecrawl')))feedError=true;
  $('feed-status').textContent=feedError?'Search paused · Retry to continue':failures?`${discovery.sourceErrors.join(', ')} unavailable · Other listings are still available`:hasMoreJobs()?'More source results available · Load more or keep browsing':'Current source searches checked · Coverage is limited';
 } catch(error) {
  if(requestId!==feedRequestId)return;
  feedError=true;discovery.nextPage=more?previousPage:1;discovery.nextSearch=previousSearch;
  $('feed-status').textContent=error.message||'Firecrawl search paused · Retry search';
 } finally {
  if(requestId!==feedRequestId)return;
  saveDiscovery();
  loading=false;$('refresh-jobs').disabled=false;
  $('retry-jobs').hidden=!feedError&&!discovery.sourceErrors?.length;
  renderDeck();
 }
}
async function decide(action, job = deckJobs()[0]) {
  if (!job || decisionPending) return;
  decisionPending = true;
  let listingOpened=false;
  document.querySelectorAll('.swipe-button').forEach(button => button.disabled = true);
  $('undo-swipe').disabled = true;
  const existing = entries.find(e => sameJob(e,job));
  undoAction = {jobId: job.id, previousDecision: discovery.decisions[job.id], entry: existing ? structuredClone(existing) : null, newId: null};
  discovery.decisions[job.id] = action;
  discovery.reviewed ||= {};discovery.reviewed[job.id]={id:job.id,company:job.company,title:job.title,location:job.location,link:job.link};
  autoBudget=12;
  if (action !== 'pass') {
    const recommendedCV=fullReview(job)?.cv||job.match.cv;
    const entry = existing || {id: job.id, company: job.company, title: job.title, location: job.location, link: job.link, requirements: job.description || job.requirements || '', status: 'To apply', materials: recommendedCV, notes: '', applicationDate: '', interviewDate: '', source: job.source};
    if (!existing) {entries.unshift(entry); undoAction.newId = entry.id;}
    if (action === 'prepare') {entry.status = 'Preparing'; if(!entry.preparation){entry.preparation=prepareApplication(job,profile);entry.preparation.cv=recommendedCV;entry.preparation.cvFile=profile[cvKey(recommendedCV)+'CV']||'';} entry.materials ||= recommendedCV;}
    saveEntries();
    if (action === 'prepare') {preparationId = entry.id;}
  }
  saveDiscovery();
  if (action === 'prepare') {
    const url = safeURL(job.link);
    if (url) {
      const tab = window.open(url, '_blank');
      if (tab) {tab.opener = null;listingOpened=true;}
      else {
        $('listing-tab-link').href=url;
        $('listing-tab-job').textContent=job.title+' · '+job.company;
        $('listing-tab-dialog').showModal();
      }
    }
  }
  const card = $('active-card');
  if (card?.dataset.jobId === job.id && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
    const direction = action === 'pass' ? -1 : action === 'prepare' ? 1 : 0;
    try {
      await card.animate([{transform:card.style.transform || 'none',opacity:1}, {transform:`translate3d(${direction * card.clientWidth}px, ${direction ? 0 : -25}px, 0) rotate(${direction * 8}deg)`,opacity:0}], {duration:170,easing:'ease-in',fill:'forwards'}).finished;
    } catch { /* A cancelled animation must not block an already saved decision. */ }
  }
  decisionPending = false;
  render();
  if (action === 'prepare' && !browserConnection) toast(listingOpened?'Listing opened in a new tab. Your CV choice and notes are saved in Applications.':'Saved as Preparing. Use Open application to open the blocked tab.');
  else if(action !== 'prepare') toast(action === 'pass' ? 'Passed. Undo is here if you change your mind.' : 'Saved to your applications for later.');
}
function undoSwipe() {
  if (!undoAction || decisionPending) return;
  const {jobId, previousDecision, entry, newId} = undoAction;
  const current = entries.find(e => e.id === (entry?.id || newId));
  if (current && ['Applied','Interview','Offer'].includes(current.status)) {toast('This application has progressed. Edit it in Applications.'); undoAction = null; render(); return;}
  if (previousDecision) discovery.decisions[jobId] = previousDecision; else delete discovery.decisions[jobId];
  if (newId) entries = entries.filter(e => e.id !== newId);
  else if (entry) entries = entries.map(e => e.id === entry.id ? entry : e);
  pinnedJobId=jobId;
  undoAction = null; saveEntries(); saveDiscovery(); render(); toast('Last swipe undone.');
}
function wireSwipe() {
  const card = $('active-card'), job = deckJobs().find(j=>j.id===card.dataset.jobId);
  let start = null, dx = 0, frame = 0;
  const threshold = () => Math.max(64, Math.min(125, card.clientWidth * .23));
  const interactive = 'a,button,summary,input,textarea,select,label,[contenteditable="true"]';
  card.addEventListener('pointerdown', e => {
    if (card.classList.contains('highlighting') || decisionPending || e.button !== 0 || !e.isPrimary || e.target.closest(interactive)) return;
    start = {x:e.clientX,y:e.clientY,id:e.pointerId,time:e.timeStamp,dragging:false}; dx = 0;
    // Prevent mouse text selection while keeping native vertical touch scrolling.
    if(e.pointerType==='mouse')e.preventDefault();
    card.setPointerCapture(e.pointerId);
  });
  function paint() {
    frame=0;
    card.style.transform = `translate3d(${dx}px,0,0) rotate(${Math.max(-8,Math.min(8,dx/30))}deg)`;
    const label = card.querySelector('.swipe-label'); label.style.top=(card.scrollTop+Math.min(75,card.clientHeight/4))+'px'; label.style.opacity = Math.min(1,Math.abs(dx)/threshold()); label.textContent = dx > 0 ? 'APPLY' : 'PASS';
    card.dataset.direction = dx > 0 ? 'prepare' : 'pass';
  }
  card.addEventListener('pointermove', e => {
    if (!start || e.pointerId !== start.id) return;
    dx = e.clientX - start.x;
    if(!start.dragging){
      const dy=Math.abs(e.clientY-start.y);
      if(dy>=10 && dy>=Math.abs(dx)){reset();return;}
      if(Math.abs(dx)<12 || Math.abs(dx)<dy*1.25)return;
      start.dragging=true;card.classList.add('dragging');
    }
    if (!frame) frame = requestAnimationFrame(paint);
  });
  function reset(keepPosition=false) {
    const pointer=start?.id;start=null;dx=0;
    cancelAnimationFrame(frame);frame=0;
    if(pointer!==undefined && card.hasPointerCapture(pointer))card.releasePointerCapture(pointer);
    card.classList.remove('dragging');
    if(!keepPosition){card.style.transform='';delete card.dataset.direction;card.querySelector('.swipe-label').style.opacity=0;}
  }
  card.addEventListener('pointerup', e => {
    if (!start || e.pointerId !== start.id) return;
    dx=e.clientX-start.x;
    const amount=dx,velocity=Math.abs(dx)/Math.max(1,e.timeStamp-start.time);
    const commit=start.dragging && (Math.abs(amount)>=threshold() || (Math.abs(amount)>=40 && velocity>=.55));
    if(commit)paint();
    reset(commit);if(commit)decide(amount>0?'prepare':'pass',job);
  });
  card.addEventListener('pointercancel',()=>reset());
  card.addEventListener('lostpointercapture', e => {if (e.target === card && start) reset();});
}

function wireTrackpadAndKeys() {
  let gesture=null, idleTimer;
  const blocked=()=>activeView!=='discover'||document.querySelector('dialog[open]')||$('active-card')?.classList.contains('highlighting')||!window.getSelection()?.isCollapsed;
  function finishGesture(){
    if(gesture && !gesture.committed && gesture.card.isConnected){
      gesture.card.classList.remove('dragging');gesture.card.style.transform='';
      delete gesture.card.dataset.direction;gesture.card.querySelector('.swipe-label').style.opacity=0;
    }
    gesture=null;clearTimeout(idleTimer);
  }
  $('job-deck').addEventListener('wheel',e=>{
    if(blocked() || e.ctrlKey || e.metaKey || e.altKey || e.target.closest('input,textarea,select,[contenteditable]'))return;
    const horizontal=Math.abs(e.deltaX)>Math.abs(e.deltaY)*1.6;
    if(!gesture && !horizontal)return;
    clearTimeout(idleTimer);idleTimer=setTimeout(finishGesture,350);
    if(gesture?.committed){if(horizontal)e.preventDefault();return;}
    if(!horizontal){finishGesture();return;}
    e.preventDefault();
    const card=$('active-card');if(!card || decisionPending || card.classList.contains('dragging')&&!gesture)return;
    if(gesture && gesture.card!==card)finishGesture();
    gesture||={card,job:deckJobs().find(j=>j.id===card.dataset.jobId),distance:0,events:0,committed:false};
    clearTimeout(idleTimer);idleTimer=setTimeout(finishGesture,350);
    const unit=e.deltaMode===1?16:e.deltaMode===2?card.clientWidth:1;
    // Wheel deltas describe scrolling; card movement follows the content under the fingers.
    gesture.distance-=Math.max(-90,Math.min(90,e.deltaX*unit));gesture.events++;
    const distance=gesture.distance*.55,threshold=Math.max(150,Math.min(180,card.clientWidth*.35));
    card.classList.add('dragging');card.style.transform=`translate3d(${distance}px,0,0) rotate(${Math.max(-8,Math.min(8,distance/30))}deg)`;
    const label=card.querySelector('.swipe-label');label.style.top=(card.scrollTop+Math.min(75,card.clientHeight/4))+'px';label.style.opacity=Math.min(1,Math.abs(distance)/threshold);label.textContent=distance>0?'APPLY':'PASS';card.dataset.direction=distance>0?'prepare':'pass';
    if(gesture.events>=4 && Math.abs(distance)>=threshold){
      gesture.committed=true;card.classList.remove('dragging');
      // Keep the notebook open for every gesture; offer a link if the browser blocks the tab.
      decide(distance>0?'prepare':'pass',gesture.job);
    }
  },{passive:false});
  document.addEventListener('keydown',e=>{
    if(blocked() || decisionPending || e.repeat || e.isComposing || e.ctrlKey || e.metaKey || e.altKey || e.shiftKey || e.target.closest?.('input,textarea,select,[contenteditable],[role="textbox"],[role="slider"],[role="listbox"]'))return;
    const action={ArrowLeft:'pass',ArrowRight:'prepare',s:'save'}[e.key];
    if(!action || !$('active-card'))return;
    e.preventDefault();finishGesture();decide(action);
  });
}

function showEntryHighlights(id) {
 const target=$('entry-highlights'),highlights=validHighlights(discovery.highlights?.[id]);
 target.hidden=!highlights.length;
 target.innerHTML=`<summary>Saved highlights (${highlights.length})</summary><ul>${highlights.map(h=>`<li><blockquote>${esc(h.quote)}</blockquote><button type="button" class="text-button" data-remove-highlight="${esc(h.id)}" aria-label="Remove highlight: ${esc(h.quote.slice(0,70))}">Remove</button></li>`).join('')}</ul>`;
 target.onclick=event=>{const remove=event.target.closest('[data-remove-highlight]');if(!remove)return;const next={...discovery,highlights:{...discovery.highlights,[id]:highlights.filter(h=>h.id!==remove.dataset.removeHighlight)}};if(persist(DISCOVERY_KEY,next)){discovery=next;showEntryHighlights(id);listingHighlights?.refresh();target.querySelector('summary').focus();}};
}
function openEditor(entry) {
  importController?.abort();importGeneration++;importedJob=null;importedFromURL='';
  form.reset();$('application-details').hidden=!entry;$('save-application').disabled=!entry;$('import-job-status').textContent='';$('retrieve-job').disabled=false;$('manual-job').hidden=!!entry;$('link').required=!entry;
  $('save-status').textContent = ''; $('delete-button').hidden = !entry; $('edit-materials').hidden = !entry || !['To apply','Preparing','Not applied'].includes(entry.status); $('editor-title').textContent = entry ? 'Edit application' : 'Add application';
  const map = {id:'entry-id',company:'company',title:'title',location:'location',status:'status',applicationDate:'application-date',interviewDate:'interview-date',followUpDate:'follow-up-date',link:'link',materials:'materials',requirements:'requirements',notes:'notes'};
  if (entry) Object.entries(map).forEach(([key,id]) => $(id).value = entry[key] || '');
  showEntryHighlights(entry?.id);
  editor.showModal();if(!entry)$('link').focus();
}
let importController=null,importGeneration=0,importedJob=null,importedFromURL='';
async function retrieveJob(){
 const url=safeURL($('link').value.trim());if(!url){$('import-job-status').textContent='Paste a valid public job link first.';return;}
 importController?.abort();const generation=++importGeneration;importController=new AbortController();
 const initial=Object.fromEntries(['company','title','location','requirements'].map(id=>[id,$(id).value]));
 $('retrieve-job').disabled=true;$('import-job-status').textContent='Retrieving the job listing…';
 try{
  const response=await fetch('/api/import-job',{method:'POST',headers:{'Content-Type':'application/json',...(browserConnection?{Authorization:'Bearer '+browserConnection}:{})},body:JSON.stringify({url}),signal:AbortSignal.any([importController.signal,AbortSignal.timeout(60000)])});
  const data=await response.json();if(!response.ok)throw Error(data.error||'The listing could not be read.');
  if(generation!==importGeneration||!editor.open||safeURL($('link').value.trim())!==url)return;
  importedJob=data.job;importedFromURL=url;for(const [id,key] of Object.entries({company:'company',title:'title',location:'location',requirements:'description'}))if($(id).value===initial[id])$(id).value=data.job[key]||'';
  $('application-details').hidden=false;$('save-application').disabled=false;
  const fit=discoveryFit(data.job,profile);
  $('import-job-status').textContent='Details retrieved from '+data.job.source+'. Review them before saving.'+(fit.report.skillsScore!==null?' CV skills evidence: '+(Math.round(fit.report.skillsScore*10)/10)+'/10.':'')+(!fit.eligible?' This role does not meet your Discover filters; you can still save it.':'');
 }catch(error){if(generation===importGeneration&&error.name!=='AbortError')$('import-job-status').textContent=error.message;}
 finally{if(generation===importGeneration)$('retrieve-job').disabled=false;}
}
$('retrieve-job').addEventListener('click',retrieveJob);
$('link').addEventListener('change',()=>{if(safeURL($('link').value.trim())&&safeURL($('link').value.trim())!==importedFromURL)retrieveJob();});
$('link').addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();retrieveJob();}});
$('manual-job').addEventListener('click',()=>{$('application-details').hidden=false;$('save-application').disabled=false;$('link').required=false;$('company').focus();});
editor.addEventListener('close',()=>{importController?.abort();importGeneration++;});
function upsert(event) {
  event.preventDefault(); const value = id => $(id).value.trim();
  if (value('link') && !safeURL(value('link'))) { $('save-status').textContent = 'Use an http or https application link.'; return; }
  const previous = entries.find(e => e.id === value('entry-id'));
  const data = {...previous,...(importedJob?{description:importedJob.description,sourceDescription:importedJob.description,source:importedJob.source,publishedAt:importedJob.publishedAt,expiresAt:importedJob.expiresAt,remote:importedJob.remote}:{}),id:value('entry-id') || crypto.randomUUID?.() || 'local-'+Array.from(crypto.getRandomValues(new Uint8Array(16)),b=>b.toString(16).padStart(2,'0')).join(''),company:value('company'),title:value('title'),location:value('location'),status:$('status').value,applicationDate:$('application-date').value,interviewDate:$('interview-date').value,followUpDate:$('follow-up-date').value,link:value('link'),materials:value('materials'),requirements:value('requirements'),notes:value('notes')};
  if (!data.company || !data.title) return;
  if(importedJob||previous?.description)data.description=data.requirements;
  if(data.status!==previous?.status)Object.assign(data,changeApplicationStatus(data,data.status,today()));
  if (previous) entries = entries.map(e => e.id === data.id ? data : e); else entries.unshift(data);
  if (saveEntries()) {render(); editor.close(); toast('Application saved on this device.');}
}
function openPreparation(id) {
  const entry = entries.find(e => e.id === id); if (!entry) return;
  if (!entry.preparation) {entry.preparation = prepareApplication(entry,profile); entry.status = 'Preparing'; saveEntries(); render();}
  preparationId = id;
  const p = entry.preparation, match = matchJob(entry,profile);
  $('preparation-title').textContent = entry.company;
  $('preparation-content').innerHTML = `<p class="prep-meta">${esc(entry.title)} · ${esc(entry.location)}</p><div class="flag-box"><strong>Check before submitting</strong><ul>${(match.eligible ? match.flags : match.flags.concat('Review this role against your current preferences.')).map(f => `<li>${esc(f)}</li>`).join('')}</ul></div><section class="prep-section"><h3>1. Your CV</h3><label class="cv-choice-label" for="prep-cv-choice">Choose a CV</label><select id="prep-cv-choice">${['Consulting CV','Business Analyst CV','Full Stack Developer CV'].map(cv => `<option ${p.cv === cv ? 'selected' : ''}>${esc(cv)}</option>`).join('')}</select><p><strong>${esc(p.cv)}</strong>${p.cvFile ? ' · '+esc(p.cvFile) : ''}</p><p id="prep-cv-status">Checking your CV library…</p><button class="secondary-button" id="download-cv" hidden>Download this CV</button></section><section class="prep-section"><h3><label for="prep-pitch">2. Your introduction · editable draft</label></h3><textarea id="prep-pitch" rows="7">${esc(p.pitch)}</textarea><p class="small-note">Built from your saved profile. Review the wording and relevance for this role.</p></section><section class="prep-section"><h3>3. Practical answers</h3><p><strong>Earliest start:</strong> ${esc(p.startDate ? dateText(p.startDate) : 'Add your start date in Profile')}</p><p><strong>Languages:</strong> ${esc(p.languages)}</p><p><strong>Work-authorisation reference:</strong><br>${esc(p.workRights)}</p><p>Confirm country-specific questions yourself. The autofill helper leaves eligibility, sponsorship and salary questions for you.</p></section><section class="prep-section"><h3>4. Review & apply</h3><div class="prep-checks">${Object.entries({listing:'I checked the original listing is open and the role fits.',eligibility:'I checked language, start date and work-permit questions.',cv:'I attached the right CV on the employer’s form.',answers:'I reviewed the form and my answers.'}).map(([key,label]) => `<label><input type="checkbox" data-check="${key}" ${p.checks[key] ? 'checked' : ''} />${label}</label>`).join('')}</div><div class="prep-buttons">${safeURL(entry.link) ? `<a class="primary-button" href="${esc(safeURL(entry.link))}" target="_blank" rel="noopener noreferrer">Open application ↗</a>` : '<p>Add the application link in Edit notes.</p>'}<button class="secondary-button" id="copy-pack">Copy autofill pack</button><button class="secondary-button" id="download-draft">Download draft</button></div><details class="job-details"><summary>How to autofill an employer’s form</summary><p>Install the Job notebook autofill helper from the project’s autofill-extension folder using Chrome or Edge’s “Load unpacked” option. Open the employer’s actual application form, click the extension, paste your autofill pack and choose “Fill standard fields”. It can fill name, email, phone, LinkedIn and a cover-letter text field. It never submits. Attach your CV and review all questions yourself. Embedded forms may need to be opened in their own tab. See the project README for setup.</p></details><p class="source-note">Draft preparation saves work in this notebook. Mark it submitted only after you finish on the employer’s website.</p></section>`;
  $('mark-applied').disabled = !Object.values(p.checks).every(Boolean);
  if (!$('preparation-dialog').open) $('preparation-dialog').showModal();
  showPrepCV(p.cv);
}
function persistPreparation() {
  const entry = entries.find(e => e.id === preparationId); if (!entry) return false;
  entry.preparation.pitch = $('prep-pitch').value;
  document.querySelectorAll('[data-check]').forEach(input => entry.preparation.checks[input.dataset.check] = input.checked);
  return saveEntries();
}
function download(data, name, type = 'application/json') {
  const url = URL.createObjectURL(new Blob([data],{type})); const a = document.createElement('a'); a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url),1000);
}
function draftText(entry) {const p = entry.preparation; return `${entry.company} — ${entry.title}\n${entry.link}\n\nCV: ${p.cv}${p.cvFile ? ' — '+p.cvFile : ''}\nStart: ${p.startDate || 'Not set'}\nLanguages: ${p.languages}\n\nWork-authorisation reference (review for this country):\n${p.workRights}\n\nIntroduction draft:\n${p.pitch}\n\nThis is a draft. Submission is not recorded until you confirm it.\n`;}
async function copyPack() {
  persistPreparation();
  const entry = entries.find(e => e.id === preparationId);
  const pack = JSON.stringify({version:1,company:entry.company,role:entry.title,fields:{name:profile.name,email:profile.email,phone:profile.phone,linkedin:profile.linkedin,coverLetter:entry.preparation.pitch}},null,2);
  try {await navigator.clipboard.writeText(pack); toast('Autofill pack copied. Paste it into the helper on the employer’s form.');}
  catch {download(pack,'job-notebook-autofill.json'); toast('Clipboard unavailable. Open the downloaded pack and paste it into the helper.');}
}
function updateCVProfileSummary() {
  const imported=!!profile.cvImportSources;
  $('cv-profile-source').textContent=imported?'Filled from your CVs, including any corrections you saved. No need to enter these details again.':'Upload your CVs above to fill this profile. Any details already saved appear below.';
  $('cv-profile-summary').innerHTML=[['Name',profile.name],['Email',profile.email],['Phone',profile.phone],['LinkedIn',profile.linkedin],['Languages',imported||profile.evidence?profile.languages:'']].filter(([,value])=>value).map(([label,value])=>`<div><dt>${esc(label)}</dt><dd>${esc(value)}</dd></div>`).join('');
  $('cv-profile-experience').textContent=profile.evidence?.trim()?'Your saved experience, skills and qualifications are used for job matching. Review them only if a correction is needed.':'No experience details saved yet. Upload your CVs to start matching jobs.';
}
function populateProfile() {for (const [key,value] of Object.entries(profile)) {const el = $(`profile-${key}`); if (el) el.type === 'checkbox' ? el.checked = value : el.value = value;} $('cv-json-status').textContent=profile.cvImportSources?'Imported details from: '+profile.cvImportSources.split('\n').join(', '):'No CV details uploaded yet.'; updateCVProfileSummary(); updateCVStatuses();}
function saveProfile(event) {
  event.preventDefault(); const next = {...profile};
  for (const key of Object.keys(defaultProfile)) {const el = $(`profile-${key}`); if (el) next[key] = el.type === 'checkbox' ? el.checked : el.value.trim();}
  profile = validateProfile(next);
  if (persist(PROFILE_KEY,profile)) {updateCVProfileSummary();$('profile-message').textContent = 'Saved. New drafts will use this profile.'; restartDiscovery(); toast('Profile saved. Suggestions now reflect your preferences.');}
}
function exportData() {download(JSON.stringify({version:2,exportedAt:new Date().toISOString(),entries,profile,discovery},null,2),`job-notebook-backup-${today()}.json`); $('backup-message').textContent = 'Backup downloaded, including your profile and swipe history. CV PDFs are separate; keep their original files.';}
async function importData(file) {
  try {
    if (file.size > 25 * 1024 * 1024) throw new Error('Backup too large');
    const parsed = JSON.parse(await file.text());
    const nextEntries = validateEntries(parsed.entries);
    const nextProfile = parsed.profile ? validateProfile(parsed.profile) : profile;
    const nextDiscovery = parsed.discovery || {jobs:[],decisions:{},fetchedAt:''};
    if (!Array.isArray(nextDiscovery.jobs) || !nextDiscovery.decisions || typeof nextDiscovery.decisions !== 'object' || Array.isArray(nextDiscovery.decisions)) throw new Error('Invalid discovery');
    if (nextDiscovery.jobs.some(j => !j || typeof j.id !== 'string' || typeof j.company !== 'string' || typeof j.title !== 'string' || !safeURL(j.link))) throw new Error('Invalid job');
    if (!confirm(`Restore ${nextEntries.length} applications? This replaces the current notebook, profile and swipe history. Download a backup first if you want to keep them.`)) return;
    entries = nextEntries; profile = nextProfile; discovery = nextDiscovery; undoAction = null;pinnedJobId=null;feedError=false;autoBudget=12;if(!Object.hasOwn(discovery,'nextPage'))discovery.nextPage=discovery.fetchedAt?4:1;
    const saved = saveEntries() & persist(PROFILE_KEY,profile) & saveDiscovery();
    render(); populateProfile(); $('backup-message').textContent = saved ? 'Backup restored. CV files already on this device are unchanged.' : 'Restored in memory, but device storage failed. Download a backup before closing.';
  } catch {$('backup-message').textContent = 'That file is not a valid Job notebook backup. Your notebook has not been replaced.';}
}
// PDFs stay in IndexedDB; no backend upload and no PDF bytes in localStorage/backups.
let dbPromise;
function cvDB() {
  return dbPromise ||= new Promise((resolve,reject) => {const request = indexedDB.open('job-notebook-cvs',1); request.onupgradeneeded = () => request.result.createObjectStore('files'); request.onsuccess = () => resolve(request.result); request.onerror = () => {dbPromise = null; reject(request.error);};});
}
async function cvStore(mode, key, value) {
  if(mode!=='get'&&localStorage.getItem('job-notebook-importing'))throw Error('Device import in progress. Try again shortly.');
  const db = await cvDB();
  return new Promise((resolve,reject) => {const transaction = db.transaction('files',mode === 'get' ? 'readonly' : 'readwrite'); const store = transaction.objectStore('files'); const request = mode === 'get' ? store.get(key) : mode === 'delete' ? store.delete(key) : store.put(value,key); transaction.oncomplete = () => {if(mode!=='get')document.dispatchEvent(new Event('notebook-change'));resolve(request.result);}; transaction.onerror = () => reject(transaction.error); transaction.onabort = () => reject(transaction.error);});
}
async function updateCVStatuses() {
  for (const key of ['consulting','analyst','developer']) {
    try {const stored = await cvStore('get',key); $(`${key}-file-status`).textContent = stored ? `${stored.name} · ready on this device` : 'No PDF stored'; $(`${key}-remove`).hidden = !stored; $(`${key}-download`).hidden = !stored;}
    catch {$(`${key}-file-status`).textContent = 'PDF storage unavailable in this browser.';}
  }
}
async function storeCVBatch(records) {
  if(localStorage.getItem('job-notebook-importing'))throw Error('Device import in progress. Try again shortly.');
  const db=await cvDB();
  await new Promise((resolve,reject)=>{
    const transaction=db.transaction('files','readwrite'),store=transaction.objectStore('files');
    for(const [key,value] of records)value?store.put(value,key):store.delete(key);
    transaction.oncomplete=resolve;transaction.onerror=()=>reject(transaction.error);transaction.onabort=()=>reject(transaction.error);
  });
  document.dispatchEvent(new Event('notebook-change'));
}

async function showPrepCV(cv) {
  try {
    const stored = await cvStore('get',cvKey(cv));
    if (!$('prep-cv-status')) return;
    $('prep-cv-status').textContent = stored ? `${stored.name} is ready on this device. Download it and attach it on the employer’s form.` : 'Upload this PDF in My profile, or attach your existing file directly on the employer’s form.';
    $('download-cv').hidden = !stored;
  } catch {if ($('prep-cv-status')) $('prep-cv-status').textContent = 'PDF storage unavailable. Attach your existing CV directly on the employer’s form.';}
}
async function downloadCV() {
  const entry = entries.find(e => e.id === preparationId);
  try {const stored = await cvStore('get',cvKey(entry.preparation.cv)); if (stored) download(stored.blob,stored.name,'application/pdf');}
  catch {toast('Could not read the CV. Attach your original file.');}
}
let browserConnection=null,browserConnectionVerified=false, browserController=null, browserEntryId=null, browserSessionId=null, browserRun=0;
async function loadBrowserConnection(restore=true) {
  try {browserConnection=(await cvStore('get','connection'))?.token||null;}catch{browserConnection=null;}
  browserConnectionVerified=false;
  $('browser-connection-status').textContent=browserConnection?'Checking your private connection…':'Connect or restore this device to enable full reviews and access saved CVs.';
  $('check-private-connection').disabled=true;
  $('load-saved-cvs').disabled=!browserConnection;
  if(restore&&browserConnection&&!await deviceItem('device-sync')){const files=await Promise.all(['consulting','analyst','developer'].map(key=>cvStore('get',key)));if(files.some(file=>!file))await loadSavedCVs({missingOnly:true});}
  if(browserConnection)try{
   const response=await fetch('/api/setup',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${browserConnection}`},body:JSON.stringify({action:'profile-corrections'}),signal:AbortSignal.timeout(15000)});
   if(!response.ok)throw Error(response.status===401?'The private setup was not accepted. Import your connection file again.':'The server could not verify your connection. Try Check connection again.');
   browserConnectionVerified=true;fitReviewErrors.clear();fitReviewRetries.clear();
   $('browser-connection-status').textContent=reviewServiceIssue?'Private connection verified. '+reviewServiceIssue:'Private connection verified. Full CV reviews are enabled.';
   const {correction,reviewProvider}=await response.json();
   if(reviewProvider?.provider==='openai'){
    reviewServiceIssue=reviewProvider.configured?null:'OpenAI setup is needed: add OPENAI_API_KEY in Vercel’s production environment settings and redeploy. Your saved CVs are ready.';
    $('browser-connection-status').textContent='Private connection verified. '+(reviewServiceIssue||'GPT-6 Luna is configured; open a job to check its review.');
   }
   const corrected=applyProfileCorrections(profile,correction);
   if(corrected!==profile){profile=validateProfile(corrected);persist(PROFILE_KEY,profile);populateProfile();renderDeck();}
  }catch(error){$('browser-connection-status').textContent=error.name==='TimeoutError'?'Connection check timed out. Try Check connection again.':error.message;}
  $('check-private-connection').disabled=!browserConnection;
  updateReviewStatus();
  const job=deckJobs()[0]||nextReviewCandidate();if(job){const region=$('role-summary');if(region)region.innerHTML=summaryMarkup(job);requestSummary(job);scheduleFitReview(job);}else renderDeck();
  $('test-browser').disabled=!browserConnection;$('disconnect-browser').hidden=!browserConnection;
}
function releaseBrowserSession() {
  if(browserSessionId)fetch('/api/browser',{method:'POST',keepalive:true,headers:{'Content-Type':'application/json',Authorization:`Bearer ${browserConnection}`},body:JSON.stringify({sessionId:browserSessionId,action:'end'})}).catch(()=>{});
  browserSessionId=null;
}
function endApplicationBrowser() {
  releaseBrowserSession();
  browserRun++;browserController?.abort();browserController=null;
  $('browser-live').hidden=true;$('browser-live').removeAttribute('src');$('browser-dialog').close();
}
async function startApplicationBrowser(job,entryId,{demo=false}={}) {
  releaseBrowserSession();browserController?.abort();const run=++browserRun;const controller=new AbortController();browserController=controller;browserEntryId=entryId;
  $('browser-title').textContent=demo?'Practice application':job.company;
  $('browser-progress').textContent='Reading your saved details and selected CV…';$('browser-report').textContent='';
  $('browser-original').href=safeURL(job.link);$('browser-submitted').hidden=true;
  $('browser-live').hidden=true;$('browser-live').removeAttribute('src');$('browser-keyboard').hidden=true;
  if(!$('browser-dialog').open)$('browser-dialog').showModal();
  try {
    const cv=await cvStore('get',demo?'consulting':cvKey(job.match?.cv||entries.find(e=>e.id===entryId)?.preparation?.cv||'Consulting CV'));
    if(!cv||!profile.name||!profile.email)throw new Error('Upload your CVs in My profile and save the reviewed contact details before preparing an application.');
    if(cv.blob.size>2500000)throw new Error('This PDF is too large for browser preparation (2.5 MB maximum). Download it from My profile and use Open original.');
    const base64=await new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result.split(',')[1]);r.onerror=reject;r.readAsDataURL(cv.blob);});
    if(run!==browserRun)return;
    const response=await fetch('/api/prepare',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${browserConnection}`},body:JSON.stringify({url:job.link,title:job.title,company:job.company,demo,fields:{name:profile.name,email:profile.email,phone:profile.phone,linkedin:profile.linkedin},cv:{name:cv.name,base64}}),signal:controller.signal});
    if(!response.ok){const data=await response.json().catch(()=>({}));throw new Error(data.error||'Browser preparation is unavailable. Use Open original to continue.');}
    const reader=response.body.getReader(),decoder=new TextDecoder();let pending='';
    while(true){const {value,done}=await reader.read();if(done)break;pending+=decoder.decode(value,{stream:true});let line;
      while((line=pending.indexOf('\n'))>=0){const raw=pending.slice(0,line);pending=pending.slice(line+1);if(!raw.trim())continue;const message=JSON.parse(raw);if(run!==browserRun)return;
        if(message.type==='session')browserSessionId=message.sessionId;
        if(message.type==='progress')$('browser-progress').textContent=message.message;
        if(message.type==='review'){
          const live=new URL(message.liveUrl);if(live.protocol!=='https:'||!(live.hostname==='browserbase.com'||live.hostname.endsWith('.browserbase.com')))throw new Error('Invalid browser review link.');
          live.searchParams.set('navbar','false');$('browser-keyboard').hidden=false;$('browser-live').src=live.href;$('browser-live').hidden=false;
          $('browser-progress').textContent='Review the actual form below. This session closes in about 3 minutes; keep this screen open.';
          $('browser-report').textContent=message.message+' '+(message.filled?.length||0)+' contact fields filled. '+(message.cvAttached?'CV attached.':'CV not attached.')+(message.remaining?.length?' Remaining questions: '+message.remaining.join(', ')+'.':'');
          $('browser-submitted').hidden=demo;
        }
        if(message.type==='error')throw new Error(message.message);
        if(message.type==='ended'){$('browser-progress').textContent=message.message;$('browser-live').hidden=true;$('browser-live').removeAttribute('src');}
      }
    }
    if(run===browserRun){$('browser-progress').textContent='Session ended. Your saved notebook and CVs are unchanged.';$('browser-live').hidden=true;$('browser-live').removeAttribute('src');}
  }catch(error){if(run===browserRun&&error.name!=='AbortError'){$('browser-progress').textContent=error.message||'Could not prepare this application.';$('browser-live').hidden=true;$('browser-live').removeAttribute('src');}}
}
for(const button of document.querySelectorAll('[data-browser-input]'))button.addEventListener('click',async()=>{
  const action=button.dataset.browserInput,text=$('browser-text').value;if(!browserSessionId||(action==='type'&&!text))return;
  button.disabled=true;
  try{const response=await fetch('/api/browser',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${browserConnection}`},body:JSON.stringify({sessionId:browserSessionId,action,text})});if(!response.ok)throw new Error('Could not send input. Check that the session is still open.');if(action==='type')$('browser-text').value='';}
  catch(error){toast(error.message);}finally{button.disabled=false;}
});
window.addEventListener('pagehide',releaseBrowserSession);
$('close-browser').addEventListener('click',endApplicationBrowser);$('browser-end').addEventListener('click',endApplicationBrowser);
$('browser-dialog').addEventListener('cancel',e=>{e.preventDefault();endApplicationBrowser();});
$('browser-submitted').addEventListener('click',()=>{const entry=entries.find(e=>e.id===browserEntryId);if(entry){entry.status='Applied';entry.applicationDate=today();saveEntries();undoAction=null;render();}endApplicationBrowser();toast('Recorded as submitted by you.');});
$('test-browser').addEventListener('click',()=>startApplicationBrowser({company:'Job Notebook Practice',title:'Implementation Consultant',link:'https://job-hunting-notes.vercel.app/practice-application.html'},null,{demo:true}));
$('check-private-connection').addEventListener('click',()=>loadBrowserConnection(false));
$('disconnect-browser').addEventListener('click',async()=>{await cvStore('delete','connection');await loadBrowserConnection();toast('Private browser disconnected from this device.');});
loadBrowserConnection();
// Event bindings
wireTrackpadAndKeys();
for (const button of document.querySelectorAll('button[data-view]')) button.addEventListener('click', () => setView(button.dataset.view));
window.addEventListener('hashchange', () => setView(location.hash.slice(1)));
$('refresh-jobs').addEventListener('click',refreshJobs);
$('refresh-app').addEventListener('click', async () => {
  const button = $('refresh-app');
  button.disabled = true; button.textContent = 'Updating…';
  try {
    const url = new URL(location.href); url.searchParams.set('app-refresh', Date.now());
    const response = await fetch(url, {cache:'no-store', signal:AbortSignal.timeout(12000)});
    if (!response.ok) throw new Error('Update unavailable');
    if ('serviceWorker' in navigator) {
      const registration = await navigator.serviceWorker.getRegistration();
      if (registration) {
        await Promise.race([registration.update().catch(() => {}),new Promise(resolve => setTimeout(resolve,3000))]);
        const worker = registration.installing || registration.waiting;
        if (worker && worker.state !== 'activated') await new Promise(resolve => {
          const done = () => {clearTimeout(timer); worker.removeEventListener('statechange',changed); resolve();};
          const changed = () => {if (['activated','redundant'].includes(worker.state)) done();};
          const timer = setTimeout(done,4000); worker.addEventListener('statechange',changed); changed();
        });
      }
    }
    location.replace(url.href);
  } catch {
    toast('Couldn’t update the app. Check your connection and try Refresh again. Your saved data is safe.');
    button.disabled = false; button.textContent = '↻ Refresh';
  }
});

$('close-role').addEventListener('click', () => $('role-dialog').close());
$('role-prepare').addEventListener('click', () => {const job = selectedRole; $('role-dialog').close(); if (job) decide('prepare', job);});
$('pass-job').addEventListener('click',() => decide('pass'));
$('save-job').addEventListener('click',() => decide('save'));
$('prepare-job').addEventListener('click',() => decide('prepare'));
$('undo-swipe').addEventListener('click',undoSwipe);
$('location-filter').addEventListener('click',()=>openLocations());
$('profile-search-filters').addEventListener('click',()=>openLocations());
$('experience-filter').addEventListener('click',()=>openLocations(true));
$('close-locations').addEventListener('click',()=>$('location-dialog').close());
$('filter-region').addEventListener('change',()=>{$('filter-country-group').hidden=$('filter-region').value!=='europe';$('filter-country').value='';});
$('apply-locations').addEventListener('click',()=>applyLocations());
$('reset-locations').addEventListener('click',()=>applyLocations(true));
$('load-more-jobs').addEventListener('click',()=>{autoBudget=12;refreshJobs(true);});
$('retry-jobs').addEventListener('click',()=>{autoBudget=12;refreshJobs(feedError&&hasMoreJobs());});
$('job-deck').addEventListener('click',e => {if(e.target.closest('[data-change-locations]'))openLocations();if (e.target.closest('[data-read-role]')) {const text=document.querySelector('.source-description');if(text){text.open=true;text.scrollIntoView({block:'start',behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});}} if (e.target.closest('[data-role-details]')) openRoleDetails(); if (e.target.closest('#empty-refresh')) {autoBudget=12;refreshJobs(hasMoreJobs());} if (e.target.closest('#revisit-passed')) {Object.keys(discovery.decisions).forEach(id => {if (discovery.decisions[id] === 'pass') delete discovery.decisions[id];}); discovery.nextPage=1;autoBudget=12;feedError=false;saveDiscovery();renderDeck();refreshJobs();}});
$('applications').addEventListener('click',e => {const edit=e.target.closest('[data-edit]');if(edit)openEditor(entries.find(item=>item.id===edit.dataset.edit));});
$('applications').addEventListener('change',e=>{
 const control=e.target.closest('[data-status-id]');if(!control)return;
 const entry=entries.find(item=>item.id===control.dataset.statusId);if(!entry)return;
 const status=control.value;
 if(status==='delete'&&!confirm(`Delete ${entry.company} — ${entry.title} and its notes?`)){control.value=entry.status;return;}
 const next=status==='delete'?entries.filter(item=>item.id!==entry.id):entries.map(item=>item.id===entry.id?changeApplicationStatus(item,status,today()):item);
 if(!persist(KEY,next)){control.value=entry.status;return;}
 entries=next;undoAction=null;render();
 const nextControl=[...document.querySelectorAll('[data-status-id]')].find(el=>el.dataset.statusId===entry.id);
 (nextControl||document.querySelector('.filter.active'))?.focus();
 toast(status==='delete'?'Application deleted.':`Status updated to ${status==='To apply'?'Saved':status}.`);
});
$('edit-materials').addEventListener('click',()=>{const id=$('entry-id').value;editor.close();openPreparation(id);});
$('add-button').addEventListener('click',() => openEditor()); $('empty-add-button').addEventListener('click',() => openEditor()); $('close-editor').addEventListener('click',() => editor.close()); form.addEventListener('submit',upsert);
$('delete-button').addEventListener('click',() => {if (!confirm('Delete this application and its notes?')) return; const id = $('entry-id').value; entries = entries.filter(e => e.id !== id); if (saveEntries()) {render(); editor.close();}});
$('search-input').addEventListener('input',render);
document.querySelectorAll('.filter').forEach(button => button.addEventListener('click',() => {activeFilter = button.dataset.filter; document.querySelectorAll('.filter').forEach(b => b.classList.toggle('active',b === button)); render();}));
document.querySelectorAll('[data-notebook-filter]').forEach(button => button.addEventListener('click',() => {
  activeFilter=button.dataset.notebookFilter; $('search-input').value='';
  document.querySelectorAll('.filter').forEach(b=>b.classList.toggle('active',b.dataset.filter===activeFilter));
  render(); setView('notebook');
}));
$('backup-button').addEventListener('click',() => backup.showModal()); $('close-backup').addEventListener('click',() => backup.close()); $('export-button').addEventListener('click',exportData);
$('import-input').addEventListener('change',e => {if (e.target.files[0]) importData(e.target.files[0]); e.target.value = '';});
$('profile-form').addEventListener('submit',saveProfile);
$('profile-form').addEventListener('invalid', e => {const section = e.target.closest('details'); if (section) section.open = true;}, true);
let cvImportDraft=null,cvImportPDFs=[],cvSaveBusy=false;
async function reviewCVFiles(files){
 if(!files.length)return;
 if(files.length>3)throw Error('Choose up to three CV files.');
 const documents=[],pdfs=[];
 for(const file of files){
  $('cv-json-status').textContent='Reading '+file.name+'…';
  if(/\.pdf$/i.test(file.name)||file.type==='application/pdf'){
   documents.push(await parseCVPDF(file));pdfs.push(file);
  }else if(/\.json$/i.test(file.name)||file.type==='application/json'){
   if(file.size>2*1024*1024)throw Error('Each CV JSON must be smaller than 2 MB.');
   documents.push(parseCVJSON(JSON.parse(await file.text()),file.name));
  }else throw Error('Choose a CV PDF or JSON file.');
 }
 const current={...profile};
 for(const key of Object.keys(defaultProfile)){const el=$('profile-'+key);if(el)current[key]=el.type==='checkbox'?el.checked:el.value.trim();}
 cvImportDraft=mergeCVImports(documents,validateProfile(current));cvImportPDFs=pdfs;
 $('cv-import-files').textContent=documents.map(d=>d.filename).join(' · ');
 $('cv-import-pdfs').hidden=!pdfs.length;
 $('cv-import-pdfs').innerHTML=pdfs.map((file,index)=>{
  const key=/analyst|business[ _-]*analys/i.test(file.name)?'analyst':/developer|full[ _-]*stack/i.test(file.name)?'developer':/consult/i.test(file.name)?'consulting':['consulting','analyst','developer'][index];
  return `<label>${esc(file.name)}<select data-pdf-index="${index}" aria-label="CV version for ${esc(file.name)}">${Object.entries({consulting:'Consulting CV',analyst:'Business Analyst CV',developer:'Full Stack Developer CV'}).map(([value,label])=>`<option value="${value}" ${value===key?'selected':''}>${label}</option>`).join('')}</select></label>`;
 }).join('');
 for(const key of ['name','email','phone','linkedin','languages','evidence'])$('cv-import-'+key).value=cvImportDraft[key];
 $('cv-json-status').textContent='CV details read. Review and save to use them for matching'+(pdfs.length?' and keep the PDFs for applications.':'.');
 $('cv-import-error').textContent='';$('cv-import-dialog').showModal();
}
$('cv-json-upload').addEventListener('change',async e=>{
 const input=e.target;input.disabled=true;
 try{await reviewCVFiles([...input.files]);}catch(error){cvImportDraft=null;cvImportPDFs=[];$('cv-json-status').textContent='Could not read CV: '+error.message;}
 finally{input.value='';input.disabled=false;}
});
$('cv-import-close').addEventListener('click',()=>{$('cv-import-dialog').close();cvImportDraft=null;cvImportPDFs=[];$('cv-json-status').textContent='Upload cancelled. Your saved CVs and profile are unchanged.';});
$('cv-import-dialog').addEventListener('cancel',event=>{if(cvSaveBusy){event.preventDefault();return;}cvImportDraft=null;cvImportPDFs=[];$('cv-json-status').textContent='Upload cancelled. Your saved CVs and profile are unchanged.';});
$('cv-import-form').addEventListener('submit',async e=>{
 e.preventDefault();if(!cvImportDraft)return;
 const saveButton=e.submitter||$('cv-import-form').querySelector('button[type="submit"]');saveButton.disabled=true;cvSaveBusy=true;$('cv-import-close').disabled=true;
 const changes=[],previous=[];let filesStored=false;
 try{
  const next={...cvImportDraft};for(const key of ['name','email','phone','linkedin','languages','evidence'])next[key]=$('cv-import-'+key).value.trim();
  const choices=[...$('cv-import-pdfs').querySelectorAll('select')];
  if(new Set(choices.map(select=>select.value)).size!==choices.length)throw Error('Choose a different CV version for each PDF so one file does not overwrite another.');
  for(const [index,file] of cvImportPDFs.entries()){
   const key=choices[index].value;if(!['consulting','analyst','developer'].includes(key))throw Error('Choose a valid CV version.');
   next[{consulting:'consultingCV',analyst:'analystCV',developer:'developerCV'}[key]]=file.name;
   previous.push([key,await cvStore('get',key)]);changes.push([key,{name:file.name,blob:file,uploadedAt:new Date().toISOString()}]);
  }
  const reviewed=validateProfile(next);
  if(changes.length){await storeCVBatch(changes);filesStored=true;}
  if(!persist(PROFILE_KEY,reviewed))throw Error('Could not save on this device. Your review is still open.');
  profile=reviewed;matchCache=new WeakMap();populateProfile();render();cvImportDraft=null;cvImportPDFs=[];$('cv-import-dialog').close();
  $('profile-message').textContent='CV details saved'+(changes.length?' with '+changes.length+' PDF'+(changes.length===1?'':'s'):'')+'. Job comparisons now use your reviewed experience.';
  restartDiscovery();
 }catch(error){if(filesStored)try{await storeCVBatch(previous);}catch{updateCVStatuses();} $('cv-import-error').textContent=error.message;}
 finally{saveButton.disabled=false;cvSaveBusy=false;$('cv-import-close').disabled=false;}
});

async function importSetup(parsed) {
    const token=typeof parsed?.automationToken==='string'&&/^[A-Za-z0-9_-]{40,100}$/.test(parsed.automationToken)?parsed.automationToken:null;
    const connectionOnly=token&&!parsed.profile&&!Object.keys(defaultProfile).some(key=>key in parsed);
    const next = connectionOnly?{...profile}:validateProfile(parsed?.profile || parsed);
    const cvs = [];
    if (parsed.cvs) {
      for (const key of ['consulting','analyst','developer']) {
        const cv = parsed.cvs[key]; if (!cv) continue;
        if (typeof cv.name !== 'string' || typeof cv.base64 !== 'string' || cv.base64.length > 21*1024*1024) throw new Error('Invalid CV in setup file.');
        const bytes = Uint8Array.from(atob(cv.base64), c => c.charCodeAt(0));
        if (new TextDecoder().decode(bytes.slice(0,5)) !== '%PDF-') throw new Error('Invalid PDF in setup file.');
        cvs.push([key,{name:cv.name,blob:new Blob([bytes],{type:'application/pdf'}),uploadedAt:new Date().toISOString()}]);
      }
    }
    for (const [key,cv] of cvs) await cvStore('put',key,cv);
    if (token) await cvStore('put','connection',{token});
    profile = next;
    if (persist(PROFILE_KEY,profile)) {populateProfile(); render(); $('profile-message').textContent = `Profile imported${cvs.length ? ' with '+cvs.length+' CV PDFs' : ''}. New drafts will use these details.`;}
    await loadBrowserConnection(false);
    if(connectionOnly)$('profile-message').textContent=(browserConnectionVerified?'Private connection verified.':'Connection file saved; check the connection status below.')+' Your existing CVs and profile are preserved.';
}
async function loadSavedCVs({missingOnly=false}={}) {
  if(!browserConnection)return;
  $('saved-cv-status').textContent='Loading your privately saved CVs…';
  try{const response=await fetch('/api/setup',{method:'POST',headers:{Authorization:`Bearer ${browserConnection}`}});const data=await response.json();if(!response.ok)throw new Error(data.error||'Could not load saved CVs.');
    // Preserve edits on an already configured device; restore the PDF library.
    if(profile.name)data.profile={...data.profile,...profile};
    if(missingOnly)for(const key of ['consulting','analyst','developer'])if(await cvStore('get',key))delete data.cvs[key];
    await importSetup(data);$('saved-cv-status').textContent='All three saved CVs are ready on this device.';
  }catch(error){$('saved-cv-status').textContent=error.message;}
}
$('load-saved-cvs').addEventListener('click',loadSavedCVs);
$('profile-import').addEventListener('change',async e => {
  const file=e.target.files[0];if(!file)return;
  try{if(file.size>65*1024*1024)throw new Error('Setup file is too large.');await importSetup(JSON.parse(await file.text()));
  } catch (error) {toast(error.message === 'Invalid profile' ? 'Choose a Job notebook profile or setup file.' : `Could not import setup: ${error.message}`);}
  e.target.value = '';
});
for (const key of ['consulting','analyst','developer']) {
  $(`${key}-download`).addEventListener('click', async () => {try {const cv = await cvStore('get', key); if (cv) download(cv.blob, cv.name, 'application/pdf');} catch {toast('Could not read this PDF.');}});
  $(`${key}-remove`).addEventListener('click',async () => {try {await cvStore('delete',key); updateCVStatuses(); toast('Stored PDF removed from this device.');} catch {toast('Could not remove the PDF.');}});
}
$('close-preparation').addEventListener('click',() => {if (persistPreparation()) $('preparation-dialog').close();});
$('preparation-dialog').addEventListener('cancel',() => persistPreparation());
$('save-preparation').addEventListener('click',() => {if (persistPreparation()) toast('Draft saved on this device.');});
$('preparation-content').addEventListener('change',e => {
  if (e.target.id === 'prep-cv-choice') {
    persistPreparation();
    const entry = entries.find(e => e.id === preparationId);
    entry.preparation.cv = e.target.value;
    entry.preparation.cvFile = profile[cvKey(e.target.value)+'CV'];
    entry.preparation.checks.cv = false;
    entry.materials = e.target.value;
    saveEntries(); openPreparation(entry.id);
  }
if (e.target.matches('[data-check]')) {persistPreparation(); $('mark-applied').disabled = !Array.from(document.querySelectorAll('[data-check]')).every(el => el.checked);}});
$('preparation-content').addEventListener('click',e => {if (e.target.closest('#copy-pack')) copyPack(); if (e.target.closest('#download-draft')) {persistPreparation(); const entry = entries.find(e => e.id === preparationId); download(draftText(entry),`${entry.company.replace(/[^a-z0-9]/gi,'-')}-application-draft.txt`,'text/plain');} if (e.target.closest('#download-cv')) downloadCV();});
$('mark-applied').addEventListener('click',() => {if ($('mark-applied').disabled) return; persistPreparation(); const entry = entries.find(e => e.id === preparationId); entry.status = 'Applied'; entry.applicationDate = today(); if (saveEntries()) {$('preparation-dialog').close(); undoAction = null; render(); toast('Application recorded as submitted. One more step forward.');}});
if ('serviceWorker' in navigator) {const register=()=>navigator.serviceWorker.register('service-worker.js').catch(()=>{});if(document.readyState==='complete')register();else window.addEventListener('load',register);}
const connectionFragment=location.hash.match(/^#connect=([A-Za-z0-9_-]{40,100})$/);
if(connectionFragment){
  history.replaceState(null,'',location.pathname+location.search+'#profile');
  (async()=>{await cvStore('put','connection',{token:connectionFragment[1]});await loadBrowserConnection(false);await loadSavedCVs();})().catch(()=>toast('Could not connect this device.'));
}
setView(location.hash.slice(1)); render();
if (storageError) toast('Some saved data could not be read. Export a backup before making changes.');
if (discovery.fetchedAt) $('feed-status').textContent = `Feed last retrieved ${dateText(discovery.fetchedAt)} · This is not the posting date`;
if (!discovery.fetchedAt || Date.now() - new Date(discovery.fetchedAt).getTime() > 60*60*1000) refreshJobs();

document.addEventListener('click',event=>{if(event.target.closest('[data-edit-evidence]')){setView('profile');const field=$('profile-evidence');field.closest('details').open=true;field.focus();field.scrollIntoView({block:'center'});}if(event.target.closest('[data-retry-summary]')){const job=deckJobs()[0];if(job){summaryErrors.delete(job.id);$('role-summary').innerHTML=summaryMarkup(job);requestSummary(job);}}});

// Check for new postings when returning to an older feed, without polling hidden tabs.
function checkFreshFeed(){if(!document.hidden&&activeView==='discover'&&!loading&&Date.now()-Date.parse(discovery.fetchedAt||0)>60*60*1000)refreshJobs();}
document.addEventListener('visibilitychange',checkFreshFeed);
setInterval(checkFreshFeed,60000);

startDeviceSync({state:()=>({entries:validateEntries(read(KEY,entries)),profile:validateProfile(read(PROFILE_KEY,profile)),discovery:read(DISCOVERY_KEY,discovery)}),applied:pack=>{entries=pack.entries;profile=pack.profile;discovery=pack.discovery;pinnedJobId=null;undoAction=null;matchCache=new WeakMap();populateProfile();render();loadBrowserConnection(false);},notify:toast});
window.addEventListener('storage',event=>{
 if(event.key==='job-notebook-device-updated'){location.reload();return;}
 if(event.key===PROFILE_KEY&&readSavedProfile()){
  const shown=selectedRole;render();
  if($('role-dialog').open&&shown)openRoleDetails(shown);
  if(activeView==='profile')toast('Saved CV details changed in another tab. Reopen My profile to load them into the form.');
 }
});
