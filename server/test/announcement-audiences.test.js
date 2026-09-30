import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';import path from 'node:path';import fs from 'node:fs';import express from 'express';
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'hostel-audience-test-'));
process.env.HOSTEL_DATA_DIR=temp;
const {default:db}=await import('../src/db.js');
const {default:audiences}=await import('../src/routes/audiences.js');
const {default:announcements}=await import('../src/routes/announcements.js');
const {requireAuth,signToken}=await import('../src/auth.js');
const app=express();app.use(express.json());app.use(requireAuth);app.use('/audiences',audiences);app.use('/announcements',announcements);
const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
const users={admin:{id:1,role:'admin'},guard:{id:2,role:'security'},john:{id:3,role:'resident',resident_id:1},sarah:{id:4,role:'resident',resident_id:2}};
async function request(url,body,who='admin',method){
 const result=await fetch(`http://127.0.0.1:${server.address().port}`+url,{method:method||(body?'POST':'GET'),headers:{'Content-Type':'application/json',Authorization:`Bearer ${signToken({...users[who],username:who})}`},body:body?JSON.stringify(body):undefined});
 return {status:result.status,body:await result.json()};
}
test('custom audience delivery is scoped and posted recipients survive group edits',async()=>{
 try{
  db.prepare("INSERT INTO residents(id,first_name,last_name,status) VALUES(1,'John','Test','active'),(2,'Sarah','Test','active')").run();
  const insert=db.prepare('INSERT INTO users(id,username,password_hash,full_name,role,resident_id) VALUES(?,?,?,?,?,?)');
  for(const [name,u] of Object.entries(users))insert.run(u.id,name,'test',name,u.role,u.resident_id||null);
  assert.equal((await request('/audiences',undefined,'john')).status,403);
  assert.equal((await request('/audiences/recipients',undefined,'guard')).status,403);
  assert.equal((await request('/audiences',{name:'Empty'})).status,400);
  assert.equal((await request('/audiences',{name:'Invalid',resident_ids:[999]})).status,400);
  const group=(await request('/audiences',{name:'LDC residents',description:'Selected residents and gate staff',resident_ids:[1,1],user_ids:[2]}));
  assert.equal(group.status,201);assert.equal(group.body.members.length,2);
  const id=group.body.id;
  assert.equal((await request('/audiences',{name:'ldc residents',resident_ids:[2]})).status,409);
  const post=await request('/announcements',{title:'LDC notice',body:'Targeted message',audience:`group:${id}`});
  assert.equal(post.status,201);assert.equal(post.body.recipient_count,2);assert.equal(post.body.audience_label,'LDC residents');
  const titles=async who=>(await request('/announcements',undefined,who)).body.map(a=>a.title);
  assert.deepEqual(await titles('john'),['LDC notice']);
  assert.deepEqual(await titles('sarah'),[]);
  assert.deepEqual(await titles('guard'),['LDC notice']);
  assert.equal((await request('/announcements',{title:'Unauthorised'},'guard')).status,403);
  assert.equal((await request(`/audiences/${id}`,{name:'Renamed audience',resident_ids:[2]},'admin','PUT')).status,200);
  assert.deepEqual(await titles('john'),['LDC notice'],'original recipient retains access');
  assert.deepEqual(await titles('sarah'),[],'new members cannot read prior targeted notices');
  assert.equal((await request('/announcements',undefined,'admin')).body[0].audience_label,'LDC residents','posted audience label is preserved');
  assert.equal((await request('/announcements',{title:'New notice',audience:`group:${id}`})).status,201);
  assert.deepEqual(await titles('sarah'),['New notice']);
  await request('/announcements',{title:'Residents notice',audience:'residents'});
  await request('/announcements',{title:'Staff notice',audience:'staff'});
  await request('/announcements',{title:'Everyone notice',audience:'all'});
  assert.ok((await titles('john')).includes('Residents notice'));
  assert.ok(!(await titles('john')).includes('Staff notice'));
  assert.ok((await titles('guard')).includes('Staff notice'));
  assert.ok(!(await titles('guard')).includes('Residents notice'));
  assert.ok((await titles('sarah')).includes('Everyone notice'));
  await request(`/audiences/${id}`,{archived:true},'admin','PUT');
  assert.equal((await request('/announcements',{title:'Archived',audience:`group:${id}`})).status,400);
  assert.ok((await titles('john')).includes('LDC notice'),'archive preserves posted announcements');
  await request(`/audiences/${id}`,{archived:false},'admin','PUT');
  assert.equal((await request('/announcements',{title:'Restored',audience:`group:${id}`})).status,201);
  const roster=await request('/audiences/recipients');assert.equal(roster.body.residents.length,2);assert.equal(roster.body.staff.length,2);
 }finally{await new Promise(r=>server.close(r));db.close();fs.rmSync(temp,{recursive:true,force:true});}
});
