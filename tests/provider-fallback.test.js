import test from 'node:test';
import assert from 'node:assert/strict';
import {withProviderFallback} from '../server/provider-fallback.js';
const providers=[{provider:'openai',configured:true},{provider:'browserbase',configured:true}];
const failure=(serviceCode,status=503)=>Object.assign(new Error('private provider message'),{serviceCode,status});
test('quota switches provider once, keeps provenance, cools down and recovers',async()=>{
 let clock=0;const state=new Map(),calls=[];
 const options={providers,state,now:()=>clock};
 const run=async provider=>{calls.push(provider.provider);if(provider.provider==='openai')throw failure('REVIEW_QUOTA_EXHAUSTED',402);return {overall:6};};
 const first=await withProviderFallback(run,options);
 assert.equal(first.value.overall,6);assert.equal(first.provider.provider,'browserbase');assert.equal(first.fallback.reason,'allowance exhausted');
 await withProviderFallback(run,options);assert.deepEqual(calls,['openai','browserbase','browserbase']);
 clock=300001;const recovered=await withProviderFallback(async provider=>provider.provider,options);
 assert.equal(recovered.value,'openai');assert.equal(recovered.fallback,null);
});
test('temporary failures also switch, without an infinite retry loop',async()=>{
 for(const error of [failure('REVIEW_BUSY',429),failure('REVIEW_PROVIDER_UNAVAILABLE'),Object.assign(new Error(),{status:502}),Object.assign(new Error(),{name:'TimeoutError'})]){
  let calls=0;const result=await withProviderFallback(async()=>{if(++calls===1)throw error;return 'review';},{providers,state:new Map()});
  assert.equal(result.value,'review');assert.equal(calls,2);
 }
});
test('refusals, credentials, model permissions, token limits and validation do not switch',async()=>{
 for(const error of [failure('REVIEW_REFUSED'),failure('REVIEW_SETUP_REQUIRED'),failure('REVIEW_MODEL_UNAVAILABLE'),failure('REVIEW_INCOMPLETE'),failure('REVIEW_REQUEST_INVALID'),new Error('Evidence not found')]){
  let calls=0;await assert.rejects(withProviderFallback(async()=>{calls++;throw error;},{providers,state:new Map()}),e=>e===error);assert.equal(calls,1);
 }
});
test('all exhausted returns an actionable safe message, never a fabricated rating',async()=>{
 let calls=0;const options={providers,state:new Map()};
 for(let i=0;i<2;i++)await assert.rejects(withProviderFallback(async()=>{calls++;throw failure('REVIEW_QUOTA_EXHAUSTED',402);},options),e=>e.status===402&&e.message.includes('all configured providers')&&!e.message.includes('private'));
 assert.equal(calls,2);
});
test('one configured provider does not attempt an unconfigured backup',async()=>{
 let calls=0;await assert.rejects(withProviderFallback(async()=>{calls++;throw failure('REVIEW_BUSY',429);},{providers:providers.slice(0,1),state:new Map()}));assert.equal(calls,1);
});
test('attempt timeouts use remaining budget and preserve time for a backup',async()=>{
 let clock=0;const times=[];
 await withProviderFallback(async(provider,timeLeft)=>{
  times.push(timeLeft());clock+=20000;times.push(timeLeft());
  if(provider.provider==='openai')throw failure('REVIEW_BUSY',429);return 'done';
 },{providers,state:new Map(),budgetMs:100000,now:()=>clock});
 assert.deepEqual(times,[45000,25000,75000,55000]);
});
