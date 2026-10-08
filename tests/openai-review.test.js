import test from 'node:test';import assert from 'node:assert/strict';import {z} from 'zod';
import {extractStructured,reviewProvider} from '../server/openai-review.js';
import {generateReview,reviewParagraphs} from '../server/fit-review.js';
import {reviewServiceError} from '../server/review-service.js';
const schema=z.object({answer:z.string()});
const response=(data,status=200)=>({ok:status===200,status,json:async()=>data});
test('direct OpenAI requests use structured output, no stored response, and server-side auth',async()=>{
 let body;
 const result=await extractStructured({instructions:'Compare evidence.',input:'CV and advert',schema},{apiKey:'test-private-key',fetcher:async(url,options)=>{
  assert.equal(url,'https://api.openai.com/v1/responses');assert.equal(options.headers.Authorization,'Bearer test-private-key');body=JSON.parse(options.body);
  return response({status:'completed',output:[{type:'reasoning',summary:[]},{type:'message',content:[{type:'output_text',text:'{"answer":"supported"}'}]}]});
 }});
 assert.equal(result.answer,'supported');assert.equal(body.model,'gpt-6-luna');assert.equal(body.store,false);assert.equal(body.text.format.strict,true);assert.equal(body.reasoning.effort,'medium');assert(!JSON.stringify(body).includes('test-private-key'));
});
test('setup, quota, permission and incomplete errors never leak provider details',async()=>{
 let calls=0;await assert.rejects(extractStructured({schema},{apiKey:'',fetcher:async()=>{calls++;}}),e=>e.serviceCode==='REVIEW_SETUP_REQUIRED');assert.equal(calls,0);
 for(const [status,code,expected] of [[400,'invalid_request','REVIEW_REQUEST_INVALID'],[500,'server_error','REVIEW_PROVIDER_UNAVAILABLE'],[401,'invalid_api_key','REVIEW_SETUP_REQUIRED'],[429,'insufficient_quota','REVIEW_QUOTA_EXHAUSTED'],[429,'credit_balance_exhausted','REVIEW_QUOTA_EXHAUSTED'],[429,'billing_hard_limit_reached','REVIEW_QUOTA_EXHAUSTED'],[429,'rate_limit','REVIEW_BUSY'],[403,'permission_denied','REVIEW_MODEL_UNAVAILABLE']]){
  await assert.rejects(extractStructured({schema},{apiKey:'test',fetcher:async()=>response({error:{code,message:'SECRET key fragment'}},status)}),e=>{assert.equal(e.serviceCode,expected);assert(!JSON.stringify(reviewServiceError(e)).includes('SECRET'));return true;});
 }
 for(const data of [{status:'incomplete',output:[]},{status:'completed',output:[{type:'message',content:[{type:'refusal',refusal:'No'}]}]}])await assert.rejects(extractStructured({schema},{apiKey:'test',fetcher:async()=>response(data)}));
});
test('OpenAI review generation keeps evidence validation and scoring without launching a browser',async()=>{
 const previous=process.env.JOB_NOTEBOOK_REVIEW_PROVIDER;process.env.JOB_NOTEBOOK_REVIEW_PROVIDER='openai';
 const input={job:{title:'Analyst',location:'Germany',description:'Requirements:\nEnglish proficiency is essential.\nSQL experience required.'},profile:{evidence:'SQL reporting.',languages:'English native (C1)',workRights:'',salaryTarget:'',motivation:'',startDate:'',relocation:'',workStyle:''}};
 const result={summary:'English and SQL align.',cv:'Business Analyst CV',cvReason:'Lead with analysis.',points:[{text:'English proficiency',paragraph:3,category:'required',importance:'essential',status:'match',note:'Native English recorded.',cvParagraph:1},{text:'SQL experience',paragraph:4,category:'required',importance:'standard',status:'match',note:'SQL recorded.',cvParagraph:0}],factors:['eligibility','location','pay','career','workStyle','contract'].map(key=>({key,status:'unknown',note:'Not established.',sourceParagraph:-1,cvParagraph:-1})),audit:reviewParagraphs(input).map((_,paragraph)=>({paragraph,kind:paragraph>=3?'required':'heading'})),issues:[]};
 try{
  const review=await generateReview(input,{extract:async request=>{assert(request.input.includes('[C0]'));assert(request.instructions.includes('essential points weighted twice'));const json=z.toJSONSchema(request.schema);assert.equal(json.additionalProperties,false);return result;}});
  assert.equal(review.model,'gpt-6-luna');assert.equal(review.provider,'openai');assert.equal(review.points[0].cvQuote,'English native (C1)');assert.equal(review.breakdown[0].earned,8);assert.equal(reviewProvider().provider,'openai');
 }finally{if(previous===undefined)delete process.env.JOB_NOTEBOOK_REVIEW_PROVIDER;else process.env.JOB_NOTEBOOK_REVIEW_PROVIDER=previous;}
});
