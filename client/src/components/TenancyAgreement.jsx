import React,{useEffect,useState} from 'react';
import {api,downloadAgreement} from '../api.js';
import {Modal,useToast,fmtDateTime} from './ui.jsx';
export const defaultTenancy={tenant_type:'bachelor',billing_basis:'fixed',end_date:'',rent_amount:'',deposit_amount:'',payment_due:'',emergency_name:'',emergency_phone:'',special_terms:''};
export function TenancyFields({value,onChange,startDate}) {
 const set=(key,v)=>onChange({...value,[key]:v});
 return <div className="tenancy-fields">
  <div className="section-title">Tenancy agreement details</div>
  <p className="form-help">Creates a branded, three-page PDF with the resident details, room, terms and signature spaces. Empty amounts are marked “To be agreed”.</p>
  <div className="form-row"><Field label="Tenant category" id="agreement-category"><select id="agreement-category" className="select" value={value.tenant_type} onChange={e=>set('tenant_type',e.target.value)}><option value="bachelor">University student</option><option value="ldc">LDC tenant</option><option value="other">Other tenant</option></select></Field><Field label="Tenancy end date" id="agreement-end"><input id="agreement-end" className="input" type="date" min={startDate||undefined} value={value.end_date} onChange={e=>set('end_date',e.target.value)}/></Field></div>
  <div className="form-row"><Field label="Rent basis" id="agreement-basis"><select id="agreement-basis" className="select" value={value.billing_basis} onChange={e=>set('billing_basis',e.target.value)}><option value="fixed">Total for stay / semester</option><option value="monthly">Per calendar month</option></select></Field><Field label="Agreed rent (UGX)" id="agreement-rent"><input id="agreement-rent" className="input" type="number" min="0" max="1000000000" step="1" value={value.rent_amount??''} onChange={e=>set('rent_amount',e.target.value)} placeholder="To be agreed"/></Field></div>
  <div className="form-row"><Field label="Security deposit (UGX)" id="agreement-deposit"><input id="agreement-deposit" className="input" type="number" min="0" max="1000000000" step="1" value={value.deposit_amount??''} onChange={e=>set('deposit_amount',e.target.value)} placeholder="To be agreed"/></Field><Field label="Payment timing" id="agreement-timing"><input id="agreement-timing" className="input" maxLength="120" value={value.payment_due} onChange={e=>set('payment_due',e.target.value)} placeholder="e.g. Before move-in"/></Field></div>
  <div className="form-row"><Field label="Emergency contact name" id="agreement-contact"><input id="agreement-contact" className="input" maxLength="120" value={value.emergency_name} onChange={e=>set('emergency_name',e.target.value)}/></Field><Field label="Emergency contact phone" id="agreement-phone"><input id="agreement-phone" className="input" maxLength="60" value={value.emergency_phone} onChange={e=>set('emergency_phone',e.target.value)}/></Field></div>
  <Field label="Additional agreed terms" id="agreement-notes"><textarea id="agreement-notes" className="textarea" maxLength="650" value={value.special_terms} onChange={e=>set('special_terms',e.target.value)} placeholder="Included services, notice period or agreed arrangements…"/></Field>
  <p className="form-help">Template for management review before signing. PDF terms do not create rent invoices; record the stay on the Dashboard.</p>
 </div>;
}
function Field({label,id,children}){return <div className="field"><label htmlFor={id}>{label}</label>{children}</div>;}
export default function TenancyAgreement({resident,onClose,created=false}) {
 const [data,setData]=useState(null),[error,setError]=useState(''),[terms,setTerms]=useState(defaultTenancy),[generating,setGenerating]=useState(false),[busy,setBusy]=useState(false),[downloading,setDownloading]=useState(null);
 const toast=useToast();
 function load(){setError('');return api.get(`/residents/${resident.id}/agreements`).then(d=>{setData(d);setTerms(d.terms||defaultTenancy);}).catch(e=>setError(e.message));}
 useEffect(()=>{load();},[resident.id]);
 async function download(d){setDownloading(d.id);try{await downloadAgreement(resident.id,d.id,d.filename);}catch(e){toast(e.message,'error');}finally{setDownloading(null);}}
 async function generate(e){e.preventDefault();if(busy)return;setBusy(true);try{await api.post(`/residents/${resident.id}/agreements`,terms);setGenerating(false);await load();toast('New agreement version created.');}catch(e){toast(e.message,'error');}finally{setBusy(false);}}
 async function upload(e){const file=e.target.files[0];e.target.value='';if(!file)return;setBusy(true);try{const fd=new FormData();fd.append('agreement',file);await api.upload(`/residents/${resident.id}/agreements/signed`,fd);await load();toast('Signed agreement attached.');}catch(e){toast(e.message,'error');}finally{setBusy(false);}}
 return <Modal title={created?'Resident added · Agreement ready':`Tenancy agreement · ${resident.first_name}`} onClose={onClose}>
  {created&&<div className="agreement-success"><span>✓</span><div><strong>{resident.first_name} {resident.last_name} is registered.</strong><p>The branded PDF is saved. Download it, print it and give the resident their copy.</p></div></div>}
  {error&&<div className="occupancy-notice" role="alert">{error} <button className="btn btn-sm" onClick={load}>Retry</button></div>}
  {!data&&!error&&<p role="status">Loading agreements…</p>}
  {data&&<>
    {!generating&&<>
      <div className="agreement-document-list">{data.documents.map(d=><div className="agreement-document" key={d.id}><div><strong>{d.kind==='signed'?'Signed agreement':'Generated tenancy agreement'}</strong><p className="dim">{fmtDateTime(d.created_at)} · {d.kind==='signed'?'Uploaded copy':'Draft template'}</p></div><button className="btn btn-sm btn-primary" disabled={downloading===d.id} onClick={()=>download(d)}>{downloading===d.id?'Downloading…':'Download PDF'}</button></div>)}</div>
      {!data.documents.length&&<p className="dim">No agreement saved yet. Generate one using this resident’s details.</p>}
      <p className="form-help">PDFs use A4 pages and can be saved or opened in your PDF viewer to print. Saved versions retain their original tenant and room details.</p>
      <div className="agreement-actions"><button className="btn" onClick={()=>setGenerating(true)} disabled={busy}>{data.documents.length?'Create updated version':'Generate agreement'}</button><label className="btn agreement-upload">{busy?'Uploading…':'Attach signed PDF'}<input type="file" accept="application/pdf,.pdf" disabled={busy} onChange={upload}/></label></div>
      <p className="form-help">Signed copies: PDF only, up to 10 MB. Available to management only.</p>
    </>}
    {generating&&<form onSubmit={generate}><TenancyFields value={terms} onChange={setTerms} startDate={resident.move_in_date}/><div className="agreement-actions"><button type="button" className="btn" onClick={()=>setGenerating(false)} disabled={busy}>Cancel</button><button className="btn btn-primary" disabled={busy}>{busy?'Creating PDF…':'Generate new PDF'}</button></div></form>}
  </>}
 </Modal>;
}
