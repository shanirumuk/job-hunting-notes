import {test,expect} from '@playwright/test';
const evidence='Experience: Developer · Example · September 2024 - Present.\nBuilt API integrations.\nBuilt SQL reporting.';
const good={id:'good',company:'Example',title:'Implementation Consultant',location:'Germany',link:'https://example.org/good',source:'Employer',description:'Requirements:\nAPI experience.\nSQL experience.\nEnglish proficiency.'};
async function setup(page,profile={evidence,languages:'English C1'},jobs=[good]){
 await page.addInitScript(profile=>{if(localStorage.getItem('test-discovery-seeded'))return;localStorage.clear();localStorage.setItem('test-discovery-seeded','1');localStorage.setItem('job-notebook-v1','[]');localStorage.setItem('job-notebook-profile-v1',JSON.stringify(profile));localStorage.setItem('job-notebook-international-v23','1');localStorage.setItem('job-notebook-discovery-v26','1');},profile);
 await page.route('**/api/jobs*',r=>r.fulfill({json:{jobs,nextPage:null,nextSearch:null,fetchedAt:new Date().toISOString()}}));await page.goto('/');
}
test('CV-driven discovery excludes support, too many years and weak skills, and explains the match',async({page})=>{
 const jobs=[good,{...good,id:'support',title:'Customer Support Manager',link:'https://example.org/support',description:'Requirements:\nCall center management experience.\nCustomer complaint handling.'},{...good,id:'senior-years',link:'https://example.org/senior-years',description:good.description+'\n5 years of experience in implementation.'},{...good,id:'weak',link:'https://example.org/weak',description:'Requirements:\nAPI experience.\nUnderwater robotics expertise.\nPhysics degree.'}];
 await setup(page,undefined,jobs);await expect(page.locator('#deck-count')).toHaveText('1 role to explore');await expect(page.locator('.card-fit-summary')).toContainText('Skills evidence: 10/10');await expect(page.locator('.match-reasons')).toContainText('your CV');
 for(const viewport of [{width:1440,height:900},{width:390,height:844},{width:740,height:360}]){
  await page.setViewportSize(viewport);await expect(page.locator('#active-card')).toBeVisible();await expect(page.locator('#pass-job')).toBeInViewport();await expect(page.locator('#prepare-job')).toBeInViewport();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 }
 await page.locator('#save-job').click();await expect(page.locator('#active-card')).toHaveCount(0);await page.locator('#undo-swipe').click();await expect(page.locator('#active-card')).toHaveAttribute('data-job-id','good');
});
test('missing CV asks for evidence and does not present generic recommendations',async({page})=>{
 await setup(page,{evidence:''});await expect(page.locator('#active-card')).toHaveCount(0);await expect(page.locator('.deck-empty')).toContainText('start with your CV');
});
test('pasting a listing link retrieves editable fields and saves the description and LinkedIn source',async({page})=>{
 let calls=0;await page.route('**/api/import-job',r=>{calls++;return r.fulfill({json:{job:{...good,source:'LinkedIn',publishedAt:'2026-10-01',description:good.description}}});});
 await setup(page);await page.locator('.main-nav [data-view="notebook"]').click();await page.locator('#add-button').click();await expect(page.locator('#application-details')).toBeHidden();
 await page.locator('#link').fill('https://www.linkedin.com/jobs/view/123');await page.locator('#link').press('Enter');
 await expect(page.locator('#company')).toHaveValue('Example');await expect(page.locator('#title')).toHaveValue('Implementation Consultant');await expect(page.locator('#requirements')).toHaveValue(good.description);await expect(page.locator('#import-job-status')).toContainText('LinkedIn');
 await page.locator('#location').fill('Berlin · Hybrid');await page.locator('#save-application').click();
 const records=await page.evaluate(()=>JSON.parse(localStorage.getItem('job-notebook-v1')));expect(records[0].source).toBe('LinkedIn');expect(records[0].description).toBe(good.description);expect(records[0].location).toBe('Berlin · Hybrid');expect(calls).toBe(1);
 await page.reload();await page.locator('.main-nav [data-view="notebook"]').click();await expect(page.locator('.application-item')).toContainText('Berlin · Hybrid');
});
test('blocked source offers a paste fallback and pending imports cannot overwrite another editor',async({page})=>{
 await page.route('**/api/import-job',r=>r.fulfill({status:422,json:{error:'The site blocked access. Try the employer’s careers link or paste the advert.'}}));
 await setup(page);await page.locator('.main-nav [data-view="notebook"]').click();await page.locator('#add-button').click();await page.locator('#link').fill('https://example.org/blocked');await page.locator('#link').press('Enter');await expect(page.locator('#import-job-status')).toContainText('blocked access');
 await page.locator('#manual-job').click();await page.locator('#company').fill('Manual employer');await page.locator('#title').fill('Business Analyst');await page.locator('#save-application').click();await expect(page.locator('#editor-dialog')).not.toBeVisible();
 let release;const gate=new Promise(resolve=>release=resolve);await page.route('**/api/import-job',async r=>{await gate;await r.fulfill({json:{job:good}}).catch(()=>{});});
 await page.locator('.main-nav [data-view="notebook"]').click();await page.locator('#add-button').click();await page.locator('#link').fill('https://example.org/pending');await page.locator('#link').press('Enter');await expect(page.locator('#import-job-status')).toContainText('Retrieving');await page.locator('#close-editor').click();
 await page.locator('.main-nav [data-view="notebook"]').click();await page.locator('#add-button').click();release();await expect(page.locator('#application-details')).toBeHidden();await expect(page.locator('#company')).toHaveValue('');
});
