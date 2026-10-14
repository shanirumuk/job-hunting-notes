import {test,expect} from '@playwright/test';
import {createHash} from 'node:crypto';
const jobs=Array.from({length:4},(_,i)=>({id:'queue-'+i,company:'Employer '+i,title:'Business Analyst',location:'Berlin, Germany',link:'https://example.org/queue/'+i,description:'Requirements:\nInterpret customer needs and turn them into a technical rollout plan for department '+i+'.'}));
const review={version:7,skills:8,skillsLower:8,overall:7,summary:'Requirements work transfers to this role.',cv:'Business Analyst CV',cvReason:'Use analysis evidence.',points:[{text:'Interpret customer needs',sourceQuote:jobs[0].description.split('\n')[1],category:'required',dimension:'skill',importance:'standard',status:'match',evidenceKind:'transferable',note:'Requirements evidence.',cvQuote:'SQL reporting and requirements documentation.'}],factors:[],audit:[],issues:[]};
async function setup(page,{inputJobs=jobs}={}){
 await page.addInitScript(()=>{localStorage.setItem('job-notebook-v1','[]');localStorage.setItem('job-notebook-profile-v1',JSON.stringify({geography:'europe',evidence:'SQL reporting and requirements documentation.',languages:'English C1'}));});
 await page.route('**/api/setup',r=>r.fulfill({json:{reviewProvider:{provider:'openai',configured:true}}}));await page.route('**/api/jobs*',r=>r.fulfill({json:{jobs:inputJobs,nextPage:null,nextSearch:null}}));await page.route('**/api/job-alerts',r=>r.fulfill({json:{configured:false}}));await page.route('**/api/summary',r=>r.fulfill({status:503,json:{error:'Not needed'}}));
 await page.goto('/#notebook');await page.evaluate(async()=>{const {setItem}=await import('/lib/device-store.js');await setItem('connection',{token:'x'.repeat(43)});});await page.reload();await expect(page.locator('#browser-connection-status')).toContainText('Private connection verified');
}
test('returning to Discover starts two bounded CV checks, displays a passing result immediately and preserves pending work',async({page})=>{
 let active=0,peak=0;const waiting=[];
 await page.route('**/api/fit-review',async route=>{expect(route.request().postDataJSON().purpose).toBe('discovery');active++;peak=Math.max(peak,active);await new Promise(resolve=>waiting.push({route,resolve}));active--;await route.fulfill({json:{review}}).catch(()=>{});});
 await setup(page);expect(waiting.length).toBe(0);await page.locator('.main-nav [data-view="discover"]').click();await expect.poll(()=>waiting.length).toBe(2);expect(peak).toBe(2);await expect(page.locator('#candidate-review-status')).toContainText('2 CV checks running');await expect(page.locator('#active-card')).toHaveCount(0);
 waiting[0].resolve();await expect(page.locator('#active-card')).toHaveAttribute('data-job-id','queue-0');await expect(page.locator('.card-fit-summary')).toContainText('8/10');await expect.poll(()=>waiting.length).toBe(3);expect(peak).toBe(2);
 for(const item of waiting)item.resolve();
});
test('an unchanged CV and advert reuse verified version-six comparisons with recalculated scores and no paid call',async({page})=>{
 let calls=0;await page.route('**/api/fit-review',r=>{calls++;return r.fulfill({status:503,json:{error:'Should use cache'}});});await setup(page,{inputJobs:[jobs[0]]});
 await page.evaluate(async({job,review})=>{const {setItem}=await import('/lib/device-store.js');const {defaultProfile}=await import('/lib/model.js?v=78');const p={...defaultProfile,...JSON.parse(localStorage.getItem('job-notebook-profile-v1'))};job=JSON.parse(localStorage.getItem('job-notebook-discovery-v1')).jobs[0];const input={job:{title:job.title,location:job.location,remote:!!job.remote,description:job.description},profile:Object.fromEntries(['evidence','languages','workRights','salaryTarget','motivation','workStyle','startDate','relocation'].map(k=>[k,p[k]||'']))};const key=JSON.stringify([6,new Date().toISOString().slice(0,7),input]);const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(key))),b=>b.toString(16).padStart(2,'0')).join('');await setItem('fit-reviews',{[hash]:{...review,version:6}});},{job:jobs[0],review});
 await page.reload();await page.locator('.main-nav [data-view="discover"]').click();await expect(page.locator('.card-fit-summary')).toContainText('Skills alignment: 10/10');expect(calls).toBe(0);
 const versions=await page.evaluate(async()=>Object.values(await(await import('/lib/device-store.js')).getItem('fit-reviews')).map(r=>r.version));expect(versions).toEqual([7]);
});
test('failed background checks retry automatically without a search button',async({page})=>{
 await page.clock.install();let calls=0;await page.route('**/api/fit-review',r=>{calls++;return r.fulfill({status:503,json:{error:'Temporary review failure'}});});await setup(page);await page.locator('.main-nav [data-view="discover"]').click();await expect.poll(()=>calls).toBe(4);await expect(page.locator('#active-card')).toHaveCount(0);
 await expect(page.getByRole('button',{name:/Keep searching|Review more candidates|Retry CV checks/})).toHaveCount(0);
 await page.route('**/api/fit-review',r=>r.fulfill({json:{review}}));await page.clock.fastForward(61000);await expect(page.locator('#active-card')).toHaveCount(1);
});

test('ten ready roles pause paid work, five consumed roles trigger a refill and cached cards render before connection checks',async({page})=>{
 const many=Array.from({length:20},(_,i)=>({...jobs[0],id:'buffer-'+i,company:'Employer '+i,link:'https://example.org/buffer/'+i,description:jobs[0].description+' Department '+i+'.'}));
 const waiting=[];let sources=0;
 await page.route('**/api/fit-review',async route=>{await new Promise(resolve=>waiting.push({resolve}));await route.fulfill({json:{review}}).catch(()=>{});});
 await setup(page,{inputJobs:many});
 await page.route('**/api/jobs*',r=>{sources++;return r.fulfill({json:{jobs:many,nextPage:null,nextSearch:'start'}});});
 await page.locator('.main-nav [data-view="discover"]').click();
 for(let i=0;i<10;i++){await expect.poll(()=>waiting.length).toBeGreaterThan(i);waiting[i].resolve();await expect(page.locator('#deck-count')).toHaveText(`${i+1} role${i?'s':''} to explore`);}
 await expect(page.locator('#feed-status')).toContainText('Refill at 5 remaining');
 await page.waitForTimeout(450);expect(waiting.length).toBe(10);expect(sources).toBe(0);
 for(let i=0;i<4;i++)await page.locator('#pass-job').click();
 await expect(page.locator('#deck-count')).toHaveText('6 roles to explore');expect(waiting.length).toBe(10);
 await page.locator('#pass-job').click();await expect(page.locator('#deck-count')).toHaveText('5 roles to explore');
 for(let i=10;i<15;i++){await expect.poll(()=>waiting.length).toBeGreaterThan(i);waiting[i].resolve();await expect(page.locator('#deck-count')).toHaveText(`${i-4} roles to explore`);}
 await page.waitForTimeout(450);expect(waiting.length).toBe(15);expect(sources).toBe(0);
 const saved=await page.evaluate(async()=>Object.keys(await(await import('/lib/device-store.js?v=80')).getItem('fit-reviews')).length);expect(saved).toBe(15);
 let release;await page.route('**/api/setup',async route=>{await new Promise(resolve=>release=resolve);await route.fulfill({json:{reviewProvider:{provider:'openai',configured:true}}}).catch(()=>{});});
 await page.reload({waitUntil:'domcontentloaded'});await expect(page.locator('#deck-count')).toHaveText('10 roles to explore');await expect(page.locator('#active-card')).toBeVisible();
 expect(waiting.length).toBe(15);release?.();
 // A stale source failure on return refreshes the free feeds, retaining ready
 // cards, rather than resuming a paid Firecrawl cursor automatically.
 await page.route('**/api/setup',r=>r.fulfill({json:{reviewProvider:{provider:'openai',configured:true}}}));
 const refreshed=[];await page.route('**/api/jobs*',r=>{refreshed.push(r.request().url());return r.fulfill({json:{jobs:many,nextPage:null,nextSearch:'start'}});});
 await page.evaluate(()=>{const d=JSON.parse(localStorage.getItem('job-notebook-discovery-v1'));d.fetchedAt='2020-01-01';d.lastError='Source interrupted';d.nextSearch='start';localStorage.setItem('job-notebook-discovery-v1',JSON.stringify(d));});
 await page.reload();await expect(page.locator('#deck-count')).toHaveText('10 roles to explore');await expect.poll(()=>refreshed.length).toBe(1);expect(new URL(refreshed[0]).searchParams.has('search')).toBe(false);expect(waiting.length).toBe(15);
});

test('a spent batch survives reload and automatically resumes after its credit pause',async({page})=>{
 await page.clock.install();const many=Array.from({length:20},(_,i)=>({...jobs[0],id:'budget-'+i,company:'Employer '+i,link:'https://example.org/budget/'+i,description:jobs[0].description+' Department '+i+'.'}));
 let calls=0;await page.route('**/api/fit-review',r=>{calls++;return r.fulfill({json:{review:{...review,skills:2,skillsLower:2}}});});await setup(page,{inputJobs:many});
 await page.locator('.main-nav [data-view="discover"]').click();await expect.poll(()=>calls).toBe(12);await expect(page.locator('.deck-empty')).toContainText('Next automatic check');
 const saved=await page.evaluate(async()=>Object.keys(await(await import('/lib/device-store.js?v=80')).getItem('fit-reviews')).length);expect(saved).toBe(12);
 await page.reload();await page.locator('.main-nav [data-view="discover"]').click();await expect(page.locator('.deck-empty')).toContainText('Next automatic check');await page.waitForTimeout(450);expect(calls).toBe(12);
 await page.clock.fastForward(61000);await expect.poll(()=>calls).toBe(20);await expect(page.getByRole('button',{name:/Keep searching|Continue checking|Review more candidates/})).toHaveCount(0);
});

test('a returning shortlist starts its refill as soon as the connection is verified without waiting for a feed refresh',async({page})=>{
 const many=Array.from({length:15},(_,i)=>({...jobs[0],id:'warm-'+i,company:'Employer '+i,link:'https://example.org/warm/'+i,description:jobs[0].description+' Department '+i+'.'}));
 await setup(page,{inputJobs:many});
 await page.evaluate(async review=>{
  const {setItem}=await import('/lib/device-store.js?v=80'),{defaultProfile}=await import('/lib/model.js?v=78');const p={...defaultProfile,...JSON.parse(localStorage.getItem('job-notebook-profile-v1'))},j=JSON.parse(localStorage.getItem('job-notebook-discovery-v1')).jobs[0];
  const input={job:{title:j.title,location:j.location,remote:!!j.remote,description:j.description},profile:Object.fromEntries(['evidence','languages','workRights','salaryTarget','motivation','workStyle','startDate','relocation'].map(k=>[k,p[k]||'']))};
  const key=JSON.stringify([7,new Date().toISOString().slice(0,7),input]),hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(key))),b=>b.toString(16).padStart(2,'0')).join('');await setItem('fit-reviews',{[hash]:review});
 },review);
 let verify;await page.route('**/api/setup',async r=>{if(r.request().postDataJSON()?.action!=='profile-corrections')return r.fulfill({status:503,json:{error:'PDF restore is not part of this test'}});await new Promise(resolve=>verify=resolve);await r.fulfill({json:{reviewProvider:{provider:'openai',configured:true}}}).catch(()=>{});});
 const waiting=[];await page.route('**/api/fit-review',async r=>{await new Promise(resolve=>waiting.push(resolve));await r.fulfill({json:{review}}).catch(()=>{});});
 await page.goto('/?warm-return=1#discover');await expect(page.locator('#deck-count')).toHaveText('1 role to explore');expect(waiting.length).toBe(0);
 await expect.poll(()=>typeof verify).toBe('function');verify();await expect.poll(()=>waiting.length).toBe(2);await expect(page.locator('#active-card')).toHaveAttribute('data-job-id','warm-0');
 for(const resolve of waiting)resolve();
});

test('the funded refill continues in Applications and returns ready cards without another search step',async({page})=>{
 const waiting=[];await page.route('**/api/fit-review',async r=>{expect(r.request().postDataJSON().purpose).toBe('discovery');await new Promise(resolve=>waiting.push(resolve));await r.fulfill({json:{review}}).catch(()=>{});});
 await setup(page);await page.locator('.main-nav [data-view="discover"]').click();await expect.poll(()=>waiting.length).toBe(2);
 await page.locator('.main-nav [data-view="notebook"]').click();waiting[0]();waiting[1]();await expect.poll(()=>waiting.length).toBe(4);waiting[2]();waiting[3]();
 await expect.poll(()=>page.evaluate(async()=>Object.keys(await(await import('/lib/device-store.js?v=80')).getItem('fit-reviews')||{}).length)).toBe(4);
 await page.locator('.main-nav [data-view="discover"]').click();await expect(page.locator('#deck-count')).toHaveText('4 roles to explore');await expect(page.locator('#active-card')).toBeVisible();await expect(page.getByRole('button',{name:/Keep searching/})).toHaveCount(0);
});

test('private server comparisons restore a ready card in a browser without a local review cache',async({page})=>{
 let paid=0;await page.route('**/api/fit-review',r=>{paid++;return r.fulfill({status:503,json:{error:'Must use completed review'}});});await setup(page,{inputJobs:[]});
 await page.route('**/api/review-cache',r=>{const input={job:{title:jobs[0].title,location:jobs[0].location,remote:false,description:jobs[0].description},profile:r.request().postDataJSON().profile},hash=createHash('sha256').update(JSON.stringify([7,new Date().toISOString().slice(0,7),input])).digest('hex');return r.fulfill({json:{records:[{hash,job:jobs[0],review,savedAt:Date.now()}]}});});
 await page.goto('/?server-ready=1#discover');await expect(page.locator('#active-card')).toHaveAttribute('data-job-id','queue-0');await expect(page.locator('.card-fit-summary')).toContainText('8/10');expect(paid).toBe(0);
 await page.locator('.main-nav [data-view="notebook"]').click();await page.locator('.main-nav [data-view="discover"]').click();await expect(page.locator('#active-card')).toHaveAttribute('data-job-id','queue-0');expect(paid).toBe(0);
});

test('a source batch cap does not remove a ready role still present in the full employer list',async({page})=>{
 await setup(page,{inputJobs:[]});const cached={...jobs[0],employerBoard:'example'};
 await page.route('**/api/review-cache',r=>{const input={job:{title:cached.title,location:cached.location,remote:false,description:cached.description},profile:r.request().postDataJSON().profile},hash=createHash('sha256').update(JSON.stringify([7,new Date().toISOString().slice(0,7),input])).digest('hex');return r.fulfill({json:{records:[{hash,job:cached,review,savedAt:Date.now()}]}});});
 await page.goto('/?listed-ready=1#discover');await expect(page.locator('#active-card')).toHaveAttribute('data-job-id',cached.id);
 await page.route('**/api/jobs*',r=>r.fulfill({json:{jobs:[],refreshedEmployerBoards:['example'],listedEmployerJobIds:[cached.id],nextPage:null,nextSearch:null}}));
 await page.locator('#refresh-jobs').click();await expect(page.locator('#refresh-jobs')).toBeEnabled();await expect(page.locator('#active-card')).toHaveAttribute('data-job-id',cached.id);
});

test('the new allowance resumes an old 36-review midnight pause and keeps prior credit usage',async({page})=>{
 let calls=0;await page.route('**/api/fit-review',r=>{calls++;return r.fulfill({json:{review}});});await setup(page);
 await page.evaluate(()=>{const k='job-notebook-discovery-v1',d=JSON.parse(localStorage.getItem(k));d.usage={day:new Date().toISOString().slice(0,10),reviews:36,searches:6};d.budgetPolicy=1;d.buffer={started:true,refilling:true,reviews:0,searches:0,resumeAt:Date.now()+12*3600000};localStorage.setItem(k,JSON.stringify(d));});
 await page.goto('/?new-allowance=1#discover');await expect(page.locator('#active-card')).toBeVisible();expect(calls).toBeGreaterThan(0);
 const state=await page.evaluate(()=>JSON.parse(localStorage.getItem('job-notebook-discovery-v1')));expect(state.budgetPolicy).toBe(2);expect(state.usage.reviews).toBeGreaterThan(36);expect(state.usage.reviews).toBeLessThanOrEqual(72);expect(state.buffer.resumeAt).toBe(0);
});
test('changing the continent shows only that continent and resets source progress',async({page})=>{
 const abroad={...jobs[0],id:'singapore',company:'Singapore Employer',location:'Singapore',link:'https://example.org/sg',description:jobs[0].description+' Singapore team.'};
 await page.route('**/api/fit-review',r=>r.fulfill({json:{review}}));await setup(page,{inputJobs:[jobs[0],abroad]});
 await page.locator('.main-nav [data-view="discover"]').click();await expect(page.locator('#active-card')).toHaveAttribute('data-job-id',jobs[0].id);
 await page.evaluate(()=>{const k='job-notebook-discovery-v1',d=JSON.parse(localStorage.getItem(k));d.webCheckedAt=999;localStorage.setItem(k,JSON.stringify(d));});
 const requests=[];await page.route('**/api/jobs*',r=>{requests.push(new URL(r.request().url()));return r.fulfill({json:{jobs:[jobs[0],abroad],nextPage:null,nextSearch:null}});});
 await page.locator('#location-filter').click();await page.locator('#filter-region').selectOption('asia');await page.locator('#apply-locations').click();await expect(page.locator('#active-card')).toHaveAttribute('data-job-id',abroad.id);await expect(page.locator('#deck-count')).toHaveText('1 role to explore');expect(requests[0].searchParams.get('region')).toBe('asia');
 const state=await page.evaluate(()=>JSON.parse(localStorage.getItem('job-notebook-discovery-v1')));expect(state.webCheckedAt).toBe(0);
});
test('a saved advert excludes its other reviewed copies and newly fetched copies',async({page})=>{
 const original=jobs[0],copy={...original,id:'copy',location:'Sweden',link:'https://example.org/copy'};let paid=0;
 await page.addInitScript(()=>{window.open=()=>({opener:null,blur(){}});});
 await page.route('**/api/fit-review',r=>{paid++;return r.fulfill({json:{review}});});await setup(page,{inputJobs:[]});
 await page.route('**/api/review-cache',r=>r.fulfill({json:{records:[original,copy].map(job=>{const input={job:{title:job.title,location:job.location,remote:false,description:job.description},profile:r.request().postDataJSON().profile};return {hash:createHash('sha256').update(JSON.stringify([7,new Date().toISOString().slice(0,7),input])).digest('hex'),job,review};})}}));
 await page.goto('/?copies=1#discover');await expect(page.locator('#deck-count')).toHaveText('1 role to explore');await page.keyboard.press('ArrowRight');await expect(page.locator('#active-card')).toHaveCount(0);
 await page.route('**/api/jobs*',r=>r.fulfill({json:{jobs:[{...copy,id:'new-copy',link:'https://example.org/new-copy'}],nextPage:null,nextSearch:null}}));await page.locator('#refresh-jobs').click();await expect(page.locator('#refresh-jobs')).toBeEnabled();await expect(page.locator('#active-card')).toHaveCount(0);expect(paid).toBe(0);
});
test('cross-source copies with Berlin versus Berlin Germany show one employer card and stay excluded after pass',async({page})=>{
 const aggregate={...jobs[0],location:'Berlin',source:'Arbeitnow'},primary={...aggregate,id:'primary-copy',location:'Berlin, Germany',link:'https://example.org/employer-primary',description:aggregate.description+' Original employer requirements.',employerBoard:'example',availability:'listed'};let paid=0;
 await page.route('**/api/fit-review',r=>{paid++;return r.fulfill({json:{review}});});await setup(page,{inputJobs:[]});
 await page.route('**/api/review-cache',r=>r.fulfill({json:{records:[aggregate,primary].map(job=>{const input={job:{title:job.title,location:job.location,remote:false,description:job.description},profile:r.request().postDataJSON().profile};return {hash:createHash('sha256').update(JSON.stringify([7,new Date().toISOString().slice(0,7),input])).digest('hex'),job,review};})}}));
 await page.goto('/?location-copies=1#discover');await expect(page.locator('#deck-count')).toHaveText('1 role to explore');await expect(page.locator('#active-card')).toHaveAttribute('data-job-id','primary-copy');
 await page.keyboard.press('ArrowLeft');await expect(page.locator('#active-card')).toHaveCount(0);await page.locator('#refresh-jobs').click();await expect(page.locator('#refresh-jobs')).toBeEnabled();await expect(page.locator('#active-card')).toHaveCount(0);expect(paid).toBe(0);
});
