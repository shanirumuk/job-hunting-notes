import test from 'node:test';import assert from 'node:assert/strict';
import {roleInsights} from '../lib/insights.js';
import {applyProfileCorrections} from '../lib/profile-corrections.js';
import {productBusinessAnalyst} from './fixtures/product-business-analyst.js';
const evidence='Work with operations and billing teams to turn business needs into software requirements, process documentation and clear checks for whether features meet those requirements.\nCV skill: Requirements gathering.\nCV skill: acceptance criteria.\nConfirmed by you: I have an analytical mindset.';
test('product BA requirements recognise direct experience, separate compounds and exclude boilerplate',()=>{
 const info=roleInsights(productBusinessAnalyst,{evidence,languages:'English native'});
 const point=text=>info.requirements.find(p=>p.source.toLowerCase().includes(text.toLowerCase()));
 for(const text of ['analytical approach','Requirements gathering','Translating business needs','Documenting functional requirements'])assert.equal(point(text)?.status,'match',text);
 for(const text of ['Process mapping','user journey mapping','system behaviour','scalability'])assert.notEqual(point(text)?.status,'match',text);
 assert.equal(point('Figma').missing,true);
 assert(!info.requirements.concat(info.dutyAssessments).some(p=>/Additional Requirements|Additional Info|Job Location|More about|was founded|we want to hear/i.test(p.source)));
 for(const text of ['Translate business and customer','acceptance criteria','Document functional requirements'])assert.equal(info.dutyAssessments.find(p=>p.source.includes(text))?.status,'match',text);
 assert.notEqual(info.dutyAssessments.find(p=>p.source.includes('design guidelines'))?.status,'match');
 assert(info.terms.some(t=>t.includes('Remote')));
});
test('analytical self-report cannot certify tools, extra domains, seniority or compound conditions',()=>{
 for(const requirement of ['Expert requirements gathering for clinical trials.','Analytical mindset and Figma proficiency.','Advanced analytical thinking in financial risk.','User journey mapping.']){
  assert.notEqual(roleInsights({description:'Requirements:\n'+requirement},{evidence}).requirements[0].status,'match',requirement);
 }
 for(const evidence of ['I want to learn requirements gathering.','No requirements gathering experience.','Process mapping.'])assert.notEqual(roleInsights({description:'Requirements:\nUser journey mapping.'},{evidence}).requirements[0].status,'match');
});
test('confirmed additions preserve CVs and later preferences, deduplicate and apply once',()=>{
 const profile={evidence,languages:'English native, German B2',relocation:'My edited preference',profileCorrectionVersion:'existing'};
 const correction={id:'existing',languages:'English C1, German B1',relocation:'Old preference',evidenceUpdate:{id:'new-evidence',lines:['Confirmed by you: I built system requirements after discussions.',evidence.split('\n')[0]]}};
 const updated=applyProfileCorrections(profile,correction);assert.equal(updated.languages,profile.languages);assert.equal(updated.relocation,profile.relocation);assert(updated.evidence.startsWith(evidence));assert.equal(updated.evidence.split('Work with operations').length,2);
 assert.equal(applyProfileCorrections(updated,correction),updated);
 const edited={...updated,evidence:'Later correction'};assert.equal(applyProfileCorrections(edited,correction),edited);
});
test('React and Tailwind support transfer to ShadCN without inventing direct use',()=>{
 const info=roleInsights({description:'Responsibilities:\nMake use of the ShadCN design library to assemble product screens and components.\nRequirements:\nAbility to think in systems and identify gaps or inconsistencies.\nStrong experience as a Business Analyst, Product Analyst, or in a similar product-focused role.'},{evidence:evidence+'\nCV skill: React.\nCV skill: Tailwind CSS.\nImproved connections with insurance and billing systems by checking policy and billing data, confirming file deliveries and preventing duplicate deliveries.'});
 assert.equal(info.dutyAssessments[0].status,'partial');assert.match(info.dutyAssessments[0].note,/ShadCN.*needs evidence/);
 assert.equal(info.requirements[0].status,'match');assert.equal(info.requirements[1].status,'partial');
});
test('confirmed ShadCN use and no Figma experience become support and a known gap',()=>{
 const info=roleInsights(productBusinessAnalyst,{evidence:evidence+'\nConfirmed by you: I have hands-on experience with ShadCN.\nConfirmed by you: I have not used Figma.',languages:'English native'});
 assert.equal(info.requirements.find(p=>p.source==='Proficiency in Figma.')?.status,'gap');
 assert.equal(info.dutyAssessments.find(p=>p.source.includes('ShadCN'))?.status,'match');
 assert.match(info.requirements.find(p=>p.source==='Proficiency in Figma.').note,/explicitly state no Figma/);
});
test('confirmed work mix is saved once and later edits remain under user control',()=>{
 const correction={id:'existing',preferenceUpdate:{id:'work-mix',workStyle:'30% analysis, 30% meetings, 20% planning, 20% technical'}};
 const profile={evidence:'Existing CV.',languages:'English native',profileCorrectionVersion:'existing',workStyle:''};
 const next=applyProfileCorrections(profile,correction);assert.equal(next.workStyle,correction.preferenceUpdate.workStyle);assert.equal(next.evidence,profile.evidence);
 const edited={...next,workStyle:'Changed preference'};assert.equal(applyProfileCorrections(edited,correction).workStyle,'Changed preference');
});
