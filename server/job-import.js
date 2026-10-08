import https from 'node:https';
import http from 'node:http';
import {lookup} from 'node:dns/promises';
import {BlockList, isIP} from 'node:net';
import {plainText,descriptionText,safeURL} from '../lib/model.js';

const blocked=new BlockList();
for(const [address,prefix] of [['0.0.0.0',8],['10.0.0.0',8],['100.64.0.0',10],['127.0.0.0',8],['169.254.0.0',16],['172.16.0.0',12],['192.0.0.0',24],['192.0.2.0',24],['192.168.0.0',16],['198.18.0.0',15],['198.51.100.0',24],['203.0.113.0',24],['224.0.0.0',4],['240.0.0.0',4]])blocked.addSubnet(address,prefix,'ipv4');
const globalV6=new BlockList();globalV6.addSubnet('2000::',3,'ipv6');
export function publicAddress(address){
 const family=isIP(address);
 if(family===4)return !blocked.check(address,'ipv4');
 // Reject local, mapped IPv4, transition and documentation addresses.
 return family===6&&globalV6.check(address,'ipv6')&&!/^2001:(?:0:|db8:)|^2002:/i.test(address);
}
export function importURL(value){
 const safe=safeURL(value);if(!safe||safe.length>4000)throw Error('Use a public https or http job listing link.');
 const url=new URL(safe);
 if(url.port||url.hostname==='localhost'||url.hostname.endsWith('.local')||url.hostname.endsWith('.internal'))throw Error('Use a public job listing link.');
 url.hash='';return url;
}

// Resolve and pin the socket to a public address, including on every redirect.
// Never forward cookies, credentials or the applicant profile to a source site.
export async function fetchPublicHTML(value,redirects=0,deadline=Date.now()+20000){
 const url=importURL(value),host=url.hostname.replace(/^\[|\]$/g,'');
 const remaining=()=>Math.max(1,deadline-Date.now());
 let dnsTimer,addresses;
 try{addresses=await Promise.race([lookup(host,{all:true}),new Promise((_,reject)=>{dnsTimer=setTimeout(()=>reject(Error('The listing took too long to respond.')),remaining());dnsTimer.unref();})]);}finally{clearTimeout(dnsTimer);}
 if(!addresses.length||addresses.some(a=>!publicAddress(a.address)))throw Error('Use a public job listing link.');
 if(Date.now()>=deadline)throw Error('The listing took too long to respond.');
 return new Promise((resolve,reject)=>{
  const client=url.protocol==='https:'?https:http;
  const address=addresses[0];
  const request=client.get(url,{headers:{Accept:'text/html,application/xhtml+xml','User-Agent':'JobNotebook/1.0 (user-requested job listing import)'},lookup:(_host,options,callback)=>options.all?callback(null,[address]):callback(null,address.address,address.family)},response=>{
   if([301,302,303,307,308].includes(response.statusCode)&&response.headers.location){
    response.resume();if(redirects>=4)return reject(Error('This link redirects too many times. Use the employer’s job listing link.'));
    resolve(fetchPublicHTML(new URL(response.headers.location,url).href,redirects+1,deadline));return;
   }
   if(response.statusCode!==200){response.resume();reject(Error('This site could not share the listing. Try the employer’s careers link or paste the advert below.'));return;}
   if(!/text\/html|application\/xhtml\+xml/i.test(response.headers['content-type']||'')){response.resume();reject(Error('This link is not a readable job listing page.'));return;}
   let size=0;const chunks=[];
   response.on('data',chunk=>{size+=chunk.length;if(size>2000000){response.destroy();reject(Error('This page is too large. Use the direct job listing link.'));}else chunks.push(chunk);});
   response.on('end',()=>resolve({html:Buffer.concat(chunks).toString('utf8'),url:url.href}));response.on('error',reject);
  });
  const timer=setTimeout(()=>request.destroy(Error('The listing took too long to respond. Try the direct employer link.')),remaining());
  request.on('close',()=>clearTimeout(timer));request.on('error',reject);
 });
}
function postings(value,result=[],depth=0){
 if(depth>12||!value||typeof value!=='object')return result;
 if([value['@type']].flat().includes('JobPosting'))result.push(value);
 for(const child of Object.values(value))if(child&&typeof child==='object')postings(child,result,depth+1);
 return result;
}
export function parseJobPage(html,url){
 const jobs=[];
 for(const script of html.matchAll(/<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)){
  try{postings(JSON.parse(script[1].trim()),jobs);}catch{/* Some sites include malformed unrelated structured data. */}
 }
 // Application links may contain other vacancies; prefer the page's matching URL.
 const job=jobs.find(j=>safeURL(j.url)===safeURL(url))||jobs[0];
 if(!job||typeof job.title!=='string'||typeof job.description!=='string'||!plainText(job.title)||!plainText(job.description))throw Error('This page did not expose a complete job listing. Try the employer’s job page or paste the advert below.');
 const organization=typeof job.hiringOrganization==='string'?job.hiringOrganization:job.hiringOrganization?.name;
 const company=typeof organization==='string'?plainText(organization):'';
 if(!company)throw Error('The employer could not be read from this page. Try the employer’s job page or paste the advert below.');
 const locations=[job.jobLocation||[]].flat().filter(Boolean).map(place=>{
  const address=place.address||place;return [address.addressLocality,address.addressRegion,address.addressCountry&&typeof address.addressCountry==='object'?address.addressCountry.name:address.addressCountry].filter(Boolean).map(plainText).join(', ');
 }).filter(Boolean);
 const remote=[job.jobLocationType].flat().some(t=>/TELECOMMUTE/i.test(t||''));
 const restrictions=[job.applicantLocationRequirements||[]].flat().filter(Boolean).map(p=>plainText(p.name||'')).filter(Boolean);
 const location=[...new Set(locations.length?locations:restrictions)].join(' · ')||(remote?'Remote · check permitted countries':'Location not stated');
 const source=/(^|\.)linkedin\.com$/i.test(new URL(url).hostname)?'LinkedIn':'Employer listing';
 return {company:company.slice(0,90),title:plainText(job.title).slice(0,120),location:location.slice(0,100),description:descriptionText(job.description).slice(0,24000),link:url,remote,publishedAt:job.datePosted||'',expiresAt:job.validThrough||'',source};
}
export async function importJob(url){const page=await fetchPublicHTML(url);return parseJobPage(page.html,page.url);}
