import {listingSections} from './insights.js';
export const experienceLimits=['any','0','1','2','3','4','5','10'];
const numberWords=['zero','one','two','three','four','five','six','seven','eight','nine','ten','eleven','twelve','thirteen','fourteen','fifteen','sixteen','seventeen','eighteen','nineteen','twenty'];
const optional=/\b(?:preferred|preferably|ideally|desirable|optional|nice.to.have|bonus|advantage|a plus|not required|not essential)\b/i;
// This is a search limit on advertised minimum years, not a claim that the
// applicant has the required domain experience. Unstated minima stay visible.
export function experienceRequirement(job){
 const sections=listingSections(job.description||job.requirements||'');
 const minima=[];
 for(const original of sections.requirements){
  // Keep optional trailing clauses separate from a required baseline.
  const clauses=original.split(/[;]|,\s*(?=(?:ideally|preferably|preferred|at least|minimum)\b)/i);
  const values=[];
  for(let clause of clauses){
   if(optional.test(clause))continue;
   clause=clause.replace(new RegExp('\\b('+numberWords.join('|')+')\\b','gi'),word=>String(numberWords.indexOf(word.toLowerCase())));
   const dates=[...clause.matchAll(/\b(\d+(?:\.\d+)?)\s*(?:\+|or more|or above|and above|(?:[-–—]|to)\s*\d+(?:\.\d+)?)?\s*(?:years?|yrs?)\b[’']?/gi)];
   for(const date of dates){
    const before=clause.slice(0,date.index),after=clause.slice(date.index+date[0].length);
    if(/(?:up to|at most|no more than|less than|under)\s*$/i.test(before))continue;
    // Exclude company age, contract length, education age and benefits.
    if(!/^(?:\s+of)?\s+(?:[a-z0-9-]+\s+){0,8}experience\b/i.test(after)
       &&!/^\s+(?:in|as|with|working|developing|managing)\b/i.test(after)
       &&!/\bexperience\s*(?::|of|for|with|[-–—])?\s*(?:(?:at least|minimum(?: of)?|over|more than)\s*)?$/i.test(before))continue;
    let years=Number(date[1]);
    if(/(?:more than|over)\s*$/i.test(before))years+=0.01;
    if(years<=50)values.push(years);
   }
  }
  // A junior/senior alternative or an education route can have a lower
  // experience entry point. Do not demand every alternative simultaneously.
  if(values.length)minima.push(/\bor\b/i.test(original)||/\bjunior\b/i.test(original)&&/\bsenior\b/i.test(original)?Math.min(...values):Math.max(...values));
 }
 return {minimum:minima.length?Math.max(...minima):null};
}
export function experienceWithinLimit(requirement,limit='4'){
 return limit==='any'||requirement.minimum===null||requirement.minimum<=Number(limit);
}
