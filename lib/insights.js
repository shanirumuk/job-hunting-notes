const levels=['A1','A2','B1','B2','C1','C2'];
const clean=s=>String(s||'').replace(/<[^>]+>/g,' ').replace(/&nbsp;|&#160;/gi,' ').replace(/&amp;/gi,'&').replace(/&#39;|&apos;|[’‘]/g,"'").replace(/&quot;/gi,'"').replace(/\s+/g,' ').trim();
export function germanRequirement(description,level='B1') {
 const text=clean(description).replace(/\b(?:mind|min|bzw)\./gi,m=>m.slice(0,-1)),known=levels.includes(level)?level:'B1';
 if(/(?:no|without).{0,12}german.{0,12}(?:required|necessary|needed)|keine? deutschkenntnisse.{0,20}(?:erforderlich|notwendig)/i.test(text))return {status:'match',label:'German not required',detail:`Your German: ${known}. The listing explicitly says German is not required.`};
 const clauses=text.match(/[^.!?;\n]*(?:german|deutsch)[^.!?;\n]*/gi)||[];
 for(const clause of clauses){
  // Scope the level to German, not a neighbouring English requirement.
  const after=clause.match(/(?:german|deutsch\w*)(.*?)(?=\b(?:english|englisch|french|französisch)\b|$)/i)?.[1]||'';
  const before=clause.match(/(?:\b([ABC][12])\s*(?:level|niveau)?\s*)(?:german|deutsch)/i)?.[1];
  const explicit=after.match(/\b([ABC][12])\b/i)?.[1]?.toUpperCase()||before?.toUpperCase();
  const optional=/optional|nice.to.have|preferred|wünschenswert|von vorteil|idealerweise/i.test(clause);
  if(explicit){const gap=levels.indexOf(explicit)>levels.indexOf(known);return {status:gap?'gap':'match',label:`German ${explicit}${optional?' preferred':' required'} · you: ${known}`,detail:gap?`Your ${known} is below the stated ${explicit} level.${optional?' This is a preference, not a confirmed exclusion.':''}`:`Your ${known} meets this stated language level.`,source:clause,optional};}
  if(/fluent|native|verhandlungssicher|fließend|fliessend|muttersprach|excellent|sehr gute/i.test(clause))return {status:['A1','A2','B1'].includes(known)?'gap':'unknown',label:`Strong German${optional?' preferred':' requested'} · you: ${known}`,detail:`The wording suggests more than B1; no exact CEFR level is stated.${optional?' It is described as a preference.':''}`,source:clause,optional};
 }
 return {status:'unknown',label:clauses.length?`German level unclear · you: ${known}`:`German requirement not stated · you: ${known}`,detail:'A German-language advert alone does not prove a language requirement. Confirm the required level.',source:clauses[0]};
}
// Preserve the employer's sections: benefits and company boilerplate are not job skills.
export function listingSections(value='') {
 const sections={duties:[],requirements:[],preferred:[],benefits:[],terms:[]};let active=null;
 const headings=[
  ['duties',/^(?:your (?:mission|responsibilities|tasks|role)|what you(?: will|'ll) be doing|what you(?: will|'ll) do|what will you (?:do|accomplish)|responsibilities|key responsibilities|the role|about the role|your impact|the position|aufgaben|deine aufgaben|deine mission|dein aufgabenbereich|ihre (?:aufgaben|hauptaufgaben)|deine hauptaufgaben|vos missions|missions)\b/i],
  ['preferred',/^(?:what (?:would give|gives) you an edge|bonus points|nice.to.have|preferred qualifications|desirable|a plus|wünschenswert|das ist ein plus|idealerweise bringst du)\b/i],
  ['requirements',/^(?:what do we need from you|what will you bring|must.haves|education and experience|your qualifications|what you need to succeed|you are in the right place if|what (?:we(?:'re| are) looking for|you(?:'ll| will) bring|you bring|you need|you'll need)|(?:minimum |basic |required |essential |key )?(?:requirements|qualifications|skills)|your (?:profile|background|experience)|ideal (?:profile|candidate)|who you are|about you|dein profil|ihr profil|deine qualifikationen|ihre qualifikationen|qualifikationen|votre profil|anforderungen|das bringst du mit|was du mitbringst|um teil unseres teams zu werden|who we are looking for)\b/i],
  ['benefits',/^(?:why (?:should you join us|join us|work with us)|what (?:we offer|you can expect from us)|your benefits|what we provide|what's in it for you|benefits|perks|our offer|wir bieten|das bieten wir|was wir (?:dir |ihnen )?bieten|unser angebot|vos avantages)\b/i],
  ['terms',/^(?:about the (?:internship|apprenticeship|contract)|employment details|contract details|practical details|job details|role details|rahmenbedingungen)\b/i],
  [null,/^(?:recruitment process|hiring process|how to apply|about us|about the company|equal opportunit|diversity|job description|bewerbungsprozess|der interviewprozess)\b/i]
 ];
 const prepared=String(value).replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi,'')
  .replace(/<li\b[^>]*>/gi,'\n• ').replace(/<\/?(?:p|div|h[1-6]|ul|ol|br)[^>]*>/gi,'\n')
  .replace(/[•●▪]/g,'\n• ').replace(/([^\n])\s+((?:Requirements|Qualifications|Ideal Profile|Preferred Qualifications|Benefits|Responsibilities)\s*:)/gi,'$1\n$2');
 const lines=prepared.split(prepared.includes('\n')?/\n+/:/(?<=[.!?])\s+(?=[A-ZÄÖÜ])/).map(clean).filter(Boolean);
 for(const original of lines){
  const line=original.replace(/^[^\p{L}\p{N}€£$]+/u,'').trim();if(!line)continue;
  const heading=headings.find(([,pattern])=>pattern.test(line));
  const headingTail=heading?line.replace(heading[1],'').trim():'';
  if(heading && (!headingTail||/^[:(?]|^for (?:this|the|our)\b/i.test(headingTail)||line.includes(':'))){active=heading[0];const colon=line.indexOf(':');if(colon>=0&&line.slice(colon+1).trim().length>2&&active)sections[active].push(line.slice(colon+1).trim());continue;}
  if(/^(?:find (?:more )?.*jobs|at .{0,45}(?:committed|strive)|we (?:know that the perfect|encourage|celebrate)|if reasonable accommodations|no matter your role)/i.test(line))continue;
  if(/selbst wenn du nicht jede anforderung|we encourage you to apply|we evaluat|wir evaluieren|alle bereitgestellten informationen/i.test(line))continue;
  if(/^(?:compensation|salary|starting date|start date|duration|schedule|location|contract|gehalt|beginn|arbeitszeit)\s*:/i.test(line)){sections.terms.push(line);continue;}
  if(/^(?:we offer|benefits include|wir bieten)\b/i.test(line)){sections.benefits.push(line);continue;}
  if(active==='duties'&&/\b(?:must|required|minimum)\b/i.test(line)){sections.requirements.push(line);continue;}
  if(active==='benefits'&&/salary range|compensation|gehalt/i.test(line)){if(!sections.terms.some(t=>/salary|compensation|gehalt/i.test(t)))sections.terms.push(line);continue;}
  if(active){
   if(active==='benefits'&&!/remote|hybrid|flex|salary|leave|holiday|pension|insurance|mentorship|training|allowance|budget|days|week|urlaub|weiterbildung|altersvorsorge|homeoffice|€|£|\$/i.test(line))continue;
   sections[active].push(line);
  }else if(/\b(?:must|required|proficiency|fluent|experience|kenntnisse|erforderlich|sponsorship|bachelor|master|degree|certification)\b/i.test(line)&&!/we offer|benefits|not require|we have|our company|our team|we are|we're/i.test(line))sections.requirements.push(line);
  else if(/(?:you will|you'll|your role:|du wirst|sie werden)/i.test(line))sections.duties.push(line.replace(/^(?:your role:)\s*/i,''));
  else if(/(?:we offer|benefits include|wir bieten)/i.test(line))sections.benefits.push(line);
 }
 for(const key of Object.keys(sections))sections[key]=[...new Set(sections[key])];
 return sections;
}
function concise(line){
 // Only remove verbal padding. Keep tools, numbers, conditions and the actual task.
 return line.replace(/\s*[–—-]\s*(?:you'll be the voice|you'll manage)[\s\S]*$/i,'')
  .replace(/\b(?:our extensive|our comprehensive|highly dynamic|strategically)\s+/gi,'')
  .replace(/\byou(?: will|'ll) be (?:responsible for|in charge of)\s+/gi,'')
  .replace(/\byou(?: will|'ll)\s+/gi,'')
  .replace(/get your hands dirty\s*/gi,'')
  .replace(/\s*[–—-]\s*not just flagging[\s\S]*$/i,'')
  .replace(/with a keen eye for identifying opportunities/i,'')
  .replace(/\bLeverage\b/g,'Use').replace(/\s+/g,' ').trim();
}
function conciseDuty(line) {
 let text=concise(line);
 // Compress verbose action clauses, retaining their objects, tools and conditions.
 // Unrecognised wording is kept intact rather than replaced with a skill category.
 text=text.replace(/^(?:[^:]{1,60}:\s*)?Navigate through (?:our )?database of (?:thousands of )?(.+?), qualifying and prioritizing them based on (.+)$/i,'Qualify and prioritise $1 by $2');
 text=text.replace(/^(?:[^:]{1,60}:\s*)?Provide professional consultation and support via ([^,]+), guiding (.+?) through (?:our )?onboarding journey from (.+?) to (.+)$/i,'Guide $2 from $3 to $4 using $1');
 text=text.replace(/^(?:[^:]{1,60}:\s*)?Use (.+?) to analyze (.+?), create strategic reports, and identify the most promising (.+)$/i,'Use $1 to analyse $2, create reports and identify $3');
 text=text.replace(/^(?:[^:]{1,60}:\s*)?Take ownership of improvement projects end to end\. (?:identifying|Identify) pain points, spotting repetitive tasks ripe for automation, and driving solutions from idea to implementation with the help of your manager[.!]?$/i,'Own improvement projects: identify process issues, automate repetitive tasks and implement solutions with your manager');
 text=text.replace(/^(?:[^:]{1,60}:\s*)?Communicate directly with (.+?), building strong professional relationships that drive business growth[.!]?$/i,'Build relationships with $1');
 return text;
}
const skillRules=[
 ['API integrations',/\bapis?\b(?:[ -](?:integration|anbindung)\w*)?/i],['XML',/\bxml\b/i],['SFTP',/\bsftp\b/i],
 ['Excel',/\bexcel\b/i],['Pivot tables',/pivot[ -]?tables?|pivottabellen/i],['SQL',/\b(?:sql|postgresql|mysql)\b/i],['Regular expressions',/regular expressions?|\bregex\b/i],
 ['Salesforce',/salesforce/i],['CRM',/\bcrm\b/i],['SAP',/\bsap\b/i],['ServiceNow',/servicenow/i],['Power BI',/power\s?bi/i],['Tableau',/tableau/i],
 ['Python',/\bpython\b/i],['JavaScript',/\bjavascript\b/i],['Java',/\bjava\b/i],['Jira',/\bjira\b/i],['Confluence',/confluence/i],
 ['SaaS',/\bsaas\b/i],['ERP',/\berp\b/i],['EHR systems',/\behr\b|patientenverwaltungssystem\w*/i],['VPN',/\bvpns?\b/i],['Networks',/network(?:ing|s)?|netzwerk\w*/i],
 ['Requirements analysis',/requirements (?:analysis|gathering|documentation|elicitation)|business analysis|business needs.{0,60}requirements|anforderungsanalyse/i],
 ['Process documentation',/process documentation|technical documentation|prozessdokumentation|technische dokumentation/i],['Testing',/\btesting\b|automated tests?|\bplaywright\b|test planning|user acceptance test(?:ing)?|\buat\b/i],
 ['Stakeholder workshops',/stakeholder workshops?|workshop facilitation/i],['Project management',/project management|projektmanagement/i],
 ['Change management',/change management/i],['Customer onboarding',/customer onboarding|client onboarding/i],['Data analysis',/data analysis|datenanalyse/i]
];
const languageRules=[['English',/\b(?:english|englisch\w*)\b/i],['German',/\b(?:german|deutsch\w*)\b/i],['French',/\b(?:french|französisch\w*)\b/i],['Spanish',/\b(?:spanish|spanisch\w*)\b/i],['Dutch',/\b(?:dutch|niederländisch\w*)\b/i],['Mandarin',/\bmandarin\b/i],['Afrikaans',/\bafrikaans\b/i],['Shona',/\bshona\b/i]];
const evidenceLines=profile=>String(profile.evidence||'').split(/\n+|(?<=[.!?])\s+|;\s*/).map(clean).filter(Boolean);
const tentative=/\b(?:no|not|never|without|lack|learning|learn|want|hope|plan|aspir|keine?|nicht)\b/i;
function skillCheck(label,pattern,evidence){
 const lines=evidence.filter(s=>pattern.test(s));
 const quote=lines.find(s=>!tentative.test(s));
 return {label,status:quote?'match':'unknown',detail:quote?'Recorded in your experience.':`Add a concrete example of your ${label} experience.`,evidence:quote||''};
}
// These are transferable capabilities, not proof of an entire requirement.
// Each inference must point to a concrete CV excerpt; domain, seniority and
// commercial ownership still need independent evidence.
const capabilityRules=[
 ['Customer support', /customer (?:relationships?|success)|client relationships?|customer-facing|support(?:ing)?[^.!?]{0,35}customers?/i, /(?:customers?|clients?)[^.!?]{0,100}(?:resolv|support|help|onboard)|(?:resolv|support|help|onboard)[^.!?]{0,100}(?:customers?|clients?)/i],
 ['Process documentation', /document(?:ation|ing)?|document new processes/i, /process documentation|technical documentation|document(?:ed|ing)[^.!?]{0,40}(?:process|workflow)/i],
 ['Cross-team collaboration', /cross[ -]functional|team player|multiple teams|stakeholders|collaborat/i, /coordinat[^.!?]{0,70}teams|work[^.!?]{0,50}(?:teams|stakeholders)|collaborat[^.!?]{0,50}(?:teams|departments)/i],
 ['Business and technical communication', /translat[^.!?]{0,40}(?:ideas|concepts)|communicat|variety of audiences/i, /business needs[^.!?]{0,70}requirements|communication with business teams|explain[^.!?]{0,50}(?:technical|business)/i],
 ['Independent delivery', /self.starter|self.motivated|independent|ownership|own projects/i, /sole developer|independently|led[^.!?]{0,60}(?:project|delivery)|owned[^.!?]{0,60}(?:project|delivery)/i],
 ['Customer onboarding', /onboard|implementation/i, /customer onboarding|client onboarding|customers[^.!?]{0,50}prepare to use/i],
 ['Problem solving', /problem.solv|troubleshoot|diagnos|resolv[^.!?]{0,30}(?:issues|problems)/i, /resolv[^.!?]{0,30}(?:issues|problems)|troubleshoot|diagnos/i],
 ['Project delivery', /project management|project delivery|deliver[^.!?]{0,30}projects/i, /deliver[^.!?]{0,100}(?:deadline|months|project)|project management/i],
 ['Process improvement', /process (?:improvement|design|optimisation|optimization)|improv[^.!?]{0,25}workflows/i, /improv[^.!?]{0,25}workflows|process (?:design|improvement)|automat[^.!?]{0,30}(?:process|workflow)/i],
 ['Data analysis', /analytical|data analys|business analytics|data visuali[sz]/i, /data (?:processing|analysis|visuali[sz])|business analytics|checking[^.!?]{0,30}data/i],
 ['Requirements discovery', /requirements (?:gathering|analysis)|understand[^.!?]{0,30}(?:business|customer) needs/i, /requirements gathering|business needs[^.!?]{0,60}requirements|defined product needs/i]
];
function capabilityChecks(line,evidence,checks){
 for(const [label,requirement,proof] of capabilityRules){
  if(!requirement.test(line)||checks.some(c=>c.label===label&&c.status==='match'))continue;
  const quote=evidence.find(s=>proof.test(s)&&!tentative.test(s));
  if(quote)checks.push({label,status:'partial',detail:'Related experience in your CV supports part of this point. The exact scope and additional conditions are not confirmed.',evidence:quote});
 }
}
function languageChecks(line,profile){
 const found=languageRules.map(([label,pattern])=>({label,pattern,index:line.search(pattern),token:line.match(pattern)?.[0]})).filter(l=>l.index>=0).sort((a,b)=>a.index-b.index);
 return found.map((lang,i)=>{
  const before=line.slice(i?found[i-1].index+found[i-1].token.length:0,lang.index);
  const after=line.slice(lang.index+lang.token.length,found[i+1]?.index??line.length);
  const priorLevel=before.match(/\b([ABC][12])\s*(?:level|niveau)?\s*$/i)?.[1];
  const required=(after.match(/^[^,;]*?\b([ABC][12])\b/i)?.[1]||priorLevel)?.toUpperCase();
  const shared=line.slice(0,found[0].index);
  const wording=(before.match(/(?:fluent|native|professional|excellent|verhandlungssicher|fließend|sehr gute)\s*$/i)?.[0]||shared)+' '+after.split(/\band\b|\bund\b|[,;]/i)[0];
  const own=String(profile.languages||'').split(/[,;\n]/).find(s=>lang.pattern.test(s))||'';
  const yours=lang.label==='German'?profile.germanLevel:own.match(/\b([ABC][12])\b/i)?.[1]?.toUpperCase();
  let status='unknown',detail=yours?`Your ${lang.label}: ${yours}. The advert does not give a comparable level.`:`Your ${lang.label} level is not recorded.`,evidence=own.trim();
  if(yours&&required){status=levels.indexOf(yours)>=levels.indexOf(required)?'match':'gap';detail=`Requires ${required}; your saved level is ${yours}.`;}
  else if(/native|muttersprach/i.test(wording)){status=/native|muttersprach/i.test(own)?'match':'unknown';detail='Native-level ability is requested; a CEFR level alone does not establish this.';}
  else if(yours&&/fluent|professional|excellent|high[ -]level.{0,20}proficiency|verhandlungssicher|fließend|sehr gute/i.test(wording)){
   status=['C1','C2'].includes(yours)?'match':['A1','A2','B1'].includes(yours)?'gap':'unknown';detail=`Your ${lang.label}: ${yours}. The advert asks for strong fluency without an exact CEFR level.`;
  }
  else if(['C1','C2'].includes(yours)&&/communicat|kommunik|kommunizier|working language/i.test(line)){
   status='match';detail=`Your ${lang.label} ${yours} supports the requested workplace communication. The advert gives no exact CEFR level.`;
  }
  if(lang.label==='German'&&/no german|german not required|keine deutsch/i.test(line)){status='match';detail='The advert explicitly says German is not required.';}
  return {label:lang.label,status,detail,evidence:evidence||(yours?`${lang.label} ${yours}`:'')};
 });
}
function assess(line,profile,preferred){
 preferred ||= !/\b(?:required|must|minimum|erforderlich)\b/i.test(line)&&/preferred|nice.to.have|a plus|bonus|wünschenswert|von vorteil|idealerweise/i.test(line);
 const evidence=evidenceLines(profile),checks=languageChecks(line,profile);
 const skills=skillRules.filter(([,pattern])=>pattern.test(line));
 for(const [label,pattern] of skills)checks.push(skillCheck(label,pattern,evidence));
 capabilityChecks(line,evidence,checks);
 const years=line.match(/(?:at least |minimum(?: of)? |mindestens )?(\d+)(?:\s*[-–]\s*\d+|\+)?\s*(?:years?|jahre[n]?)[’']?\b/i);
 if(years){
  const durationContext=line.slice(years.index+years[0].length).replace(/^[’']?\s*(?:of\s+)?experience\s*(?:in|with|of)?\s*/i,'');
  const contextWords=(durationContext.toLowerCase().match(/[a-z]{4,}/g)||[]).filter(w=>!['experience','required','years','least','minimum','working','knowledge'].includes(w));
  const relevant=evidence.filter(s=>!tentative.test(s)&&(skills.length?skills.every(([,pattern])=>pattern.test(s)):contextWords.length&&contextWords.every(w=>s.toLowerCase().includes(w))));
  const recorded=relevant.map(s=>({quote:s,years:Number(s.match(/(\d+)\+?\s*(?:years?|jahre[n]?)\b/i)?.[1])})).filter(s=>Number.isFinite(s.years));
  const best=recorded.sort((a,b)=>b.years-a.years)[0];
  checks.push({label:'Experience duration',status:best&&best.years>=Number(years[1])?'match':'unknown',detail:best?`The advert asks for ${years[1]}+ years; your relevant saved example states ${best.years}. Confirm your total relevant experience.`:`Add the number of years in this specific work; the advert asks for ${years[1]}+.`,evidence:best?.quote||''});
 }
 if(/internship agreement|french school|enrolled|immatricul|eingeschrieben/i.test(line))checks.push({label:'Student eligibility',status:'unknown',detail:'Confirm current enrolment and whether you can provide the required school agreement.'});
 if(/bachelor|master|degree|abschluss|studium|certif|zertifi/i.test(line)){
  const level=/bachelor/i.test(line)?/\b(?:bachelor|bsc|b\.sc\.?|bachelor's)\b/i:/master/i.test(line)?/\b(?:master|msc|m\.sc\.?)\b/i:null;
  const quote=level?evidence.find(s=>level.test(s)&&!tentative.test(s)):null;
  checks.push({label:'Education or certification',status:quote?'match':'unknown',detail:quote?'This degree level is recorded in your CV. Check any requested subject or certification separately.':'Confirm the exact qualification, subject and any required certification against your education.',evidence:quote||''});
 }
 if(/sponsor|work permit|work authori[sz]ation|right to work|visa|arbeitserlaubnis/i.test(line))checks.push({label:'Work eligibility',status:'unknown',detail:'Confirm the employer’s country-specific work-right and sponsorship conditions.',evidence:profile.workRights||''});
 // Do not turn a keyword match into approval of additional seniority, domain or
 // proficiency conditions. Keep the whole employer requirement available above it.
 let remainder=line;
 for(const [,pattern] of [...skills,...languageRules])remainder=remainder.replace(new RegExp(pattern.source,'gi'),' ');
 remainder=remainder.replace(/\b[ABC][12]\b/gi,'').replace(/(?:at least |minimum(?: of)? )?\d+\+?\s*years?(?: of)?/gi,'');
 const words=remainder.toLowerCase().match(/[a-zäöüß]+/g)||[];
 const generic=new Set("a an the and or with of in for to as is are you your have has having be bring required requirement requirements preferred experience experienced knowledge familiarity familiar skills skill ability proficiency proficient fluent fluency strong excellent professional high level language both written spoken working work hands on understanding practical solid proven demonstrated expertise including plus sowie und oder mit kenntnisse erfahrung erfahrungen gute guten sehr ein eine der die das im auf".split(' '));
 const extra=words.filter(w=>!generic.has(w));
 if(checks.length&&extra.length&&!checks.some(c=>c.status==='unknown'))checks.push({label:'Full requirement',status:'unknown',detail:'The skill checks below cover part of this point. Confirm its additional conditions and requested depth of experience.'});
 if(!checks.length)checks.push({label:'Evidence needed',status:'unknown',detail:profile.evidence?'Your saved experience does not establish this requirement. Add a specific achievement, qualification or level that addresses it.':'Add your experience to My profile so this requirement can be compared with your background.'});
 const all=checks.every(c=>c.status==='match');
 const hasMatch=checks.some(c=>c.status==='match');
 const hasPartial=checks.some(c=>c.status==='partial');
 // A clearly expressed alternative can be supported by either listed skill.
 const alternative=skills.length===checks.length&&/\bor\b|\boder\b/i.test(line)&&!/\band\b|\bund\b|including/i.test(line);
 const status=checks.some(c=>c.status==='gap')?'gap':all||(alternative&&hasMatch)?'match':hasMatch||hasPartial?'partial':'unknown';
 return {label:concise(line),source:line,status,detail:status==='match'?'Supported by your saved details.':status==='partial'?'Some parts are supported; the remaining conditions need checking.':status==='gap'?'Your saved details show a gap in this requirement.':'Not enough information to confirm this requirement.',checks,preferred};
}
export function advertisedSalary(value='') {
 return String(value).replace(/<\/?(?:p|div|li|h[1-6]|br)[^>]*>/gi,'\n').split(/\n+|(?<=[.!?])\s+/).map(clean).filter(s=>
  /\d/.test(s)&&(/(?:salary|compensation|gehalt|pay range|base pay)\s*[:–-]?[^.!?]{0,60}(?:\d)/i.test(s)||
  /(?:€|£|\$|EUR|GBP|USD|CAD|ZAR|AUD).{0,45}(?:annual|year|month|hour|annum)|\d.{0,25}(?:EUR|GBP|USD).{0,20}(?:annual|year|month|hour)/i.test(s)&&!/allowance|budget|subsidy|learning|development|insurance|relocation|equipment/i.test(s))
 ).slice(0,3);
}
export function roleInsights(job,profile={}) {
 const raw=String(job.description||job.requirements||''),sections=listingSections(raw);
 const school=sections.terms.filter(s=>/agreement|enrolled|school|required|erforderlich/i.test(s));
 const requirements=[...sections.requirements.map(s=>assess(s,profile,false)),...school.filter(s=>!sections.requirements.includes(s)).map(s=>assess(s,profile,false)),...sections.preferred.map(s=>assess(s,profile,true))];
 const assessmentCounts=Object.fromEntries(['match','partial','gap','unknown'].map(status=>[status,requirements.filter(r=>r.status===status&&!r.preferred).length]));
 const german=requirements.find(r=>/german|deutsch/i.test(r.label))||null;
 const internship=/\bintern\b|internship|praktikum|apprentice/i.test(job.title||'');
 const commercial=/business development\s*\/\s*sales|passionat.{0,45}(?:sales|business development)|prospect.{0,30}(?:seller|customer)|qualifying and prioritizing.{0,50}business potential/i.test(sections.requirements.concat(sections.duties).join(' '));
 const warnings=[];
 if(school.length)warnings.push(concise(school[0]).replace(/^Contract:\s*/i,''));
 if(internship&&!school.length)warnings.push('Internship position.');
 if(commercial)warnings.push('Sales / business-development focus.');
 for(const r of requirements.filter(r=>r.status==='gap'&&!r.preferred))warnings.push(r.label);
 const questions=[];
 const dates=sections.requirements.concat(sections.terms).filter(s=>/start|internship from|beginn/i.test(s)).map(s=>s.match(/(?:January|February|March|April|May|June|July|August|September|October|November|December) \d{4}/i)?.[0]).filter(Boolean);
 if(new Set(dates).size>1)questions.push('Conflicting start dates in the listing: '+[...new Set(dates)].join(' / ')+'.');
 if(!requirements.some(r=>/english|german|french|deutsch|englisch|language|sprach/i.test(r.label)))questions.push('The supplied listing does not specify a working language.');
 if(!/sponsor|work permit|work authori[sz]ation|right to work|visa support|arbeitserlaubnis/i.test(raw))questions.push('Work rights and permit support are unconfirmed.');
 if(profile.startDate&&!sections.terms.some(s=>/start|beginn/i.test(s)))questions.push(`The start date is not stated; confirm availability from ${profile.startDate}.`);
 if(!advertisedSalary(raw).length)questions.push('Pay is not stated in the supplied listing.');
 return {requirements,assessmentCounts,hasExperience:!!String(profile.evidence||'').trim(),sourceKind:job.description?'advert':'saved notes',duties:sections.duties.map(conciseDuty),benefits:sections.benefits.map(s=>({label:concise(s),source:s})),terms:sections.terms.filter(s=>!school.includes(s)).map(concise),questions,warnings,german,internship,commercial,decision:commercial?'Lower priority':school.length?'Check eligibility':requirements.some(r=>r.status==='gap'&&!r.preferred)?'Requirement gap':'Review the requirements'};
}
