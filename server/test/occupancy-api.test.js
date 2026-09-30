import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import express from 'express';
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'hostel-stay-test-'));
process.env.HOSTEL_DATA_DIR=temp;
const {default:db}=await import('../src/db.js');
const {default:routes}=await import('../src/routes/occupancy.js');
const {requireAuth,signToken}=await import('../src/auth.js');
const {today}=await import('../src/stay-math.js');
const app=express();app.use(express.json());app.use('/occupancy',requireAuth,routes);
const server=app.listen(0,'127.0.0.1');
await new Promise(resolve=>server.once('listening',resolve));
const base=`http://127.0.0.1:${server.address().port}/occupancy`;
async function request(path='',body,role='admin',method) {
  const result=await fetch(base+path,{method:method||(body?'POST':'GET'),headers:{'Content-Type':'application/json',Authorization:`Bearer ${signToken({id:1,username:'test',role})}`},body:body?JSON.stringify(body):undefined});
  return {status:result.status,body:await result.json()};
}
test('agreement ledger, capacity, partial receipts, role protection and reports',async()=>{
  try {
    db.prepare("INSERT INTO rooms(id,name,capacity,type) VALUES(1,'Double 101',2,'double')").run();
    for(let i=1;i<=3;i++)db.prepare("INSERT INTO residents(id,first_name,last_name,status) VALUES(?,?,'Test','pending')").run(i,`Resident ${i}`);
    const month=today().slice(0,7),start=`${month}-01`;
    const end=new Date(Date.UTC(Number(month.slice(0,4)),Number(month.slice(5,7))+2,0)).toISOString().slice(0,10);
    const agreement={resident_id:1,room_id:1,tenant_type:'bachelor',billing_basis:'fixed',amount:1600000,start_date:start,end_date:end};
    const first=await request('/stays',agreement);assert.equal(first.status,201);
    assert.equal((await request(`/stays/${first.body.id}`,{...agreement,notes:'Updated agreement'},'admin','PUT')).status,200,'unpaid agreement can be edited');
    assert.equal((await request('/stays',agreement)).status,400,'overlapping resident agreement rejected');
    assert.equal((await request('/stays',{...agreement,resident_id:2,tenant_type:'ldc',billing_basis:'monthly',amount:850000})).status,201);
    assert.equal((await request('/stays',{...agreement,resident_id:3})).status,400,'overbooking rejected');
    const initial=(await request(`?month=${month}`)).body;
    assert.equal(initial.summary.occupied,2);
    assert.equal(initial.summary.beds,2);
    const invoice=initial.stays.find(s=>s.resident_id===1).invoices[0];
    const receipt={invoice_id:invoice.id,amount:400000,paid_on:today(),method:'cash',reference:'TEST-PARTIAL'};
    assert.equal((await request('/receipts',receipt)).status,201);
    assert.equal((await request(`/stays/${first.body.id}`,agreement,'admin','PUT')).status,400,'receipt ledger locks agreed terms');
    const partial=(await request(`?month=${month}`)).body;
    assert.equal(partial.stays.find(s=>s.resident_id===1).due,1200000);
    assert.equal(partial.summary.cash_this_month,400000);
    assert.equal(partial.summary.expected_rent,initial.summary.expected_rent,'cash does not alter rent allocation');
    assert.equal((await request('/receipts',{...receipt,amount:1200001})).status,400,'overpayment rejected');
    assert.equal((await request('/receipts',{...receipt,amount:-1})).status,400);
    assert.equal((await request('',undefined,'resident')).status,403);
    assert.equal((await request('',undefined,'security')).status,403);
    assert.equal((await request('?month=bad')).status,400);
    const after=await request('?month=2099-01');assert.equal(after.body.summary.occupied,0,'expired agreement does not occupy bed');
    const count=db.prepare('SELECT COUNT(*) AS n FROM stays').get().n;
    const demo=await request('/example');assert.equal(demo.status,200);assert.equal(demo.body.example,true);assert.equal(db.prepare('SELECT COUNT(*) AS n FROM stays').get().n,count,'preview does not mutate live ledger');
    console.log('Validated separate rent allocation, invoice balances and cash; demo preview leaves live records intact.');
  } finally {await new Promise(resolve=>server.close(resolve));db.close();fs.rmSync(temp,{recursive:true,force:true});}
});
