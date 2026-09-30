import React,{useEffect,useState} from 'react';
import {api} from '../api.js';
import {Modal,fmtDateTime,useToast} from './ui.jsx';

export default function AnnouncementSms({announcement,onClose}){
 const toast=useToast();
 const [config,setConfig]=useState(null),[history,setHistory]=useState([]),[message,setMessage]=useState(`${announcement.title}\n\n${announcement.body||''}\n\nNew Nana Hostel`),[test,setTest]=useState(true),[numbers,setNumbers]=useState(''),[review,setReview]=useState(null),[busy,setBusy]=useState(false),[error,setError]=useState('');
 function loadHistory(){api.get(`/announcements/sms/history/${announcement.id}`).then(setHistory).catch(e=>setError(e.message));}
 useEffect(()=>{api.get('/announcements/sms/config').then(setConfig).catch(e=>setError(e.message));loadHistory();},[]);
 async function prepare(e){e.preventDefault();setBusy(true);setError('');try{setReview(await api.post('/announcements/sms/preview',{announcement_id:announcement.id,message,...(test?{test_numbers:numbers.split(/[\s,;]+/).filter(Boolean)}:{})}));}catch(e){setError(e.message);}finally{setBusy(false);}}
 async function send(){if(busy)return;setBusy(true);setError('');try{const result=await api.post(`/announcements/sms/send/${review.id}`,{confirm:true});setReview(result);loadHistory();toast(result.status==='accepted'?'SMS accepted by provider':`SMS result: ${result.status}`,result.status==='accepted'?'success':'error');}catch(e){setError(e.message);}finally{setBusy(false);}}
 const used=review&&review.status!=='draft';
 return <Modal title="Send announcement by SMS" onClose={busy?()=>{}:onClose}>
  <div className="sms-provider"><strong>Africa’s Talking</strong><span>{config?.mode==='live'?'Live · billable SMS':'Sandbox · simulator only'}</span></div>
  {config&&!config.configured&&<p className="sms-notice">Provider credentials are not configured yet. You can prepare and review a message; sending becomes available after server setup.</p>}
  <p className="form-help">Announcement: {announcement.title} · {announcement.audience_label||announcement.audience}</p>
  {!review?<form onSubmit={prepare}>
   <div className="field"><label htmlFor="sms-message">SMS text</label><textarea id="sms-message" className="textarea announcement-body" value={message} maxLength="1600" onChange={e=>setMessage(e.target.value)} required disabled={busy}/><span className="form-help">{message.length} / 1,600 characters. Shorten long AI notices to reduce SMS charges.</span></div>
   <div className="field"><label htmlFor="sms-target">Recipients</label><select id="sms-target" className="select" value={test?'test':'audience'} onChange={e=>setTest(e.target.value==='test')} disabled={busy}><option value="test">Test numbers only</option><option value="audience">Announcement audience</option></select></div>
   {test?<div className="field"><label htmlFor="sms-numbers">Test phone numbers</label><textarea id="sms-numbers" className="textarea" rows="2" value={numbers} onChange={e=>setNumbers(e.target.value)} placeholder="+256… (up to 5; separate with commas)" required disabled={busy}/><p className="form-help">Only these numbers receive the test. Use numbers whose owners expect your message.</p></div>:<p className="form-help">Uses current phone numbers for this notice’s audience. Custom notices use their original members; departed residents and inactive staff are excluded. Duplicate numbers receive one copy.</p>}
   <button className="btn btn-primary" disabled={busy||!config||!message.trim()||message.length>1600}>{busy?'Preparing…':'Review SMS'}</button>
  </form>:<section aria-label="SMS review">
   <div className="sms-summary"><div><strong>{review.recipients.length}</strong><span>{review.test?'test recipients':'unique numbers'}</span></div><div><strong>{review.segments}</strong><span>segments / recipient</span></div><div><strong>{review.segments*review.recipients.length}</strong><span>estimated SMS units</span></div></div>
   <p className="form-help">{review.encoding} · Sender: {review.sender} · {review.mode==='live'?'Live sending charges your Africa’s Talking account. Rates depend on your account and destination.':'Sandbox sends to the simulator, not real handsets.'}</p>
   <div className="sms-message-preview">{review.message}</div>
   <details className="sms-details" open><summary>Recipients ({review.recipients.length})</summary><div className="sms-recipient-list">{review.recipients.map(r=><div key={r.number}><span>{r.name}</span><span className="mono">{r.number}</span></div>)}</div></details>
   {review.skipped.length>0&&<details className="sms-details"><summary>Skipped ({review.skipped.length})</summary>{review.skipped.map((r,i)=><p key={i} className="form-help">{r.name}: {r.reason}</p>)}</details>}
   {used?<div role="status" className="sms-notice"><strong>{review.status==='accepted'?'Accepted by provider':review.status==='submitting'?'Submission in progress — do not resend':`Result: ${review.status}`}</strong><p>{review.error||'Acceptance does not confirm handset delivery. Check final delivery reports in Africa’s Talking.'}</p>{review.results.map(r=><p key={r.number} className="form-help">{r.number}: {r.status}{r.reason?` · ${r.reason}`:''}{r.cost?` · ${r.cost}`:''}{r.message_id?` · ${r.message_id}`:''}</p>)}</div>:<p className="form-help">Check the text and each number. This review is valid for 30 minutes. Estimated segments may differ from final provider billing.</p>}
   <div className="agreement-actions"><button className="btn" disabled={busy} onClick={()=>{setReview(null);setError('');}}>{used?'Prepare another SMS':'Edit message / recipients'}</button>{!used&&<button className="btn btn-primary" disabled={busy||!review.configured} onClick={send}>{busy?'Sending…':review.mode==='live'?`Send ${review.test?'test SMS':`to ${review.recipients.length} numbers`}`:'Send to sandbox'}</button>}</div>
  </section>}
  {error&&<p className="announcement-ai-error" role="alert">{error}</p>}
  {history.length>0&&<details className="sms-details"><summary>SMS sending history ({history.length})</summary><p className="form-help">Sending again creates another charge. Check earlier attempts before repeating a message.</p>{history.map(h=><div key={h.id} className="sms-history"><strong>{h.test?'Test':'Audience'} · {h.mode} · {h.status}</strong><span>{fmtDateTime(h.submitted_at||h.created_at)} · {h.recipients.length} numbers</span><p>{h.message}</p>{h.error&&<p>{h.error}</p>}{h.results.map(r=><p key={r.number} className="form-help">{r.number}: {r.status}{r.reason?` · ${r.reason}`:''}{r.cost?` · ${r.cost}`:''}</p>)}</div>)}</details>}
 </Modal>;
}
