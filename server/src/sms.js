import { parsePhoneNumberFromString } from 'libphonenumber-js/max';
import { createHash } from 'node:crypto';

export function smsConfig() {
 const mode=process.env.EGOSMS_ENVIRONMENT||'sandbox';
 const username=(process.env.EGOSMS_USERNAME||'').trim();
 const password=(process.env.EGOSMS_PASSWORD||'').trim();
 const sender=(process.env.EGOSMS_SENDER_ID||'EgoSMS').trim();
 const valid=['sandbox','live'].includes(mode)&&username&&password&&sender;
 return {mode,username,password,sender,configured:!!valid,fingerprint:createHash('sha256').update(JSON.stringify([mode,username,password,sender])).digest('hex')};
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
 if(!config.configured)throw new SmsError('EgoSMS is not configured. Add the server credentials first.');
 if(!Array.isArray(numbers)||!numbers.length||numbers.length>1000)throw new SmsError('Choose between 1 and 1,000 SMS recipients.');
 const body={method:'SendSms',userdata:{username:config.username,password:config.password},msgdata:numbers.map(number=>({number:number.replace(/^\+/,''),message,senderid:config.sender,priority:1}))};
 const url=config.mode==='live'?'https://comms.egosms.co/api/v1/json/':'https://comms-test.pahappa.net/api/v1/json/';
 let response;
 try{response=await fetchImpl(url,{method:'POST',redirect:'error',headers:{Accept:'application/json','Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(25000)});}
 catch{throw new SmsError('The provider response was not received. Check EgoSMS before sending again; these messages may already have been accepted.',true);}
 if(!response.ok){
  if(response.status>=500)throw new SmsError('The provider returned an error. Check its dashboard before sending again.',true);
  throw new SmsError(response.status===401||response.status===403?'Provider rejected authentication. Check the EgoSMS API username and password.':'Provider rejected this request. Check your sender ID, balance and account settings.');
 }
 let payload;try{payload=await response.json();}catch{throw new SmsError('Provider returned an unreadable response. Check its dashboard before sending again.',true);}
 if(payload?.Status==='Failed')throw new SmsError(typeof payload.Message==='string'&&payload.Message.length<=300?payload.Message:'EgoSMS rejected the request. Check credentials, sender ID and balance.');
 if(payload?.Status!=='OK')throw new SmsError('Provider returned an unknown response. Check its dashboard before sending again.',true);
 const reference=typeof payload.MsgFollowUpUniqueCode==='string'&&/^[\w.-]{1,200}$/.test(payload.MsgFollowUpUniqueCode)?payload.MsgFollowUpUniqueCode:null;
 return numbers.map(number=>({number,status:'accepted',reason:null,provider_code:null,message_id:reference,cost:null}));
}
