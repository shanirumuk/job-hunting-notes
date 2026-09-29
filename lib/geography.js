export const regions = {
 international:'All continents',europe:'Europe',africa:'Africa',asia:'Asia',oceania:'Oceania',
 'north-america':'North America (excluding US)','south-america':'South America'
};
export const searchCountryCodes={
 africa:['ZA','KE','NG','EG','MA','GH','MU','TN','RW','UG','TZ','ZW','ZM','BW','NA','ET','SN','DZ','AO','BJ','BF','BI','CV','CM','CF','TD','KM','CD','CG','DJ','GQ','ER','SZ','GA','GM','GN','GW','CI','LS','LR','LY','MG','MW','ML','MR','MZ','NE','ST','SC','SL','SO','SS','SD','TG'],
 asia:['IN','SG','PH','MY','JP','AE','ID','TH','VN','PK','BD','LK','CN','TW','KR','IL','SA','QA','BH','OM','KW','JO','LB','NP','KZ','UZ','AM','AZ','GE','TR','BT','BN','KH','LA','MV','MN','TL'],
 oceania:['AU','NZ','FJ','PG','WS','TO','VU','SB','KI','FM','MH','NR','PW','TV'],
 'north-america':['CA','MX','CR','PA','GT','BZ','HN','SV','NI','JM','DO','TT','BB','BS','AG','DM','GD','KN','LC','VC','HT'],
 'south-america':['BR','AR','CL','CO','PE','EC','UY','PY','BO','VE','GY','SR']
};

// Countries and common city-only feed locations. Keep the original location visible.
const europeanPlaces = {
 austria:['Austria','Vienna','Wien'],belgium:['Belgium','Brussels','Antwerp'],bulgaria:['Bulgaria','Sofia'],croatia:['Croatia','Zagreb'],cyprus:['Cyprus','Nicosia'],czechia:['Czechia','Czech Republic','Prague','Brno'],denmark:['Denmark','Copenhagen'],estonia:['Estonia','Tallinn'],finland:['Finland','Helsinki'],france:['France','Paris','Lyon','Marseille','Toulouse'],germany:['Germany','Deutschland','Berlin','Munich','München','Hamburg','Frankfurt','Cologne','Köln','Düsseldorf','Stuttgart','Leipzig','Dresden','Bonn','Aachen','Mannheim','Karlsruhe','Potsdam','Bremen','Hanover','Hannover','Nuremberg','Nürnberg'],greece:['Greece','Athens'],hungary:['Hungary','Budapest'],iceland:['Iceland','Reykjavik'],ireland:['Ireland','Dublin','Cork'],italy:['Italy','Milan','Rome','Turin'],latvia:['Latvia','Riga'],lithuania:['Lithuania','Vilnius'],luxembourg:['Luxembourg'],malta:['Malta'],netherlands:['Netherlands','Amsterdam','Rotterdam','Utrecht','Eindhoven'],norway:['Norway','Oslo'],poland:['Poland','Warsaw','Krakow','Wrocław','Gdansk'],portugal:['Portugal','Lisbon','Lisboa','Porto'],romania:['Romania','Bucharest'],serbia:['Serbia','Belgrade'],slovakia:['Slovakia','Bratislava'],slovenia:['Slovenia','Ljubljana'],spain:['Spain','Barcelona','Madrid','Valencia'],sweden:['Sweden','Stockholm','Gothenburg'],switzerland:['Switzerland','Zurich','Zürich','Geneva','Basel'],uk:['United Kingdom','UK','London','Manchester','Edinburgh','Bristol','Birmingham'],ukraine:['Ukraine','Kyiv'],albania:['Albania','Tirana'],andorra:['Andorra'],belarus:['Belarus','Minsk'],bosnia:['Bosnia','Sarajevo'],kosovo:['Kosovo','Pristina'],liechtenstein:['Liechtenstein'],moldova:['Moldova','Chisinau'],monaco:['Monaco'],montenegro:['Montenegro','Podgorica'],'north-macedonia':['North Macedonia','Skopje'],'san-marino':['San Marino']
};
export const europeanCountries=Object.entries(europeanPlaces).map(([value,names])=>({value,label:names[0]})).sort((a,b)=>a.label.localeCompare(b.label));
const normalize=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
const contains=(text,words)=>words.some(word=>(' '+normalize(text).replace(/[^a-z0-9]+/g,' ')+' ').includes(' '+normalize(word).replace(/[^a-z0-9]+/g,' ')+' '));
const regionPlaces={
 africa:['Africa','South Africa','Cape Town','Johannesburg','Nigeria','Lagos','Kenya','Nairobi','Egypt','Cairo','Morocco','Ghana','Tunisia','Uganda','Rwanda','Mauritius','Zimbabwe','Zambia','Botswana','Namibia','Ethiopia','Senegal','Algeria','Tanzania','Mozambique','Angola','Cameroon','Ivory Coast',"Côte d'Ivoire",'Benin','Burkina Faso','Burundi','Cabo Verde','Cape Verde','Central African Republic','Chad','Comoros','Congo','Djibouti','Equatorial Guinea','Eritrea','Eswatini','Swaziland','Gabon','Gambia','Guinea','Guinea-Bissau','Lesotho','Liberia','Libya','Madagascar','Malawi','Mali','Mauritania','Niger','Sao Tome and Principe','São Tomé and Príncipe','Seychelles','Sierra Leone','Somalia','South Sudan','Sudan','Togo','Western Sahara'],
 asia:['Asia','India','Bangalore','Bengaluru','Mumbai','Delhi','Singapore','Japan','Tokyo','China','Hong Kong','Taiwan','South Korea','Seoul','Philippines','Manila','Malaysia','Thailand','Vietnam','Indonesia','Pakistan','Bangladesh','Sri Lanka','Nepal','Israel','UAE','United Arab Emirates','Dubai','Saudi Arabia','Qatar','Middle East','Turkey','Türkiye','Turkiye'],
 oceania:['Oceania','Australia','Sydney','Melbourne','Brisbane','New Zealand','Auckland','Wellington','Fiji','Papua New Guinea'],
 'north-america':['North America','Canada','Toronto','Vancouver','Montreal','Mexico','Costa Rica','Panama','Guatemala','Belize','Honduras','El Salvador','Nicaragua','Caribbean','Jamaica','Dominican Republic','Trinidad','Puerto Rico'],
 'south-america':['South America','Brazil','Argentina','Chile','Colombia','Peru','Ecuador','Uruguay','Paraguay','Bolivia','Venezuela','Guyana','Suriname']
};
const countryNames=new Intl.DisplayNames(['en'],{type:'region'});
const countryAliases={
 africa:['Ivory Coast',"Côte d'Ivoire",'Cape Verde','Cabo Verde','Swaziland','Eswatini','Congo','Democratic Republic of the Congo','Sao Tome and Principe','São Tomé and Príncipe','Western Sahara'],
 asia:['UAE','United Arab Emirates','Türkiye','Turkey','Turkiye','South Korea','Republic of Korea','Hong Kong','Taiwan','Afghanistan','Iran','Iraq','Syria','Yemen','North Korea','Kyrgyzstan','Tajikistan','Turkmenistan','Myanmar','Burma','Palestine'],
 oceania:['Federated States of Micronesia','Micronesia','Solomon Islands','Vanuatu','Samoa','Tonga','Tuvalu','Nauru','Palau','Marshall Islands','Kiribati','New Caledonia','French Polynesia'],
 'north-america':['Trinidad','Trinidad and Tobago','Trinidad & Tobago','Saint Kitts and Nevis','Saint Lucia','Saint Vincent and the Grenadines','Antigua and Barbuda','Cuba','Puerto Rico','The Bahamas','Dominican Republic'],
 'south-america':['French Guiana']
};
const explicitPlaces=Object.fromEntries(Object.entries(searchCountryCodes).map(([region,codes])=>[region,[...codes.map(code=>countryNames.of(code)),...(countryAliases[region]||[])]]));
const europeNames=Object.fromEntries(Object.entries(europeanPlaces).map(([key,names])=>[key,[names[0],...({germany:['Deutschland'],czechia:['Czech Republic'],uk:['UK','Great Britain','Britain','England','Scotland','Wales','Northern Ireland'],bosnia:['Bosnia and Herzegovina']}[key]||[])]]));
const continentNames={europe:['Europe','European Union','EU','EEA'],africa:['Africa'],asia:['Asia','Middle East'],oceania:['Oceania'],'north-america':['North America','Caribbean'],'south-america':['South America']};
const usLocation=/\b(united states|usa|u\.?s\.?a?\b|new york|san francisco|california|texas|boston|chicago|seattle|los angeles|washington|atlanta)\b/i;
export function locationInfo(job){
 const location=String(job.location||'');
 const structured=Array.isArray(job.locationCountries)&&job.locationCountries.length>0;
 // Georgia with an explicit US context is a state unless the source supplies a country list.
 const countryText=!structured&&usLocation.test(location)?location.replace(/\bGeorgia\b/gi,''):location;
 let countries=Object.entries(europeNames).filter(([key,names])=>contains(key==='ireland'?countryText.replace(/Northern Ireland/gi,''):countryText,names)).map(([key])=>key);
 const continents=Object.entries(explicitPlaces).filter(([key,names])=>contains(key==='africa'?countryText.replace(/Papua New Guinea/gi,''):countryText,names)).map(([key])=>key);
 const explicit=countries.length||continents.length||usLocation.test(location);
 if(!explicit){
  countries=Object.entries(europeanPlaces).filter(([,names])=>contains(location,names)).map(([key])=>key);
  for(const [key,names] of Object.entries(regionPlaces))if(contains(location,names))continents.push(key);
 }
 if(countries.length)continents.push('europe');
 for(const [key,names] of Object.entries(continentNames))if(contains(location,names))continents.push(key);
 const directContinents=[...new Set(continents)];
 if(contains(location,['EMEA']))continents.push('europe','africa','asia');
 if(contains(location,['APAC']))continents.push('asia','oceania');
 if(contains(location,['LATAM','Latin America']))continents.push('north-america','south-america');
 return {countries,directContinents,continents:[...new Set(continents)],worldwide:contains(location,['Worldwide','Anywhere','Global'])};
}
export function geographicMatch(job,profile){
 const {geography='international',country='',includeBroadRemote=false}=profile;
 if(geography==='international')return {matches:true,kind:'all',label:''};
 const info=locationInfo(job);
 const direct=info.directContinents.includes(geography)&&(geography!=='europe'||!country||info.countries.includes(country));
 if(direct&&info.directContinents.length<4)return {matches:true,kind:'direct',label:country?'Country listed in the advert':regions[geography]+' location listed in the advert'};
 const regional=info.continents.includes(geography)&&!info.directContinents.includes(geography);
 const countryWide=geography==='europe'&&country&&!info.countries.length&&info.continents.includes('europe');
 if(includeBroadRemote&&job.remote&&(info.worldwide||regional||countryWide||(direct&&info.directContinents.length>=4)))return {matches:true,kind:'broad',label:info.worldwide?'Worldwide remote listing — verify country and timezone eligibility':'Broad regional remote listing — verify country eligibility'};
 return {matches:false,kind:'excluded',label:''};
}
export function matchesGeography(job,profile){return geographicMatch(job,profile).matches;}
export function scopedLocation(job,profile){
 if(profile.geography==='international'||!geographicMatch(job,profile).matches)return job.location||'';
 const parts=String(job.location||'').split(/[,;]+/).map(s=>s.trim()).filter(Boolean);
 const selected=parts.filter(location=>{
  const info=locationInfo({location});return profile.country?info.countries.includes(profile.country):info.directContinents.includes(profile.geography);
 });
 if(!selected.length){
  if(geographicMatch(job,profile).kind==='broad'){const region=String(job.location).match(/\b(EMEA|APAC|LATAM)\b/i)?.[0];return region?'Regional remote · '+region:locationInfo(job).worldwide?'Worldwide remote':'Multi-region remote listing';}
  return job.location||'';
 }
 const shown=selected.slice(0,3).join(', '),other=parts.length-Math.min(selected.length,3);
 return shown+(other?' · +'+other+' other advertised locations':'');
}
export function locationGroup(job){
 const info=locationInfo(job);
 if(info.worldwide)return 'Worldwide';
 if(info.countries.length===1)return info.countries[0];
 if(info.countries.length>1)return 'Multiple European countries';
 return normalize(job.location)||'Unspecified';
}
// Only validated provider slugs are sent upstream. Other countries use the Europe feed.
const supportedCountries=new Set('austria belgium bulgaria croatia cyprus czechia denmark estonia finland france germany greece hungary ireland italy latvia lithuania netherlands norway poland portugal romania serbia slovakia slovenia spain sweden switzerland uk ukraine'.split(' '));
export function sourceGeography(region,country){
 if(region==='europe'&&country&&supportedCountries.has(country))return country;
 return {international:'europe',europe:'europe',africa:'emea',asia:'apac',oceania:'apac','north-america':'canada','south-america':'latam'}[region];
}
