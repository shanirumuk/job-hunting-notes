import {test,expect} from '@playwright/test';
import {secret,seal,digest,base64} from '../lib/device-crypto.js';
import {defaultProfile} from '../lib/model.js';
const record=(company,id=company)=>({id,company,title:'Junior Developer',location:'Berlin',link:'https://example.org/jobs/'+company,status:'Applied',applicationDate:'2026-10-08',notes:''});
async function recovery(){
 const code=secret(),cvs={};for(const type of ['consulting','analyst','developer']){const data=new TextEncoder().encode('%PDF-1.7 reviewed '+type);cvs[type]={name:type+'.pdf',base64:base64(data),sha256:await digest(data)};}
 const notebook={version:1,entries:['Bloom Future','individee','Delivery Hero'].map(c=>record(c)),profile:{...defaultProfile,name:'CV Person',evidence:'Experience: Developer September 2024 - Present. Built APIs and SQL reports.'},discovery:{jobs:[],decisions:{},fetchedAt:''},cvs,connection:{token:secret()}};
 return {code,notebook,encrypted:await seal({kind:'job-notebook-private-recovery',version:1,notebook},code,'transfer')};
}
async function boot(page){
 await page.route('**/api/jobs*',r=>r.fulfill({json:{jobs:[],fetchedAt:new Date().toISOString(),nextPage:null}}));
 await page.route('**/api/setup',r=>r.fulfill({json:{profile:{},provider:{configured:true,provider:'openai',model:'test'}}}));
 await page.route('**/api/job-alerts',r=>r.fulfill({json:{configured:true,address:'test@example.org',links:[],processed:[],nextCursor:null}}));
 await page.goto('/#notebook');await expect(page.locator('#nav-count')).toBeVisible();
 await page.evaluate(()=>{
  const rows=[{id:'local-bloom',company:'Bloom Future',title:'Junior Developer',location:'Berlin',link:'https://example.org/jobs/Bloom%20Future',status:'Rejected',applicationDate:'2026-10-08',notes:'Keep rejection notes'},...Array.from({length:16},(_,i)=>({id:'existing-'+i,company:'Existing '+i,title:'Analyst',location:'',link:'',status:'Applied',notes:'My note '+i}))];
  localStorage.setItem('job-notebook-v1',JSON.stringify(rows));localStorage.setItem('job-notebook-profile-v1',JSON.stringify({geography:'europe',evidence:'',email:'existing@example.org'}));localStorage.setItem('job-notebook-discovery-v1',JSON.stringify({jobs:[],decisions:{old:'pass'},fetchedAt:'',highlights:{old:[]}}));
 });
}
test('Chrome recovery adds missing applications and CVs, keeps rejection, retries acknowledgement and never duplicates',async({page})=>{
 const p=await recovery();let claims=0,acks=0;
 await page.route('**/api/device',r=>{const b=r.request().postDataJSON();if(b.action==='pair-claim'){claims++;return r.fulfill({json:{encrypted:p.encrypted}});}acks++;return acks===1?r.fulfill({status:503,json:{error:'Retry'}}):r.fulfill({json:{confirmed:true}});});
 await boot(page);await page.goto('/?app-refresh=recovery#restore-notebook='+p.code);await expect(page.locator('#nav-count')).toHaveText('19');
 const inspect=()=>page.evaluate(async()=>{const {capture}=await import('/lib/device-store.js');return capture(()=>({entries:JSON.parse(localStorage.getItem('job-notebook-v1')),profile:JSON.parse(localStorage.getItem('job-notebook-profile-v1')),discovery:JSON.parse(localStorage.getItem('job-notebook-discovery-v1'))}));});
 const saved=await inspect();expect(saved.entries.find(e=>e.id==='local-bloom').status).toBe('Rejected');expect(saved.entries.find(e=>e.id==='local-bloom').notes).toBe('Keep rejection notes');expect(saved.profile.email).toBe('existing@example.org');expect(saved.profile.geography).toBe('europe');expect(saved.profile.evidence).toBe(p.notebook.profile.evidence);expect(Object.keys(saved.cvs)).toHaveLength(3);expect(saved.connection).toEqual(p.notebook.connection);expect(saved.discovery.decisions.old).toBe('pass');expect(page.url()).not.toContain(p.code);
 await page.reload();await expect.poll(()=>acks).toBe(2);expect(claims).toBe(1);
 await page.goto('/?app-refresh=repeated#restore-notebook='+p.code);await expect(page.locator('#nav-count')).toHaveText('19');expect(claims).toBe(1);expect(acks).toBe(2);
});
test('tampered private transfer leaves existing records and missing CVs untouched',async({page})=>{
 const p=await recovery();p.encrypted.ciphertext='A'+p.encrypted.ciphertext.slice(1);
 await page.route('**/api/device',r=>r.fulfill({json:{encrypted:p.encrypted}}));await boot(page);await page.goto('/?app-refresh=tampered#restore-notebook='+p.code);
 await expect(page.locator('#toast')).toContainText('could not be verified');await expect(page.locator('#nav-count')).toHaveText('17');expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('job-notebook-profile-v1')).evidence)).toBe('');
 expect(await page.evaluate(async()=>{const {getItem}=await import('/lib/device-store.js');return !!await getItem('developer');})).toBe(false);
});
test('small phone filters, LinkedIn controls and application editor have readable text and reachable controls',async({page})=>{
 await page.setViewportSize({width:320,height:568});await boot(page);await page.reload();
 await page.locator('[data-edit="local-bloom"]').click();
 await page.locator('#status').selectOption('Preparing');await page.locator('#close-editor').click();
 // Force a preparing record to show all three editor actions.
 await page.evaluate(()=>{const rows=JSON.parse(localStorage.getItem('job-notebook-v1'));rows[0].status='Preparing';localStorage.setItem('job-notebook-v1',JSON.stringify(rows));});await page.reload();await page.locator('[data-edit="local-bloom"]').click();
 for(const id of ['edit-materials','delete-button','save-application']){const box=await page.locator('#'+id).boundingBox();expect(box.height).toBeGreaterThanOrEqual(44);expect(box.x).toBeGreaterThanOrEqual(0);expect(box.x+box.width).toBeLessThanOrEqual(320);}
 await page.locator('#close-editor').click();await page.locator('.main-nav [data-view="discover"]').click();await page.locator('#location-filter').click();
 expect((await page.locator('#filter-more summary').boundingBox()).height).toBeGreaterThanOrEqual(44);await page.locator('#filter-more summary').click();
 for(const selector of ['.filter-choice strong','.filter-choice small'])expect(await page.locator(selector).first().evaluate(e=>parseFloat(getComputedStyle(e).fontSize))).toBeGreaterThanOrEqual(14);
 await page.locator('#close-locations').click();await page.locator('.main-nav [data-view="profile"]').click();await page.locator('#email-alert-settings summary').first().click();
 const more=page.locator('#email-alert-settings details summary');await more.scrollIntoViewIfNeeded();expect((await more.boundingBox()).height).toBeGreaterThanOrEqual(44);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
