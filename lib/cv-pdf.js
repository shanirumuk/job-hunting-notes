// Text extraction happens on the device. PDF actions and embedded scripts are
// never executed; only text and contact-link annotations enter the review.
export function pdfPageLines(items) {
 const lines=[];let line='',lastY=null;
 for(const item of items){
  if(typeof item.str!=='string')continue;
  const y=item.transform?.[5];
  if(line&&Number.isFinite(y)&&Number.isFinite(lastY)&&Math.abs(y-lastY)>3){lines.push(line.trim());line='';}
  line+=(line?' ':'')+item.str;lastY=y;
  if(item.hasEOL){if(line.trim())lines.push(line.trim());line='';lastY=null;}
 }
 if(line.trim())lines.push(line.trim());
 return lines.filter(Boolean);
}
const heading=s=>s.toLowerCase().replace(/[^a-z]/g,'');
const sections={experience:['experience','professionalexperience','workexperience','employmenthistory','workhistory','employment'],education:['education','qualifications','academicbackground'],skills:['skills','technicalskills','coreskills','keyskills','competencies'],languages:['languages','languageproficiency'],projects:['projects','selectedprojects','certifications','certificates','volunteerexperience'],ignore:['profile','summary','professionalsummary','aboutme','objective','careerobjective','interests','references','contact','contactdetails']};
const months=['January','February','March','April','May','June','July','August','September','October','November','December'];
function normalizeDates(line){return line.replace(/\b(Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)\.?\s+(20\d{2})\b/gi,(_,m,y)=>months.find(name=>name.toLowerCase().startsWith(m.toLowerCase().slice(0,3)))+' '+y);}
export function parsePDFText(text,filename='CV.pdf',links=[]) {
 const lines=String(text||'').split(/\n+/).map(s=>s.replace(/\s+/g,' ').trim()).filter(Boolean);
 if(lines.join(' ').length<80)throw Error('This PDF has too little readable text. Use a text-based PDF or upload CV details (JSON). Scanned images need text recognition first.');
 const evidence=[],languageLines=[];let section='ignore',context=[];
 for(const line of lines){
  const category=Object.entries(sections).find(([,names])=>names.includes(heading(line)))?.[0];
  if(category){section=category;context=[];continue;}
  if(section==='languages'){languageLines.push(line);continue;}
  if(section==='ignore')continue;
  const value=normalizeDates(line);
  if(section==='experience'&&/\b20\d{2}\b/.test(value)&&/(?:present|current|ongoing|20\d{2}.*20\d{2})/i.test(value))evidence.push('Experience: '+[...context.slice(-2),value].join(' · '));
  else evidence.push((section==='skills'?'CV skill: ':section==='education'?'Education: ':section==='projects'?'Project or certification: ':'')+value);
  context.push(value);
 }
 if(!evidence.length)throw Error('The PDF text was read, but its experience and skills sections could not be identified. Use a CV with clear section headings or upload CV details (JSON).');
 const languageText=languageLines.join(' '),languages=[];
 const names=[...languageText.matchAll(/\b(English|German|Deutsch|French|Spanish|Dutch|Mandarin|Afrikaans|Shona|Portuguese|Arabic|Italian)\b/gi)];
 for(let i=0;i<names.length;i++){
  const span=languageText.slice(names[i].index+names[i][0].length,names[i+1]?.index??languageText.length).trim();
  const level=span.match(/\b([ABC][12])\b/i)?.[1]?.toUpperCase();
  const native=/\b(native|mother tongue|first language)\b/i.test(span)&&!/(?:not|non)[ -]native/i.test(span);
  const fluency=level||(native?'native':span.match(/\b(?:fluent|proficient|intermediate|basic|beginner)\b/i)?.[0]||'');
  languages.push((/^deutsch$/i.test(names[i][0])?'German':names[i][0])+(fluency?' '+fluency:'')+(native&&level?' (native)':''));
 }
 const all=lines.join('\n'),contactLinks=links.filter(s=>typeof s==='string');
 const email=all.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0]||contactLinks.find(s=>/^mailto:/i.test(s))?.replace(/^mailto:/i,'').split('?')[0]||'';
 const phone=all.match(/(?:\+\d{1,3}[\s().-]*)?(?:\d[\s().-]*){9,14}\d/)?.[0]?.trim()||contactLinks.find(s=>/^tel:/i.test(s))?.slice(4)||'';
 const linkedin=contactLinks.find(s=>{try{const u=new URL(s);return ['https:','http:'].includes(u.protocol)&&/(^|\.)linkedin\.com$/i.test(u.hostname)&&!u.username&&!u.password;}catch{return false;}})||'';
 const name=lines.slice(0,5).find(s=>/^[\p{L}][\p{L}\s.'’-]{2,100}$/u.test(s)&&s.split(/\s+/).length>=2&&!/curriculum|resume|consultant|developer|analyst|engineer|profile|experience|skills/i.test(s))||'';
 return {filename,name,email,phone,linkedin,headline:'',languages,evidence:[...new Set(evidence)].join('\n')};
}
export async function parseCVPDF(file,{pdfjs}={}) {
 if(file.size>15*1024*1024)throw Error('Choose a PDF smaller than 15 MB.');
 const bytes=new Uint8Array(await file.arrayBuffer());
 if(new TextDecoder().decode(bytes.slice(0,5))!=='%PDF-')throw Error('Please choose a valid PDF file.');
 pdfjs ||= await import('../vendor/pdfjs/pdf.min.mjs');
 pdfjs.GlobalWorkerOptions.workerSrc=new URL('../vendor/pdfjs/pdf.worker.min.mjs',import.meta.url).href;
 const task=pdfjs.getDocument({data:bytes,isEvalSupported:false,useSystemFonts:true}),lines=[],links=[];
 try{
  const pdf=await task.promise;
  if(pdf.numPages>40)throw Error('Choose a CV with no more than 40 pages.');
  for(let i=1;i<=pdf.numPages;i++){
   const page=await pdf.getPage(i);
   lines.push(...pdfPageLines((await page.getTextContent()).items));
   links.push(...(await page.getAnnotations()).map(a=>a.url).filter(Boolean));
   if(lines.join('\n').length>50000)throw Error('The extracted CV text is too long. Choose a shorter CV.');
  }
  return parsePDFText(lines.join('\n'),file.name,links);
 }catch(error){if(error.name==='PasswordException')throw Error('This PDF is password protected. Upload an unlocked copy.');throw error;}
 finally{await task.destroy();}
}
