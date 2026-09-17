import test from 'node:test';import assert from 'node:assert/strict';
import {authorized,supportedURL,validateRequest,SITE} from '../server/access.js';
import {fieldKey,identityMatches} from '../server/fields.js';
import handler from '../api/prepare.js';
const pdf=Buffer.from('%PDF-1.4\n%%EOF').toString('base64');
const request={url:SITE+'/practice-application.html',company:'Job Notebook Practice',title:'Implementation Consultant',demo:true,fields:{name:'Test Applicant',email:'test@example.org'},cv:{name:'CV.pdf',base64:pdf}};
test('private endpoint rejects missing and incorrect device tokens',async()=>{
 const secret='a'.repeat(43);assert.equal(authorized({headers:{}},secret),false);assert.equal(authorized({headers:{authorization:'Bearer wrong'}},secret),false);assert.equal(authorized({headers:{authorization:'Bearer '+secret}},secret),true);
 const res={setHeader(){},status(code){this.code=code;return this;},json(data){this.data=data;}};await handler({method:'POST',headers:{},body:request},res);assert.equal(res.code,401);
});
test('only supported secure employer URLs and the exact practice page are accepted',()=>{
 assert.equal(supportedURL('https://jobs.lever.co/company/id'),'https://jobs.lever.co/company/id');
 for(const url of ['http://jobs.lever.co/a','https://jobs.lever.co.evil.test/a','https://127.0.0.1/a','https://user@jobs.lever.co/a','https://jobs.lever.co:8443/a','https://www.linkedin.com/jobs/a',SITE+'/private/CV.pdf'])assert.throws(()=>supportedURL(url));
 assert.throws(()=>supportedURL('https://www.arbeitnow.com/jobs/a',{allowSource:false}));
});
test('PDF and identity are validated before starting a billable browser',()=>{
 assert.equal(validateRequest(request).bytes.subarray(0,5).toString(),'%PDF-');
 assert.throws(()=>validateRequest({...request,cv:{name:'x.pdf',base64:Buffer.from('not a pdf').toString('base64')}}));
 assert.throws(()=>validateRequest({...request,fields:{name:'Test',email:'invalid'}}));
 assert.throws(()=>validateRequest({...request,demo:false}));
});
test('field mapping leaves eligibility, consent, demographic and already-filled answers alone',()=>{
 const field={visible:true,filled:false,disabled:false,tag:'INPUT',type:'text',hint:''};
 for(const label of ['Sponsorship required','Preferred name','Reference name','Salary','Gender','Consent','Your manager name']) assert.equal(fieldKey({...field,label:label.toLowerCase()}),null);
 assert.equal(fieldKey({...field,label:'email',filled:true}),null);
 assert.equal(fieldKey({...field,label:'first name'}),'firstName');assert.equal(fieldKey({...field,label:'resume / cv',type:'file'}),'cv');
 assert.equal(fieldKey({...field,label:'cover letter',type:'file'}),null);
 assert.equal(identityMatches('Example Co is recruiting an Implementation Consultant','Implementation Consultant','Example Co'),true);
 assert.equal(identityMatches('Other employer Implementation Consultant','Implementation Consultant','Example Co'),false);
});
