import db from './db.js';
export const defaultSettings={hostel_name:'New Nana Hostel',address:'',phone:'',email:'',report_footer:'Prepared by New Nana Hostel management.',default_tenant_type:'bachelor',default_billing_basis:'fixed',default_payment_method:'cash',sleepover_nightly_rate:30000};
export function getSettings(){const row=db.prepare('SELECT * FROM app_settings WHERE id=1').get();return {...defaultSettings,...(row?JSON.parse(row.value):{}),updated_at:row?.updated_at||null};}
export function validateSettings(input){
 if(!input||typeof input!=='object'||Array.isArray(input))throw Error('Invalid settings.');
 if(Object.keys(input).some(k=>!Object.hasOwn(defaultSettings,k)))throw Error('Unknown setting.');
 const value={...getSettings(),...input};delete value.updated_at;
 for(const [key,max] of Object.entries({hostel_name:80,address:250,phone:40,email:120,report_footer:250})){
  if(typeof value[key]!=='string'||value[key].length>max)throw Error(`${key.replaceAll('_',' ')} must be text of up to ${max} characters.`);
  value[key]=value[key].trim();
 }
 if(!value.hostel_name)throw Error('Hostel name is required.');
 if(value.email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.email))throw Error('Enter a valid contact email.');
 if(!['bachelor','ldc','other'].includes(value.default_tenant_type)||!['fixed','monthly'].includes(value.default_billing_basis)||!['cash','bank','mtn_momo','airtel_money','other'].includes(value.default_payment_method))throw Error('Choose valid tenancy and receipt defaults.');
 if(!Number.isSafeInteger(value.sleepover_nightly_rate)||value.sleepover_nightly_rate<0||value.sleepover_nightly_rate>10000000)throw Error('Sleepover nightly rate must be a whole UGX amount between 0 and 10,000,000.');
 return value;
}
