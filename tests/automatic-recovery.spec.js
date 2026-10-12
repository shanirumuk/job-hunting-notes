import {test,expect} from '@playwright/test';
import {defaultProfile} from '../lib/model.js';
const record=company=>({id:company,company,title:'Developer',location:'Berlin',link:'https://example.org/jobs/'+encodeURIComponent(company),status:'Applied',applicationDate:'2026-10-08',notes:''});
const recovery={version:1,id:'submitted-october',entries:['Bloom Future','individee','Delivery Hero'].map(record)};
const good={id:'good',company:'Matching employer',title:'Business Analyst',location:'Berlin, Germany',link:'https://example.org/good',description:'Requirements:\nSQL experience.\nEnglish proficiency.'};
async function seed(page,{candidate=false,connected=true}={}){
 await page.addInitScript(({profile,candidate,good})=>{
  if(localStorage.getItem('automatic-test'))return;localStorage.setItem('automatic-test','1');
  for(const key of ['international-v23','firecrawl-v64','role-search-v67','discovery-v26','source-recovery-v75'])localStorage.setItem('job-notebook-'+key,'1');
  const bloom={id:'my-bloom',company:'Bloom Future',title:'Developer',location:'Berlin',link:'https://example.org/jobs/Bloom%20Future',status:'Rejected',applicationDate:'2026-10-08',notes:'Keep rejection notes'};
  localStorage.setItem('job-notebook-v1',JSON.stringify([bloom,...Array.from({length:16},(_,i)=>({id:'existing-'+i,company:'Existing '+i,title:'Developer',status:'Applied',notes:'My note '+i}))]));
  localStorage.setItem('job-notebook-profile-v1',JSON.stringify(profile));
  localStorage.setItem('job-notebook-discovery-v1',JSON.stringify({jobs:candidate?[{...good,id:'candidate',description:'Requirements:\nSQL\nEnglish\nCRM certification\nUnderwater robotics expertise'}]:[],decisions:{old:'pass'},fetchedAt:'',nextPage:1}));
 },{profile:{...defaultProfile,geography:'europe',evidence:'SQL database reporting. English native (C1).',email:'existing@example.org'},candidate,good});
 await page.goto('/#notebook');
 if(connected){await page.evaluate(async()=>{const {setItem}=await import('/lib/device-store.js');await setItem('connection',{token:'x'.repeat(43)});for(const type of ['consulting','analyst','developer'])await setItem(type,{name:type+'.pdf',blob:new Blob(['%PDF-1.7 existing '+type],{type:'application/pdf'})});});await page.reload();await expect(page.locator('#nav-count')).toHaveText('19');await expect(page.locator('#browser-connection-status')).toContainText('Private connection verified');}
}
async function service(page,{configured=false}={}){
 await page.route('**/api/setup',r=>r.fulfill({json:{reviewProvider:{provider:'openai',configured},applicationRecovery:recovery}}));
 await page.route('**/api/job-alerts',r=>r.fulfill({json:{configured:false}}));
 await page.route('**/api/summary',r=>r.fulfill({status:503,json:{error:'Test only'}}));
}
test('main restores missing applications automatically without a link and preserves Chrome rejections, profile and deletions',async({page})=>{
 await service(page);await page.route('**/api/jobs*',r=>r.fulfill({json:{jobs:[],nextPage:null,nextSearch:null}}));await seed(page);
 await expect(page.locator('#nav-count')).toHaveText('19');
 const read=()=>page.evaluate(()=>({entries:JSON.parse(localStorage.getItem('job-notebook-v1')),profile:JSON.parse(localStorage.getItem('job-notebook-profile-v1'))}));
 const before=await read();expect(before.entries.find(e=>e.id==='my-bloom').status).toBe('Rejected');expect(before.entries.find(e=>e.id==='my-bloom').notes).toBe('Keep rejection notes');expect(before.profile.email).toBe('existing@example.org');expect(before.profile.geography).toBe('europe');
 await page.reload();await expect(page.locator('#nav-count')).toHaveText('19');
 await page.evaluate(()=>{const key='job-notebook-v1';localStorage.setItem(key,JSON.stringify(JSON.parse(localStorage.getItem(key)).filter(e=>e.company!=='Delivery Hero')));});await page.reload();await expect(page.locator('#nav-count')).toHaveText('18');
});
test('a search error remains visible while a promising candidate is being reviewed',async({page})=>{
 await service(page,{configured:true});await page.route('**/api/jobs*',r=>r.fulfill({status:503,json:{error:'The source connection failed. Please retry.',code:'FIRECRAWL_SETUP_REQUIRED'}}));
 let release,reviewStarted=0;const gate=new Promise(resolve=>release=resolve);await page.route('**/api/fit-review',async r=>{reviewStarted++;await gate;await r.fulfill({status:503,json:{error:'Test ended'}}).catch(()=>{});});
 await seed(page,{candidate:true});await page.locator('.main-nav [data-view="discover"]').click();
 await expect.poll(()=>reviewStarted).toBeGreaterThan(0);await expect(page.locator('.deck-empty')).toContainText('The source connection failed. Please retry.');await expect(page.locator('#feed-status')).toContainText('The source connection failed');release();
});
test('a temporary rate limit retries the initial search automatically and shows matching jobs',async({page})=>{
 await service(page);let calls=0;await page.route('**/api/jobs*',r=>++calls===1?r.fulfill({status:429,headers:{'Retry-After':'2'},json:{code:'FIRECRAWL_RATE_LIMIT',error:'Source busy.',retryAfter:2}}):r.fulfill({json:{jobs:[good],nextPage:null,nextSearch:null}}));
 await seed(page,{connected:false});await page.locator('.main-nav [data-view="discover"]').click();await expect(page.locator('#feed-status')).toContainText('Retrying in 2 seconds');await expect(page.locator('#active-card')).toContainText('Matching employer');expect(calls).toBe(2);
});
test('manual retry after an initial failure uses start instead of the completed-search cursor',async({page})=>{
 await service(page);const requests=[];await page.route('**/api/jobs*',r=>{requests.push(r.request().url());return requests.length===1?r.fulfill({status:503,json:{error:'Temporary source failure'}}):r.fulfill({json:{jobs:[good],nextPage:null,nextSearch:null}});});
 await seed(page,{connected:false});await page.locator('.main-nav [data-view="discover"]').click();await expect(page.locator('#empty-refresh')).toHaveText('Retry search');await page.locator('#empty-refresh').click();await expect(page.locator('#active-card')).toContainText('Matching employer');expect(new URL(requests[1]).searchParams.get('search')).toBe('start');
});
