import db from './db.js';
import { today, days, nextDay, monthEndExclusive, rentSchedule, effectiveStays } from './stay-math.js';
export function occupancyData() {
  const stays = db.prepare(`SELECT s.*, r.first_name, r.last_name, rm.name AS room_name FROM stays s JOIN residents r ON r.id=s.resident_id JOIN rooms rm ON rm.id=s.room_id ORDER BY s.start_date DESC`).all();
  return {stays, residents: db.prepare('SELECT * FROM residents').all(), rooms: db.prepare('SELECT * FROM rooms').all(), invoices: db.prepare('SELECT * FROM stay_invoices').all(), receipts: db.prepare('SELECT * FROM stay_receipts ORDER BY paid_on DESC, id DESC').all()};
}
export function currentOccupants(roomId) {
  const data = occupancyData();
  const date = today();
  return effectiveStays(data.stays, data.residents).filter(s => s.room_id === Number(roomId) && s.start_date <= date && s.end_date >= date).map(s => ({...data.residents.find(r => r.id === s.resident_id), tenant_type: s.tenant_type, stay_start: s.start_date, stay_end: s.end_date, unpriced: !!s.unpriced}));
}
export function report(data, month, date = today()) {
  const start = `${month}-01`, end = monthEndExclusive(month);
  const asOf = date >= start && date < end ? date : (date < start ? start : new Date(Date.parse(end)-86400000).toISOString().slice(0,10));
  const availableRooms = data.rooms.filter(r => r.status !== 'maintenance');
  const beds = availableRooms.reduce((n,r) => n + r.capacity, 0);
  const effective = effectiveStays(data.stays, data.residents);
  const current = effective.filter(s => s.start_date <= asOf && s.end_date >= asOf);
  const asOfReceipts = data.receipts.filter(r => r.paid_on <= asOf);
  const invoiceRows = data.invoices.map(i => { const paid = asOfReceipts.filter(r => r.invoice_id === i.id).reduce((n,r) => n+r.amount,0); return {...i, paid, balance: i.amount-paid}; });
  const rows = data.stays.map(s => {
    const rent = rentSchedule(s).find(slice => slice.month === month)?.amount || 0;
    const invoices = invoiceRows.filter(i => i.stay_id === s.id);
    return {...s, monthly_rent: rent, total_rent: rentSchedule(s).reduce((n,v)=>n+v.amount,0), paid: invoices.reduce((n,i)=>n+i.paid,0), balance: invoices.reduce((n,i)=>n+i.balance,0), due: invoices.filter(i=>i.due_date<=asOf).reduce((n,i)=>n+i.balance,0), invoices, receipts: data.receipts.filter(r => invoices.some(i=>i.id===r.invoice_id)), state: asOf < s.start_date ? 'Upcoming' : asOf > s.end_date ? 'Ended' : 'Staying'};
  });
  const roomRows = data.rooms.map(r => {
    const roomStays = effective.filter(s=>s.room_id===r.id);
    const bedDays = roomStays.reduce((n,s)=>{const a=s.start_date>start?s.start_date:start; const b=s.end_date>=end?end:nextDay(s.end_date);return n+(a<b?days(a,b):0);},0);
    return {...r, occupied: current.filter(s=>s.room_id===r.id).length, monthly_rent: rows.filter(s=>s.room_id===r.id).reduce((n,s)=>n+s.monthly_rent,0), bed_days:bedDays, occupancy_percent: Math.round(100*bedDays/(r.capacity*days(start,end))), tenants: current.filter(s=>s.room_id===r.id).map(s=>{const resident=data.residents.find(r=>r.id===s.resident_id);return {name:`${resident.first_name} ${resident.last_name}`, end_date:s.unpriced?resident.move_out_date:s.end_date, unpriced:!!s.unpriced};})};
  });
  const unpriced = current.filter(s=>s.unpriced).map(s=>data.residents.find(r=>r.id===s.resident_id));
  return {month, as_of:asOf, summary:{beds, occupied:current.length, rooms_occupied:roomRows.filter(r=>r.occupied>0).length, rooms_total:data.rooms.length, expected_rent:rows.reduce((n,s)=>n+s.monthly_rent,0), billed_this_month:invoiceRows.filter(i=>i.due_date>=start&&i.due_date<end).reduce((n,i)=>n+i.amount,0), cash_this_month:data.receipts.filter(r=>r.paid_on>=start&&r.paid_on<end&&r.paid_on<=date).reduce((n,r)=>n+r.amount,0), due_balance:invoiceRows.filter(i=>i.due_date<=asOf).reduce((n,i)=>n+i.balance,0), ending_soon:rows.filter(s=>s.end_date>=asOf&&days(asOf,s.end_date)<=30).length, unpriced:unpriced.length}, stays:rows, rooms:roomRows, unpriced};
}
