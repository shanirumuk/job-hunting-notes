export const searchSkills={api:'API integrations',sql:'SQL',crm:'CRM',requirements:'requirements analysis',testing:'testing',workflows:'workflow improvement',javascript:'JavaScript',python:'Python'};
const patterns={api:/\bapis?\b/i,sql:/\b(?:sql|postgresql|mysql)\b/i,crm:/\bcrm\b/i,requirements:/requirements|stakeholder|business analysis/i,testing:/testing|automated tests?|playwright/i,workflows:/workflow|process improvement/i,javascript:/javascript|typescript/i,python:/\bpython\b/i};
export function cvSearchSkills(profile){return Object.keys(searchSkills).filter(key=>patterns[key].test(profile.evidence||'')).slice(0,4);}

// These describe search coverage, not evidence of qualification. Every result
// still passes role-direction, CV skills and required-experience checks.
export const searchRoleGroups=[
 {id:'implementation',label:'Implementation & onboarding',batch:0,titles:['implementation consultant','onboarding consultant','integration consultant','implementation specialist']},
 {id:'analysis',label:'Business & systems analysis',batch:1,titles:['business analyst','business systems analyst','requirements analyst','process analyst','product analyst','product operations analyst']},
 {id:'consulting',label:'Technology consulting',batch:2,titles:['systems consultant','technology consultant','technical consultant','IT consultant','ERP consultant','CRM consultant']},
 {id:'delivery',label:'Project & delivery',batch:3,titles:['technical project manager','delivery coordinator','project coordinator','implementation project manager','service delivery manager']},
 {id:'process',label:'Process & change',batch:3,titles:['process improvement specialist','change analyst','digital adoption specialist']},
 {id:'operations',label:'Product & operations',batch:3,titles:['business operations analyst','operations analyst','revenue operations analyst','product owner']},
 {id:'applications',label:'Business applications',batch:2,titles:['application analyst','functional consultant','CRM administrator','ITSM specialist','solution consultant']}
];
