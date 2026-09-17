import {roleInsights, KEY, DISCOVERY_KEY, PROFILE_KEY, defaultProfile, safeURL, matchJob, sameJob, prepareApplication, validateEntries, validateProfile, cvKey, rankJobs} from './lib/model.js?v=16';
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
let activeFilter = 'all', activeView = 'discover', undoAction = null, preparationId = null, loading = false, toastTimer, selectedRole = null, decisionPending = false;
let matchCache = new WeakMap(), cachedProfile = profile;
const editor = $('editor-dialog'), backup = $('backup-dialog'), form = $('application-form');
function toast(message) {$('toast').textContent = message; $('toast').hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => $('toast').hidden = true, 5500);}
function persist(key, value) {
  try {localStorage.setItem(key, JSON.stringify(value)); return true;}
  catch {toast('Could not save on this device. Download a backup before closing this page.'); return false;}
}
function saveEntries() {return persist(KEY, entries);}
function saveDiscovery() {return persist(DISCOVERY_KEY, discovery);}
// Keep the original one-time status migration, including its original storage marker.
try {
  const migration = 'job-notebook-applied-status-2026-09-15';
  if (!localStorage.getItem(migration) && !storageError) {
    entries = entries.map(e => ['deliverect','allianz'].includes(e.id) && e.status === 'To apply' ? {...e, status: 'Applied', applicationDate: '2026-09-15'} : e);
    if (saveEntries()) localStorage.setItem(migration, 'done');
  }
} catch {storageError = true;}
function setView(view) {
  if (!['discover','notebook','profile'].includes(view)) view = 'discover';
  activeView = view;
  document.body.dataset.view = view;
  window.scrollTo(0, 0);
  $('main-content').scrollTop = 0;
  document.querySelectorAll('.view').forEach(el => el.hidden = el.id !== `${view}-view`);
  document.querySelectorAll('.nav-button').forEach(el => {el.classList.toggle('active',el.dataset.view === view); if (el.dataset.view === view) el.setAttribute('aria-current','page'); else el.removeAttribute('aria-current');});
  if (view === 'profile') populateProfile();
  history.replaceState(null, '', `#${view}`);
}
function render() {
  const applied = entries.filter(e => ['Applied','Interview','Offer'].includes(e.status)).length;
  $('nav-count').textContent = entries.length;
  $('progress-applied').textContent = applied;
  $('progress-preparing').textContent = entries.filter(e => e.status === 'Preparing').length;
  $('summary-text').textContent = `${entries.length} roles · ${applied} submitted`;
  $('compass-location').textContent = profile.geography === 'europe' ? '◎ Germany & Europe first' : '◎ International · excluding the US';
  const q = $('search-input').value.trim().toLowerCase();
  const filtered = entries.filter(e => (activeFilter === 'all' || e.status.toLowerCase() === activeFilter) && (!q || [e.company,e.title,e.location,e.notes,e.requirements].join(' ').toLowerCase().includes(q)));
  $('applications').innerHTML = filtered.map(e => `<article class="application-item"><div><span class="company-name">${esc(e.company)}</span><h2>${esc(e.title)}</h2><p>${esc(e.location)}${e.applicationDate ? ' · Applied '+esc(dateText(e.applicationDate)) : ''}</p><span class="status-pill status-${esc(e.status.toLowerCase().replaceAll(' ','-'))}">${esc(e.status === 'To apply' ? 'Saved' : e.status)}</span></div><div class="application-actions">${!['Applied','Interview','Offer','Archived'].includes(e.status) ? `<button class="secondary-button" data-prepare="${esc(e.id)}">${e.preparation ? 'Review draft' : 'Prepare application'}</button>${browserConnection?`<button class="primary-button" data-start-browser="${esc(e.id)}">Continue application</button>`:''}` : ''}<button class="text-button" data-edit="${esc(e.id)}">Edit notes</button>${safeURL(e.link) ? `<a class="text-button" href="${esc(safeURL(e.link))}" target="_blank" rel="noopener noreferrer">Listing ↗</a>` : ''}</div></article>`).join('');
  $('empty-state').hidden = filtered.length > 0;
  renderDeck();
}
function deckJobs() {
  if (cachedProfile !== profile) {matchCache = new WeakMap(); cachedProfile = profile;}
  const historical = entries.filter(e => e.status === 'To apply' && !e.preparation).map(e => ({...e, description: e.requirements, source: 'Your notebook', historical: true}));
  const all = [...discovery.jobs, ...historical];
  const result = [];
  for (const job of all) {
    if (discovery.decisions[job.id] || result.some(j => sameJob(j,job))) continue;
    if (entries.some(e => sameJob(e,job) && (e.status !== 'To apply' || e.preparation))) continue;
    let match = matchCache.get(job);
    if (!match) {match = matchJob(job,profile); matchCache.set(job,match);}
    // Previously saved roles remain accessible in the notebook even outside current search preferences.
    if (match.eligible) result.push({...job, match});
  }
  return rankJobs(result);
}
function renderDeck() {
  if (decisionPending) return;
  document.querySelectorAll('.swipe-button').forEach(button => button.disabled = false);
  const jobs = deckJobs(), job = jobs[0];
  $('deck-count').textContent = `${jobs.length} role${jobs.length === 1 ? '' : 's'} to explore`;
  $('undo-swipe').disabled = !undoAction;
  $('swipe-actions').hidden = !job;
  if (!job) {
  $('job-deck').innerHTML = `<div class="deck-empty"><span aria-hidden="true">✧</span><h2>${loading ? 'Finding your next possibility…' : discovery.fetchedAt ? 'You’re all caught up.' : 'Let’s find your kind of work.'}</h2><p>${loading ? 'Looking for consulting, implementation and business analysis roles.' : 'Fresh suggestions, guided by your direction.<br>Your saved roles are waiting in Applications.'}</p><button class="primary-button" id="empty-refresh" ${loading ? 'disabled' : ''}>${loading ? 'Finding roles…' : 'Find fresh roles'}</button>${Object.keys(discovery.decisions).length ? '<button class="text-button" id="revisit-passed">Revisit passed roles</button>' : ''}<p class="source-note">Listings from <a href="https://www.arbeitnow.com" target="_blank" rel="noopener noreferrer">Arbeitnow</a> · A selection of recent openings, mainly in Europe.</p></div>`;
    return;
  }
  const {match} = job;
  const insights=roleInsights(job,profile);
  const checks = [...match.flags,...insights.requirements.filter(r=>r!==insights.german&&r.status!=='match').map(r=>r.label)].length;
  $('job-deck').innerHTML = `<article class="job-card" id="active-card" data-job-id="${esc(job.id)}" aria-label="${esc(job.title)} at ${esc(job.company)}"><span class="swipe-label" aria-hidden="true"></span><div class="card-top"><div class="company-line"><span class="company-monogram" aria-hidden="true">${esc(job.company.slice(0,1))}</span><div class="company-info"><strong>${esc(job.company)}</strong><small>${job.historical ? 'Saved role · check availability' : match.exploration ? 'Worth exploring' : 'Matches your direction'}</small></div><button class="listing-info" data-role-details type="button" aria-label="${checks} missing or uncertain requirements" title="Missing or uncertain requirements"><svg class="ui-icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-10v1"/></svg><small>${checks}</small></button><div class="match-badge"><b>${match.score}%</b><small>work fit</small></div></div><h2>${esc(job.title)}</h2><p class="job-location">◎ ${esc(job.location)}${job.remote ? ' · Remote option' : ''}</p></div><div class="card-body">${insights.german.status==='gap'?`<p class="decision-alert"><strong>× Language gap</strong><br>${esc(insights.german.label)}</p>`:''}<p class="card-section-label">${match.exploration ? 'A DIFFERENT TITLE. FAMILIAR WORK.' : 'WHY THIS FITS'}</p><ul class="fit-list">${match.reasons.slice(0,2).map((r,i) => `<li${i > 1 ? ' class="extra-reason"' : ''}>${esc(r.replace('Stakeholder workshops, customer collaboration or training','Stakeholder-facing work').replace('Workflows, requirements, documentation or process improvement','Analysis and process improvement').replace('Integrations, configuration or operational systems work','Systems and integration work'))}</li>`).join('')}</ul><section class="inline-role" aria-label="Role details"><h3>Role at a glance</h3><p>${esc(insights.duties.length?insights.duties.join(' · '):'The listing needs a closer review; no clear responsibilities were identified.')}</p><h3>Your qualification check</h3><p class="check-legend">✓ Evidence matches · × Gap · ? Needs checking</p><ul class="qualification-list">${insights.requirements.map(r=>`<li class="qualification ${r.status}"><span class="qualification-icon" aria-label="${r.status==='match'?'Matches':r.status==='gap'?'Gap':'Uncertain'}">${r.status==='match'?'✓':r.status==='gap'?'×':'?'}</span><details><summary>${esc(r.label)}</summary><p>${esc(r.detail)}</p></details></li>`).join('')}</ul><h3>Benefits mentioned</h3>${insights.benefits.length?`<ul class="benefit-list">${insights.benefits.map(b=>`<li>${esc(b.label)}</li>`).join('')}</ul>`:'<p>No clear benefits were found in the supplied description.</p>'}<details class="source-description"><summary>Read the full listing text</summary><p>${esc(job.description||job.requirements||'No description supplied.')}</p></details><p class="check-legend">Summary of the supplied listing, not a full eligibility assessment. Check the original for conditions.</p></section></div><div class="card-footer"><span class="cv-tag">${esc(match.cv)}<br><a href="${esc(safeURL(job.link))}" target="_blank" rel="noopener noreferrer">${esc(job.source || 'Original listing')} ↗</a></span><button class="text-button" data-read-role type="button">Read role ↓</button></div></article>`;
  wireSwipe();
}
function openRoleDetails() {
  selectedRole = deckJobs()[0];
  if (!selectedRole) return;
  const job = selectedRole, match = job.match;
  const insights=roleInsights(job,profile);
  const flags=[...match.flags,...insights.requirements.filter(r=>r!==insights.german&&r.status!=='match').map(r=>r.label+': '+r.detail)];
  $('role-title').textContent = job.company;
  $('role-content').innerHTML = `<h3 class="role-heading">${esc(job.title)}</h3><p class="prep-meta">${esc(job.location)}</p><div class="flag-box"><strong>Missing or uncertain requirements</strong><ul>${flags.map(f => `<li>${esc(f)}</li>`).join('')}</ul></div><p class="source-note">Not stated does not mean not required. Check the original listing or ask the employer.</p>`;
  $('role-source').href = safeURL(job.link);
  $('role-dialog').showModal();
  $('role-content').scrollTop = 0;
}
async function refreshJobs() {
  if (loading) return;
  loading = true; $('refresh-jobs').disabled = true; $('feed-status').textContent = 'Checking the job feed…'; renderDeck();
  try {
    const response = await fetch('/api/jobs', {signal: AbortSignal.timeout(20000)});
    const data = await response.json();
    if (!response.ok || !Array.isArray(data.jobs)) throw new Error(data.error || 'Could not load the job feed.');
    discovery.jobs = data.jobs.filter(j => j && typeof j.id === 'string' && typeof j.company === 'string' && typeof j.title === 'string' && safeURL(j.link));
    discovery.fetchedAt = data.fetchedAt; saveDiscovery();
    $('feed-status').textContent = `${data.stale ? 'Saved feed' : data.partial ? 'Partial feed' : 'Arbeitnow'} · Updated ${new Date(data.fetchedAt).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})} · Check listing availability`;
  } catch (error) {
    $('feed-status').textContent = `Couldn’t refresh. ${discovery.jobs.length ? 'Showing saved suggestions.' : 'Try again, or add a role in Applications.'}`;
  } finally {loading = false; $('refresh-jobs').disabled = false; renderDeck();}
}
async function decide(action, job = deckJobs()[0]) {
  if (!job || decisionPending) return;
  decisionPending = true;
  document.querySelectorAll('.swipe-button').forEach(button => button.disabled = true);
  $('undo-swipe').disabled = true;
  const existing = entries.find(e => sameJob(e,job));
  undoAction = {jobId: job.id, previousDecision: discovery.decisions[job.id], entry: existing ? structuredClone(existing) : null, newId: null};
  discovery.decisions[job.id] = action;
  if (action !== 'pass') {
    const entry = existing || {id: job.id, company: job.company, title: job.title, location: job.location, link: job.link, requirements: job.description || job.requirements || '', status: 'To apply', materials: job.match.cv, notes: '', applicationDate: '', interviewDate: '', source: job.source};
    if (!existing) {entries.unshift(entry); undoAction.newId = entry.id;}
    if (action === 'prepare') {entry.status = 'Preparing'; entry.preparation ||= prepareApplication(job,profile); entry.materials ||= job.match.cv;}
    saveEntries();
    if (action === 'prepare') {preparationId = entry.id;}
  }
  saveDiscovery();
  if (action === 'prepare' && browserConnection) {
    startApplicationBrowser(job,preparationId);
  } else if (action === 'prepare') {
    const url = safeURL(job.link);
    if (url) {
      const tab = window.open(url, '_blank');
      if (tab) tab.opener = null;
      else {decisionPending = false; location.assign(url); return;}
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
  if (action === 'prepare' && !browserConnection) toast('Listing opened. Your CV choice and notes are saved in Applications. Autofill is not connected on this browser.');
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
  undoAction = null; saveEntries(); saveDiscovery(); render(); toast('Last swipe undone.');
}
function wireSwipe() {
  const card = $('active-card'); let start = null, dx = 0, frame = 0;
  const threshold = () => Math.max(64, Math.min(125, card.clientWidth * .23));
  card.addEventListener('pointerdown', e => {
    if (decisionPending || e.button !== 0 || !e.isPrimary || e.target.closest('a,button,details')) return;
    start = {x:e.clientX,y:e.clientY,id:e.pointerId,time:e.timeStamp}; dx = 0;
  });
  card.addEventListener('pointermove', e => {
    if (!start || e.pointerId !== start.id) return;
    dx = e.clientX - start.x;
    if (Math.abs(e.clientY - start.y) > Math.abs(dx) + 15) {reset(); return;}
    if (Math.abs(dx) < 10) return;
    if (!card.hasPointerCapture(e.pointerId)) card.setPointerCapture(e.pointerId);
    card.classList.add('dragging');
    if (!frame) frame = requestAnimationFrame(() => {
      frame = 0;
      card.style.transform = `translate3d(${dx}px,0,0) rotate(${Math.max(-8,Math.min(8,dx/30))}deg)`;
      const label = card.querySelector('.swipe-label'); label.style.opacity = Math.min(1,Math.abs(dx)/threshold()); label.textContent = dx > 0 ? 'APPLY' : 'PASS';
      card.dataset.direction = dx > 0 ? 'prepare' : 'pass';
    });
  });
  function reset() {
    if (start && card.hasPointerCapture(start.id)) card.releasePointerCapture(start.id);
    cancelAnimationFrame(frame); frame = 0; start = null; dx = 0;
    card.classList.remove('dragging'); card.style.transform = ''; delete card.dataset.direction;
    card.querySelector('.swipe-label').style.opacity = 0;
  }
  card.addEventListener('pointerup', e => {
    if (!start || e.pointerId !== start.id) return;
    const amount = dx, velocity = Math.abs(dx) / Math.max(1,e.timeStamp-start.time);
    const commit = Math.abs(amount) >= threshold() || (Math.abs(amount) >= 40 && velocity >= .55);
    reset(); if (commit) decide(amount > 0 ? 'prepare' : 'pass');
  });
  card.addEventListener('pointercancel', reset);
  card.addEventListener('lostpointercapture', e => {if (e.target === card && start) reset();});
}
function openEditor(entry) {
  form.reset(); $('save-status').textContent = ''; $('delete-button').hidden = !entry; $('editor-title').textContent = entry ? 'Edit application' : 'Add application';
  const map = {id:'entry-id',company:'company',title:'title',location:'location',status:'status',applicationDate:'application-date',interviewDate:'interview-date',link:'link',materials:'materials',requirements:'requirements',notes:'notes'};
  if (entry) Object.entries(map).forEach(([key,id]) => $(id).value = entry[key] || '');
  editor.showModal();
}
function upsert(event) {
  event.preventDefault(); const value = id => $(id).value.trim();
  if (value('link') && !safeURL(value('link'))) { $('save-status').textContent = 'Use an http or https application link.'; return; }
  const previous = entries.find(e => e.id === value('entry-id'));
  const data = {...previous,id:value('entry-id') || crypto.randomUUID(),company:value('company'),title:value('title'),location:value('location'),status:$('status').value,applicationDate:$('application-date').value,interviewDate:$('interview-date').value,link:value('link'),materials:value('materials'),requirements:value('requirements'),notes:value('notes')};
  if (!data.company || !data.title) return;
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
function populateProfile() {for (const [key,value] of Object.entries(profile)) {const el = $(`profile-${key}`); if (el) el.type === 'checkbox' ? el.checked = value : el.value = value;} updateCVStatuses();}
function saveProfile(event) {
  event.preventDefault(); const next = {...profile};
  for (const key of Object.keys(defaultProfile)) {const el = $(`profile-${key}`); if (el) next[key] = el.type === 'checkbox' ? el.checked : el.value.trim();}
  profile = validateProfile(next);
  if (persist(PROFILE_KEY,profile)) {$('profile-message').textContent = 'Saved. New drafts will use this profile.'; render(); toast('Profile saved. Suggestions now reflect your preferences.');}
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
    entries = nextEntries; profile = nextProfile; discovery = nextDiscovery; undoAction = null;
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
  const db = await cvDB();
  return new Promise((resolve,reject) => {const transaction = db.transaction('files',mode === 'get' ? 'readonly' : 'readwrite'); const store = transaction.objectStore('files'); const request = mode === 'get' ? store.get(key) : mode === 'delete' ? store.delete(key) : store.put(value,key); transaction.oncomplete = () => resolve(request.result); transaction.onerror = () => reject(transaction.error); transaction.onabort = () => reject(transaction.error);});
}
async function updateCVStatuses() {
  for (const key of ['consulting','analyst','developer']) {
    try {const stored = await cvStore('get',key); $(`${key}-file-status`).textContent = stored ? `${stored.name} · ready on this device` : 'No PDF stored'; $(`${key}-remove`).hidden = !stored; $(`${key}-download`).hidden = !stored;}
    catch {$(`${key}-file-status`).textContent = 'PDF storage unavailable in this browser.';}
  }
}
async function uploadCV(key,file) {
  if (!file) return;
  try {
    if (file.size > 15*1024*1024) throw new Error('Choose a PDF smaller than 15 MB.');
    const signature = new TextDecoder().decode(await file.slice(0,5).arrayBuffer());
    if (signature !== '%PDF-') throw new Error('Please choose a valid PDF file.');
    await cvStore('put',key,{name:file.name,blob:file,uploadedAt:new Date().toISOString()});
    profile[{consulting:'consultingCV',analyst:'analystCV',developer:'developerCV'}[key]] = file.name;
    $(`profile-${{consulting:'consultingCV',analyst:'analystCV',developer:'developerCV'}[key]}`).value = file.name;
    persist(PROFILE_KEY,profile); updateCVStatuses(); toast('CV stored on this device and ready to use.');
  } catch (error) {toast(error.message || 'Could not store this PDF.');}
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
let browserConnection=null, browserController=null, browserEntryId=null, browserSessionId=null, browserRun=0;
async function loadBrowserConnection(restore=true) {
  try {browserConnection=(await cvStore('get','connection'))?.token||null;}catch{browserConnection=null;}
  $('browser-connection-status').textContent=browserConnection?'Private application browser connected on this device.':'Import your private CV setup to connect application preparation.';
  $('load-saved-cvs').disabled=!browserConnection;
  if(restore&&browserConnection){const files=await Promise.all(['consulting','analyst','developer'].map(key=>cvStore('get',key)));if(files.some(file=>!file))await loadSavedCVs({missingOnly:true});}
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
    if(!cv||!profile.name||!profile.email)throw new Error('Import your private CV setup in My profile first. It contains your contact details and all three PDFs—no retyping needed.');
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
$('disconnect-browser').addEventListener('click',async()=>{await cvStore('delete','connection');await loadBrowserConnection();toast('Private browser disconnected from this device.');});
loadBrowserConnection();
// Event bindings
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
$('job-deck').addEventListener('click',e => {if (e.target.closest('[data-read-role]')) document.querySelector('.inline-role')?.scrollIntoView({block:'start',behavior:matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth'}); if (e.target.closest('[data-role-details]')) openRoleDetails(); if (e.target.closest('#empty-refresh')) refreshJobs(); if (e.target.closest('#revisit-passed')) {Object.keys(discovery.decisions).forEach(id => {if (discovery.decisions[id] === 'pass') delete discovery.decisions[id];}); saveDiscovery(); renderDeck();}});
$('applications').addEventListener('click',e => {const edit = e.target.closest('[data-edit]'), prepare = e.target.closest('[data-prepare]'); if (edit) openEditor(entries.find(item => item.id === edit.dataset.edit)); if (prepare) openPreparation(prepare.dataset.prepare);const start=e.target.closest('[data-start-browser]');if(start){const entry=entries.find(item=>item.id===start.dataset.startBrowser);startApplicationBrowser(entry,entry.id);}});
$('add-button').addEventListener('click',() => openEditor()); $('empty-add-button').addEventListener('click',() => openEditor()); $('close-editor').addEventListener('click',() => editor.close()); form.addEventListener('submit',upsert);
$('delete-button').addEventListener('click',() => {if (!confirm('Delete this application and its notes?')) return; const id = $('entry-id').value; entries = entries.filter(e => e.id !== id); if (saveEntries()) {render(); editor.close();}});
$('search-input').addEventListener('input',render);
document.querySelectorAll('.filter').forEach(button => button.addEventListener('click',() => {activeFilter = button.dataset.filter; document.querySelectorAll('.filter').forEach(b => b.classList.toggle('active',b === button)); render();}));
$('backup-button').addEventListener('click',() => backup.showModal()); $('close-backup').addEventListener('click',() => backup.close()); $('export-button').addEventListener('click',exportData);
$('import-input').addEventListener('change',e => {if (e.target.files[0]) importData(e.target.files[0]); e.target.value = '';});
$('profile-form').addEventListener('submit',saveProfile);
$('profile-form').addEventListener('invalid', e => {const section = e.target.closest('details'); if (section) section.open = true;}, true);
async function importSetup(parsed) {
    const next = validateProfile(parsed.profile || parsed);
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
    if (typeof parsed.automationToken === 'string' && /^[A-Za-z0-9_-]{40,100}$/.test(parsed.automationToken)) await cvStore('put','connection',{token:parsed.automationToken});
    await loadBrowserConnection(false);
    profile = next;
    if (persist(PROFILE_KEY,profile)) {populateProfile(); render(); $('profile-message').textContent = `Profile imported${cvs.length ? ' with '+cvs.length+' CV PDFs' : ''}. New drafts will use these details.`;}
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
  $(`${key}-upload`).addEventListener('change',e => {uploadCV(key,e.target.files[0]); e.target.value = '';});
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
if ('serviceWorker' in navigator) window.addEventListener('load',() => navigator.serviceWorker.register('service-worker.js').catch(() => {}));
const connectionFragment=location.hash.match(/^#connect=([A-Za-z0-9_-]{40,100})$/);
if(connectionFragment){
  history.replaceState(null,'',location.pathname+location.search+'#profile');
  (async()=>{await cvStore('put','connection',{token:connectionFragment[1]});await loadBrowserConnection(false);await loadSavedCVs();})().catch(()=>toast('Could not connect this device.'));
}
setView(location.hash.slice(1)); render();
if (storageError) toast('Some saved data could not be read. Export a backup before making changes.');
if (discovery.fetchedAt) $('feed-status').textContent = `Saved feed · ${dateText(discovery.fetchedAt)} · Refresh for recent roles`;
if (!discovery.fetchedAt || Date.now() - new Date(discovery.fetchedAt).getTime() > 6*60*60*1000) refreshJobs();
