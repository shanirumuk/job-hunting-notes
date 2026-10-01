import test from 'node:test';
import assert from 'node:assert/strict';
import {launchReviewBrowser,reviewServiceError} from '../server/review-service.js';
const failure=Object.assign(new Error('Hidden provider error'),{name:'BrowserbaseSessionError'});
test('provider quota remains identifiable when Stagehand hides the session error',async()=>{
 const client={sessions:{create:async()=>{throw Object.assign(new Error('Private provider detail'),{status:402});}}};
 await assert.rejects(launchReviewBrowser({}, {launch:async()=>{throw failure;},client}),error=>{
  assert.equal(error.status,402);const publicError=reviewServiceError(error);assert.equal(publicError.code,'REVIEW_QUOTA_EXHAUSTED');assert(!publicError.error.includes('Private provider detail'));return true;
 });
});
test('diagnostic sessions are immediately released and successful launches need no probe',async()=>{
 let created=0,released=0;const client={sessions:{create:async()=>{created++;return {id:'diagnostic',projectId:'project'};},update:async(id,body)=>{assert.equal(id,'diagnostic');assert.equal(body.status,'REQUEST_RELEASE');released++;}}};
 assert.equal(await launchReviewBrowser({}, {launch:async()=> 'browser',client}),'browser');assert.equal(created,0);
 await assert.rejects(launchReviewBrowser({}, {launch:async()=>{throw failure;},client}),error=>error===failure);assert.equal(created,1);assert.equal(released,1);
});
