import test from 'node:test';import assert from 'node:assert/strict';
import {roleInsights,listingSections} from '../lib/insights.js';
import {customerPartnerships} from './fixtures/customer-partnerships.js';
const profile={languages:'English native (C1)',evidence:'Confirmed by you: I have multitasking skills.\nConfirmed by you: I have effective communication skills.\nConfirmed by you: I am willing to travel.\nConfirmed by you: I can manage a single project or multiple projects.\nI added Frappe CRM to a project.'};
test('confirmed skills earn ticks for direct requests, including labelled and combined points',()=>{
 const info=roleInsights({description:'Requirements:\nMultitasking skills.\nEffective communication skills.\nWillingness to travel.\nAbility to manage multiple projects.\nProject management: Ability to manage a single project.\nAbility to multitask, communicate effectively and manage multiple projects.\nStrong communication and multitasking skills.'},profile);
 assert.equal(info.requirements.length,10);for(const point of info.requirements)assert.equal(point.status,'match',point.source);
});
test('English is assessed separately; key headings and sick leave are not qualifications',()=>{
 const info=roleInsights(customerPartnerships,profile);
 assert.equal(info.requirements.length,7);assert.equal(info.dutyAssessments.length,6);
 assert.equal(info.requirements.find(p=>p.source.startsWith('Fluent English')).status,'match');
 assert.equal(info.requirements.find(p=>/presentation/.test(p.source)).status,'partial');
 assert.match(info.requirements.find(p=>/presentation/.test(p.source)).note,/presentation-specific/);
 assert.match(info.requirements.find(p=>/small talk/.test(p.source)).note,/not been confirmed/);
 assert(!info.requirements.some(p=>/^(Key$|Unlimited)|medical certificate/.test(p.source)));
 assert(info.benefits.some(p=>/Unlimited sick leave/.test(p.source)));
 for(const source of ['Proven Experience','Commercial Acumen'])assert.notEqual(info.requirements.find(p=>p.source.startsWith(source)).status,'match');
 assert.notEqual(info.dutyAssessments.find(p=>/HubSpot/.test(p.source)).status,'match');
});
test('general declarations do not certify travel restrictions, years, scale, domains or negated skills',()=>{
 for(const line of ['Willingness to travel 80% internationally.','Ability to manage multiple projects with budgets above €10 million.','5 years of project management experience.','Effective communication with specialist medical audiences.'])assert.notEqual(roleInsights({description:'Requirements:\n'+line},profile).requirements[0].status,'match',line);
 for(const line of ['No multitasking skills.','I want to learn project management.','I am not willing to travel.']){
  const info=roleInsights({description:'Requirements:\nMultitasking skills.\nProject management.\nWillingness to travel.'},{evidence:line});assert(!info.requirements.some(p=>p.status==='match'));
 }
 assert.equal(roleInsights({description:'Requirements:\nFluent English (C1+, both written and verbal).'}, {...profile,languages:'English native'}).requirements[0].status,'match');
 assert.notEqual(roleInsights({description:'Requirements:\nEnglish C1 certificate required.'}, profile).requirements[0].status,'match');
});
test('leave benefit wording does not hide actual HR qualifications',()=>{
 const sections=listingSections('Key\nEffective communication skills.\nUnlimited sick leave: No medical certificate required.\nExperience administering sick leave policies required.');
 assert.equal(sections.requirements.length,2);assert.equal(sections.benefits.length,1);
});
