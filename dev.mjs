import deviceHandler from './api/device.js';
import http from 'node:http';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import handler from './api/jobs.js';
import fitReviewHandler from './api/fit-review.js';
import summaryHandler from './api/summary.js';
import setupHandler from './api/setup.js';
import reviewCacheHandler from './api/review-cache.js';
import browserHandler from './api/browser.js';
import prepareHandler from './api/prepare.js';
import importJobHandler from './api/import-job.js';
import jobAlertsHandler from './api/job-alerts.js';
const root = process.cwd();
const types = {'.html':'text/html', '.js':'text/javascript', '.mjs':'text/javascript', '.css':'text/css', '.json':'application/json', '.zip':'application/zip', '.svg':'image/svg+xml', '.png':'image/png'};
http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if(['/api/import-job','/api/job-alerts'].includes(url.pathname)){
    res.status=code=>{res.statusCode=code;return res;};res.json=data=>{res.setHeader('Content-Type','application/json');res.end(JSON.stringify(data));};
    let body='';for await(const chunk of req){body+=chunk;if(body.length>75000){res.statusCode=413;return res.end('Request too large');}}
    try{req.body=JSON.parse(body||'{}');}catch{return res.status(400).json({error:'Invalid JSON'});}
    return (url.pathname==='/api/job-alerts'?jobAlertsHandler:importJobHandler)(req,res);
  }
  if (['/api/review-cache','/api/fit-review','/api/device','/api/summary','/api/prepare','/api/browser','/api/setup'].includes(url.pathname)) {
    res.status = code => {res.statusCode=code;return res;};
    res.json = data => {res.setHeader('Content-Type','application/json');res.end(JSON.stringify(data));};
    let body='';for await(const chunk of req){body+=chunk;if(body.length>4000000){res.statusCode=413;res.end('Request too large');return;}}
    try{req.body=JSON.parse(body||'{}');}catch{res.statusCode=400;res.end('Invalid JSON');return;}
    return (url.pathname==='/api/review-cache'?reviewCacheHandler:url.pathname==='/api/fit-review'?fitReviewHandler:url.pathname==='/api/device'?deviceHandler:url.pathname==='/api/summary'?summaryHandler:url.pathname==='/api/setup'?setupHandler:url.pathname==='/api/browser'?browserHandler:prepareHandler)(req,res);
  }
  if (url.pathname === '/api/jobs') {
    res.status = code => {res.statusCode = code; return res;};
    res.json = data => {res.setHeader('Content-Type','application/json'); res.end(JSON.stringify(data));};
    return handler(req, res);
  }
  const allowed = /^\/(?:index\.html|practice-application\.html|styles\.css|app\.js|service-worker\.js|manifest\.json|lib\/(?:listing-tabs|job-alerts|email-alert-inbox|application-storage|application-link|application-recovery|discovery-buffer|discovery-candidates|experience-filter|listing-freshness|listing-highlights|qualification-capabilities|profile-corrections|fit-review|cv-json|cv-pdf|job-search-profile|model|geography|insights|summaries|device-crypto|device-store|device-sync|private-recovery)\.js|vendor\/pdfjs\/(?:pdf\.min\.mjs|pdf\.worker\.min\.mjs)|downloads\/job-notebook-helper\.zip|icons\/[a-z0-9.-]+)$/;
  const file = url.pathname === '/' ? '/index.html' : url.pathname;
  if (!allowed.test(file)) {res.writeHead(404); return res.end('Not found');}
  try {const body = await readFile(path.join(root,file)); res.setHeader('Content-Type', types[path.extname(file)] || 'application/octet-stream'); res.setHeader('Cache-Control','no-cache'); res.end(body);}
  catch {res.writeHead(404); res.end('Not found');}
}).listen(Number(process.env.PORT) || 4187, '0.0.0.0', () => console.log('Job notebook: http://localhost:' + (process.env.PORT || 4187)));
