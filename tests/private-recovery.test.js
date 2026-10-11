import test from 'node:test';
import assert from 'node:assert/strict';
import {mergePrivateRecovery} from '../lib/private-recovery.js';
import {defaultProfile} from '../lib/model.js';
import {base64,digest} from '../lib/device-crypto.js';
const entry=(id)=>({id,company:id,title:'Developer',location:'Berlin',link:'https://example.com/jobs/'+id,status:'Applied',applicationDate:'2026-10-08'});
const pack=()=>({version:1,entries:[],profile:{...defaultProfile},discovery:{jobs:[],decisions:{hidden:'pass'},highlights:{saved:[]},fetchedAt:'2026-10-11'},cvs:{},connection:null});
async function payload(){const source=pack();source.entries=['Bloom','individee','Delivery'].map(entry);source.profile={...source.profile,name:'CV Person',evidence:'Dated CV evidence',email:'cv@example.com',geography:'international',languages:'English C1, German B1, Shona native'};source.connection={token:'x'.repeat(43)};const data=new TextEncoder().encode('%PDF-1.7 original reviewed CV');source.cvs.developer={name:'Developer.pdf',base64:base64(data),sha256:await digest(data)};return {kind:'job-notebook-private-recovery',version:1,notebook:source};}
test('private recovery adds missing submissions while preserving Chrome statuses, notes and preferences',async()=>{
 const current=pack();current.entries=[{...entry('Bloom'),status:'Rejected',notes:'Keep rejection',preparation:{pitch:'Keep draft',cv:'Developer CV',cvFile:'Original.pdf',startDate:'',workRights:'',languages:'English',preparedAt:'',checks:{listing:true,eligibility:false,cv:true,answers:false}}},...Array.from({length:16},(_,i)=>entry('original-'+i))];current.profile.geography='europe';current.profile.email='chosen@example.com';
 const p=await payload(),next=await mergePrivateRecovery(current,p);
 assert.equal(next.entries.length,19);assert.deepEqual(next.entries.find(e=>e.id==='Bloom'),current.entries[0]);assert.equal(next.profile.geography,'europe');assert.equal(next.profile.email,'chosen@example.com');assert.equal(next.profile.evidence,'Dated CV evidence');assert.equal(next.profile.name,'CV Person');assert.deepEqual(next.discovery.decisions,current.discovery.decisions);assert.deepEqual(next.discovery.highlights,current.discovery.highlights);assert.equal(next.discovery.nextPage,1);assert.equal(next.cvs.developer.name,'Developer.pdf');assert.equal(next.connection.token,'x'.repeat(43));
 assert.deepEqual((await mergePrivateRecovery(next,p)).entries,next.entries);assert.equal(current.entries.length,17);assert.equal(current.profile.evidence,'');
});
test('recovery preserves existing CV files and reviewed experience',async()=>{
 const p=await payload(),current=pack();current.cvs=p.notebook.cvs;current.profile.developerCV='My current CV.pdf';current.profile.evidence='My newer reviewed facts';current.profile.languages='English C2, German B2';
 const next=await mergePrivateRecovery(current,p);assert.deepEqual(next.cvs,current.cvs);assert.equal(next.profile.developerCV,current.profile.developerCV);assert.equal(next.profile.evidence,current.profile.evidence);assert.equal(next.profile.languages,current.profile.languages);
});
test('invalid, tampered and non-submitted recovery data fails before changes',async()=>{
 const current=pack();
 for(const change of [p=>{p.kind='different'},p=>{p.notebook.cvs.developer.sha256='bad'},p=>{p.notebook.entries[0].status='Rejected'},p=>{p.notebook.connection=null},p=>{p.notebook.entries[0].link='javascript:evil'}]){const p=await payload();change(p);await assert.rejects(()=>mergePrivateRecovery(current,p));assert.deepEqual(current,pack());}
});
