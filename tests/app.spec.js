import {sellerIntern} from './fixtures/seller-intern.js';
import {test,expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';
// Existing interaction fixtures intentionally use the Europe-only preference.
test.beforeEach(async({page},testInfo)=>{
 if(testInfo.title.startsWith('international migration'))return;
 await page.addInitScript(()=>{
  localStorage.setItem('job-notebook-international-v23','1');localStorage.setItem('job-notebook-discovery-v26','1');
  if(!localStorage.getItem('job-notebook-profile-v1'))localStorage.setItem('job-notebook-profile-v1',JSON.stringify({geography:'europe'}));
 });
});
const jobs = [
  {id:'fixture-ba',company:'Workflow Ltd',title:'Technical Business Analyst',location:'Berlin, Germany',description:'English. Workflow requirements, stakeholder workshops, API integrations.',link:'https://example.org/ba',source:'Arbeitnow',publishedAt:'2026-09-17T09:00:00Z'},
  {id:'fixture-consulting',company:'Systems Ltd',title:'Implementation Consultant',location:'Dublin, Ireland',description:'English. Customer workshops, configuration and testing.',link:'https://example.org/consulting',source:'Arbeitnow'},
  {id:'fixture-us',company:'USA Ltd',title:'Implementation Consultant',location:'United States',description:'Customer implementation',link:'https://example.org/us',source:'Arbeitnow'}
];
async function setup(page) {await page.addInitScript(()=>{localStorage.setItem('job-notebook-international-v23','1');localStorage.setItem('job-notebook-discovery-v26','1');if(!localStorage.getItem('job-notebook-profile-v1'))localStorage.setItem('job-notebook-profile-v1',JSON.stringify({geography:'europe'}));});await mockListingTab(page);await page.route('**/api/jobs*',route => route.fulfill({json:{jobs,fetchedAt:new Date().toISOString()}}));await page.goto('/');await expect(page.locator('#active-card')).toBeVisible();}
async function mockListingTab(page) {await page.addInitScript(() => {window.openedListings=[];window.open=(url)=>{window.openedListings.push(url);return {opener:null};};});}
async function reviewSaved(page) {
  await expect(page.locator('#preparation-dialog')).not.toBeVisible();
  await expect.poll(async ()=>(await records(page)).filter(e=>e.status==='Preparing').length).toBeGreaterThan(0);
  const entry=(await records(page)).find(e=>e.status==='Preparing');
  await page.locator('.main-nav [data-view="notebook"]').click();
  await page.locator(`[data-edit="${entry.id}"]`).click();await page.locator('#edit-materials').click();
}
async function records(page) {return page.evaluate(() => JSON.parse(localStorage.getItem('job-notebook-v1')));}
test('HTTP network preview loads listings, supports reading and saving, and explains unavailable sync',async({page})=>{
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.route('http://preview.test/**',async route=>{
  const url=new URL(route.request().url());
  if(url.pathname==='/api/jobs')return route.fulfill({json:{jobs,nextPage:null,nextSearch:null}});
  await route.fulfill({response:await route.fetch({url:'http://127.0.0.1:4190'+url.pathname+url.search})});
 });
 await page.goto('http://preview.test/');
 expect(await page.evaluate(()=>isSecureContext)).toBe(false);
 await expect(page.locator('#active-card')).toContainText('Workflow Ltd');
 await expect(page.locator('#role-summary')).toContainText('Connect your saved setup');
 await page.locator('[data-read-role]').click();await expect(page.locator('.source-description')).toHaveAttribute('open','');
 await page.locator('#pass-job').click();await expect(page.locator('#active-card')).toContainText('Systems Ltd');
 await page.locator('[data-view="notebook"]').first().click();await page.locator('#add-button').click();
 await page.locator('#company').fill('Preview Company');await page.locator('#title').fill('Business Analyst');
 await page.getByRole('button',{name:'Save application',exact:true}).click();
 expect((await records(page)).some(e=>e.company==='Preview Company'&&e.id)).toBe(true);
 await page.locator('#backup-button').click();await page.locator('#device-open').click();
 await expect(page.locator('#device-content')).toContainText('HTTPS or localhost');
 await page.locator('#device-close').click();await page.reload();
 expect((await records(page)).some(e=>e.company==='Preview Company')).toBe(true);
 expect(errors).toEqual([]);
});
test('swipe, undo, preparation, review and submission preserve existing records',async ({page}) => {
  await setup(page); await expect(page.locator('#deck-count')).toHaveText('2 roles to explore');
  await page.locator('#pass-job').click(); await expect(page.locator('#active-card')).toContainText('Systems Ltd');
  await page.locator('#undo-swipe').click(); await expect(page.locator('#active-card')).toContainText('Workflow Ltd');
  await page.locator('#prepare-job').click(); await reviewSaved(page);await expect(page.locator('#preparation-dialog')).toBeVisible();
  await expect(page.locator('#mark-applied')).toBeDisabled();
  let data = await records(page); expect(data.find(e=>e.id==='fixture-ba').status).toBe('Preparing'); expect(data.find(e=>e.id==='deliverect').applicationDate).toBe('2026-09-15');
  await page.locator('#prep-pitch').fill('Reviewed introduction.'); await page.locator('#save-preparation').click();
  for (const checkbox of await page.locator('[data-check]').all()) await checkbox.check();
  await page.locator('#mark-applied').click();
  data = await records(page); expect(data.find(e=>e.id==='fixture-ba').status).toBe('Applied'); expect(data.find(e=>e.id==='fixture-ba').preparation.pitch).toBe('Reviewed introduction.');
  await page.reload(); await expect(page.locator('#active-card')).not.toContainText('Workflow Ltd');
  await page.locator('[data-view="notebook"]').first().click(); await expect(page.locator('.application-item')).toHaveCount(4);
  await page.locator('[data-edit="fixture-ba"]').click(); await page.locator('#notes').fill('Follow up next week');await page.getByRole('button',{name:'Save application',exact:true}).click();
  expect((await records(page)).find(e=>e.id==='fixture-ba').preparation.pitch).toBe('Reviewed introduction.');
});
test('next steps shows distinct stages and opens the matching notebook without changing records',async({page})=>{
 await page.setViewportSize({width:1440,height:969});
 await page.addInitScript(()=>localStorage.setItem('job-notebook-v1',JSON.stringify(['To apply','Preparing','Applied','Interview','Offer','Archived'].map((status,i)=>({id:'stage-'+i,company:'Stage '+i,title:'Business Analyst',status,followUpDate:'2020-01-01'})))));
 await setup(page);const before=await records(page);
 const sidebar=page.locator('.search-progress');await expect(sidebar).toBeVisible();
 for(const id of ['saved','preparing'])await expect(page.locator('#progress-'+id)).toHaveText('1');
 await page.locator('.main-nav [data-view="notebook"]').click();await page.locator('#search-input').fill('No matching company');
 await page.locator('.main-nav [data-view="discover"]').click();
 for(const [filter,company] of [['to apply','Stage 0'],['preparing','Stage 1']]){
  await sidebar.locator(`[data-notebook-filter="${filter}"]`).click();
  await expect(page.locator('#notebook-view')).toBeVisible();await expect(page.locator('#search-input')).toHaveValue('');
  await expect(page.locator('.application-item')).toHaveCount(1);await expect(page.locator('.application-item')).toContainText(company);
  await expect(page.locator(`.filter[data-filter="${filter}"]`)).toHaveClass(/active/);
  await page.locator('.main-nav [data-view="discover"]').click();
 }
 await sidebar.locator('[data-notebook-filter="follow-up"]').click();await expect(page.locator('.application-item')).toHaveCount(3);
 await page.locator('.main-nav [data-view="discover"]').click();
 await sidebar.locator('[data-notebook-filter="all"]').click();await expect(page.locator('.application-item')).toHaveCount(6);
 expect(await records(page)).toEqual(before);
 await page.locator('.main-nav [data-view="discover"]').click();await page.locator('#save-job').click();
 await expect(page.locator('#progress-saved')).toHaveText('2');await expect(page.locator('#progress-follow-up')).toHaveText('3');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.screenshot({path:'private/next-steps-desktop.png'});
});
test('follow-up dates persist, can be rescheduled or cleared, and do not change application status',async({page})=>{
 await page.setViewportSize({width:1440,height:969});await setup(page);
 await page.locator('.main-nav [data-view="notebook"]').click();
 await page.locator('[data-edit="deliverect"]').click();await page.locator('#follow-up-date').fill('2020-01-01');
 await page.getByRole('button',{name:'Save application',exact:true}).click();await page.reload();
 await page.locator('.main-nav [data-view="discover"]').click();await expect(page.locator('#progress-follow-up')).toHaveText('1');
 await page.locator('[data-notebook-filter="follow-up"]').click();await expect(page.locator('.application-item')).toHaveCount(1);await expect(page.locator('.application-item')).toContainText('Due');
 await page.locator('[data-edit="deliverect"]').click();await expect(page.locator('#follow-up-date')).toHaveValue('2020-01-01');
 await page.locator('#follow-up-date').fill('2099-01-01');await page.getByRole('button',{name:'Save application',exact:true}).click();await expect(page.locator('#empty-state')).toContainText('No follow-ups due');
 await page.locator('.filter[data-filter="all"]').click();await page.locator('[data-edit="deliverect"]').click();await page.locator('#follow-up-date').fill('');await page.getByRole('button',{name:'Save application',exact:true}).click();
 const entry=(await records(page)).find(e=>e.id==='deliverect');expect(entry.followUpDate).toBe('');expect(entry.status).toBe('Applied');
});
test('actual drag works on mobile and card title stays below company row',async ({page}) => {
  await page.setViewportSize({width:390,height:844}); await setup(page);
  const line = await page.locator('.company-line').boundingBox(), title = await page.locator('#active-card h2').boundingBox();expect(title.y).toBeGreaterThanOrEqual(line.y+line.height);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  const card = await page.locator('.card-top').boundingBox();await page.mouse.move(card.x+60,card.y+80);await page.mouse.down();await page.mouse.move(card.x+195,card.y+80,{steps:12});await page.mouse.up();
  await reviewSaved(page);await expect(page.locator('#preparation-dialog')).toBeVisible();
});
test('profile setup imports PDFs locally and chooses the BA CV',async ({page}) => {
  await setup(page);await page.locator('[data-view="profile"]').first().click();
  const bundle={profile:{name:'Test Applicant',email:'test@example.org',evidence:'Delivered a project in 1.5 months.',workRights:'Employment permit required.',startDate:'2027-01-01'},cvs:{analyst:{name:'BA.pdf',base64:Buffer.from('%PDF-1.4\n%%EOF').toString('base64')}}};
  await page.locator('#profile-import').setInputFiles({name:'setup.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(bundle))});
  await expect(page.locator('#profile-message')).toContainText('with 1 CV PDFs');await expect(page.locator('#analyst-file-status')).toContainText('BA.pdf');
  await page.locator('[data-view="discover"]').first().click();await page.locator('#prepare-job').click();await reviewSaved(page);await expect(page.locator('#prep-pitch')).toContainText('Test Applicant');await expect(page.locator('#prep-cv-status')).toContainText('BA.pdf');
  const downloadPromise = page.waitForEvent('download');await page.locator('#download-cv').click();const download=await downloadPromise;expect(download.suggestedFilename()).toBe('BA.pdf');
});
test('old notebook migration preserves custom records and progressed statuses',async ({page}) => {
  await page.addInitScript(() => {if (!localStorage.getItem('job-notebook-v1')) localStorage.setItem('job-notebook-v1',JSON.stringify([{id:'deliverect',company:'Deliverect',title:'Implementation Consultant',status:'To apply'},{id:'allianz',company:'Allianz',title:'Technical Business Analyst',status:'Interview'},{id:'custom',company:'Personal',title:'Custom role',status:'Offer',notes:'Keep me'}]));});
  await setup(page);const data=await records(page);expect(data.find(e=>e.id==='deliverect').status).toBe('Applied');expect(data.find(e=>e.id==='allianz').status).toBe('Interview');expect(data.find(e=>e.id==='custom').notes).toBe('Keep me');
});
test('malformed restore leaves existing records intact, original v1 restore works',async ({page}) => {
  await setup(page);await page.locator('#backup-button').click();const before=await records(page);
  await page.locator('#import-input').setInputFiles({name:'bad.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({entries:[{company:'oops'}]}))});await expect(page.locator('#backup-message')).toContainText('not a valid');expect(await records(page)).toEqual(before);
  page.on('dialog',dialog=>dialog.accept());const entries=[{id:'legacy',company:'Legacy Ltd',title:'Business Analyst',status:'To apply',notes:'Restored notes'}];
  await page.locator('#import-input').setInputFiles({name:'old.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({version:1,entries}))});await expect(page.locator('#backup-message')).toContainText('Backup restored');expect((await records(page))[0].notes).toBe('Restored notes');
});
test('feed failures leave notebook usable and hostile feed text never executes',async ({page}) => {
  await page.route('**/api/jobs*',r=>r.fulfill({status:503,json:{error:'Unavailable'}}));await page.goto('/');await expect(page.locator('#feed-status')).toContainText('Couldn’t refresh');
  await page.locator('[data-view="notebook"]').first().click();await expect(page.locator('.application-item')).toHaveCount(3);
  await page.unroute('**/api/jobs*');await page.route('**/api/jobs*',r=>r.fulfill({json:{jobs:[{...jobs[0],company:'<img src=x onerror="window.pwned=true">'}],fetchedAt:new Date().toISOString()}}));await page.locator('[data-view="discover"]').first().click();await page.locator('#refresh-jobs').click();await expect(page.locator('#active-card')).toBeVisible();expect(await page.evaluate(()=>window.pwned)).toBeUndefined();expect(await page.locator('#active-card img').count()).toBe(0);
});
test('autofill handles ATS-style labels without overwriting or touching consent, files, sponsorship or submission',async ({page}) => {
  await page.goto('/');await page.setContent(`<form id="application"><label>First Name *<input name="first_name"></label><label>Last name<input name="last_name"></label><label>Email<input type="email" value="keep@example.org"></label><label>Phone<input name="phone"></label><label>LinkedIn Profile<input name="urls[LinkedIn]"></label><label>Cover letter<textarea></textarea></label><label>Reference name<input name="name"></label><label>Sponsorship required<input name="sponsor"></label><input type="file"><input type="checkbox"><button type="submit">Submit</button></form>`);
  await page.addScriptTag({content:await readFile('autofill-extension/fill.js','utf8')});
  const result=await page.evaluate(()=>{window.submitted=false;document.querySelector('form').addEventListener('submit',e=>{e.preventDefault();window.submitted=true;});return fillApplicationFields({name:'Test Applicant',email:'new@example.org',phone:'12345',linkedin:'https://linkedin.com/in/test',coverLetter:'Verified intro'});});
  expect(result.count).toBe(5);await expect(page.locator('[name="first_name"]')).toHaveValue('Test');await expect(page.locator('[type="email"]')).toHaveValue('keep@example.org');await expect(page.locator('[name="name"]')).toHaveValue('');await expect(page.locator('[name="sponsor"]')).toHaveValue('');await expect(page.locator('[type="checkbox"]')).not.toBeChecked();expect(await page.evaluate(()=>window.submitted)).toBe(false);
});
test('installed app opens offline with saved applications and feed',async ({browser}) => {
  const context = await browser.newContext({serviceWorkers:'allow'}); const page = await context.newPage();
  await setup(page);await page.evaluate(()=>navigator.serviceWorker.ready);await page.reload();
  await expect(page.locator('#active-card')).toBeVisible();await page.locator('#save-job').click();
  await context.setOffline(true);await page.reload();await page.locator('[data-view="notebook"]').first().click();await expect(page.locator('.application-item')).toHaveCount(4);await expect(page.locator('#applications')).toContainText('Workflow Ltd');
  await context.close();
});

for (const [width,height] of [[320,568],[360,640],[375,667],[390,844],[430,932],[768,1024]]) {
  test(`phone layout keeps decisions and navigation reachable at ${width}×${height}`,async ({page}) => {
    await page.setViewportSize({width,height});await setup(page);
    const layout=await page.evaluate(()=>{
      const nav=document.querySelector('.main-nav').getBoundingClientRect();
      const actions=[...document.querySelectorAll('.swipe-button')].map(el=>{const r=el.getBoundingClientRect();return {top:r.top,bottom:r.bottom,width:r.width,height:r.height,hit:el.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2))};});
      return {width:document.documentElement.scrollWidth,height:document.documentElement.scrollHeight,navTop:nav.top,navBottom:nav.bottom,actions};
    });
    expect(layout.width).toBeLessThanOrEqual(width);expect(layout.height).toBeLessThanOrEqual(height+1);expect(layout.navBottom).toBe(height);
    for (const action of layout.actions) {expect(action.top).toBeGreaterThan(0);expect(action.bottom).toBeLessThanOrEqual(layout.navTop);expect(action.width).toBeGreaterThanOrEqual(44);expect(action.height).toBeGreaterThanOrEqual(44);expect(action.hit).toBe(true);}
    await page.getByRole('button',{name:/Job fit, rating and recommended CV/}).click();await expect(page.locator('#role-dialog')).toBeVisible();
    await expect(page.locator('#role-content')).toContainText('Work rights and permit support are unconfirmed.');
    const footer=await page.locator('#role-prepare').boundingBox();expect(footer.y+footer.height).toBeLessThanOrEqual(height);
    await page.locator('#close-role').click();await page.locator('.main-nav [data-view="profile"]').click();
    await expect(page.locator('#profile-view')).toBeVisible();
    await page.locator('#profile-email').scrollIntoViewIfNeeded();expect(await page.locator('#profile-email').evaluate(el=>parseFloat(getComputedStyle(el).fontSize))).toBeGreaterThanOrEqual(16);
    await page.locator('#profile-phone').fill('+49 123');await page.getByRole('button',{name:'Save my profile',exact:true}).click();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  });
}
test('third CV imports, downloads and can be selected without losing draft edits',async ({page}) => {
  await page.setViewportSize({width:390,height:844});await setup(page);await page.locator('.main-nav [data-view="profile"]').click();
  const pdf=Buffer.from('%PDF-1.4\nThird CV contents\n%%EOF');
  const bundle={profile:{name:'Test Applicant',developerCV:'Full_Stack.pdf'},cvs:Object.fromEntries(['consulting','analyst','developer'].map(key=>[key,{name:key==='developer'?'Full_Stack.pdf':key+'.pdf',base64:pdf.toString('base64')}]))};
  await page.locator('#profile-import').setInputFiles({name:'setup.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(bundle))});
  await expect(page.locator('#profile-message')).toContainText('with 3 CV PDFs');await expect(page.locator('#developer-file-status')).toContainText('Full_Stack.pdf');
  const downloadPromise=page.waitForEvent('download');await page.locator('#developer-download').click();const downloaded=await downloadPromise;expect(downloaded.suggestedFilename()).toBe('Full_Stack.pdf');expect(await readFile(await downloaded.path())).toEqual(pdf);
  await page.locator('.main-nav [data-view="discover"]').click();await page.locator('#prepare-job').click();await reviewSaved(page);await page.locator('#prep-pitch').fill('Keep my edited draft.');await page.locator('#prep-cv-choice').selectOption('Full Stack Developer CV');
  await expect(page.locator('#prep-pitch')).toHaveValue('Keep my edited draft.');await expect(page.locator('#prep-cv-status')).toContainText('Full_Stack.pdf');
  expect((await records(page)).find(e=>e.id==='fixture-ba').preparation.cv).toBe('Full Stack Developer CV');
});
test('long role names and all review flags remain available on a small screen',async ({page}) => {
  await mockListingTab(page);await page.setViewportSize({width:320,height:568});const longTitle='Business Systems Specialist — Enterprise Applications, Customer Workflows and Service Delivery';
  const description='English. Stakeholder workshops, workflows, ERP configuration and rollout testing. Fluent German required. No visa sponsorship.';
  await page.route('**/api/jobs*',r=>r.fulfill({json:{jobs:[{...jobs[0],title:longTitle,description}],fetchedAt:new Date().toISOString()}}));await page.goto('/');
  await expect(page.locator('#active-card')).toContainText('From the employer’s listing');await page.getByRole('button',{name:/Job fit, rating and recommended CV/}).click();
  await expect(page.locator('.role-heading')).toHaveText(longTitle);await expect(page.locator('#role-content .flag-box')).not.toContainText('German');await expect(page.locator('#role-content')).toContainText('Pay is not stated');await expect(page.locator('.inline-role')).toContainText('Fluent German required');
  expect(await page.locator('#role-dialog').evaluate(el=>el.scrollWidth)).toBeLessThanOrEqual(320);
  await page.locator('#role-prepare').click();await reviewSaved(page);await expect(page.locator('#preparation-dialog')).toBeVisible();await expect(page.locator('#preparation-title')).toHaveText('Workflow Ltd');
});
test('touch scrolling stays inside the card and a horizontal touch prepares the role',async ({browser}) => {
  const context=await browser.newContext({viewport:{width:375,height:667},isMobile:true,hasTouch:true,serviceWorkers:'block'});const page=await context.newPage();await setup(page);
  const client=await context.newCDPSession(page);const card=await page.locator('#active-card').boundingBox();
  const x=card.x+80,y=card.y+60;
  await client.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]});
  for(let n=1;n<=8;n++) await client.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x+n*17,y}]});
  await client.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  await reviewSaved(page);await expect(page.locator('#preparation-dialog')).toBeVisible();
  await page.locator('#close-preparation').click();await page.locator('.main-nav [data-view="discover"]').click();await page.locator('#undo-swipe').click();
  await client.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:180,y:card.y+card.height-85}]});
  for(let n=1;n<=6;n++) await client.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:180,y:card.y+card.height-85-n*17}]});
  await client.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  await expect(page.locator('#preparation-dialog')).not.toBeVisible();expect(await page.evaluate(()=>window.scrollY)).toBe(0);
  expect(await page.locator('#active-card').evaluate(el=>el.scrollTop)).toBeGreaterThan(0);
  await context.close();
});

for (const [width,height] of [[384,832],[393,852],[412,892],[384,720],[832,384],[892,412],[915,412],[740,320]]) {
  test(`Galaxy-size workspace has reachable controls at ${width}×${height}`,async ({browser}) => {
    const context=await browser.newContext({viewport:{width,height},deviceScaleFactor:2.625,isMobile:true,hasTouch:true,serviceWorkers:'block'});
    const page=await context.newPage();await setup(page);
    const layout=await page.evaluate(()=>{
      const rect=el=>{const r=el.getBoundingClientRect();return {x:r.x,y:r.y,right:r.right,bottom:r.bottom,width:r.width,height:r.height,hit:el.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2))};};
      return {width:document.documentElement.scrollWidth,height:document.documentElement.scrollHeight,nav:rect(document.querySelector('.main-nav')),top:rect(document.querySelector('.card-top')),body:rect(document.querySelector('.card-body')),controls:[...document.querySelectorAll('.swipe-button,.nav-button,#active-card .text-button')].filter(el=>el.checkVisibility()).map(rect)};
    });
    expect(layout.width).toBeLessThanOrEqual(width);expect(layout.height).toBeLessThanOrEqual(height+1);
    for(const control of layout.controls){expect(control.x).toBeGreaterThanOrEqual(0);expect(control.bottom).toBeLessThanOrEqual(height);expect(control.right).toBeLessThanOrEqual(width);expect(control.width).toBeGreaterThanOrEqual(44);expect(control.height).toBeGreaterThanOrEqual(44);expect(control.hit).toBe(true);}
    if(width<height && height>=780) {expect(await page.locator('.listing-info').evaluate(el=>{const r=el.getBoundingClientRect();return el.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));})).toBe(true);}
    if(width>height){expect(layout.nav.width).toBeLessThan(width*.15);expect(layout.body.x).toBeGreaterThan(layout.top.x);expect(layout.body.y).toBe(layout.top.y);}else{expect(layout.body.y).toBeGreaterThan(layout.top.y);}
    await page.locator('#prepare-job').click();await reviewSaved(page);await expect(page.locator('#preparation-dialog')).toBeVisible();await page.locator('#prep-pitch').fill('Keep this draft when I rotate.');
    await page.setViewportSize({width:height,height:width});await expect(page.locator('#prep-pitch')).toHaveValue('Keep this draft when I rotate.');
    await page.locator('#save-preparation').click();expect((await records(page)).find(e=>e.id==='fixture-ba').preparation.pitch).toBe('Keep this draft when I rotate.');
    await context.close();
  });
}
test('rotation preserves the role and a burst of decisions only passes it once',async ({page})=>{
  await page.setViewportSize({width:384,height:832});await setup(page);
  await page.setViewportSize({width:832,height:384});await expect(page.locator('#active-card')).toContainText('Workflow Ltd');
  await page.evaluate(()=>{document.querySelector('#pass-job').click();document.querySelector('#pass-job').click();document.querySelector('#save-job').click();});
  await expect(page.locator('#active-card')).toContainText('Systems Ltd');
  expect(await page.evaluate(()=>Object.keys(JSON.parse(localStorage.getItem('job-notebook-discovery-v1')).decisions).length)).toBe(1);
});
test('reduced motion still saves and prepares applications',async ({page})=>{
  await page.emulateMedia({reducedMotion:'reduce'});await setup(page);await page.locator('#prepare-job').click();await reviewSaved(page);await expect(page.locator('#preparation-dialog')).toBeVisible();expect((await records(page)).find(e=>e.id==='fixture-ba').status).toBe('Preparing');
});

test('app refresh reloads the latest shell and preserves saved records and PDFs',async ({browser})=>{
  const context=await browser.newContext({viewport:{width:384,height:832},serviceWorkers:'allow'});const page=await context.newPage();await setup(page);
  await page.locator('[data-view="profile"]').first().click();
  await page.locator('#analyst-upload').setInputFiles({name:'Keep.pdf',mimeType:'application/pdf',buffer:Buffer.from('%PDF-1.4\n%%EOF')});await expect(page.locator('#analyst-file-status')).toContainText('Keep.pdf');
  const before=await records(page);await page.locator('#refresh-app').click();await page.waitForURL(/app-refresh=/);
  await expect(page.locator('#analyst-file-status')).toContainText('Keep.pdf');expect(await records(page)).toEqual(before);
  await context.setOffline(true);await page.locator('#refresh-app').click();await expect(page.locator('#toast')).toContainText('Couldn’t update');await expect(page.locator('#refresh-app')).toBeEnabled();expect(await records(page)).toEqual(before);
  await context.close();
});
test('phone reading text and app refresh remain readable and reachable',async ({page})=>{
  await page.setViewportSize({width:384,height:832});await setup(page);
  for(const selector of ['.inline-role p','.job-location'])expect(await page.locator(selector).first().evaluate(el=>parseFloat(getComputedStyle(el).fontSize))).toBeGreaterThanOrEqual(16);
  for(const [width,height] of [[320,568],[384,832],[832,384]]){await page.setViewportSize({width,height});expect(await page.locator('#refresh-app').evaluate(el=>{const r=el.getBoundingClientRect();return r.width>=44&&r.height>=44&&el.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));})).toBe(true);}
});

test('role text is inline, uncertainties are in the header, and Apply opens the original site without a notebook form',async ({page})=>{
  await setup(page);await expect(page.locator('.inline-role')).toContainText(jobs[0].description);
  await expect(page.locator('.match-badge')).toHaveCount(0);await expect(page.locator('.fit-list')).toHaveCount(0);
  await expect(page.locator('.card-top .listing-info')).toBeVisible();await expect(page.locator('.role-checks')).toHaveCount(0);
  await page.locator('#prepare-job').click();await expect.poll(()=>page.evaluate(()=>window.openedListings)).toEqual([jobs[0].link]);
  await expect(page.locator('#preparation-dialog')).not.toBeVisible();
  const entry=(await records(page)).find(e=>e.id===jobs[0].id);expect(entry.materials).toBe('Business Analyst CV');expect(entry.status).toBe('Preparing');expect(entry.applicationDate).toBe('');
});

test('Apply opens a real separate tab with no opener and retains the notebook',async ({page,context})=>{
  await context.route('https://example.org/**',r=>r.fulfill({contentType:'text/html',body:'<h1>Employer application</h1>'}));
  await page.route('**/api/jobs*',r=>r.fulfill({json:{jobs,fetchedAt:new Date().toISOString()}}));await page.goto('/');await expect(page.locator('#active-card')).toBeVisible();
  const popupPromise=page.waitForEvent('popup');await page.locator('#prepare-job').click();const popup=await popupPromise;await popup.waitForLoadState();
  expect(popup.url()).toBe(jobs[0].link);expect(await popup.evaluate(()=>window.opener)).toBe(null);await expect(page.locator('#preparation-dialog')).not.toBeVisible();
  expect((await records(page)).find(e=>e.id===jobs[0].id).status).toBe('Preparing');await popup.close();
});

test('touch tablet keeps the whole deck usable without desktop-width magnification',async ({browser})=>{
  const context=await browser.newContext({viewport:{width:768,height:1024},isMobile:true,hasTouch:true,serviceWorkers:'block'});const page=await context.newPage();await setup(page);
  expect(await page.locator('#active-card').evaluate(el=>el.getBoundingClientRect().height)).toBeGreaterThan(300);
  await page.locator('[data-read-role]').click();await expect(page.locator('.inline-role')).toContainText(jobs[0].description);await context.close();
});
test('connected swipe sends the selected PDF privately and never marks a failed preparation applied',async({page})=>{
 await setup(page);await page.locator('[data-view="profile"]').first().click();
 const token='test-connection-token-'.padEnd(43,'x');
 const bundle={automationToken:token,profile:{name:'Test Applicant',email:'test@example.org'},cvs:{analyst:{name:'BA.pdf',base64:Buffer.from('%PDF-1.4\n%%EOF').toString('base64')}}};
 await page.locator('#profile-import').setInputFiles({name:'setup.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(bundle))});
 await expect(page.locator('#browser-connection-status')).toContainText('connected on this device');
 let sent;await page.route('**/api/prepare',async route=>{sent={headers:route.request().headers(),body:route.request().postDataJSON()};await route.fulfill({status:400,json:{error:'Unsupported employer form. Use Open original.'}});});
 await page.locator('[data-view="discover"]').first().click();await page.locator('#prepare-job').click();
 await expect(page.locator('#browser-progress')).toContainText('Unsupported employer form');
 expect(sent.headers.authorization).toBe('Bearer '+token);expect(sent.body.cv.name).toBe('BA.pdf');expect(sent.body.fields.email).toBe('test@example.org');
 expect((await records(page)).find(e=>e.id==='fixture-ba').status).toBe('Preparing');expect(await page.evaluate(()=>window.openedListings)).toEqual([]);
 expect(await page.evaluate(()=>JSON.stringify(localStorage))).not.toContain(token);
 await page.locator('#browser-end').click();await expect(page.locator('#browser-dialog')).not.toBeVisible();
 await page.locator('[data-view="profile"]').first().click();await page.locator('#disconnect-browser').click();await expect(page.locator('#test-browser')).toBeDisabled();
});
test('practice inspection reports unchecked required consent without changing it',async({page})=>{
 const {inspectForm}=await import('../server/fields.js');await page.goto('/practice-application.html');
 await page.locator('input[type="checkbox"]').evaluate(el=>el.required=true);
 const scan=await page.evaluate(inspectForm);expect(scan.fields.find(f=>f.type==='checkbox').filled).toBe(false);
 expect(await page.evaluate(()=>window.practiceSubmitted)).toBe(false);
});
test('summary checks and missing-requirement sheet are readable on a Galaxy-sized screen',async({page})=>{
 await page.setViewportSize({width:412,height:892});await page.route('**/api/jobs*',r=>r.fulfill({json:{jobs:[{...jobs[0],description:'Responsibilities:\nAnalyse requirements and implement API integrations.\nRequirements:\nGerman B2 required.\nBenefits:\nFlexible working hours and 30 days annual leave.'}]}}));
 await page.goto('/');await page.locator('.qualification-details > summary').click();await expect(page.locator('.qualification.gap')).toContainText('German B2');await page.locator('.source-description > summary').click();await expect(page.locator('.source-description')).toContainText('30 days');await page.locator('.source-description > summary').click();
 await expect(page.locator('.source-description')).not.toHaveAttribute('open','');
 await page.locator('.listing-info').click();await expect(page.locator('#role-content .flag-box')).not.toContainText('German');await expect(page.locator('.qualification.gap')).toContainText('B1');
 for(const selector of ['#role-content .role-heading','#role-content .prep-meta','#role-content li'])expect(await page.locator(selector).first().evaluate(el=>parseFloat(getComputedStyle(el).fontSize))).toBeGreaterThanOrEqual(19);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
test('private connection loads all CVs without file uploads and removes the token from the URL',async({page})=>{
 await page.route('**/api/jobs*',r=>r.fulfill({json:{jobs:[]}}));
 const cv={name:'Saved.pdf',base64:Buffer.from('%PDF-1.4\n%%EOF').toString('base64')};const token='private-test-'.padEnd(43,'x');
 await page.route('**/api/setup',r=>{expect(r.request().headers().authorization).toBe('Bearer '+token);return r.fulfill({json:{profile:{name:'Saved Applicant',email:'saved@example.org'},cvs:{consulting:cv,analyst:cv,developer:cv}}});});
 await page.goto('/#connect='+token);await expect(page.locator('#saved-cv-status')).toContainText('All three saved CVs');expect(page.url()).not.toContain(token);
 for(const type of ['consulting','analyst','developer'])await expect(page.locator('#'+type+'-file-status')).toContainText('Saved.pdf');
});
test('larger text, rotation, and returning from requirements keep the decision usable',async({page})=>{
 await page.setViewportSize({width:412,height:892});await setup(page);
 await page.evaluate(()=>document.documentElement.style.fontSize='200%');
 await page.locator('.listing-info').click();await expect(page.locator('#role-content')).toBeVisible();
 const font=await page.locator('#role-content li').first().evaluate(el=>parseFloat(getComputedStyle(el).fontSize));expect(font).toBeGreaterThanOrEqual(38);
 expect(await page.locator('#close-role').evaluate(el=>{const r=el.getBoundingClientRect();return r.top>=0&&r.bottom<=innerHeight&&r.right<=innerWidth;})).toBe(true);
 await page.screenshot({path:'private/requirements-large-text.png'});
 await page.keyboard.press('Escape');await page.setViewportSize({width:892,height:412});
 await expect(page.locator('#prepare-job')).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.evaluate(()=>document.documentElement.style.fontSize='');
 await page.setViewportSize({width:412,height:892});await page.locator('[data-read-role]').click();await page.screenshot({path:'private/role-summary-phone.png'});
 await page.locator('.listing-info').click();await page.screenshot({path:'private/requirements-phone.png'});
 await page.keyboard.press('Escape');await page.locator('#save-job').click();await page.locator('[data-view="notebook"]').first().click();expect((await records(page)).some(e=>e.id==='fixture-ba')).toBe(true);
});
test('automatic CV recovery preserves a newer local PDF and edited profile',async({page})=>{
 await setup(page);await page.locator('[data-view="profile"]').first().click();
 const base64=Buffer.from('%PDF-1.4\n%%EOF').toString('base64');const token='restore-test-'.padEnd(43,'x');
 await page.locator('#profile-import').setInputFiles({name:'local.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({automationToken:token,profile:{name:'Edited Name',email:'edited@example.org'},cvs:{consulting:{name:'Newer-local.pdf',base64}}}))});
 await expect(page.locator('#consulting-file-status')).toContainText('Newer-local.pdf');
 await page.route('**/api/setup',r=>r.fulfill({json:{profile:{name:'Server Name',email:'server@example.org'},cvs:{consulting:{name:'Old-server.pdf',base64},analyst:{name:'BA.pdf',base64},developer:{name:'Dev.pdf',base64}}}}));
 await page.reload();await expect(page.locator('#saved-cv-status')).toContainText('All three saved CVs');
 await expect(page.locator('#consulting-file-status')).toContainText('Newer-local.pdf');await expect(page.locator('#profile-name')).toHaveValue('Edited Name');
 await expect(page.locator('#analyst-file-status')).toContainText('BA.pdf');
});

test('Back Market opens with a short synopsis, keeping the long checklist and source optional',async({page})=>{
 const summary={overview:'Help marketplace sellers get started, analyse their performance in Excel and Salesforce, and improve onboarding processes.',essentials:'Six months from January 2027. French-school internship agreement, fluent English and Excel pivot tables required. French and Salesforce are bonuses.',benefits:'€1,200–€1,400/month; two remote days weekly, one remote week quarterly and three flex days.'};
 await page.addInitScript(({job,summary})=>localStorage.setItem('job-notebook-summaries-v1',JSON.stringify({[job.id]:{source:JSON.stringify([job.title,job.location,job.description]),summary}})),{job:sellerIntern,summary});
 await page.setViewportSize({width:412,height:892});await page.route('**/api/jobs*',r=>r.fulfill({json:{jobs:[sellerIntern]}}));await page.goto('/');
 await expect(page.locator('#active-card')).toBeVisible();await expect(page.locator('.match-badge')).toHaveCount(0);
 await expect(page.locator('#role-summary')).toContainText('French-school internship agreement');
 await expect(page.locator('#role-summary')).toContainText('Excel and Salesforce');
 expect((await page.locator('#role-summary').innerText()).split(/\s+/).length).toBeLessThan(110);
 await expect(page.locator('.qualification-list')).not.toBeVisible();
 await expect(page.locator('.source-description')).not.toHaveAttribute('open','');
 await page.locator('.qualification-details > summary').click();
 await expect(page.locator('.qualification-list')).toContainText('pivot tables');await expect(page.locator('.qualification-list')).toContainText('Fluent English');
 await expect(page.locator('.qualification-list')).not.toContainText('German');
 await page.locator('.qualification-details > summary').click();
 await page.locator('[data-read-role]').click();await page.screenshot({path:'private/backmarket-short-summary.png'});
 await page.locator('.listing-info').click();await expect(page.locator('#role-content')).toContainText('permit support');await expect(page.locator('#role-content .flag-box')).not.toContainText('German');
});

test('a missing summary never expands the listing as a fallback',async({page})=>{
 await page.route('**/api/jobs*',r=>r.fulfill({json:{jobs:[sellerIntern]}}));await page.goto('/');
 await expect(page.locator('#role-summary')).toContainText('Connect your saved setup');
 await expect(page.locator('.qualification-list')).not.toBeVisible();
 await expect(page.locator('.source-description p:not(.source-note)')).not.toBeVisible();
});

test('qualification comparison shows evidence, partial matches and gaps and updates from the profile',async({page})=>{
 await page.setViewportSize({width:390,height:844});
 const role={...jobs[0],description:'Requirements:\nAPI integrations experience.\nExcel and SQL experience.\nGerman B2.\nFrench B2.\nPreferred Qualifications:\nSalesforce experience.\nBenefits:\n30 days leave.'};
 await page.route('**/api/jobs*',r=>r.fulfill({json:{jobs:[role],nextPage:null,nextSearch:null}}));
 await page.goto('/');await page.locator('.qualification-details > summary').click();
 await expect(page.locator('.profile-evidence-notice')).toContainText('experience is empty');
 await page.locator('[data-edit-evidence]').click();await expect(page.locator('#profile-evidence')).toBeFocused();
 await page.locator('#profile-evidence').fill('Delivered API integrations for customers. Excel reporting.');
 await page.getByRole('button',{name:'Save my profile',exact:true}).click();
 await page.locator('[data-view="discover"]').first().click();
 if(!await page.locator('.qualification-details').evaluate(el=>el.open))await page.locator('.qualification-details > summary').click();
 await expect(page.locator('.qualification-overview')).toHaveText('1 supported · 1 partly supported · 1 gap · 1 to check');
 await expect(page.locator('.qualification.match')).toContainText('Delivered API integrations for customers.');
 await expect(page.locator('.qualification.partial')).toContainText('Add a concrete example of your SQL experience.');
 await expect(page.locator('.qualification.gap')).toContainText('Requires B2; your saved level is B1.');
 await expect(page.locator('.qualification.unknown').filter({hasText:'French'})).toContainText('French level is not recorded');
 await expect(page.locator('.qualification.unknown').filter({hasText:'Salesforce'})).toContainText('Optional bonus');
 await expect(page.locator('.qualification-list')).not.toContainText('30 days leave');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.locator('.qualification-overview').evaluate(el=>el.scrollIntoView({block:'start'}));await page.screenshot({path:'private/qualification-comparison-phone.png'});
 await page.locator('[data-edit-evidence]').click();await page.locator('#profile-evidence').fill('Delivered API integrations for customers. Excel and SQL reporting.');
 await page.getByRole('button',{name:'Save my profile',exact:true}).click();await page.locator('[data-view="discover"]').first().click();
 if(!await page.locator('.qualification-details').evaluate(el=>el.open))await page.locator('.qualification-details > summary').click();
 await expect(page.locator('.qualification.match')).toHaveCount(2);await expect(page.locator('.qualification.partial')).toHaveCount(0);
 await page.locator('.source-description > summary').click();await expect(page.locator('.source-description')).toContainText('30 days leave');
});

test('listings without usable requirements explain what is missing and keep the full advert accessible',async({page})=>{
 await page.route('**/api/jobs*',r=>r.fulfill({json:{jobs:[{...jobs[0],description:'We build software for shops.'}],nextPage:null,nextSearch:null}}));
 await page.goto('/');await page.locator('.qualification-details > summary').click();
 await expect(page.locator('.qualification-empty')).toContainText('isn’t enough requirement text');
 await expect(page.locator('.qualification-details')).not.toContainText('Supported by your saved details');
 await page.locator('[data-read-role]').click();await expect(page.locator('.source-description')).toContainText('We build software for shops.');
});

test('fit button explains the score, practical factors and recommended PDF without changing application status',async({page})=>{
 await page.setViewportSize({width:390,height:844});
 await page.addInitScript(()=>localStorage.setItem('job-notebook-profile-v1',JSON.stringify({geography:'europe',evidence:'API integrations and SQL reporting.',languages:'English C1, German B1',germanLevel:'B1',analystCV:'Filename-only.pdf'})));
 await page.route('**/api/jobs*',r=>r.fulfill({json:{jobs:[{...jobs[0],description:'Requirements:\nAPI integrations experience.\nSQL experience.\nGerman B2.\nBenefits:\nSalary: 60000 EUR annual.\nHybrid working.'}],nextPage:null,nextSearch:null}}));
 await page.goto('/');await expect(page.locator('#active-card')).toBeVisible();const before=await records(page);
 await page.getByRole('button',{name:'Job fit, rating and recommended CV',exact:true}).click();
 await expect(page.locator('.fit-score')).toHaveText('6.5 / 10');await expect(page.locator('.fit-coverage')).toContainText('3 of 3');
 await expect(page.locator('.fit-rating')).toContainText('not your probability');await expect(page.locator('.fit-cv-name')).toHaveText('Business Analyst CV');
 await expect(page.locator('#fit-cv-status')).toContainText('No PDF saved');await expect(page.locator('#fit-download-cv')).toBeHidden();
 await expect(page.locator('[data-factor="eligibility"]')).toContainText('unconfirmed');
 await page.locator('[data-factor="pay"] summary').click();await expect(page.locator('[data-factor="pay"]')).toContainText('60000 EUR');
 expect(await records(page)).toEqual(before);
 await page.locator('#close-role').click();
 await page.evaluate(async()=>{const {setItem}=await import('/lib/device-store.js');await setItem('analyst',{name:'Actual-analyst.pdf',blob:new Blob(['%PDF-1.4\n%%EOF'],{type:'application/pdf'})});});
 await page.locator('.listing-info').click();await expect(page.locator('#fit-cv-status')).toContainText('Actual-analyst.pdf');
 const download=page.waitForEvent('download');await page.locator('#fit-download-cv').click();expect((await download).suggestedFilename()).toBe('Actual-analyst.pdf');
 await page.locator('#role-content').evaluate(el=>el.scrollTop=0);await page.screenshot({path:'private/job-fit-phone.png'});
 expect(await page.locator('#role-dialog').evaluate(el=>el.scrollWidth<=innerWidth)).toBe(true);
 await page.locator('#fit-show-checks').click();await expect(page.locator('#role-dialog')).not.toBeVisible();await expect(page.locator('.qualification-details')).toHaveAttribute('open','');
});

test('generated summaries stay with their own role and are reused after undo and reload',async({page})=>{
 let releaseFirst;const pendingFirst=new Promise(resolve=>releaseFirst=resolve);let calls=0;
 await page.route('**/api/summary',async route=>{
  calls++;const job=route.request().postDataJSON();
  expect(Object.keys(job).sort()).toEqual(['description','location','title']);
  if(job.title===jobs[0].title)await pendingFirst;
  await route.fulfill({json:{summary:{overview:'Summary for '+job.title,essentials:'Check stated requirements.',benefits:'Not stated.',evidence:[]}}});
 });
 await setup(page);await page.locator('[data-view="profile"]').first().click();
 await page.locator('#profile-import').setInputFiles({name:'setup.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({automationToken:'summary-test-'.padEnd(43,'x'),profile:{name:'Test Applicant',email:'test@example.org',geography:'europe'}}))});
 await expect.poll(()=>calls).toBe(1);
 await page.locator('[data-view="discover"]').first().click();await page.locator('#pass-job').click();
 releaseFirst();await expect(page.locator('#role-summary')).toContainText('Summary for Implementation Consultant');
 await expect(page.locator('#role-summary')).not.toContainText('Technical Business Analyst');
 await page.locator('#undo-swipe').click();await expect(page.locator('#role-summary')).toContainText('Summary for Technical Business Analyst');
 await page.reload();await expect(page.locator('#role-summary')).toContainText('Summary for Technical Business Analyst');expect(calls).toBe(2);
});

test('loads later pages before the deck empties without moving the current card or repeating passed roles',async({page})=>{
 const first=Array.from({length:6},(_,i)=>({...jobs[0],id:'page-one-'+i,company:'Employer '+i,link:'https://example.org/role-'+i}));
 let release;const wait=new Promise(resolve=>release=resolve);let laterCalls=0;
 await page.route('**/api/jobs*',async route=>{
  if(new URL(route.request().url()).searchParams.get('page')==='4'){
   laterCalls++;await wait;
   return route.fulfill({json:{jobs:[{...first[0],id:'duplicate-on-another-source'},...Array.from({length:3},(_,i)=>({...jobs[0],id:'later-'+i,company:'Later '+i,link:'https://example.org/later-'+i}))],nextPage:null}});
  }
  return route.fulfill({json:{jobs:first,nextPage:4}});
 });
 await page.goto('/');await expect(page.locator('#deck-count')).toHaveText('6 roles to explore');expect(laterCalls).toBe(0);
 await page.locator('#pass-job').click();await expect(page.locator('#deck-count')).toHaveText('5 roles to explore');
 await page.locator('#pass-job').click();await expect.poll(()=>laterCalls).toBe(1);
 const current=await page.locator('#active-card').getAttribute('data-job-id');
 await page.locator('.qualification-details > summary').click();release();
 await expect(page.locator('#deck-count')).toHaveText('7 roles to explore');
 await expect(page.locator('#active-card')).toHaveAttribute('data-job-id',current);
 await expect(page.locator('.qualification-details')).toHaveAttribute('open','');
 const stored=await page.evaluate(()=>JSON.parse(localStorage.getItem('job-notebook-discovery-v1')));
 expect(stored.nextPage).toBe(null);expect(stored.decisions[first[0].id]).toBe('pass');
});

test('empty matching batches are skipped automatically until a suitable role is found',async({page})=>{
 const requested=[];
 await page.route('**/api/jobs*',route=>{
  const n=Number(new URL(route.request().url()).searchParams.get('page')||1);requested.push(n);
  return route.fulfill({json:{jobs:n===7?[jobs[0]]:[jobs[2]],nextPage:n===7?null:n+3}});
 });
 await page.goto('/');await expect(page.locator('#active-card')).toContainText('Workflow Ltd');expect(requested).toEqual([1,4,7]);
 await page.locator('#pass-job').click();await expect(page.locator('.deck-empty')).toContainText('No more matching roles');
 await expect(page.locator('#empty-refresh')).toHaveText('Check for new jobs');
});

test('failed continuation pauses automatically and retries the failed page on request',async({page})=>{
 let later=0;
 await page.route('**/api/jobs*',route=>{
  if(new URL(route.request().url()).searchParams.get('page')==='4')return ++later===1?route.fulfill({status:503,json:{error:'Offline'}}):route.fulfill({json:{jobs:[jobs[0]],nextPage:null}});
  return route.fulfill({json:{jobs:[],nextPage:4}});
 });
 await page.goto('/');await expect(page.locator('#empty-refresh')).toHaveText('Retry search');expect(later).toBe(1);
 await page.locator('#empty-refresh').click();await expect(page.locator('#active-card')).toContainText('Workflow Ltd');expect(later).toBe(2);
});

test('saved continuation resumes after reload and a bounded scan never claims false exhaustion',async({page})=>{
 await page.addInitScript(()=>{if(!localStorage.getItem('job-notebook-discovery-v1'))localStorage.setItem('job-notebook-discovery-v1',JSON.stringify({jobs:[],decisions:{},fetchedAt:new Date().toISOString(),nextPage:10}));});
 const requested=[];
 await page.route('**/api/jobs*',route=>{const n=Number(new URL(route.request().url()).searchParams.get('page')||1);requested.push(n);return route.fulfill({json:{jobs:[],nextPage:n+3}});});
 await page.goto('/');await expect(page.locator('#empty-refresh')).toHaveText('Keep searching');
 await expect.poll(()=>requested.length).toBe(3);expect(requested).toEqual([10,13,16]);
 await expect(page.locator('.deck-empty')).not.toContainText('No more matching roles');
 await page.reload();await expect.poll(()=>requested.length).toBe(6);expect(requested.slice(3)).toEqual([19,22,25]);
});

test('international migration expands an existing profile once and preserves later choices',async({page})=>{
 await page.addInitScript(()=>{if(!localStorage.getItem('migration-test-started')){localStorage.setItem('job-notebook-profile-v1',JSON.stringify({geography:'europe'}));localStorage.setItem('job-notebook-v1','[]');localStorage.removeItem('job-notebook-international-v23');localStorage.setItem('migration-test-started','1');}});
 await page.route('**/api/jobs*',r=>r.fulfill({json:{jobs:[{...jobs[0],location:'Cape Town, South Africa'}],nextPage:null}}));
 await page.goto('/');await expect(page.locator('#compass-location')).toContainText('International');
 await expect(page.locator('#active-card')).toContainText('South Africa');
 await page.evaluate(()=>{const p=JSON.parse(localStorage.getItem('job-notebook-profile-v1'));p.geography='europe';localStorage.setItem('job-notebook-profile-v1',JSON.stringify(p));});
 await page.reload();await expect(page.locator('#compass-location')).toContainText('Across Europe');
});
test('refresh preserves expanded listing text and the reading position',async({page})=>{
 await page.emulateMedia({reducedMotion:'reduce'});
 await page.setViewportSize({width:390,height:844});
 let refreshes=0;
 await page.route('**/api/jobs*',r=>r.fulfill({json:{jobs:[{...jobs[0],description:'English. '+('Workflow requirements and API integrations.\n\n'.repeat(80))+(++refreshes>1?'Updated employer details.':'')}],nextPage:null}}));
 await page.goto('/');await page.locator('[data-read-role]').click();
 await expect(page.locator('.source-description')).toHaveAttribute('open','');
 await page.locator('#active-card').evaluate(el=>el.scrollTop=450);
 const before=await page.locator('#active-card').evaluate(el=>el.scrollTop);
 await page.locator('#refresh-jobs').click();await expect(page.locator('#refresh-jobs')).toBeEnabled();
 await expect(page.locator('.source-description')).toHaveAttribute('open','');
 expect(await page.locator('#active-card').evaluate(el=>el.scrollTop)).toBe(before);
 await expect(page.locator('.source-description')).toContainText('Updated employer details.');
});
test('vertical dragging while reading does not accidentally pass or apply',async({page})=>{
 await setup(page);
 const body=await page.locator('.inline-role > h3').boundingBox();
 await page.mouse.move(body.x+30,body.y+25);await page.mouse.down();await page.mouse.move(body.x+34,body.y+160,{steps:8});await page.mouse.up();
 await expect(page.locator('#active-card')).toHaveAttribute('data-job-id','fixture-ba');
 expect(await page.evaluate(()=>window.openedListings)).toEqual([]);
});
test('a failed source can be retried while an existing card remains readable',async({page})=>{
 let calls=0;
 await page.route('**/api/jobs*',r=>r.fulfill({json:{jobs:[jobs[0]],nextPage:null,sourceErrors:++calls===1?['Jobicy']:[]}}));
 await page.goto('/');await expect(page.locator('#retry-jobs')).toBeVisible();
 await page.locator('[data-read-role]').click();await page.locator('#retry-jobs').click();
 await expect(page.locator('#retry-jobs')).toBeHidden();await expect(page.locator('.source-description')).toHaveAttribute('open','');expect(calls).toBe(2);
});

test('location filters change the deck, fetch the selected country, persist and reset',async({page})=>{
 const places=['Berlin, Germany','London, UK','Lisbon, Portugal','Amsterdam, Netherlands','Cape Town, South Africa','Worldwide'];
 const all=places.map((location,i)=>({...jobs[0],id:'place-'+i,company:'Place '+i,location,link:'https://example.org/place-'+i,remote:i===5}));
 const requests=[];
 await page.route('**/api/jobs*',r=>{requests.push(r.request().url());return r.fulfill({json:{jobs:all,nextPage:null}});});
 await page.goto('/');await expect(page.locator('#active-card')).toBeVisible();
 await page.getByRole('button',{name:'Filter locations',exact:true}).click();
 await page.locator('#filter-region').selectOption('europe');await page.locator('#filter-country').selectOption('portugal');await page.locator('#apply-locations').click();
 await expect(page.locator('#active-card')).toContainText('Lisbon');await expect(page.locator('#deck-count')).toHaveText('1 role to explore');
 await expect.poll(()=>requests.some(url=>url.includes('country=portugal'))).toBe(true);
 await page.reload();await expect(page.locator('#active-card')).toContainText('Lisbon');
 await page.locator('#location-filter').click();await expect(page.locator('#filter-country')).toHaveValue('portugal');
 await page.locator('#filter-region').selectOption('africa');await expect(page.locator('#filter-country-group')).toBeHidden();await page.locator('#apply-locations').click();
 await expect(page.locator('#active-card')).toContainText('South Africa');await expect(page.locator('#deck-count')).toHaveText('1 role to explore');
 await page.locator('#location-filter').click();await page.locator('#reset-locations').click();await expect(page.locator('#deck-count')).toHaveText('7 roles to explore');
});
test('switching location while a request is pending ignores the old result and cursor',async({page})=>{
 let release;const pending=new Promise(resolve=>release=resolve);let first=true;
 await page.route('**/api/jobs*',async r=>{
  if(first){first=false;await pending;try{await r.fulfill({json:{jobs:[jobs[0]],nextPage:99}});}catch{}return;}
  await r.fulfill({json:{jobs:[{...jobs[0],id:'nl-fresh',location:'Amsterdam, Netherlands'}],nextPage:null}});
 });
 await page.goto('/');await page.locator('#location-filter').click();await page.locator('#filter-region').selectOption('europe');await page.locator('#filter-country').selectOption('netherlands');await page.locator('#apply-locations').click();
 await expect(page.locator('#active-card')).toContainText('Amsterdam');release();
 await expect(page.locator('#refresh-jobs')).toBeEnabled();
 const stored=await page.evaluate(()=>JSON.parse(localStorage.getItem('job-notebook-discovery-v1')));expect(stored.nextPage).toBe(null);expect(stored.jobs.some(j=>j.id==='fixture-ba')).toBe(false);
});

test('Africa hides Canada and broad remote listings until explicitly included',async({page})=>{
 const listings=['Canada','EMEA, LATAM, Canada, USA','Worldwide','South Africa'].map((location,i)=>({...jobs[0],id:'africa-'+i,company:'Region '+i,location,remote:true,link:'https://example.org/africa-'+i}));
 await page.route('**/api/jobs*',r=>r.fulfill({json:{jobs:listings,nextPage:null,nextSearch:null}}));await page.goto('/');
 await page.locator('#location-filter').click();await page.locator('#filter-region').selectOption('africa');await page.locator('#apply-locations').click();
 await expect(page.locator('#deck-count')).toHaveText('1 role to explore');await expect(page.locator('.job-location')).toContainText('South Africa');await expect(page.locator('#active-card')).not.toContainText('Canada');
 await page.locator('#location-filter').click();await page.locator('#filter-broad-remote').check();await page.locator('#apply-locations').click();await expect(page.locator('#deck-count')).toHaveText('3 roles to explore');
 await page.reload();await page.locator('#location-filter').click();await expect(page.locator('#filter-broad-remote')).toBeChecked();
});
test('more search results remain available after the original feeds end, and load without moving the current card',async({page})=>{
 await page.setViewportSize({width:390,height:844});
 const first=Array.from({length:6},(_,i)=>({...jobs[0],id:'batch-'+i,company:'Batch '+i,location:'South Africa',link:'https://example.org/batch-'+i}));let requests=[];
 await page.route('**/api/jobs*',r=>{const url=new URL(r.request().url());requests.push(url);if(url.searchParams.get('region')!=='africa')return r.fulfill({json:{jobs:[],nextPage:null,nextSearch:null}});return r.fulfill({json:{jobs:url.searchParams.has('search')?[{...first[0],id:'extra',company:'Extra',link:'https://example.org/extra'}]:first,nextPage:null,nextSearch:url.searchParams.has('search')?null:'mock-next-search'}});});
 await page.goto('/');await page.locator('#location-filter').click();await page.locator('#filter-region').selectOption('africa');await page.locator('#apply-locations').click();
 await expect(page.locator('#deck-count')).toHaveText('6 roles to explore');await page.locator('[data-read-role]').click();const id=await page.locator('#active-card').getAttribute('data-job-id');
 await page.locator('#load-more-jobs').click();await expect(page.locator('#deck-count')).toHaveText('7 roles to explore');await expect(page.locator('#active-card')).toHaveAttribute('data-job-id',id);await expect(page.locator('.source-description')).toHaveAttribute('open','');
 expect(requests.at(-1).searchParams.get('searchOnly')).toBe('1');expect(requests.at(-1).searchParams.get('search')).toBe('mock-next-search');
});
test('bounded country searching offers continuation instead of claiming all jobs are exhausted',async({page})=>{
 await page.route('**/api/jobs*',r=>r.fulfill({json:{jobs:[],nextPage:null,nextSearch:'more-country-searches'}}));await page.goto('/');
 await expect(page.locator('#empty-refresh')).toHaveText('Keep searching');await expect(page.locator('.deck-empty')).toContainText('more source searches or pages');await expect(page.locator('.deck-empty')).not.toContainText('caught up');await expect(page.locator('[data-change-locations]')).toBeVisible();
});

for(const [region,location,wrong,broad] of [
 ['europe','Portugal','Canada','EMEA'],['africa','Kenya','Canada','EMEA'],['asia','Philippines','Canada','APAC'],['oceania','Samoa','Germany','APAC'],['north-america','Barbados','Germany','LATAM'],['south-america','Peru','Canada','LATAM']
])test(`${region} applies strict filtering, remote opt-in and continued search`,async({page})=>{
 await page.addInitScript(region=>{if(!localStorage.getItem('continent-fixture-started')){localStorage.setItem('job-notebook-v1','[]');localStorage.setItem('job-notebook-profile-v1',JSON.stringify({geography:region}));localStorage.setItem('continent-fixture-started','1');}},region);
 const first=Array.from({length:5},(_,i)=>({...jobs[0],id:region+'-'+i,company:'Company '+i,location,remote:true,link:'https://example.org/'+region+'-'+i}));
 const other=[wrong,broad,'Worldwide','USA'].map((location,i)=>({...jobs[0],id:'other-'+i,company:'Other '+i,location,remote:true,link:'https://example.org/other-'+i}));
 const requested=[];
 await page.route('**/api/jobs*',r=>{const url=new URL(r.request().url());requested.push(url);return r.fulfill({json:{jobs:url.searchParams.has('search')?[{...first[0],id:'next-'+region,company:'Next',link:'https://example.org/next-'+region}]:[...first,...other],nextPage:null,nextSearch:url.searchParams.has('search')?null:'continue-'+region}});});
 await page.goto('/');await page.locator('#location-filter').click();await page.locator('#filter-region').selectOption(region);await page.locator('#apply-locations').click();
 await expect(page.locator('.job-location')).toContainText(location);await expect(page.locator('.job-location')).not.toContainText(wrong);
 await expect(page.locator('#deck-count')).toHaveText('5 roles to explore');
 await expect(page.locator('#load-more-jobs')).toBeVisible();
 await page.locator('#load-more-jobs').click();await expect(page.locator('#load-more-jobs')).toBeHidden();
 await expect(page.locator('#deck-count')).toHaveText('6 roles to explore');
 expect(requested.at(-1).searchParams.get('region')).toBe(region);expect(requested.at(-1).searchParams.get('searchOnly')).toBe('1');
 await page.locator('#location-filter').click();await expect(page.locator('#filter-broad-remote')).not.toBeChecked();await page.locator('#filter-broad-remote').check();await page.locator('#apply-locations').click();
 await expect(page.locator('#deck-count')).toHaveText('8 roles to explore');
 await page.reload();await expect(page.locator('#location-filter')).toContainText(region==='north-america'?'North America':region==='south-america'?'South America':region[0].toUpperCase()+region.slice(1));
 await page.locator('#location-filter').click();await expect(page.locator('#filter-broad-remote')).toBeChecked();
});

test('card body drags show direction, snap back, pass and apply with undo',async({page})=>{
 await setup(page);
 const drag=async(distance,release=true)=>{
  const box=await page.locator('.inline-role > h3').boundingBox(),x=box.x+box.width/2,y=box.y+24;
  await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x+distance,y,{steps:10});
  if(release)await page.mouse.up();
 };
 await drag(25);await expect(page.locator('#active-card')).toHaveAttribute('data-job-id','fixture-ba');
 await expect(page.locator('#active-card')).not.toHaveClass(/dragging/);
 await drag(-160,false);await expect(page.locator('.swipe-label')).toHaveText('PASS');await expect(page.locator('#active-card')).toHaveClass(/dragging/);await page.mouse.up();
 await expect(page.locator('#active-card')).toHaveAttribute('data-job-id','fixture-consulting');
 await page.locator('#undo-swipe').click();await expect(page.locator('#active-card')).toHaveAttribute('data-job-id','fixture-ba');
 await drag(160,false);await expect(page.locator('.swipe-label')).toHaveText('APPLY');await page.mouse.up();
 await expect.poll(async()=> (await records(page)).find(e=>e.id==='fixture-ba')?.status).toBe('Preparing');
 expect(await page.evaluate(()=>window.openedListings)).toEqual(['https://example.org/ba']);
 await expect(page.locator('#undo-swipe')).toBeEnabled();await page.locator('#undo-swipe').click();
 await page.locator('.qualification-details summary').click();await expect(page.locator('.qualification-details')).toHaveAttribute('open','');
 await page.locator('.listing-info').click();await expect(page.locator('#role-dialog')).toBeVisible();
});
test('touch swipes on the body work while vertical touch gestures scroll the listing',async({page})=>{
 await page.setViewportSize({width:390,height:844});await setup(page);
 const cdp=await page.context().newCDPSession(page);await cdp.send('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:1});
 const gesture=async(x,y,dx,dy)=>{
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]});
  for(let i=1;i<=12;i++)await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x+dx*i/12,y:y+dy*i/12}]});
  await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
 };
 let body=await page.locator('.inline-role > h3').boundingBox();
 await gesture(body.x+body.width/2,body.y+24,-150,0);
 await expect(page.locator('#active-card')).toHaveAttribute('data-job-id','fixture-consulting');
 await page.locator('#undo-swipe').click();
 await page.locator('.source-description').evaluate(el=>{el.open=true;el.querySelector('p:last-child').textContent='Listing details. '.repeat(500);});
 const card=page.locator('#active-card');await card.evaluate(el=>el.scrollTop=100);
 const before=await card.evaluate(el=>el.scrollTop),box=await card.boundingBox();
 await gesture(box.x+box.width/2,box.y+box.height-100,5,-160);
 await expect.poll(()=>card.evaluate(el=>el.scrollTop)).toBeGreaterThan(before);
 await expect(card).toHaveAttribute('data-job-id','fixture-ba');expect(await page.evaluate(()=>window.openedListings)).toEqual([]);
});

test('trackpad swipes need no held button and momentum cannot decide the next card',async({page})=>{
 await setup(page);
 const before=await records(page),body=await page.locator('.inline-role > h3').boundingBox();
 await page.mouse.move(body.x+body.width/2,body.y+30);
 await page.mouse.wheel(0,50);await expect(page.locator('#active-card')).toHaveAttribute('data-job-id','fixture-ba');
 await page.mouse.wheel(30,0);await expect(page.locator('#active-card')).toHaveClass(/dragging/);
 await expect(page.locator('#active-card')).not.toHaveClass(/dragging/);
 expect(await records(page)).toEqual(before);
 await page.mouse.wheel(1000,0);await expect(page.locator('#active-card')).toHaveClass(/dragging/);await expect(page.locator('#active-card')).not.toHaveClass(/dragging/);await expect(page.locator('#active-card')).toHaveAttribute('data-job-id','fixture-ba');
 for(let i=0;i<4;i++)await page.mouse.wheel(90,0);await expect(page.locator('#active-card')).toHaveAttribute('data-job-id','fixture-consulting');
 for(let i=0;i<4;i++)await page.mouse.wheel(100,0);
 await expect(page.locator('#active-card')).toHaveAttribute('data-job-id','fixture-consulting');
 // A new small gesture after the momentum gap must snap back without deciding.
 await page.waitForTimeout(400);
 await page.mouse.wheel(-20,0);await expect(page.locator('#active-card')).toHaveClass(/dragging/);await expect(page.locator('#active-card')).not.toHaveClass(/dragging/);
 await page.route('https://example.org/consulting',r=>r.fulfill({contentType:'text/html',body:'<h1>Employer application</h1><form><label>Name<input name=applicant></label><button>Submit application</button></form>'}));
 for(let i=0;i<4;i++)await page.mouse.wheel(-90,0);await expect(page).toHaveURL('https://example.org/consulting');
 await expect(page.getByRole('heading',{name:'Employer application'})).toBeVisible();
 await expect(page.locator('input[name=applicant]')).toHaveValue('');
 await page.goBack();await expect(page.locator('#discover-view')).toBeVisible();
 expect((await records(page)).find(e=>e.id==='fixture-consulting').status).toBe('Preparing');
 await expect(page.locator('#preparation-dialog')).not.toBeVisible();
});
test('keyboard decisions work once per press and leave dialogs, fields and other views alone',async({page})=>{
 await setup(page);
 await page.keyboard.press('ArrowLeft');await expect(page.locator('#active-card')).toHaveAttribute('data-job-id','fixture-consulting');
 await page.evaluate(()=>document.body.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowLeft',repeat:true,bubbles:true})));
 await expect(page.locator('#active-card')).toHaveAttribute('data-job-id','fixture-consulting');
 await page.keyboard.press('s');await expect.poll(async()=> (await records(page)).find(e=>e.id==='fixture-consulting')?.status).toBe('To apply');
 await expect(page.locator('#undo-swipe')).toBeEnabled();await page.locator('#undo-swipe').click();await page.evaluate(()=>document.activeElement.blur());
 await page.locator('.listing-info').click();const before=await records(page);await page.keyboard.press('ArrowRight');await expect(page.locator('#role-dialog')).toBeVisible();expect(await records(page)).toEqual(before);
 await page.keyboard.press('Escape');await page.locator('.main-nav [data-view="profile"]').click();await page.locator('#profile-name').fill('My name');await page.keyboard.press('ArrowLeft');await page.keyboard.press('s');expect(await records(page)).toEqual(before);
 await page.locator('.main-nav [data-view="discover"]').click();await page.evaluate(()=>document.activeElement.blur());
 await page.keyboard.press('ArrowRight');await expect.poll(async()=> (await records(page)).find(e=>e.id==='fixture-consulting')?.status).toBe('Preparing');
 expect(await page.evaluate(()=>window.openedListings)).toEqual(['https://example.org/consulting']);
});

test('CV JSON review imports multiple versions, preserves profile and PDF data, and updates fit after reload',async({page})=>{
 const {cvJSON}=await import('./fixtures/cv-json.js');
 await page.route('**/api/jobs*',r=>r.fulfill({json:{jobs:[{...jobs[0],description:'Requirements:\nAPI integrations experience.\nSQL experience.'}],nextPage:null}}));await page.goto('/');await expect(page.locator('#active-card')).toHaveAttribute('data-job-id','fixture-ba');
 await page.locator('.main-nav [data-view="profile"]').click();await page.locator('#profile-workRights').evaluate(el=>el.closest('details').open=true);await page.locator('#profile-workRights').fill('Existing permit note');
 await page.locator('#analyst-upload').setInputFiles({name:'Original.pdf',mimeType:'application/pdf',buffer:Buffer.from('%PDF-1.4\n%%EOF')});
 await expect(page.locator('#analyst-file-status')).toContainText('Original.pdf');
 const before=await records(page),beforeProfile=await page.evaluate(()=>localStorage.getItem('job-notebook-profile-v1'));
 const files=['Analyst.json','Consulting.json','Developer.json'].map(name=>({name,mimeType:'application/json',buffer:Buffer.from(JSON.stringify(cvJSON))}));
 await page.locator('#cv-json-upload').setInputFiles(files);await expect(page.locator('#cv-import-dialog')).toBeVisible();
 expect(await page.evaluate(()=>localStorage.getItem('job-notebook-profile-v1'))).toBe(beforeProfile);
 expect(await page.locator('#cv-import-evidence').inputValue()).toContain('Built API integrations.');
 await page.locator('#cv-import-close').click();expect(await page.evaluate(()=>localStorage.getItem('job-notebook-profile-v1'))).toBe(beforeProfile);
 await page.locator('#cv-json-upload').setInputFiles(files);await page.getByRole('button',{name:'Save reviewed CV details'}).click();await expect(page.locator('#cv-import-dialog')).not.toBeVisible();
 await page.reload();await page.locator('.main-nav [data-view="profile"]').click();
 const profile=await page.evaluate(()=>JSON.parse(localStorage.getItem('job-notebook-profile-v1')));
 expect(profile.workRights).toBe('Existing permit note');expect(profile.evidence).toContain('Built API integrations.');expect(profile.evidence.split('Built API integrations.')).toHaveLength(2);expect(profile.cvImportSources.split('\n')).toHaveLength(3);
 await expect(page.locator('#analyst-file-status')).toContainText('Original.pdf');expect(await records(page)).toEqual(before);
 await page.locator('.main-nav [data-view="discover"]').click();await page.locator('.qualification-details summary').click();await expect(page.locator('.qualification-details')).toContainText('Built API integrations.');
});
test('invalid CV JSON leaves saved profile intact and review fits a phone',async({page})=>{
 const {cvJSON}=await import('./fixtures/cv-json.js');await page.setViewportSize({width:390,height:844});await setup(page);await page.locator('.main-nav [data-view="profile"]').click();
 const before=await page.evaluate(()=>localStorage.getItem('job-notebook-profile-v1'));
 await page.locator('#cv-json-upload').setInputFiles({name:'wrong.json',mimeType:'application/json',buffer:Buffer.from('{}')});await expect(page.locator('#cv-json-status')).toContainText('Could not import');expect(await page.evaluate(()=>localStorage.getItem('job-notebook-profile-v1'))).toBe(before);
 await page.locator('#cv-json-upload').setInputFiles({name:'CV.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(cvJSON))});await expect(page.locator('#cv-import-dialog')).toBeVisible();
 await expect(page.getByRole('button',{name:'Save reviewed CV details'})).toBeInViewport();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.screenshot({path:'private/cv-json-review-phone.png'});
});

test('application status selector replaces review draft and supports not applied and deletion',async({page})=>{
 await page.setViewportSize({width:390,height:844});await setup(page);await page.locator('#prepare-job').click();
 await expect.poll(async()=> (await records(page)).find(e=>e.id==='fixture-ba')?.status).toBe('Preparing');
 await page.locator('.main-nav [data-view="notebook"]').click();
 const status=page.locator('[data-status-id="fixture-ba"]');
 await expect(page.getByRole('button',{name:'Review draft',exact:true})).toHaveCount(0);
 const preparation=(await records(page)).find(e=>e.id==='fixture-ba').preparation;
 await status.selectOption('Applied');await expect(status).toHaveValue('Applied');
 expect((await records(page)).find(e=>e.id==='fixture-ba').applicationDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
 await status.selectOption('Not applied');await expect(page.locator('#summary-text')).toContainText('2 submitted');
 let entry=(await records(page)).find(e=>e.id==='fixture-ba');expect(entry.applicationDate).toBe('');expect(entry.preparation).toEqual(preparation);
 await page.locator('.filter[data-filter="not applied"]').click();await expect(page.locator('.application-item')).toHaveCount(1);
 await page.reload();await page.locator('.main-nav [data-view="notebook"]').click();await expect(status).toHaveValue('Not applied');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.screenshot({path:'private/application-status-phone.png'});
 page.once('dialog',dialog=>dialog.dismiss());await status.selectOption('delete');await expect(status).toHaveValue('Not applied');
 page.once('dialog',dialog=>dialog.accept());await status.selectOption('delete');await expect(status).toHaveCount(0);
 expect((await records(page)).some(e=>e.id==='fixture-ba')).toBe(false);
 await page.reload();expect((await records(page)).some(e=>e.id==='fixture-ba')).toBe(false);
});

test('saved CV evidence rates a sparse match provisionally and explains missing advert details',async({page})=>{
 await page.addInitScript(()=>localStorage.setItem('job-notebook-profile-v1',JSON.stringify({geography:'europe',evidence:'Built API integrations.',cvImportSources:'Example CV.json'})));
 await page.route('**/api/jobs*',r=>r.fulfill({json:{jobs:[{...jobs[0],description:'Requirements:\nAPI experience.\nExperience in underwater robotics.\nMasters degree in physics.'}],nextPage:null}}));await page.goto('/');
 await expect(page.locator('.card-fit-summary')).toContainText('10/10 · Provisional · 33% assessed');
 await page.locator('.listing-info').click();await expect(page.locator('.fit-score')).toContainText('10 / 10');await expect(page.locator('.fit-provisional')).toHaveText('Provisional');await expect(page.locator('.fit-rating')).toContainText('only 1 of 3');await expect(page.locator('.fit-rating')).not.toContainText('Add profile evidence');
 await page.keyboard.press('Escape');await page.reload();await expect(page.locator('.card-fit-summary')).toContainText('Provisional');
 await page.route('**/api/jobs*',r=>r.fulfill({json:{jobs:[{...jobs[0],description:'Responsibilities:\nImprove workflows and coordinate implementation.'}],nextPage:null}}));await page.locator('#refresh-jobs').click();await expect(page.locator('.card-fit-summary')).toContainText('Advert needs more detail');
 await page.locator('.listing-info').click();await expect(page.locator('.fit-rating')).toContainText('Your CV details are saved');await expect(page.locator('.fit-rating')).not.toContainText('Import your CV');
});

test('CV imports in another tab refresh an open fit report and identify the detected files',async({page})=>{
 const {cvJSON}=await import('./fixtures/cv-json.js');
 await page.route('**/api/jobs*',r=>r.fulfill({json:{jobs:[{...jobs[0],description:'Requirements:\nAPI experience.\nSQL experience.'}],nextPage:null}}));
 await page.goto('/');await page.locator('.listing-info').click();await expect(page.locator('.fit-score')).toContainText('Not rated yet');
 const other=await page.context().newPage();await other.route('**/api/jobs*',r=>r.fulfill({json:{jobs:[],nextPage:null}}));await other.goto('/#profile');
 const files=['Analyst.json','Consulting.json','Developer.json'].map(name=>({name,mimeType:'application/json',buffer:Buffer.from(JSON.stringify(cvJSON))}));
 await other.locator('#cv-json-upload').setInputFiles(files);await other.getByRole('button',{name:'Save reviewed CV details'}).click();
 await expect(page.locator('.fit-cv-detection')).toContainText('3 CV JSON files detected');await expect(page.locator('.fit-score')).toHaveText('10 / 10');
 await expect(page.locator('.fit-cv-detection')).toContainText('being used for this comparison');
 await expect(page.locator('#fit-cv-status')).toContainText('0 PDFs detected');
 await other.locator('#analyst-upload').setInputFiles({name:'Original.pdf',mimeType:'application/pdf',buffer:Buffer.from('%PDF-1.4\n%%EOF')});await expect(other.locator('#analyst-file-status')).toContainText('Original.pdf');
 await expect(page.locator('#fit-cv-status')).toContainText('1 PDF detected');await expect(page.locator('#fit-cv-status')).toContainText('Original.pdf');
 await other.close();await page.keyboard.press('Escape');await page.reload();await page.locator('.listing-info').click();await expect(page.locator('.fit-cv-detection')).toContainText('3 CV JSON files detected');
});
