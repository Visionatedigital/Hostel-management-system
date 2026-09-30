import PDFDocument from 'pdfkit';
import { fileURLToPath } from 'node:url';
import { validDate, today } from '../stay-math.js';
const logo=fileURLToPath(new URL('../../assets/new-nana-logo.png',import.meta.url));
export const TEMPLATE_VERSION='1.0';
const blue='#07549b', ink='#183047', muted='#617285';
const money=n=>n===null||n===undefined?'To be agreed':`UGX ${Number(n).toLocaleString('en-UG')}`;
const types={bachelor:'University student',ldc:'LDC tenant',other:'Other tenant'};
function text(value,max,label){if(value===undefined||value===null)return '';if(typeof value!=='string'||value.length>max)throw new Error(`${label} must be text of at most ${max} characters.`);return value.trim().replace(/\s+/g,' ');}
export function agreementTerms(input={}) {
  if(!input||typeof input!=='object'||Array.isArray(input))throw new Error('Invalid tenancy details.');
  const end_date=text(input.end_date,10,'Tenancy end date');
  if(end_date&&!validDate(end_date))throw new Error('Enter a valid tenancy end date.');
  const tenant_type=input.tenant_type||'other',billing_basis=input.billing_basis||'fixed';
  if(!types[tenant_type]||!['fixed','monthly'].includes(billing_basis))throw new Error('Invalid tenancy category or rent basis.');
  function amount(value,label){if(value===''||value===undefined||value===null)return null;const n=Number(value);if(!Number.isSafeInteger(n)||n<0||n>1000000000)throw new Error(`${label} must be a whole UGX amount from 0 to 1,000,000,000.`);return n;}
  return {end_date,tenant_type,billing_basis,rent_amount:amount(input.rent_amount,'Rent'),deposit_amount:amount(input.deposit_amount,'Deposit'),payment_due:text(input.payment_due,120,'Payment timing'),emergency_name:text(input.emergency_name,120,'Emergency contact name'),emergency_phone:text(input.emergency_phone,60,'Emergency contact phone'),special_terms:text(input.special_terms,650,'Special terms')};
}
export function agreementSnapshot(resident,terms,reference) {
  if(resident.move_in_date&&!validDate(resident.move_in_date))throw new Error('Enter a valid move-in date.');
  if(terms.end_date&&resident.move_in_date&&terms.end_date<resident.move_in_date)throw new Error('Tenancy end date must be on or after move-in.');
  return {template_version:TEMPLATE_VERSION,reference,issued_on:today(),resident:{first_name:text(resident.first_name,60,'First name'),last_name:text(resident.last_name,60,'Last name'),phone:text(resident.phone,60,'Phone'),email:text(resident.email,120,'Email'),national_id:text(resident.national_id,80,'National ID'),room_id:resident.room_id||null,room_name:text(resident.room_name,120,'Room name'),room_type:text(resident.room_type,30,'Room type'),move_in_date:resident.move_in_date||''},terms};
}
export function generateTenancyPdf(snapshot) {
  return new Promise((resolve,reject)=>{
    const doc=new PDFDocument({size:'A4',margins:{top:46,left:46,right:46,bottom:0},autoFirstPage:false,bufferPages:true,info:{Title:`New Nana Hostel - Tenancy agreement - ${snapshot.resident.first_name} ${snapshot.resident.last_name}`,Author:'New Nana Hostel',Subject:'Draft tenancy agreement for management review'}});
    const chunks=[];doc.on('data',c=>chunks.push(c));doc.on('error',reject);doc.on('end',()=>resolve(Buffer.concat(chunks)));
    try {
      const {resident:r,terms:t}=snapshot,w=503;
      let compact=false;
      function header(page,title,sub) {
        if(page>1&&doc.y>770)throw new Error('Agreement content exceeds printable area: '+doc.y);
        doc.addPage();doc.rect(0,0,595.28,7).fill(blue);
        doc.image(logo,46,23,{fit:[59,65],align:'center'});
        doc.font('Helvetica-Bold').fontSize(17).fillColor(blue).text('NEW NANA HOSTEL',120,36);
        doc.font('Helvetica').fontSize(9).fillColor(muted).text('TENANCY AGREEMENT  /  RESIDENT COPY',120,60);
        doc.fontSize(8).text(`Ref: ${snapshot.reference}  |  Issued: ${snapshot.issued_on}`,46,105,{width:w});
        doc.moveTo(46,124).lineTo(549,124).strokeColor('#dce5ee').stroke();
        doc.font('Helvetica-Bold').fontSize(24).fillColor(ink).text(title,46,145,{width:w});
        doc.font('Helvetica').fontSize(10).fillColor(muted).text(sub,46,177,{width:w,lineGap:3});
        doc.roundedRect(46,210,w,37,5).fill('#edf4fb');
        doc.font('Helvetica-Bold').fontSize(8.5).fillColor(blue).text('DRAFT TEMPLATE - COMPLETE & REVIEW BEFORE SIGNING',58,221,{width:479});
        // Fixed footer position stays outside content; lineBreak:false prevents an extra page.
        doc.moveTo(46,784).lineTo(549,784).strokeColor('#dce5ee').stroke();
        doc.font('Helvetica').fontSize(8).fillColor(muted).text(`New Nana Hostel  |  Template ${snapshot.template_version}  |  ${snapshot.reference}`,46,796,{width:410,lineBreak:false});
        doc.text(`${page} / 3`,510,796,{width:39,align:'right',lineBreak:false});
        doc.y=255;doc.x=46;
      }
      function section(title){doc.font('Helvetica-Bold').fontSize(12).fillColor(blue).text(title,46,doc.y,{width:w});doc.y+=compact?6:10;}
      function paragraph(content){doc.font('Helvetica').fontSize(compact?9.5:10).fillColor(ink).text(content,46,doc.y,{width:w,lineGap:compact?2:4});doc.y+=compact?8:12;}
      function facts(rows) {
        for(const [index,[label,value]] of rows.entries()){
          const y=doc.y;doc.font('Helvetica').fontSize(9.5);
          const h=Math.max(compact?24:28,doc.heightOfString(String(value||'To be completed'),{width:337,lineGap:2})+(compact?8:12));
          doc.rect(46,y,w,h).fill(index%2?'#ffffff':'#f4f7fa');
          doc.fillColor(muted).text(label,56,y+7,{width:146,lineGap:2});
          doc.font('Helvetica-Bold').fillColor(ink).text(String(value||'To be completed'),205,y+7,{width:332,lineGap:2});
          doc.y=y+h;
        }doc.y+=compact?12:18;
      }
      header(1,'Your tenancy at a glance','The details below identify the resident, room and proposed financial terms.');
      section('01  Resident & accommodation');
      facts([['Resident',`${r.first_name} ${r.last_name}`],['Phone / email',[r.phone,r.email].filter(Boolean).join(' / ')],['National ID',r.national_id],['Room / type',[r.room_name,r.room_type].filter(Boolean).join(' / ')],['Tenant category',types[t.tenant_type]],['Tenancy dates',`${r.move_in_date||'Start to be agreed'}  to  ${t.end_date||'End to be agreed'}`],['Emergency contact',[t.emergency_name,t.emergency_phone].filter(Boolean).join(' / ')]]);
      section('02  Rent & deposit');
      facts([['Agreed rent',`${money(t.rent_amount)}${t.rent_amount===null?'':t.billing_basis==='monthly'?' per calendar month':' total for the stated stay'}`],['Payment timing',t.payment_due||'To be agreed before signing'],['Security deposit',money(t.deposit_amount)]]);
      paragraph('The agreement is between New Nana Hostel (management) and the named resident. The room allocation, dates and amounts must be confirmed by both parties before signing. Blank or unconfirmed terms require completion.');
      doc.fontSize(8.5).fillColor(muted).text('Hostel address and authorised management contact: ______________________________________',46,doc.y,{width:w,lineGap:3});
      header(2,'Living here, clearly','Practical responsibilities for the resident and hostel management.');
      const clauses=[
        ['03  Use of the room','The resident will use the allocated bed or room for residential accommodation, keep it clean and respect shared facilities. Subletting, swapping rooms or accommodating an additional person requires prior written management approval.'],
        ['04  Payments & receipts','Rent and payment dates follow the agreed terms on page 1. For an agreed monthly arrangement, each calendar month touched by the stay is charged in full unless a different term is recorded below. A semester means three months with its exact dates stated on page 1. Management will provide receipts and maintain a payment record.'],
        ['05  Care, repairs & access','The resident will report faults promptly and avoid unauthorised alterations. Management will record repair requests and arrange maintenance. Access for routine inspection or repair should be arranged with reasonable notice; urgent safety incidents should be reported immediately.'],
        ['06  Visitors, conduct & safety','Visitors must follow the hostel registration, approval and departure procedures communicated by management. Residents and guests should respect other occupants, keep noise reasonable, safeguard keys and follow communicated fire and safety instructions.'],
        ['07  Renewal, departure & deposit','Renewals, room changes and notice arrangements must be confirmed in writing. At departure, both parties should record the room condition, return of keys and any proposed deposit deductions with supporting reasons. Any agreed refund or outstanding balance should be documented.'],
        ['08  Questions & agreed changes','Residents should raise concerns with the authorised management contact. Any changes to dates, rates or responsibilities should be recorded and acknowledged by both parties. This template does not replace applicable law or a hostel policy formally supplied to the resident.']
      ];
      for(const [title,body] of clauses){section(title);paragraph(body);}
      header(3,'Agreement & handover','Complete outstanding terms, check the room together, and sign both copies.');
      compact=true;doc.y=259;
      section('09  Additional agreed terms');
      paragraph(t.special_terms||'Complete any agreed notice period, included services or other arrangements before signing.');
      doc.font('Helvetica').fontSize(9).fillColor(muted).text('Further terms / notice period: ________________________________________________________\n_______________________________________________________________________________',46,doc.y,{width:w,lineGap:3});doc.y+=12;
      section('10  Room handover checklist');
      facts([['Room condition','________________________________________________'],['Furniture / inventory','________________________________________________'],['Keys issued / returned','________________________________________________'],['Existing damage','________________________________________________'],['Meter readings (if relevant)','________________________________________________']]);
      section('11  Acknowledgement & signatures');
      paragraph('We have checked the resident details and agreed terms, completed outstanding blanks, and received a copy. The resident and authorised hostel representative sign below.');
      const y=doc.y;
      function signature(x,title,name){doc.font('Helvetica-Bold').fontSize(10).fillColor(blue).text(title,x,y,{width:230});doc.font('Helvetica').fontSize(9).fillColor(ink).text(name,x,y+23,{width:230});doc.text('Signature: _________________________',x,y+48,{width:230});doc.text('Date: _____________________________',x,y+72,{width:230});}
      signature(46,'RESIDENT',`${r.first_name} ${r.last_name}`);signature(315,'FOR NEW NANA HOSTEL','Name: ____________________________');
      doc.y=y+102;doc.font('Helvetica').fontSize(9).fillColor(muted).text('Witness name & signature (if used): _________________________________________________',46,doc.y,{width:w});
      if(doc.y>770)throw new Error('Agreement signature content exceeds printable area: '+doc.y);
      doc.end();
    }catch(e){doc.destroy();reject(e);}
  });
}
