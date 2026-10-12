export const searchSkills={api:'API integrations',sql:'SQL',crm:'CRM',requirements:'requirements analysis',testing:'testing',workflows:'workflow improvement',javascript:'JavaScript',python:'Python'};
const patterns={api:/\bapis?\b/i,sql:/\b(?:sql|postgresql|mysql)\b/i,crm:/\bcrm\b/i,requirements:/requirements|stakeholder|business analysis/i,testing:/testing|automated tests?|playwright/i,workflows:/workflow|process improvement/i,javascript:/javascript|typescript/i,python:/\bpython\b/i};
export function cvSearchSkills(profile){
 const found=Object.keys(searchSkills).filter(key=>patterns[key].test(profile.evidence||''));
 const primary=hasDevelopmentEvidence(profile)?['javascript','python'].find(key=>found.includes(key)):null;
 return (primary?[primary,...found.filter(key=>key!==primary)]:found).slice(0,4);
}
export function hasDevelopmentEvidence(profile){
 const evidence=profile?.evidence||'';
 return /\b(?:full[ -]?stack|software|front[ -]?end|back[ -]?end)\s+(?:developer|engineer)\b/i.test(evidence)&&/(?:\b(?:TypeScript|JavaScript|React|Next\.js|Node\.js|Python|Java)\b|\bC#)/i.test(evidence)&&/\b(?:built|developed|delivered|maintain|deployed|designed)\b/i.test(evidence);
}
export const roleGroupsForCV=profile=>searchRoleGroups.filter(group=>!group.development||hasDevelopmentEvidence(profile));

// These describe search coverage, not evidence of qualification. Every result
// still passes role-direction, CV skills and required-experience checks.
export const searchRoleGroups=[
 {id:'implementation',label:'Implementation & onboarding',batch:0,titles:['implementation consultant','onboarding consultant','integration consultant','implementation specialist']},
 {id:'analysis',label:'Business & systems analysis',batch:1,titles:['business analyst','business systems analyst','requirements analyst','process analyst','product analyst','product operations analyst']},
 {id:'consulting',label:'Technology consulting',batch:2,titles:['systems consultant','technology consultant','technical consultant','IT consultant','ERP consultant','CRM consultant']},
 {id:'delivery',label:'Project & delivery',batch:3,titles:['technical project manager','delivery coordinator','project coordinator','implementation project manager','service delivery manager']},
 {id:'process',label:'Process & change',batch:3,titles:['process improvement specialist','change analyst','digital adoption specialist']},
 {id:'operations',label:'Product & operations',batch:3,titles:['business operations analyst','operations analyst','revenue operations analyst','product owner']},
 {id:'applications',label:'Business applications',batch:2,titles:['application analyst','functional consultant','CRM administrator','ITSM specialist','solution consultant']},
 {id:'development',label:'Software & low-code',batch:4,development:true,titles:['junior software developer','full stack developer','low code developer','junior software engineer','junior frontend developer','frontend developer','junior frontend engineer','frontend engineer']}
];
