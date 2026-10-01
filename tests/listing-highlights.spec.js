import {test,expect} from '@playwright/test';
const jobs=[{id:'highlight-ba',company:'Workflow',title:'Business Analyst',location:'Berlin, Germany',description:'Stakeholder workshops, API integrations, workflow requirements and testing.\nRequirements:\nSQL reporting experience required.\nEnglish communication skills required.\nBenefits:\nFlexible working hours and learning budget.',link:'https://example.org/analyst'},{id:'highlight-consultant',company:'Delivery',title:'Implementation Consultant',location:'Dublin, Ireland',description:'Customer workshops and implementation delivery.',link:'https://example.org/consultant'}];
async function setup(page){
 await page.addInitScript(()=>{localStorage.setItem('job-notebook-v1','[]');localStorage.setItem('job-notebook-international-v23','1');localStorage.setItem('job-notebook-discovery-v26','1');});
 await page.route('**/api/jobs*',r=>r.fulfill({json:{jobs,nextPage:null,fetchedAt:new Date().toISOString()}}));
 await page.goto('/');await expect(page.locator('#active-card')).toHaveAttribute('data-job-id','highlight-ba');
}
async function select(page,selector,text){
 await page.locator(selector).evaluate((el,text)=>{const node=el.firstChild,start=node.textContent.indexOf(text),range=document.createRange();range.setStart(node,start);range.setEnd(node,start+text.length);const selection=window.getSelection();selection.removeAllRanges();selection.addRange(range);},text);
 await expect(page.getByRole('button',{name:'Highlight selection',exact:true})).toBeEnabled();
}
test('highlight selection persists through reload, undo and backup without affecting other jobs',async({page})=>{
 await setup(page);await page.getByRole('button',{name:'Highlight text',exact:true}).click();
 await page.locator('.source-description > summary').click();
 await select(page,'.source-advert-text','SQL reporting experience required.');
 await page.getByRole('button',{name:'Highlight selection',exact:true}).click();
 await expect(page.locator('.source-advert-text mark')).toHaveText('SQL reporting experience required.');
 await page.reload();await page.locator('.source-description > summary').click();await expect(page.locator('.source-advert-text mark')).toHaveText('SQL reporting experience required.');
 await page.locator('#pass-job').click();await expect(page.locator('#active-card')).toHaveAttribute('data-job-id','highlight-consultant');await expect(page.locator('mark.listing-highlight')).toHaveCount(0);
 await page.locator('#undo-swipe').click();await expect(page.locator('#active-card')).toHaveAttribute('data-job-id','highlight-ba');await expect(page.locator('mark.listing-highlight')).toHaveCount(1);
 await page.locator('#backup-button').click();const downloaded=page.waitForEvent('download');await page.locator('#export-button').click();const download=await downloaded;const stream=await download.createReadStream();let text='';for await(const chunk of stream)text+=chunk;
 expect(JSON.parse(text).discovery.highlights['highlight-ba'][0].quote).toBe('SQL reporting experience required.');await page.locator('#close-backup').click();
 await page.locator('.saved-highlights > summary').click();await page.getByRole('button',{name:/Remove highlight:/}).click();await expect(page.locator('mark.listing-highlight')).toHaveCount(0);
 await page.reload();await expect(page.locator('mark.listing-highlight')).toHaveCount(0);
});
test('mouse text selection and keyboard/trackpad movement never swipe in highlight mode',async({page})=>{
 await setup(page);await page.getByRole('button',{name:'Highlight text',exact:true}).click();await page.locator('.source-description > summary').click();
 await page.locator('.source-advert-text').scrollIntoViewIfNeeded();const box=await page.locator('.source-advert-text').boundingBox();
 await page.mouse.move(box.x+2,box.y+10);await page.mouse.down();await page.mouse.move(box.x+180,box.y+10,{steps:8});await page.mouse.up();
 expect(await page.evaluate(()=>window.getSelection().toString().length)).toBeGreaterThan(0);
 await page.keyboard.press('ArrowRight');await page.keyboard.press('s');for(let i=0;i<6;i++)await page.mouse.wheel(90,0);
 await expect(page.locator('#active-card')).toHaveAttribute('data-job-id','highlight-ba');await expect(page.locator('#active-card')).not.toHaveClass(/dragging/);
 await page.getByRole('button',{name:'Done highlighting'}).click();await page.evaluate(()=>window.getSelection().removeAllRanges());await page.keyboard.press('ArrowLeft');await expect(page.locator('#active-card')).toHaveAttribute('data-job-id','highlight-consultant');
});
test('qualification text can be highlighted on a narrow screen',async({page})=>{
 await page.setViewportSize({width:390,height:844});await setup(page);await page.getByRole('button',{name:'Highlight text',exact:true}).click();await page.locator('.qualification-details > summary').click();
 const requirement=page.locator('.requirement-text').filter({hasText:'SQL'}).first();
 await requirement.evaluate(el=>{const range=document.createRange();range.selectNodeContents(el);const selection=window.getSelection();selection.removeAllRanges();selection.addRange(range);});
 await page.getByRole('button',{name:'Highlight selection',exact:true}).click();await expect(requirement.locator('mark')).toHaveCount(1);
 expect(await page.locator('#active-card').evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true);
 await requirement.scrollIntoViewIfNeeded();
 await page.screenshot({path:'private/highlights-mobile.png'});
 await page.getByRole('button',{name:'Done highlighting'}).click();await page.locator('#save-job').click();
 await page.locator('.main-nav [data-view="notebook"]').click();await page.locator('[data-edit="highlight-ba"]').click();
 await page.locator('#entry-highlights > summary').click();await expect(page.locator('#entry-highlights blockquote')).toContainText('SQL');
 await page.locator('#entry-highlights button').click();await expect(page.locator('#entry-highlights')).toBeHidden();
});
test('selection across multiple requirements saves only listing passages',async({page})=>{
 await setup(page);await page.getByRole('button',{name:'Highlight text',exact:true}).click();await page.locator('.qualification-details > summary').click();
 await page.evaluate(()=>{const rows=document.querySelectorAll('.requirement-text'),range=document.createRange();range.setStart(rows[0].firstChild,0);range.setEnd(rows[1].firstChild,rows[1].textContent.length);window.getSelection().removeAllRanges();window.getSelection().addRange(range);});
 await page.getByRole('button',{name:'Highlight selection',exact:true}).click();
 await expect(page.locator('.requirement-text mark')).toHaveCount(2);
 await page.locator('.saved-highlights > summary').click();await expect(page.locator('.saved-highlights blockquote')).toHaveCount(2);
 await expect(page.locator('#active-card .saved-highlights')).not.toContainText('Your saved CV');
});
