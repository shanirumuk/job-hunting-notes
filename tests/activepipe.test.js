import test from 'node:test';
import assert from 'node:assert/strict';
import {listingSections,roleInsights} from '../lib/insights.js';
import {activepipe} from './fixtures/activepipe.js';
test('ActivePipe advert retains every responsibility and competency without treating headings or company text as requirements',()=>{
 const sections=listingSections(activepipe.description);
 assert.equal(sections.duties.length,13);assert.equal(sections.requirements.length,13);
 assert(sections.duties.some(s=>s.startsWith('As required, assist with integration testing')));
 assert(sections.duties.some(s=>s.startsWith('Work closely with internal and external stakeholders')));
 assert(sections.requirements.some(s=>s.startsWith('Ability to communicate clearly')));
 assert(sections.requirements.some(s=>s.startsWith('Growth mindset')));
 for(const line of [...sections.duties,...sections.requirements])assert.doesNotMatch(line,/^(Major Responsibilities|Knowledge and experience|Essential Competencies|All your information|We are|This is a really|Originally posted|Advertised UTC)/);
 assert.equal(listingSections(activepipe.description.replace(/•\n/g,'• ')).duties.length,13);
});
test('named tool alternatives recognise either Jira or Confluence, but Atlassian alone is not a tool qualification',()=>{
 const job={description:'Requirements:\nExperience using JIRA, Confluence or similar technologies.'};
 for(const evidence of ['I use Jira for issue tracking.','I use Confluence for documentation.','I use Jira and Confluence.'])assert.equal(roleInsights(job,{evidence}).requirements[0].status,'match',evidence);
 for(const evidence of ['I use Atlassian.','I plan to learn Jira.','I have not used Jira or Confluence.'])assert.notEqual(roleInsights(job,{evidence}).requirements[0].status,'match',evidence);
 assert.notEqual(roleInsights({description:'Requirements:\nExperience using Jira and Confluence.'},{evidence:'I use Jira.'}).requirements[0].status,'match');
 assert.notEqual(roleInsights({description:'Requirements:\nExperience administering Jira or Confluence workflows and permissions.'},{evidence:'I use Jira.'}).requirements[0].status,'match');
});
