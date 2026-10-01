// Whole-point matches only: a known task is not proof of adjacent design tools,
// seniority, domain experience, or every condition in a compound requirement.
const direct=[
 [/^(?:an? )?analytical problem-solving mindset with a willingness to investigate and resolve technical issues$/i, [/analytical (?:mindset|approach|thinking)/i, /resolv[^.!?]{0,35}technical issues|troubleshoot[^.!?]{0,35}technical/i]],
 [/^(?:collaborative )?team player comfortable working across multiple departments$/i, /work with [^.!?]{0,65}(?:teams|departments)|coordinat[^.!?]{0,60}across teams/i],
 [/^(?:(?:strong|effective|excellent|good) )?(?:(?:(?:written (?:and|&) (?:verbal|oral)|(?:verbal|oral) (?:and|&) written) )?communication(?: skills)?|communicat(?:e|ing) effectively)$/i, /effective communication skills|communicat(?:e|ing) effectively|(?:strong|excellent|good) communication skills/i],
 [/^(?:(?:strong|good) )?(?:multi[ -]?task(?:ing)?)(?: skills)?$/i, /\bmulti[ -]?task(?:ing)?\b/i],
 [/^(?:manag(?:e|ing) (?:multiple|several|concurrent) projects(?: (?:at once|simultaneously))?|multiple project management)$/i, /manag(?:e|ed|ing)[^.!?]{0,60}(?:multiple|several|concurrent) projects/i],
 [/^(?:project management(?: skills| experience)?|manag(?:e|ing) (?:a |an? single |one or more )?projects?)$/i, /manag(?:e|ed|ing)[^.!?]{0,60}projects?|project management/i],
 [/^(?:willing(?:ness)? to travel|travel (?:willingness|required))$/i, /\bwilling(?:ness)? to travel\b/i],
 [/^(?:make use of|use) (?:the )?ShadCN (?:design )?library to assemble (?:product )?screens and components$/i, /(?:experience with|used|using|skill:) ShadCN/i],
 [/^think in systems and identify gaps or inconsistencies$/i, /(?:checking|validat\w*) .{0,50}data.{0,100}prevent\w* duplicate|identif\w* .{0,30}(?:system gaps|system inconsistencies)/i],
 [/^(?:an? )?(?:structured (?:and |& ))?analytical (?:mindset|approach|thinking)$/i, /analytical (?:mindset|approach|thinking)/i],
 [/^requirements (?:gathering|elicitation|discovery)$/i, /requirements gathering|business needs.{0,60}(?:software |system )?requirements|(?:discussions|discussed).{0,80}requirements|defined product needs/i],
 [/^(?:translat(?:e|ing) (?:business(?: and customer)?|customer) (?:needs|requirements) into (?:clear )?(?:functional |product |software |system )?specifications(?: for development)?|(?:functional |software |system )requirements (?:definition|analysis))$/i, /business needs.{0,60}(?:software |system )?requirements|(?:built|defined|documented) (?:functional |software |system )requirements/i],
 [/^(?:document(?:ing)? functional requirements|functional requirements documentation)$/i, /requirements.{0,35}(?:process |technical )?documentation|document(?:ed|ing) (?:functional |software |system )requirements/i],
 [/^(?:(?:define and document|defining and documenting|document(?:ing)?|define) )?acceptance criteria$/i, /acceptance criteria|clear checks for whether features meet (?:those |the )?requirements/i],
 [/^process mapping$/i, /process mapping/i],
 [/^workflow mapping$/i, /workflow mapping/i],
 [/^user journey mapping$/i, /user journey mapping/i],
 [/^(?:analysis of )?business workflows(?: analysis)?$/i, /workflow analysis|analys(?:e|ed|ing) .{0,30}(?:business )?workflows/i],
 [/^(?:analysis of )?user journeys(?: analysis)?$/i, /user journey (?:analysis|mapping)|analys(?:e|ed|ing) .{0,30}user journeys/i]
];
export function directQualification(line,evidence){
 const atom=line.trim().replace(/[.!]$/,'').replace(/^(?:experience (?:with|in)|ability to|skills in)\s+/i,'');
 for(const [requested,proof] of direct){
  if(!requested.test(atom))continue;
  const quotes=(Array.isArray(proof)?proof:[proof]).map(pattern=>evidence.find(s=>pattern.test(s)&&! /\b(?:no|not|never|without|lack|learning|learn|want|hope|plan)\b/i.test(s)));
  if(quotes.every(Boolean))return {label:atom,evidence:[...new Set(quotes)].join(' ')};
 }
 return null;
}
export function splitQualification(line){
 // Split only known independently assessable clauses. Preserve any modifiers
 // outside these exact forms instead of silently discarding them.
 const unlabelled=line.replace(/^(?:exceptional communication|communication skills|communication|multitasking|project management|willingness to travel|travel)\s*:\s*/i,'');
 const trimmed=unlabelled.trim().replace(/[.!]$/,'');
 const combined=trimmed.match(/^((?:Strong|Effective|Excellent|Good) communication) and multitasking skills$/i);
 if(combined)return [combined[1]+' skills','Multitasking skills'];
 const patterns=[
  [/^(Fluent English\s*\([^)]*\)) with (strong presentation skills) and (the natural ability to engage in smooth, confident small talk)$/i,null],
  [/^(?:Ability to )?(multitask), (communicate effectively) and (manage multiple projects)$/i,null],
  [/^(Strong CRM experience\s*\([^)]*\)),\s*(sharp organisational instincts),\s*and (comfort working in a fast-paced, target-driven environment)$/i,null],
  [/^Experience with requirements gathering, process mapping, and translating business needs into functional specifications$/i,['Requirements gathering','Process mapping','Translating business needs into functional specifications']],
  [/^Experience with user journey mapping and workflow analysis$/i,['User journey mapping','Business workflows analysis']],
  [/^Experience documenting functional requirements and system behavio[u]?r$/i,['Documenting functional requirements','Documenting system behaviour']],
  [/^Analysis of user journeys and business workflows$/i,['Analysis of user journeys','Analysis of business workflows']],
  [/^Define and document user flows, system logic, edge cases, and acceptance criteria$/i,['Define and document user flows','Define and document system logic','Define and document edge cases','Define and document acceptance criteria']],
  [/^Document functional requirements and design guidelines to ensure accurate implementation$/i,['Document functional requirements','Document design guidelines to ensure accurate implementation']],
  [/^(A structured and analytical approach)\s*[-–—]\s*(thinking beyond features to consider .+)$/i,null]
 ];
 for(const [pattern,parts] of patterns){const match=trimmed.match(pattern);if(match)return parts||match.slice(1);}
 return [unlabelled];
}

// Related fields are accepted only when the advert explicitly allows them.
// This checks a standalone degree point, not extra licences, grades or tenure.
export function degreeQualification(line,evidence){
 const request=line.trim().replace(/[.!]$/,'').match(/^(?:an? )?(bachelor(?:'s)?|master(?:'s)?)(?: degree)?(?: in (.+?))?(?: (?:required|preferred))?$/i);
 if(!request||/certif|licen[cs]|accredit|honou?r|\bgpa\b|\byears?\b|equivalent experience/i.test(line))return null;
 const level=/^bachelor/i.test(request[1])?/\b(?:bachelor|bsc|b\.sc\.?|ba)\b/i:/\b(?:master|msc|m\.sc\.?)\b/i;
 const normalize=s=>s.toLowerCase().replace(/&/g,'and').replace(/[^a-z ]/g,' ').replace(/\s+/g,' ').trim();
 const related=/\b(?:a )?related (?:field|discipline|subject)/i.test(request[2]||'');
 const subjects=(request[2]||'').replace(/(?:,?\s*(?:or|and)\s*)?(?:a )?related (?:field|discipline|subject)s?/gi,'').split(/,|\bor\b/i).map(normalize).filter(Boolean);
 for(const quote of evidence){
  if(!level.test(quote)||/\b(?:no|not|without|pursuing|studying|expected|candidate|plan|want)\b/i.test(quote))continue;
  const field=normalize(quote.includes('·')?quote.split('·')[1]:quote.match(/(?:degree|bachelor(?:'s)?|master(?:'s)?|bsc|msc)\s+in\s+(.+)/i)?.[1]||'');
  const exact=subjects.some(subject=>field===subject||subject==='business'&&/\bbusiness\b/.test(field));
  const businessRelated=related&&subjects.some(subject=>/^(?:business(?: administration| management| studies)?|sales|commerce)$/.test(subject))&&/\b(?:business|commerce)\b/.test(field);
  if(!subjects.length||exact||businessRelated)return {label:'Education or certification',evidence:quote,detail:businessRelated&&!exact?'Your recorded degree in a business-related field meets the advertised related-field option.':'Your recorded degree supports the requested level and subject.'};
 }
 return null;
}
