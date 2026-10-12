import {applicationsFromFragment,addLinkedApplication} from './application-link.js';

export function validateApplicationRecovery(value){
 if(value?.version!==1||typeof value.id!=='string'||!/^[-a-z0-9]{1,80}$/.test(value.id))throw Error('Invalid application recovery.');
 const entries=applicationsFromFragment('#add-applications='+encodeURIComponent(JSON.stringify(value.entries)));
 return {version:1,id:value.id,entries};
}
export function recoverSubmittedApplications(entries,recovery){
 const verified=validateApplicationRecovery(recovery);
 let next=entries;
 for(const entry of verified.entries)next=addLinkedApplication(next,entry).entries;
 return {entries:next,id:verified.id,changed:JSON.stringify(next)!==JSON.stringify(entries)};
}
