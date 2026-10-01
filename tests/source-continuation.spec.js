import {test,expect} from '@playwright/test';
const job={id:'new-role',company:'New source',title:'Business Analyst',location:'Berlin, Germany',description:'Requirements:\nStakeholder workshops and API implementation.',link:'https://example.org/new',publishedAt:new Date().toISOString()};
async function init(page){await page.addInitScript(()=>{localStorage.setItem('job-notebook-v1','[]');localStorage.setItem('job-notebook-international-v23','1');localStorage.setItem('job-notebook-discovery-v26','1');});}
test('continues beyond three empty batches and stops a non-advancing source cursor',async({page})=>{
 await init(page);let calls=0;
 await page.route('**/api/jobs*',r=>{calls++;return r.fulfill({json:{jobs:calls===6?[job]:[],nextPage:null,nextSearch:calls===6?null:'cursor-'+calls,fetchedAt:new Date().toISOString()}});});
 await page.goto('/');await expect(page.locator('#active-card')).toContainText('New source');expect(calls).toBe(6);
 await page.unroute('**/api/jobs*');calls=0;
 await page.route('**/api/jobs*',r=>{calls++;return r.fulfill({json:{jobs:[],nextPage:null,nextSearch:'stuck',fetchedAt:new Date().toISOString()}});});
 await page.evaluate(()=>localStorage.removeItem('job-notebook-discovery-v1'));await page.reload();
 await expect(page.locator('#empty-refresh')).toHaveText('Keep searching');await expect.poll(()=>calls).toBe(2);
 await expect(page.locator('.deck-empty')).toContainText('Remote OK');
});
test('successful employer refresh removes withdrawn discovery posts but preserves saved applications and failed boards',async({page})=>{
 await page.addInitScript(job=>{
  localStorage.setItem('job-notebook-international-v23','1');localStorage.setItem('job-notebook-discovery-v26','1');
  const old={...job,id:'withdrawn',company:'Withdrawn',employerBoard:'Ashby'};
  localStorage.setItem('job-notebook-v1',JSON.stringify([{...old,id:'saved',title:'Saved application',link:'https://example.org/saved',status:'Applied'}]));
  localStorage.setItem('job-notebook-discovery-v1',JSON.stringify({jobs:[old,{...job,id:'failed-board',company:'Failed board',link:'https://example.org/failed',employerBoard:'linear'}],decisions:{},fetchedAt:'2020-01-01',nextPage:null,nextSearch:null}));
 },job);
 await page.route('**/api/jobs*',r=>r.fulfill({json:{jobs:[],nextPage:null,nextSearch:null,refreshedEmployerBoards:['Ashby'],sourceErrors:['Linear careers'],fetchedAt:new Date().toISOString()}}));
 await page.goto('/');await expect(page.locator('#deck-count')).toHaveText('1 role to explore');await expect(page.locator('#active-card')).toContainText('Failed board');
 await page.locator('[data-view="notebook"]').first().click();await expect(page.locator('#applications')).toContainText('Saved application');
});
