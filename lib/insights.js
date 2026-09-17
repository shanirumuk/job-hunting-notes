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
const rules=[
 ['Requirements and process analysis',/requirements|workflow|user stor|acceptance criteria|business analysis|anforderung|prozessanalyse|prozessoptimierung/i,/requirements|workflow|process|anforderung/i],
 ['Integrations and technical troubleshooting',/\bapi\b|integration|xml|schnittstell|troubleshoot|fehleranalyse/i,/integration|xml|api|troubleshoot/i],
 ['Testing and delivery coordination',/testing|quality assurance|rollout|delivery coordination|abnahme|testplanung|projektkoordination/i,/testing|test|delivery|coordination/i],
 ['Documentation',/documentation|dokumentation|document processes/i,/documentation|dokumentation/i],
 ['Stakeholder workshops and training',/stakeholder|workshop|training|schulung|kundenberatung/i,/workshop|training|schulung|stakeholder/i]
];
export function roleInsights(job,profile={}) {
 const raw=String(job.description||job.requirements||''),text=clean(raw),evidence=profile.evidence||'';
 const requirements=[],duties=[];
 for(const [label,pattern,proof]of rules)if(pattern.test(text)){duties.push(label);const match=proof.test(evidence);requirements.push({status:match?'match':'unknown',label,detail:match?'Supported by your saved experience.':'Relevant work, but the specific experience is not confirmed in your saved profile.'});}
 const german=germanRequirement(raw,profile.germanLevel);requirements.push(german);
 const english=text.match(/(?:english|englisch\w*)\s*(?:(?:at|auf|level|niveau|minimum|required|mindestens)\s*)?[(:-]?\s*([ABC][12])\b/i);
 const yourEnglish=(profile.languages||'').match(/(?:english|englisch)\s*([ABC][12])/i)?.[1]?.toUpperCase();
 if(english){const required=english[1].toUpperCase();requirements.push({status:yourEnglish?(levels.indexOf(yourEnglish)>=levels.indexOf(required)?'match':'gap'):'unknown',label:`English ${required} requested${yourEnglish?' · you: '+yourEnglish:''}`,detail:yourEnglish?'Compared with the language level in your saved profile.':'Add or confirm your English level in your profile.'});}
 const experience=text.match(/(?:at least |minimum |mindestens )?\d+\+?(?:[–-]\d+)?\s*(?:years?(?: of)? (?:relevant |professional |work )?experience|jahre?\s*(?:berufs)?erfahrung)/i);
 if(experience)requirements.push({status:'unknown',label:experience[0],detail:'Your total qualifying experience needs checking; project examples alone do not verify years.'});
 for(const [label,pattern]of [['Degree or qualification',/bachelor|master.?s|hochschul|studium|university degree/i],['Specific platform or domain',/\bSAP\b|salesforce|servicenow|healthcare|LTPAC|contact.centre|contact.center|\bIVR\b|\bWFM\b/i]])if(pattern.test(text))requirements.push({status:'unknown',label,detail:'Check the exact requirement against your CV; not verified by the saved evidence.'});
 const benefits=[];
 const benefitRules=[['Flexible working hours',/flexible (?:working )?hours|flexible arbeitszeiten|gleitzeit/i],['Remote / hybrid working',/remote work|hybrid|homeoffice|home office|work from home|mobiles arbeiten/i],['Learning / development support',/training budget|learning budget|professional development|weiterbildung|fortbildung/i],['Pension contribution',/pension|altersvorsorge/i],['Transport / bike support',/jobticket|deutschlandticket|jobrad|cycle.to.work|transport allowance/i],['Health / wellbeing support',/health insurance|wellness allowance|gesundheitsangebote|fitnesszuschuss/i]];
 for(const [label,pattern]of benefitRules){const sentence=raw.split(/\n+|(?<=[.!?])\s+/).map(clean).find(s=>pattern.test(s)&&!/not offer|no (?:remote|hybrid)|kein[e]? (?:homeoffice|remote)/i.test(s));if(sentence)benefits.push({label,source:sentence.slice(0,320)});}
 const leave=text.match(/\b\d{2}\s*(?:days?(?: of)? (?:annual |paid )?(?:leave|holiday|vacation)|(?:tage|urlaubstage)(?: urlaub)?)/i);if(leave)benefits.push({label:leave[0],source:leave[0]});
 const sentences=raw.split(/\n+|(?<=[.!?])\s+/).map(clean).filter(s=>s.length>25);
 const excerpts=sentences.filter(s=>/responsibilit|you will|your role|aufgaben|du wirst|sie werden|verantwort|requirements|workflow|integration|stakeholder/i.test(s)).slice(0,3).map(s=>s.length>220?s.slice(0,217)+'…':s);
 return {requirements,benefits,duties,excerpts,german};
}
