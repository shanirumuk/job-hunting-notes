import {descriptionText} from './model.js?v=78';
const normalize=s=>String(s||'').normalize('NFKC').toLowerCase().replace(/\s+/g,' ').trim();
export const advertGroupKey=job=>[normalize(job.company),normalize(job.title),normalize(descriptionText(job.description||job.requirements||''))].join('\n');
export function candidatePriority({job,fit,match},profile){
 const evidence=profile.evidence||'',required=fit.report.evidenceMatches||[];
 const technical=/JavaScript|TypeScript|React|Node|\bAPI\b|\bSQL\b|PostgreSQL|Python|requirements|workflow|testing/i;
 const aligned=required.filter(p=>technical.test(p.label+' '+p.requirement)&&p.evidence&&technical.test(p.evidence)).length;
 const home=/based in Germany/i.test(profile.workRights||'')&&/Germany|Berlin|Munich|Nürnberg|Nuremberg/i.test(job.location||'')?1:0;
 return [fit.reason==='experience-unverified'?-1:0,aligned,fit.report.skillsScore||0,home,match.score];
}
export function compareCandidates(a,b,profile){const x=candidatePriority(a,profile),y=candidatePriority(b,profile);for(let i=0;i<x.length;i++)if(x[i]!==y[i])return y[i]-x[i];return 0;}
export function diverseAdverts(jobs,limit=100){
 const groups=new Map();for(const job of jobs){const key=advertGroupKey(job);if(!groups.has(key))groups.set(key,[]);groups.get(key).push(job);}
 const rows=[...groups.values()],result=[];
 for(let round=0;result.length<limit;round++){let added=false;for(const group of rows)if(group[round]){result.push(group[round]);added=true;if(result.length===limit)break;}if(!added)break;}
 return result;
}
