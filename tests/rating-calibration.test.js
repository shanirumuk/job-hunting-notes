import test from 'node:test';
import assert from 'node:assert/strict';
import {scoreReview,reviewClearsDiscovery,ratingCategory} from '../lib/fit-review.js';
import {validateReview,reviewParagraphs} from '../server/fit-review.js';
const factors=['eligibility','location','pay','career','workStyle','contract'].map(key=>({key,status:'unknown',note:'Not recorded.',sourceQuote:'',cvQuote:''}));
const point=(text,status='match',importance='standard')=>({text,status,importance,category:'required'});
const review=points=>({points,factors,issues:[]});

test('essential skills carry more weight and cannot be rescued by optional strengths or lifestyle appeal',()=>{
 const base=review([point('Team leadership','missing','essential'),point('SQL reporting')]);
 const score=scoreReview(base);assert.equal(score.skills,3.3);assert.equal(score.skillsCoverage,100);
 const generous={...base,points:[...base.points, {...point('Jira'),category:'optional'}],factors:factors.map(f=>({...f,status:'match'}))};
 assert.equal(scoreReview(generous).skills,score.skills);assert.equal(scoreReview(generous).overall,score.overall);
 assert.equal(scoreReview(generous).lifestyle,10);assert.equal(reviewClearsDiscovery({...generous,...scoreReview(generous)}),false);
});
test('unknown comparisons withhold a numeric rating; checked but absent evidence stays distinct from inability',()=>{
 const unknown=scoreReview(review([point('SQL'),point('Leadership','unknown'),point('Forecasting','unknown')]));
 assert.equal(unknown.skills,null);assert.equal(unknown.overall,null);assert.equal(unknown.confidence,'low');
 const missing=scoreReview(review([point('Leadership','missing')]));
 assert.equal(missing.skills,0);assert.equal(missing.skillsCoverage,100);assert.equal(missing.requirementCoverage,0);
});
test('discovery uses the evidence floor rather than an optimistic score over only reviewed points',()=>{
 const base=review([point('SQL'),point('APIs'),point('Workshops'),point('Leadership','unknown')]);
 const rated={...base,...scoreReview(base)};
 assert.equal(rated.skills,10);assert.equal(rated.skillsLower,7.5);assert.equal(rated.confidence,'medium');
 assert.equal(reviewClearsDiscovery(rated),true);
 assert.equal(reviewClearsDiscovery({...rated,skillsLower:6}),false);
 assert.equal(reviewClearsDiscovery({...rated,skillsCoverage:69}),false);
 assert.equal(reviewClearsDiscovery({...rated,points:base.points.map(p=>p.text==='Leadership'?{...p,importance:'essential'}:p)}),false);
});
test('equivalent transferable achievements fully support capabilities without inventing management scope',()=>{
 const score=scoreReview(review([{...point('Cross-team coordination'),evidenceKind:'transferable'},point('People management','missing','essential')]));
 assert.equal(score.skills,3.3);
 assert.equal(scoreReview(review([{...point('Cross-team coordination'),evidenceKind:'transferable'}])).skills,10);
});
test('role-type appeal stays separate from a poor vacancy and practical conflicts never reduce skills',()=>{
 const base=review([point('SQL'),point('3+ years in delivery','gap','essential')]);
 const rated=scoreReview({...base,factors:factors.map(f=>({...f,status:f.key==='career'?'match':f.key==='workStyle'?'partial':'unknown'}))});
 assert.equal(rated.skills,10);assert.equal(rated.lifestyle,7.5);assert.equal(rated.overall,3);assert.equal(rated.recommendation,'Skip this vacancy');
 const practical=scoreReview({...review([point('SQL')]),factors:factors.map(f=>({...f,status:f.key==='contract'?'gap':'unknown'}))});
 assert.equal(practical.skills,10);assert.equal(practical.overall,3);
 assert.equal(scoreReview(review([point('SQL')])).overall,10);
});
test('country metadata and contract availability cannot enter skills, even when a model calls them required',()=>{
 const input={job:{title:'Analyst',location:'Germany',description:'Requirements:\nSQL reporting required.\nAvailability: Able to commit for the full contract term.'},profile:{evidence:'Built SQL reporting.',languages:'',workRights:'',salaryTarget:'',motivation:'',workStyle:'',startDate:'',relocation:''}};
 const paragraphs=reviewParagraphs(input);
 const source=paragraph=>({paragraph,sourceQuote:paragraphs[paragraph],text:paragraphs[paragraph],category:'required',importance:'essential',status:'unknown',note:'Unconfirmed.',cvQuote:''});
 const raw={...review([{...source(1)}, {...source(3),status:'match',cvQuote:input.profile.evidence}, source(4)]),summary:'SQL is supported; confirm contract availability.',cv:'Business Analyst CV',cvReason:'SQL reporting.',audit:paragraphs.map((_,paragraph)=>({paragraph,kind:paragraph>=3||paragraph===1?'required':'heading'}))};
 const result=validateReview(raw,input);
 assert.equal(result.skills,10);assert.equal(result.overall,10);
 assert(!result.points.some(p=>p.text==='Germany'));
 assert.equal(result.points.find(p=>p.text.includes('Availability')).category,'practical');
 assert.equal(result.audit.find(a=>a.paragraph===1).kind,'terms');
 assert.equal(ratingCategory(point('Experience leading distributed teams')),'core');
 assert.equal(ratingCategory(point('Availability: commit to this contract')),'practical');
});
test('atomic splitting cannot make a compound skill outweigh a separate essential capability',()=>{
 const leadership={...point('Team leadership','missing','essential'),paragraph:4};
 const whole=scoreReview(review([{...point('SQL and APIs','match','essential'),paragraph:3},leadership]));
 const split=scoreReview(review([{...point('SQL','match','essential'),paragraph:3},{...point('APIs','match','essential'),paragraph:3},leadership]));
 assert.equal(whole.skills,5);assert.equal(split.skills,whole.skills);
 const partial=scoreReview(review([{...point('SQL and APIs','partial','essential'),paragraph:3},leadership]));
 const mixed=scoreReview(review([{...point('SQL','match','essential'),paragraph:3},{...point('APIs','missing','essential'),paragraph:3},leadership]));
 assert.equal(mixed.skills,partial.skills);
});
