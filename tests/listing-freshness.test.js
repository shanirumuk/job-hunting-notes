import {test} from 'node:test';
import assert from 'node:assert/strict';
import {listingDate,listingFreshness} from '../lib/listing-freshness.js';
const now=Date.parse('2026-10-01T12:00:00Z');
const check=(job,options={})=>listingFreshness(job,{now,...options});
test('provider dates support ISO, seconds and milliseconds without crashing on invalid data',()=>{
 const date='2026-09-30T00:00:00.000Z',ms=Date.parse(date);
 for(const input of [date,ms,ms/1000,String(ms/1000)])assert.equal(listingDate(input),date);
 for(const input of ['',null,undefined,'2024','not a date','2026-02-31',Infinity,1e99])assert.equal(listingDate(input),'');
});
test('old cached postings are hidden; undated and future-dated postings never claim freshness',()=>{
 assert.equal(check({publishedAt:'2024-01-01',fetchedAt:'2026-10-01'}).visible,false);
 assert.equal(check({publishedAt:'2024-01-01'},{includeOlder:true}).visible,true);
 assert.equal(check({publishedAt:'2026-09-30'}).state,'recent');
 for(const job of [{},{publishedAt:'bad'},{publishedAt:'2027-01-01'}]){
  assert.equal(check(job).state,'unknown');assert.equal(check(job).visible,true);
 }
 assert.equal(check({publishedAt:'2026-07-03'}).visible,true);
 assert.equal(check({publishedAt:'2026-07-02'}).visible,false);
});
test('reposted Softtest advert with an old contract start is suspect even with a recent provider date',()=>{
 const job={publishedAt:'2026-09-30',description:'Australian Citizens residing in Australia only respond. Contract start 01 March 2024 to 12 months, 2 x 12 months extensions.'};
 assert.equal(check(job).state,'suspect');assert.equal(check(job).visible,false);
 assert.match(check(job,{includeOlder:true}).label,/2024-03-01/);
 assert.equal(check(job,{includeOlder:true}).visible,true);
});
test('deadlines and expiry dates exclude jobs, including when older listings are enabled',()=>{
 for(const description of ['Applications close 30 September 2026','Closing date: September 30, 2026','Apply by 2026-09-30']){
  assert.equal(check({description},{includeOlder:true}).visible,false);
 }
 assert.equal(check({description:'Applications close 1 October 2026'}).visible,true);
 assert.equal(check({expiresAt:'2026-10-01T10:00:00Z'},{includeOlder:true}).visible,false);
 assert.equal(check({expiresAt:'2026-10-02T10:00:00Z'}).visible,true);
});
test('company history, awards and experience dates do not expire an advert',()=>{
 for(const description of ['Founded in 2024. Award winner in 2024.','Experience using Office 2024 required.','Contract start 1 December 2026.','Closing date: to be confirmed.'])assert.equal(check({description}).visible,true);
});
