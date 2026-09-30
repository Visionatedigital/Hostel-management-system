import {Router} from 'express';
import {requireRole} from '../auth.js';
import {today} from '../stay-math.js';
import {financeReport,reportCsv} from '../finance-reports.js';
import db from '../db.js';
const router=Router();router.use(requireRole('admin'));
router.get('/',(req,res)=>{
 const month=req.query.month||today().slice(0,7),room=Number(req.query.room)||null;
 if(typeof month!=='string'||!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)||month<'2000-01'||month>'2100-12')return res.status(400).json({error:'Choose a month between 2000 and 2100.'});
 if(req.query.room&&(!Number.isSafeInteger(room)||!db.prepare('SELECT id FROM rooms WHERE id=?').get(room)))return res.status(400).json({error:'Choose an existing room.'});
 const data=financeReport(month,room);
 if(req.query.export){try{const csv=reportCsv(data,req.query.export);res.set('Content-Type','text/csv; charset=utf-8');res.set('Content-Disposition',`attachment; filename="new-nana-${req.query.export}-${month}.csv"`);return res.send(csv);}catch(e){return res.status(400).json({error:e.message});}}
 res.json(data);
});
export default router;
