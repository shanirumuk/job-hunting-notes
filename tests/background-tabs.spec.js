import {test,expect,chromium} from '@playwright/test';
import {mkdtemp,rm} from 'node:fs/promises';import {tmpdir} from 'node:os';import path from 'node:path';
test('the real Chrome helper opens successive inactive tabs and keeps Discover active',async()=>{
 const directory=await mkdtemp(path.join(tmpdir(),'job-notebook-tabs-')),extension=path.resolve('autofill-extension');
 const context=await chromium.launchPersistentContext(directory,{channel:'chromium',headless:true,serviceWorkers:'allow',args:[`--disable-extensions-except=${extension}`,`--load-extension=${extension}`]});
 try{
  const worker=context.serviceWorkers()[0]||await context.waitForEvent('serviceworker');
  await context.addInitScript(()=>{localStorage.setItem('job-notebook-v1','[]');localStorage.setItem('job-notebook-international-v23','1');localStorage.setItem('job-notebook-discovery-v26','1');localStorage.setItem('job-notebook-profile-v1',JSON.stringify({evidence:'Built API integrations and SQL reporting.',languages:'English C1'}));});
  const jobs=[1,2].map(n=>({id:'background-'+n,company:'Employer '+n,title:'Business Analyst',location:'Germany',link:'https://example.org/background-'+n,description:'Requirements:\nAPI experience.\nSQL experience.\nEnglish proficiency.'}));
  await context.route('**/api/jobs*',r=>r.fulfill({json:{jobs,nextPage:null,nextSearch:null}}));await context.route('**/api/setup',r=>r.fulfill({json:{}}));await context.route('https://example.org/**',r=>r.fulfill({contentType:'text/html',body:'<h1>Employer application</h1>'}));
  const page=context.pages()[0];await page.goto('http://127.0.0.1:4190/#discover');await expect(page.locator('html')).toHaveAttribute('data-job-notebook-background-tabs','1');
  const active=await worker.evaluate(async()=>(await chrome.tabs.query({active:true,currentWindow:true}))[0].id);
  for(let n=0;n<2;n++){
   const id=await page.locator('#active-card').getAttribute('data-job-id');await page.keyboard.press('ArrowRight');await expect(page.locator(`#active-card[data-job-id="${id}"]`)).toHaveCount(0);
   await expect.poll(()=>worker.evaluate(async()=>(await chrome.tabs.query({active:true,currentWindow:true}))[0].id)).toBe(active);
   await expect(page.locator('#discover-view')).toBeVisible();expect(await page.evaluate(()=>document.visibilityState)).toBe('visible');
   await expect.poll(()=>context.pages().length).toBe(n+2);
  }
  const employerPages=context.pages().filter(p=>p!==page);for(const tab of employerPages){await tab.waitForLoadState();expect(await tab.evaluate(()=>window.opener)).toBe(null);}
  const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('job-notebook-v1')));expect(saved).toHaveLength(2);expect(saved.every(e=>e.status==='To apply')).toBe(true);
  await page.keyboard.press('x');
  const invalid=await page.evaluate(()=>new Promise(resolve=>{
   const requestId=crypto.randomUUID();window.addEventListener('message',function receive(e){if(e.data?.channel==='job-notebook-tabs-result'&&e.data.requestId===requestId){window.removeEventListener('message',receive);resolve(e.data.opened);}});
   window.postMessage({channel:'job-notebook-tabs-open',requestId,url:'javascript:alert(1)'},location.origin);
  }));expect(invalid).toBe(false);expect(context.pages()).toHaveLength(3);
 }finally{await context.close();await rm(directory,{recursive:true,force:true});}
});
