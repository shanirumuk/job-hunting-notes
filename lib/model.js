import {regions,europeanCountries,matchesGeography,locationGroup,locationInfo} from './geography.js';
export {roleInsights} from './insights.js';
import {advertisedSalary,germanRequirement,listingSections,roleInsights} from './insights.js';
export const KEY = 'job-notebook-v1';
export const DISCOVERY_KEY = 'job-notebook-discovery-v1';
export const PROFILE_KEY = 'job-notebook-profile-v1';
export const STATUSES = ['To apply', 'Not applied', 'Preparing', 'Applied', 'Interview', 'Offer', 'Archived'];
export const defaultProfile = {
  name: '', email: '', phone: '', linkedin: '', startDate: '', languages: 'English C1, German B1, Afrikaans B2, Shona A1',
  geography: 'international', country: '', includeBroadRemote: false, germanLevel: 'B1', includeConditional: true, includeAdjacent: true,
  workRights: '', salaryTarget: '', motivation: 'I want to solve difficult operational problems, improve systems, and get meaningful improvements delivered.',
  evidence: '', cvImportSources: '', consultingCV: '', analystCV: '', developerCV: ''
};
export function safeURL(value) {
  try { const url = new URL(value); return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password ? url.href : ''; } catch { return ''; }
}
export function plainText(value = '') {
  return String(value).replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '').replace(/<[^>]*>/g, ' ').replace(/&nbsp;|&#160;/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#(\d+);/g, (_, n) => Number(n) <= 0x10ffff ? String.fromCodePoint(Number(n)) : '').replace(/\s+/g, ' ').trim();
}
// Preserve listing paragraphs and bullet boundaries while rendering only safe text.
export function descriptionText(value = '') {
  return String(value).replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<li\b[^>]*>/gi, '\n• ').replace(/<\/?(?:p|div|h[1-6]|ul|ol|br)\b[^>]*>/gi, '\n')
    .split(/\n+/).map(line => plainText(line)).filter(Boolean).join('\n\n');
}
const us = /\b(united states|u\.?s\.?a?\b|new york|san francisco|california|texas|boston|chicago|seattle|los angeles|washington|americas|amer)\b/i;
export function matchJob(job, profile = defaultProfile) {
  const title = job.title || '', location = job.location || '';
  const source = job.description || job.requirements || '';
  const sections=listingSections(source);
  const work=sections.duties.concat(sections.requirements,sections.preferred);
  const description = plainText(sections.duties.length?work.join(' '):source);
  const insight=roleInsights(job,profile);
  const text = `${title} ${plainText(source)}`;
  const reasons = [], flags = [];
  const reject = reason => ({eligible: false, score: 0, reasons: [], flags: [reason], cv: 'Consulting CV'});
  if (/\bAMER\b/.test(title) || /(?:must|only|need to).{0,35}(?:reside|based|located|resident).{0,20}(?:united states|\bUSA\b)|(?:US|USA|United States)[ -]only/i.test(description)) return reject('US-only role excluded');
  if (us.test(location) && !locationInfo(job).continents.length && !/worldwide|anywhere|global|canada|africa|asia|australia|new zealand|singapore|india|japan|brazil|mexico|latam|apac/i.test(location)) return reject('US location excluded');
  if (/\b(architect|architekt|developer|entwickler|(?:software|front[ -]?end|back[ -]?end|devops|platform|cloud|data|ai|machine learning|site reliability|security|embedded|application) engineer(?:ing)?|full[ -]?stack|sre|account executive|sales|sales development|business development|director|head of|vice president|vp)\b/i.test(title) || (/\baccount manager\b/i.test(title) && !/technical account manager/i.test(title))) return reject('Outside your preferred role or seniority');
  if (/\b(?:engineering manager|product designer|ux designer|ui designer|digital marketer|marketing manager|controller|accountant|financial reporting)\b/i.test(title)||/engineering managers should be|lead.{0,35}team of.{0,25}engineers|outstanding developers themselves/i.test(description)) return reject('Engineering or design is the primary profession');
  // Responsibility evidence matters more than an exact title. Broad exploration still
  // requires a systems component plus analysis, collaboration or delivery work.
  const signals = {
    analysis: /requirements|workflow|process improvement|process design|acceptance criteria|business analysis|user stor(?:y|ies)|documentation|anforderung|prozess(?:optimierung|analyse)/i.test(description),
    people: /stakeholder|workshop|client.facing|customer.facing|customer discovery|training|facilitat|schulung|kundenberatung|cross.functional/i.test(description),
    systems: /\bapi\b|integration|xml|configuration|troubleshoot|(?:system|application|service).{0,15}monitoring|monitoring.{0,20}(?:system|application|service)|enterprise application|business systems?|\b(?:saas|erp|crm|itsm)\b|schnittstelle|konfiguration|system improvement/i.test(description),
    delivery: /coordinat|delivery|rollout|implementation|onboarding|testing|change management|project planning|project management|abnahme|projektmanagement/i.test(description)
  };
  const signalCount = Object.values(signals).filter(Boolean).length;
  const ba = /business analyst|business systems analyst|product (operations|analyst)|process analyst|requirements (analyst|engineer)/i.test(title);
  const implementation = /implementation|onboarding|integration.*consultant|api consultant|professional services/i.test(title);
  const consultant = /consultant|consulting|projektsteuerung/i.test(title) && /\b(?:systems?|digital\w*|technology|it|erp|crm|saas|atlassian|business|technical|delivery|projektsteuerung)\b/i.test(title);
  const delivery = /(?:technical |project |delivery )(?:coordinator|coordination|manager)|projektkoordinat/i.test(title) && (signals.systems || /technical|digital|\bit\b/i.test(title));
  const cs = /customer success/i.test(title) && signals.systems && (signals.people || signals.analysis || signals.delivery);
  const core = ba || implementation || consultant || delivery || cs;
  const adjacentTitle = /business systems|integration (specialist|analyst)|digital adoption|change (analyst|consultant|specialist)|functional consultant|application (consultant|specialist|analyst|manager)|technical account manager|service delivery|service management|process (specialist|consultant|improvement)|(?:business|product|customer|technical|digital|revenue) operations|operational excellence|automation (analyst|consultant)|product (specialist|owner)|(?:crm|erp|itsm) (specialist|analyst|administrator)|solution consultant|solutions? specialist/i.test(title);
  const transferable = !/recruiter|talent acquisition|nurse|physician|warehouse|accountant|real estate|marketing|content writer|public affairs|policy|research consultant/i.test(title) && signalCount === 4 && /\b(?:api|xml|saas|erp|crm|itsm)\b|business systems?|enterprise application|software (?:platform|system)|systems? (?:integration|configuration)/i.test(description);
  const adjacent = !core && signals.systems && signalCount >= 2 && (adjacentTitle || transferable);
  if (!core && !adjacent) return reject('Not enough evidence of your preferred business-technology work');
  if (adjacent && profile.includeAdjacent === false) return reject('Adjacent-role exploration is disabled');
  if (/quota[- ](?:carrying|driven)|sales quota|own.{0,15}sales target|meet.{0,15}(?:revenue|sales) targets|cold.call|prospect new (?:clients|customers)/i.test(description)) return reject('Quota-led sales responsibilities');
  if (/hands.on (?:software |web )?development|primarily (?:coding|developing)|majority.{0,20}(?:coding|development)|(?:build|develop|write).{0,25}production.{0,15}(?:code|software)|daily (?:coding|programming)/i.test(description)) return reject('Coding is a primary responsibility');
  if (!matchesGeography(job,profile)) return reject('Outside your selected location filter');
  let score = 40 + (core ? 8 : 0);
  if (signals.people) { score += 14; reasons.push('Stakeholder workshops, customer collaboration or training'); }
  if (signals.analysis) { score += 10; reasons.push('Workflows, requirements, documentation or process improvement'); }
  if (signals.systems) { score += 10; reasons.push('Integrations, configuration or operational systems work'); }
  if (signals.delivery) { score += 8; reasons.push('Testing, rollout or delivery coordination'); }
  if (!reasons.length) reasons.push(ba ? 'Business analysis matches your career direction' : implementation ? 'Implementation & client delivery' : 'Business & technology delivery');
  if (profile.geography === 'europe' && locationInfo(job).continents.includes('europe')) { score += 7; reasons.push('Within your Europe search'); }
  if (adjacent) {
    reasons.push('An adjacent title with responsibilities that transfer from your experience');
    flags.push('Explore the day-to-day work: confirm stakeholder time and a light coding load.');
  }
  if (/technical account|customer success|revenue operations|solution consultant/i.test(title)) flags.push('Confirm the role focuses on systems and delivery, rather than sales targets.');
  const german = germanRequirement(description,profile.germanLevel);
  if(/german|deutsch/i.test(description) && german.status !== 'match') flags.push((german.label.startsWith('German requirement')?'':'German requirement: ') + german.label + '. ' + german.detail);
  if(german.status === 'gap') score -= german.optional ? 8 : 18;
  if (/mandarin|native french|fluent french|fluent dutch/i.test(text)) { flags.push('Another language requirement needs checking.'); score -= 10; }
  if (/\bsenior\b|\blead\b|[6-9]\+? years|10\+? years/i.test(title + ' ' + description)) { flags.push('Seniority or experience requirement needs checking.'); score -= 8; }
  if (/no (?:visa )?sponsorship|cannot sponsor|unable to (?:provide )?sponsor|not (?:offer|provide).{0,15}sponsorship|must (?:already )?have.{0,30}(?:right to work|work authori[sz]ation)/i.test(text)) { flags.push('Listing may require existing work rights or exclude sponsorship.'); score -= 15; }
  else flags.push('Work rights and permit support are unconfirmed.');
  if (!/english|englisch|german|deutsch/i.test(text)) flags.push('Working language is not stated clearly.');
  if (profile.startDate) flags.push(`Confirm the employer can accommodate a ${profile.startDate} start.`);
  if (!profile.includeConditional && (german.status==='gap' && !german.optional || flags.some(f => /Another language|Seniority|Listing may|Location needs/.test(f)))) return reject('Hidden by your conditional-match preference');
  if(insight.internship)score=Math.min(score,38);
  if(insight.commercial)score=Math.min(score,25);
  flags.push(...insight.warnings);
  return {eligible: true, score: Math.max(20, Math.min(96, score)), reasons, flags, exploration: adjacent, cv: ba || (!implementation && /analyst|operations|process|business systems|product owner/i.test(title)) ? 'Business Analyst CV' : 'Consulting CV'};
}
// Round-robin countries among plausible matches so two large markets cannot monopolise the deck.
function diverseLocations(jobs){
 const groups=new Map(),lower=[];
 for(const job of jobs){
  if(job.match.score<50){lower.push(job);continue;}
  const key=locationGroup(job);if(!groups.has(key))groups.set(key,[]);groups.get(key).push(job);
 }
 const result=[];
 while(groups.size)for(const [key,rows] of groups){result.push(rows.shift());if(!rows.length)groups.delete(key);}
 return [...result,...lower];
}
// Keep promising adjacent titles visible, without promoting weak matches.
export function rankJobs(jobs) {
  const sorted = [...jobs].sort((a,b) => b.match.score - a.match.score);
  const core = diverseLocations(sorted.filter(j => !j.match.exploration));
  const adjacent = diverseLocations(sorted.filter(j => j.match.exploration && j.match.score >= 50));
  const lower = sorted.filter(j => j.match.exploration && j.match.score < 50);
  const ranked = [];
  while (core.length || adjacent.length) {
    for (let n = 0; n < 3 && core.length; n++) ranked.push(core.shift());
    if (adjacent.length) ranked.push(adjacent.shift());
  }
  return [...ranked,...lower];
}
export function cvKey(cv) {
  return cv === 'Business Analyst CV' ? 'analyst' : cv === 'Full Stack Developer CV' ? 'developer' : 'consulting';
}
export function jobFitReport(job,profile=defaultProfile) {
 const match=matchJob(job,profile),insights=roleInsights(job,profile);
 const required=insights.requirements.filter(r=>!r.preferred),bonus=insights.requirements.filter(r=>r.preferred);
 const counts=insights.assessmentCounts,total=required.length,assessed=counts.match+counts.partial+counts.gap;
 const coverage=total?Math.round(100*assessed/total):0;
 // Every advert with requirements and saved evidence gets a documented-fit score,
 // including zero matches. Unknowns earn no credit but are never labelled gaps.
 const provisional=coverage<100||counts.partial>0;
 const score=insights.hasExperience&&total?Math.round(20*(counts.match+.5*counts.partial)/total)/2:null;
 const ratingState=!insights.hasExperience?'missing-profile':!total?'missing-requirements':provisional?'provisional':'rated';
 const ratingReason={
  'missing-profile':'No saved experience is available on this browser. Import your CV JSON and save the reviewed details in My profile.',
  'missing-requirements':'Your CV details are saved, but the supplied advert has no identifiable requirements to compare. Check the full employer advert.',
  provisional:`Documented fit across all ${total} requirements: ${counts.match} supported and ${counts.partial} partly supported. ${counts.unknown} not yet evidenced. Missing evidence earns no credit; it does not mean you cannot do the work.`,
  rated:'Documented fit across all requirements, using your saved CV/profile details.'
 }[ratingState];
 const text=descriptionText(job.description||job.requirements||'');
 const sentences=text.split(/\n+|(?<=[.!?])\s+/).map(s=>s.replace(/^•\s*/, '').trim()).filter(Boolean);
 const quotes=pattern=>sentences.filter(s=>pattern.test(s)).slice(0,3);
 const rights=quotes(/sponsor|work permit|work authori[sz]ation|right to work|visa|arbeitserlaubnis/i);
 const noSponsorship=rights.some(s=>/no (?:visa )?sponsorship|cannot sponsor|unable to.{0,15}sponsor|do not.{0,15}sponsor|not.{0,15}(?:provide|offer).{0,15}sponsorship/i.test(s));
 const needsSponsorship=/\b(?:need|require|seeking)\b[^.!?\n]{0,40}sponsor/i.test(profile.workRights||'')&&!/\b(?:don't|do not|does not|no longer)\s+(?:need|require)|no sponsorship (?:needed|required)/i.test(profile.workRights||'');
 const eligibilityConflict=noSponsorship&&needsSponsorship;
 const salary=advertisedSalary(job.description||job.requirements||'');
 const seniority=required.map(r=>r.source).filter(s=>/\d+\+?\s*(?:years?|jahre)|senior|leadership|management experience/i.test(s));
 if(/\bsenior\b|\blead\b/i.test(job.title))seniority.unshift(job.title);
 const working=quotes(/remote|hybrid|on.?site|office|travel|homeoffice|reisen/i);
 const restrictedRemote=sentences.filter(s=>/work (?:from|remotely)|remote (?:from|within)|must be (?:based|located)|reside in/i.test(s)&&/respective (?:region|country)|only|must|within|based in|reside in/i.test(s)).slice(0,2);
 const contractSource=[job.title,...insights.terms].find(s=>/\b\d+[ -]months?[^.!?]{0,30}contract|\bcontract[^.!?]{0,30}\d+[ -]months?|fixed[ -]term|temporary contract/i.test(s));
 const contractMonths=contractSource?.match(/\b(\d+)[ -]months?\b/i)?.[1];
 const fixedContract=contractSource?(contractMonths?`${contractMonths}-month contract`:'Fixed-term contract'):'';
 const leadership=insights.duties.filter(s=>/provide leadership|lead (?:a|the|our) (?:team|practice)|manage (?:a|the) team|regional (?:practice|leadership)/i.test(s)).slice(0,2);
 seniority.push(...leadership);
 const dates=quotes(/start(?:ing)? date|startdatum|beginn|available from/i);
 const language=required.filter(r=>r.checks.some(c=>['English','German','French','Dutch','Spanish','Mandarin','Afrikaans','Shona'].includes(c.label)));
 const factors=[
  {key:'direction',label:'Role direction',status:match.eligible?'aligned':'review',detail:match.eligible?(match.exploration?'Adjacent to your target roles; check the day-to-day balance.':'Aligned with your saved role preferences.'):'Outside your current role or location preferences.',evidence:match.reasons},
  {key:'eligibility',label:'Work rights & sponsorship',status:eligibilityConflict?'gap':'check',detail:eligibilityConflict?'Your profile says you need sponsorship; the advert says it is unavailable.':rights.length?'Confirm whether your work rights meet these conditions.':'Work rights and permit support are unconfirmed.',evidence:rights,profileEvidence:profile.workRights||'No work-right information saved.'},
  {key:'language',label:'Languages',status:language.some(r=>r.status==='gap')?'gap':language.length&&language.every(r=>r.status==='match')?'supported':'check',detail:language.length?'Compared with '+(profile.languages||'the language levels saved in your profile')+'.':'The advert does not state a clear language requirement.',evidence:language.map(r=>r.source)},
  {key:'seniority',label:'Seniority & experience',status:seniority.length?'check':'unknown',detail:seniority.length?'Check relevant years, scope and domain experience—not just the job title.':'The advert does not give a clear experience threshold.',evidence:seniority},
  {key:'location',label:'Location & working arrangement',status:restrictedRemote.length?'restricted remote':matchesGeography(job,profile)?'in scope':'review',detail:restrictedRemote.length?`Remote work has a location restriction. Advertised location: ${job.location}. A match with your search region does not establish residence or work rights. Confirm whether relocation is needed.`:job.location||'Location not stated.',evidence:restrictedRemote.length?restrictedRemote:working.length?working:[job.remote?'Remote option advertised; confirm permitted countries and office attendance.':'Remote or hybrid terms need checking.']},
  {key:'pay',label:'Pay & benefits',status:salary.length?'advertised':'unknown',detail:salary.length?'Advertised amounts; check currency, pay period and whether this meets your target.':'Pay is not stated clearly in the supplied listing.',evidence:[...salary,...insights.benefits.filter(b=>/allowance|budget|insurance|pension|stock|bonus|paid leave|parental leave/i.test(b.label)).slice(0,3).map(b=>b.label)]},
  {key:'growth',label:'Career growth',status:'check',detail:'Check progression, mentoring, learning opportunities and whether the day-to-day work builds the career you want.',evidence:quotes(/career (?:growth|development|progression)|progression|promotion|mentorship|mentoring|learning budget|training budget|development budget|weiterbildung|aufstieg/i),profileEvidence:profile.motivation||'Add your career direction in My profile.'},
  {key:'timing',label:'Start date & contract',status:fixedContract||dates.length||insights.terms.length?'check':'unknown',detail:fixedContract?`${fixedContract}. ${/possible extension|may be extended|possibility of extension/i.test(contractSource)?'Extension is possible, not guaranteed. ':''}Check whether the duration and renewal terms suit your plans.`:profile.startDate?'Your availability: '+profile.startDate+'. Confirm the employer’s timing.':'Add your availability to check the proposed start date.',evidence:[...new Set([...(contractSource?[contractSource]:[]),...dates,...insights.terms.filter(s=>/start|beginn|contract|duration|agreement|hours|schedule/i.test(s))])].slice(0,4)}
 ];
 const pay=factors.find(f=>f.key==='pay');pay.profileEvidence=profile.salaryTarget||'No pay target saved. Add your target, currency and pay period in My profile.';
 const growth=factors.find(f=>f.key==='growth');if(!growth.evidence.length){growth.status='unknown';growth.detail='The advert does not describe a clear progression or learning opportunity. Ask about advancement, mentoring and development support.';}
 const priorityOrder=['eligibility','pay','growth','direction','language','seniority','location','timing'];factors.sort((a,b)=>priorityOrder.indexOf(a.key)-priorityOrder.indexOf(b.key));
 const priority=eligibilityConflict||counts.gap?'Resolve the gaps first':!match.eligible?'Outside your preferences':score===null?'More evidence needed':provisional?'Provisional fit — check the remaining requirements':score>=8?'Promising skills — check eligibility, pay & growth':score>=5?'Potential fit — review the gaps':'Limited documented fit';
 const review=applicationReview(insights,{score,counts,restrictedRemote,fixedContract,leadership,salary,eligibilityConflict,location:job.location},profile);
 const cv=match.cv;
 const cvReason=cv==='Business Analyst CV'?'Lead with requirements analysis, workflows, documentation and testing relevant to this role.':'Lead with client discovery, implementation, configuration, onboarding and delivery relevant to this role.';
 return {review,score,provisional:score!==null&&provisional,ratingState,ratingReason,coverage,counts,total,assessed,priority,cv,cvReason,bonus:{supported:bonus.filter(r=>r.status==='match').length,total:bonus.length},
  strengths:required.filter(r=>r.status==='match').map(r=>r.label),gaps:required.filter(r=>r.status==='gap').map(r=>r.label),
  partial:required.filter(r=>r.status==='partial').map(r=>r.label),unknown:required.filter(r=>r.status==='unknown').map(r=>r.label),factors,evidenceMatches:required.flatMap(r=>r.checks.filter(c=>c.evidence&&['match','partial'].includes(c.status)).map(c=>({requirement:r.label,label:c.label,evidence:c.evidence,status:c.status}))),questions:insights.questions,hasExperience:insights.hasExperience};
}
// Explain the decision without inventing an overall score from unknown pay,
// work rights, residence, contract preferences or hiring odds.
function applicationReview(insights,facts,profile){
 const dutyChecks=insights.dutyAssessments||[];
 const workMatches=dutyChecks.flatMap(r=>r.checks.filter(c=>c.evidence&&['match','partial'].includes(c.status)).map(c=>({label:c.label,evidence:c.evidence,task:r.source})));
 const workEvidence=[...new Map(workMatches.map(c=>[c.label,c])).values()].slice(0,5);
 const dutyText=insights.duties.join(' '),experience=profile.evidence||'';
 const domains=[
  ['Marketing automation and campaigns',/marketing automation|email.{0,20}(?:campaign|technolog)|mobile technolog|campaigns/i,/marketing automation|(?:ran|managed|built|delivered).{0,40}(?:email|marketing) campaigns/i],
  ['Conversion optimisation and A/B testing',/conversion rates?|conversion optimi|\bab tests?\b|a\/b test/i,/conversion optimi|\bab tests?\b|a\/b test/i],
  ['Cyber-risk frameworks',/cyber.?risk|risk management frameworks/i,/cyber.?risk|risk management frameworks/i],
  ['Customer renewals and revenue ownership',/renewals?|own.{0,30}(?:revenue|book of business)/i,/(?:owned|managed|led).{0,40}(?:renewals?|revenue|book of business)/i]
 ];
 const domainChecks=domains.filter(([,request,proof])=>request.test(dutyText)&&!experience.split(/\n+/).some(s=>proof.test(s)&&!/\b(?:no|not|learning|want)\b/i.test(s))).map(([label])=>label);
 const concerns=[];
 if(facts.eligibilityConflict)concerns.push('Your saved sponsorship needs conflict with the advert. Resolve eligibility before applying.');
 if(facts.restrictedRemote.length)concerns.push(`Remote work is restricted. Advertised location: ${facts.location}. Confirm residence, work rights and any relocation needed.`);
 if(facts.fixedContract)concerns.push(`${facts.fixedContract}: confirm whether a short-term role suits your plans; an extension or progression path is not assured.`);
 if(facts.leadership.length)concerns.push('The duties include team or practice leadership. Delivery experience alone does not establish that level of responsibility.');
 if(domainChecks.length)concerns.push(`The daily work includes ${domainChecks.join('; ').toLowerCase()}. Relevant experience was not found in your saved details.`);
 if(facts.salary.length)concerns.push(`Advertised pay: ${(facts.salary.find(s=>/yearly|annually|per (?:year|month|hour)/i.test(s))||facts.salary[0]).replace(/^Salary:\s*/i,'')} ${profile.salaryTarget?'Compare this with your saved target; currencies and pay periods must be comparable.':'No pay target is saved, so affordability is unresolved.'}`);
 if(!facts.salary.length)concerns.push('Pay is not clearly advertised; confirm the range before investing time.');
 const required=insights.requirements.filter(r=>!r.preferred),unresolved=required.filter(r=>['unknown','partial','gap'].includes(r.status));
 const verdict=facts.eligibilityConflict?'Resolve eligibility first':facts.counts.gap?'Check the qualification gaps':workEvidence.length&&concerns.length?'Relevant experience; review the trade-offs':facts.score>=8?'Promising documented skills':facts.score!==null&&facts.score<3?'Limited evidence for this role':'Worth a closer look';
 const summary=workEvidence.length?`Your saved experience overlaps with ${[...new Set(workEvidence.map(c=>c.label.toLowerCase()))].slice(0,3).join(', ')}. This supports parts of the day-to-day work, but does not establish every qualification or specialist domain.`:'No clear overlap with the advertised duties was found in your saved details. Read the original advert and compare concrete examples before deciding.';
 const nextStep=facts.eligibilityConflict?'Confirm whether the employer can accommodate your work-right situation before starting an application.':facts.restrictedRemote.length||facts.fixedContract?'Check the location and contract terms first. If those work for you, use the CV evidence below and prepare examples for the unresolved requirements.':'Compare the advertised terms with your priorities, then prepare specific examples for the unresolved requirements.';
 return {verdict,summary,workEvidence,concerns,nextStep,requiredCount:required.length,optionalCount:insights.requirements.filter(r=>r.preferred).length,unresolvedCount:unresolved.length,domainChecks};
}
export function identity(job) {
  return [job.company, job.title, job.location].map(s => String(s || '').toLowerCase().replace(/[^\p{L}\p{N}]/gu, '')).join('|');
}
export function sameJob(a, b) { return a.id === b.id || identity(a) === identity(b) || (safeURL(a.link) && safeURL(a.link).replace(/\/apply\/?$/, '').split('?')[0] === safeURL(b.link).replace(/\/apply\/?$/, '').split('?')[0]); }
export function prepareApplication(job, profile) {
  const match = matchJob(job, profile);
  const cv = /developer|software engineer|full[ -]?stack/i.test(job.title) ? 'Full Stack Developer CV' : match.cv;
  const cvFile = profile[cvKey(cv)+'CV'] || '';
  const pitch = [profile.name ? `My name is ${profile.name}.` : '', `I am interested in the ${job.title} role at ${job.company}.`, profile.motivation, profile.evidence ? `Relevant experience:\n${profile.evidence}` : 'Add your verified experience in Profile to personalise this draft.'].filter(Boolean).join('\n\n');
  return {
    pitch, cv, cvFile, startDate: profile.startDate,
    workRights: profile.workRights || 'Add your exact work-authorisation position in Profile. Confirm the answer for this country.',
    languages: profile.languages,
    checks: {listing: false, eligibility: false, cv: false, answers: false}, preparedAt: new Date().toISOString()
  };
}
export function changeApplicationStatus(entry,status,date) {
 if(!STATUSES.includes(status))throw Error('Invalid application status');
 const next={...entry,status};
 if(['To apply','Preparing','Not applied'].includes(status)){
  next.applicationDate='';next.interviewDate='';next.followUpDate='';
 }else if(status==='Applied'&&!next.applicationDate)next.applicationDate=date;
 return next;
}
export function validateEntries(entries) {
  if (!Array.isArray(entries) || entries.length > 10000) throw new Error('Invalid entries');
  const ids = new Set();
  return entries.map(e => {
    if (!e || typeof e !== 'object' || typeof e.id !== 'string' || !e.id || ids.has(e.id) || typeof e.company !== 'string' || !e.company.trim() || typeof e.title !== 'string' || !e.title.trim() || !STATUSES.includes(e.status)) throw new Error('Invalid application');
    ids.add(e.id);
    const result = { ...e };
    for (const key of ['location','applicationDate','interviewDate','link','materials','requirements','notes']) {
      if (e[key] != null && typeof e[key] !== 'string') throw new Error('Invalid field');
      result[key] = e[key] || '';
    }
    if(e.followUpDate!==undefined && (typeof e.followUpDate!=='string' || e.followUpDate && !/^\d{4}-\d{2}-\d{2}$/.test(e.followUpDate)))throw new Error('Invalid follow-up date');
    if (result.link && !safeURL(result.link)) throw new Error('Invalid link');
    if (e.preparation) {
      const p = e.preparation;
      if (typeof p !== 'object' || !p.checks || typeof p.checks !== 'object') throw new Error('Invalid preparation');
      for (const key of ['pitch','cv','cvFile','startDate','workRights','languages','preparedAt']) if (typeof p[key] !== 'string') throw new Error('Invalid preparation field');
      for (const key of ['listing','eligibility','cv','answers']) if (typeof p.checks[key] !== 'boolean') throw new Error('Invalid checklist');
    }
    return result;
  });
}
export function validateProfile(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input) || !Object.keys(defaultProfile).some(key => key in input)) throw new Error('Invalid profile');
  const result = {...defaultProfile};
  for (const key of Object.keys(result)) {
    if (input[key] !== undefined) {
      if (typeof input[key] !== typeof result[key]) throw new Error('Invalid profile field');
      result[key] = input[key];
    }
  }
  if (!Object.hasOwn(regions,result.geography) || !['A1','A2','B1','B2','C1','C2'].includes(result.germanLevel)) throw new Error('Invalid preference');
  if(result.country&&!europeanCountries.some(c=>c.value===result.country))throw new Error('Invalid country');
  if(result.geography!=='europe')result.country='';
  return result;
}
