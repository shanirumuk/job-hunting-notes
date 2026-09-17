export const KEY = 'job-notebook-v1';
export const DISCOVERY_KEY = 'job-notebook-discovery-v1';
export const PROFILE_KEY = 'job-notebook-profile-v1';
export const STATUSES = ['To apply', 'Preparing', 'Applied', 'Interview', 'Offer', 'Archived'];
export const defaultProfile = {
  name: '', email: '', phone: '', linkedin: '', startDate: '', languages: 'English C1, German B1, Afrikaans B2, Shona A1',
  geography: 'europe', germanLevel: 'B1', includeConditional: true, includeAdjacent: true,
  workRights: '', motivation: 'I want to solve difficult operational problems, improve systems, and get meaningful improvements delivered.',
  evidence: '', consultingCV: '', analystCV: '', developerCV: ''
};
export function safeURL(value) {
  try { const url = new URL(value); return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password ? url.href : ''; } catch { return ''; }
}
export function plainText(value = '') {
  return String(value).replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '').replace(/<[^>]*>/g, ' ').replace(/&nbsp;|&#160;/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#(\d+);/g, (_, n) => Number(n) <= 0x10ffff ? String.fromCodePoint(Number(n)) : '').replace(/\s+/g, ' ').trim();
}
const europe = /\b(germany|deutschland|berlin|munich|münchen|nuremberg|nürnberg|hamburg|frankfurt|cologne|köln|düsseldorf|stuttgart|leipzig|dresden|bonn|aachen|mannheim|karlsruhe|potsdam|bremen|hanover|hannover|europe|european|emea|ireland|dublin|netherlands|amsterdam|rotterdam|spain|barcelona|madrid|france|paris|lyon|portugal|lisbon|lisboa|poland|warsaw|wrocław|sweden|stockholm|denmark|copenhagen|austria|vienna|wien|switzerland|zurich|zürich|belgium|brussels|italy|milan|finland|helsinki|norway|oslo|united kingdom|\buk\b|london|manchester|czech|prague|estonia|tallinn|lithuania|vilnius|latvia|riga|romania|bucharest|greece|athens|hungary|budapest|luxembourg|malta|cyprus|croatia|slovenia|slovakia|bulgaria|sofia)\b/i;
const germany = /\b(germany|deutschland|berlin|munich|münchen|nuremberg|nürnberg|hamburg|frankfurt|cologne|köln|düsseldorf|stuttgart|leipzig|dresden|bonn|aachen|mannheim|karlsruhe|potsdam|bremen|hanover|hannover)\b/i;
const us = /\b(united states|u\.?s\.?a?\b|new york|san francisco|california|texas|boston|chicago|seattle|los angeles|washington|americas|amer)\b/i;
export function matchJob(job, profile = defaultProfile) {
  const title = job.title || '', location = job.location || '';
  const description = plainText(job.description || job.requirements || '');
  const text = `${title} ${description}`;
  const reasons = [], flags = [];
  const reject = reason => ({eligible: false, score: 0, reasons: [], flags: [reason], cv: 'Consulting CV'});
  if (/\bAMER\b/.test(title) || /(?:must|only|need to).{0,35}(?:reside|based|located|resident).{0,20}(?:united states|\bUSA\b)|(?:US|USA|United States)[ -]only/i.test(description)) return reject('US-only role excluded');
  if (us.test(location) && !europe.test(location) && !/worldwide|anywhere|global/i.test(location)) return reject('US location excluded');
  if (/\b(architect|architekt|developer|entwickler|(?:software|front[ -]?end|back[ -]?end|devops|platform|cloud|data|ai|machine learning|site reliability|security|embedded|application) engineer(?:ing)?|full[ -]?stack|sre|account executive|sales|sales development|business development|director|head of|vice president|vp)\b/i.test(title) || (/\baccount manager\b/i.test(title) && !/technical account manager/i.test(title))) return reject('Outside your preferred role or seniority');
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
  if (profile.geography === 'europe' && !europe.test(location) && !/worldwide|anywhere|global/i.test(location)) {
    if (/canada|australia|mexico|africa|asia|singapore|india|japan|brazil/i.test(location)) return reject('Outside Europe-first search');
    flags.push('Location needs checking: Europe eligibility is not stated.');
  }
  let score = 40 + (core ? 8 : 0);
  if (signals.people) { score += 14; reasons.push('Stakeholder workshops, customer collaboration or training'); }
  if (signals.analysis) { score += 10; reasons.push('Workflows, requirements, documentation or process improvement'); }
  if (signals.systems) { score += 10; reasons.push('Integrations, configuration or operational systems work'); }
  if (signals.delivery) { score += 8; reasons.push('Testing, rollout or delivery coordination'); }
  if (!reasons.length) reasons.push(ba ? 'Business analysis matches your career direction' : implementation ? 'Implementation & client delivery' : 'Business & technology delivery');
  if (germany.test(location)) { score += 12; reasons.push('Germany matches your first-choice geography'); }
  else if (europe.test(location)) { score += 7; reasons.push('Within your Europe-first search'); }
  if (adjacent) {
    reasons.push('An adjacent title with responsibilities that transfer from your experience');
    flags.push('Explore the day-to-day work: confirm stakeholder time and a light coding load.');
  }
  if (/technical account|customer success|revenue operations|solution consultant/i.test(title)) flags.push('Confirm the role focuses on systems and delivery, rather than sales targets.');
  const needsGerman = /(?:fluent|native|business.fluent|professional|excellent|c1|c2|b2).{0,45}(?:german|deutsch)|(?:german|deutsch).{0,45}(?:fluent|native|c1|c2|b2)|verhandlungssicher.{0,35}deutsch|deutsch.{0,35}verhandlungssicher/i.test(text);
  const requiredLevel = /\bb2\b/i.test(text) && !/\bc[12]\b|native|fluent|verhandlungssicher/i.test(text) ? 3 : 4;
  if (needsGerman && ['A1','A2','B1','B2','C1','C2'].indexOf(profile.germanLevel) < requiredLevel) { flags.push('German requirement may exceed your level; check the listing.'); score -= 18; }
  if (/mandarin|native french|fluent french|fluent dutch/i.test(text)) { flags.push('Another language requirement needs checking.'); score -= 10; }
  if (/\bsenior\b|\blead\b|[6-9]\+? years|10\+? years/i.test(title + ' ' + description)) { flags.push('Seniority or experience requirement needs checking.'); score -= 8; }
  if (/no (?:visa )?sponsorship|cannot sponsor|unable to (?:provide )?sponsor|not (?:offer|provide).{0,15}sponsorship|must (?:already )?have.{0,30}(?:right to work|work authori[sz]ation)/i.test(text)) { flags.push('Listing may require existing work rights or exclude sponsorship.'); score -= 15; }
  else flags.push('Work rights and permit support are unconfirmed.');
  if (!needsGerman && !/english/i.test(text)) flags.push('Working language is not stated clearly.');
  if (profile.startDate) flags.push(`Confirm the employer can accommodate a ${profile.startDate} start.`);
  if (!profile.includeConditional && flags.some(f => /German requirement|Another language|Seniority|Listing may|Location needs/.test(f))) return reject('Hidden by your conditional-match preference');
  return {eligible: true, score: Math.max(20, Math.min(96, score)), reasons, flags, exploration: adjacent, cv: ba || (!implementation && /analyst|operations|process|business systems|product owner/i.test(title)) ? 'Business Analyst CV' : 'Consulting CV'};
}
// Keep promising adjacent titles visible, without promoting weak matches.
export function rankJobs(jobs) {
  const sorted = [...jobs].sort((a,b) => b.match.score - a.match.score);
  const core = sorted.filter(j => !j.match.exploration);
  const adjacent = sorted.filter(j => j.match.exploration && j.match.score >= 50);
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
  if (!['europe','international'].includes(result.geography) || !['A1','A2','B1','B2','C1','C2'].includes(result.germanLevel)) throw new Error('Invalid preference');
  return result;
}
