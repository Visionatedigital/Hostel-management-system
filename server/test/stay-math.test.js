import test from 'node:test';
import assert from 'node:assert/strict';
import {rentSchedule, invoiceSchedule, capacityExceeded, validDate, effectiveStays} from '../src/stay-math.js';
test('three-month semester allocates all shillings exactly, with one upfront bill',()=>{
  const stay={billing_basis:'fixed',amount:1600000,start_date:'2026-09-01',end_date:'2026-11-30'};
  const schedule=rentSchedule(stay);
  assert.equal(schedule.length,3);
  assert.equal(schedule.reduce((n,s)=>n+s.amount,0),1600000);
  assert.ok(schedule.every(s=>Math.abs(s.amount-1600000/3)<1));
  assert.equal(invoiceSchedule(stay).length,1);
  assert.equal(invoiceSchedule(stay)[0].amount,1600000);
});
test('monthly rent bills every touched calendar month in full, including partial months',()=>{
  const stay={billing_basis:'monthly',amount:850000,start_date:'2026-09-15',end_date:'2026-11-15'};
  assert.deepEqual(invoiceSchedule(stay).map(i=>i.amount),[850000,850000,850000]);
  assert.equal(invoiceSchedule(stay)[0].period_start,'2026-09-15');
  assert.equal(invoiceSchedule(stay)[2].period_end,'2026-11-15');
});
test('leap-year fixed-term allocation preserves total and inclusive last night',()=>{
  const schedule=rentSchedule({billing_basis:'fixed',amount:999999,start_date:'2028-02-29',end_date:'2028-03-02'});
  assert.equal(schedule.length,2);
  assert.equal(schedule.reduce((n,s)=>n+s.amount,0),999999);
  assert.equal(schedule[1].end,'2028-03-03');
});
test('capacity checks actual simultaneous occupancy, including the last night',()=>{
  const candidate={room_id:1,start_date:'2026-09-01',end_date:'2026-09-30'};
  const successive=[{room_id:1,start_date:'2026-09-01',end_date:'2026-09-15'},{room_id:1,start_date:'2026-09-16',end_date:'2026-09-30'}];
  assert.equal(capacityExceeded(candidate,successive,2),false);
  assert.equal(capacityExceeded(candidate,[...successive,{room_id:1,start_date:'2026-09-15',end_date:'2026-09-16'}],2),true);
});
test('rejects impossible dates',()=>{assert.equal(validDate('2026-02-30'),false);assert.equal(validDate('2028-02-29'),true);});

test('future renewal keeps an existing unpriced occupant visible until the new stay starts',()=>{
  const resident={id:1,room_id:1,status:'active',move_in_date:'2026-01-01'};
  const stay={id:1,resident_id:1,room_id:1,start_date:'2026-10-01',end_date:'2026-12-31'};
  const effective=effectiveStays([stay],[resident]);
  assert.equal(effective.length,2);
  assert.equal(effective.find(s=>s.unpriced).end_date,'2026-09-30');
  assert.equal(effective.filter(s=>s.start_date<='2027-01-01'&&s.end_date>='2027-01-01').length,0);
});
