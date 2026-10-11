import {test,expect} from '@playwright/test';
import {defaultProfile} from '../lib/model.js';
const profile={...defaultProfile,geography:'europe',evidence:'SQL, data analysis and REST API development.\nEnglish native (C1).',languages:'English native (C1)'};
const saved={id:'existing',company:'Existing employer',title:'Analyst',location:'Berlin',status:'Applied',applicationDate:'2026-10-08',notes:'Keep my application',interviewDate:'',link:'',materials:'',requirements:''};
test('email alerts persist matching candidates, hide gaps and preserve submitted applications without repeated paid reads',async({page})=>{
 let reads=0;
 await page.addInitScript(({profile,saved})=>{
  if(localStorage.getItem('alert-test'))return;
  localStorage.setItem('alert-test','1');
  for(const k of ['job-notebook-international-v23','job-notebook-firecrawl-v64','job-notebook-role-search-v67','job-notebook-discovery-v26'])localStorage.setItem(k,'1');
  localStorage.setItem('job-notebook-profile-v1',JSON.stringify(profile));localStorage.setItem('job-notebook-v1',JSON.stringify([saved]));
  localStorage.setItem('job-notebook-discovery-v1',JSON.stringify({jobs:[],decisions:{},nextPage:null,nextSearch:null,fetchedAt:new Date().toISOString()}));
 },{profile,saved});
 await page.route('**/api/**',async route=>{
  const path=new URL(route.request().url()).pathname,body=route.request().postDataJSON()||{};
  if(path==='/api/setup')return route.fulfill({json:{reviewProvider:{provider:'openai',configured:false}}});
  if(path==='/api/jobs')return route.fulfill({json:{jobs:[],nextPage:null,nextSearch:null,fetchedAt:new Date().toISOString()}});
  if(path==='/api/job-alerts')return route.fulfill({json:body.action==='status'?{configured:true,address:'fixture@alerts.resend.app'}:{processed:['fixture-email'],links:body.seen.includes('fixture-email')?[]:[{url:'https://www.linkedin.com/jobs/view/4473218727/'},{url:'https://www.linkedin.com/jobs/view/4473218728/'}],nextCursor:null,errors:[]}});
  if(path==='/api/import-job'){
   reads++;const good=body.url.includes('4473218727');
   return route.fulfill({json:{job:{id:good?'alert-good':'alert-poor',title:good?'Business Analyst':'Technical Project Manager',company:good?'Matching employer':'Senior employer',location:'Berlin, Germany',link:body.url,description:good?'Requirements\nSQL\nEnglish':'Requirements\n5+ years managing distributed delivery teams.\nOwn budgets and margins.',source:'LinkedIn'}}});
  }
  return route.fulfill({status:503,json:{error:'External services disabled in test'}});
 });
 await page.goto('/');
 await page.evaluate(async()=>{const {setItem}=await import('/lib/device-store.js');await setItem('connection',{token:'fixture-private-access-token-123456789'});});
 await page.reload();
 await expect(page.locator('#email-alert-status')).toContainText('2 adverts added');
 await expect(page.locator('#deck-count')).toHaveText('1 role to explore');
 await expect(page.locator('#active-card')).toHaveAttribute('data-job-id','alert-good');
 expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('job-notebook-v1')))).toEqual([saved]);
 await page.locator('.main-nav [data-view="profile"]').click();await page.locator('#email-alert-settings summary').first().click();
 await page.locator('#email-alert-check').click();await expect(page.locator('#email-alert-status')).toContainText('No new adverts read');expect(reads).toBe(2);
 await page.reload();await expect(page.locator('#email-alert-status')).toContainText('Email receiver connected');expect(reads).toBe(2);
 expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('job-notebook-discovery-v1')).jobs.length)).toBe(2);
 expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('job-notebook-v1')))).toEqual([saved]);
});
test('a persisted daily limit survives reload and a manual check reads only three waiting adverts',async({page})=>{
 await page.route('**/api/**',r=>r.fulfill({status:503,json:{error:'External services disabled in test'}}));
 await page.goto('/#profile');
 await page.evaluate(()=>localStorage.setItem('job-notebook-email-alerts-v1',JSON.stringify({enabled:true,seen:[],queue:Array.from({length:5},(_,i)=>({url:'https://www.linkedin.com/jobs/view/'+(4473218727+i)+'/',attempts:0})),cursor:null,lastChecked:0,day:new Date().toISOString().slice(0,10),automaticReads:12})));
 await page.reload();
 await expect(page.locator('#email-alert-status')).toContainText('Connect your private device');
 await page.evaluate(async()=>{
  const {mountEmailAlertInbox}=await import('/lib/email-alert-inbox.js');window.fixtureReads=0;window.fixtureJobs=[];
  window.fixtureController=mountEmailAlertInbox({getToken:()=> 'fixture',hasCV:()=>true,knownJobs:()=>window.fixtureJobs,acceptJob:job=>window.fixtureJobs.push(job),fetcher:async(path,options)=>{
   const body=JSON.parse(options.body);let data;
   if(path==='/api/job-alerts')data=body.action==='status'?{configured:true,address:'fixture@alerts.resend.app'}:{links:[],processed:[],nextCursor:null};
   else{window.fixtureReads++;data={job:{id:body.url,link:body.url,description:'Verified advert text',source:'LinkedIn'}};}
   return {ok:true,json:async()=>data};
  }});
 });
 await expect(page.locator('#email-alert-status')).toContainText('paused after 12 attempts');
 expect(await page.evaluate(()=>window.fixtureReads)).toBe(0);
 await page.evaluate(()=>window.fixtureController.check(true));
 expect(await page.evaluate(()=>({reads:window.fixtureReads,waiting:JSON.parse(localStorage.getItem('job-notebook-email-alerts-v1')).queue.length,automatic:JSON.parse(localStorage.getItem('job-notebook-email-alerts-v1')).automaticReads}))).toEqual({reads:3,waiting:2,automatic:12});
});
