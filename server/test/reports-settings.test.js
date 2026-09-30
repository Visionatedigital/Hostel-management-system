import test from 'node:test';import assert from 'node:assert/strict';
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import express from 'express';
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'hostel-reports-'));process.env.HOSTEL_DATA_DIR=temp;
const {default:db}=await import('../src/db.js');const {default:reports}=await import('../src/routes/reports.js');const {default:settings}=await import('../src/routes/settings.js');const {requireAuth,signToken}=await import('../src/auth.js');
const app=express();app.use(express.json());app.use(requireAuth);app.use('/reports',reports);app.use('/settings',settings);const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
async function request(url,body,role='admin',method){const r=await fetch(`http://127.0.0.1:${server.address().port}${url}`,{method:method||(body?'PUT':'GET'),headers:{'Content-Type':'application/json',Authorization:`Bearer ${signToken({id:1,role,username:'admin'})}`},body:body?JSON.stringify(body):undefined});return {status:r.status,body:r.headers.get('content-type').includes('application/json')?await r.json():await r.text()};}
test('reports reconcile allocation, invoices, receipts and dated balances; settings persist without rewriting financial records',async()=>{
 try{
  db.prepare("INSERT INTO users(id,username,password_hash,full_name,role) VALUES(1,'admin','test','Admin','admin')").run();
  db.prepare("INSERT INTO rooms(id,name,capacity,status) VALUES(1,'101',2,'available'),(2,'102',2,'available')").run();
  db.prepare("INSERT INTO residents(id,first_name,last_name,room_id,status,move_in_date) VALUES(1,'First','Tenant',1,'active','2020-09-01'),(2,'=DANGEROUS','Tenant',2,'active','2020-08-01')").run();
  db.prepare("INSERT INTO stays(id,resident_id,room_id,tenant_type,billing_basis,amount,start_date,end_date) VALUES(1,1,1,'ldc','monthly',100000,'2020-09-01','2020-09-30'),(2,2,2,'bachelor','fixed',600000,'2020-08-01','2020-10-31')").run();
  db.prepare("INSERT INTO stay_invoices(id,stay_id,amount,due_date,period_start,period_end) VALUES(1,1,100000,'2020-09-01','2020-09-01','2020-09-30'),(2,2,600000,'2020-08-01','2020-08-01','2020-10-31')").run();
  db.prepare("INSERT INTO stay_receipts(invoice_id,amount,paid_on,method,reference) VALUES(1,40000,'2020-09-05','cash','REF'),(2,600000,'2020-10-05','bank','Advance')").run();
  assert.equal((await request('/reports?month=2020-09',undefined,'security')).status,403);
  assert.equal((await request('/settings',undefined,'resident')).status,403);
  const r=(await request('/reports?month=2020-09')).body;
  assert.equal(r.summary.allocated_rent,300000);assert.equal(r.summary.invoiced,100000);assert.equal(r.summary.cash_received,40000);assert.equal(r.summary.due_balance,660000);
  assert.equal(r.summary.occupancy_percent,50);assert.equal(r.receipts.length,1);assert.equal(r.outstanding.length,2);assert.equal(r.aging.reduce((n,b)=>n+b.amount,0),660000);
  assert.equal(r.groups.find(g=>g.type==='ldc').cash,40000);assert.equal(r.methods[0].amount,40000);
  const later=(await request('/reports?month=2020-10')).body;assert.equal(later.summary.cash_received,600000);assert.equal(later.summary.due_balance,60000,'later receipt clears the semester invoice only in later reports');
  const single=(await request('/reports?month=2020-09&room=1')).body;assert.equal(single.summary.allocated_rent,100000);assert.equal(single.summary.due_balance,60000);assert.equal(single.rooms.length,1);
  assert.equal((await request('/reports?month=invalid')).status,400);assert.equal((await request('/reports?room=999')).status,400);
  const csv=(await request('/reports?month=2020-09&export=rent')).body;assert.ok(csv.includes("\"'=DANGEROUS Tenant\""),'CSV neutralizes formula injection');assert.ok(csv.includes('Allocated rent UGX'));
  assert.equal((await request('/reports?export=invalid')).status,400);
  const initial=(await request('/settings')).body;assert.equal(initial.default_billing_basis,'fixed');assert.equal(initial.default_payment_method,'cash');
  const count=db.prepare('SELECT COUNT(*) AS n FROM stay_invoices').get().n;
  const saved=await request('/settings',{hostel_name:'Test Hostel',default_tenant_type:'ldc',default_billing_basis:'monthly',default_payment_method:'bank',email:'office@example.com'});assert.equal(saved.status,200);assert.equal((await request('/settings')).body.default_payment_method,'bank');assert.equal(db.prepare('SELECT COUNT(*) AS n FROM stay_invoices').get().n,count);assert.equal(db.prepare('SELECT amount FROM stays WHERE id=1').get().amount,100000);
  assert.equal((await request('/reports?month=2020-09')).body.hostel.hostel_name,'Test Hostel');
  assert.equal((await request('/settings',{default_billing_basis:'daily'})).status,400);assert.equal((await request('/settings',{email:'bad'})).status,400);assert.equal((await request('/settings',{api_key:'must-not-save'})).status,400);
  const profile=await request('/settings/profile',{full_name:'Updated Admin',phone:'+256701234567',role:'resident'});assert.equal(profile.body.full_name,'Updated Admin');assert.equal(profile.body.role,'admin','profile cannot change role');assert.equal(profile.body.password_hash,undefined);
  const integration=await request('/settings/integrations');assert.ok(!JSON.stringify(integration.body).includes('apiKey'));assert.equal(integration.body.sms.mode,'sandbox');
 }finally{await new Promise(r=>server.close(r));db.close();fs.rmSync(temp,{recursive:true,force:true});}
});
