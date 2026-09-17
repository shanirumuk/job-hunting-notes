import {chromium} from '@playwright/test';

const token=process.env.JOB_NOTEBOOK_ACCESS_TOKEN;if(!token)throw new Error('Set JOB_NOTEBOOK_ACCESS_TOKEN');
const browser=await chromium.launch();
try{
 const context=await browser.newContext({viewport:{width:412,height:892},isMobile:true,hasTouch:true,serviceWorkers:'block'});
 const page=await context.newPage();await page.goto('https://job-hunting-notes.vercel.app/');
 await page.locator('[data-view="profile"]').first().click();
 const bundle={automationToken:token,profile:{name:'Test Applicant',email:'test@example.org',phone:'+49 000000',linkedin:'https://www.linkedin.com/in/test-applicant'},cvs:{consulting:{name:'Practice.pdf',base64:Buffer.from('%PDF-1.4\n%%EOF').toString('base64')}}};
 await page.locator('#profile-import').setInputFiles({name:'practice-setup.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(bundle))});
 await page.locator('#test-browser').click();
 await page.locator('#browser-live').waitFor({state:'visible',timeout:90000});
 console.log('Production phone UI:',await page.locator('#browser-report').innerText());
 const frame=page.frameLocator('#browser-live');await frame.locator('canvas').first().waitFor({state:'visible',timeout:30000});
 const box=await page.locator('#browser-live').boundingBox();console.log('Review viewport',JSON.stringify(box));
 console.log('Live View contents:',(await frame.locator('body').innerText()).slice(0,800));
 await page.screenshot({path:'private/phone-review.png'});
 if(box.width<350||box.height<300)throw new Error('Review viewport too small');
 if(await page.locator('#browser-submitted').isVisible())throw new Error('Practice must not mark an application submitted');
 await page.locator('#browser-keyboard summary').click();await page.locator('#browser-text').fill(' testing');const typing=page.waitForResponse(r=>r.url().endsWith('/api/browser'));await page.locator('[data-browser-input=type]').click();if(!(await typing).ok())throw new Error('Phone typing failed');
 const ending=page.waitForResponse(r=>r.url().endsWith('/api/browser'));await page.locator('#browser-end').click();if(!(await ending).ok())throw new Error('Session release failed');console.log('Phone review and End session verified.');
}finally{await browser.close();}
