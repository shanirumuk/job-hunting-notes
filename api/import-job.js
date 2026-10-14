import {importFirecrawlJob,publicListingURL} from '../server/firecrawl-jobs.js';
import {authorized} from '../server/access.js';
export function createImportJobHandler(importer=importFirecrawlJob){
 return async(req,res)=>{
  res.setHeader('Cache-Control','no-store');
  if(req.method!=='POST'){res.setHeader('Allow','POST');return res.status(405).json({error:'Method not allowed'});}
  if(process.env.JOB_NOTEBOOK_ACCESS_TOKEN&&!authorized({...req,headers:req.headers||{}}))return res.status(401).json({error:'Connect your device in My profile to retrieve listings with Firecrawl.'});
  if(typeof req.body?.url!=='string')return res.status(400).json({error:'Provide a job listing link.'});
  let url;try{url=publicListingURL(req.body.url);}catch(error){return res.status(400).json({error:error.message});}
  const raw=req.body.hint;
  const hint=raw&&typeof raw==='object'&&['title','company','location'].every(key=>typeof raw[key]==='string'&&raw[key].length<=250)?{title:raw.title,company:raw.company,location:raw.location}:undefined;
  try{return res.status(200).json({job:await importer(url,{hint})});}
  catch(error){return res.status(422).json({error:/ENOTFOUND|ECONN|ETIMEDOUT|EAI_AGAIN|certificate|socket/i.test(error.message)?'The site could not be reached. Try the employer’s direct job link or paste the advert below.':error.message});}
 };
}
export default createImportJobHandler();
