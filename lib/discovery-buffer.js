export const READY_TARGET=10,REFILL_AT=5,REVIEW_LIMIT=12,SEARCH_LIMIT=4;
export const DAILY_REVIEW_LIMIT=36,DAILY_SEARCH_LIMIT=6,RESUME_DELAY=60000;
export function dailyUsage(value,now=Date.now()){
 const day=new Date(now).toISOString().slice(0,10);
 if(value?.day!==day)return {day,reviews:0,searches:0};
 return {day,reviews:Math.max(0,Math.min(DAILY_REVIEW_LIMIT,Number(value.reviews)||0)),searches:Math.max(0,Math.min(DAILY_SEARCH_LIMIT,Number(value.searches)||0))};
}
export const nextBudgetDay=now=>Date.parse(new Date(now).toISOString().slice(0,10)+'T00:00:00Z')+86400000;
export function readBuffer(value){
 return {refilling:value?.refilling!==false,reviews:Number.isInteger(value?.reviews)&&value.reviews>=0&&value.reviews<=REVIEW_LIMIT?value.reviews:REVIEW_LIMIT,searches:Number.isInteger(value?.searches)&&value.searches>=0&&value.searches<=SEARCH_LIMIT?value.searches:SEARCH_LIMIT};
}
export function advanceBuffer(value,ready){
 const state=readBuffer(value);
 if(ready>=READY_TARGET)return {...state,refilling:false};
 if(!state.refilling&&ready<=REFILL_AT)return readBuffer();
 return state;
}
export function canFillBuffer(state,ready,inFlight=0){return state.refilling&&state.reviews>0&&ready+inFlight<READY_TARGET;}
