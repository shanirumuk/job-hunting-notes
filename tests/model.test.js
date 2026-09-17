import test from 'node:test';
import assert from 'node:assert/strict';
import {matchJob,defaultProfile,prepareApplication,safeURL,plainText,validateEntries,validateProfile,sameJob} from '../lib/model.js';
import {fetchJobs} from '../api/jobs.js';
const job = {id:'one',company:'Example',title:'Implementation Consultant',location:'Berlin, Germany',description:'English. Customer workshops, workflow requirements and API integrations.',link:'https://example.org/jobs/one'};
test('prioritises relevant Germany work and selects BA vs consulting CV',() => {
  const match = matchJob(job); assert.ok(match.eligible); assert.ok(match.score >= 85); assert.equal(match.cv,'Consulting CV');
  assert.equal(matchJob({...job,title:'Technical Business Analyst'}).cv,'Business Analyst CV');
  assert.ok(match.flags.some(f => f.includes('unconfirmed')));
});
test('excludes US-only, architecture, coding-first and quota-led work',() => {
  for (const location of ['United States','USA','New York, NY','US Remote','Remote - AMER']) assert.equal(matchJob({...job,location}).eligible,false,location);
  for (const title of ['Solutions Architect','Full Stack Developer','Software Engineer','Sales Development Representative','Director, Customer Success']) assert.equal(matchJob({...job,title}).eligible,false,title);
  assert.equal(matchJob({...job,description:'This role is quota-carrying.'}).eligible,false);
  assert.equal(matchJob({...job,description:'Primarily coding enterprise systems.'}).eligible,false);
});
test('allows Europe among multiple regions and supports international preferences',() => {
  assert.equal(matchJob({...job,location:'Europe or United States'}).eligible,true);
  assert.equal(matchJob({...job,location:'Canada'}).eligible,false);
  assert.equal(matchJob({...job,location:'Canada'},{...defaultProfile,geography:'international'}).eligible,true);
  assert.ok(matchJob({...job,location:'Remote'}).flags.some(f => f.includes('Location needs')));
});
test('language and sponsorship gaps remain visible and strict mode can hide conditional jobs',() => {
  const conditional = {...job,description:'Must speak fluent German. No visa sponsorship. English.'};
  assert.ok(matchJob(conditional).flags.some(f => f.includes('German requirement')));
  assert.ok(matchJob(conditional).flags.some(f => f.includes('existing work rights')));
  assert.equal(matchJob(conditional,{...defaultProfile,includeConditional:false}).eligible,false);
  assert.ok(!matchJob({...job,description:'German B2 required'}, {...defaultProfile,germanLevel:'B2'}).flags.some(f => f.includes('German requirement')));
});
test('drafts only include provided evidence, never claim submission, and keep checks incomplete',() => {
  const p = prepareApplication(job,{...defaultProfile,name:'Applicant',evidence:'Delivered a project in 1.5 months.',startDate:'2027-01-01',workRights:'Employment permit required.'});
  assert.match(p.pitch,/1.5 months/); assert.doesNotMatch(p.pitch,/600|three customers/); assert.equal(p.workRights,'Employment permit required.'); assert.ok(Object.values(p.checks).every(x => x === false));
});
test('rejects unsafe links and malformed restores before replacement',() => {
  for (const url of ['javascript:alert(1)','data:text/html,x','https://name:secret@example.org']) assert.equal(safeURL(url),'');
  assert.throws(() => validateEntries([{...job,status:'Applied',notes:{}}]));
  assert.throws(() => validateEntries([{...job,status:'Applied'},{...job,status:'Applied'}]));
  assert.throws(() => validateProfile({includeConditional:'false'}));
  assert.throws(() => validateProfile({basics:{name:'Resume export'}}));
  assert.equal(validateEntries([{...job,status:'Applied'}])[0].notes,'');
  assert.equal(plainText('<script>danger</script><b>APIs &amp; workflows</b>'),'APIs & workflows');
});
test('deduplicates listing and apply links across providers',() => {
  assert.ok(sameJob(job,{...job,id:'other',link:job.link+'/apply'}));
  assert.ok(sameJob(job,{...job,id:'third',link:'https://other.example/job'}));
});
test('job source handles partial failure, normalises and deduplicates results',async () => {
  let calls = 0;
  const data = await fetchJobs(async () => {if (++calls === 2) throw new Error('down'); return {ok:true,json:async () => ({data:[{slug:'a',company_name:'Example',title:'Business Analyst',location:'Berlin',url:'https://example.org/a',description:'<b>Workflow</b>',created_at:1789645215},{slug:'bad',company_name:'Bad',title:'Bad',url:'javascript:alert(1)'}]})};});
  assert.equal(data.partial,true); assert.equal(data.jobs.length,1); assert.equal(data.jobs[0].description,'Workflow');
  await assert.rejects(() => fetchJobs(async () => {throw new Error('down');}));
});

test('adjacent titles qualify through responsibility evidence, not an exact title shortlist',() => {
  const description = 'Run stakeholder workshops, improve workflows, document requirements, configure CRM integrations and coordinate rollout testing. English.';
  for (const title of ['Systems Associate','Digital Adoption Specialist','Technical Account Manager','Business Systems Specialist','Integration Specialist','CRM Application Specialist']) {
    const match = matchJob({...job,title,description});
    assert.equal(match.eligible,true,title); assert.equal(match.exploration,true,title);
    assert.ok(match.reasons.some(r => r.includes('Stakeholder')),title);
  }
  assert.equal(matchJob({...job,title:'Systems Associate',description:'General admin, filing and office support.'}).eligible,false);
  assert.equal(matchJob({...job,title:'Systems Associate',description},{...defaultProfile,includeAdjacent:false}).eligible,false);
  assert.equal(matchJob({...job,title:'Technical Account Manager',description:description+' Own sales targets and cold-call new customers.'}).eligible,false);
});
test('responsibility matching still excludes engineering and unrelated consulting',() => {
  const description = 'Stakeholder workshops, requirements documentation, API integrations and delivery coordination.';
  for (const title of ['DevOps Engineer','Frontend Engineer','AI Application Engineer','Software Engineering Consultant','Technical Sales Manager','Research Consultant Schwerpunkt Finance','EU Public Affairs Senior Consultant']) {
    assert.equal(matchJob({...job,title,description}).eligible,false,title);
  }
});
test('manual developer applications have the developer PDF available without changing discovery direction',() => {
  const developer = {...job,title:'Full Stack Developer'};
  assert.equal(matchJob(developer).eligible,false);
  const draft = prepareApplication(developer,{...defaultProfile,developerCV:'developer.pdf'});
  assert.equal(draft.cv,'Full Stack Developer CV');assert.equal(draft.cvFile,'developer.pdf');
});
test('promising adjacent roles are interleaved and weak exploratory matches stay below core roles',async () => {
  const {rankJobs} = await import('../lib/model.js');
  const list = [90,85,80,75,70].map((score,n)=>({id:`core-${n}`,match:{score,exploration:false}}));
  const ranked = rankJobs([...list,{id:'adjacent',match:{score:82,exploration:true}},{id:'weak',match:{score:35,exploration:true}}]);
  assert.equal(ranked[3].id,'adjacent'); assert.equal(ranked.at(-1).id,'weak');
});
