import {createHash,timingSafeEqual} from 'node:crypto';
import {z} from 'zod';
export const SITE = 'https://job-hunting-notes.vercel.app';
const providers = ['jobs.lever.co','jobs.eu.lever.co','apply.workable.com','jobs.smartrecruiters.com','careers.smartrecruiters.com'];
export function supportedURL(value, {allowSource=true}={}) {
  let url; try {url=new URL(value);} catch {throw new Error('Use a valid application URL.');}
  if(url.protocol!=='https:' || url.username || url.password || (url.port && url.port!=='443')) throw new Error('Only secure application URLs are supported.');
  const host=url.hostname.toLowerCase();
  const isDemo=url.origin===SITE && url.pathname==='/practice-application.html';
  const allowed=providers.includes(host) || host.endsWith('.jobs.personio.de') || host.endsWith('.jobs.personio.com') || host.endsWith('.teamtailor.com') || (allowSource && host==='www.arbeitnow.com');
  if(!isDemo && !allowed) throw new Error('This application site is not supported for automatic preparation yet. Use Open original to apply manually.');
  return url.href;
}
export function authorized(req, secret=process.env.JOB_NOTEBOOK_ACCESS_TOKEN) {
  const value=String(req.headers.authorization||'').replace(/^Bearer /,'');
  if(!secret || secret.length<32 || !value || value.length>256) return false;
  return timingSafeEqual(createHash('sha256').update(value).digest(),createHash('sha256').update(secret).digest());
}
export const requestSchema=z.object({
  url:z.string().max(3000), title:z.string().min(1).max(500), company:z.string().min(1).max(300), demo:z.boolean().default(false),
  fields:z.object({name:z.string().min(1).max(150),email:z.string().email().max(254),phone:z.string().max(100).default(''),linkedin:z.string().max(500).default('')}),
  cv:z.object({name:z.string().min(1).max(200),base64:z.string().min(8).max(3600000)})
});
export function validateRequest(input) {
  const value=requestSchema.parse(input); value.url=supportedURL(value.url);
  if(value.demo !== (new URL(value.url).pathname==='/practice-application.html' && new URL(value.url).origin===SITE)) throw new Error('Practice mode must use the practice form.');
  const bytes=Buffer.from(value.cv.base64,'base64');
  if(bytes.length>2500000 || bytes.subarray(0,5).toString()!=='%PDF-') throw new Error('Use a PDF smaller than 2.5 MB for browser preparation.');
  value.cv.name=value.cv.name.replace(/[^a-zA-Z0-9_. -]/g,'_');
  return {...value,bytes};
}
