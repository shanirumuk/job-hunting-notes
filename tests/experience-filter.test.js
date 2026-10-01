import test from 'node:test';
import assert from 'node:assert/strict';
import {experienceRequirement,experienceWithinLimit,experienceLimits} from '../lib/experience-filter.js';
import {defaultProfile,validateProfile} from '../lib/model.js';
const minimum=text=>experienceRequirement({description:'Requirements:\n'+text}).minimum;
test('experience filter recognises mandatory minimums, ranges and written numbers',()=>{
 for(const text of ["5+ years' experience as a Business Analyst.",'At least five years of experience in consulting.','5–7 years of relevant industry experience.','Minimum 5 to 8 years in implementation.','Experience: 5 years.','5 years of B2B SaaS implementation experience.','Five or more years of experience.'])assert.equal(minimum(text),5,text);
 assert.equal(minimum('3–5 years of experience.'),3);
 assert.equal(minimum('2.5 years of professional experience.'),2.5);
 assert.equal(minimum('More than 5 years of experience.'),5.01);
 assert.equal(minimum('3 years of experience.\n5 years of experience managing teams.'),5);
});
test('preferences, company age, benefits and unstated seniority do not impose an experience gate',()=>{
 for(const text of ['Five years of experience preferred.','5+ years of experience is an added advantage.','Our company has been operating for 20 years.','Receive extra leave after 5 years of service.','Degree earned within the last 5 years.','Senior Business Analyst.','Up to 5 years of experience.','Less than 5 years of experience.'])assert.equal(minimum(text),null,text);
 assert.equal(experienceRequirement({description:'Nice to have\n5 years of experience.'}).minimum,null);
 assert.equal(minimum('3 years of experience required; 5 years preferred.'),3);
 assert.equal(minimum('3 years of experience, ideally 5 years of experience.'),3);
 assert.equal(minimum('2 years of experience with a degree or 5 years of experience without one.'),2);
});
test('limits are adjustable and validated, with five-year roles hidden by default',()=>{
 assert.equal(defaultProfile.experienceLimit,'4');
 assert.equal(experienceWithinLimit({minimum:5}),false);
 assert.equal(experienceWithinLimit({minimum:3}),true);
 assert.equal(experienceWithinLimit({minimum:null},'0'),true);
 assert.equal(experienceWithinLimit({minimum:1},'0'),false);
 assert.equal(experienceWithinLimit({minimum:12},'any'),true);
 for(const experienceLimit of experienceLimits)assert.equal(validateProfile({experienceLimit}).experienceLimit,experienceLimit);
 for(const experienceLimit of ['bad','-1',2])assert.throws(()=>validateProfile({experienceLimit}));
});

test('seniority filters titles independently of experience without excluding every manager or assistant',async()=>{
 const {isSeniorRole}=await import('../lib/experience-filter.js');
 for(const title of ['Senior Business Analyst','Sr. Implementation Consultant','Team Lead, Customer Success','Lead Consultant','Principal Analyst','Staff Solutions Engineer','Head of Operations','Associate Director','VP Customer Success','Chief Technology Officer'])assert.equal(isSeniorRole({title}),true,title);
 for(const title of ['Business Analyst','Project Manager','Customer Success Manager','Account Executive','Executive Assistant','Assistant to the Director','Lead Generation Specialist','Junior and Senior Business Analysts'])assert.equal(isSeniorRole({title}),false,title);
 assert.equal(defaultProfile.hideSeniorRoles,true);assert.equal(validateProfile({hideSeniorRoles:false}).hideSeniorRoles,false);assert.throws(()=>validateProfile({hideSeniorRoles:'false'}));
});
