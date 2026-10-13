import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readBuffer,advanceBuffer,canFillBuffer} from '../lib/discovery-buffer.js';
test('a full shortlist waits until five remain before funding another refill',()=>{
 let buffer=advanceBuffer({refilling:true,reviews:2,searches:1},10);
 assert.equal(buffer.refilling,false);
 buffer=advanceBuffer(buffer,6);assert.equal(buffer.refilling,false);assert.equal(buffer.reviews,2);
 buffer=advanceBuffer(buffer,5);assert.deepEqual(buffer,{refilling:true,reviews:12,searches:4});
 assert.equal(advanceBuffer(buffer,7).refilling,true);
 assert.equal(canFillBuffer(buffer,8,2),false);assert.equal(canFillBuffer(buffer,8,1),true);
});
test('a paused spending allowance survives reload and cannot silently fund more checks',()=>{
 const saved={refilling:true,reviews:0,searches:0};assert.deepEqual(advanceBuffer(readBuffer(saved),2),saved);
 assert.equal(canFillBuffer(saved,2),false);
 assert.deepEqual(readBuffer({reviews:-1,searches:100}),{refilling:true,reviews:12,searches:4});
});
