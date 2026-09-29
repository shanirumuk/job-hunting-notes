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
test('sparse or missing evidence never produces a misleading score',()=>{
 const report=jobFitReport(job,{...defaultProfile,languages:'',germanLevel:'B1',evidence:''});
 assert.equal(report.score,null);assert.equal(report.coverage,33);
 assert.equal(jobFitReport({...job,description:'Customer workshops and workflow improvements.'}).score,null);
 const mostlyUnknown=jobFitReport({...job,description:'Requirements:\nAPI experience.\nSQL experience.\nFrench B2.\nGerman C2.\nDegree required.'},{...defaultProfile,evidence:'API experience.',languages:'',germanLevel:'C2'});
 assert.equal(mostlyUnknown.score,null);assert.equal(mostlyUnknown.coverage,40);
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
