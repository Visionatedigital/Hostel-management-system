import db from './db.js';
import { occupancyData, currentOccupants, report } from './occupancy.js';
import { effectiveStays, today } from './stay-math.js';

export function roomHistory(id) {
  const room=db.prepare('SELECT * FROM rooms WHERE id=?').get(id);
  if (!room) return null;
  const data=occupancyData();
  const month=today().slice(0,7);
  const finances=report(data,month);
  const stays=finances.stays.filter(s=>s.room_id===room.id);
  const legacy_assignments=effectiveStays(data.stays,data.residents).filter(s=>s.room_id===room.id&&s.unpriced).map(s=>{
    const resident=data.residents.find(r=>r.id===s.resident_id);
    return {...resident,history_start:resident.move_in_date||null,history_end:s.end_date==='9999-12-31'?null:s.end_date,source:'legacy'};
  });
  const repairs=db.prepare(`SELECT m.*, r.first_name AS resident_first,r.last_name AS resident_last FROM maintenance_requests m LEFT JOIN residents r ON r.id=m.resident_id WHERE m.room_id=? ORDER BY m.created_at DESC,m.id DESC`).all(room.id);
  const visits=db.prepare(`SELECT v.*,r.first_name AS resident_first,r.last_name AS resident_last FROM visitors v LEFT JOIN residents r ON r.id=v.resident_id WHERE v.room_id=? ORDER BY COALESCE(v.check_in_time,v.expected_arrival,v.created_at) DESC,v.id DESC`).all(room.id);
  const inspections=db.prepare(`SELECT i.*,r.first_name AS resident_first,r.last_name AS resident_last FROM inspections i LEFT JOIN residents r ON r.id=i.resident_id WHERE i.room_id=? ORDER BY i.inspection_date DESC,i.id DESC`).all(room.id);
  const legacy_payments=db.prepare(`SELECT p.*,r.first_name AS resident_first,r.last_name AS resident_last FROM payments p LEFT JOIN residents r ON r.id=p.resident_id WHERE p.room_id=? ORDER BY p.created_at DESC,p.id DESC`).all(room.id);
  const receipts=stays.flatMap(s=>s.receipts.map(r=>({...r,resident_name:`${s.first_name} ${s.last_name}`,stay_id:s.id})));
  const events=[
    ...stays.flatMap(s=>[{id:`stay-${s.id}`,date:s.created_at||s.start_date,type:'Stay agreement',title:`${s.first_name} ${s.last_name}`,detail:`${s.start_date} to ${s.end_date}`},...(s.end_date<today()?[{id:`end-${s.id}`,date:s.end_date,type:'Stay ended',title:`${s.first_name} ${s.last_name}`,detail:'Scheduled stay period ended'}]:[])]),
    ...repairs.map(r=>({id:`repair-${r.id}`,date:r.created_at,type:'Repair reported',title:r.description,detail:`${r.category||'General'} · ${r.status.replaceAll('_',' ')}`})),
    ...visits.map(v=>({id:`visit-${v.id}`,date:v.check_in_time||v.expected_arrival||v.created_at,type:'Visitor',title:v.guest_name,detail:`${v.resident_first||'Unknown host'} ${v.resident_last||''} · ${v.status.replaceAll('_',' ')}`})),
    ...inspections.map(i=>({id:`inspection-${i.id}`,date:i.inspection_date||i.created_at,type:'Inspection',title:i.condition_notes||'Room inspection',detail:`Deposit ${i.deposit_status}`})),
    ...receipts.map(r=>({id:`receipt-${r.id}`,date:r.paid_on,type:'Rent receipt',title:r.resident_name,detail:`UGX ${r.amount.toLocaleString('en-UG')} · ${r.method.replaceAll('_',' ')}`}))
  ].sort((a,b)=>b.date.localeCompare(a.date));
  return {...room,month,occupants:currentOccupants(room.id),stays,legacy_assignments,repairs,visits,inspections,legacy_payments,receipts,events,summary:{monthly_rent:stays.reduce((n,s)=>n+s.monthly_rent,0),due_balance:stays.reduce((n,s)=>n+s.due,0),cash_this_month:receipts.filter(r=>r.paid_on.slice(0,7)===month).reduce((n,r)=>n+r.amount,0),open_repairs:repairs.filter(r=>r.status!=='resolved').length,visitors_on_site:visits.filter(v=>['checked_in','overdue'].includes(v.status)).length}};
}
