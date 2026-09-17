const button = document.getElementById('fill'), message = document.getElementById('message');
button.addEventListener('click',async () => {
  button.disabled = true;
  try {
    const raw = document.getElementById('pack').value;
    if (raw.length > 100000) throw new Error('This pack is too large. Copy a new pack from Job notebook.');
    let pack; try {pack = JSON.parse(raw);} catch {throw new Error('Paste the complete JSON autofill pack from Job notebook.');}
    if (pack.version !== 1 || !pack.fields || typeof pack.fields !== 'object') throw new Error('This is not a Job notebook autofill pack.');
    const fields = Object.fromEntries(['name','email','phone','linkedin','coverLetter'].filter(k => typeof pack.fields[k] === 'string').map(k => [k,pack.fields[k]]));
    const [tab] = await chrome.tabs.query({active:true,currentWindow:true});
    if (!tab?.id || !/^https?:/.test(tab.url || '')) throw new Error('Open the employer’s application form in a normal browser tab first.');
    const results = await chrome.scripting.executeScript({target:{tabId:tab.id},func:fillApplicationFields,args:[fields]});
    const count = results[0]?.result?.count || 0;
    message.textContent = count ? `Filled ${count} standard fields. Review them, complete other questions and attach your CV. Nothing was submitted.` : 'No empty standard fields found. Open the actual form; for an embedded form, open it in a separate tab. Custom questions need your input.';
  } catch (error) {message.textContent = error.message || 'Could not access this form. Complete it manually.';}
  finally {button.disabled = false;}
});
