export const READY_TARGET=10,REFILL_AT=5,REVIEW_LIMIT=12,SEARCH_LIMIT=4;
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
