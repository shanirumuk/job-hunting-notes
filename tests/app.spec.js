import {test,expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';
const jobs = [
  {id:'fixture-ba',company:'Workflow Ltd',title:'Technical Business Analyst',location:'Berlin, Germany',description:'English. Workflow requirements, stakeholder workshops, API integrations.',link:'https://example.org/ba',source:'Arbeitnow',publishedAt:'2026-09-17T09:00:00Z'},
  {id:'fixture-consulting',company:'Systems Ltd',title:'Implementation Consultant',location:'Dublin, Ireland',description:'English. Customer workshops, configuration and testing.',link:'https://example.org/consulting',source:'Arbeitnow'},
  {id:'fixture-us',company:'USA Ltd',title:'Implementation Consultant',location:'United States',description:'Customer implementation',link:'https://example.org/us',source:'Arbeitnow'}
];
async function setup(page) {await page.route('**/api/jobs',route => route.fulfill({json:{jobs,fetchedAt:new Date().toISOString()}}));await page.goto('/');await expect(page.locator('#active-card')).toBeVisible();}
async function records(page) {return page.evaluate(() => JSON.parse(localStorage.getItem('job-notebook-v1')));}
test('swipe, undo, preparation, review and submission preserve existing records',async ({page}) => {
  await setup(page); await expect(page.locator('#deck-count')).toHaveText('2 roles to explore');
  await page.locator('#pass-job').click(); await expect(page.locator('#active-card')).toContainText('Systems Ltd');
  await page.locator('#undo-swipe').click(); await expect(page.locator('#active-card')).toContainText('Workflow Ltd');
  await page.locator('#prepare-job').click(); await expect(page.locator('#preparation-dialog')).toBeVisible();
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
test('actual drag works on mobile and card title stays below company row',async ({page}) => {
  await page.setViewportSize({width:390,height:844}); await setup(page);
  const line = await page.locator('.company-line').boundingBox(), title = await page.locator('#active-card h2').boundingBox();expect(title.y).toBeGreaterThanOrEqual(line.y+line.height);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  const card = await page.locator('.card-top').boundingBox();await page.mouse.move(card.x+60,card.y+80);await page.mouse.down();await page.mouse.move(card.x+195,card.y+80,{steps:12});await page.mouse.up();
  await expect(page.locator('#preparation-dialog')).toBeVisible();
});
test('profile setup imports PDFs locally and chooses the BA CV',async ({page}) => {
  await setup(page);await page.locator('[data-view="profile"]').first().click();
  const bundle={profile:{name:'Test Applicant',email:'test@example.org',evidence:'Delivered a project in 1.5 months.',workRights:'Employment permit required.',startDate:'2027-01-01'},cvs:{analyst:{name:'BA.pdf',base64:Buffer.from('%PDF-1.4\n%%EOF').toString('base64')}}};
  await page.locator('#profile-import').setInputFiles({name:'setup.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(bundle))});
  await expect(page.locator('#profile-message')).toContainText('with 1 CV PDFs');await expect(page.locator('#analyst-file-status')).toContainText('BA.pdf');
  await page.locator('[data-view="discover"]').first().click();await page.locator('#prepare-job').click();await expect(page.locator('#prep-pitch')).toContainText('Test Applicant');await expect(page.locator('#prep-cv-status')).toContainText('BA.pdf');
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
  await page.route('**/api/jobs',r=>r.fulfill({status:503,json:{error:'Unavailable'}}));await page.goto('/');await expect(page.locator('#feed-status')).toContainText('Couldn’t refresh');
  await page.locator('[data-view="notebook"]').first().click();await expect(page.locator('.application-item')).toHaveCount(3);
  await page.unroute('**/api/jobs');await page.route('**/api/jobs',r=>r.fulfill({json:{jobs:[{...jobs[0],company:'<img src=x onerror="window.pwned=true">'}],fetchedAt:new Date().toISOString()}}));await page.locator('[data-view="discover"]').first().click();await page.locator('#refresh-jobs').click();await expect(page.locator('#active-card')).toBeVisible();expect(await page.evaluate(()=>window.pwned)).toBeUndefined();expect(await page.locator('#active-card img').count()).toBe(0);
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
    await page.getByRole('button',{name:'Role details',exact:false}).click();await expect(page.locator('#role-dialog')).toBeVisible();
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
  await page.locator('.main-nav [data-view="discover"]').click();await page.locator('#prepare-job').click();await page.locator('#prep-pitch').fill('Keep my edited draft.');await page.locator('#prep-cv-choice').selectOption('Full Stack Developer CV');
  await expect(page.locator('#prep-pitch')).toHaveValue('Keep my edited draft.');await expect(page.locator('#prep-cv-status')).toContainText('Full_Stack.pdf');
  expect((await records(page)).find(e=>e.id==='fixture-ba').preparation.cv).toBe('Full Stack Developer CV');
});
test('long role names and all review flags remain available on a small screen',async ({page}) => {
  await page.setViewportSize({width:320,height:568});const longTitle='Business Systems Specialist — Enterprise Applications, Customer Workflows and Service Delivery';
  const description='English. Stakeholder workshops, workflows, ERP configuration and rollout testing. Fluent German required. No visa sponsorship.';
  await page.route('**/api/jobs',r=>r.fulfill({json:{jobs:[{...jobs[0],title:longTitle,description}],fetchedAt:new Date().toISOString()}}));await page.goto('/');
  await expect(page.locator('#active-card')).toContainText('Worth exploring');await page.getByRole('button',{name:'Role details',exact:false}).click();
  await expect(page.locator('.role-heading')).toHaveText(longTitle);await expect(page.locator('#role-content')).toContainText('German requirement');await expect(page.locator('#role-content')).toContainText('existing work rights');
  expect(await page.locator('#role-dialog').evaluate(el=>el.scrollWidth)).toBeLessThanOrEqual(320);
  await page.locator('#role-prepare').click();await expect(page.locator('#preparation-dialog')).toBeVisible();await expect(page.locator('#preparation-title')).toHaveText('Workflow Ltd');
});
test('touch scrolling stays inside the card and a horizontal touch prepares the role',async ({browser}) => {
  const context=await browser.newContext({viewport:{width:375,height:667},isMobile:true,hasTouch:true,serviceWorkers:'block'});const page=await context.newPage();await setup(page);
  const client=await context.newCDPSession(page);const card=await page.locator('#active-card').boundingBox();
  const x=card.x+80,y=card.y+60;
  await client.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]});
  for(let n=1;n<=8;n++) await client.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x+n*17,y}]});
  await client.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  await expect(page.locator('#preparation-dialog')).toBeVisible();
  await page.locator('#close-preparation').click();await page.locator('#undo-swipe').click();
  await client.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:180,y:card.y+card.height-85}]});
  for(let n=1;n<=6;n++) await client.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:180,y:card.y+card.height-85-n*17}]});
  await client.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  await expect(page.locator('#preparation-dialog')).not.toBeVisible();expect(await page.evaluate(()=>window.scrollY)).toBe(0);
  expect(await page.locator('#active-card').evaluate(el=>el.scrollTop)).toBeGreaterThan(0);
  await context.close();
});
