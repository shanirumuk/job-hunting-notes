import test from 'node:test';
import assert from 'node:assert/strict';
import {mergeApplicationEntries,ApplicationConflict} from '../lib/application-storage.js';
const entry=(id,extra={})=>({id,company:id,title:'Analyst',status:'To apply',notes:'',...extra});
test('a stale tab adding an application preserves applications added by another tab',()=>{
 const base=[entry('old')],mine=[entry('first'),...base],remote=[entry('second'),...base];
 assert.deepEqual(mergeApplicationEntries(base,mine,remote).map(e=>e.id),['first','old','second']);
 assert.equal(remote.length,2);
});
test('independent edits preserve remote notes and a local status change',()=>{
 const base=[entry('one')],mine=[entry('one',{status:'Applied'})],remote=[entry('one',{notes:'Recruiter called'})];
 assert.deepEqual(mergeApplicationEntries(base,mine,remote),[entry('one',{status:'Applied',notes:'Recruiter called'})]);
});
test('conflicting edits and deletion during editing cannot silently replace another tab',()=>{
 const base=[entry('one')];
 assert.throws(()=>mergeApplicationEntries(base,[entry('one',{notes:'My draft'})],[entry('one',{notes:'Their draft'})]),ApplicationConflict);
 assert.throws(()=>mergeApplicationEntries(base,[entry('one',{notes:'My draft'})],[]),ApplicationConflict);
 assert.throws(()=>mergeApplicationEntries(base,[],[entry('one',{notes:'Their draft'})]),ApplicationConflict);
});
test('unchanged stale entries cannot resurrect a deletion or undo a remote update',()=>{
 const base=[entry('one'),entry('two')],remote=[entry('two',{status:'Interview'})];
 assert.deepEqual(mergeApplicationEntries(base,base,remote),remote);
 assert.deepEqual(mergeApplicationEntries(base,[entry('two')],base),[entry('two')]);
});
