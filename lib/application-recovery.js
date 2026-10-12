import {applicationsFromFragment,addLinkedApplication} from './application-link.js';
import {sameJob} from './model.js';

export function validateApplicationRecovery(value){
 if(value?.version!==1||typeof value.id!=='string'||!/^[-a-z0-9]{1,80}$/.test(value.id))throw Error('Invalid application recovery.');
 const entries=applicationsFromFragment('#add-applications='+encodeURIComponent(JSON.stringify(value.entries)));
 if(value.refreshDetails!==undefined&&typeof value.refreshDetails!=='boolean')throw Error('Invalid application details repair.');
 return {version:1,id:value.id,entries,refreshDetails:value.refreshDetails===true};
}
export function recoverSubmittedApplications(entries,recovery){
 const verified=validateApplicationRecovery(recovery);
 let next=entries;
 for(const entry of verified.entries){
  next=addLinkedApplication(next,entry).entries;
  if(verified.refreshDetails){
   // Resolve placeholders on an existing copy of the same confirmed listing.
   const index=next.findIndex(e=>sameJob(e,entry));
   if(index>=0)next=next.map((e,i)=>i===index?{...e,company:entry.company,title:entry.title,location:entry.location,link:entry.link,applicationDate:e.applicationDate||entry.applicationDate}:e);
  }
 }
 return {entries:next,id:verified.id,changed:JSON.stringify(next)!==JSON.stringify(entries)};
}
