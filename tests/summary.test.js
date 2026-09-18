import test from 'node:test';
import assert from 'node:assert/strict';
import {validateSummary} from '../server/summarize.js';
import handler from '../api/summary.js';
const job={title:'Analyst',location:'Berlin',description:'Analyse API integrations. German B2 required. Salary €60,000/year.'};
const summary={overview:'Analyse API integrations.',essentials:'German B2 required.',benefits:'€60,000/year.',evidence:['Analyse API integrations.','German B2 required.','Salary €60,000/year.']};
test('summary rejects long output and evidence absent from the listing',()=>{
 assert.deepEqual(validateSummary(summary,job),summary);
 assert.throws(()=>validateSummary({...summary,overview:'word '.repeat(46)},job),/Shorten/);
 assert.throws(()=>validateSummary({...summary,evidence:['German not required.']},job),/evidence/);
});
test('summary API requires private authorization before consuming model allowance',async()=>{
 const res={setHeader(){},status(code){this.code=code;return this;},json(body){this.body=body;}};
 await handler({method:'POST',headers:{},body:job},res);assert.equal(res.code,401);
});
