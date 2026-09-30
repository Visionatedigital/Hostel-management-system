import {Router} from 'express';
import db from '../db.js';
import {requireRole} from '../auth.js';
const router=Router();router.use(requireRole('admin'));
function groups(){return db.prepare('SELECT * FROM announcement_audiences ORDER BY archived,name').all().map(g=>({...g,members:db.prepare('SELECT resident_id,user_id FROM announcement_audience_members WHERE audience_id=?').all(g.id)}));}
router.get('/',(req,res)=>res.json(groups()));
router.get('/recipients',(req,res)=>res.json({
 residents:db.prepare("SELECT r.id,r.first_name,r.last_name,r.status,rm.name AS room_name FROM residents r LEFT JOIN rooms rm ON rm.id=r.room_id WHERE r.status<>'departed' ORDER BY r.first_name,r.last_name").all(),
 staff:db.prepare("SELECT id,full_name,username,role FROM users WHERE role IN ('admin','security') AND active=1 ORDER BY full_name").all()
}));
function validate(body){
 const {name,description='',resident_ids=[],user_ids=[]}=body||{};
 if(typeof name!=='string'||!name.trim()||name.trim().length>80||typeof description!=='string'||description.length>300)throw new Error('Enter an audience name (up to 80 characters) and description (up to 300).');
 if(!Array.isArray(resident_ids)||!Array.isArray(user_ids)||resident_ids.length+user_ids.length>10000)throw new Error('Invalid recipient selection.');
 const residents=[...new Set(resident_ids)],users=[...new Set(user_ids)];
 if(!residents.length&&!users.length)throw new Error('Select at least one recipient.');
 for(const id of residents)if(!Number.isSafeInteger(id)||!db.prepare("SELECT id FROM residents WHERE id=? AND status<>'departed'").get(id))throw new Error('A selected resident is unavailable. Refresh the recipient list.');
 for(const id of users)if(!Number.isSafeInteger(id)||!db.prepare("SELECT id FROM users WHERE id=? AND role IN ('admin','security') AND active=1").get(id))throw new Error('A selected staff member is unavailable. Refresh the recipient list.');
 return {name:name.trim(),description:description.trim(),residents,users};
}
function saveMembers(id,data){
 db.prepare('DELETE FROM announcement_audience_members WHERE audience_id=?').run(id);
 const insert=db.prepare('INSERT INTO announcement_audience_members(audience_id,recipient_key,resident_id,user_id) VALUES(?,?,?,?)');
 for(const rid of data.residents)insert.run(id,`resident:${rid}`,rid,null);
 for(const uid of data.users)insert.run(id,`user:${uid}`,null,uid);
}
router.post('/',(req,res)=>{
 try{
  const data=validate(req.body);
  if(db.prepare('SELECT id FROM announcement_audiences WHERE name=?').get(data.name))return res.status(409).json({error:'An audience with that name already exists.'});
  const id=db.transaction(()=>{const info=db.prepare('INSERT INTO announcement_audiences(name,description,created_by) VALUES(?,?,?)').run(data.name,data.description,req.user.id);saveMembers(info.lastInsertRowid,data);return info.lastInsertRowid;})();
  res.status(201).json(groups().find(g=>g.id===id));
 }catch(e){res.status(400).json({error:e.message});}
});
router.put('/:id',(req,res)=>{
 const group=db.prepare('SELECT * FROM announcement_audiences WHERE id=?').get(req.params.id);
 if(!group)return res.status(404).json({error:'Audience not found.'});
 try{
  if(Object.keys(req.body||{}).length===1&&typeof req.body.archived==='boolean'){
   db.prepare('UPDATE announcement_audiences SET archived=? WHERE id=?').run(req.body.archived?1:0,group.id);
  }else{
   const data=validate(req.body);
   if(db.prepare('SELECT id FROM announcement_audiences WHERE name=? AND id<>?').get(data.name,group.id))return res.status(409).json({error:'An audience with that name already exists.'});
   db.transaction(()=>{db.prepare('UPDATE announcement_audiences SET name=?,description=? WHERE id=?').run(data.name,data.description,group.id);saveMembers(group.id,data);})();
  }
  res.json(groups().find(g=>g.id===group.id));
 }catch(e){res.status(400).json({error:e.message});}
});
export default router;
