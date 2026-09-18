const levels=['A1','A2','B1','B2','C1','C2'];
const clean=s=>String(s||'').replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim();
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
  ['duties',/^(?:your (?:mission|responsibilities|tasks|role)|what you(?: will|'ll) be doing|what you(?: will|'ll) do|responsibilities|key responsibilities|the role|about the role|your impact|the position|aufgaben|deine aufgaben|deine mission|dein aufgabenbereich|ihre aufgaben|vos missions|missions)\b/i],
  ['requirements',/^(?:you are in the right place if|what (?:we(?:'re| are) looking for|you(?:'ll| will) bring|you bring)|requirements|qualifications|your profile|who you are|about you|dein profil|ihr profil|votre profil|anforderungen|das bringst du mit|was du mitbringst|your skills|who we are looking for)\b/i],
  ['preferred',/^(?:bonus points|nice.to.have|preferred qualifications|desirable|a plus|wünschenswert)\b/i],
  ['benefits',/^(?:why (?:should you join us|join us)|what we offer|benefits|perks|our offer|wir bieten|das bieten wir|was wir bieten|unser angebot|vos avantages)\b/i],
  ['terms',/^(?:about the (?:internship|apprenticeship|contract)|employment details|contract details|practical details|rahmenbedingungen)\b/i],
  [null,/^(?:recruitment process|hiring process|how to apply|about us|about the company|equal opportunit|diversity|ideal profile|job description|bewerbungsprozess)\b/i]
 ];
 const prepared=String(value).replace(/<li\b[^>]*>/gi,'\n• ').replace(/<\/?(?:p|div|h[1-6]|ul|ol|br)[^>]*>/gi,'\n');
 const lines=prepared.split(prepared.includes('\n')?/\n+/:/(?<=[.!?])\s+(?=[A-ZÄÖÜ])/).map(clean).filter(Boolean);
 const structured=lines.some(line=>headings.some(([,pattern])=>pattern.test(line)));
 for(const original of lines){
  const line=original.replace(/^[^\p{L}\p{N}€£$]+/u,'').trim();if(!line)continue;
  const heading=headings.find(([,pattern])=>pattern.test(line));
  if(heading && (line.length<100||line.includes(':'))){active=heading[0];const colon=line.indexOf(':');if(colon>=0&&line.slice(colon+1).trim().length>8&&active)sections[active].push(line.slice(colon+1).trim());continue;}
  if(/^(?:find (?:more )?.*jobs|at .{0,45}(?:committed|strive)|we (?:know that the perfect|encourage|celebrate)|if reasonable accommodations|no matter your role)/i.test(line))continue;
  if(/^(?:compensation|salary|starting date|start date|duration|schedule|location|contract|gehalt|beginn|arbeitszeit)\s*:/i.test(line)){sections.terms.push(line);continue;}
  if(/^(?:we offer|benefits include|wir bieten)\b/i.test(line)){sections.benefits.push(line);continue;}
  if(active==='duties'&&/\b(?:must|required|minimum)\b/i.test(line)){sections.requirements.push(line);continue;}
  if(active==='benefits'&&/salary range|compensation|gehalt/i.test(line)){if(!sections.terms.some(t=>/salary|compensation|gehalt/i.test(t)))sections.terms.push(line);continue;}
  if(active){
   if(active==='benefits'&&!/remote|hybrid|flex|salary|leave|holiday|pension|insurance|mentorship|training|allowance|budget|days|week|urlaub|weiterbildung|altersvorsorge|homeoffice|€|£|\$/i.test(line))continue;
   sections[active].push(line);
  }else if(!structured&&/\b(?:must|required|proficiency|fluent|experience|kenntnisse|erforderlich|sponsorship)\b/i.test(line)&&!/we offer|benefits|not require/i.test(line))sections.requirements.push(line);
  else if(!structured&&/(?:you will|you'll|your role:|du wirst|sie werden)/i.test(line))sections.duties.push(line.replace(/^(?:your role:)\s*/i,''));
  else if(!structured&&/(?:we offer|benefits include|wir bieten)/i.test(line))sections.benefits.push(line);
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
function assess(line,profile,preferred){
 const evidence=profile.evidence||'';let status='unknown',detail='';
 const languages=['english','englisch','german','deutsch','french','französisch','dutch','mandarin','spanish'].filter(name=>new RegExp('\\b'+name+'\\b','i').test(line));
 if(languages.length>1)return {label:concise(line),source:line,status:'unknown',detail:'This asks for more than one language; each needs to meet the stated requirement.',preferred};
 if(/internship agreement|french school|enrolled|immatricul|eingeschrieben/i.test(line))detail='The employer requires student enrolment or a school agreement. Confirm you can provide it before applying.';
 else if(/\bgerman\b|deutsch/i.test(line)){const g=germanRequirement(line,profile.germanLevel);status=g.status;detail=g.detail;}
 else if(/\benglish\b|englisch/i.test(line)){
  const yours=(profile.languages||'').match(/english\s*([ABC][12])/i)?.[1]?.toUpperCase();const required=line.match(/\b([ABC][12])\b/i)?.[1]?.toUpperCase();
  if(yours){status=required?(levels.indexOf(yours)>=levels.indexOf(required)?'match':'gap'):/fluent|professional|excellent/i.test(line)&&['C1','C2'].includes(yours)?'match':'unknown';detail=`Your English: ${yours}.`;}
  else detail='Your English level has not been loaded on this device.';
 }else if(/\bfrench\b|französisch/i.test(line)){const yours=(profile.languages||'').match(/french\s*([ABC][12])/i)?.[1];detail=yours?`Your French: ${yours}.`:'French is not among your listed languages.';}
 else if(/excel|pivot tables/i.test(line)){detail=/excel|pivot/i.test(evidence)?'Check that your Excel experience covers the requested functions.':'Excel pivot-table proficiency is not established by your recorded experience.';}
 else if(/salesforce|\bcrm\b/i.test(line)){detail=/salesforce/i.test(evidence)?'Salesforce is recorded in your experience.':'Salesforce / CRM experience needs checking.';status=/salesforce/i.test(evidence)?'match':'unknown';}
 else {
  const exactSkills=[[/\b(?:xml|sftp)\b/i,/\b(?:xml|sftp)\b/i],[/\bapi\b|integrations?/i,/\bapi\b|integration/i],[/requirements (?:analysis|documentation)|process documentation/i,/requirements|process documentation/i],[/testing|test planning/i,/testing/i]];
  if(exactSkills.some(([need,have])=>need.test(line)&&have.test(evidence))&&!/\d+\+?\s*years|expert|advanced|leadership|certif|\band\b|\bund\b|\bet\b|SAP|ServiceNow|Tableau|Power ?BI|Python|Java/i.test(line)){status='match';detail='Your recorded work includes this skill.';}
 }
 return {label:concise(line),source:line,status,detail,preferred};
}
export function roleInsights(job,profile={}) {
 const raw=String(job.description||job.requirements||''),sections=listingSections(raw);
 const school=sections.terms.filter(s=>/agreement|enrolled|school|required|erforderlich/i.test(s));
 const requirements=[...sections.requirements.map(s=>assess(s,profile,false)),...school.filter(s=>!sections.requirements.includes(s)).map(s=>assess(s,profile,false)),...sections.preferred.map(s=>assess(s,profile,true))];
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
 if(!sections.terms.some(s=>/salary|compensation|gehalt/i.test(s))&&!/salary|compensation|gehalt|€\s*\d|\d\s*€/i.test(raw))questions.push('Pay is not stated in the supplied listing.');
 return {requirements,duties:sections.duties.map(concise),benefits:sections.benefits.map(s=>({label:concise(s),source:s})),terms:sections.terms.filter(s=>!school.includes(s)).map(concise),questions,warnings,german,internship,commercial,decision:commercial?'Lower priority':school.length?'Check eligibility':requirements.some(r=>r.status==='gap'&&!r.preferred)?'Requirement gap':'Review the requirements'};
}
