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
