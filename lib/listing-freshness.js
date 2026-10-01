const DAY=86400000;
// Read provider timestamps, never infer a posting date from a year in the advert.
export function listingDate(value){
 if(value===null||value===undefined||value==='')return '';
 let time;
 if(typeof value==='number'||/^\d{10,13}$/.test(String(value))){const n=Number(value);time=n<1e11?n*1000:n;}
 else if(typeof value==='string'&&/^\d{4}-\d{2}-\d{2}(?:T|\s|$)/.test(value)){
  const day=value.slice(0,10),calendar=Date.parse(day+'T00:00:00Z');
  if(!Number.isFinite(calendar)||new Date(calendar).toISOString().slice(0,10)!==day)return '';
  time=Date.parse(value);
 }
 else return '';
 return Number.isFinite(time)&&time>0&&time<Date.UTC(2100,0,1)?new Date(time).toISOString():'';
}
const months='January February March April May June July August September October November December'.split(' ');
const datePattern='(?:\\d{4}-\\d{2}-\\d{2}|\\d{1,2}(?:st|nd|rd|th)?\\s+(?:'+months.join('|')+')\\s+20\\d{2}|(?:'+months.join('|')+')\\s+\\d{1,2}(?:st|nd|rd|th)?,?\\s+20\\d{2})';
function advertDate(value){
 if(/^\d{4}-/.test(value))return listingDate(value);
 const clean=value.replace(/(\d)(st|nd|rd|th)\b/gi,'$1');
 const parsed=Date.parse(/^\d{4}-/.test(clean)?clean+'T00:00:00Z':clean+' UTC');
 return Number.isFinite(parsed)?new Date(parsed).toISOString():'';
}
function datesFollowing(text,label){
 const regex=new RegExp('\\b(?:'+label+')\\s*(?::|is|on|of)?\\s*('+datePattern+')','gi');
 return [...text.matchAll(regex)].map(match=>advertDate(match[1])).filter(Boolean);
}
export function listingFreshness(job,{now=Date.now(),includeOlder=false}={}){
 const today=Math.floor(now/DAY)*DAY;
 const publishedAt=listingDate(job.publishedAt),expiresAt=listingDate(job.expiresAt);
 const text=String(job.description||job.requirements||'').replace(/<[^>]*>/g,' ').replace(/&nbsp;/g,' ');
 const deadlines=datesFollowing(text,'applications? (?:close|closing(?: date)?|deadline)|closing date|close date|apply by|application deadline');
 const starts=datesFollowing(text,'contract start(?: date)?|(?:proposed |expected |anticipated )?start date|commencement date');
 const deadline=deadlines.sort().at(-1),start=starts.sort().at(-1);
 if(expiresAt&&Date.parse(expiresAt)<now)return {visible:false,state:'expired',label:'Source expiry date has passed',publishedAt};
 if(deadline&&Date.parse(deadline)<today)return {visible:false,state:'expired',label:'Application deadline passed: '+deadline.slice(0,10),publishedAt};
 if(start&&Date.parse(start)<today-90*DAY)return {visible:includeOlder,state:'suspect',label:'May be outdated · Advertised start: '+start.slice(0,10),publishedAt};
 if(publishedAt&&Date.parse(publishedAt)<today-90*DAY)return {visible:includeOlder,state:'older',label:'Older listing · Source posting date: '+publishedAt.slice(0,10),publishedAt};
 if(!publishedAt||Date.parse(publishedAt)>now+DAY)return {visible:true,state:'unknown',label:'Posting date unavailable · Availability unverified',publishedAt:''};
 return {visible:true,state:'recent',label:'Source posting date: '+publishedAt.slice(0,10)+' · Availability unverified',publishedAt};
}
