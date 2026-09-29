import test from 'node:test';
import assert from 'node:assert/strict';
import {parseCVJSON,mergeCVImports} from '../lib/cv-json.js';
import {defaultProfile,validateProfile,jobFitReport} from '../lib/model.js';
const cv={basics:{name:'Test Applicant',email:'test@example.org',headline:'Business Analyst'},summary:{content:'Seeking Salesforce work.'},sections:{experience:{items:[{company:'Example',position:'Analyst',period:'2024–2026',description:'<ul><li>Built API integrations.</li><li>Documented requirements.</li></ul>'},{hidden:true,description:'Secret skill.'}]},skills:{items:[{name:'Tools',keywords:['SQL','XML','SFTP']}]},education:{items:[{degree:'BSc',area:'Business',school:'Example University'}]},languages:{items:[{language:'German',fluency:'B1'},{language:'English',fluency:'C1'}]}}};
test('CV import extracts facts and explicit language levels without treating goals or hidden content as evidence',()=>{
 const parsed=parseCVJSON(cv,'analyst.json');assert.match(parsed.evidence,/Built API integrations/);assert.match(parsed.evidence,/BSc/);assert.match(parsed.evidence,/CV skill: SQL/);assert.doesNotMatch(parsed.evidence,/Salesforce|Secret|<li>/);assert.deepEqual(parsed.languages,['German B1','English C1']);
 const profile=validateProfile(mergeCVImports([parsed],{...defaultProfile,workRights:'Confirm permit',salaryTarget:'50000 EUR',evidence:'My existing note.'}));
 assert.equal(profile.workRights,'Confirm permit');assert.equal(profile.salaryTarget,'50000 EUR');assert.match(profile.evidence,/My existing note/);assert.equal(profile.germanLevel,'B1');
 const report=jobFitReport({title:'Business Analyst',location:'Germany',description:'Requirements:\nAPI experience.\nSQL experience.'},profile);assert.equal(report.score,10);
});
test('multiple CVs and repeated imports deduplicate facts and preserve existing contact details and PDFs',()=>{
 const first=parseCVJSON(cv,'analyst.json'),second=parseCVJSON(cv,'consulting.json');
 const base={...defaultProfile,email:'keep@example.org',analystCV:'Original.pdf'};
 const once=mergeCVImports([first,second],base),again=mergeCVImports([first],once);
 assert.equal(once.email,base.email);assert.equal(once.analystCV,'Original.pdf');assert.equal(again.evidence,once.evidence);assert.equal(again.cvImportSources,once.cvImportSources);
 assert.equal(once.evidence.split('Built API integrations').length,2);
});
test('unrecognised or mixed-person CVs fail without producing a profile',()=>{
 assert.throws(()=>parseCVJSON({profile:defaultProfile}),/CV JSON export/);
 assert.throws(()=>parseCVJSON({basics:{},sections:{}}),/No visible/);
 assert.throws(()=>mergeCVImports([parseCVJSON(cv),parseCVJSON({...cv,basics:{name:'Another person'}})],defaultProfile),/different names/);
 const sanitized=parseCVJSON({...cv,sections:{experience:{items:[{description:'<script>fetch("secret")</script><p>API delivery.</p>'}]}}});assert.doesNotMatch(sanitized.evidence,/secret|script/);
});
