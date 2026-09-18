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
 const result=roleInsights({description:'Responsibilities:\nBuild API integrations for insurance policies.\nRequirements:\nExperience with API integrations.\nAt least 6 years experience.\nBenefits:\nFlexible working hours and 30 days annual leave.'},{evidence:'Requirements documentation and XML integrations.',germanLevel:'B1'});
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
 assert(info.requirements.every(r=>r.status==='unknown'));
});
