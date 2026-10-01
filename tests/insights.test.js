import test from 'node:test';import assert from 'node:assert/strict';
import {germanRequirement,roleInsights} from '../lib/insights.js';
import {gzipSync} from 'node:zlib';import setup from '../api/setup.js';
test('German levels are scoped to the language and compared with B1',()=>{
 assert.equal(germanRequirement('English C1 and German B1 required.').status,'match');
 assert.equal(germanRequirement('German B2 and English C1 required.').status,'gap');
 assert.equal(germanRequirement('Deutschkenntnisse auf C1-Niveau erforderlich.').status,'gap');
 assert.equal(germanRequirement('Verhandlungssichere Deutschkenntnisse.').status,'gap');
 assert.equal(germanRequirement('Gute Deutschkenntnisse.').status,'unknown');
 assert.equal(germanRequirement('Wir suchen dich für unser Team.').status,'unknown');
 assert.equal(germanRequirement('No German required. English C1.').status,'match');
 assert.equal(germanRequirement('German B2 preferred.').optional,true);
});
test('summaries retain the advertised tasks and requirements rather than substituting skill categories',()=>{
 const result=roleInsights({description:'Responsibilities:\nBuild API integrations for insurance policies.\nRequirements:\nExperience with API integrations.\nAt least 6 years experience.\nBenefits:\nFlexible working hours and 30 days annual leave.'},{evidence:'Requirements documentation and API integrations.',germanLevel:'B1'});
 assert.deepEqual(result.duties,['Build API integrations for insurance policies.']);
 assert.equal(result.requirements.find(r=>r.label==='Experience with API integrations.').status,'match');
 assert.equal(result.requirements.find(r=>r.label.includes('6 years')).status,'unknown');
 assert(result.benefits.some(b=>b.label.includes('30 days')));assert.equal(result.german,null);
 assert.equal(roleInsights({description:'No remote work offered.'}).benefits.length,0);
});
test('private CV recovery requires authentication and does not return credentials',()=>{
 const prior=process.env.JOB_NOTEBOOK_ACCESS_TOKEN,priorSetup=process.env.JOB_NOTEBOOK_CV_SETUP;
 const res={setHeader(){},status(code){this.code=code;return this;},json(data){this.data=data;}};
 process.env.JOB_NOTEBOOK_ACCESS_TOKEN='x'.repeat(43);process.env.JOB_NOTEBOOK_CV_SETUP=gzipSync(JSON.stringify({profile:{name:'Test'},cvs:{}})).toString('base64');
 try{setup({method:'POST',headers:{}},res);assert.equal(res.code,401);setup({method:'POST',headers:{authorization:'Bearer '+'x'.repeat(43)}},res);assert.equal(res.code,200);assert.equal(res.data.profile.name,'Test');assert.equal(res.data.automationToken,undefined);}
 finally{for(const[key,value]of Object.entries({JOB_NOTEBOOK_ACCESS_TOKEN:prior,JOB_NOTEBOOK_CV_SETUP:priorSetup})){if(value===undefined)delete process.env[key];else process.env[key]=value;}}
});
import {sellerIntern} from './fixtures/seller-intern.js';
import {matchJob,defaultProfile} from '../lib/model.js';
test('Back Market regression: preserve actual duties, school gate, pay and preferred languages',()=>{
 const info=roleInsights(sellerIntern,{...defaultProfile,startDate:'2027-01-01'});
 assert.equal(info.duties.length,5);assert(info.duties.some(s=>s.includes('Salesforce')));assert(info.duties.some(s=>s.includes('automate')));
 assert(info.requirements.some(r=>r.label.includes('pivot tables')));assert(info.requirements.some(r=>r.label.includes('French school')));
 assert.equal(info.requirements.find(r=>r.label==='Fluent English.').status,'match');
 assert.equal(info.requirements.find(r=>r.label==='French language skills.').preferred,true);
 assert(info.benefits.some(b=>b.label.includes('2 remote days')));assert(info.terms.some(s=>s.includes('€1.2K')));
 assert.equal(info.german,null);assert(!JSON.stringify(info).includes('German-language'));assert(!info.questions.some(s=>/German|Salesforce|French school/.test(s)));
 assert.equal(info.decision,'Lower priority');assert(matchJob(sellerIntern).score<matchJob({title:'Implementation Consultant',location:'Berlin',description:'Customer workshops, requirements and API integrations.'}).score);
});
test('training in benefits cannot become an applicant workshop requirement',()=>{
 const info=roleInsights({description:'Responsibilities:\nManage invoices.\nRequirements:\nAccounting experience.\nBenefits:\nLeadership workshops and professional training.'});
 assert.deepEqual(info.requirements.map(r=>r.label),['Accounting experience.']);assert.equal(info.duties[0],'Manage invoices.');
});
test('a match for one skill cannot certify a compound language or platform requirement',()=>{
 const info=roleInsights({description:'Requirements:\nFluent English and French.\nAPI integration and SAP experience.'},{languages:'English C1',evidence:'API integration'});
 assert(info.requirements.every(r=>r.status==='partial'));
 assert.deepEqual(info.requirements[0].checks.map(c=>c.status),['match','unknown']);
 assert.deepEqual(info.requirements[1].checks.map(c=>c.status),['match','unknown']);
});

test('HTML entities, international headings and optional sections preserve all actual requirements',()=>{
 const info=roleInsights({description:'<h3>Dein Profil&nbsp;</h3><ul><li>Excel und SQL Kenntnisse.</li><li>Deutsch B2 und Englisch C1.</li></ul><h3>Das ist ein Plus - oder Du lernst es bei uns:</h3><li>Python Erfahrung.</li><h3>Was wir Dir bieten</h3><li>Leadership training and 30 days holiday.</li><h3>Der Interviewprozess</h3><p>Technical assessment.</p>'},{evidence:'Excel and SQL reporting.',germanLevel:'B1',languages:'English C1, German B1'});
 assert.equal(info.requirements.length,3);assert.equal(info.requirements[0].status,'match');
 assert.equal(info.requirements[1].status,'gap');assert.deepEqual(info.requirements[1].checks.map(c=>c.status),['gap','match']);
 assert.equal(info.requirements[2].preferred,true);assert.equal(info.assessmentCounts.unknown,0);
 assert(!info.requirements.some(r=>/holiday|assessment/.test(r.source)));
 const ideal=roleInsights({description:'Ideal Profile\nSQL experience.\nPreferred Qualifications\nSalesforce familiarity.\nBenefits\nTraining budget.'});
 assert.equal(ideal.requirements.length,2);assert.equal(ideal.requirements[1].preferred,true);
});
test('unheaded requirements and inline headings are usable without treating duties or benefits as qualifications',()=>{
 for(const description of ['SQL experience required. Fluent English.','Requirements: SQL experience. Benefits: Training and 30 days leave.','Responsibilities:\nRun customer workshops.\nQualifications:\nSQL experience.\nBenefits:\nTraining and 30 days leave.']){
  const info=roleInsights({description},{evidence:'SQL reporting.',languages:'English C1'});
  assert(info.requirements.some(r=>/SQL/.test(r.source)));assert(!info.requirements.some(r=>/30 days/.test(r.source)));
 }
});
test('specific evidence supports each skill, alternatives work, and missing skills stay visible',()=>{
 const info=roleInsights({description:'Requirements:\nAPI integrations and SAP experience.\nSalesforce experience or CRM familiarity.\nAdvanced Excel including pivot tables.'},{evidence:'Delivered API integrations. Used Salesforce for customer onboarding. Excel reporting.'});
 assert.equal(info.requirements[0].status,'partial');assert.equal(info.requirements[0].checks[1].status,'unknown');
 assert.equal(info.requirements[1].status,'match');
 assert.equal(info.requirements[2].status,'partial');assert.equal(info.requirements[2].checks.find(c=>c.label==='Pivot tables').status,'unknown');
 assert.equal(info.requirements[0].checks[0].evidence,'Delivered API integrations.');
 assert.equal(roleInsights({description:'Requirements:\nAPI experience.'},{evidence:'XML file transfer.'}).requirements[0].status,'unknown');
});
test('negated skills and aspirations do not certify experience, and duration stays scoped to the requested work',()=>{
 assert.equal(roleInsights({description:'Requirements:\nSalesforce experience.'},{evidence:'No Salesforce experience.'}).requirements[0].status,'gap');
 for(const evidence of ['Currently learning Salesforce.','I want to use Salesforce.'])assert.equal(roleInsights({description:'Requirements:\nSalesforce experience.'},{evidence}).requirements[0].status,'unknown');
 const info=roleInsights({description:'Requirements:\n5 years of SQL experience.\nExpert SQL for healthcare reporting.\nBachelor degree in computing.'},{evidence:'10 years of customer service. SQL reporting.'});
 assert.equal(info.requirements[0].status,'partial');assert.equal(info.requirements[0].checks.find(c=>c.label==='Experience duration').status,'unknown');
 assert.equal(info.requirements[1].status,'partial');assert.equal(info.requirements[2].status,'unknown');
 const positive=roleInsights({description:'Requirements:\n5 years of SQL experience.'},{evidence:'6 years of SQL experience.'});
 assert.equal(positive.requirements[0].status,'match');
});
test('language levels are assessed individually and unsupported languages are not invented as gaps',()=>{
 const info=roleInsights({description:'Requirements:\nEnglish C1 and German B2.\nFrench B2.\nNative English.'},{languages:'English C1, German B1',germanLevel:'B1'});
 assert.deepEqual(info.requirements[0].checks.map(c=>c.status),['match','gap']);
 assert.equal(info.requirements[1].status,'unknown');assert.equal(info.requirements[2].status,'unknown');
 const communication=roleInsights({description:'Requirements:\nDu kommunizierst sicher auf Deutsch und bist sicher in der Englischen Kommunikation.'},{languages:'English C1, German B1',germanLevel:'B1'});
 assert.equal(communication.requirements[0].status,'partial');assert.deepEqual(communication.requirements[0].checks.map(c=>c.status),['unknown','match']);
});
test('empty experience and missing requirement text have explicit coverage information',()=>{
 const info=roleInsights({description:'Requirements:\nSQL experience.'},{});
 assert.equal(info.hasExperience,false);assert.equal(info.assessmentCounts.unknown,1);assert(info.requirements[0].checks.every(c=>c.detail));
 assert.equal(roleInsights({description:'We build software for shops.'}).requirements.length,0);
 assert.equal(roleInsights({requirements:'Customer workflows and testing.'}).sourceKind,'saved notes');
});

test('imported CV wording supports database, documentation, testing and degree checks',()=>{
 const result=roleInsights({description:'Must-haves\nSQL experience.\nTechnical documentation skills.\nTesting experience.\nBachelor degree in Business.\nWhat we provide\nTraining budget.'},{evidence:'CV skill: Supabase/PostgreSQL.\nWrote technical documentation.\nBuilt automated tests with Playwright.\nEducation: BSc · Business · Example University.'});
 assert.equal(result.requirements.length,4);assert.equal(result.requirements[0].status,'match');assert.equal(result.requirements[1].status,'match');assert.equal(result.requirements[2].status,'match');assert.equal(result.requirements[3].checks.find(c=>c.label==='Education or certification').status,'match');assert.equal(result.requirements[3].status,'partial');
 assert.equal(result.benefits.length,1);
});

import {recordedEmploymentMonths} from '../lib/insights.js';
test('C1 supports English fluency and proficiency; native identity and certificates remain separate',()=>{
 const assess=(description,languages)=>roleInsights({description:'Requirements:\n'+description},{languages}).requirements[0];
 for(const wording of ['Fluent English.','English proficiency is essential.','English language proficiency is essential.','Excellent English.']){
  assert.equal(assess(wording,'English C1').status,'match',wording);
  assert.equal(assess(wording,'English native').status,'match',wording);
 }
 assert.equal(assess('Native English speaker.','English native (C1)').status,'match');
 assert.equal(assess('Native English speaker.','English C1').status,'unknown');
 assert.equal(assess('English C2.','English native (C1)').status,'gap');
 assert.equal(assess('IELTS English certificate required.','English native (C1)').status,'unknown');
 const mixed=roleInsights({description:'Requirements:\nEnglish language proficiency is essential, fluency in other languages is a strong plus.'},{languages:'English C1, German B1'});
 assert.equal(mixed.requirements.length,2);assert.equal(mixed.requirements[0].preferred,false);assert.equal(mixed.requirements[0].status,'match');assert.equal(mixed.requirements[1].preferred,true);
 const multi=assess('Fluent English and French.','English native');assert.equal(multi.status,'partial');assert.equal(multi.checks.find(c=>c.label==='French').status,'unknown');
});
test('dated employment identifies a clear total-duration shortfall without double-counting concurrent roles',()=>{
 const now=new Date('2026-09-30T12:00:00Z');
 const profile={evidence:'Experience: Developer · Example · September 2024 - Present\nExperience: Freelance · Example · April 2024 - December 2024\nHelp customers prepare to use a platform.'};
 assert.equal(recordedEmploymentMonths(profile,now),30);
 const short=roleInsights({description:'Requirements:\n3+ years of experience in a client-facing role.'},profile,now).requirements[0];
 assert.equal(short.status,'gap');assert.match(short.note,/2.5 years/);
 assert.equal(recordedEmploymentMonths({evidence:profile.evidence+'\nExperience: Earlier role · 2020-2023'},now),null);
 assert.equal(roleInsights({description:'Requirements:\n2+ years in blockchain.'},profile,now).requirements[0].status,'unknown');
 assert.equal(recordedEmploymentMonths({evidence:'Experience: Future role · January 2027 - Present'},now),null);
});
test('source footers are excluded and unrelated domain knowledge cannot certify a blockchain requirement',()=>{
 const info=roleInsights({description:'Requirements:\nBlockchain and AML knowledge.\nNice to have:\nHubSpot CRM experience.\nOriginally posted on Himalayas\nAdvertised UTC offsets: -1, 0'},{evidence:'AML compliance experience.'});
 assert.equal(info.requirements.length,2);assert.equal(info.requirements[0].status,'partial');assert.equal(info.requirements[1].missing,true);
 assert.doesNotMatch(JSON.stringify(info.requirements),/Originally posted|UTC offsets/);
});

test('equivalent English wording does not create artificial extra qualification conditions',()=>{
 for(const wording of ['Fluent in English.','English fluency required.','Proficient in English.','Excellent command of English.','Professional English communication skills.','Full professional proficiency in English.']){
  assert.equal(roleInsights({description:'Requirements:\n'+wording},{languages:'English C1',evidence:'Translate business needs into requirements.'}).requirements[0].status,'match',wording);
 }
 for(const wording of ['Native English speaker.','English at native level.','Native-level English.'])assert.equal(roleInsights({description:'Requirements:\n'+wording},{languages:'English native (C1)'}).requirements[0].status,'match',wording);
 assert.notEqual(roleInsights({description:'Requirements:\nEnglish proficiency and legal contract negotiation experience.'},{languages:'English native (C1)'}).requirements[0].status,'match');
});
