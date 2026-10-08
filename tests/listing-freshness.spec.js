import {test,expect} from '@playwright/test';
const base={company:'Example',title:'Business Analyst',location:'Berlin, Germany',description:'Business requirements, stakeholder workshops and API implementation.',link:'https://example.org/job'};
const recent={...base,id:'recent',link:'https://example.org/recent',company:'Recent',publishedAt:new Date().toISOString()};
const old={...base,id:'old',link:'https://example.org/old',company:'Old advert',publishedAt:'2024-03-01'};
const repost={...base,id:'repost',link:'https://example.org/repost',company:'Softtest',publishedAt:new Date().toISOString(),description:base.description+' Contract start 01 March 2024 to 12 months, 2 x 12 months extensions.'};
const expired={...base,id:'expired',link:'https://example.org/expired',company:'Expired',expiresAt:'2024-03-01'};
test('cached old and reposted adverts are hidden, optional older filter persists, saved applications survive',async({page})=>{
 await page.addInitScript(({jobs,old})=>{
  if(localStorage.getItem('freshness-test'))return;
  localStorage.setItem('freshness-test','1');
  localStorage.setItem('job-notebook-international-v23','1');localStorage.setItem('job-notebook-discovery-v26','1');
  localStorage.setItem('job-notebook-discovery-v1',JSON.stringify({jobs,decisions:{},fetchedAt:new Date().toISOString(),nextPage:null,nextSearch:null}));
  localStorage.setItem('job-notebook-v1',JSON.stringify([{...old,id:'saved-old',link:'https://example.org/saved-old',title:'Saved old application',status:'Applied',applicationDate:'2024-03-01'}]));
 },{jobs:[old,repost,expired,recent],old});
 await page.route('**/api/jobs*',r=>r.fulfill({json:{jobs:[old,repost,expired,recent],nextPage:null,nextSearch:null,fetchedAt:new Date().toISOString()}}));
 await page.goto('/');
 await expect(page.locator('#active-card')).toHaveAttribute('data-job-id','recent');
 await expect(page.locator('.listing-date')).toContainText('Source posting date:');
 await page.locator('#location-filter').click();await page.locator('#filter-more summary').click();await page.locator('#filter-older-listings').check();await page.locator('#apply-locations').click();
 await expect(page.locator('#active-card')).toHaveAttribute('data-job-id','old');
 await expect(page.locator('.listing-date')).toContainText('Older listing');
 await page.reload();await expect(page.locator('#active-card')).toHaveAttribute('data-job-id','old');
 await page.locator('#pass-job').click();await expect(page.locator('#active-card')).toHaveAttribute('data-job-id','repost');
 await expect(page.locator('.listing-date')).toContainText('May be outdated');
 await page.locator('#pass-job').click();await expect(page.locator('#active-card')).toHaveAttribute('data-job-id','recent');
 await page.locator('[data-view="notebook"]').first().click();await expect(page.locator('#applications')).toContainText('Saved old application');
});
