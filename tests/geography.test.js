import test from 'node:test';
import assert from 'node:assert/strict';
import {matchesGeography,locationInfo} from '../lib/geography.js';
import {matchJob,rankJobs,defaultProfile,validateProfile} from '../lib/model.js';
const role={id:'x',title:'Implementation Consultant',company:'Systems',description:'English. Customer workshops, workflow requirements, API integration and rollout.'};
test('continent filters recognise countries and cities, without treating remote as worldwide',()=>{
 for(const [geography,location] of [['europe','Lisbon'],['europe','Amsterdam'],['europe','Prague'],['africa','Cape Town, South Africa'],['asia','Philippines'],['oceania','Auckland'],['north-america','Toronto'],['south-america','Brazil']]){
  assert.equal(matchesGeography({...role,location},{geography}),true,location);
  assert.equal(matchJob({...role,location},{...defaultProfile,geography}).eligible,true,location);
 }
 for(const location of ['Berlin, Germany','London','Remote','Location not stated'])assert.equal(matchesGeography({...role,location,remote:true},{geography:'africa'}),false,location);
 assert.equal(matchesGeography({...role,location:'Worldwide',remote:true},{geography:'africa'}),false);
 assert.equal(matchesGeography({...role,location:'Worldwide',remote:true},{geography:'africa',includeBroadRemote:true}),true);
});
test('European country filters retain region-wide remote work but respect explicit restrictions',()=>{
 const profile={geography:'europe',country:'portugal',includeBroadRemote:true};
 for(const location of ['Lisbon','Portugal','Spain, Portugal'])assert.equal(matchesGeography({...role,location},profile),true);
 for(const location of ['Berlin','London','Europe, UK','Remote'])assert.equal(matchesGeography({...role,location,remote:true},profile),false,location);
 assert.equal(matchesGeography({...role,location:'Europe',remote:true},profile),true);
 assert.equal(matchesGeography({...role,location:'Europe',remote:false},profile),false);
 assert.deepEqual(locationInfo({location:'APAC'}).continents,['asia','oceania']);
});
test('all continent and country choices round trip, and invalid filters are rejected',()=>{
 assert.equal(validateProfile({...defaultProfile,geography:'europe',country:'netherlands'}).country,'netherlands');
 assert.equal(validateProfile({...defaultProfile,geography:'asia',country:'netherlands'}).country,'');
 assert.throws(()=>validateProfile({...defaultProfile,geography:'mars'}));
 assert.throws(()=>validateProfile({...defaultProfile,country:'not-a-country'}));
 assert.equal(matchJob({...role,location:'USA'},{...defaultProfile,geography:'north-america'}).eligible,false);
});
test('Germany and the UK cannot alternate ahead of other relevant European markets indefinitely',()=>{
 const rows=[['de1','Berlin',90],['de2','Munich',89],['uk1','London',88],['uk2','Manchester',87],['nl','Amsterdam',72],['pt','Lisbon',65],['weak','Paris',30]].map(([id,location,score])=>({id,location,match:{score}}));
 assert.deepEqual(rankJobs(rows).map(j=>j.id),['de1','uk1','nl','pt','de2','uk2','weak']);
});
test('country-specific Firecrawl searches use separate caches and validated geography',async()=>{
 const {createJobsHandler}=await import('../api/jobs.js');const requested=[];
 const handler=createJobsHandler({fetcher:async(url,options)=>{const body=JSON.parse(options.body);requested.push(body.query);return {ok:true,status:200,json:async()=>({success:true,data:{web:[]}})};}});
 async function request(query){const res={setHeader(){},status(n){this.code=n;return this;},json(d){this.data=d;}};await handler({method:'GET',url:'/api/jobs?'+query,headers:{}},res);return res;}
 const pt=await request('region=europe&country=portugal');const nl=await request('region=europe&country=netherlands');assert.equal(pt.code,200);assert.equal(nl.code,200);assert.equal(pt.data.nextPage,null);
 assert(requested.some(q=>q.includes('Portugal')));assert(requested.some(q=>q.includes('Netherlands')));
 const count=requested.length;await request('region=europe&country=portugal');assert.equal(requested.length,count);
 assert.equal((await request('region=africa&country=germany')).code,400);assert.equal((await request('region=bad')).code,400);
});

test('Africa excludes Canada and broad EMEA adverts by default, with an explicit broad-remote opt-in',()=>{
 for(const location of ['Papua New Guinea','Canada','Toronto, Canada','EMEA, LATAM, Canada, USA','Anywhere','Europe']){
  assert.equal(matchesGeography({...role,location,remote:true},{geography:'africa'}),false,location);
 }
 assert.equal(matchesGeography({...role,location:'Canada',remote:true},{geography:'africa',includeBroadRemote:true}),false);
 assert.equal(matchesGeography({...role,location:'EMEA, LATAM, Canada, USA',remote:true},{geography:'africa',includeBroadRemote:true}),true);
 for(const location of ["Côte d'Ivoire",'Mali','Eswatini','Guinea-Bissau','Cape Verde','Kenya','Canada, South Africa'])assert.equal(matchesGeography({...role,location},{geography:'africa'}),true,location);
});
test('multi-country cards lead with the selected region while retaining original location data',async()=>{
 const {scopedLocation}=await import('../lib/geography.js');const job={...role,location:'Canada, South Africa, Kenya',remote:true};
 assert.equal(scopedLocation(job,{geography:'africa'}),'South Africa, Kenya · +1 other advertised locations');
 assert.equal(job.location,'Canada, South Africa, Kenya');
});
test('engineering, visual design and accounting roles do not qualify from generic business keywords',()=>{
 for(const title of ['Engineering Manager','Senior Product Designer','Controller (FP&A, Financial Reporting & Accounting Leadership)','Senior Digital Marketer (strategy + Implementation)'])assert.equal(matchJob({...role,title,location:'South Africa'},defaultProfile).eligible,false,title);
 assert.equal(matchJob({...role,title:'Financial Systems Consultant',location:'South Africa'},defaultProfile).eligible,true);
});

test('every continent enforces the same explicit-location default and worldwide opt-in',()=>{
 const locations={europe:'Portugal',africa:'Kenya',asia:'Philippines',oceania:'Samoa','north-america':'Barbados','south-america':'Peru'};
 for(const [region,location] of Object.entries(locations)){
  const profile={...defaultProfile,geography:region};
  for(const [otherRegion,otherLocation] of Object.entries(locations))assert.equal(matchJob({...role,location:otherLocation,remote:true},profile).eligible,region===otherRegion,`${region}: ${otherLocation}`);
  assert.equal(matchesGeography({...role,location:'Worldwide',remote:true},profile),false,region);
  assert.equal(matchesGeography({...role,location:'Worldwide',remote:true},{...profile,includeBroadRemote:true}),true,region);
  assert.equal(matchesGeography({...role,location:'Remote',remote:true},{...profile,includeBroadRemote:true}),false,region);
 }
});
test('regional remote opt-in is limited to the continents named by each region',()=>{
 for(const [location,allowed] of [['EMEA',['europe','africa','asia']],['APAC',['asia','oceania']],['LATAM',['north-america','south-america']]]){
  for(const geography of ['europe','africa','asia','oceania','north-america','south-america']){
   assert.equal(matchesGeography({...role,location,remote:true},{geography}),false,`${location} strict ${geography}`);
   assert.equal(matchesGeography({...role,location,remote:true},{geography,includeBroadRemote:true}),allowed.includes(geography),`${location} broad ${geography}`);
  }
 }
 const multi={...role,location:'Germany, Kenya, Japan, Australia',remote:true};
 assert.equal(matchesGeography(multi,{geography:'south-america',includeBroadRemote:true}),false);
 assert.equal(matchesGeography(multi,{geography:'north-america',includeBroadRemote:true}),false);
 assert.equal(matchesGeography(multi,{geography:'europe',country:'portugal',includeBroadRemote:true}),false);
});
test('country coverage includes Asian, Pacific and Caribbean countries beyond the largest markets',()=>{
 for(const [geography,places] of Object.entries({asia:['Armenia','Kazakhstan','Bhutan','Brunei','Cambodia','Laos','Maldives','Mongolia','Timor-Leste'],oceania:['Samoa','Tonga','Vanuatu','Solomon Islands','Kiribati','Micronesia','Marshall Islands','Nauru','Palau','Tuvalu'],'north-america':['Barbados','Bahamas','Antigua and Barbuda','Dominica','Grenada','Saint Kitts and Nevis','Saint Lucia','Saint Vincent and the Grenadines','Haiti']})){
  for(const location of places)assert.equal(matchesGeography({...role,location},{geography}),true,location);
 }
});
test('explicit countries disambiguate cities and US states shared with other countries',()=>{
 assert.equal(matchesGeography({...role,location:'London, Canada'},{geography:'europe'}),false);
 assert.equal(matchesGeography({...role,location:'London, Canada'},{geography:'north-america'}),true);
 assert.equal(matchesGeography({...role,location:'Paris, Texas, United States'},{geography:'europe'}),false);
 assert.equal(matchesGeography({...role,location:'Georgia, USA'},{geography:'asia'}),false);
 assert.equal(matchesGeography({...role,location:'Georgia'},{geography:'asia'}),true);
 assert.equal(matchesGeography({...role,location:'Georgia, United States',locationCountries:['Georgia','United States']},{geography:'asia'}),true);
 assert.equal(matchesGeography({...role,location:'Northern Ireland'},{geography:'europe',country:'ireland'}),false);
 assert.equal(matchesGeography({...role,location:'Northern Ireland'},{geography:'europe',country:'uk'}),true);
});
