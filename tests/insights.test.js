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
test('qualification checks require evidence; benefits and missing facts are not invented',()=>{
 const result=roleInsights({description:'Your role: API integration and requirements analysis. Stakeholder workshops. Minimum 6 years experience. We offer flexible working hours and 30 days annual leave.'},{evidence:'Requirements documentation and XML integrations.',germanLevel:'B1'});
 assert.equal(result.requirements.find(r=>r.label.startsWith('Integrations')).status,'match');
 assert.equal(result.requirements.find(r=>r.label.startsWith('Stakeholder')).status,'unknown');
 assert.equal(result.requirements.find(r=>r.label.includes('6 years')).status,'unknown');
 assert(result.benefits.some(b=>b.label==='Flexible working hours'));assert(result.benefits.some(b=>b.label.includes('30 days')));
 assert.equal(roleInsights({description:'No remote work offered.'}).benefits.length,0);
});
test('private CV recovery requires authentication and does not return credentials',()=>{
 const prior=process.env.JOB_NOTEBOOK_ACCESS_TOKEN,priorSetup=process.env.JOB_NOTEBOOK_CV_SETUP;
 const res={setHeader(){},status(code){this.code=code;return this;},json(data){this.data=data;}};
 process.env.JOB_NOTEBOOK_ACCESS_TOKEN='x'.repeat(43);process.env.JOB_NOTEBOOK_CV_SETUP=gzipSync(JSON.stringify({profile:{name:'Test'},cvs:{}})).toString('base64');
 try{setup({method:'POST',headers:{}},res);assert.equal(res.code,401);setup({method:'POST',headers:{authorization:'Bearer '+'x'.repeat(43)}},res);assert.equal(res.code,200);assert.equal(res.data.profile.name,'Test');assert.equal(res.data.automationToken,undefined);}
 finally{for(const[key,value]of Object.entries({JOB_NOTEBOOK_ACCESS_TOKEN:prior,JOB_NOTEBOOK_CV_SETUP:priorSetup})){if(value===undefined)delete process.env[key];else process.env[key]=value;}}
});
