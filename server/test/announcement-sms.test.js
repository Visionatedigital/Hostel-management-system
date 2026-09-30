import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import express from 'express';
import {normalizePhone,smsSegments,sendSms,SmsError} from '../src/sms.js';
const config={configured:true,mode:'sandbox',username:'sandbox',apiKey:'test-secret',sender:'TEST'};
test('phone normalization and billing estimates handle duplicates, Uganda and Unicode',()=>{
 assert.equal(normalizePhone('0701 234 567'),'+256701234567');
 assert.equal(normalizePhone('00256701234567'),'+256701234567');
 assert.equal(normalizePhone('abc'),null);assert.equal(normalizePhone('+2567'),null);
 assert.equal(smsSegments('a'.repeat(160)).segments,1);assert.equal(smsSegments('a'.repeat(161)).segments,2);
 assert.equal(smsSegments('^'.repeat(80)).segments,1);assert.equal(smsSegments('^'.repeat(81)).segments,2);
 assert.equal(smsSegments('“'.repeat(70)).segments,1);assert.equal(smsSegments('“'.repeat(71)).segments,2);
 assert.equal(smsSegments('🙂'.repeat(36)).segments,2);
});
test('provider request uses fixed sandbox endpoint and handles per-number acceptance safely',async()=>{
 let calls=0;
 const results=await sendSms({config,message:'Hello',numbers:['+256701234567','+256702345678'],fetchImpl:async(url,options)=>{
  calls++;assert.equal(url,'https://api.sandbox.africastalking.com/version1/messaging');assert.equal(options.headers.apikey,'test-secret');assert.equal(options.redirect,'error');assert.equal(options.body.get('from'),'TEST');assert.equal(options.body.get('to'),'+256701234567,+256702345678');
  return {ok:true,json:async()=>({SMSMessageData:{Recipients:[{number:'+256701234567',statusCode:101,messageId:'ATX_test',cost:'UGX 35.0000'},{number:'+256702345678',statusCode:405,status:'InsufficientBalance'}]}})};
 }});
 assert.equal(calls,1);assert.equal(results[0].status,'accepted');assert.equal(results[0].cost,'UGX 35.0000');assert.equal(results[1].status,'rejected');
 await assert.rejects(sendSms({config,message:'x',numbers:[],fetchImpl:async()=>{throw Error('test-secret');}}),e=>e instanceof SmsError&&e.uncertain&&!e.message.includes('test-secret'));
 await assert.rejects(sendSms({config,message:'x',numbers:[],fetchImpl:async()=>({ok:false,status:401})}),e=>!e.uncertain&&e.message.includes('authentication'));
 assert.equal((await sendSms({config,message:'x',numbers:['+256701234567'],fetchImpl:async()=>({ok:true,json:async()=>({SMSMessageData:{Recipients:[]}})})}))[0].status,'unknown');
});
test('SMS review scopes recipients, freezes numbers, enforces roles and never repeats provider submission',async()=>{
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),'hostel-sms-'));process.env.HOSTEL_DATA_DIR=temp;
 process.env.AFRICASTALKING_ENVIRONMENT='sandbox';process.env.AFRICASTALKING_USERNAME='sandbox';process.env.AFRICASTALKING_API_KEY='test-secret';
 const {default:db}=await import('../src/db.js');const {default:router}=await import('../src/routes/announcements.js');const {requireAuth,signToken}=await import('../src/auth.js');
 const app=express();app.use(express.json());app.use(requireAuth);app.use('/announcements',router);const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
 const nativeFetch=globalThis.fetch;let providerCalls=0;
 globalThis.fetch=async(url,opts)=>{if(String(url).startsWith('https://api.sandbox.africastalking.com')){providerCalls++;return {ok:true,json:async()=>({SMSMessageData:{Recipients:[{number:'+256701234567',statusCode:101,messageId:'ATX_test',cost:'UGX 35.0000'}]}})};}return nativeFetch(url,opts);};
 async function request(url,body,role='admin'){
  const result=await nativeFetch(`http://127.0.0.1:${server.address().port}/announcements${url}`,{method:body?'POST':'GET',headers:{'Content-Type':'application/json',Authorization:`Bearer ${signToken({id:role==='admin'?1:2,role,username:role})}`},body:body?JSON.stringify(body):undefined});return {status:result.status,body:await result.json()};
 }
 try{
  db.prepare("INSERT INTO users(id,username,password_hash,full_name,role,phone) VALUES(1,'admin','test','Admin','admin','+256709876543'),(2,'guard','test','Guard','security',NULL)").run();
  db.prepare("INSERT INTO residents(id,first_name,last_name,status,phone) VALUES(1,'First','Person','active','0701234567'),(2,'Duplicate','Person','active','+256701234567'),(3,'Missing','Person','active',NULL),(4,'Departed','Person','departed','+256702345678')").run();
  const a=(await request('',{title:'Notice',body:'Hello',audience:'residents'})).body;
  assert.equal((await request('/sms/config',undefined,'security')).status,403);
  assert.equal((await request('/sms/preview',{announcement_id:a.id,message:'Hello'},'security')).status,403);
  const p=(await request('/sms/preview',{announcement_id:a.id,message:'Hello'})).body;
  assert.equal(p.recipients.length,1);assert.equal(p.skipped.length,2);assert.equal(p.config_fingerprint,undefined);assert.equal(p.apiKey,undefined);
  db.prepare("UPDATE residents SET phone='+256708765432' WHERE id=1").run();
  assert.equal((await request(`/sms/send/${p.id}`,{})).status,400);
  const sent=(await request(`/sms/send/${p.id}`,{confirm:true})).body;
  assert.equal(sent.status,'accepted');assert.equal(sent.recipients[0].number,'+256701234567');assert.equal(providerCalls,1);
  await request(`/sms/send/${p.id}`,{confirm:true});assert.equal(providerCalls,1);
  assert.equal((await request(`/sms/history/${a.id}`)).body.length,1);
  const testOnly=(await request('/sms/preview',{announcement_id:a.id,message:'Test',test_numbers:['+256703456789']})).body;
  assert.equal(testOnly.test,true);assert.equal(testOnly.recipients.length,1);assert.equal(testOnly.recipients[0].number,'+256703456789');
  assert.equal((await request('/sms/preview',{announcement_id:a.id,message:'Test',test_numbers:['bad']})).status,400);
  process.env.AFRICASTALKING_SENDER_ID='CHANGED';assert.equal((await request(`/sms/send/${testOnly.id}`,{confirm:true})).status,409);delete process.env.AFRICASTALKING_SENDER_ID;
  db.prepare("UPDATE announcement_sms SET created_at='2000-01-01 00:00:00' WHERE id=?").run(testOnly.id);
  assert.equal((await request(`/sms/send/${testOnly.id}`,{confirm:true})).status,409);
  const group=db.prepare("INSERT INTO announcement_audiences(name,created_by) VALUES('Selected',1)").run().lastInsertRowid;
  db.prepare("INSERT INTO announcement_audience_members(audience_id,recipient_key,resident_id) VALUES(?,'r:1',1)").run(group);
  const targeted=(await request('',{title:'Custom',audience:`group:${group}`})).body;
  db.prepare('DELETE FROM announcement_audience_members WHERE audience_id=?').run(group);
  db.prepare("INSERT INTO announcement_audience_members(audience_id,recipient_key,resident_id) VALUES(?,'r:2',2)").run(group);
  const targetReview=(await request('/sms/preview',{announcement_id:targeted.id,message:'Custom'})).body;
  assert.equal(targetReview.recipients[0].number,'+256708765432','original announcement member, not new audience member');
  const uncertain=(await request('/sms/preview',{announcement_id:a.id,message:'Timeout',test_numbers:['+256701234567']})).body;
  globalThis.fetch=async()=>{providerCalls++;throw Error('timeout test-secret');};
  assert.equal((await request(`/sms/send/${uncertain.id}`,{confirm:true})).body.status,'unknown');
  const count=providerCalls;await request(`/sms/send/${uncertain.id}`,{confirm:true});assert.equal(providerCalls,count);
  const history=(await request(`/sms/history/${a.id}`)).body;assert.ok(!JSON.stringify(history).includes('test-secret'));
 }finally{globalThis.fetch=nativeFetch;await new Promise(r=>server.close(r));db.close();fs.rmSync(temp,{recursive:true,force:true});}
});
