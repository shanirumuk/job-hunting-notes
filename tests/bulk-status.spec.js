import {test,expect} from '@playwright/test';
const entries=[
 {id:'bulk-a',company:'Alpha',title:'Business Analyst',location:'Berlin',status:'To apply',notes:'Keep my draft',materials:'Analyst CV',link:'https://example.org/a',applicationDate:'',interviewDate:'',followUpDate:''},
 {id:'bulk-b',company:'Beta',title:'Systems Analyst',location:'Munich',status:'Applied',notes:'Recruiter replied',materials:'Consulting CV',link:'https://example.org/b',applicationDate:'2026-10-01',interviewDate:'',followUpDate:'2026-10-20'},
 {id:'bulk-c',company:'Gamma',title:'Implementation Consultant',location:'Hamburg',status:'Interview',notes:'Keep interview notes',link:'https://example.org/c',applicationDate:'2026-09-30',interviewDate:'2026-10-19',followUpDate:'2026-10-21'}
];
async function setup(page){
 await page.addInitScript(entries=>{if(localStorage.getItem('bulk-test'))return;localStorage.setItem('bulk-test','1');localStorage.setItem('job-notebook-v1',JSON.stringify(entries));localStorage.setItem('job-notebook-international-v23','1');localStorage.setItem('job-notebook-discovery-v26','1');},entries);
 await page.route('**/api/jobs*',r=>r.fulfill({json:{jobs:[],nextPage:null,nextSearch:null}}));
 await page.route('**/api/setup',r=>r.fulfill({json:{}}));
 await page.goto('/#notebook');await expect(page.locator('.application-item')).toHaveCount(3);
}
const records=page=>page.evaluate(()=>JSON.parse(localStorage.getItem('job-notebook-v1')));
const select=(page,id)=>page.locator(`[data-select-application="${id}"]`);
test('bulk statuses preserve notes, materials and existing dates and persist after reload',async({page})=>{
 await setup(page);const original=await records(page);
 await page.locator('#select-applications').click();await expect(page.locator('#apply-bulk-status')).toBeDisabled();
 await select(page,'bulk-a').check();await select(page,'bulk-b').check();
 await expect(page.locator('#select-all-applications')).toHaveJSProperty('indeterminate',true);
 await expect(page.locator('#selection-count')).toHaveText('2 selected');await page.locator('#bulk-status').selectOption('Applied');await page.locator('#apply-bulk-status').click();
 let saved=await records(page);const today=await page.evaluate(()=>new Date().toISOString().slice(0,10));
 expect(saved.find(e=>e.id==='bulk-a')).toEqual({...original[0],status:'Applied',applicationDate:today});
 expect(saved.find(e=>e.id==='bulk-b')).toEqual(original[1]);expect(saved.find(e=>e.id==='bulk-c')).toEqual(original[2]);
 await expect(page.locator('#bulk-actions')).toBeHidden();
 await page.locator('#select-applications').click();await select(page,'bulk-a').check();await select(page,'bulk-b').check();await page.locator('#bulk-status').selectOption('Rejected');await page.locator('#apply-bulk-status').click();
 await page.reload();saved=await records(page);
 expect(saved.find(e=>e.id==='bulk-a')).toEqual({...original[0],status:'Rejected',applicationDate:today});
 expect(saved.find(e=>e.id==='bulk-b')).toEqual({...original[1],status:'Rejected',followUpDate:''});
 expect(saved.find(e=>e.id==='bulk-c')).toEqual(original[2]);
 await page.locator('[data-filter="rejected"]').click();await expect(page.locator('.application-item')).toHaveCount(2);
});
test('select all respects search and status filters and hidden selections are removed on phones',async({page})=>{
 await page.setViewportSize({width:320,height:568});await setup(page);const original=await records(page);
 await page.locator('#select-applications').click();await page.locator('#select-all-applications').check();await expect(page.locator('#selection-count')).toHaveText('3 selected');
 await page.locator('[data-filter="applied"]').click();await expect(page.locator('#selection-count')).toHaveText('1 selected');
 await page.locator('#search-input').fill('Alpha');await expect(page.locator('#selection-count')).toHaveText('0 selected');await expect(page.locator('#select-all-applications')).toBeDisabled();
 await page.locator('[data-filter="all"]').click();await page.locator('#select-all-applications').check();await expect(page.locator('#selection-count')).toHaveText('1 selected');
 await page.locator('#bulk-status').selectOption('Archived');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 for(const selector of ['#select-all-applications','#bulk-status','#apply-bulk-status'])expect(await page.locator(selector).evaluate(el=>{const r=el.closest('label')?.getBoundingClientRect()||el.getBoundingClientRect();return r.height;})).toBeGreaterThanOrEqual(44);
 await page.locator('#apply-bulk-status').click();const saved=await records(page);
 expect(saved.find(e=>e.id==='bulk-a').status).toBe('Archived');expect(saved.find(e=>e.id==='bulk-b')).toEqual(original[1]);expect(saved.find(e=>e.id==='bulk-c')).toEqual(original[2]);
});
test('keyboard selection and cancel make no saved changes',async({page})=>{
 await setup(page);const original=await records(page);await page.locator('#select-applications').click();await expect(select(page,'bulk-a')).toBeFocused();await page.keyboard.press('Space');
 await expect(page.locator('#selection-count')).toHaveText('1 selected');await page.locator('#bulk-status').selectOption('Rejected');await page.locator('#select-applications').click();await expect(page.locator('#bulk-actions')).toBeHidden();
 expect(await records(page)).toEqual(original);await page.locator('#select-applications').click();await expect(page.locator('#selection-count')).toHaveText('0 selected');await expect(page.locator('#bulk-status')).toHaveValue('');await expect(page.locator('#apply-bulk-status')).toBeDisabled();
});
