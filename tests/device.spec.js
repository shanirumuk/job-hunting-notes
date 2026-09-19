import {test,expect} from '@playwright/test';
import {createDeviceHandler} from '../api/device.js';
const owner='test-owner-token-abcdefghijklmnopqrstuvwxyz123456';
function service(){const files=new Map();let version=0;return createDeviceHandler({
 get:async(path,opts)=>{const f=files.get(path);if(f&&opts.ifNoneMatch===f.etag)return {statusCode:304};return f?{stream:new Blob([f.text]).stream(),blob:{etag:f.etag}}:null;},
 put:async(path,text,opts)=>{const f=files.get(path);if((f&&!opts.allowOverwrite)||(opts.ifMatch&&f?.etag!==opts.ifMatch)){const e=Error();e.name='BlobPreconditionFailedError';throw e;}const etag=String(++version);files.set(path,{text,etag});return {etag};}
});}
async function boot(page,handler){
 handler.requests ||= [];
 await page.route('**/api/device',async route=>{const req=route.request();handler.requests.push(req.postData());let code=200;await handler({method:req.method(),headers:req.headers(),body:req.postDataJSON()},{setHeader(){},status(n){code=n;return this;},json(data){return route.fulfill({status:code,json:data});}});});
 await page.route('**/api/jobs',r=>r.fulfill({json:{jobs:[],fetchedAt:new Date().toISOString(),nextPage:null}}));
 await page.route('**/api/summary',r=>r.fulfill({status:401,json:{error:'Test'}}));
 await page.goto('/');await expect(page.locator('#backup-button')).toBeVisible();
}
async function seed(page,n,pdfs){await page.evaluate(async({n,pdfs,owner})=>{
 const {defaultProfile,KEY,PROFILE_KEY,DISCOVERY_KEY}=await import('/lib/model.js');const {setItem}=await import('/lib/device-store.js');
 const preparation={pitch:'Private draft',cv:'Consulting CV',cvFile:'Original.pdf',startDate:'2027-01',workRights:'Permit needed',languages:'English',preparedAt:'2026-09-19',checks:{listing:true,eligibility:false,cv:true,answers:false}};
 localStorage.setItem(KEY,JSON.stringify(Array.from({length:n},(_,i)=>({id:'test-'+i,title:'Business Analyst',company:'Private company '+i,status:'Applied',notes:'Private note',location:'',applicationDate:'',interviewDate:'',link:'',materials:'',requirements:'',preparation}))));
 localStorage.setItem(PROFILE_KEY,JSON.stringify({...defaultProfile,name:'Private Person',email:'private@example.org'}));
 localStorage.setItem(DISCOVERY_KEY,JSON.stringify({jobs:[],decisions:{example:'pass'},fetchedAt:new Date().toISOString(),nextPage:null}));
 if(pdfs){await setItem('connection',{token:owner});for(const type of ['consulting','analyst','developer'])await setItem(type,{name:type+'.pdf',blob:new Blob(['%PDF-1.7\nOriginal '+type],{type:'application/pdf'})});}
 },{n,pdfs,owner});await page.reload();}
async function openDialog(p){await p.locator('#backup-button').click();await p.locator('#device-open').click();}
async function sync(p){await p.locator('[data-device="sync"]').click();await expect(p.locator('#device-dialog')).not.toHaveAttribute('aria-busy','true');}
async function snapshot(p){return p.evaluate(async()=>{const {capture}=await import('/lib/device-store.js');return capture(()=>({entries:JSON.parse(localStorage.getItem('job-notebook-v1')),profile:JSON.parse(localStorage.getItem('job-notebook-profile-v1')),discovery:JSON.parse(localStorage.getItem('job-notebook-discovery-v1'))}));});}
async function edit(p,text){await p.evaluate(text=>{const k='job-notebook-v1',a=JSON.parse(localStorage.getItem(k));a[0].notes=text;localStorage.setItem(k,JSON.stringify(a));},text);await p.reload();await openDialog(p);}
test('private one-time pairing previews all records, verifies PDFs, syncs and asks about conflicts',async({browser})=>{
 process.env.JOB_NOTEBOOK_ACCESS_TOKEN=owner;const handler=service();const a=await browser.newContext(),b=await browser.newContext({viewport:{width:393,height:851}}),c=await browser.newContext();const laptop=await a.newPage(),phone=await b.newPage(),intruder=await c.newPage();
 await boot(laptop,handler);await seed(laptop,5,true);await boot(phone,handler);await seed(phone,3,false);const before=await snapshot(laptop),oldPhone=await snapshot(phone);
 await openDialog(laptop);await laptop.locator('[data-device="send"]').click();const code=await laptop.locator('#device-share-code').inputValue();await laptop.locator('#device-close').click();await openDialog(laptop);await laptop.locator('[data-device="send"]').click();expect(await laptop.locator('#device-share-code').inputValue()).toBe(code);
 await openDialog(phone);await phone.locator('#device-code').fill(code);await phone.locator('[data-device="receive"]').click();await expect(phone.locator('#device-content')).toContainText('5 applications · 3 PDFs');expect(await snapshot(phone)).toEqual(oldPhone);
 await phone.locator('[data-device="confirm"]').click();await expect(phone.locator('#device-status')).toContainText('verified and confirmed');expect(await snapshot(phone)).toEqual(before);expect(await snapshot(laptop)).toEqual(before);
 expect(await phone.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await boot(intruder,handler);await openDialog(intruder);await intruder.locator('#device-code').fill(code);await intruder.locator('[data-device="receive"]').click();await expect(intruder.locator('#device-status')).toContainText('already used');
 await laptop.locator('#device-close').click();await openDialog(laptop);await sync(laptop);
 await edit(laptop,'Laptop edit');await sync(laptop);await sync(phone);expect((await snapshot(phone)).entries[0].notes).toBe('Laptop edit');
 await edit(laptop,'Concurrent laptop');await edit(phone,'Concurrent phone');await sync(laptop);await sync(phone);await expect(phone.locator('#device-content')).toContainText('Both devices have changed');expect((await snapshot(phone)).entries[0].notes).toBe('Concurrent phone');
 await phone.locator('[data-device="other"]').click();await expect(phone.locator('#device-status')).toContainText('Conflict resolved');expect((await snapshot(phone)).entries[0].notes).toBe('Concurrent laptop');
 expect(handler.requests.join('')).not.toContain('Private Person');expect(handler.requests.join('')).not.toContain('Private note');expect(handler.requests.join('')).not.toContain('%PDF-');expect(handler.requests.join('')).not.toContain(code);
 await a.close();await b.close();await c.close();
});
test('interrupted import restores applications and original PDFs from durable journal',async({page})=>{
 await boot(page,service());await seed(page,5,true);const before=await snapshot(page);
 await page.evaluate(async()=>{const {capture,setItem}=await import('/lib/device-store.js');const before=await capture(()=>({entries:JSON.parse(localStorage.getItem('job-notebook-v1')),profile:JSON.parse(localStorage.getItem('job-notebook-profile-v1')),discovery:JSON.parse(localStorage.getItem('job-notebook-discovery-v1'))}));await setItem('device-import-journal',{before});localStorage.setItem('job-notebook-v1','[]');await setItem('consulting',undefined);});await page.reload();expect(await snapshot(page)).toEqual(before);
});
test('quota failure during import rolls back every application and PDF',async({page})=>{
 await boot(page,service());await seed(page,5,true);const before=await snapshot(page);
 const error=await page.evaluate(async()=>{const {capture,installNotebook}=await import('/lib/device-store.js');const state=()=>({entries:JSON.parse(localStorage.getItem('job-notebook-v1')),profile:JSON.parse(localStorage.getItem('job-notebook-profile-v1')),discovery:JSON.parse(localStorage.getItem('job-notebook-discovery-v1'))});const pack=await capture(state);pack.entries=[];pack.cvs={};const original=Storage.prototype.setItem;let failed=false;Storage.prototype.setItem=function(k,v){if(k==='job-notebook-profile-v1'&&!failed){failed=true;throw new DOMException('Simulated quota','QuotaExceededError');}return original.call(this,k,v);};try{await installNotebook(pack,{state});return 'did not fail';}catch(e){return e.name;}finally{Storage.prototype.setItem=original;}});
 expect(error).toBe('QuotaExceededError');expect(await snapshot(page)).toEqual(before);await page.reload();expect(await snapshot(page)).toEqual(before);
});
