import {test,expect} from '@playwright/test';
const profile={evidence:'Experience: Developer · Example · September 2024 - Present.\nBuilt API integrations.\nBuilt SQL reporting.',languages:'English C1'};
const requirements=['5+ years of experience as a Business Analyst.','3–5 years of experience in implementation.','5 years of experience preferred.',''];
const jobs=requirements.map((requirement,i)=>({id:'experience-'+i,company:'Experience '+i,title:'Business Analyst',location:'Berlin, Germany',link:'https://example.org/experience-'+i,description:'Requirements:\nAPI experience.\nSQL experience.\n'+requirement,publishedAt:new Date().toISOString()}));
async function seed(page,roles,saved=[]){
 await page.addInitScript(({roles,saved,profile})=>{
  if(localStorage.getItem('experience-test'))return;
  localStorage.setItem('experience-test','1');localStorage.setItem('job-notebook-international-v23','1');localStorage.setItem('job-notebook-discovery-v26','1');
  localStorage.setItem('job-notebook-profile-v1',JSON.stringify(profile));localStorage.setItem('job-notebook-v1',JSON.stringify(saved));
  localStorage.setItem('job-notebook-discovery-v1',JSON.stringify({jobs:roles,decisions:{},fetchedAt:new Date().toISOString(),nextPage:null,nextSearch:null}));
 },{roles,saved,profile});
 await page.route('**/api/jobs*',r=>r.fulfill({json:{jobs:roles,nextPage:null,nextSearch:null,fetchedAt:new Date().toISOString()}}));await page.goto('/');
}
test('dated CV filters cached and fetched required years without a manually selected limit',async({page})=>{
 await seed(page,jobs,[{...jobs[0],id:'saved',link:'https://example.org/saved',title:'Saved senior application',status:'Applied'}]);
 await expect(page.locator('#deck-count')).toHaveText('2 roles to explore');await expect(page.locator('#active-card')).not.toHaveAttribute('data-job-id','experience-0');
 await page.locator('#experience-filter').click();await expect(page.locator('#filter-cv-experience')).toContainText('CV matching');await expect(page.locator('#filter-experience')).toHaveCount(0);
 await page.locator('#apply-locations').click();await expect(page.locator('#deck-count')).toHaveText('2 roles to explore');
 await page.reload();await expect(page.locator('#deck-count')).toHaveText('2 roles to explore');await page.locator('#experience-filter').click();await expect(page.locator('#filter-cv-experience')).toContainText('years of dated employment');await page.locator('#close-locations').click();
 await page.locator('.main-nav [data-view="notebook"]').click();await expect(page.locator('#applications')).toContainText('Saved senior application');
});
test('senior-title preference persists while experience remains driven by the CV',async({page})=>{
 const titles=['Senior Business Analyst','Lead Implementation Consultant','Project Manager','Business Analyst'];
 const roles=titles.map((title,i)=>({...jobs[3],id:'level-'+i,company:'Level '+i,title,description:'Responsibilities:\nCustomer workshops and API implementation projects.\nRequirements:\nAPI experience.\nSQL experience.',link:'https://example.org/level-'+i}));
 await seed(page,roles);await expect(page.locator('#deck-count')).toHaveText('2 roles to explore');
 await page.locator('#experience-filter').click();await expect(page.locator('#filter-hide-senior')).toBeChecked();await page.locator('#filter-more summary').click();await page.locator('#filter-hide-senior').uncheck();await page.locator('#apply-locations').click();await expect(page.locator('#deck-count')).toHaveText('4 roles to explore');
 await page.reload();await expect(page.locator('#deck-count')).toHaveText('4 roles to explore');await page.locator('#experience-filter').click();await expect(page.locator('#filter-hide-senior')).not.toBeChecked();
});
