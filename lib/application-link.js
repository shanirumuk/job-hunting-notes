import {sameJob,safeURL,validateEntries} from './model.js';

// Application links carry small applied records in the fragment, never a notebook
// backup, CV, connection token or profile. Opening one cannot replace a notebook.
function validateLinkedApplication(input){
 if(!input||Array.isArray(input)||typeof input!=='object')throw Error('Invalid application link.');
 const limits={id:100,company:90,title:180,location:100,link:2000,status:20,applicationDate:10};
 const entry={};
 for(const [key,max] of Object.entries(limits)){
  if(typeof input[key]!=='string'||input[key].length>max)throw Error('Invalid application link.');
  entry[key]=input[key];
 }
 if(!safeURL(entry.link)||entry.status!=='Applied'||!/^\d{4}-\d{2}-\d{2}$/.test(entry.applicationDate)||new Date(entry.applicationDate+'T12:00:00Z').toISOString().slice(0,10)!==entry.applicationDate)throw Error('Invalid applied application.');
 return validateEntries([entry])[0];
}

export function applicationFromFragment(fragment){
 if(!fragment.startsWith('#add-application='))return null;
 if(fragment.length>6000)throw Error('Application link is too long.');
 return validateLinkedApplication(JSON.parse(decodeURIComponent(fragment.slice('#add-application='.length))));
}

export function applicationsFromFragment(fragment){
 if(fragment.startsWith('#add-application='))return [applicationFromFragment(fragment)];
 if(!fragment.startsWith('#add-applications='))return null;
 if(fragment.length>20000)throw Error('Application link is too long.');
 const input=JSON.parse(decodeURIComponent(fragment.slice('#add-applications='.length)));
 if(!Array.isArray(input)||!input.length||input.length>10)throw Error('Invalid applications link.');
 return validateEntries(input.map(validateLinkedApplication));
}

export function addLinkedApplication(entries,incoming){
 const existing=entries.find(e=>sameJob(e,incoming));
 if(!existing)return {entries:[incoming,...entries],message:'Application added as Applied.'};
 // Preserve notes, drafts, existing dates and later recruitment stages. A
 // previously saved/preparing copy can be marked applied without duplicating it.
 const markApplied=['To apply','Not applied','Preparing'].includes(existing.status);
 const updated=markApplied?{...existing,status:'Applied',applicationDate:incoming.applicationDate}:existing;
 return {entries:entries.map(e=>e===existing?updated:e),message:markApplied?'Existing application marked Applied.':'This application is already in your notebook.'};
}
