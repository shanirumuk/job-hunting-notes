// Self-contained: Chrome serialises this function into the active tab.
function fillApplicationFields(fields) {
  const filled = [];
  const names = String(fields.name || '').trim().split(/\s+/);
  const normalise = value => String(value).replace(/([a-z])([A-Z])/g,'$1 $2').toLowerCase().replace(/[_\-[\]*:]/g,' ').replace(/\s+/g,' ').trim();
  const patterns = {
    firstName: /^(?:first name|given name|firstname|candidate first name)\b/,
    lastName: /^(?:last name|family name|surname|lastname|candidate last name)\b/,
    name: /^(?:full name|your name|name|candidate name|legal name|applicant name)$/,
    email: /^(?:(?:your|candidate|applicant|contact) )?e[ -]?mail(?: address)?$/,
    phone: /^(?:(?:your|candidate|applicant|contact|mobile) )?(?:phone|telephone|mobile)(?: number)?$/,
    linkedin: /^(?:(?:your|candidate) )?linked ?in(?: profile)?(?: url)?$/,
    coverLetter: /^(?:cover letter|coverletter|application letter|letter of motivation)(?: text)?$/
  };
  const values = {...fields,firstName:names[0] || '',lastName:names.slice(1).join(' ')};
  for (const el of document.querySelectorAll('input,textarea')) {
    if (el.disabled || el.readOnly || el.value.trim() || el.getClientRects().length === 0 || getComputedStyle(el).visibility === 'hidden') continue;
    if (el.tagName === 'INPUT' && !['text','email','tel','url'].includes(el.type)) continue;
    const labels = [...(el.labels || [])].map(l => l.textContent);
    const labelled = (el.getAttribute('aria-labelledby') || '').split(/\s+/).map(id => document.getElementById(id)?.textContent || '');
    const hints = [...labels,...labelled,el.getAttribute('aria-label') || '',el.name || '',el.id || '',el.autocomplete === 'given-name' ? 'first name' : el.autocomplete === 'family-name' ? 'last name' : el.autocomplete === 'name' ? 'full name' : el.autocomplete === 'email' ? 'email' : el.autocomplete === 'tel' ? 'phone' : ''].map(normalise).filter(Boolean);
    // Prefer explicit visible/accessible labels. Never reinterpret a named reference contact as the applicant.
    const explicit = [...labels,...labelled,el.getAttribute('aria-label') || ''].map(normalise).filter(Boolean);
    if (explicit.some(s => /reference|referee|emergency|supervisor|manager|recruiter|preferred name|pronoun|sponsor|authori[sz]|salary/.test(s))) continue;
    const key = Object.keys(patterns).find(key => (explicit.length ? explicit : hints).some(h => patterns[key].test(h)));
    if (!key || typeof values[key] !== 'string' || !values[key].trim()) continue;
    if (key === 'coverLetter' && el.tagName !== 'TEXTAREA') continue;
    if (key !== 'coverLetter' && el.tagName !== 'INPUT') continue;
    const prototype = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(prototype,'value').set.call(el,values[key]);
    el.dispatchEvent(new Event('input',{bubbles:true}));
    el.dispatchEvent(new Event('change',{bubbles:true}));
    filled.push(key);
  }
  return {count:filled.length,fields:filled};
}
