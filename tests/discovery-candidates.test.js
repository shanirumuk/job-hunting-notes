import {test} from 'node:test';import assert from 'node:assert/strict';
import {advertGroupKey,diverseAdverts,compareCandidates} from '../lib/discovery-candidates.js';
test('regional copies do not crowd distinct adverts out of the source pool',()=>{
 const base={company:'Employer',title:'Frontend Engineer',description:'Requirements: React and API experience.'};
 const clones=Array.from({length:30},(_,i)=>({...base,id:String(i),location:'Country '+i})),other={...base,company:'Another',id:'different'};
 assert.equal(advertGroupKey(clones[0]),advertGroupKey(clones[29]));assert.notEqual(advertGroupKey({...base,description:base.description+' German C1 required.'}),advertGroupKey(base));
 assert.deepEqual(diverseAdverts([...clones,other],2).map(j=>j.id),['0','different']);
});
test('CV-specific technical evidence takes priority over generic soft-skill matches',()=>{
 const candidate=(score,evidenceMatches,reason='skills')=>({job:{},fit:{reason,report:{skillsScore:score,evidenceMatches}},match:{score:80}});
 const generic=candidate(5,[]),technical=candidate(4,[{label:'React',requirement:'React experience',evidence:'Built React applications.'}]);
 assert(compareCandidates(technical,generic,{evidence:'Built React applications.'})<0);
 assert(compareCandidates({...technical,fit:{...technical.fit,reason:'experience-unverified'}},generic,{})>0);
});
test('swipe history excludes regional copies after source refresh, without excluding different requirements',async()=>{
 const {decidedAdvertGroups}=await import('../lib/discovery-candidates.js');
 const original={id:'old',company:'Employer',title:'Developer',description:'Requirements: React, SQL and API experience.'};
 const duplicate={...original,id:'copy',location:'Sweden'},different={...original,id:'other',description:original.description+' German C1 required.'};
 const history={old:{id:'old',advertGroup:advertGroupKey(original)}};
 const groups=decidedAdvertGroups([duplicate],{old:'open'},history,[]);
 assert(groups.has(advertGroupKey(duplicate)));assert(!groups.has(advertGroupKey(different)));
 assert.equal(decidedAdvertGroups([duplicate],{},history,[]).size,0);
 assert(decidedAdvertGroups([],{},history,[{...original,requirements:original.description,description:undefined}]).has(advertGroupKey(duplicate)));
});
test('cross-source city formatting deduplicates a vacancy and prefers the employer source',async()=>{
 const {sameJob}=await import('../lib/model.js'),{preferredListingCopies}=await import('../lib/discovery-candidates.js');
 const aggregate={id:'aggregate',company:'Almedia',title:'Junior Software Engineer - Data',location:'Berlin',link:'https://example.org/aggregate',description:'Short provider summary.',source:'Arbeitnow'},primary={...aggregate,id:'primary',location:'Berlin, Germany',link:'https://jobs.ashbyhq.com/almedia/primary',description:'The complete original employer advert.',employerBoard:'almedia',availability:'listed'};
 assert(sameJob(aggregate,primary));assert.deepEqual(preferredListingCopies([aggregate,primary]),[primary]);
 primary.location='Munich, Germany';assert(!sameJob(aggregate,primary));primary.location='Germany';assert(!sameJob(aggregate,primary));
});
