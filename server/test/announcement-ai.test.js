import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import {rewriteAnnouncement,RewriteError} from '../src/announcement-ai.js';
import {announcementRewriteRouter} from '../src/routes/announcement-rewrite.js';
import {requireAuth,signToken} from '../src/auth.js';
const completed=body=>({ok:true,json:async()=>({status:'completed',output:[{type:'message',content:[{type:'output_text',text:body}]}]})});
test('OpenAI rewrite sends bounded plain-text editing request and rejects unusable results',async()=>{
 let payload,endpoint;
 const result=await rewriteAnnouncement({body:'Repairs on 30 September, 10am to 12pm.',title:'Water',audience:'residents',tone:'professional'},{apiKey:'unit-test-key',model:'test-model',fetchImpl:async(url,options)=>{endpoint=url;payload=JSON.parse(options.body);return completed('Repairs on 30 September, 10am to 12pm.');}});
 assert.equal(endpoint,'https://api.openai.com/v1/responses');
 assert.equal(payload.store,false);assert.equal(payload.model,'test-model');
 assert.equal(JSON.parse(payload.input).body,'Repairs on 30 September, 10am to 12pm.');
 assert.match(payload.instructions,/Do not invent/);
 assert.match(payload.instructions,/complete, expanded formal management notice/);
 assert.match(payload.instructions,/We apologise for any inconvenience caused/);
 assert.equal(result.body,'Repairs on 30 September, 10am to 12pm.');
 await assert.rejects(rewriteAnnouncement({body:'Test'},{apiKey:''}),e=>e instanceof RewriteError&&e.status===503);
 await assert.rejects(rewriteAnnouncement({body:'Test'},{apiKey:'test',fetchImpl:async()=>({ok:false,status:401,json:async()=>({error:{message:'secret provider details'}})})}),e=>e.status===503&&!e.message.includes('secret'));
 await assert.rejects(rewriteAnnouncement({body:'Test'},{apiKey:'test',fetchImpl:async()=>({ok:false,status:429,json:async()=>({error:{code:'insufficient_quota'}})})}),e=>e.status===429&&e.message.includes('credits'));
 await assert.rejects(rewriteAnnouncement({body:'Test'},{apiKey:'test',fetchImpl:async()=>completed('  ')}),/unusable/);
 await assert.rejects(rewriteAnnouncement({body:'Test'},{apiKey:'test',fetchImpl:async()=>({ok:true,json:async()=>({status:'incomplete',output:[]})})}),/did not finish/);
 await assert.rejects(rewriteAnnouncement({body:'Test'},{apiKey:'test',fetchImpl:async()=>{const e=new Error();e.name='TimeoutError';throw e;}}),e=>e.status===504);
});
test('rewrite endpoint requires admin, validates input and limits provider calls',async()=>{
 let calls=0,time=1000;
 const app=express();app.use(express.json());app.use('/announcements',requireAuth,announcementRewriteRouter({now:()=>time,rewrite:async(input)=>{calls++;return {body:'Polished: '+input.body};}}));
 const server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));
 async function request(body,role='admin'){
  const res=await fetch(`http://127.0.0.1:${server.address().port}/announcements/rewrite`,{method:'POST',headers:{'Content-Type':'application/json',...(role?{Authorization:`Bearer ${signToken({id:1,username:'test',role})}`}:{})},body:JSON.stringify(body)});
  return {status:res.status,body:await res.json()};
 }
 try{
  assert.equal((await request({body:'Hello'},null)).status,401);
  assert.equal((await request({body:'Hello'},'resident')).status,403);
  assert.equal((await request({body:'Hello'},'security')).status,403);
  for(const body of [{body:''},{body:' '.repeat(20)},{body:'a'.repeat(6001)},{body:'Text',tone:'invalid'},{body:'Text',audience:'invalid'},{body:'Text',title:'a'.repeat(201)}])assert.equal((await request(body)).status,400);
  assert.equal(calls,0,'invalid requests never reach provider');
  const first=await request({body:' Draft ',tone:'concise',audience:'staff'});assert.equal(first.status,200);assert.equal(first.body.body,'Polished: Draft');
  for(let i=1;i<20;i++)assert.equal((await request({body:'Draft'})).status,200);
  assert.equal((await request({body:'Draft'})).status,429);assert.equal(calls,20);
  time+=5*60000;assert.equal((await request({body:'Draft'})).status,200);
 }finally{await new Promise(resolve=>server.close(resolve));}
});
