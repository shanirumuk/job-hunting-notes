import {sameJob} from './model.js';

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

export function mergeAlertJobs(existing,incoming){
 const jobs=[...existing];
 for(const job of incoming){const index=jobs.findIndex(saved=>sameJob(saved,job));if(index<0)jobs.unshift(job);else jobs[index]={...jobs[index],...job,id:jobs[index].id};}
 return jobs;
}
