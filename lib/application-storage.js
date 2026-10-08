// Merge edits against the last read copy, so a stale tab cannot erase an
// application added elsewhere. Conflicting edits remain unsaved for review.
const equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
export class ApplicationConflict extends Error {
 constructor(){super('This application changed in another tab. Reopen it before saving; your other applications are safe.');}
}
export function mergeApplicationEntries(before,local,remote){
 const index=rows=>new Map(rows.map(row=>[row.id,row]));
 const baseline=index(before),mine=index(local),latest=index(remote),result=[];
 for(const id of new Set([...mine.keys(),...latest.keys(),...baseline.keys()])){
  const a=baseline.get(id),b=mine.get(id),c=latest.get(id);
  if(equal(a,b)){if(c)result.push(c);continue;}
  if(equal(a,c)||equal(b,c)){if(b)result.push(b);continue;}
  if(!a||!b||!c)throw new ApplicationConflict();
  const merged={};
  for(const key of new Set([...Object.keys(a),...Object.keys(b),...Object.keys(c)])){
   if(equal(a[key],b[key])){if(Object.hasOwn(c,key))merged[key]=c[key];}
   else if(equal(a[key],c[key])||equal(b[key],c[key])){if(Object.hasOwn(b,key))merged[key]=b[key];}
   else throw new ApplicationConflict();
  }
  result.push(merged);
 }
 return result;
}
