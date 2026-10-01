// Evidence categories use the same published rubric for every full review.
export const REVIEW_VERSION=2;
export const factorWeights={eligibility:0,location:0,pay:0,career:1,workStyle:1,contract:0};
export const factorLabels={eligibility:'Work rights',location:'Location',pay:'Pay',career:'Career direction',workStyle:'Work style & balance',contract:'Contract'};
export const ratingCategory=p=>p.category==='duty'?'duty':p.category==='optional'?'secondary':/\b\d+\+?\s*years?|\b(?:seniority|junior|mid.level|senior.level)\b|experience as (?:a |an )?(?:business analyst|product analyst|consultant|developer)|similar product.focused role/i.test(p.text)?'experience':'core';
export function scoreReview(review){
 const credit={match:1,partial:.5,gap:0,missing:0,unknown:0};
 const groups=[['core','Core requirements',4],['secondary','Secondary requirements',2],['experience','Experience level',2]].map(([key,label,max])=>{
  const points=review.points.filter(p=>ratingCategory(p)===key),known=points.filter(p=>p.status!=='unknown').length;
  return {key,label,max,applicable:points.length>0,earned:points.length?max*points.reduce((sum,p)=>sum+credit[p.status],0)/points.length:null,coverage:points.length?known/points.length:0};
 });
 const styles=['workStyle','career'].map(key=>review.factors.find(f=>f.key===key));
 groups.push({key:'workStyle',label:'Work style & career',max:2,applicable:true,earned:styles.reduce((sum,f)=>sum+(credit[f?.status]||0),0),coverage:styles.filter(f=>f&&f.status!=='unknown').length/2});
 const active=groups.filter(g=>g.applicable),available=active.reduce((sum,g)=>sum+g.max,0),earned=active.reduce((sum,g)=>sum+g.earned,0);
 const core=groups[0],secondary=groups[1],skillsGroups=[core,secondary].filter(g=>g.applicable);
 const skills=skillsGroups.length?10*skillsGroups.reduce((sum,g)=>sum+g.earned,0)/skillsGroups.reduce((sum,g)=>sum+g.max,0):null;
 const duties=review.points.filter(p=>p.category==='duty'),work=duties.length?10*duties.reduce((sum,p)=>sum+credit[p.status],0)/duties.length:null;
 let overall=core.applicable?10*earned/available:null;
 const blocker=review.factors.some(f=>['eligibility','location'].includes(f.key)&&f.status==='gap')||review.points.some(p=>p.category==='required'&&p.status==='gap'&&/\b(?:english|german|french|spanish|dutch|mandarin|afrikaans|shona|language|work permit|work authori[sz]ation|residen(?:t|ce|cy))\b/i.test(p.text));
 if(overall!==null&&blocker)overall=Math.min(overall,3);
 const required=review.points.filter(p=>p.category==='required'),round=n=>n===null?null:Math.round(n*2)/2;
 return {overall:round(overall),skills:round(skills),work:round(work),breakdown:groups.map(g=>({...g,earned:g.earned===null?null:Math.round(g.earned*100)/100,coverage:Math.round(g.coverage*100)})),availablePoints:available,earnedPoints:Math.round(earned*100)/100,coverage:Math.round(100*active.reduce((sum,g)=>sum+g.max*g.coverage,0)/available),requirementCoverage:required.length?Math.round(100*required.filter(p=>p.status!=='unknown').length/required.length):0,provisional:active.some(g=>g.coverage<1)||review.points.some(p=>['partial','unknown'].includes(p.status))||review.factors.some(f=>['unknown','partial'].includes(f.status))||review.issues.length>0,cap:blocker?'A confirmed location, work-rights or required-language conflict caps the rating at 3/10.':''};
}
export function reviewInsights(review){
 const convert=p=>({label:p.text,source:p.sourceQuote,status:p.status==='missing'?'unknown':p.status,missing:p.status==='missing',note:p.note,detail:p.note,preferred:p.category==='optional',checks:[{label:p.text,status:p.status==='missing'?'unknown':p.status,evidence:p.cvQuote,detail:p.note}]});
 return {requirements:review.points.filter(p=>p.category!=='duty').map(convert),dutyAssessments:review.points.filter(p=>p.category==='duty').map(convert),hasExperience:true};
}
