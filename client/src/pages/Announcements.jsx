import React, { useEffect, useRef, useState } from 'react';
import { api } from '../api.js';
import AudienceManager from '../components/AudienceManager.jsx';
import AnnouncementSms from '../components/AnnouncementSms.jsx';
import { Badge, Modal, Empty, fmtDateTime, useToast } from '../components/ui.jsx';

export default function Announcements({user}) {
  const canManage=user?.role==='admin';
  const [managing,setManaging]=useState(false),[audiences,setAudiences]=useState([]);
  function loadAudiences(){if(canManage)api.get('/audiences').then(setAudiences).catch(e=>toast(e.message,'error'));}
  const [items, setItems] = useState([]);
  const [showAdd, setShowAdd] = useState(false);
  const [smsAnnouncement,setSmsAnnouncement]=useState(null);
  const toast = useToast();

  function load() { api.get('/announcements').then(setItems).catch((e) => toast(e.message, 'error')); }
  useEffect(() => { load();loadAudiences(); }, []);

  async function remove(a) {
    if (!confirm('Delete this announcement?')) return;
    try { await api.del(`/announcements/${a.id}`); toast('Deleted'); load(); }
    catch (e) { toast(e.message, 'error'); }
  }

  return (
    <div className="stagger">
      <div className="page-head">
        <div>
          <div className="eyebrow">Communication · Official updates</div>
          <h1 className="page-title">Announcements</h1>
          <p className="page-sub">Broadcast hostel updates to residents and staff.</p>
        </div>
        {canManage&&<div className="occupancy-actions"><button className="btn" onClick={()=>setManaging(true)}>Manage audiences</button><button className="btn btn-primary" onClick={() => setShowAdd(true)}>+ New announcement</button></div>}
      </div>

      {items.length === 0 ? (
        <Empty icon="▤" text="No announcements" />
      ) : (
        <div className="grid">
          {items.map((a) => (
            <div className="card" key={a.id}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                    <Badge value={a.audience_group_id?'custom':a.audience} label={a.audience_label||(a.audience==='all'?'Everyone':a.audience)} />
                    {a.audience_group_id&&<span className="dim" style={{fontSize:11}}>{a.recipient_count} recipients</span>}
                    <span className="mono dim" style={{ fontSize: 11 }}>{fmtDateTime(a.created_at)}</span>
                  </div>
                  <div className="section-title" style={{ marginBottom: 6 }}>{a.title}</div>
                  <div className="dim" style={{ fontSize: 14, whiteSpace: 'pre-wrap' }}>{a.body}</div>
                  <div className="mono dim" style={{ fontSize: 11, marginTop: 8 }}>by {a.author_name || '—'}</div>
                </div>
                {canManage&&<div className="sms-card-actions"><button className="btn btn-sm" onClick={()=>setSmsAnnouncement(a)}>Send SMS</button><button aria-label="Delete announcement" className="btn btn-sm btn-danger" onClick={() => remove(a)}>✕</button></div>}
              </div>
            </div>
          ))}
        </div>
      )}

      {smsAnnouncement&&<AnnouncementSms announcement={smsAnnouncement} onClose={()=>setSmsAnnouncement(null)}/>}
      {managing&&<AudienceManager onClose={()=>setManaging(false)} onChanged={loadAudiences}/>}
      {showAdd && <AddAnnouncement onAudiencesChanged={loadAudiences} audiences={audiences.filter(g=>!g.archived)} onClose={() => setShowAdd(false)} onSaved={() => { setShowAdd(false); load(); }} />}
    </div>
  );
}

function AddAnnouncement({ audiences, onAudiencesChanged, onClose, onSaved }) {
  const toast=useToast();
  const [managingAudience,setManagingAudience]=useState(false);
  const [form,setForm]=useState({title:'',body:'',audience:'all'});
  const [tone,setTone]=useState('professional'),[rewriting,setRewriting]=useState(false),[suggestion,setSuggestion]=useState(null),[rewriteError,setRewriteError]=useState(''),[undo,setUndo]=useState(null),[posting,setPosting]=useState(false);
  const pending=useRef(null);
  useEffect(()=>()=>pending.current?.abort(),[]);
  function set(k,v){setForm(f=>({...f,[k]:v}));setSuggestion(null);setRewriteError('');if(k==='body')setUndo(null);}
  async function rewrite(){
    if(rewriting||!form.body.trim())return;
    const controller=new AbortController();pending.current=controller;
    setRewriting(true);setRewriteError('');setSuggestion(null);
    try{
      const result=await api.post('/announcements/rewrite',{...form,tone,audience_name:audiences.find(g=>form.audience===`group:${g.id}`)?.name||''},{signal:controller.signal});
      if(!controller.signal.aborted)setSuggestion(result.body);
    }catch(e){if(!controller.signal.aborted)setRewriteError(e.message);}
    finally{if(!controller.signal.aborted)setRewriting(false);pending.current=null;}
  }
  function useRewrite(){setUndo(form.body);setForm(f=>({...f,body:suggestion}));setSuggestion(null);toast('Rewrite applied. You can still edit it.');}
  async function submit(e){
    e.preventDefault();if(posting||rewriting)return;setPosting(true);
    try{await api.post('/announcements',form);toast('Announcement posted');onSaved();}
    catch(e){toast(e.message,'error');setPosting(false);}
  }
  return <><Modal title="New announcement" onClose={onClose}>
    <form onSubmit={submit}>
      <div className="field"><label htmlFor="announcement-title">Title *</label><input id="announcement-title" className="input" maxLength="200" required disabled={rewriting||posting} value={form.title} onChange={e=>set('title',e.target.value)}/></div>
      <div className="field"><div className="announcement-body-label"><label htmlFor="announcement-body">Body</label><span>{form.body.length.toLocaleString()} / 6,000</span></div><textarea id="announcement-body" className="textarea announcement-body" maxLength="6000" disabled={rewriting||posting} value={form.body} onChange={e=>set('body',e.target.value)} placeholder="Write your announcement, then let AI help polish it…"/></div>
      <div className="announcement-ai-tools">
        <div className="field"><label htmlFor="rewrite-tone">Rewrite style</label><select id="rewrite-tone" className="select" value={tone} disabled={rewriting||posting} onChange={e=>{setTone(e.target.value);setSuggestion(null);}}><option value="professional">Formal management notice</option><option value="friendly">Friendly</option><option value="concise">Short & clear</option></select></div>
        <button type="button" className="btn announcement-ai-button" disabled={!form.body.trim()||rewriting||posting} onClick={rewrite}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="m12 3 2.3 6.7L21 12l-6.7 2.3L12 21l-2.3-6.7L3 12l6.7-2.3L12 3ZM20 2v4M18 4h4"/></svg>{rewriting?'Rewriting…':'Rewrite with AI'}</button>
      </div>
      <p className="form-help announcement-ai-note">OpenAI expands your notes into a complete notice with a management opening, appropriate apology and closing. Group membership details are not sent. Review before using.</p>
      {rewriting&&<p className="form-help" role="status">Polishing your draft. Your original text stays unchanged.</p>}
      {rewriteError&&<div className="announcement-ai-error" role="alert">{rewriteError}</div>}
      {suggestion!==null&&<section className="announcement-suggestion" aria-label="AI rewrite preview"><div className="announcement-suggestion-head"><strong>Suggested rewrite</strong><span>Not posted</span></div><p>{suggestion}</p><div className="agreement-actions"><button type="button" className="btn btn-primary btn-sm" disabled={posting} onClick={useRewrite}>Use this rewrite</button><button type="button" className="btn btn-sm" disabled={posting} onClick={()=>setSuggestion(null)}>Keep original</button></div></section>}
      {undo!==null&&<button type="button" className="btn btn-sm announcement-undo" disabled={rewriting||posting} onClick={()=>{setForm(f=>({...f,body:undo}));setUndo(null);setSuggestion(null);}}>Undo AI rewrite</button>}
      <div className="field"><div className="announcement-body-label"><label htmlFor="announcement-audience">Audience</label><button type="button" className="btn btn-sm" disabled={rewriting||posting} onClick={()=>setManagingAudience(true)}>Create / edit audiences</button></div><select id="announcement-audience" className="select" disabled={rewriting||posting} value={form.audience} onChange={e=>set('audience',e.target.value)}><option value="all">Everyone</option><option value="residents">Residents</option><option value="staff">Staff</option>{audiences.map(g=><option key={g.id} value={`group:${g.id}`}>{g.name} · {g.members.length} members</option>)}</select></div>
      <p className="form-help">Recipients receive this notice in their app. Custom group members are fixed when you post; future group edits do not change this notice.</p>
      <button className="btn btn-primary" disabled={rewriting||posting} style={{width:'100%'}}>{posting?'Posting…':'Post announcement'}</button>
    </form>
  </Modal>{managingAudience&&<AudienceManager onClose={()=>setManagingAudience(false)} onChanged={onAudiencesChanged}/>}</>;
}
