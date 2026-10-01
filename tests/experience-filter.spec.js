import {test,expect} from '@playwright/test';
const requirements=['5+ years of experience as a Business Analyst.','3–5 years of experience in implementation.','5 years of experience preferred.','Stakeholder communication skills.'];
const jobs=requirements.map((requirement,i)=>({id:'experience-'+i,company:'Experience '+i,title:'Business Analyst',location:'Berlin, Germany',link:'https://example.org/experience-'+i,description:'Responsibilities:\nDeliver business requirements and stakeholder workshops.\nRequirements:\n'+requirement,publishedAt:new Date().toISOString()}));
test('experience limit filters cached and fetched roles, persists and preserves saved applications',async({page})=>{
 await page.addInitScript(jobs=>{
  if(localStorage.getItem('experience-test'))return;
  localStorage.setItem('experience-test','1');localStorage.setItem('job-notebook-international-v23','1');localStorage.setItem('job-notebook-discovery-v26','1');
  localStorage.setItem('job-notebook-v1',JSON.stringify([{...jobs[0],id:'saved',link:'https://example.org/saved',title:'Saved senior application',status:'Applied'}]));
  localStorage.setItem('job-notebook-discovery-v1',JSON.stringify({jobs,decisions:{},fetchedAt:new Date().toISOString(),nextPage:null,nextSearch:null}));
 },jobs);
 await page.route('**/api/jobs*',r=>r.fulfill({json:{jobs,nextPage:null,nextSearch:null,fetchedAt:new Date().toISOString()}}));
 await page.goto('/');await expect(page.locator('#deck-count')).toHaveText('3 roles to explore');await expect(page.locator('#active-card')).not.toHaveAttribute('data-job-id','experience-0');
 await page.locator('#experience-filter').click();await expect(page.locator('#filter-experience')).toHaveValue('4');
 await page.locator('#filter-experience').selectOption('2');await page.locator('#apply-locations').click();await expect(page.locator('#deck-count')).toHaveText('2 roles to explore');
 await page.reload();await expect(page.locator('#deck-count')).toHaveText('2 roles to explore');await expect(page.locator('#experience-filter')).toContainText('up to 2 years');
 await page.locator('#experience-filter').click();await page.locator('#reset-locations').click();await expect(page.locator('#deck-count')).toHaveText('2 roles to explore');
 await page.locator('#experience-filter').click();await page.locator('#filter-experience').selectOption('any');await page.locator('#apply-locations').click();await expect(page.locator('#deck-count')).toHaveText('4 roles to explore');
 await page.locator('[data-view="notebook"]').first().click();await expect(page.locator('#applications')).toContainText('Saved senior application');
});

test('senior titles are hidden even without years; the toggle persists independently of the years limit',async({page})=>{
 const titles=['Senior Business Analyst','Lead Implementation Consultant','Project Manager','Business Analyst'];
 const roles=titles.map((title,i)=>({...jobs[3],id:'level-'+i,company:'Level '+i,title,description:'Responsibilities:\nLead customer workshops, business requirements and API implementation projects.\nRequirements:\nStakeholder communication skills.',link:'https://example.org/level-'+i}));
 await page.addInitScript(()=>{localStorage.setItem('job-notebook-v1','[]');localStorage.setItem('job-notebook-international-v23','1');localStorage.setItem('job-notebook-discovery-v26','1');});
 await page.route('**/api/jobs*',r=>r.fulfill({json:{jobs:roles,nextPage:null,nextSearch:null,fetchedAt:new Date().toISOString()}}));
 await page.goto('/');await expect(page.locator('#deck-count')).toHaveText('2 roles to explore');
 await page.locator('#experience-filter').click();await expect(page.locator('#filter-hide-senior')).toBeChecked();
 await page.locator('#filter-experience').selectOption('any');await page.locator('#apply-locations').click();await expect(page.locator('#deck-count')).toHaveText('2 roles to explore');
 await page.locator('#experience-filter').click();await page.locator('#filter-hide-senior').uncheck();await page.locator('#apply-locations').click();await expect(page.locator('#deck-count')).toHaveText('4 roles to explore');
 await page.reload();await expect(page.locator('#deck-count')).toHaveText('4 roles to explore');
 await page.locator('#experience-filter').click();await expect(page.locator('#filter-hide-senior')).not.toBeChecked();
});
