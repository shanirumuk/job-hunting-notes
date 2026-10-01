import {test,expect} from '@playwright/test';
const job={id:'full-review-fixture',company:'Example',title:'Business Analyst',location:'Berlin, Germany',link:'https://example.org/job',description:'Requirements:\nEnglish proficiency is essential.\nSQL experience required.'};
const review={version:3,overall:6.5,skills:8,coverage:70,requirementCoverage:100,provisional:true,cap:'',summary:'Your SQL and English align. Check the contract duration.',cv:'Business Analyst CV',cvReason:'Lead with SQL reporting.',points:[{text:'English proficiency',sourceQuote:'English proficiency is essential.',category:'required',importance:'essential',status:'match',note:'Native English recorded.',cvQuote:'English native (C1)'},{text:'SQL experience',sourceQuote:'SQL experience required.',category:'required',importance:'standard',status:'partial',note:'Reporting is supported; the required depth is unclear.',cvQuote:'SQL reporting.'}],factors:['eligibility','location','pay','career','workStyle','contract'].map(key=>({key,status:'unknown',note:'Confirm this detail.',sourceQuote:'',cvQuote:''})),audit:[{paragraph:0,kind:'background'}],issues:[]};
async function connect(page,jobs=[job]){
 await page.route('**/api/jobs*',r=>r.fulfill({json:{jobs,nextPage:null}}));
 await page.route('**/api/summary',r=>r.fulfill({status:503,json:{error:'Summary unavailable'}}));
 await page.addInitScript(()=>{localStorage.setItem('job-notebook-v1','[]');localStorage.setItem('job-notebook-international-v23','1');localStorage.setItem('job-notebook-discovery-v26','1');});
 const cv={name:'CV.pdf',base64:Buffer.from('%PDF-1.4\n%%EOF').toString('base64')};
 await page.route('**/api/setup',r=>r.fulfill({json:{profile:{evidence:'SQL reporting.',languages:'English native (C1)',relocation:'Relocation is fine; consider contract length.'},cvs:{consulting:cv,analyst:cv,developer:cv}}}));
 await page.goto('/#connect='+'test-token-'.padEnd(43,'x'));await page.locator('.main-nav [data-view="discover"]').click();
}
test('full review updates compact checks, uses local cache and refreshes after profile edits',async({page})=>{
 let calls=0;await page.route('**/api/fit-review',async r=>{calls++;const body=r.request().postDataJSON();expect(body.profile.relocation).toContain('contract length');expect(body.profile.email).toBeUndefined();await r.fulfill({json:{review}});});
 await connect(page);await expect(page.locator('.card-fit-summary')).toContainText('Application fit: 6.5/10');
 await page.locator('.qualification-details > summary').click();await expect(page.locator('.qualification.match .qualification-icon')).toHaveText('✓');await expect(page.locator('.qualification.partial .qualification-icon')).toHaveText('?');await expect(page.locator('.qualification.partial')).toContainText('required depth');
 await page.locator('.listing-info').click();await expect(page.locator('.fit-score')).toContainText('6.5');await expect(page.locator('.fit-cv-name')).toHaveText('Business Analyst CV');await expect(page.locator('#fit-download-cv')).toBeVisible();
 for(const width of [1440,390]){await page.setViewportSize({width,height:844});expect(await page.locator('#role-dialog').evaluate(e=>e.scrollWidth<=e.clientWidth)).toBe(true);}
 await page.screenshot({path:'private/full-review-phone.png'});
 await page.keyboard.press('Escape');await page.reload();await expect(page.locator('.card-fit-summary')).toContainText('Application fit: 6.5/10');expect(calls).toBe(1);
 await page.locator('.main-nav [data-view="profile"]').click();await page.locator('#profile-languages').evaluate(e=>e.closest('details').open=true);await page.locator('#profile-languages').fill('English native (C1), French B2');await page.getByRole('button',{name:'Save my profile',exact:true}).click();await page.locator('.main-nav [data-view="discover"]').click();await expect.poll(()=>calls).toBe(2);
});
test('late reviews cannot replace another job and errors offer a retry',async({page})=>{
 let release;const gate=new Promise(resolve=>release=resolve);let calls=0;
 await page.route('**/api/fit-review',async r=>{calls++;if(calls===1){await gate;await r.fulfill({json:{review}});}else if(calls===2)await r.fulfill({status:503,json:{error:'Review unavailable.'}});else await r.fulfill({json:{review:{...review,summary:'Second role reviewed.'}}});});
 await connect(page,[job,{...job,id:'second-job',link:'https://example.org/second-job',company:'Another',title:'Implementation Consultant'}]);
 await expect.poll(()=>calls).toBe(1);await page.locator('#pass-job').click();await expect(page.locator('#active-card')).toHaveAttribute('data-job-id','second-job');release();
 await expect(page.locator('#full-review-status')).toContainText('Review unavailable');await expect(page.locator('#role-summary')).not.toContainText(review.summary);
 await page.locator('[data-retry-fit]').click();await expect(page.locator('#role-summary')).toContainText('Second role reviewed.');
});

test('confirmed language and relocation corrections apply once without undoing later profile edits',async({page})=>{
 await connect(page);await page.route('**/api/fit-review',r=>r.fulfill({status:503,json:{error:'Review unavailable.'}}));
 await page.route('**/api/setup',r=>r.fulfill({json:{correction:{id:'native-relocation-test',languages:'English native (C1), German B1',relocation:'Relocation is fine; consider contract length.'}}}));
 await page.reload();await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem('job-notebook-profile-v1')).profileCorrectionVersion)).toBe('native-relocation-test');
 await page.locator('.main-nav [data-view="profile"]').click();await page.locator('#profile-languages').evaluate(e=>e.closest('details').open=true);await expect(page.locator('#profile-languages')).toHaveValue('English native (C1), German B1');
 await page.locator('#profile-languages').fill('English native (C1), German B2');await page.getByRole('button',{name:'Save my profile',exact:true}).click();await page.reload();await expect(page.locator('#profile-languages')).toHaveValue('English native (C1), German B2');
});

test('connection-only import preserves existing CV details and applies confirmed corrections immediately',async({page})=>{
 await connect(page);await page.route('**/api/fit-review',r=>r.fulfill({status:503,json:{error:'Review unavailable.'}}));
 const before=await page.evaluate(()=>JSON.parse(localStorage.getItem('job-notebook-profile-v1')));
 await page.route('**/api/setup',r=>r.fulfill({json:{correction:{id:'connection-only-native',languages:'English native (C1), German B1',relocation:'Relocation is fine; consider contract length.'}}}));
 await page.locator('.main-nav [data-view="profile"]').click();await page.locator('#profile-import').setInputFiles({name:'Connect.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({automationToken:'test-token-'.padEnd(43,'x')}))});
 await expect(page.locator('#profile-message')).toContainText('existing CVs and profile are preserved');
 const after=await page.evaluate(()=>JSON.parse(localStorage.getItem('job-notebook-profile-v1')));
 expect(after.evidence).toBe(before.evidence);expect(after.languages).toBe('English native (C1), German B1');expect(after.profileCorrectionVersion).toBe('connection-only-native');await expect(page.locator('#analyst-file-status')).toContainText('CV.pdf');
});

test('busy reviews retry automatically and show progress in the Fit dialog',async({page})=>{
 let calls=0,release;const gate=new Promise(resolve=>release=resolve);
 await page.route('**/api/fit-review',async r=>{calls++;if(calls===1)await r.fulfill({status:429,headers:{'Retry-After':'2'},json:{error:'Busy'}});else{await gate;await r.fulfill({json:{review}});}});
 await connect(page);
 await expect(page.locator('#full-review-status')).toContainText('Retrying automatically');
 await page.locator('.listing-info').click();await expect(page.locator('#fit-dialog-review-status')).toContainText('Retrying automatically');
 await expect.poll(()=>calls).toBe(2);await expect(page.locator('#fit-dialog-review-status')).toContainText('1–4 minutes');
 release();await expect(page.locator('#role-content')).toContainText('OVERALL APPLICATION FIT');await expect(page.locator('.fit-score')).toContainText('6.5');
});

test('saved connection is verified with the server and can be rechecked after rejection',async({page})=>{
 await page.route('**/api/fit-review',r=>r.fulfill({json:{review}}));await connect(page);
 await expect(page.locator('#browser-connection-status')).toContainText('Private connection verified');
 await page.route('**/api/setup',r=>r.fulfill({status:401,json:{error:'Not authorized'}}));
 await page.locator('.main-nav [data-view="profile"]').click();await page.locator('#check-private-connection').click();
 await expect(page.locator('#browser-connection-status')).toContainText('not accepted');
 await page.route('**/api/setup',r=>r.fulfill({json:{correction:null}}));await page.locator('#check-private-connection').click();
 await expect(page.locator('#browser-connection-status')).toContainText('Private connection verified');
});

test('exhausted provider allowance is explained and stops automatic calls across jobs',async({page})=>{
 let calls=0,summaries=0;
 await page.route('**/api/fit-review',r=>{calls++;return r.fulfill({status:402,json:{code:'REVIEW_QUOTA_EXHAUSTED',error:'Full reviews are paused because the Browserbase allowance is exhausted.'}});});
 await connect(page,[job,{...job,id:'quota-second',title:'Implementation Consultant',company:'Other',link:'https://example.org/other'}]);
 await page.route('**/api/summary',r=>{summaries++;return r.fulfill({status:503,json:{error:'Summary unavailable'}});});
 await expect(page.locator('#full-review-status')).toContainText('allowance is exhausted');
 await page.locator('#pass-job').click();await expect(page.locator('#full-review-status')).toContainText('allowance is exhausted');
 await page.locator('.listing-info').click();await expect(page.locator('#fit-dialog-review-status')).toContainText('allowance is exhausted');
 expect(calls).toBe(1);expect(summaries).toBe(0);
 await page.route('**/api/fit-review',r=>{calls++;return r.fulfill({json:{review}});});
 await page.locator('#fit-dialog-review-status [data-retry-fit]').click();await expect(page.locator('#role-content')).toContainText('OVERALL APPLICATION FIT');expect(calls).toBe(2);
});

test('confirmed analytical and requirements evidence is added without replacing imported CVs',async({page})=>{
 const {productBusinessAnalyst}=await import('./fixtures/product-business-analyst.js');
 await page.route('**/api/fit-review',r=>r.fulfill({status:402,json:{code:'REVIEW_QUOTA_EXHAUSTED',error:'Provider allowance exhausted.'}}));
 await connect(page,[{...job,...productBusinessAnalyst}]);
 await page.route('**/api/setup',r=>r.fulfill({json:{correction:{id:'confirmed-ba',evidenceUpdate:{id:'confirmed-ba-evidence',lines:['Confirmed by you: I have an analytical mindset.','Confirmed by you: I have built system requirements after discussions with business teams.']}}}}));
 await page.reload();await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem('job-notebook-profile-v1')).evidenceCorrectionVersion)).toBe('confirmed-ba-evidence');
 await page.locator('.qualification-details > summary').click();
 await expect(page.locator('.qualification.match').filter({hasText:'analytical approach'})).toHaveCount(1);
 await expect(page.locator('.qualification.match').filter({hasText:'Translating business needs'})).toHaveCount(1);
 await expect(page.locator('.qualification-details')).not.toContainText('Additional Requirements');
 await expect(page.locator('.card-fit-summary')).toContainText('CV evidence score');
 const evidence=await page.evaluate(()=>JSON.parse(localStorage.getItem('job-notebook-profile-v1')).evidence);expect(evidence).toContain('SQL reporting.');
 await page.reload();expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('job-notebook-profile-v1')).evidence)).toBe(evidence);
});

test('missing OpenAI setup is visible without launching repeated failed reviews',async({page})=>{
 await connect(page);
 let calls=0;await page.route('**/api/fit-review',r=>{calls++;return r.fulfill({json:{review}});});
 await page.route('**/api/setup',r=>r.fulfill({json:{correction:null,reviewProvider:{provider:'openai',model:'gpt-6-luna',configured:false}}}));
 await page.reload();await expect(page.locator('#browser-connection-status')).toContainText('OpenAI setup is needed');await expect(page.locator('#full-review-status')).toContainText('OPENAI_API_KEY');
 await page.locator('.listing-info').click();await expect(page.locator('#fit-dialog-review-status')).toContainText('OpenAI setup is needed');expect(calls).toBe(0);
 await page.keyboard.press('Escape');await page.route('**/api/setup',r=>r.fulfill({json:{correction:null,reviewProvider:{provider:'openai',model:'gpt-6-luna',configured:true}}}));
 await page.reload();await expect(page.locator('#browser-connection-status')).toContainText('GPT-6 Luna is configured');await expect(page.locator('.card-fit-summary')).toContainText('Application fit: 6.5/10');
});

test('fallback reviews show the actual model and reason in rating details',async({page})=>{
 await page.route('**/api/fit-review',r=>r.fulfill({json:{review:{...review,model:'anthropic/claude-sonnet-4-6',provider:'browserbase',fallback:{from:'openai',reason:'allowance exhausted'}}}}));
 await connect(page);await expect(page.locator('.card-fit-summary')).toContainText('Application fit: 6.5/10');
 await page.locator('.listing-info').click();await page.getByText('How the rating is calculated',{exact:true}).click();
 await expect(page.locator('#role-dialog')).toContainText('Review model: anthropic/claude-sonnet-4-6');
 await expect(page.locator('#role-dialog')).toContainText('Backup provider used (openai: allowance exhausted)');
});

test('CRM and degree confirmations improve the local checklist while AI reviews are paused',async({page})=>{
 const {telesalesOperations}=await import('./fixtures/telesales-operations.js');
 await page.route('**/api/fit-review',r=>r.fulfill({status:402,json:{code:'REVIEW_QUOTA_EXHAUSTED',error:'Provider allowance exhausted.'}}));
 await connect(page,[{...job,...telesalesOperations}]);
 await page.route('**/api/setup',r=>r.fulfill({json:{correction:{id:'confirmed-crm',evidenceUpdate:{id:'crm-degree',previous:{id:'earlier',lines:['I have an analytical mindset.']},lines:["I have a bachelor's degree in Digital Business and Data Science.",'I have added Frappe CRM to a project before.']}}}}));
 await page.reload();await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem('job-notebook-profile-v1')).evidenceCorrectionVersion)).toBe('crm-degree');
 await page.locator('.qualification-details > summary').click();
 const required=page.locator('[data-qualification-group="required"]');
 await expect(required.locator('.qualification.match').filter({hasText:"Bachelor's degree"})).toHaveCount(1);
 await expect(required.locator('.qualification.partial').filter({hasText:'Strong CRM experience'})).toContainText('Frappe CRM');
 await expect(required).not.toContainText('added advantage');
 await expect(page.locator('[data-qualification-group="optional"]')).toContainText('added advantage');
 await expect(page.locator('.qualification-details')).not.toContainText('Important Notice');
 await expect(page.locator('.qualification-details')).not.toContainText('recruitment fees');
 await page.locator('.source-description > summary').click();await expect(page.locator('.source-description')).toContainText('recruitment fees');
 const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('job-notebook-profile-v1')).evidence);expect(saved).toContain('SQL reporting.');
 await page.reload();expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('job-notebook-profile-v1')).evidence)).toBe(saved);
});
