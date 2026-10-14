// Keep the direct dependency visible to serverless dependency tracing.
import './model.js';
import {sameJob,plainText} from './model.js?v=89';

export function linkedInJobURL(value){
 try{
  const url=new URL(value);
  if(url.protocol!=='https:'||url.username||url.password||url.port||!/(^|\.)linkedin\.com$/i.test(url.hostname))return '';
  const match=url.pathname.match(/^\/(?:comm\/)?jobs\/view\/(?:[^/]*-)?(\d{6,16})\/?$/);
  return match?'https://www.linkedin.com/jobs/view/'+match[1]+'/':'';
 }catch{return '';}
}

export function linksFromAlert(email){
 const content=[email.text,email.html].filter(s=>typeof s==='string').map(s=>s.slice(0,500000)).join('\n')
  .replace(/&amp;|&#38;|&#x26;/gi,'&').replace(/&#(?:x([a-f0-9]+)|(\d+));/gi,(_,hex,decimal)=>{const n=parseInt(hex||decimal,hex?16:10);return n<=0x10ffff?String.fromCodePoint(n):'';});
 const links=new Set();
 for(const value of content.match(/https:\/\/[^\s<>"']+/gi)||[]){const url=linkedInJobURL(value.replace(/[).,;]+$/,''));if(url)links.add(url);}
 return [...links].slice(0,100);
}

// Use only an explicit title anchor followed by "Employer · Location" in the
// same alert card. Email text is a search hint, never qualification evidence.
export function listingsFromAlert(email){
 const html=typeof email.html==='string'?email.html.slice(0,500000):'',hints=new Map();
 const anchors=[...html.matchAll(/<a\b[^>]*href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)];
 for(let i=0;i<anchors.length;i++){
  const anchor=anchors[i],url=linkedInJobURL(anchor[1].replace(/&amp;/gi,'&')),title=plainText(anchor[2]);
  if(!url||title.length<4||title.length>250||/^(?:view|see|apply|open|save|learn|job alert|linkedin)\b/i.test(title))continue;
  const next=anchors.slice(i+1).find(a=>{const other=linkedInJobURL(a[1].replace(/&amp;/gi,'&'));return other&&other!==url;});
  const tail=html.slice(anchor.index+anchor[0].length,Math.min(next?.index??html.length,anchor.index+anchor[0].length+4000));
  const paragraph=tail.match(/<p\b[^>]*>([\s\S]*?)<\/p>/i)?.[1];
  const parts=plainText((paragraph||'').replace(/&middot;/gi,' · ')).split(/\s*·\s*/);
  if(parts.length!==2||!parts[0]||!parts[1]||parts[0].length>160||parts[1].length>250)continue;
  hints.set(url,{title,company:parts[0],location:parts[1]});
 }
 return linksFromAlert(email).map(url=>({url,...(hints.has(url)?{hint:hints.get(url)}:{})}));
}

export function mergeAlertJobs(existing,incoming){
 const jobs=[...existing];
 for(const job of incoming){const index=jobs.findIndex(saved=>sameJob(saved,job));if(index<0)jobs.unshift(job);else jobs[index]={...jobs[index],...job,id:jobs[index].id};}
 return jobs;
}
