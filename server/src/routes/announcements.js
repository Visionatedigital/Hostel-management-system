import { Router } from 'express';
import db from '../db.js';
import rewriteRouter from './announcement-rewrite.js';
import smsRouter from './announcement-sms.js';
import { requireRole } from '../auth.js';

const router = Router();
router.use(rewriteRouter);
router.use(smsRouter);


const select=`SELECT a.*,u.full_name AS author_name FROM announcements a LEFT JOIN users u ON u.id=a.created_by`;
const present=a=>({...a,audience_label:a.audience_label||(a.audience==='all'?'Everyone':a.audience==='residents'?'Residents':'Staff')});
router.get('/',(req,res)=>{
 let sql=select,params=[];
 if(req.user.role!=='admin'){
  const resident=req.user.role==='resident'?db.prepare('SELECT resident_id FROM users WHERE id=?').get(req.user.id)?.resident_id:null;
  const builtins=req.user.role==='resident'?['all','residents']:['all','staff'];
  sql+=` WHERE (a.audience_group_id IS NULL AND a.audience IN (?,?)) OR EXISTS (
    SELECT 1 FROM announcement_recipients ar WHERE ar.announcement_id=a.id AND (ar.user_id=? OR ar.resident_id=?)
  )`;
  params=[...builtins,req.user.id,resident||null];
 }
 sql+=' ORDER BY a.created_at DESC,a.id DESC';
 res.json(db.prepare(sql).all(...params).map(present));
});
router.post('/',requireRole('admin'),(req,res)=>{
 const {title,body='',audience='all'}=req.body||{};
 if(typeof title!=='string'||!title.trim()||title.length>200||typeof body!=='string'||body.length>6000)return res.status(400).json({error:'Enter a title of up to 200 characters and a body of up to 6,000.'});
 let group=null,members=[];
 if(typeof audience==='string'&&/^group:[1-9]\d*$/.test(audience)){
  group=db.prepare('SELECT * FROM announcement_audiences WHERE id=? AND archived=0').get(Number(audience.slice(6)));
  if(!group)return res.status(400).json({error:'This audience is unavailable. Select another audience.'});
  members=db.prepare(`SELECT m.* FROM announcement_audience_members m
   LEFT JOIN residents r ON r.id=m.resident_id LEFT JOIN users u ON u.id=m.user_id
   WHERE m.audience_id=? AND ((m.resident_id IS NOT NULL AND r.status<>'departed') OR (m.user_id IS NOT NULL AND u.active=1))`).all(group.id);
  if(!members.length)return res.status(400).json({error:'This audience has no available recipients. Update its members before posting.'});
 }else if(!['all','residents','staff'].includes(audience))return res.status(400).json({error:'Select a valid audience.'});
 const id=db.transaction(()=>{
  const info=db.prepare('INSERT INTO announcements(title,body,audience,created_by,audience_group_id,audience_label,recipient_count) VALUES(?,?,?,?,?,?,?)').run(title.trim(),body,group?'residents':audience,req.user.id,group?.id||null,group?.name||null,group?members.length:null);
  const insert=db.prepare('INSERT INTO announcement_recipients(announcement_id,recipient_key,resident_id,user_id) VALUES(?,?,?,?)');
  for(const member of members)insert.run(info.lastInsertRowid,member.recipient_key,member.resident_id,member.user_id);
  return info.lastInsertRowid;
 })();
 res.status(201).json(present(db.prepare(select+' WHERE a.id=?').get(id)));
});

router.delete('/:id', requireRole('admin'), (req, res) => {
  const a = db.prepare('SELECT * FROM announcements WHERE id = ?').get(req.params.id);
  if (!a) return res.status(404).json({ error: 'Announcement not found' });
  db.prepare('DELETE FROM announcements WHERE id = ?').run(a.id);
  res.json({ ok: true });
});

export default router;
