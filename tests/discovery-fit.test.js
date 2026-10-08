import test from 'node:test';
import assert from 'node:assert/strict';
import {defaultProfile,discoveryFit,discoveryDecision,matchJob,jobFitReport} from '../lib/model.js';
import {recordedEmploymentMonths} from '../lib/insights.js';
const asOf=new Date('2026-10-08T12:00:00Z');
const profile={...defaultProfile,evidence:'Experience: Developer · Example · September 2024 - Present.\nExperience: Freelance Developer · Another · April 2024 - December 2024.\nBuilt API integrations.\nBuilt SQL reporting.',languages:'English C1'};
const job={title:'Implementation Consultant',company:'Example',location:'Germany',description:'Requirements:\nAPI experience.\nSQL experience.\nEnglish proficiency.'};
test('discovery requires skills strictly above six with CV details and optional extras excluded',()=>{
 assert.equal(discoveryFit(job,profile,asOf).eligible,true);
 assert.equal(discoveryFit(job,defaultProfile,asOf).reason,'missing-cv');
 const low={...job,description:'Requirements:\nAPI experience.\nSQL experience.\nUnderwater robotics expertise.\nPhysics degree.\nFrench B2.'};
 assert(discoveryFit(low,profile,asOf).report.skillsScore<=6);
 assert.equal(discoveryFit(low,profile,asOf).eligible,false);
 assert.equal(jobFitReport({...job,description:job.description+'\nNice to have:\nUnderwater robotics expertise.'},profile).skillsScore,10);
});
test('CV dates rather than a user-selected limit exclude excess years, counting overlap once',()=>{
 assert.equal(recordedEmploymentMonths(profile,asOf),31);
 assert.equal(discoveryFit({...job,description:job.description+'\n3 years of experience in implementation.'},{...profile,experienceLimit:'any'},asOf).reason,'experience');
 assert.equal(discoveryFit({...job,description:job.description+'\n2 years of experience in implementation.'},profile,asOf).reason,'experience-unverified');
 const undated={...profile,evidence:'Built API integrations and SQL reporting.'};
 assert.equal(discoveryFit({...job,description:job.description+'\n2 years of experience.'},undated,asOf).reason,'experience-unverified');
});
test('customer-facing roles are assessed on responsibilities and CV fit without a blanket exclusion',()=>{
 const relevant={...job,title:'Customer Success Manager',description:'Requirements:\nAPI experience.\nSQL experience.\nResponsibilities:\nRun stakeholder workshops and implementation rollouts.'};
 assert.equal(matchJob(relevant,profile).eligible,true);
 assert.equal(discoveryFit(relevant,profile,asOf).eligible,true);
 const unsupported={...relevant,description:'Responsibilities:\nRun stakeholder workshops and implementation rollouts.\nRequirements:\nCall center management experience.\nCustomer complaint handling.'};
 assert.equal(discoveryFit(unsupported,profile,asOf).eligible,false);
});
test('missing evidence has a range and cannot be mistaken for a confirmed gap',()=>{
 const report=jobFitReport({...job,description:'Requirements:\nAPI experience.\nUnderwater robotics expertise.'},profile);
 assert.equal(report.score,5);assert.equal(report.scoreUpper,10);assert.equal(report.counts.gap,0);assert.equal(report.fullyAssessed,1);
});

const fullReview=(skills=8)=>({skills,points:[{category:'required',text:'API experience',status:'match'}],factors:[]});
test('discovery never admits an exact six, including after a full review',()=>{
 const exactSix={...job,description:job.description+'\nUnderwater robotics expertise.\nPhysics degree.'};
 assert.equal(discoveryFit(exactSix,profile,asOf).report.skillsScore,6);
 assert.equal(discoveryDecision(exactSix,profile).eligible,false);
 assert.equal(discoveryDecision(exactSix,profile,{review:fullReview(6)}).eligible,false);
 const admitted=discoveryDecision(exactSix,profile,{review:fullReview(8)});
 assert.equal(admitted.eligible,true);assert.equal(admitted.skillsScore,8);
});
test('a full review cannot override excess years, confirmed permit conflicts or search preferences',()=>{
 const excess={...job,description:job.description+'\n10 years of experience in implementation.'};
 assert.equal(discoveryDecision(excess,profile,{review:fullReview()}).eligible,false);
 const conflict={...job,description:job.description+'\nNo visa sponsorship.'};
 const needsPermit={...profile,workRights:'I require visa sponsorship.'};
 assert.equal(discoveryFit(conflict,needsPermit,asOf).reason,'eligibility');
 for(const includeConditional of [true,false])assert.equal(discoveryDecision(conflict,{...needsPermit,includeConditional},{review:fullReview()}).eligible,false);
 assert.equal(discoveryDecision(job,{...profile,geography:'africa'},{review:fullReview()}).reason,'preferences');
});
test('review can resolve specialist years only when every required experience point is supported',()=>{
 const specialist={...job,description:job.description+'\n2 years of experience in implementation.'};
 const fit=discoveryFit(specialist,profile,asOf);
 assert.equal(fit.reason,'experience-unverified');
 for(const status of ['missing','partial','gap']){
  const review={...fullReview(),points:[{category:'required',text:'2 years of implementation experience',status}]};
  assert.equal(discoveryDecision(specialist,profile,{fit,review}).eligible,false);
 }
 const review={...fullReview(),points:[{category:'required',text:'2 years of implementation experience',status:'match'}]};
 assert.equal(discoveryDecision(specialist,profile,{fit,review}).eligible,true);
});
test('a full review with a confirmed conflict removes a quick match',()=>{
 assert.equal(discoveryDecision(job,profile).eligible,true);
 const review={...fullReview(),factors:[{key:'eligibility',status:'gap'}]};
 assert.equal(discoveryDecision(job,profile,{review}).eligible,false);
});
test('flagged-match preference controls an unresolved required language without changing the skills floor',()=>{
 const language={...job,description:job.description+'\nFrench C1 required.'};
 assert.equal(discoveryDecision(language,{...profile,includeConditional:true}).eligible,true);
 assert.equal(discoveryDecision(language,{...profile,includeConditional:false},{review:fullReview()}).eligible,false);
});
