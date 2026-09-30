// One published rubric for model-assisted reviews. Model output supplies evidence
// and assessments; arithmetic and blocker caps stay deterministic.
export const REVIEW_VERSION=1;
export const factorWeights={eligibility:15,location:5,pay:10,career:10,workStyle:25,contract:5};
export const factorLabels={eligibility:'Work rights',location:'Location',pay:'Pay',career:'Career direction',workStyle:'Daily work',contract:'Contract'};
export function scoreReview(review){
 const required=review.points.filter(p=>p.category==='required');
 const weight=p=>p.importance==='essential'?2:1;
 const credit={match:1,partial:.5,gap:0,missing:0};
 const total=required.reduce((s,p)=>s+weight(p),0);
 const known=required.filter(p=>p.status!=='unknown');
 const assessed=known.reduce((s,p)=>s+weight(p),0);
 const skills=total?10*known.reduce((s,p)=>s+weight(p)*credit[p.status],0)/total:null;
 const duties=review.points.filter(p=>p.category==='duty'),work=duties.length?10*duties.reduce((s,p)=>s+(credit[p.status]||0),0)/duties.length:null;
 const workCoverage=duties.length?duties.filter(p=>p.status!=='unknown').length/duties.length:0;
 let numerator=skills===null?0:skills*30,denominator=skills===null?0:30;
 if(work!==null){numerator+=work*25;denominator+=25;}
 for(const f of review.factors)if(f.key!=='workStyle'&&f.status!=='unknown'){numerator+=10*credit[f.status]*factorWeights[f.key];denominator+=factorWeights[f.key];}
 let overall=skills===null?null:numerator/denominator;
 const blocker=review.factors.some(f=>['eligibility','location'].includes(f.key)&&f.status==='gap');
 const essentialGap=required.some(p=>p.importance==='essential'&&p.status==='gap');
 if(overall!==null&&blocker)overall=Math.min(overall,3);
 else if(overall!==null&&essentialGap)overall=Math.min(overall,4);
 const round=n=>n===null?null:Math.round(n*2)/2;
 return {overall:round(overall),skills:round(skills),work:round(work),coverage:Math.round((total?30*assessed/total:0)+25*workCoverage+review.factors.filter(f=>f.key!=='workStyle'&&f.status!=='unknown').reduce((s,f)=>s+factorWeights[f.key],0)),requirementCoverage:total?Math.round(100*assessed/total):0,provisional:workCoverage<1||known.length<required.length||review.points.some(p=>p.category==='required'&&p.status==='partial')||review.factors.some(f=>['unknown','partial'].includes(f.status))||review.issues.length>0,cap:blocker?'A confirmed location or work-rights conflict caps the rating at 3/10.':essentialGap?'A confirmed essential qualification gap caps the rating at 4/10.':''};
}
export function reviewInsights(review){
 const convert=p=>({label:p.text,source:p.sourceQuote,status:p.status==='missing'?'unknown':p.status,missing:p.status==='missing',note:p.note,detail:p.note,preferred:p.category==='optional',checks:[{label:p.text,status:p.status==='missing'?'unknown':p.status,evidence:p.cvQuote,detail:p.note}]});
 return {requirements:review.points.filter(p=>p.category!=='duty').map(convert),dutyAssessments:review.points.filter(p=>p.category==='duty').map(convert),hasExperience:true};
}
