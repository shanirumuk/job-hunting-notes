import test from 'node:test';
import assert from 'node:assert/strict';
import {defaultProfile,validateProfile,matchJob} from '../lib/model.js';
import {roleInsights} from '../lib/insights.js';
const job={title:'Business Analyst',location:'Germany',description:'Requirements:\nGerman B2 required.\nSQL experience.'};
test('one language list controls both discovery and qualification checks despite an old dropdown value',()=>{
 const profile=validateProfile({...defaultProfile,languages:'English C1, German B2',germanLevel:'A1'});
 assert.equal(profile.germanLevel,'B2');
 assert.equal(roleInsights(job,profile).requirements.find(r=>r.label.includes('German')).status,'match');
 assert(!matchJob(job,profile).flags.some(f=>f.includes('German requirement')));
 const lower=validateProfile({...profile,languages:'English C1, German A2'});
 assert.equal(roleInsights(job,lower).requirements.find(r=>r.label.includes('German')).status,'gap');
 assert(matchJob(job,lower).flags.some(f=>f.includes('German requirement')));
});
test('removing German does not reuse the old dropdown or invent a proficiency level',()=>{
 for(const languages of ['English C1','English C1, German','']){
  const profile=validateProfile({...defaultProfile,languages,germanLevel:'C2'});
  assert.equal(profile.germanLevel,'');
  assert.equal(roleInsights(job,profile).requirements.find(r=>r.label.includes('German')).status,'unknown');
  assert(matchJob(job,profile).flags.some(f=>f.includes('German level not recorded')));
 }
});
test('legacy profiles without a language list keep their recorded German level in the unified list',()=>{
 const profile=validateProfile({germanLevel:'B2'});
 assert.match(profile.languages,/German B2/);
 assert.equal(profile.germanLevel,'B2');
 assert.equal(validateProfile(profile).languages,profile.languages);
});
