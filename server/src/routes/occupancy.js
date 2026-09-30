import { Router } from 'express';
import db from '../db.js';
import { requireRole } from '../auth.js';
import { occupancyData, report } from '../occupancy.js';
import { today, validDate, days, invoiceSchedule, effectiveStays, capacityExceeded } from '../stay-math.js';
const router = Router();
router.use(requireRole('admin'));
router.get('/example', (req,res) => {
  const month=today().slice(0,7), start=`${month}-01`;
  const termEnd=new Date(Date.UTC(Number(month.slice(0,4)),Number(month.slice(5,7))+2,0)).toISOString().slice(0,10);
  const residents=[{id:1,first_name:'John',last_name:'Okello'},{id:2,first_name:'Sarah',last_name:'Nakato'},{id:3,first_name:'LDC',last_name:'Tenant'},{id:4,first_name:'Monthly',last_name:'Tenant'}];
  const rooms=[{id:1,name:'Double 101',capacity:2,status:'available'},{id:2,name:'Double 102',capacity:2,status:'available'},{id:3,name:'Single 201',capacity:1,status:'available'}];
  const stays=residents.map((r,i)=>({id:i+1,resident_id:r.id,room_id:i<2?1:i===2?2:3,first_name:r.first_name,last_name:r.last_name,room_name:i<2?'Double 101':i===2?'Double 102':'Single 201',tenant_type:i<2?'bachelor':i===2?'ldc':'other',billing_basis:i<2?'fixed':'monthly',amount:i<2?1600000:i===2?850000:600000,start_date:i===2?`${month}-15`:start,end_date:termEnd,notes:'Illustrative example only'}));
  let id=0;
  const invoices=stays.flatMap(s=>invoiceSchedule(s).map(i=>({...i,id:++id,stay_id:s.id})));
  const receipts=[{id:1,invoice_id:invoices.find(i=>i.stay_id===1).id,amount:1600000,paid_on:start,method:'bank'}, {id:2,invoice_id:invoices.find(i=>i.stay_id===2).id,amount:400000,paid_on:today(),method:'cash'}, {id:3,invoice_id:invoices.find(i=>i.stay_id===4).id,amount:600000,paid_on:start,method:'bank'}];
  const result=report({stays,residents,rooms,invoices,receipts},month);
  res.json({...result,example:true});
});
router.get('/', (req,res) => {
  const month = req.query.month || today().slice(0,7);
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month) || Number(month.slice(0,4)) < 2000 || Number(month.slice(0,4)) > 2100) return res.status(400).json({error:'Choose a valid month between 2000 and 2100.'});
  res.json(report(occupancyData(),month));
});
function saveStay(req,res) {
  const {tenant_type, billing_basis, start_date, end_date, notes} = req.body;
  const resident_id=Number(req.body.resident_id), room_id=Number(req.body.room_id), amount=Number(req.body.amount);
  if (!Number.isSafeInteger(amount)||amount<=0||amount>1000000000) return res.status(400).json({error:'Enter a whole-shilling rate between 1 and 1 billion UGX.'});
  if (!['bachelor','ldc','other'].includes(tenant_type)||!['fixed','monthly'].includes(billing_basis)) return res.status(400).json({error:'Choose a tenant category and billing basis.'});
  if (!validDate(start_date)||!validDate(end_date)||start_date>end_date||days(start_date,end_date)>3660||start_date<'2000-01-01'||end_date>'2100-12-31') return res.status(400).json({error:'Enter a valid stay period of up to 10 years.'});
  try {
    const stay = db.transaction(() => {
      const editId=req.params.id ? Number(req.params.id) : null;
      if (editId) {
        if (!db.prepare('SELECT id FROM stays WHERE id=?').get(editId)) throw new Error('Stay not found.');
        if (db.prepare('SELECT r.id FROM stay_receipts r JOIN stay_invoices i ON i.id=r.invoice_id WHERE i.stay_id=? LIMIT 1').get(editId)) throw new Error('This agreement already has receipts. Its terms are locked to preserve the ledger; add a new stay for a renewal.');
      }
      const resident=db.prepare('SELECT * FROM residents WHERE id=?').get(resident_id);
      const room=db.prepare('SELECT * FROM rooms WHERE id=?').get(room_id);
      if (!resident||!room) throw new Error('Choose an existing resident and room.');
      if (room.status==='maintenance') throw new Error('This room is under maintenance.');
      const existing=occupancyData();
      existing.stays=existing.stays.filter(s=>s.id!==editId);
      if (existing.stays.some(s=>s.resident_id===resident_id&&s.start_date<=end_date&&s.end_date>=start_date)) throw new Error('This resident already has an agreement covering these dates.');
      const candidate={resident_id,room_id,tenant_type,billing_basis,amount,start_date,end_date};
      const occupied=effectiveStays(existing.stays,existing.residents).filter(s=>!(s.unpriced&&s.resident_id===resident_id));
      if (capacityExceeded(candidate,occupied,room.capacity)) throw new Error('The room would be over capacity during this stay. Check existing stays or add end dates for unpriced tenants first.');
      let id=editId;
      if (editId) {
        db.prepare('UPDATE stays SET resident_id=?,room_id=?,tenant_type=?,billing_basis=?,amount=?,start_date=?,end_date=?,notes=? WHERE id=?').run(resident_id,room_id,tenant_type,billing_basis,amount,start_date,end_date,String(notes||'').slice(0,2000),editId);
        db.prepare('DELETE FROM stay_invoices WHERE stay_id=?').run(editId);
      } else {
        const result=db.prepare('INSERT INTO stays (resident_id,room_id,tenant_type,billing_basis,amount,start_date,end_date,notes) VALUES (?,?,?,?,?,?,?,?)').run(resident_id,room_id,tenant_type,billing_basis,amount,start_date,end_date,String(notes||'').slice(0,2000));
        id=Number(result.lastInsertRowid);
      }
      const insert=db.prepare('INSERT INTO stay_invoices (stay_id,amount,due_date,period_start,period_end) VALUES (?,?,?,?,?)');
      for (const invoice of invoiceSchedule(candidate)) insert.run(id,invoice.amount,invoice.due_date,invoice.period_start,invoice.period_end);
      return {...candidate,id};
    })();
    res.status(req.params.id?200:201).json(stay);
  } catch(e) { res.status(400).json({error:e.message}); }
}
router.post('/stays', saveStay);
router.put('/stays/:id', saveStay);
router.post('/receipts', (req,res) => {
  const invoice_id=Number(req.body.invoice_id), amount=Number(req.body.amount), {paid_on,method,reference}=req.body;
  if (!Number.isSafeInteger(amount)||amount<=0||!validDate(paid_on)||paid_on>today()||paid_on<'2000-01-01'||!['cash','bank','mtn_momo','airtel_money','other'].includes(method)) return res.status(400).json({error:'Enter a positive whole-shilling payment, valid method and payment date no later than today.'});
  try {
    const receipt=db.transaction(()=>{
      const invoice=db.prepare('SELECT * FROM stay_invoices WHERE id=?').get(invoice_id);
      if (!invoice) throw new Error('Invoice not found.');
      const paid=db.prepare('SELECT COALESCE(SUM(amount),0) AS paid FROM stay_receipts WHERE invoice_id=?').get(invoice_id).paid;
      if (amount>invoice.amount-paid) throw new Error('Payment exceeds the remaining invoice balance.');
      const result=db.prepare('INSERT INTO stay_receipts (invoice_id,amount,paid_on,method,reference) VALUES (?,?,?,?,?)').run(invoice_id,amount,paid_on,method,String(reference||'').slice(0,200));
      return {id:Number(result.lastInsertRowid)};
    })();
    res.status(201).json(receipt);
  } catch(e) {res.status(400).json({error:e.message});}
});
export default router;
