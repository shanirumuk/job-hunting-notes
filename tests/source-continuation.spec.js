import {test,expect} from '@playwright/test';
const job={id:'new-role',company:'New source',title:'Business Analyst',location:'Berlin, Germany',description:'Requirements:\nSQL experience.\nEnglish proficiency.',link:'https://example.org/new',publishedAt:new Date().toISOString()};
const profile={geography:'europe',evidence:'Experience: Analyst · Example · September 2024 - Present.\nRan stakeholder workshops. Built API implementation. SQL database reporting.',languages:'English C1'};
async function init(page){await page.addInitScript(profile=>{
 if(localStorage.getItem('source-test-seeded'))return;
 localStorage.setItem('source-test-seeded','1');localStorage.setItem('job-notebook-v1','[]');localStorage.setItem('job-notebook-profile-v1',JSON.stringify(profile));
 for(const key of ['international-v23','discovery-v26','firecrawl-v64','role-search-v67','source-recovery-v75','multi-source-v77'])localStorage.setItem('job-notebook-'+key,'1');
 },profile);}
test('continues beyond an empty search batch after its automatic credit pause and bounds a stuck cursor',async({page})=>{
 await page.clock.install();await init(page);let calls=0;
 await page.route('**/api/setup',r=>r.fulfill({json:{reviewProvider:{provider:'openai',configured:true}}}));
 await page.route('**/api/review-cache',r=>r.fulfill({json:{records:[]}}));
 await page.route('**/api/job-alerts',r=>r.fulfill({json:{configured:false}}));
 await page.route('**/api/summary',r=>r.fulfill({status:503,json:{error:'Not needed'}}));
 await page.route('**/api/fit-review',r=>r.fulfill({json:{review:{version:7,skills:8,skillsLower:8,points:[],factors:[],audit:[],issues:[],cv:'Business Analyst CV',summary:'Workshops and API evidence support this role.'}}}));
 await page.route('**/api/jobs*',r=>r.fulfill({json:{jobs:[],nextPage:null,nextSearch:null,fetchedAt:new Date().toISOString()}}));
 await page.goto('/#profile');await page.evaluate(async()=>{await(await import('/lib/device-store.js')).setItem('connection',{token:'x'.repeat(43)});});
 await page.unroute('**/api/jobs*');
 await page.route('**/api/jobs*',r=>{calls++;return r.fulfill({json:{jobs:calls===6?[job]:[],nextPage:null,nextSearch:calls===6?null:'cursor-'+calls,fetchedAt:new Date().toISOString()}});});
 await page.evaluate(()=>localStorage.removeItem('job-notebook-discovery-v1'));await page.reload();await expect.poll(()=>calls).toBe(1);await expect(page.locator('#browser-connection-status')).toContainText('Private connection verified');
 await page.locator('.main-nav [data-view="discover"]').click();await expect.poll(()=>calls).toBe(5);
 await expect(page.locator('.deck-empty')).toContainText('Next automatic check');await page.clock.fastForward(61000);
 await expect(page.locator('#active-card')).toContainText('New source');expect(calls).toBe(6);
 await page.unroute('**/api/jobs*');calls=0;
 await page.route('**/api/jobs*',r=>{calls++;return r.fulfill({json:{jobs:[],nextPage:null,nextSearch:'stuck',fetchedAt:new Date().toISOString()}});});
 await page.evaluate(()=>localStorage.removeItem('job-notebook-discovery-v1'));await page.reload();
 await expect.poll(()=>calls).toBe(2);
 await expect(page.locator('.deck-empty')).toContainText('Next automatic check');
 await expect(page.getByRole('button',{name:/Keep searching|Review more candidates/})).toHaveCount(0);
 await page.clock.fastForward(61000);await expect.poll(()=>calls).toBe(3);
});
test('successful employer refresh removes withdrawn discovery posts but preserves saved applications and failed boards',async({page})=>{
 await page.addInitScript(({job,profile})=>{
  localStorage.setItem('job-notebook-profile-v1',JSON.stringify(profile));
  for(const key of ['international-v23','discovery-v26','firecrawl-v64','role-search-v67','source-recovery-v75','multi-source-v77'])localStorage.setItem('job-notebook-'+key,'1');
  const old={...job,id:'withdrawn',company:'Withdrawn',employerBoard:'Ashby'};
  localStorage.setItem('job-notebook-v1',JSON.stringify([{...old,id:'saved',title:'Saved application',link:'https://example.org/saved',status:'Applied'}]));
  localStorage.setItem('job-notebook-discovery-v1',JSON.stringify({jobs:[old,{...job,id:'failed-board',company:'Failed board',link:'https://example.org/failed',employerBoard:'linear'}],decisions:{},fetchedAt:'2020-01-01',nextPage:null,nextSearch:null}));
 },{job,profile});
 await page.route('**/api/jobs*',r=>r.fulfill({json:{jobs:[],nextPage:null,nextSearch:null,refreshedEmployerBoards:['Ashby'],sourceErrors:['Linear careers'],fetchedAt:new Date().toISOString()}}));
 await page.goto('/');await expect(page.locator('#deck-count')).toHaveText('1 role to explore');await expect(page.locator('#active-card')).toContainText('Failed board');
 await page.locator('[data-view="notebook"]').first().click();await expect(page.locator('#applications')).toContainText('Saved application');
});
