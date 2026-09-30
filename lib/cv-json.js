import {descriptionText,plainText,safeURL} from './model.js';
const text=value=>typeof value==='string'?plainText(value):'';
const visible=item=>item&&typeof item==='object'&&!item.hidden;
const list=(data,key)=>data.sections[key]?.hidden?[]:(Array.isArray(data.sections[key]?.items)?data.sections[key].items.filter(visible):[]);
const lines=value=>typeof value==='string'?descriptionText(value).split(/\n+/).map(s=>s.replace(/^•\s*/, '').trim()).filter(Boolean):[];
const unique=values=>[...new Map(values.filter(Boolean).map(v=>[v.toLowerCase().replace(/\s+/g,' ').trim(),v])).values()];
export function parseCVJSON(data,filename='CV.json') {
 if(!data||Array.isArray(data)||!data.basics||!data.sections||typeof data.sections!=='object')throw Error('Choose a CV JSON export containing basics and sections.');
 const facts=[],add=value=>{if(value)facts.push(value);};
 const describe=(prefix,value)=>{for(const line of lines(value))add(prefix?`${prefix}: ${line}`:line);};
 for(const item of list(data,'experience')){
  const context=[text(item.position),text(item.company),text(item.period)].filter(Boolean).join(' · ');
  add(context?`Experience: ${context}.`:'');describe(context,item.description);
  for(const role of Array.isArray(item.roles)?item.roles.filter(visible):[])describe([text(role.position),text(item.company),text(role.period)].filter(Boolean).join(' · '),role.description);
 }
 for(const item of list(data,'education')){
  const context=[text(item.degree),text(item.area),text(item.school),text(item.period)].filter(Boolean).join(' · ');
  add(context?`Education: ${context}.`:'');describe(context,item.description);
 }
 for(const item of list(data,'skills')){
  add(text(item.name)?`Skill area: ${text(item.name)}.`:'');
  for(const keyword of Array.isArray(item.keywords)?item.keywords:[])add(text(keyword)?`CV skill: ${text(keyword)}.`:'');
 }
 for(const section of ['projects','certifications','awards','volunteer'])for(const item of list(data,section)){
  const context=[text(item.name)||text(item.title)||text(item.position),text(item.issuer)||text(item.organization),text(item.period)||text(item.date)].filter(Boolean).join(' · ');
  if(context)add(`${section}: ${context}.`);describe(context,item.description);
 }
 if(!facts.length)throw Error('No visible experience, education or skills were found in this CV.');
 const basics=data.basics,links=[basics.website?.url,...(Array.isArray(basics.customFields)?basics.customFields.map(f=>f.link):[]),...list(data,'profiles').map(p=>p.url||p.website?.url)];
 const linkedin=links.find(url=>{try{return /(^|\.)linkedin\.com$/i.test(new URL(safeURL(url)).hostname);}catch{return false;}})||'';
 const languages=unique(list(data,'languages').map(item=>[text(item.language),text(item.fluency)].filter(Boolean).join(' ')));
 return {filename:text(filename).slice(0,200),headline:text(basics.headline),name:text(basics.name),email:text(basics.email),phone:text(basics.phone),linkedin,languages,evidence:unique(facts).join('\n')};
}
export function mergeCVImports(documents,current) {
 if(!documents.length||documents.length>3)throw Error('Choose one to three CV JSON files.');
 const names=unique(documents.map(d=>d.name));
 if(names.length>1)throw Error('These CVs have different names. Import one person’s CVs at a time.');
 const result={...current};
 for(const key of ['name','email','phone','linkedin'])if(!result[key])result[key]=documents.find(d=>d[key])?.[key]||'';
 result.evidence=unique([...(current.evidence||'').split(/\n+/),...documents.flatMap(d=>d.evidence.split('\n'))]).join('\n');
 if(result.evidence.length>50000)throw Error('Combined CV details are too long. Import fewer files.');
 const languages=unique(documents.flatMap(d=>d.languages));
 if(languages.length){
  // A reviewed native-language declaration must survive importing an older CV
  // that only records a CEFR level. Keep the imported level alongside it.
  const native=String(current.languages||'').split(/[,;\n]/).map(s=>s.trim()).filter(s=>/\bnative\b/i.test(s)&&!/\b(?:not|non)\b/i.test(s));
  const languageName=s=>s.match(/^\w+/)?.[0]?.toLowerCase();
  result.languages=unique([...languages.map(s=>native.some(n=>languageName(n)===languageName(s))&&!/\bnative\b/i.test(s)?s+' (native)':s),...native.filter(n=>!languages.some(s=>languageName(s)===languageName(n)))]).join(', ');
 }
 const german=unique(languages.filter(l=>/\bGerman\b/i.test(l)).flatMap(l=>l.match(/\b[ABC][12]\b/g)||[]));
 if(german.length===1)result.germanLevel=german[0];
 result.cvImportSources=unique([...(current.cvImportSources||'').split('\n'),...documents.map(d=>d.filename)]).join('\n');
 return result;
}
