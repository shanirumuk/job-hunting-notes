const blocks='[data-highlight-kind]';
export function anchorHighlight(text,start,end,kind){
 const raw=text.slice(start,end),quote=raw.trim();
 if(!quote)return null;
 start+=raw.indexOf(quote);
 return {id:globalThis.crypto?.randomUUID?.()||`${Date.now()}-${Math.random().toString(36).slice(2)}`,kind,quote,start,prefix:text.slice(Math.max(0,start-32),start),suffix:text.slice(start+quote.length,start+quote.length+32)};
}
export function validHighlights(value){
 return Array.isArray(value)?value.filter(h=>h&&typeof h.id==='string'&&['advert','requirement'].includes(h.kind)&&typeof h.quote==='string'&&h.quote.length>0&&h.quote.length<=60000&&Number.isInteger(h.start)&&h.start>=0&&typeof h.prefix==='string'&&h.prefix.length<=32&&typeof h.suffix==='string'&&h.suffix.length<=32).slice(0,100):[];
}
export function highlightOffset(text,h){
 const matches=at=>at>=0&&text.slice(at,at+h.quote.length)===h.quote&&text.slice(Math.max(0,at-h.prefix.length),at)===h.prefix&&text.slice(at+h.quote.length,at+h.quote.length+h.suffix.length)===h.suffix;
 if(matches(h.start))return h.start;
 const found=[];let at=text.indexOf(h.quote);
 while(at!==-1){if(matches(at))found.push(at);at=text.indexOf(h.quote,at+1);}
 return found.length===1?found[0]:-1;
}
export function mountListingHighlights(card,{read,write,notify}){
 const bar=document.createElement('div');bar.className='highlight-tools';
 bar.innerHTML='<button type="button" class="text-button" data-highlight-toggle aria-pressed="false">Highlight text</button><button type="button" class="secondary-button" data-highlight-save hidden disabled>Highlight selection</button><p class="highlight-help" hidden>Select text, then Highlight selection. Swiping paused.</p>';
 const saved=document.createElement('details');saved.className='saved-highlights';
 card.querySelector('.inline-role').prepend(bar,saved);
 const toggle=bar.querySelector('[data-highlight-toggle]'),save=bar.querySelector('[data-highlight-save]'),help=bar.querySelector('p');
 let pending=[],editing=false;
 const values=()=>validHighlights(read());
 function paint(){
  const highlights=values();
  for(const block of card.querySelectorAll(blocks)){
   const text=block.textContent,ranges=highlights.filter(h=>h.kind===block.dataset.highlightKind).map(h=>{const start=highlightOffset(text,h);return {start,end:start+h.quote.length};}).filter(r=>r.start>=0).sort((a,b)=>a.start-b.start);
   const merged=[];for(const range of ranges){const last=merged.at(-1);if(last&&range.start<=last.end)last.end=Math.max(last.end,range.end);else merged.push({...range});}
   const fragment=document.createDocumentFragment();let at=0;
   for(const range of merged){fragment.append(text.slice(at,range.start));const mark=document.createElement('mark');mark.className='listing-highlight';mark.textContent=text.slice(range.start,range.end);fragment.append(mark);at=range.end;}
   fragment.append(text.slice(at));block.replaceChildren(fragment);
  }
  saved.replaceChildren();saved.hidden=!highlights.length;
  const summary=document.createElement('summary');summary.textContent=`Saved highlights (${highlights.length})`;saved.append(summary);
  const list=document.createElement('ul');
  for(const h of highlights){const item=document.createElement('li'),quote=document.createElement('blockquote'),remove=document.createElement('button');quote.textContent=h.quote;remove.type='button';remove.className='text-button';remove.textContent='Remove';remove.setAttribute('aria-label',`Remove highlight: ${h.quote.slice(0,70)}`);remove.onclick=()=>{if(write(values().filter(value=>value.id!==h.id))){paint();saved.querySelector('summary').focus();notify('Highlight removed.');}};item.append(quote,remove);list.append(item);}
  saved.append(list);
 }
 function capture(){
  pending=[];
  const selection=window.getSelection();
  if(editing&&selection?.rangeCount&&!selection.isCollapsed){
   const selected=selection.getRangeAt(0);
   if(card.contains(selected.startContainer)&&card.contains(selected.endContainer))for(const block of card.querySelectorAll(blocks)){
    if(!selected.intersectsNode(block))continue;
    const range=document.createRange();range.selectNodeContents(block);
    if(selected.compareBoundaryPoints(Range.START_TO_START,range)>0)range.setStart(selected.startContainer,selected.startOffset);
    if(selected.compareBoundaryPoints(Range.END_TO_END,range)<0)range.setEnd(selected.endContainer,selected.endOffset);
    const before=document.createRange();before.selectNodeContents(block);before.setEnd(range.startContainer,range.startOffset);
    const start=before.toString().length,anchor=anchorHighlight(block.textContent,start,start+range.toString().length,block.dataset.highlightKind);
    if(anchor)pending.push(anchor);
   }
  }
  save.disabled=!pending.length;
 }
 toggle.onclick=()=>{editing=!editing;card.classList.toggle('highlighting',editing);toggle.setAttribute('aria-pressed',String(editing));toggle.textContent=editing?'Done':'Highlight text';toggle.setAttribute('aria-label',editing?'Done highlighting':'Highlight text');save.hidden=help.hidden=!editing;capture();if(!editing)paint();};
 save.addEventListener('pointerdown',event=>event.preventDefault());
 save.onclick=()=>{
  if(!pending.length)return;
  const next=values();for(const h of pending)if(!next.some(v=>v.kind===h.kind&&v.quote===h.quote&&v.start===h.start&&v.prefix===h.prefix&&v.suffix===h.suffix))next.push(h);
  if(next.length>100){notify('You can keep up to 100 highlights per job. Remove an older highlight first.');return;}
  if(write(next)){window.getSelection()?.removeAllRanges();pending=[];save.disabled=true;paint();notify('Highlight saved for this job.');}
 };
 document.addEventListener('selectionchange',capture);
 paint();
 return {refresh:paint,destroy:()=>document.removeEventListener('selectionchange',capture)};
}
