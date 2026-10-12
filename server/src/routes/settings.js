import {Router} from 'express';
import db from '../db.js';
import {requireRole} from '../auth.js';
import {getSettings,validateSettings} from '../settings.js';
import {publicSmsConfig,smsConfig} from '../sms.js';
const router=Router();router.use(requireRole('admin'));
router.get('/',(_req,res)=>res.json(getSettings()));
router.put('/',(req,res)=>{try{const value=validateSettings(req.body);db.prepare("INSERT INTO app_settings(id,value,updated_by) VALUES(1,?,?) ON CONFLICT(id) DO UPDATE SET value=excluded.value,updated_by=excluded.updated_by,updated_at=datetime('now')").run(JSON.stringify(value),req.user.id);res.json(getSettings());}catch(e){res.status(400).json({error:e.message});}});
router.get('/integrations',(_req,res)=>res.json({sms:publicSmsConfig(),openai:{configured:!!process.env.OPENAI_API_KEY,model:process.env.OPENAI_REWRITE_MODEL||'gpt-4.1-mini'}}));
router.post('/sms-check',async(_req,res)=>{
 const c=smsConfig();if(!c.configured)return res.json({verified:false,message:'Add matching EgoSMS credentials in the private server configuration.'});
 const url=c.mode==='live'?'https://comms.egosms.co/api/v1/json/':'https://comms-test.pahappa.net/api/v1/json/';
 try{
  const response=await fetch(url,{method:'POST',headers:{Accept:'application/json','Content-Type':'application/json'},redirect:'error',body:JSON.stringify({method:'Balance',userdata:{username:c.username,password:c.password}}),signal:AbortSignal.timeout(15000)});
  const body=await response.json().catch(()=>null);
  res.json({verified:response.ok&&body?.Status==='OK',message:response.ok&&body?.Status==='OK'?'Account connection verified. Local balance: '+body.Balance+' credits. No SMS sent.':body?.Status==='Failed'?'Authentication or account check failed. Verify the EgoSMS API credentials. No SMS sent.':'Account check failed. Check your EgoSMS account. No SMS sent.'});
 }catch{res.json({verified:false,message:'Could not reach EgoSMS. Try the check again. No SMS sent.'});}
});
router.put('/profile',(req,res)=>{
 const {full_name,phone=''}=req.body||{};
 if(typeof full_name!=='string'||!full_name.trim()||full_name.length>100||typeof phone!=='string'||phone.length>40)return res.status(400).json({error:'Enter your name (up to 100 characters) and phone (up to 40).'});
 db.prepare('UPDATE users SET full_name=?,phone=? WHERE id=?').run(full_name.trim(),phone.trim(),req.user.id);
 res.json(db.prepare('SELECT id,username,full_name,role,phone,resident_id FROM users WHERE id=?').get(req.user.id));
});
export default router;
