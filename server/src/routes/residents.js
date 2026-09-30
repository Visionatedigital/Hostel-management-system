import { Router } from 'express';
import db from '../db.js';
import { randomUUID } from 'node:crypto';
import multer from 'multer';
import { requireRole } from '../auth.js';
import { agreementTerms, agreementSnapshot, generateTenancyPdf } from '../documents/tenancy.js';

const router = Router();

const residentSelect = `
  SELECT r.*, rm.name AS room_name, rm.type AS room_type
  FROM residents r LEFT JOIN rooms rm ON rm.id = r.room_id
`;

router.get('/', (req, res) => {
  const { status, room_id, q } = req.query;
  let sql = residentSelect + ' WHERE 1=1';
  const params = [];
  if (status) { sql += ' AND r.status = ?'; params.push(status); }
  if (room_id) { sql += ' AND r.room_id = ?'; params.push(room_id); }
  if (q) {
    sql += ' AND (r.first_name LIKE ? OR r.last_name LIKE ? OR r.national_id LIKE ? OR r.phone LIKE ?)';
    const like = `%${q}%`;
    params.push(like, like, like, like);
  }
  sql += ' ORDER BY r.first_name';
  res.json(db.prepare(sql).all(...params));
});


const documentMetadata=`SELECT id,kind,filename,created_at FROM tenancy_documents WHERE resident_id=? ORDER BY created_at DESC,rowid DESC`;
router.get('/:id/agreements',requireRole('admin'),(req,res)=>{
  if(!db.prepare('SELECT id FROM residents WHERE id=?').get(req.params.id))return res.status(404).json({error:'Resident not found'});
  const latest=db.prepare("SELECT snapshot FROM tenancy_documents WHERE resident_id=? AND kind='generated' ORDER BY created_at DESC,rowid DESC LIMIT 1").get(req.params.id);
  res.json({documents:db.prepare(documentMetadata).all(req.params.id),terms:latest?JSON.parse(latest.snapshot).terms:null});
});
router.get('/:id/agreements/:documentId',requireRole('admin'),(req,res)=>{
  const document=db.prepare('SELECT * FROM tenancy_documents WHERE resident_id=? AND id=?').get(req.params.id,req.params.documentId);
  if(!document)return res.status(404).json({error:'Agreement not found'});
  res.set({'Content-Type':'application/pdf','Content-Disposition':`attachment; filename="${document.filename}"`,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});
  res.send(document.pdf);
});
router.post('/:id/agreements',requireRole('admin'),async(req,res,next)=>{
  const resident=db.prepare(residentSelect+' WHERE r.id=?').get(req.params.id);
  if(!resident)return res.status(404).json({error:'Resident not found'});
  try {
    const terms=agreementTerms(req.body),id=randomUUID(),reference=`NNH-${id.slice(0,8).toUpperCase()}`;
    const snapshot=agreementSnapshot(resident,terms,reference),pdf=await generateTenancyPdf(snapshot);
    db.prepare('INSERT INTO tenancy_documents(id,resident_id,kind,filename,snapshot,pdf) VALUES(?,?,?,?,?,?)').run(id,resident.id,'generated',`${reference}-tenancy-agreement.pdf`,JSON.stringify(snapshot),pdf);
    res.status(201).json({id,reference});
  }catch(error){if(/must|valid|Invalid|end date/.test(error.message))return res.status(400).json({error:error.message});next(error);}
});
const signedUpload=multer({storage:multer.memoryStorage(),limits:{fileSize:10*1024*1024,files:1}});
router.post('/:id/agreements/signed',requireRole('admin'),(req,res,next)=>{
  if(!db.prepare('SELECT id FROM residents WHERE id=?').get(req.params.id))return res.status(404).json({error:'Resident not found'});
  signedUpload.single('agreement')(req,res,error=>{
    if(error)return res.status(400).json({error:error.code==='LIMIT_FILE_SIZE'?'PDF must be smaller than 10 MB.':'Choose one PDF file.'});
    if(!req.file||req.file.buffer.subarray(0,5).toString()!=='%PDF-')return res.status(400).json({error:'Attach a valid PDF agreement.'});
    try {
      const id=randomUUID();
      db.prepare('INSERT INTO tenancy_documents(id,resident_id,kind,filename,pdf) VALUES(?,?,?,?,?)').run(id,req.params.id,'signed',`NNH-signed-${id.slice(0,8)}.pdf`,req.file.buffer);
      res.status(201).json({id});
    }catch(e){next(e);}
  });
});

router.get('/:id', (req, res) => {
  const resident = db.prepare(residentSelect + ' WHERE r.id = ?').get(req.params.id);
  if (!resident) return res.status(404).json({ error: 'Resident not found' });
  res.json(resident);
});

router.post('/', requireRole('admin'), async (req, res, next) => {
  const { first_name, last_name, phone, email, national_id, photo_path, room_id, status, move_in_date, notes } = req.body || {};
  if (typeof first_name!=='string'||typeof last_name!=='string'||!first_name.trim()||!last_name.trim()) return res.status(400).json({ error: 'First and last name required' });
  try {
    for (const [key,max] of [['first_name',60],['last_name',60],['phone',60],['email',120],['national_id',80]]) {
      if (req.body[key] != null && (typeof req.body[key]!=='string'||req.body[key].length>max)) return res.status(400).json({error:`${key.replaceAll('_',' ')} is too long or invalid.`});
    }
    const room=room_id?db.prepare('SELECT * FROM rooms WHERE id=?').get(room_id):null;
    if(room_id&&!room)return res.status(400).json({error:'Selected room does not exist.'});
    if(status&&!['active','pending','departed'].includes(status))return res.status(400).json({error:'Invalid resident status.'});
    const terms=agreementTerms(req.body.tenancy);
    const id=randomUUID(),reference=`NNH-${id.slice(0,8).toUpperCase()}`;
    const snapshot=agreementSnapshot({...req.body,room_name:room?.name,room_type:room?.type},terms,reference);
    const pdf=await generateTenancyPdf(snapshot);
    const residentId=db.transaction(()=>{
      const info=db.prepare(
        `INSERT INTO residents (first_name,last_name,phone,email,national_id,photo_path,room_id,status,move_in_date,notes) VALUES (?,?,?,?,?,?,?,?,?,?)`
      ).run(first_name.trim(),last_name.trim(),phone||null,email||null,national_id||null,photo_path||null,room_id||null,status||'active',move_in_date||null,notes||null);
      db.prepare('INSERT INTO tenancy_documents(id,resident_id,kind,filename,snapshot,pdf) VALUES(?,?,?,?,?,?)').run(id,info.lastInsertRowid,'generated',`${reference}-tenancy-agreement.pdf`,JSON.stringify(snapshot),pdf);
      return info.lastInsertRowid;
    })();
    res.status(201).json({...db.prepare(residentSelect+' WHERE r.id=?').get(residentId),agreement_id:id});
  } catch(error) {
    if (/must|valid|Invalid|end date/.test(error.message)) return res.status(400).json({error:error.message});
    next(error);
  }
});

router.put('/:id', (req, res) => {
  const resident = db.prepare('SELECT * FROM residents WHERE id = ?').get(req.params.id);
  if (!resident) return res.status(404).json({ error: 'Resident not found' });
  const { first_name, last_name, phone, email, national_id, photo_path, room_id, status, move_in_date, move_out_date, notes } = req.body || {};
  db.prepare(
    `UPDATE residents SET first_name = ?, last_name = ?, phone = ?, email = ?, national_id = ?,
       photo_path = ?, room_id = ?, status = ?, move_in_date = ?, move_out_date = ?, notes = ? WHERE id = ?`
  ).run(first_name ?? resident.first_name, last_name ?? resident.last_name, phone ?? resident.phone,
        email ?? resident.email, national_id ?? resident.national_id, photo_path ?? resident.photo_path,
        room_id ?? resident.room_id, status ?? resident.status, move_in_date ?? resident.move_in_date,
        move_out_date ?? resident.move_out_date, notes ?? resident.notes, resident.id);
  res.json(db.prepare(residentSelect + ' WHERE r.id = ?').get(resident.id));
});

router.delete('/:id', (req, res) => {
  const resident = db.prepare('SELECT * FROM residents WHERE id = ?').get(req.params.id);
  if (!resident) return res.status(404).json({ error: 'Resident not found' });
  db.prepare('DELETE FROM residents WHERE id = ?').run(resident.id);
  res.json({ ok: true });
});

export default router;
