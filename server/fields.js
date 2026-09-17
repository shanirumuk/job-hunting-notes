// Runs inside the browser. Return field metadata, never existing field values.
export function inspectForm() {
  const normalize=s=>String(s||'').replace(/([a-z])([A-Z])/g,'$1 $2').toLowerCase().replace(/[_\-[\]*:]/g,' ').replace(/\s+/g,' ').trim();
  const controls=[...document.querySelectorAll('input,textarea,select')];
  const fields=controls.map((el,index)=>{
    const label=[...(el.labels||[])].map(l=>l.textContent).join(' ') || el.getAttribute('aria-label') || (el.getAttribute('aria-labelledby')||'').split(/\s+/).map(id=>document.getElementById(id)?.textContent||'').join(' ');
    el.setAttribute('data-job-notebook-field',String(index));
    return {selector:`[data-job-notebook-field="${index}"]`,label:normalize(label),hint:normalize(el.name+' '+el.id),type:el.type,tag:el.tagName,required:el.required,filled:el.type==='file'?!!el.files?.length:!!el.value?.trim(),disabled:el.disabled||el.readOnly,visible:!!el.getClientRects().length&&getComputedStyle(el).visibility!=='hidden'};
  });
  return {fields,text:document.body.innerText.slice(0,30000),links:[...document.querySelectorAll('a[href]')].map(a=>({text:a.innerText.trim(),url:a.href})).filter(a=>a.text&&a.url.startsWith('https:')).slice(0,250)};
}
export function fieldKey(field) {
  if(field.disabled || field.filled || (!field.visible && field.type!=='file')) return null;
  const text=field.label||field.hint;
  if(/reference|referee|emergency|recruiter|supervisor|preferred|pronoun|sponsor|authori[sz]|salary|password|gender|ethnic|race|disabil|veteran|consent|agree|marketing/.test(text)) return null;
  if(field.type==='file') return /resume|résumé|\bcv\b|lebenslauf/.test(text)&&!/cover|letter|photo|certificate/.test(text)?'cv':null;
  if(field.tag!=='INPUT' || !['text','email','tel','url'].includes(field.type)) return null;
  if(/^(first name|given name|vorname)\b/.test(text)) return 'firstName';
  if(/^(last name|family name|surname|nachname)\b/.test(text)) return 'lastName';
  if(/^(full name|your name|name|candidate name|applicant name)$/.test(text)) return 'name';
  if(/^(?:(?:your|candidate|applicant|contact) )?e[ -]?mail(?: address)?$/.test(text)) return 'email';
  if(/^(?:(?:your|candidate|applicant|contact|mobile) )?(?:phone|telephone|mobile|telefon)(?: number)?$/.test(text)) return 'phone';
  if(/^(?:(?:your|candidate) )?linked ?in(?: profile)?(?: url)?$/.test(text)) return 'linkedin';
  return null;
}
export function identityMatches(text,title,company) {
  const normal=s=>s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ').trim();
  const body=normal(text), words=normal(title).split(' ').filter(w=>w.length>3&&!['remote','hybrid','full','time'].includes(w));
  return body.includes(normal(company)) && words.length>0 && words.filter(w=>body.includes(w)).length>=Math.min(2,words.length);
}
