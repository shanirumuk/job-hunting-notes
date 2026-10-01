// Private, explicitly confirmed additions are applied once without replacing
// imported CV evidence or subsequent language/location edits.
export function applyProfileCorrections(profile,correction){
 if(!correction||typeof correction.id!=='string')return profile;
 let changed=false;const next={...profile};
 if(correction.id!==profile.profileCorrectionVersion){
  next.profileCorrectionVersion=correction.id;changed=true;
  for(const field of ['languages','relocation'])if(typeof correction[field]==='string')next[field]=correction[field];
  if(correction.nativeEnglish===true){
   const languages=next.languages.split(/[,;\n]/).map(s=>s.trim()).filter(Boolean),english=languages.findIndex(s=>/\bEnglish\b/i.test(s));
   if(english<0)languages.unshift('English native');
   else {const level=languages[english].match(/\b[ABC][12]\b/i)?.[0];languages[english]='English native'+(level?' ('+level.toUpperCase()+')':'');}
   next.languages=languages.join(', ');
  }
 }
 const update=correction.evidenceUpdate;
 if(typeof update?.id==='string'&&update.id!==profile.evidenceCorrectionVersion&&Array.isArray(update.lines)){
  const lines=String(next.evidence||'').split('\n');
  for(const line of update.lines)if(typeof line==='string'&&line.trim()&&!lines.includes(line.trim()))lines.push(line.trim());
  next.evidence=lines.filter(Boolean).join('\n');next.evidenceCorrectionVersion=update.id;changed=true;
 }
 const preference=correction.preferenceUpdate;
 if(typeof preference?.id==='string'&&preference.id!==profile.preferenceCorrectionVersion&&typeof preference.workStyle==='string'){
  next.workStyle=preference.workStyle;next.preferenceCorrectionVersion=preference.id;changed=true;
 }
 return changed?next:profile;
}
