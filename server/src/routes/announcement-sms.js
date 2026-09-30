import {Router} from 'express';
import {randomUUID} from 'node:crypto';
import db from '../db.js';
import {requireRole} from '../auth.js';
import {smsConfig,publicSmsConfig,normalizePhone,smsSegments,sendSms,SmsError} from '../sms.js';
const router=Router();
router.use('/sms',requireRole('admin'));
router.get('/sms/config',(_req,res)=>res.json(publicSmsConfig()));
function present(row){const {config_fingerprint,created_by,...safe}=row;return {...safe,test:!!row.test,recipients:JSON.parse(row.recipients),skipped:JSON.parse(row.skipped),results:JSON.parse(row.results),...smsSegments(row.message)};}
function audienceMembers(a){
 if(a.audience_group_id)return db.prepare(`SELECT COALESCE(r.first_name||' '||r.last_name,u.full_name) AS name,COALESCE(r.phone,u.phone) AS phone FROM announcement_recipients m LEFT JOIN residents r ON r.id=m.resident_id LEFT JOIN users u ON u.id=m.user_id WHERE m.announcement_id=? AND ((r.id IS NOT NULL AND r.status<>'departed') OR (u.id IS NOT NULL AND u.active=1))`).all(a.id);
 let rows=[];
 if(['all','residents'].includes(a.audience))rows.push(...db.prepare("SELECT first_name||' '||last_name AS name,phone FROM residents WHERE status<>'departed'").all());
 if(['all','staff'].includes(a.audience))rows.push(...db.prepare("SELECT full_name AS name,phone FROM users WHERE active=1 AND role IN ('admin','security')").all());
 return rows;
}
router.get('/sms/history/:id',(req,res)=>res.json(db.prepare("SELECT * FROM announcement_sms WHERE announcement_id=? AND status<>'draft' ORDER BY created_at DESC,rowid DESC LIMIT 50").all(req.params.id).map(present)));
router.post('/sms/preview',(req,res)=>{
 const {announcement_id,message,test_numbers}=req.body||{};
 if(typeof message!=='string'||!message.trim()||message.length>1600)return res.status(400).json({error:'Enter an SMS message of 1–1,600 characters.'});
 const a=db.prepare('SELECT * FROM announcements WHERE id=?').get(announcement_id||null);
 if(!a)return res.status(404).json({error:'Announcement not found.'});
 let members,test=test_numbers!==undefined;
 if(test){
  if(!Array.isArray(test_numbers)||!test_numbers.length||test_numbers.length>5||test_numbers.some(n=>!normalizePhone(n)))return res.status(400).json({error:'Enter up to five valid test numbers with country codes.'});
  members=test_numbers.map(phone=>({name:'Test recipient',phone}));
 }else members=audienceMembers(a);
 const recipients=[],skipped=[],seen=new Set();
 for(const m of members){const number=normalizePhone(m.phone);if(!number){skipped.push({name:m.name,reason:m.phone?'Invalid phone number':'No phone number'});continue;}if(seen.has(number)){skipped.push({name:m.name,reason:'Duplicate phone number'});continue;}seen.add(number);recipients.push({name:m.name,number});}
 if(!recipients.length)return res.status(400).json({error:'No valid phone numbers in this audience. Add phone numbers or choose test mode.'});
 if(recipients.length>500)return res.status(400).json({error:'This version supports up to 500 unique recipients per send. Create smaller audiences.'});
 const c=smsConfig(),id=randomUUID();
 db.prepare('INSERT INTO announcement_sms(id,announcement_id,created_by,message,mode,sender,config_fingerprint,test,recipients,skipped) VALUES(?,?,?,?,?,?,?,?,?,?)').run(id,a.id,req.user.id,message.trim(),c.mode,c.sender||'Provider default',c.fingerprint,test?1:0,JSON.stringify(recipients),JSON.stringify(skipped));
 res.status(201).json({...present(db.prepare('SELECT * FROM announcement_sms WHERE id=?').get(id)),configured:c.configured});
});
router.post('/sms/send/:id',async(req,res)=>{
 const row=db.prepare('SELECT * FROM announcement_sms WHERE id=? AND created_by=?').get(req.params.id,req.user.id);
 if(!row)return res.status(404).json({error:'SMS review not found.'});
 if(row.status!=='draft')return res.json(present(row)); // Never resubmit a used review, even after network/client failure.
 if(req.body?.confirm!==true)return res.status(400).json({error:'Review and confirm this SMS send first.'});
 if(Date.now()-Date.parse(row.created_at.replace(' ','T')+'Z')>30*60000)return res.status(409).json({error:'This review expired. Review recipients again.'});
 if(!row.announcement_id)return res.status(409).json({error:'This announcement was deleted. Create a new review.'});
 const c=smsConfig();
 if(!c.configured)return res.status(503).json({error:'Africa’s Talking is not configured. Add the server credentials first.'});
 if(c.fingerprint!==row.config_fingerprint)return res.status(409).json({error:'SMS provider settings changed. Create a new review.'});
 db.prepare("UPDATE announcement_sms SET status='submitting',submitted_at=datetime('now') WHERE id=? AND status='draft'").run(row.id);
 try{
  const results=await sendSms({message:row.message,numbers:JSON.parse(row.recipients).map(r=>r.number),config:c});
  const status=results.some(r=>r.status==='unknown')?'unknown':results.every(r=>r.status==='accepted')?'accepted':results.some(r=>r.status==='accepted')?'partial':'rejected';
  db.prepare('UPDATE announcement_sms SET status=?,results=? WHERE id=?').run(status,JSON.stringify(results),row.id);
 }catch(e){
  db.prepare('UPDATE announcement_sms SET status=?,error=? WHERE id=?').run(!(e instanceof SmsError)||e.uncertain?'unknown':'rejected',e instanceof SmsError?e.message:'SMS could not be completed. Check the provider dashboard before retrying.',row.id);
 }
 res.json(present(db.prepare('SELECT * FROM announcement_sms WHERE id=?').get(row.id)));
});
export default router;
