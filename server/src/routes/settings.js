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
 const c=smsConfig();if(!c.configured)return res.json({verified:false,message:'Add matching SMS credentials in the private server configuration.'});
 const host=c.mode==='live'?'api.africastalking.com':'api.sandbox.africastalking.com';
 try{
  const response=await fetch(`https://${host}/version1/user?`+new URLSearchParams({username:c.username}),{headers:{apikey:c.apiKey,Accept:'application/json'},redirect:'error',signal:AbortSignal.timeout(15000)});
  const body=await response.json().catch(()=>null);
  res.json({verified:response.ok&&!!body?.UserData,message:response.ok&&body?.UserData?'Account connection verified. No SMS sent.':response.status===401||response.status===403?'Authentication rejected. Verify the API username and matching application key. No SMS sent.':'Account check failed. Check your provider application. No SMS sent.'});
 }catch{res.json({verified:false,message:'Could not reach the provider. Try the check again. No SMS sent.'});}
});
router.put('/profile',(req,res)=>{
 const {full_name,phone=''}=req.body||{};
 if(typeof full_name!=='string'||!full_name.trim()||full_name.length>100||typeof phone!=='string'||phone.length>40)return res.status(400).json({error:'Enter your name (up to 100 characters) and phone (up to 40).'});
 db.prepare('UPDATE users SET full_name=?,phone=? WHERE id=?').run(full_name.trim(),phone.trim(),req.user.id);
 res.json(db.prepare('SELECT id,username,full_name,role,phone,resident_id FROM users WHERE id=?').get(req.user.id));
});
export default router;
