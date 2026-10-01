// Whole-point matches only: a known task is not proof of adjacent design tools,
// seniority, domain experience, or every condition in a compound requirement.
const direct=[
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
  const quote=evidence.find(s=>proof.test(s)&&! /\b(?:no|not|never|without|lack|learning|learn|want|hope|plan)\b/i.test(s));
  if(quote)return {label:atom,evidence:quote};
 }
 return null;
}
export function splitQualification(line){
 // Split only known independently assessable BA clauses. Preserve any modifiers
 // outside these exact forms instead of silently discarding them.
 const trimmed=line.trim().replace(/[.!]$/,'');
 const patterns=[
  [/^Experience with requirements gathering, process mapping, and translating business needs into functional specifications$/i,['Requirements gathering','Process mapping','Translating business needs into functional specifications']],
  [/^Experience with user journey mapping and workflow analysis$/i,['User journey mapping','Business workflows analysis']],
  [/^Experience documenting functional requirements and system behavio[u]?r$/i,['Documenting functional requirements','Documenting system behaviour']],
  [/^Analysis of user journeys and business workflows$/i,['Analysis of user journeys','Analysis of business workflows']],
  [/^Define and document user flows, system logic, edge cases, and acceptance criteria$/i,['Define and document user flows','Define and document system logic','Define and document edge cases','Define and document acceptance criteria']],
  [/^Document functional requirements and design guidelines to ensure accurate implementation$/i,['Document functional requirements','Document design guidelines to ensure accurate implementation']],
  [/^(A structured and analytical approach)\s*[-–—]\s*(thinking beyond features to consider .+)$/i,null]
 ];
 for(const [pattern,parts] of patterns){const match=trimmed.match(pattern);if(match)return parts||[match[1],match[2]];}
 return [line];
}
