import {test,expect} from '@playwright/test';
import {digitalImplementation} from './fixtures/digital-implementation.js';
test('implementation checklist separates duties and shows supported skills without AI credit',async({page})=>{
 await page.addInitScript(()=>{
  localStorage.setItem('job-notebook-v1','[]');localStorage.setItem('job-notebook-international-v23','1');localStorage.setItem('job-notebook-discovery-v26','1');
  localStorage.setItem('job-notebook-profile-v1',JSON.stringify({languages:'English native',evidence:'I have effective communication skills.\nI have an analytical mindset.\nHelp customers by resolving technical issues, improving workflows and coordinating work across teams.\nI can manage multiple projects.'}));
 });
 await page.route('**/api/jobs*',r=>r.fulfill({json:{jobs:[{...digitalImplementation,id:'implementation',link:'https://example.org/implementation',publishedAt:new Date().toISOString()}],nextPage:null,nextSearch:null,fetchedAt:new Date().toISOString()}}));
 await page.goto('/');await page.locator('.qualification-details > summary').click();
 const required=page.locator('[data-qualification-group="required"]');
 await expect(required.locator('.qualification')).toHaveCount(10);
 await expect(required.locator('.qualification.match')).toHaveCount(3);
 for(const text of ['Excellent written','Analytical problem-solving','Collaborative team player'])await expect(required.locator('.qualification.match').filter({hasText:text})).toHaveCount(1);
 await expect(required).not.toContainText('Job Qualifications');await expect(required).not.toContainText('Required Experience');
 await expect(page.locator('[data-qualification-group="duties"] .qualification')).toHaveCount(5);
 await expect(required.locator('.qualification.partial').filter({hasText:'Ability to prioritize'})).toContainText('prioritisation under pressure');
});
