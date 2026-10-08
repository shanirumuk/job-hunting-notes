import test from 'node:test';
import assert from 'node:assert/strict';
import {applicationFromFragment,applicationsFromFragment,addLinkedApplication} from '../lib/application-link.js';
const incoming={id:'incoming',company:'Example',title:'Junior Software Engineer',location:'Heilbronn',link:'https://example.com/job/123',status:'Applied',applicationDate:'2026-10-08'};
const fragment=e=>'#add-application='+encodeURIComponent(JSON.stringify(e));
test('an application link adds one entry to an existing notebook and is idempotent',()=>{
 const original=Array.from({length:17},(_,i)=>({...incoming,id:String(i),company:'Company '+i,link:'https://example.com/jobs/'+i,notes:'Keep '+i}));
 const record=applicationFromFragment(fragment({...incoming,profile:{name:'Do not import'},notes:'Do not import'}));
 assert.equal(record.profile,undefined);assert.equal(record.notes,'');
 const first=addLinkedApplication(original,record).entries;
 assert.equal(first.length,18);assert.deepEqual(first.slice(1),original);
 assert.deepEqual(addLinkedApplication(first,record).entries,first);
 assert.equal(original.length,17);
});
test('a linked submission updates a saved copy without losing notes or drafts',()=>{
 const saved={...incoming,id:'local',status:'Preparing',applicationDate:'',notes:'Recruiter details',preparation:{pitch:'My draft'}};
 const result=addLinkedApplication([saved],incoming).entries;
 assert.equal(result.length,1);assert.deepEqual(result[0],{...saved,status:'Applied',applicationDate:'2026-10-08'});
});
test('a repeated link preserves later stages and existing dates',()=>{
 for(const status of ['Applied','Interview','Offer','Archived']){
  const saved={...incoming,id:'local',status,applicationDate:'2026-10-07',notes:'Keep this'};
  assert.deepEqual(addLinkedApplication([saved],incoming).entries,[saved]);
 }
});
test('invalid links fail before any application can be changed',()=>{
 assert.equal(applicationFromFragment('#notebook'),null);
 for(const change of [{link:'javascript:alert(1)'},{status:'Interview'},{applicationDate:'2026-02-30'},{company:''},{title:123}])assert.throws(()=>applicationFromFragment(fragment({...incoming,...change})));
 assert.throws(()=>applicationFromFragment('#add-application=%broken'));
 assert.throws(()=>applicationFromFragment('#add-application='+ 'a'.repeat(6000)));
});
test('a batch is completely validated before use and preserves existing records on repeated recovery',()=>{
 const records=[incoming,{...incoming,id:'second',company:'Second',link:'https://example.com/job/456'},{...incoming,id:'third',company:'Third',link:'https://example.com/job/789'}];
 const makeLink=rows=>'#add-applications='+encodeURIComponent(JSON.stringify(rows));
 const parsed=applicationsFromFragment(makeLink(records));
 const existing=[{...incoming,id:'local',status:'Interview',notes:'Do not change'}];
 const apply=entries=>parsed.reduce((rows,entry)=>addLinkedApplication(rows,entry).entries,entries);
 const result=apply(existing);assert.equal(result.length,3);assert.deepEqual(result.find(e=>e.id==='local'),existing[0]);assert.deepEqual(apply(result),result);
 assert.throws(()=>applicationsFromFragment(makeLink([...records,{...incoming,id:'bad',link:'javascript:evil'}])));
 assert.throws(()=>applicationsFromFragment(makeLink([])));
 assert.throws(()=>applicationsFromFragment(makeLink(Array.from({length:11},(_,i)=>({...incoming,id:String(i)})))));
 assert.throws(()=>applicationsFromFragment(makeLink([incoming,incoming])));
});
