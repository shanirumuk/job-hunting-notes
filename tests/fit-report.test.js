import test from 'node:test';
import assert from 'node:assert/strict';
import {jobFitReport,defaultProfile} from '../lib/model.js';
const job={title:'Technical Business Analyst',company:'Example',location:'Portugal',description:'Requirements:\nAPI integrations experience.\nSQL experience.\nGerman B2.\nPreferred Qualifications:\nSalesforce experience.'};
test('fit rating uses qualification evidence and exposes coverage, not discovery ranking',()=>{
 const report=jobFitReport(job,{...defaultProfile,evidence:'API integrations and SQL reporting.'});
 assert.equal(report.score,6.5);assert.equal(report.coverage,100);assert.equal(report.total,3);
 assert.deepEqual(report.counts,{match:2,partial:0,gap:1,unknown:0});assert.equal(report.priority,'Resolve the gaps first');
 assert.equal(report.cv,'Business Analyst CV');assert.equal(report.bonus.total,1);assert.equal(report.bonus.supported,0);
 assert.equal(jobFitReport({...job,title:'Implementation Consultant'}).cv,'Consulting CV');
});
test('missing profile evidence stays unrated while limited coverage is explicitly provisional',()=>{
 const report=jobFitReport(job,{...defaultProfile,languages:'',germanLevel:'B1',evidence:''});
 assert.equal(report.score,null);assert.equal(report.coverage,33);
 assert.equal(jobFitReport({...job,description:'Customer workshops and workflow improvements.'}).score,null);
 const mostlyUnknown=jobFitReport({...job,description:'Requirements:\nAPI experience.\nSQL experience.\nFrench B2.\nGerman C2.\nDegree required.'},{...defaultProfile,evidence:'API experience.',languages:'',germanLevel:'C2'});
 assert.equal(mostlyUnknown.score,4);assert.equal(mostlyUnknown.coverage,40);assert.equal(mostlyUnknown.provisional,true);assert.match(mostlyUnknown.ratingReason,/all 5 requirements/);
});
test('sponsorship conflicts affect priority without declaring unknown work rights eligible',()=>{
 const listing={...job,description:'Requirements:\nAPI experience.\nSQL experience.\nNo visa sponsorship.'};
 const report=jobFitReport(listing,{...defaultProfile,evidence:'API and SQL experience.',workRights:'I require visa sponsorship.'});
 assert.equal(report.factors.find(f=>f.key==='eligibility').status,'gap');assert.equal(report.priority,'Resolve the gaps first');
 for(const workRights of ['', 'I do not need sponsorship.'])assert.equal(jobFitReport(listing,{...defaultProfile,workRights}).factors.find(f=>f.key==='eligibility').status,'check');
});
test('fit factors retain advertised pay, work arrangement and timing without inventing missing data',()=>{
 const listing={...job,remote:true,description:'Requirements:\nSQL experience.\nBenefits:\nHybrid working, 2 office days weekly.\nSalary: 60000–70000 EUR annual\nStart date: January 2027'};
 const report=jobFitReport(listing,{...defaultProfile,startDate:'2027-02-01'});
 assert(report.factors.find(f=>f.key==='pay').evidence.some(s=>s.includes('60000')));
 assert(report.factors.find(f=>f.key==='location').evidence.some(s=>s.includes('2 office days')));
 assert(report.factors.find(f=>f.key==='timing').detail.includes('2027-02-01'));
 assert.equal(jobFitReport(job).factors.find(f=>f.key==='pay').status,'unknown');
 const perks=jobFitReport({...job,description:'About us\nOur company has 40 years of experience.\nRequirements:\nSQL experience.\nBenefits:\n€500 learning budget.\nMentorship and career development.'},{...defaultProfile,salaryTarget:'55000 EUR gross per year'});
 assert.equal(perks.factors.find(f=>f.key==='pay').status,'unknown');
 assert.equal(perks.factors.find(f=>f.key==='pay').profileEvidence,'55000 EUR gross per year');
 assert.equal(perks.factors.find(f=>f.key==='seniority').status,'unknown');
 assert(perks.factors.find(f=>f.key==='growth').evidence.some(s=>s.includes('Mentorship')));
 assert.deepEqual(perks.factors.slice(0,3).map(f=>f.key),['eligibility','pay','growth']);
});

test('saved CV details produce a provisional score from a single comparable requirement',()=>{
 const report=jobFitReport({...job,description:'Requirements:\nAPI experience.\nExperience with underwater robotics.\nMasters degree in physics.'},{...defaultProfile,evidence:'Built API integrations.'});
 assert.equal(report.score,3.5);assert.equal(report.provisional,true);assert.equal(report.coverage,33);assert.equal(report.ratingState,'provisional');
 const missing=jobFitReport({...job,description:'An exciting opportunity. Apply today.'},{...defaultProfile,evidence:'Built API integrations.'});assert.equal(missing.score,null);assert.equal(missing.ratingState,'missing-requirements');assert.match(missing.ratingReason,/CV details are saved/);assert.doesNotMatch(missing.ratingReason,/Import your CV/);
 const unmatched=jobFitReport({...job,description:'Requirements:\nExperience with underwater robotics.'},{...defaultProfile,evidence:'Built API integrations.'});assert.equal(unmatched.score,0);assert.equal(unmatched.ratingState,'provisional');assert.equal(unmatched.counts.gap,0);assert.equal(unmatched.counts.unknown,1);
});

import {customerSuccessJob,transferableCV} from './fixtures/customer-success.js';
import {parseCVJSON,mergeCVImports} from '../lib/cv-json.js';
import {roleInsights} from '../lib/insights.js';
test('customer success advert rates imported CVs with cited transferable evidence and correct section boundaries',()=>{
 const profile=mergeCVImports(['Analyst.json','Consulting.json','Developer.json'].map(name=>parseCVJSON(transferableCV,name)),defaultProfile);
 const report=jobFitReport(customerSuccessJob,profile),insights=roleInsights(customerSuccessJob,profile);
 assert.equal(report.total,13);assert.equal(report.bonus.total,7);assert.equal(insights.duties.length,2);
 assert.equal(report.score,4);assert.equal(report.counts.match,1);assert.equal(report.counts.partial,8);assert.equal(report.counts.unknown,4);assert.equal(report.counts.gap,0);
 assert.equal(report.factors.find(f=>f.key==='pay').status,'unknown');assert(report.questions.some(q=>q.startsWith('Pay is not stated')));
 for(const c of report.evidenceMatches)assert(profile.evidence.includes(c.evidence)||profile.languages.includes(c.evidence));
 const seniority=insights.requirements.find(r=>r.source.startsWith('5+'));
 assert.equal(seniority.checks.find(c=>c.label==='Experience duration').status,'unknown');
 for(const label of ['cyber risk','Own revenue','expansion opportunities'])assert.equal(insights.requirements.find(r=>r.source.includes(label)).status,'unknown');
 assert(!report.evidenceMatches.some(c=>/cyber|renewal/i.test(c.label)));
});
test('missing evidence always produces a transparent zero and adding unknown requirements cannot inflate fit',()=>{
 const profile={...defaultProfile,evidence:'Built API integrations.'};
 for(const description of ['Requirements:\nUnderwater robotics expertise.','What do we need from you?\nOwn customer renewal revenue.']){
  const report=jobFitReport({...job,description},profile);
  assert.equal(report.score,0);assert.equal(report.counts.gap,0);assert.equal(report.counts.unknown,1);assert.equal(report.provisional,true);assert.match(report.ratingReason,/does not mean you cannot/);
 }
 const one=jobFitReport({...job,description:'Requirements:\nAPI experience.'},profile);
 const two=jobFitReport({...job,description:'Requirements:\nAPI experience.\nUnderwater robotics expertise.'},profile);
 assert.equal(one.score,10);assert.equal(two.score,5);
});
test('salary questions and factors agree and do not mistake allowances for salary',()=>{
 for(const perk of ['$1500 USD annual Learning & Development allowance.','£400 monthly equipment budget.']){
  const report=jobFitReport({...job,description:'Requirements:\nAPI experience.\nBenefits:\n'+perk});
  assert.equal(report.factors.find(f=>f.key==='pay').status,'unknown');assert(report.questions.some(q=>q.startsWith('Pay is not stated')));
 }
 const report=jobFitReport({...job,description:'Requirements:\nAPI experience.\nSalary: £60000 per year.'});
 assert.equal(report.factors.find(f=>f.key==='pay').status,'advertised');assert(!report.questions.some(q=>q.startsWith('Pay is not stated')));
});
test('transferable skills never certify unrelated seniority, specialist tools or aspirational experience',()=>{
 for(const evidence of ['I want to help customers by resolving technical issues.','No experience working with multiple teams.']){
  const info=roleInsights(customerSuccessJob,{evidence,languages:''});assert.equal(info.assessmentCounts.match,0);assert.equal(info.assessmentCounts.partial,0);
 }
 const info=roleInsights({description:"Requirements:\n5+ years' experience in customer success.\nSalesforce experience."},{evidence:'10 years of software engineering. Help customers by resolving technical issues.'});
 assert.equal(info.requirements[0].status,'partial');assert.equal(info.requirements[0].checks.find(c=>c.label==='Experience duration').status,'unknown');assert.equal(info.requirements[1].status,'unknown');
});

import {consultingContract} from './fixtures/consulting-contract.js';
import {listingSections} from '../lib/insights.js';
test('consulting contract separates six core requirements, six optional advantages, duties and employer boilerplate',()=>{
 const profile=mergeCVImports([parseCVJSON(transferableCV,'Consulting.json')],defaultProfile);
 const report=jobFitReport(consultingContract,profile),sections=listingSections(consultingContract.description);
 assert.equal(report.total,6);assert.equal(report.bonus.total,6);assert.equal(report.score,4);
 assert.deepEqual(report.counts,{match:1,partial:3,gap:0,unknown:2});
 assert(sections.preferred.some(s=>s.includes('German')));assert(!sections.requirements.some(s=>/salary|values|coach|meditation|bonus|agency|LI-|looking for|core skills/i.test(s)));
 assert.equal(report.factors.find(f=>f.key==='location').status,'restricted remote');
 assert.match(report.factors.find(f=>f.key==='timing').detail,/6-month contract.*not guaranteed/);
 assert(report.review.concerns.some(s=>s.includes('700600')&&s.includes('CZK yearly')));
 assert(report.review.concerns.some(s=>s.includes('Czechia, Slovakia')));
 assert(report.review.concerns.some(s=>s.includes('practice leadership')));
 assert(report.review.domainChecks.includes('Marketing automation and campaigns'));
 assert(report.review.workEvidence.some(c=>c.label==='Requirements discovery'));
 assert(!/Germany|permanent|your current salary|Skip it|€28/.test(JSON.stringify(report.review)));
});
test('adding company benefits cannot dilute the score or create applicant evidence',()=>{
 const profile={...defaultProfile,evidence:'Built SQL reporting.'},description='Requirements:\nSQL experience.\nBenefits:\n';
 const noise=['Company culture and values.','Leadership training and professional certifications.','Our resident communication coach helps employees.','Parental leave and stock options.','Employees earn an annual performance bonus.','Our recruitment process includes technical interviews.'].join('\n');
 const before=jobFitReport({...job,description},profile),after=jobFitReport({...job,description:description+noise},profile);
 assert.equal(after.total,1);assert.equal(after.score,before.score);assert.deepEqual(after.counts,before.counts);
 for(const heading of ['<h2>Company life</h2>','Unfamiliar company section:']){
  const info=roleInsights({description:'Requirements:\nSQL experience.\n'+heading+'\nWe organize events and have five values.\n#LI-REMOTE\nAny unsolicited resumes are ignored.'},profile);
  assert.equal(info.requirements.length,1);
 }
});
test('optional headings with not-required wording remain optional in HTML and plain text',()=>{
 for(const description of [consultingContract.description,consultingContract.description.replace(/^(Core skills[^\n]*|Skills and experience that[^\n]*|More things[^\n]*|Culture:|Personal Development:|Well-being:|Compensation:)$/gm,'<h3>$1</h3>')]){
  const sections=listingSections(description);assert.equal(sections.requirements.length,6);assert.equal(sections.preferred.length,6);
 }
});
test('a non-required extra cannot turn a mandatory point into an optional one',()=>{
 const info=roleInsights({description:'Requirements:\nSQL required; Salesforce is not required.\nAPI experience is not required.'},{evidence:'Built SQL queries.'});
 assert.equal(info.requirements[0].preferred,false);assert.equal(info.requirements[1].preferred,true);
 const report=jobFitReport({...job,title:'Implementation Consultant - 6 month contract',description:'Requirements:\nSQL experience.'},defaultProfile);
 assert.equal(report.factors.find(f=>f.key==='timing').status,'check');assert.match(report.factors.find(f=>f.key==='timing').detail,/6-month contract/);
});
