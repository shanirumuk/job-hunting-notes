import test from 'node:test';
import assert from 'node:assert/strict';
import {validateReview,reviewParagraphs,reviewInput} from '../server/fit-review.js';
import {scoreReview,factorWeights,reviewInsights,reviewClearsDiscovery} from '../lib/fit-review.js';
import {createFitReviewHandler} from '../api/fit-review.js';
export const input={job:{title:'Analyst',location:'Germany',description:'Requirements:\nEnglish proficiency is essential.\nSQL experience required.\nBenefits:\n30 days of holiday.'},profile:{evidence:'SQL reporting.',languages:'English native (C1)',workRights:'',salaryTarget:'',motivation:'',startDate:'',relocation:''}};
export const output={summary:'English and SQL align with your evidence. Confirm the working arrangements.',cv:'Business Analyst CV',cvReason:'Lead with SQL reporting.',points:[{text:'English proficiency',paragraph:3,sourceQuote:'English proficiency is essential.',category:'required',importance:'essential',status:'match',note:'Native English is recorded.',cvQuote:'English native (C1)'},{text:'SQL experience',paragraph:4,sourceQuote:'SQL experience required.',category:'required',importance:'standard',status:'match',note:'SQL reporting is recorded.',cvQuote:'SQL reporting.'}],factors:Object.keys(factorWeights).map(key=>({key,status:'unknown',note:'Not established in the advert and profile.',sourceQuote:'',cvQuote:''})),audit:reviewParagraphs(input).map((_,paragraph)=>({paragraph,kind:paragraph===3||paragraph===4?'required':paragraph===2||paragraph===5?'heading':paragraph===6?'benefit':'background'})),issues:[]};
test('full review validates every paragraph, requirement and evidence quote',()=>{
 const result=validateReview(output,input);assert.equal(result.overall,10);assert.equal(result.coverage,100);assert.equal(result.provisional,true);
 assert.throws(()=>validateReview({...output,audit:output.audit.slice(1)},input),/every supplied paragraph/);
 const missing=validateReview({...output,points:output.points.slice(1)},input);assert.equal(missing.points.length,2);assert.equal(missing.points.find(p=>p.paragraph===3).status,'unknown');assert.equal(missing.skills,null);
 assert.throws(()=>validateReview({...output,points:output.points.map(p=>({...p,cvQuote:'Invented degree'}))},input),/CV quotation/);
 assert.throws(()=>validateReview({...output,points:output.points.map(p=>({...p,sourceQuote:'Invented requirement'}))},input),/exact quote/);
 assert(validateReview({...output,factors:output.factors.map(f=>({...f,status:'gap'}))},input).factors.every(f=>f.status==='unknown'));
 const unsupported=validateReview({...output,points:output.points.map(p=>({...p,cvQuote:''}))},input);assert.equal(unsupported.overall,null);assert(unsupported.points.every(p=>p.status==='unknown'));
 assert.equal(reviewInput.parse({...input,profile:{...input.profile,email:'private@example.org'}}).profile.email,undefined);
});
test('optional extras and unknown preferences cannot dilute skills, while confirmed conflicts cap recommendations',()=>{
 const practical={...output,factors:output.factors.map(f=>({...f,status:'match'}))};assert.equal(scoreReview(practical).overall,10);
 const conflict={...practical,factors:practical.factors.map(f=>f.key==='location'?{...f,status:'gap'}:f)};
 assert.equal(scoreReview(conflict).overall,3);assert.match(scoreReview(conflict).cap,/practical conflict/);
 const essential={...practical,points:practical.points.map((p,i)=>i===0?{...p,status:'gap'}:p)};assert.equal(scoreReview(essential).overall,3);
 const extra={...output,points:[...output.points,{...output.points[0],category:'optional',status:'missing'}]};assert.equal(scoreReview(extra).overall,10);assert.deepEqual(scoreReview(extra).bonus,{supported:0,total:1});
 const unknown={...output,points:output.points.map(p=>({...p,status:'unknown'}))};assert.equal(scoreReview(unknown).overall,null);assert.equal(scoreReview(unknown).coverage,0);
 assert.equal(reviewInsights(extra).requirements.at(-1).missing,true);
});
test('full review endpoint rejects unauthenticated and invalid requests without a model call',async()=>{
 let calls=0;const handler=createFitReviewHandler(async()=>{calls++;return {test:true};});
 const previous=process.env.JOB_NOTEBOOK_ACCESS_TOKEN;process.env.JOB_NOTEBOOK_ACCESS_TOKEN='t'.repeat(43);
 const call=async(body,token)=>{const res={setHeader(){},status(n){this.code=n;return this;},json(data){this.data=data;}};await handler({method:'POST',headers:{authorization:token?'Bearer '+token:''},body},res);return res;};
 try{assert.equal((await call(input)).code,401);assert.equal((await call({},'t'.repeat(43))).code,400);assert.equal(calls,0);assert.equal((await call(input,'t'.repeat(43))).code,200);assert.equal(calls,1);}finally{if(previous===undefined)delete process.env.JOB_NOTEBOOK_ACCESS_TOKEN;else process.env.JOB_NOTEBOOK_ACCESS_TOKEN=previous;}
});

test('private profile corrections require authentication and expose only the configured correction',async()=>{
 const {default:handler}=await import('../api/setup.js');
 const previous=process.env.JOB_NOTEBOOK_ACCESS_TOKEN,oldCorrection=process.env.JOB_NOTEBOOK_PROFILE_CORRECTIONS;
 process.env.JOB_NOTEBOOK_ACCESS_TOKEN='p'.repeat(43);process.env.JOB_NOTEBOOK_PROFILE_CORRECTIONS=JSON.stringify({id:'test-native',languages:'English native (C1)',relocation:'Open to relocation; consider contract length.'});
 const call=token=>{const res={setHeader(){},status(code){this.code=code;return this;},json(data){this.data=data;}};handler({method:'POST',headers:{authorization:token?'Bearer '+token:''},body:{action:'profile-corrections'}},res);return res;};
 try{assert.equal(call().code,401);const result=call('p'.repeat(43));assert.equal(result.code,200);assert.equal(result.data.cvs,undefined);assert.equal(result.data.correction.languages,'English native (C1)');}finally{for(const [key,value]of Object.entries({JOB_NOTEBOOK_ACCESS_TOKEN:previous,JOB_NOTEBOOK_PROFILE_CORRECTIONS:oldCorrection})){if(value===undefined)delete process.env[key];else process.env[key]=value;}}
});

test('live-review regressions keep OR alternatives together and correct model date arithmetic',()=>{
 const source={...input,job:{title:'Customer Success Specialist',location:'Portugal',description:'Requirements:\n3+ years of client-facing experience.\nBlockchain or AML knowledge.'},profile:{...input.profile,evidence:'Experience: Developer · Example · September 2024 - Present\nExperience: Freelance · Example · April 2024 - December 2024'}};
 const point={category:'required',importance:'essential',status:'missing',cvQuote:'',note:'Not recorded.'};
 const raw={...output,points:[{...point,status:'partial',evidenceKind:'transferable',cvQuote:source.profile.evidence,paragraph:3,text:'3+ years of client-facing experience',sourceQuote:'3+ years of client-facing experience.'},{...point,paragraph:4,text:'Blockchain knowledge',sourceQuote:'Blockchain or AML knowledge.'},{...point,paragraph:4,text:'AML knowledge',sourceQuote:'Blockchain or AML knowledge.'}],audit:reviewParagraphs(source).map((_,paragraph)=>({paragraph,kind:paragraph>=3?'required':'heading'}))};
 const review=validateReview(raw,source,new Date('2026-09-30T12:00:00Z'));assert.equal(review.points.length,2);assert.equal(review.points[0].status,'gap');assert.equal(review.points[0].evidenceKind,'none');assert.match(review.points[0].note,/dated CV history/);assert.equal(review.points[1].text,'Blockchain or AML knowledge.');
});

test('mixed optional clauses survive a model omission and relocation openness is not penalised',()=>{
 const source={...input,job:{title:'Analyst',location:'Portugal',description:'Requirements:\nEnglish proficiency is essential, fluency in other languages is a strong plus.'},profile:{...input.profile,relocation:'Relocation is fine; consider contract length.'}};
 const raw={...output,points:[{...output.points[0],sourceQuote:'English proficiency is essential, fluency in other languages is a strong plus.'}],audit:reviewParagraphs(source).map((_,paragraph)=>({paragraph,kind:paragraph===3?'required':'heading'}))};
 const review=validateReview(raw,source);assert.equal(review.points.filter(p=>p.category==='optional').length,1);assert.equal(review.factors.find(f=>f.key==='location').status,'match');assert.match(review.factors.find(f=>f.key==='location').note,/Work rights are checked separately/);assert.equal(review.factors.find(f=>f.key==='eligibility').status,'unknown');
});

test('task overlap stays separate from work-style preferences in the new rubric',()=>{
 const review={...output,points:[...output.points,{...output.points[0],text:'Run ecommerce A/B tests',category:'duty',status:'missing',cvQuote:''}]};
 const score=scoreReview(review);assert.equal(score.skills,10);assert.equal(score.work,0);assert.equal(score.overall,10);assert.equal(score.provisional,true);
});

test('CV choice follows the role focus rather than guessing separate PDF contents from merged evidence',()=>{
 for(const title of ['Customer Success Specialist','Business Consultant']){
  const review=validateReview(output,{...input,job:{...input.job,title}});assert.equal(review.cv,'Consulting CV');
 }
});

test('review slots expire after terminated requests and late completions do not release newer slots',async()=>{
 let now=0;const releases=[];
 const handler=createFitReviewHandler(()=>new Promise(resolve=>releases.push(resolve)),()=>now);
 const previous=process.env.JOB_NOTEBOOK_ACCESS_TOKEN;process.env.JOB_NOTEBOOK_ACCESS_TOKEN='q'.repeat(43);
 const call=async()=>{const res={headers:{},setHeader(k,v){this.headers[k]=v;},status(code){this.code=code;return this;},json(data){this.data=data;}};await handler({method:'POST',headers:{authorization:'Bearer '+'q'.repeat(43)},body:input},res);return res;};
 try{
  const first=call(),second=call();const busy=await call();assert.equal(busy.code,429);assert.equal(busy.headers['Retry-After'],'15');
  now=300001;const third=call(),fourth=call();assert.equal(releases.length,4);
  releases[0]({});releases[1]({});await Promise.all([first,second]);assert.equal((await call()).code,429);
  releases[2]({});releases[3]({});assert((await Promise.all([third,fourth])).every(r=>r.code===200));
 }finally{if(previous===undefined)delete process.env.JOB_NOTEBOOK_ACCESS_TOKEN;else process.env.JOB_NOTEBOOK_ACCESS_TOKEN=previous;}
});
test('skills and experience arithmetic is stable across models and point order',()=>{
 const point=(text,status,category='required')=>({text,status,category,importance:'standard'});
 const review={points:[point('SQL','match'),point('Requirements','match'),point('System design','partial'),point('Figma','gap'),point('Optional tool A','match','optional'),point('Optional tool B','missing','optional'),point('3+ years of analyst experience','partial')],factors:output.factors.map(f=>({...f,status:f.key==='career'?'match':f.key==='workStyle'?'partial':'unknown'})),issues:[]};
 const score=scoreReview(review);assert.equal(score.overall,6);assert.deepEqual(score.breakdown.map(g=>g.earned),[5,1]);assert.equal(score.cap,'');
 assert.equal(scoreReview({...review,points:[...review.points].reverse()}).overall,6);
 assert.equal(scoreReview({...review,factors:review.factors.map(f=>f.key==='location'?{...f,status:'gap'}:f)}).overall,3);
 assert.equal(scoreReview({...review,points:[...review.points,point('German fluency','gap')]}).overall,3);
 assert.equal(scoreReview({...review,points:review.points.map(p=>p.text==='Figma'?{...p,importance:'essential'}:p)}).overall,3);
});


test('required skills do not lose points for optional extras and uncertainty has explicit bounds',()=>{
 const base=scoreReview(output),optional=scoreReview({...output,points:[...output.points,{...output.points[0],category:'optional',status:'missing',cvQuote:''}]});
 assert.equal(base.skills,10);assert.equal(optional.skills,10);assert.equal(base.overallUpper,10);assert.equal(base.overall,base.overallUpper);
 const partial=scoreReview({...output,points:output.points.map(p=>({...p,status:'partial'}))});assert.equal(partial.requirementCoverage,50);
 const missing=scoreReview({...output,points:output.points.map(p=>({...p,status:'missing',cvQuote:''}))});assert.equal(missing.coverage,100);assert.equal(missing.requirementCoverage,0);assert.equal(missing.overallUpper,5);
});


test('discovery never uses a high skills score to override missing relevant years or work-right conflicts',()=>{
 const base={...output,skills:8};assert.equal(reviewClearsDiscovery(base),true);
 for(const status of ['unknown','missing','partial','gap'])assert.equal(reviewClearsDiscovery({...base,points:[...base.points,{text:'2+ years of implementation experience',category:'required',status}]}),false);
 assert.equal(reviewClearsDiscovery({...base,points:[...base.points,{text:'2+ years of implementation experience',category:'required',status:'match'}]}),true);
 assert.equal(reviewClearsDiscovery({...base,factors:base.factors.map(f=>f.key==='eligibility'?{...f,status:'gap'}:f)}),false);
});
