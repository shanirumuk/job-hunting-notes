import test from 'node:test';import assert from 'node:assert/strict';
import {roleInsights,listingSections} from '../lib/insights.js';
import {applyProfileCorrections} from '../lib/profile-corrections.js';
import {matchJob,defaultProfile} from '../lib/model.js';
import {telesalesOperations} from './fixtures/telesales-operations.js';
const profile={languages:'English native',evidence:"Education: BSc · Digital Business & Data Science · Example University · 2025.\nExperience: Developer · Example · April 2024 - Present\nConfirmed by you: I have added Frappe CRM to a project before."};
test('real telesales excerpt excludes hiring notices and company marketing, while preserving duties and terms',()=>{
 const info=roleInsights(telesalesOperations,profile,new Date('2026-10-01'));
 assert.equal(info.requirements.length,5);
 assert.equal(info.requirements.find(p=>/Bachelor/.test(p.source)).status,'match');
 const years=info.requirements.find(p=>/3 – 5/.test(p.source));assert.equal(years.preferred,true);assert.equal(years.status,'gap');
 assert.equal(info.requirements.filter(p=>!p.preferred).length,4);
 const crm=info.requirements.find(p=>/Strong CRM/.test(p.source));assert.equal(crm.status,'partial');assert.equal(crm.missing,false);assert.match(crm.note,/Frappe CRM/);
 assert.equal(crm.checks.find(c=>c.label==='FreshDesk').status,'unknown');assert.equal(crm.checks.find(c=>c.label==='3CX').status,'unknown');
 assert.equal(info.dutyAssessments.find(p=>/Keeping CRM/.test(p.source)).status,'partial');
 assert(!info.requirements.concat(info.dutyAssessments).some(p=>/honest part|Why M-KOPA|Important Notice|equal opportunity|Forced or Child|recruitment fees|background checks|rolling basis|Financial Times|empower our people|Let's talk|Any other tasks|This is a hybrid role/i.test(p.source)));
 assert(info.dutyAssessments.some(p=>/Sales moves fast/.test(p.source)));
 assert(info.terms.some(t=>/hybrid role/i.test(t)));assert(info.terms.some(t=>/background checks/i.test(t)));
 // Real coordination with shop teams counts; company training benefits do not.
 assert.equal(matchJob(telesalesOperations,defaultProfile).eligible,true);
});
test('related business degree does not certify unrelated degrees, special licences, or higher levels',()=>{
 const check=line=>roleInsights({description:'Requirements:\n'+line},profile).requirements[0];
 for(const line of ["A Bachelor's degree in Business Administration, Sales, or a related field",'Bachelor degree in Business.',"A Bachelor's degree in Digital Business and Data Science"])assert.equal(check(line).status,'match',line);
 for(const line of ['Bachelor degree in Business Administration.','Bachelor degree in Medicine or a related field.','Master degree in Business.','Bachelor degree in Business and CPA certification.','An accredited Bachelor degree in Business.'])assert.notEqual(check(line).status,'match',line);
 assert.notEqual(roleInsights({description:'Requirements:\nBachelor degree in Business.'},{evidence:'I am pursuing a Bachelor degree in Business.'}).requirements[0].status,'match');
});
test('boilerplate boundaries work in HTML and real requirements can restart after notices',()=>{
 const sections=listingSections('<h2>Requirements</h2><p>SQL experience required.</p><h2>Why Example?</h2><p>We offer training.</p><h2>Important Notice</h2><p>Any employment requirement is reviewed by HR.</p><h2>Additional Requirements</h2><p>English fluency required.</p>');
 assert.deepEqual(sections.requirements,['SQL experience required.','English fluency required.']);
 assert.equal(listingSections('Job description\nSQL experience required.').requirements.length,1);
 assert.equal(listingSections('Requirements\nExperience auditing forced or child labour policies.').requirements.length,1);
 const info=roleInsights({description:'Requirements:\n3 years experience is an added advantage.\nMinimum 3 years experience is required.\nSQL is required; Python is an added advantage.'},profile);
 assert.equal(info.requirements[0].preferred,true);assert.equal(info.requirements[1].preferred,false);assert.equal(info.requirements[2].preferred,false);
});
test('new confirmations preserve earlier edits and fresh devices receive the correction chain',()=>{
 const previous={id:'old',lines:['Earlier confirmation']},correction={id:'base',evidenceUpdate:{id:'new',previous,lines:['I added Frappe CRM to a project.']}};
 const existing={profileCorrectionVersion:'base',evidenceCorrectionVersion:'old',languages:'English native',evidence:'My edited evidence'};
 const updated=applyProfileCorrections(existing,correction);assert.equal(updated.evidence,'My edited evidence\nI added Frappe CRM to a project.');assert.equal(updated.evidenceCorrectionVersion,'new');
 assert.equal(applyProfileCorrections({...updated,evidence:'Later edit'},correction).evidence,'Later edit');
 const fresh=applyProfileCorrections({...existing,evidenceCorrectionVersion:''},correction);assert.match(fresh.evidence,/Earlier confirmation/);assert.equal(fresh.evidenceCorrectionVersion,'new');
});
