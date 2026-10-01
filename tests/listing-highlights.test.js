import test from 'node:test';
import assert from 'node:assert/strict';
import {anchorHighlight,highlightOffset,validHighlights} from '../lib/listing-highlights.js';
test('highlights follow unchanged text and context after text is inserted above',()=>{
 const text='Background. '.repeat(5)+'SQL and API experience required. French optional.';
 const at=text.indexOf('SQL'),anchor=anchorHighlight(text,at,at+22,'advert');
 assert.equal(highlightOffset(text,anchor),at);
 assert.equal(highlightOffset('New paragraph. '+text,anchor),at+15);
 assert.equal(highlightOffset(text.replace('SQL and API','Excel and SQL'),anchor),-1);
});
test('blank and malformed highlights are rejected and duplicate quotes use context',()=>{
 assert.equal(anchorHighlight('   ',0,3,'advert'),null);
 const text='SQL for reporting. SQL for migration.';
 const anchor=anchorHighlight(text,19,22,'advert');
 assert.equal(anchor.quote,'SQL');assert.equal(highlightOffset(text,anchor),19);
 assert.deepEqual(validHighlights([{...anchor,quote:3},anchor,{...anchor,prefix:'x'.repeat(40)}]),[anchor]);
});
