import {searchFirecrawlJobs} from '../server/firecrawl-jobs.js';
import {searchSkills} from '../lib/job-search-profile.js';
import {authorized} from '../server/access.js';
import {regions,europeanCountries} from '../lib/geography.js';
export {fetchJobs,fetchRemoteJobs,fetchInternationalJobs} from '../server/legacy-job-sources.js';
export function createJobsHandler(options={}) {return async function handler(req,res){
 res.setHeader('Cache-Control','no-store');
 if(req.method!=='GET'){res.setHeader('Allow','GET');return res.status(405).json({error:'Use GET.'});}
 const params=new URL(req.url,'http://localhost').searchParams,region=params.get('region')||'international',country=params.get('country')||'',page=params.get('page')||'1',cursor=params.get('search')||'start';
 if(!/^\d+$/.test(page)||Number(page)<1||Number(page)>10000||!Object.hasOwn(regions,region)||country&&(region!=='europe'||!europeanCountries.some(c=>c.value===country)))return res.status(400).json({error:'Invalid location or page.'});
 const skills=(params.get('skills')||'').split(',').filter(Boolean);
 if(skills.length>4||skills.some(key=>!Object.hasOwn(searchSkills,key))||cursor.length>30)return res.status(400).json({error:'Invalid CV search terms.'});
 if(process.env.JOB_NOTEBOOK_ACCESS_TOKEN&&!authorized({...req,headers:req.headers||{}}))return res.status(401).json({error:'Connect your device in My profile to search with Firecrawl.'});
 try{return res.status(200).json(await searchFirecrawlJobs({region,country,skills,junior:params.get('junior')==='1',cursor},options));}
 catch(error){return res.status(error.status||503).json({error:error.code?error.message:'Firecrawl search is temporarily unavailable. Retry shortly.',code:error.code||'FIRECRAWL_UNAVAILABLE'});}
};}
export default createJobsHandler();
