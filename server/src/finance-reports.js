import {occupancyData,report} from './occupancy.js';
import {today,days,monthEndExclusive} from './stay-math.js';
import {getSettings} from './settings.js';
export function financeReport(month,roomId=null){
 const source=occupancyData(),base=report(source,month),start=`${month}-01`,end=monthEndExclusive(month);
 const stays=base.stays.filter(s=>!roomId||s.room_id===roomId);
 const rooms=base.rooms.filter(r=>!roomId||r.id===roomId);
 const invoiceRows=stays.flatMap(s=>s.invoices.map(i=>({...i,resident_name:`${s.first_name} ${s.last_name}`,room_name:s.room_name,room_id:s.room_id,tenant_type:s.tenant_type})));
 const invoiceMap=new Map(invoiceRows.map(i=>[i.id,i]));
 const receipts=source.receipts.filter(r=>invoiceMap.has(r.invoice_id)&&r.paid_on>=start&&r.paid_on<end&&r.paid_on<=today()).map(r=>({...r,...Object.fromEntries(['resident_name','room_name','tenant_type'].map(k=>[k,invoiceMap.get(r.invoice_id)[k]]))}));
 const outstanding=invoiceRows.filter(i=>i.balance>0&&i.due_date<=base.as_of).map(i=>({...i,days_overdue:days(i.due_date,base.as_of)})).sort((a,b)=>b.days_overdue-a.days_overdue);
 const sum=(rows,key)=>rows.reduce((n,r)=>n+r[key],0);
 const aging=[['Due today',0,0],['1–30 days',1,30],['31–60 days',31,60],['61–90 days',61,90],['Over 90 days',91,Infinity]].map(([label,min,max])=>({label,amount:sum(outstanding.filter(i=>i.days_overdue>=min&&i.days_overdue<=max),'balance')}));
 const groups=['bachelor','ldc','other'].map(type=>({type,rent:sum(stays.filter(s=>s.tenant_type===type),'monthly_rent'),cash:sum(receipts.filter(r=>r.tenant_type===type),'amount'),due:sum(outstanding.filter(i=>i.tenant_type===type),'balance')}));
 const methods=[...new Set(receipts.map(r=>r.method))].map(method=>({method,amount:sum(receipts.filter(r=>r.method===method),'amount'),count:receipts.filter(r=>r.method===method).length}));
 const trend=Array.from({length:6},(_,i)=>{const [y,m]=month.split('-').map(Number);const key=new Date(Date.UTC(y,m-1-(5-i),1)).toISOString().slice(0,7);const r=report(source,key);const selected=r.stays.filter(s=>!roomId||s.room_id===roomId);const ids=new Set(selected.flatMap(s=>s.invoices.map(i=>i.id)));return {month:key,rent:sum(selected,'monthly_rent'),cash:sum(source.receipts.filter(v=>ids.has(v.invoice_id)&&v.paid_on>=`${key}-01`&&v.paid_on<monthEndExclusive(key)&&v.paid_on<=today()),'amount')};});
 const available=rooms.filter(r=>r.status!=='maintenance');
 const capacity=available.reduce((n,r)=>n+r.capacity*days(start,end),0);
 return {month,as_of:base.as_of,forecast:base.as_of>today(),hostel:getSettings(),room_id:roomId,room_options:source.rooms.map(r=>({id:r.id,name:r.name})),summary:{allocated_rent:sum(stays,'monthly_rent'),invoiced:sum(invoiceRows.filter(i=>i.due_date>=start&&i.due_date<end),'amount'),cash_received:sum(receipts,'amount'),due_balance:sum(outstanding,'balance'),unpriced:base.unpriced.filter(r=>!roomId||r.room_id===roomId).length,occupancy_percent:capacity?Math.round(100*sum(available,'bed_days')/capacity):0},aging,groups,methods,trend,rooms,receipts,outstanding,allocations:stays.filter(s=>s.monthly_rent>0)};
}
export function reportCsv(data,kind){
 const sets={receipts:{head:['Receipt ID','Resident','Room','Date received','Method','Reference','Amount UGX'],rows:data.receipts.map(r=>[r.id,r.resident_name,r.room_name,r.paid_on,r.method,r.reference,r.amount])},balances:{head:['Invoice ID','Resident','Room','Due date','Coverage start','Coverage end','Billed UGX','Paid as of report UGX','Balance UGX','Days overdue'],rows:data.outstanding.map(i=>[i.id,i.resident_name,i.room_name,i.due_date,i.period_start,i.period_end,i.amount,i.paid,i.balance,i.days_overdue])},rent:{head:['Stay ID','Resident','Room','Category','First day','Last day','Allocated rent UGX'],rows:data.allocations.map(s=>[s.id,`${s.first_name} ${s.last_name}`,s.room_name,s.tenant_type,s.start_date,s.end_date,s.monthly_rent])},rooms:{head:['Room','Capacity beds','Status','Occupied beds as of report','Booked bed days','Monthly occupancy percent','Allocated rent UGX'],rows:data.rooms.map(r=>[r.name,r.capacity,r.status,r.occupied,r.bed_days,r.occupancy_percent,r.monthly_rent])}};
 const table=sets[kind];if(!table)throw Error('Choose rent, receipts, balances or rooms.');
 const cell=value=>{let v=String(value??'');if(typeof value==='string'&&/^[\s]*[=+@-]/.test(v))v="'"+v;return '"'+v.replaceAll('"','""')+'"';};
 return '\uFEFF'+[[data.hostel.hostel_name,kind,'Month',data.month,'As of',data.as_of],table.head,...table.rows].map(row=>row.map(cell).join(',')).join('\r\n');
}
