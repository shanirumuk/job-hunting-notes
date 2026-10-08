import test from 'node:test';
import assert from 'node:assert/strict';
import {parseJobPage,importURL,publicAddress,fetchPublicHTML} from '../server/job-import.js';
import {createImportJobHandler} from '../api/import-job.js';
const posting={'@type':'JobPosting',title:'Implementation Consultant',hiringOrganization:{name:'Example &amp; Co'},description:'<h2>Requirements</h2><ul><li>API experience.</li><li>SQL experience.</li></ul>',jobLocation:{address:{addressLocality:'Berlin',addressCountry:'Germany'}},datePosted:'2026-10-01'};
const html=data=>'<script type="application/ld+json">'+JSON.stringify(data).replaceAll('<','\\u003c')+'</script>';
test('URL import retrieves structured role facts from LinkedIn and employer pages',()=>{
 const job=parseJobPage(html({'@graph':[posting]}),'https://www.linkedin.com/jobs/view/123');
 assert.equal(job.source,'LinkedIn');assert.equal(job.company,'Example & Co');assert.equal(job.title,posting.title);assert.equal(job.location,'Berlin, Germany');assert.match(job.description,/Requirements\n\n• API experience/);assert.equal(job.publishedAt,'2026-10-01');
 const remote=parseJobPage(html({...posting,jobLocation:null,jobLocationType:'TELECOMMUTE',applicantLocationRequirements:[{name:'Canada'}]}),'https://example.org/job');assert.equal(remote.remote,true);assert.equal(remote.location,'Canada');
});
test('blocked or incomplete pages never invent facts and untrusted advert markup is text',()=>{
 for(const data of [{}, {...posting,title:''},{...posting,hiringOrganization:null}])assert.throws(()=>parseJobPage(html(data),'https://example.org/job'),/listing|employer/i);
 assert.doesNotMatch(parseJobPage(html({...posting,description:'<script>alert(1)</script><p>SQL required.</p>'}),'https://example.org/job').description,/alert/);
});
test('listing importer blocks private, reserved, mapped and local network destinations',async()=>{
 for(const address of ['127.0.0.1','10.1.2.3','172.16.0.1','192.168.1.1','169.254.169.254','100.100.100.200','0.0.0.0','224.0.0.1','::1','fc00::1','fe80::1','::ffff:127.0.0.1','2001:db8::1','2002:7f00:1::1'])assert.equal(publicAddress(address),false,address);
 for(const address of ['8.8.8.8','1.1.1.1','2606:4700:4700::1111'])assert.equal(publicAddress(address),true,address);
 for(const url of ['http://localhost/a','http://server.local/job','http://server.internal/job','https://example.org:8443/job','https://name:secret@example.org/job','file:///etc/passwd'])assert.throws(()=>importURL(url));
 await assert.rejects(()=>fetchPublicHTML('http://127.0.0.1/job'),/public/);
});
test('import endpoint validates method and link and returns actionable errors',async()=>{
 let calls=0;const handler=createImportJobHandler(async url=>{calls++;if(url.includes('blocked'))throw Error('Try the employer’s careers link.');return parseJobPage(html(posting),url);});
 const call=async(method,body)=>{const res={setHeader(){},status(code){this.code=code;return this;},json(data){this.data=data;return this;}};await handler({method,body},res);return res;};
 assert.equal((await call('GET',{})).code,405);assert.equal((await call('POST',{})).code,400);assert.equal((await call('POST',{url:'javascript:alert(1)'})).code,400);assert.equal(calls,0);
 const ok=await call('POST',{url:'https://www.linkedin.com/jobs/view/123'});assert.equal(ok.code,200);assert.equal(ok.data.job.company,'Example & Co');
 assert.equal((await call('POST',{url:'https://blocked.example/job'})).code,422);
});
