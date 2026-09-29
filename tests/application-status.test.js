import test from 'node:test';
import assert from 'node:assert/strict';
import {changeApplicationStatus,validateEntries} from '../lib/model.js';
test('not-applied corrections clear submission reminders and preserve notes and drafts',()=>{
 const entry={id:'one',company:'Example',title:'Analyst',status:'Applied',applicationDate:'2026-01-01',interviewDate:'2026-02-01',followUpDate:'2026-02-02',notes:'Keep these notes'};
 for(const status of ['Not applied','Preparing','To apply']){
  const next=changeApplicationStatus(entry,status,'2026-09-30');assert.equal(next.applicationDate,'');assert.equal(next.interviewDate,'');assert.equal(next.followUpDate,'');assert.equal(next.notes,entry.notes);assert.equal(validateEntries([next])[0].status,status);
 }
 assert.equal(entry.applicationDate,'2026-01-01');
 assert.equal(changeApplicationStatus({...entry,applicationDate:''},'Applied','2026-09-30').applicationDate,'2026-09-30');
 assert.equal(changeApplicationStatus(entry,'Interview','2026-09-30').applicationDate,'2026-01-01');
 assert.throws(()=>changeApplicationStatus(entry,'delete','2026-09-30'));
});
