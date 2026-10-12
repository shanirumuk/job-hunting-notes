import test from 'node:test';import assert from 'node:assert/strict';
import {hasDevelopmentEvidence,roleGroupsForCV} from '../lib/job-search-profile.js';
import {firecrawlPlan} from '../server/firecrawl-jobs.js';
import {defaultProfile,matchJob,discoveryDecision} from '../lib/model.js';
const profile={...defaultProfile,languages:'English C1',evidence:'Experience: Full Stack Developer · Example · September 2024 - Present.\nBuilt TypeScript and React applications, REST API integrations and SQL reports.\nDelivered requirements, testing and automated deployment.'};
const role={id:'software',company:'Example',title:'Junior Full Stack Developer',location:'Berlin, Germany',link:'https://example.org/software',description:'Responsibilities:\nHands-on software development, REST APIs and automated testing.\nRequirements:\nTypeScript experience.\nReact experience.\nSQL experience.\nEnglish proficiency.'};
test('recorded development work enables software coverage without inventing skills for an unrelated CV',()=>{
 assert(hasDevelopmentEvidence(profile));assert(roleGroupsForCV(profile).some(g=>g.id==='development'));
 for(const evidence of ['', 'SQL, requirements gathering and stakeholder workshops.', 'I want to become a software developer and learn JavaScript.']){assert(!hasDevelopmentEvidence({evidence}));assert(!roleGroupsForCV({evidence}).some(g=>g.id==='development'));}
 const plan=firecrawlPlan({development:true,skills:['api','sql','crm','requirements'],junior:true});assert(plan.every(q=>q.length<=500));assert(plan.some(q=>q.includes('"full stack developer"')));assert(!firecrawlPlan().some(q=>q.includes('"full stack developer"')));
});
test('qualified software roles pass the same skills floor and explain the coding balance',()=>{
 const fit=matchJob(role,profile);assert(fit.eligible);assert.equal(fit.cv,'Full Stack Developer CV');assert(fit.flags.some(f=>/coding workload/.test(f)));assert(discoveryDecision(role,profile).eligible);
 assert(!matchJob(role,{...defaultProfile,evidence:'Business requirements and SQL reporting.'}).eligible);
 const weak={...role,description:'Requirements:\nSwift expertise.\niOS development experience.\nKotlin experience.\nEnglish proficiency.'};assert(!discoveryDecision(weak,profile).eligible);
 const experienced={...role,description:role.description+'\n5+ years of software development experience.'};assert(!discoveryDecision(experienced,profile).eligible);
 assert(discoveryDecision({...role,description:role.description+'\n2+ years of software development experience.'},profile).eligible);
 assert(discoveryDecision({...role,description:role.description+'\n1.5+ years of frontend development experience.'},profile).eligible);
 assert(!discoveryDecision({...role,description:role.description+'\n2+ years of React development experience.'},profile).eligible);
 const unrelated={...profile,evidence:profile.evidence.replace('September 2024','September 2026')+'\nExperience: Project Manager · Other employer · January 2019 - December 2023.'};
 assert(!discoveryDecision({...role,description:role.description+'\n2+ years of software development experience.'},unrelated).eligible);
 assert(!matchJob({...role,title:'Engineering Manager'},profile).eligible);
});
