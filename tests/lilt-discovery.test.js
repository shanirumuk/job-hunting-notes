import test from 'node:test';
import assert from 'node:assert/strict';
import {listingSections} from '../lib/insights.js';
import {defaultProfile,discoveryFit,discoveryDecision,jobFitReport} from '../lib/model.js';
import {liltAppliedAI} from './fixtures/lilt-applied-ai.js';
const profile={...defaultProfile,languages:'English native (C1), German B1, Afrikaans B2, Shona A1',evidence:'Experience: Developer · Example · September 2024 - Present.\nExperience: Freelance Developer · Another · April 2024 - December 2024.\nBuilt API integrations and SQL reporting.\nDefined acceptance criteria and test reports.\nCoordinated three customer onboarding projects and worked with stakeholders.'};
const asOf=new Date('2026-10-08T12:00:00Z');
test('LILT advert has seven actual requirements and five optional points, without company marketing',()=>{
 const sections=listingSections(liltAppliedAI.description);
 assert.equal(sections.requirements.length,7);
 assert.equal(sections.preferred.length,5);
 assert(sections.terms.some(line=>line.includes('Four-month fixed-term contract')));
 assert(![...sections.requirements,...sections.preferred].some(line=>/Our Story|Our Tech|founders|100\+ native integrations|since its founding|journey is just beginning/.test(line)));
 const report=jobFitReport(liltAppliedAI,profile);
 assert.equal(report.total,7);assert.equal(report.bonus.total,5);
 assert(report.skillsScore<6);
});
test('LILT cannot enter discovery through cached listings or missing full reviews',()=>{
 const fit=discoveryFit(liltAppliedAI,profile,asOf);
 assert.equal(fit.months,31);assert.equal(fit.reason,'experience');
 assert.equal(discoveryDecision(liltAppliedAI,profile,{fit,review:null}).eligible,false);
 // Even an incorrectly generous saved review cannot override proven excess years.
 const review={skills:9,points:[{category:'required',text:'Delivery experience',status:'match'}],factors:[]};
 assert.equal(discoveryDecision(liltAppliedAI,profile,{fit,review}).eligible,false);
});
