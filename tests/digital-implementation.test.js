import test from 'node:test';
import assert from 'node:assert/strict';
import {listingSections,roleInsights} from '../lib/insights.js';
import {digitalImplementation} from './fixtures/digital-implementation.js';
const profile={evidence:'I have effective communication skills.\nI have an analytical mindset.\nHelp customers by resolving technical issues, improving workflows and coordinating work across teams.\nI can manage a single project or multiple projects.\nBuilt automated tests and checks for user permissions.\nContributed updates to a live technology platform, covering testing and monitoring.'};
test('implementation duties and qualifications retain section boundaries in HTML and flattened source text',()=>{
 const html=digitalImplementation.description.split('\n').map(line=>line.startsWith('• ')?'<li>'+line.slice(2)+'</li>':'<h3>'+line+'</h3>').join('');
 for(const description of [digitalImplementation.description,html,digitalImplementation.description.replaceAll('• ','•\n')]){
  const sections=listingSections(description);assert.equal(sections.duties.length,5);assert.equal(sections.requirements.length,10);
  assert(sections.duties.some(s=>s.startsWith('Deliver a consistent')));
  assert(sections.duties.some(s=>s.startsWith('Contribute to process')));
  assert(!sections.requirements.some(s=>/^(?:Job Qualifications|Required Experience)$/.test(s)));
 }
});
test('confirmed skills and concrete work support equivalent wording, without certifying extra conditions',()=>{
 const points=roleInsights(digitalImplementation,profile).requirements;
 const get=prefix=>points.find(p=>p.source.startsWith(prefix));
 for(const prefix of ['Excellent written','Analytical problem-solving','Collaborative team player'])assert.equal(get(prefix).status,'match',prefix);
 assert.equal(get('Ability to prioritize').status,'partial');assert.match(get('Ability to prioritize').note,/prioritisation under pressure/);
 assert.equal(get('Strong attention').status,'partial');assert.match(get('Strong attention').note,/validation and testing/);
 assert.equal(get('Proven experience').status,'partial');
 for(const prefix of ['Strong organizational','Passion for continuous','Excellent communication and interpersonal'])assert.notEqual(get(prefix).status,'match',prefix);
});
test('compound analytical fit requires both evidence sources, and communication modifiers remain checked',()=>{
 const analytical={description:'Requirements:\nAnalytical problem-solving mindset with a willingness to investigate and resolve technical issues.'};
 for(const evidence of ['I have an analytical mindset.','I resolve technical issues.','I have an analytical mindset.\nI have never resolved technical issues.'])assert.notEqual(roleInsights(analytical,{evidence}).requirements[0].status,'match');
 for(const line of ['Excellent written and verbal communication skills with medical specialists.','Excellent written and verbal communication skills in French.','Collaborative team player comfortable working across multiple departments in a hospital.'])assert.notEqual(roleInsights({description:'Requirements:\n'+line},profile).requirements[0].status,'match');
 assert.notEqual(roleInsights({description:'Requirements:\nExcellent written and verbal communication skills.'},{evidence:'I want to learn effective communication skills.'}).requirements[0].status,'match');
});
