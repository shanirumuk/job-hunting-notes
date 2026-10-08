import test from 'node:test';import assert from 'node:assert/strict';
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
import {parseCVPDF,parsePDFText,pdfPageLines} from '../lib/cv-pdf.js';
import {recordedEmploymentMonths} from '../lib/insights.js';
import {cvPDF,cvLines} from './fixtures/cv-pdf.js';
test('PDF upload extracts contacts, skills and dated work without using career aspirations as evidence',async()=>{
 const file=new File([cvPDF()],'Analyst.pdf',{type:'application/pdf'}),cv=await parseCVPDF(file,{pdfjs});
 assert.equal(cv.name,'Test Applicant');assert.equal(cv.email,'test@example.org');assert.deepEqual(cv.languages,['English C1','German B1']);
 assert.match(cv.evidence,/Experience: .*September 2024 - Present/);assert.match(cv.evidence,/Built API integrations/);assert.doesNotMatch(cv.evidence,/Salesforce/);
 assert.equal(recordedEmploymentMonths(cv,new Date('2026-10-08')),26);
});
test('PDF extraction preserves line boundaries and handles spaced headings and abbreviated months',()=>{
 const cv=parsePDFText(cvLines.join('\n').replace('PROFESSIONAL','PROFES SIONAL').replace('September 2024','Sep 2024'));
 assert.match(cv.evidence,/September 2024/);assert.equal(recordedEmploymentMonths(cv,new Date('2026-10-08')),26);
 assert.deepEqual(pdfPageLines([{str:'English',transform:[0,0,0,0,10,20]},{str:'C1',transform:[0,0,0,0,30,20],hasEOL:true},{str:'German B1',transform:[0,0,0,0,10,5]}]),['English C1','German B1']);
});
test('scanned or unrecognised PDFs and invalid signatures cannot fabricate a CV profile',async()=>{
 assert.throws(()=>parsePDFText(''),/readable text/);assert.throws(()=>parsePDFText('This page contains general content. '.repeat(5)),/sections could not/);
 await assert.rejects(parseCVPDF(new File(['not a pdf'],'CV.pdf')),/valid PDF/);
});
