import { parsePhoneNumberFromString } from 'libphonenumber-js/max';
import { createHash } from 'node:crypto';

export function smsConfig() {
 const mode=process.env.AFRICASTALKING_ENVIRONMENT||'sandbox';
 const username=(process.env.AFRICASTALKING_USERNAME||'').trim();
 const apiKey=(process.env.AFRICASTALKING_API_KEY||'').trim();
 const sender=(process.env.AFRICASTALKING_SENDER_ID||'').trim();
 const valid=['sandbox','live'].includes(mode)&&(mode==='sandbox'?username==='sandbox':username&&username!=='sandbox');
 return {mode,username,apiKey,sender,configured:!!(valid&&apiKey),fingerprint:createHash('sha256').update(JSON.stringify([mode,username,apiKey,sender])).digest('hex')};
}
export function publicSmsConfig(){const c=smsConfig();return {mode:c.mode,sender:c.sender||'Provider default',configured:c.configured};}
export function normalizePhone(value){
 if(typeof value!=='string'||!value.trim()||value.length>40)return null;
 const raw=value.trim().replace(/^00/,'+');
 if(!/^[+\d\s().-]+$/.test(raw))return null;
 const p=parsePhoneNumberFromString(raw,'UG');
 return p?.isValid()?p.number:null;
}
const gsm=new Set(Array.from('@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !"#¤%&\'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà'));
const extended=new Set(Array.from('^{}\\[~]|€\f'));
export function smsSegments(message){
 let units=0,unicode=false;
 for(const c of message){if(gsm.has(c))units++;else if(extended.has(c))units+=2;else{unicode=true;break;}}
 if(unicode)units=message.length;
 const single=unicode?70:160,multi=unicode?67:153;
 return {encoding:unicode?'Unicode':'GSM-7',units,segments:units?units<=single?1:Math.ceil(units/multi):0};
}
export class SmsError extends Error{constructor(message,uncertain=false){super(message);this.uncertain=uncertain;}}
export async function sendSms({message,numbers,config=smsConfig(),fetchImpl=fetch}){
 if(!config.configured)throw new SmsError('Africa’s Talking is not configured. Add the server credentials first.');
 const form=new URLSearchParams({username:config.username,to:numbers.join(','),message,bulkSMSMode:'1',enqueue:'1'});
 if(config.sender)form.set('from',config.sender);
 const url=config.mode==='live'?'https://api.africastalking.com/version1/messaging':'https://api.sandbox.africastalking.com/version1/messaging';
 let response;
 try{response=await fetchImpl(url,{method:'POST',redirect:'error',headers:{apikey:config.apiKey,Accept:'application/json','Content-Type':'application/x-www-form-urlencoded'},body:form,signal:AbortSignal.timeout(25000)});}
 catch{throw new SmsError('The provider response was not received. Check Africa’s Talking before sending again; these messages may already have been accepted.',true);}
 if(!response.ok){
  if(response.status>=500)throw new SmsError('The provider returned an error. Check its dashboard before sending again.',true);
  throw new SmsError(response.status===401||response.status===403?'Provider rejected authentication. Check the application username and API key.':'Provider rejected this request. Check your sender ID, balance and application settings.');
 }
 let payload;try{payload=await response.json();}catch{throw new SmsError('Provider returned an unreadable response. Check its dashboard before sending again.',true);}
 const entries=payload?.SMSMessageData?.Recipients;
 if(!Array.isArray(entries))throw new SmsError('Provider did not return recipient results. Check its dashboard before sending again.',true);
 return numbers.map(number=>{
  const r=entries.find(e=>normalizePhone(e.number)===number);
  const code=Number(r?.statusCode);
  const accepted=[100,101,102].includes(code);
  const reasons={401:'Provider risk hold',402:'Invalid or unapproved sender ID',403:'Invalid phone number',404:'Unsupported number type',405:'Insufficient provider balance',406:'Recipient blacklisted or opted out',407:'Could not route',500:'Provider internal error',501:'Gateway error',502:'Rejected by gateway'};
  return {number,status:!r||!Number.isFinite(code)?'unknown':accepted?'accepted':'rejected',reason:reasons[code]||null,provider_code:Number.isFinite(code)?code:null,
   message_id:typeof r?.messageId==='string'&&/^[\w.-]{1,200}$/.test(r.messageId)?r.messageId:null,
   cost:typeof r?.cost==='string'&&/^[A-Z]{3} \d+(\.\d+)?$/.test(r.cost)?r.cost:null};
 });
}
