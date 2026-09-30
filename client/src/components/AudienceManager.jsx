import React,{useEffect,useMemo,useState} from 'react';
import {api} from '../api.js';
import {Modal,useToast} from './ui.jsx';
export default function AudienceManager({onClose,onChanged}){
 const [groups,setGroups]=useState([]),[roster,setRoster]=useState(null),[editing,setEditing]=useState(null),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 const toast=useToast();
 function load(){return Promise.all([api.get('/audiences'),api.get('/audiences/recipients')]).then(([g,r])=>{setGroups(g);setRoster(r);setError('');}).catch(e=>setError(e.message));}
 useEffect(()=>{load();},[]);
 async function archive(g){setBusy(true);try{await api.put(`/audiences/${g.id}`,{archived:!g.archived});await load();onChanged();toast(g.archived?'Audience restored':'Audience archived. Posted announcements are preserved.');}catch(e){toast(e.message,'error');}finally{setBusy(false);}}
 return <Modal title={editing?(editing.id?'Edit audience':'Create audience'):'Announcement audiences'} onClose={onClose}>
  {error&&<p className="announcement-ai-error" role="alert">{error} <button className="btn btn-sm" onClick={load}>Retry</button></p>}
  {!roster&&!error&&<p role="status">Loading recipients…</p>}
  {roster&&(editing?<AudienceForm group={editing.id?editing:null} roster={roster} onCancel={()=>setEditing(null)} onSaved={async()=>{setEditing(null);await load();onChanged();}}/>:<>
   <p className="form-help">Create reusable groups for hostel notices. Selected recipients receive announcements in their app; membership changes apply to future posts.</p>
   <button className="btn btn-primary" onClick={()=>setEditing({})}>+ Create audience</button>
   <div className="audience-group-list">{groups.map(g=><div className={`audience-group ${g.archived?'archived':''}`} key={g.id}><div><strong>{g.name}</strong><p className="dim">{g.members.length} members{g.archived?' · Archived':''}</p>{g.description&&<p>{g.description}</p>}</div><div className="occupancy-actions"><button className="btn btn-sm" disabled={busy} onClick={()=>setEditing(g)}>Edit</button><button className="btn btn-sm" disabled={busy} onClick={()=>archive(g)}>{g.archived?'Restore':'Archive'}</button></div></div>)}</div>
   {!groups.length&&<div className="audience-empty">No custom audiences yet. Create one for LDC tenants, a floor, or a selected group of residents.</div>}
  </>)}
 </Modal>;
}
function AudienceForm({group,roster,onCancel,onSaved}){
 const [name,setName]=useState(group?.name||''),[description,setDescription]=useState(group?.description||''),[query,setQuery]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const recipients=useMemo(()=>[
  ...roster.residents.map(r=>({key:`resident:${r.id}`,id:r.id,type:'resident',name:`${r.first_name} ${r.last_name}`,detail:`${r.room_name||'Room unassigned'} · ${r.status}`})),
  ...roster.staff.map(u=>({key:`user:${u.id}`,id:u.id,type:'user',name:u.full_name,detail:`Staff · ${u.role} · @${u.username}`}))
 ],[roster]);
 const [selected,setSelected]=useState(new Set((group?.members||[]).map(m=>m.resident_id?`resident:${m.resident_id}`:`user:${m.user_id}`).filter(key=>recipients.some(r=>r.key===key))));
 const shown=recipients.filter(r=>`${r.name} ${r.detail}`.toLowerCase().includes(query.toLowerCase()));
 function toggle(key){setSelected(prev=>{const next=new Set(prev);if(next.has(key))next.delete(key);else next.add(key);return next;});}
 async function submit(e){e.preventDefault();if(busy)return;setBusy(true);setError('');const chosen=recipients.filter(r=>selected.has(r.key));try{const data={name,description,resident_ids:chosen.filter(r=>r.type==='resident').map(r=>r.id),user_ids:chosen.filter(r=>r.type==='user').map(r=>r.id)};await(group?api.put(`/audiences/${group.id}`,data):api.post('/audiences',data));await onSaved();}catch(e){setError(e.message);setBusy(false);}}
 return <form onSubmit={submit}>
  <div className="field"><label htmlFor="audience-name">Audience name *</label><input id="audience-name" className="input" required maxLength="80" value={name} disabled={busy} onChange={e=>setName(e.target.value)} placeholder="e.g. LDC tenants"/></div>
  <div className="field"><label htmlFor="audience-description">Description</label><input id="audience-description" className="input" maxLength="300" value={description} disabled={busy} onChange={e=>setDescription(e.target.value)} placeholder="Who belongs in this group?"/></div>
  <div className="field"><label htmlFor="audience-search">Select recipients</label><input id="audience-search" className="input" placeholder="Search name, room or staff role…" value={query} onChange={e=>setQuery(e.target.value)}/></div>
  <div className="audience-selection-head"><strong>{selected.size} selected</strong><div><button type="button" className="btn btn-sm" disabled={busy} onClick={()=>setSelected(prev=>new Set([...prev,...shown.map(r=>r.key)]))}>Select shown</button><button type="button" className="btn btn-sm" disabled={busy} onClick={()=>setSelected(new Set())}>Clear</button></div></div>
  <div className="audience-recipient-list">{shown.map(r=><label className="audience-recipient" key={r.key}><input type="checkbox" checked={selected.has(r.key)} disabled={busy} onChange={()=>toggle(r.key)}/><div><strong>{r.name}</strong><span>{r.detail}</span></div></label>)}{!shown.length&&<p className="dim">No matching recipients.</p>}</div>
  {error&&<p className="announcement-ai-error" role="alert">{error}</p>}
  <p className="form-help">Select at least one resident or staff member. This group is used for announcements inside the app.</p>
  <div className="agreement-actions"><button type="button" className="btn" disabled={busy} onClick={onCancel}>Cancel</button><button className="btn btn-primary" disabled={busy||!selected.size}>{busy?'Saving…':group?'Save audience':'Create audience'}</button></div>
 </form>;
}
