import {Router} from 'express';
import {requireRole} from '../auth.js';
import {rewriteAnnouncement,rewriteTones,RewriteError} from '../announcement-ai.js';

export function announcementRewriteRouter({rewrite=rewriteAnnouncement,now=Date.now}={}) {
 const router=Router(),requests=new Map(),windowMs=5*60000;
 router.post('/rewrite',requireRole('admin'),async(req,res)=>{
  const {body,title='',audience='all',audience_name='',tone='professional'}=req.body||{};
  if(typeof body!=='string'||!body.trim()||body.length>6000)return res.status(400).json({error:'Enter an announcement body of 1 to 6,000 characters.'});
  if(typeof title!=='string'||title.length>200||(!['all','residents','staff'].includes(audience)&&(typeof audience!=='string'||!/^group:[1-9]\d*$/.test(audience)))||typeof audience_name!=='string'||audience_name.length>80||!Object.hasOwn(rewriteTones,tone))return res.status(400).json({error:'Invalid title, audience or rewrite style.'});
  const time=now();
  for(const [id,bucket] of requests)if(time>=bucket.resetAt)requests.delete(id);
  const bucket=requests.get(req.user.id)||{count:0,resetAt:time+windowMs};
  if(bucket.count>=20){res.set('Retry-After',String(Math.ceil((bucket.resetAt-time)/1000)));return res.status(429).json({error:'You have used 20 rewrites in five minutes. Please wait a moment before trying again.'});}
  bucket.count++;requests.set(req.user.id,bucket);
  const controller=new AbortController();
  const cancel=()=>{if(!res.writableEnded)controller.abort();};res.on('close',cancel);
  try{
   const rewritten=await rewrite({body:body.trim(),title:title.trim(),audience,audience_name,tone},{signal:controller.signal});
   if(!controller.signal.aborted)res.json(rewritten);
  }catch(error){
   if(!controller.signal.aborted)res.status(error instanceof RewriteError?error.status:502).json({error:error instanceof RewriteError?error.message:'AI rewriting is temporarily unavailable. Your original text is safe.'});
  }finally{res.off('close',cancel);}
 });
 return router;
}
export default announcementRewriteRouter();
