import {test,expect} from '@playwright/test';
import {activepipe} from './fixtures/activepipe.js';
test('full ActivePipe sections are displayed and a confirmed Jira entry updates the local match',async({page})=>{
 await page.addInitScript(()=>{
  if(localStorage.getItem('activepipe-test'))return;
  localStorage.setItem('activepipe-test','1');
  localStorage.setItem('job-notebook-v1','[]');localStorage.setItem('job-notebook-international-v23','1');localStorage.setItem('job-notebook-discovery-v26','1');
  localStorage.setItem('job-notebook-profile-v1',JSON.stringify({evidence:'I have effective communication skills.',languages:'English native'}));
 });
 await page.route('**/api/jobs*',r=>r.fulfill({json:{jobs:[{...activepipe,id:'activepipe',link:'https://example.org/activepipe',publishedAt:new Date().toISOString()}],nextPage:null,nextSearch:null,fetchedAt:new Date().toISOString()}}));
 await page.goto('/');await page.locator('.qualification-details > summary').click();
 const required=page.locator('[data-qualification-group="required"]');
 await expect(required.locator('.qualification')).toHaveCount(13);
 await expect(required).not.toContainText('Knowledge and experience');
 await expect(required).toContainText('Ability to communicate clearly');
 const duties=page.locator('[data-qualification-group="duties"]');
 await expect(duties.locator('.qualification')).toHaveCount(13);
 await expect(duties).toContainText('Work closely with internal and external stakeholders');
 await expect(duties).toContainText('As required, assist with integration testing');
 await page.locator('[data-view="profile"]').first().click();
 await page.locator('#profile-evidence').evaluate(el=>{for(let p=el.parentElement;p;p=p.parentElement)if(p.tagName==='DETAILS')p.open=true;});
 await page.locator('#profile-evidence').fill('I have effective communication skills.\nI use Jira for issue tracking.');
 await page.locator('#profile-form button[type="submit"]').click();
 await page.locator('[data-view="discover"]').first().click();await page.locator('.qualification-details > summary').click();
 await expect(required.locator('.qualification.match').filter({hasText:'Experience using JIRA'})).toHaveCount(1);
 await page.reload();await page.locator('.qualification-details > summary').click();
 await expect(required.locator('.qualification.match').filter({hasText:'Experience using JIRA'})).toHaveCount(1);
});
