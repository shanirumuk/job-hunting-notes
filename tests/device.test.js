import {test} from 'node:test';
import assert from 'node:assert/strict';
import {secret,seal,open,base64,digest,validateNotebook,counts} from '../lib/device-crypto.js';
import {defaultProfile} from '../lib/model.js';
test('encrypted notebook round trip rejects tampering, wrong key and different purpose',async()=>{
 const key=secret(),data={private:'contact details and notes'},e=await seal(data,key,'vault');
 assert.deepEqual(await open(e,key,'vault'),data);assert.ok(!JSON.stringify(e).includes('contact'));
 await assert.rejects(open(e,secret(),'vault'));await assert.rejects(open(e,key,'transfer'));
 await assert.rejects(open({...e,ciphertext:'AAAA'+e.ciphertext.slice(4)},key,'vault'));
});
test('PDF integrity validates exact original bytes and real preview counts',async()=>{
 const pdf=new TextEncoder().encode('%PDF-1.7\nTest original PDF'),cv={name:'Original.pdf',base64:base64(pdf),sha256:await digest(pdf)};
 const p={version:1,entries:Array.from({length:5},(_,i)=>({id:String(i),company:'Test',title:'Analyst',status:'Applied'})),profile:defaultProfile,discovery:{jobs:[],decisions:{a:'pass'}},connection:null,cvs:{consulting:cv,analyst:cv,developer:cv}};
 assert.equal((await validateNotebook(p)).cvs.consulting.base64,cv.base64);assert.deepEqual(counts(p),{applications:5,pdfs:3,drafts:0,swipes:1});
 await assert.rejects(validateNotebook({...p,cvs:{consulting:{...cv,sha256:'wrong'}}}));
});
test('private API enforces owner access, one receiver, expiration and compare-and-swap',async()=>{
 const {createDeviceHandler}=await import('../api/device.js');const {vaultId,pairId}=await import('../lib/device-crypto.js');
 const previous=process.env.JOB_NOTEBOOK_ACCESS_TOKEN,owner=secret();process.env.JOB_NOTEBOOK_ACCESS_TOKEN=owner;
 const files=new Map();let version=0;const handler=createDeviceHandler({get:async(p,options)=>{assert.equal(options.headers['Accept-Encoding'],'identity');const f=files.get(p);return f?{stream:new Blob([f.text]).stream(),blob:{etag:f.etag}}:null;},put:async(p,text,o)=>{const f=files.get(p);if(f&&(!o.allowOverwrite||o.ifMatch!==f.etag)){const e=Error();e.name='BlobPreconditionFailedError';throw e;}const etag=String(++version);files.set(p,{text,etag});return {etag};}});
 const call=async(b,token)=>{let code=200,data;await handler({method:'POST',headers:{authorization:'Bearer '+token},body:b},{setHeader(){},status(n){code=n;return this;},json(d){data=d;}});return {code,data};};
 try{
 const access=secret(),id=await vaultId(access),encrypted=await seal({test:1},secret(),'vault');
 assert.equal((await call({action:'create',id,access,encrypted},secret())).code,401);
 const created=await call({action:'create',id,access,encrypted},owner);assert.equal(created.code,200);
 assert.equal((await call({action:'read',id},secret())).code,401);
 assert.equal((await call({action:'write',id,encrypted,etag:'stale'},access)).code,409);
 assert.equal((await call({action:'write',id,encrypted,etag:created.data.etag},access)).code,200);
 const pair=await pairId(secret()),receiver=secret();await call({action:'pair-create',id:pair,encrypted},owner);
 assert.equal((await call({action:'pair-claim',id:pair},receiver)).code,200);
 assert.equal((await call({action:'pair-claim',id:pair},secret())).code,410);
 assert.equal((await call({action:'pair-confirm',id:pair},receiver)).code,200);
 assert.equal((await call({action:'pair-claim',id:pair},receiver)).code,410);
 assert.equal(JSON.parse(files.get(`pairings/${pair}.json`).text).encrypted,null);
 const expired=await pairId(secret());await call({action:'pair-create',id:expired,encrypted},owner);const file=files.get(`pairings/${expired}.json`);file.text=JSON.stringify({...JSON.parse(file.text),expires:0});
 assert.equal((await call({action:'pair-claim',id:expired},secret())).code,410);
 }finally{if(previous===undefined)delete process.env.JOB_NOTEBOOK_ACCESS_TOKEN;else process.env.JOB_NOTEBOOK_ACCESS_TOKEN=previous;}
});
