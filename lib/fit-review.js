// Scores describe evidenced alignment, never hiring odds. Practical conditions
// and optional extras cannot dilute the required-skills denominator.
export const REVIEW_VERSION=6;
export const factorWeights={eligibility:0,location:0,pay:0,career:0,workStyle:0,contract:0};
export const factorLabels={eligibility:'Work rights',location:'Location',pay:'Pay',career:'Career direction',workStyle:'Work style & balance',contract:'Contract'};
export const practicalRequirement=text=>/^(?:availability|start date|work rights|work eligibility|work authori[sz]ation|right to work|visa|salary|compensation|location|residen(?:ce|cy)|contract|working hours)\b|\b(?:able to commit|available to start|must (?:be based|be located|reside|live)|legally (?:eligible|authori[sz]ed)|eligible to work|work permit|requires? (?:a )?visa|[\d–-]+ hours per (?:day|week))\b/i.test(text||'');
export const ratingCategory=p=>p.category==='duty'?'duty':p.category==='optional'?'secondary':p.category==='practical'||p.dimension==='practical'||practicalRequirement(p.text)?'practical':/\b(?:\d+(?:\.\d+)?|one|two|three|four|five|six|seven|eight|nine|ten)(?:\+| or more)?\s*(?:years?|yrs?|jahre[n]?)\b|\b(?:seniority|junior|mid.level|senior.level)\b|experience as (?:a |an )?(?:business analyst|product analyst|consultant|developer)|similar product.focused role/i.test(p.text)?'experience':'core';
const credit={match:1,partial:.5,gap:0,missing:0,unknown:0};
const weight=p=>p.importance==='essential'?2:1;
const round=n=>n===null?null:Math.round(n*10)/10;
export function evidenceScore(points){
 // Splitting a compound paragraph must not multiply that requirement's
 // influence. Atomic checks share their original source's weight.
 const groups=new Map();
 points.forEach((p,i)=>{const key=Number.isInteger(p.paragraph)?'paragraph:'+p.paragraph:p.sourceQuote||p.source||'point:'+i;if(!groups.has(key))groups.set(key,[]);groups.get(key).push(p);});
 const weighted=[...groups.values()].flatMap(group=>{const sum=group.reduce((n,p)=>n+weight(p),0),max=Math.max(...group.map(weight));return group.map(p=>({p,weight:max*weight(p)/sum}));});
 const total=weighted.reduce((n,row)=>n+row.weight,0);
 const assessed=weighted.filter(({p})=>p.status!=='unknown');
 const known=assessed.reduce((n,row)=>n+row.weight,0);
 const earned=weighted.reduce((n,{p,weight})=>n+weight*(credit[p.status]??0),0);
 const coverage=total?100*known/total:0;
 return {score:known&&coverage>=70?10*earned/known:null,lower:total?10*earned/total:null,upper:total?10*weighted.reduce((n,{p,weight})=>n+weight*(p.status==='gap'?0:1),0)/total:null,coverage:Math.round(coverage),total:points.length,assessed:assessed.length};
}
export function scoreReview(review){
 const points=review.points||[],factors=review.factors||[];
 const core=points.filter(p=>ratingCategory(p)==='core'),experience=points.filter(p=>ratingCategory(p)==='experience'),optional=points.filter(p=>ratingCategory(p)==='secondary');
 const skills=evidenceScore(core),level=evidenceScore(experience);
 const styles=['workStyle','career'].map(key=>factors.find(f=>f.key===key));
 const lifestyle=styles.every(f=>f&&f.status!=='unknown')?5*styles.reduce((n,f)=>n+credit[f.status],0):null;
 const duties=evidenceScore(points.filter(p=>p.category==='duty'));
 // A good career direction or nice-to-have cannot compensate for absent
 // essential skills. Unknown preferences never create a negative score.
 const combine=(s,e)=>s===null||experience.length&&e===null?null:Math.min(s,experience.length ? .8*s+.2*e : s);
 let overall=combine(skills.score,level.score),overallUpper=combine(skills.upper,level.upper);
 const required=points.filter(p=>p.category==='required');
 const practicalConflict=factors.some(f=>['eligibility','location','contract','pay','workStyle'].includes(f.key)&&f.status==='gap')||points.some(p=>ratingCategory(p)==='practical'&&p.status==='gap');
 const requiredConflict=required.some(p=>p.status==='gap'&&(p.importance==='essential'||ratingCategory(p)==='experience'||/\b(?:english|german|french|spanish|dutch|mandarin|afrikaans|shona|language)\b/i.test(p.text)));
 const absentEssential=required.some(p=>p.status==='missing'&&(p.importance==='essential'||ratingCategory(p)==='experience'));
 const cap=practicalConflict||requiredConflict?'A confirmed required-experience, essential-skill or practical conflict limits the recommendation to 3/10.':absentEssential?'Essential evidence is not recorded; the recommendation is limited to 5/10 pending confirmation.':'';
 const ceiling=practicalConflict||requiredConflict?3:absentEssential?5:10;
 if(overall!==null)overall=Math.min(overall,ceiling);
 if(overallUpper!==null)overallUpper=Math.min(overallUpper,ceiling);
 const unresolvedEssential=required.some(p=>(p.importance==='essential'||ratingCategory(p)==='experience')&&['unknown','partial','missing'].includes(p.status));
 const practicalUnknown=factors.some(f=>['eligibility','location','contract','pay','workStyle'].includes(f.key)&&['unknown','partial'].includes(f.status))||points.some(p=>ratingCategory(p)==='practical'&&p.status!=='match');
 const recommendation=practicalConflict||requiredConflict?'Skip this vacancy':absentEssential?'Confirm essential requirements first':skills.score===null||unresolvedEssential?'Assessment incomplete':skills.lower<=6?'Below your skills threshold':practicalUnknown?'Check conditions before applying':'Worth considering';
 const confidence=skills.coverage<70?'low':core.some(p=>['partial','unknown'].includes(p.status))?'medium':'high';
 const available=experience.length?10:8;
 return {overall:round(overall),overallUpper:round(overallUpper),skills:round(skills.score),skillsLower:round(skills.lower),skillsUpper:round(skills.upper),skillsCoverage:skills.coverage,experience:round(level.score),lifestyle:round(lifestyle),work:round(duties.score),recommendation,confidence,
  breakdown:[{key:'core',label:'Required skills',max:8,applicable:!!core.length,earned:skills.score===null?null:round(.8*skills.score),coverage:skills.coverage},{key:'experience',label:'Relevant experience',max:2,applicable:!!experience.length,earned:level.score===null?null:round(.2*level.score),coverage:level.coverage}],
  bonus:{supported:optional.filter(p=>p.status==='match').length,total:optional.length},availablePoints:available,earnedPoints:overall===null?null:round(overall*available/10),coverage:skills.coverage,requirementCoverage:required.length?Math.round(100*required.reduce((n,p)=>n+(p.status==='partial'?.5:['match','gap'].includes(p.status)?1:0),0)/required.length):0,
  provisional:points.some(p=>['partial','unknown','missing'].includes(p.status))||factors.some(f=>['unknown','partial'].includes(f.status))||(review.issues||[]).length>0,cap};
}
export function reviewInsights(review){
 const convert=p=>({label:p.text,source:p.sourceQuote,status:p.status==='missing'?'unknown':p.status,missing:p.status==='missing',note:p.note,detail:p.note,preferred:p.category==='optional',evidenceKind:p.evidenceKind,checks:[{label:p.text,status:p.status==='missing'?'unknown':p.status,evidence:p.cvQuote,detail:p.note}]});
 return {requirements:review.points.filter(p=>p.category!=='duty'&&ratingCategory(p)!=='practical').map(convert),dutyAssessments:review.points.filter(p=>p.category==='duty').map(convert),hasExperience:true};
}
export function reviewClearsDiscovery(review){
 return review.skills!==null&&review.skills>6&&(review.skillsLower??review.skills)>6&&(review.skillsCoverage??100)>=70
  &&!review.points.some(p=>p.category==='required'&&(p.status==='gap'||ratingCategory(p)==='experience'&&p.status!=='match'||p.importance==='essential'&&['unknown','missing'].includes(p.status)))
  &&!review.points.some(p=>ratingCategory(p)==='practical'&&p.status==='gap')
  &&!review.factors.some(f=>['eligibility','location','contract','pay','workStyle'].includes(f.key)&&f.status==='gap');
}
