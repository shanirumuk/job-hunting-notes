import {europeanCountries,locationInfo} from '../lib/geography.js';
const fold=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
const words=value=>fold(value).replace(/[^\p{L}\p{N}]+/gu,' ').trim().split(/\s+/).filter(Boolean);
const city=value=>fold(value).replace(/munchen/g,'munich').replace(/nurnberg/g,'nuremberg').replace(/koln/g,'cologne').replace(/\b(?:greater|metropolitan|area|region|on site|onsite|hybrid|fully remote|remote)\b/g,'').replace(/[^\p{L}\p{N}]+/gu,' ').trim();
const company=value=>words(value).filter(w=>!['gmbh','ag','se','co','kg','llc','ltd','inc','corporate','dach'].includes(w)).join(' ');
export function matchingEmployerListing(job,hint){
 const a=company(job.company),b=company(hint.company);
 if(!a||!b||a!==b&&!(Math.min(a.length,b.length)>=5&&(a.startsWith(b+' ')||b.startsWith(a+' '))))return false;
 const title=value=>new Set(words(value.replace(/\([mwdfx/| -]{3,20}\)/gi,'').replace(/\b(?:full(?:y)? remote|hybrid|on.?site)\b/gi,'')));
 const wanted=title(hint.title),actual=title(job.title),overlap=[...wanted].filter(w=>actual.has(w)).length;
 if(!wanted.size||!actual.size||overlap/wanted.size<.8||overlap/actual.size<.8)return false;
 if(!hint.location)return true;
 const wantedLocation=city(hint.location),actualLocation=city(job.location);
 if(!wantedLocation||!actualLocation)return false;
 if((' '+actualLocation+' ').includes(' '+wantedLocation+' '))return true;
 const country=europeanCountries.find(c=>fold(c.label)===fold(hint.location)||c.value===fold(hint.location));
 if(country)return locationInfo(job).countries.includes(country.value);
 // A city match must be explicit. A shared country alone cannot prove it is
 // the same regional vacancy as the alert.
 const cityName=city(hint.location.split(',')[0]);
 return (' '+actualLocation+' ').includes(' '+cityName+' ');
}
export function employerPageURL(value,companyName){
 let url;try{url=new URL(value);}catch{return false;}
 const host=url.hostname.toLowerCase();
 if(/(?:^|\.)(?:linkedin\.com|indeed\.[a-z.]+|glassdoor\.[a-z.]+|jooble\.[a-z.]+|talent\.com|ziprecruiter\.com|jobrapido\.com)$/.test(host))return false;
 if(/(?:^|\.)(?:ashbyhq\.com|greenhouse\.io|lever\.co|workable\.com|smartrecruiters\.com|personio\.(?:de|com)|teamtailor\.com|join\.com|recruitee\.com|myworkdayjobs\.com|successfactors\.(?:com|eu))$/.test(host))return true;
 return words(companyName).filter(w=>w.length>=3&&!['gmbh','group','corporate','supply','chain'].includes(w)).some(w=>host.replace(/[^a-z0-9]/g,'').includes(w));
}
