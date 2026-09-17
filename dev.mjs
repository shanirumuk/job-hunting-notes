import http from 'node:http';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import handler from './api/jobs.js';
import prepareHandler from './api/prepare.js';
const root = process.cwd();
const types = {'.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.json':'application/json', '.svg':'image/svg+xml', '.png':'image/png'};
http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname === '/api/prepare') {
    res.status = code => {res.statusCode=code;return res;};
    res.json = data => {res.setHeader('Content-Type','application/json');res.end(JSON.stringify(data));};
    let body='';for await(const chunk of req){body+=chunk;if(body.length>4000000){res.statusCode=413;res.end('Request too large');return;}}
    try{req.body=JSON.parse(body||'{}');}catch{res.statusCode=400;res.end('Invalid JSON');return;}
    return prepareHandler(req,res);
  }
  if (url.pathname === '/api/jobs') {
    res.status = code => {res.statusCode = code; return res;};
    res.json = data => {res.setHeader('Content-Type','application/json'); res.end(JSON.stringify(data));};
    return handler(req, res);
  }
  const allowed = /^\/(?:index\.html|practice-application\.html|styles\.css|app\.js|service-worker\.js|manifest\.json|lib\/model\.js|icons\/[a-z0-9.-]+)$/;
  const file = url.pathname === '/' ? '/index.html' : url.pathname;
  if (!allowed.test(file)) {res.writeHead(404); return res.end('Not found');}
  try {const body = await readFile(path.join(root,file)); res.setHeader('Content-Type', types[path.extname(file)] || 'application/octet-stream'); res.setHeader('Cache-Control','no-cache'); res.end(body);}
  catch {res.writeHead(404); res.end('Not found');}
}).listen(Number(process.env.PORT) || 4187, '0.0.0.0', () => console.log('Job notebook: http://localhost:' + (process.env.PORT || 4187)));
