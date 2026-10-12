import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import express from 'express';

test('accepted invite issues an EgoSMS gate code and security verifies it server-side', async () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'hostel-gate-code-'));
  process.env.HOSTEL_DATA_DIR = temp;
  process.env.EGOSMS_ENVIRONMENT = 'sandbox';
  process.env.EGOSMS_USERNAME = 'test-user';
  process.env.EGOSMS_PASSWORD = 'test-secret';
  process.env.EGOSMS_SENDER_ID = 'NewNana';

  const { default: db } = await import('../src/db.js');
  const { default: inviteRoutes } = await import('../src/routes/invites.js');
  const { default: visitorRoutes } = await import('../src/routes/visitors.js');
  const { requireAuth, signToken } = await import('../src/auth.js');

  db.prepare("INSERT INTO residents(id,first_name,last_name,status,phone) VALUES(1,'Host','Resident','active','0700000000')").run();
  db.prepare("INSERT INTO users(id,username,password_hash,full_name,role,resident_id) VALUES(1,'resident','test','Resident','resident',1),(2,'guard','test','Guard','security',NULL)").run();

  const app = express();
  app.use(express.json());
  app.use('/invites', inviteRoutes);
  app.use('/visitors', requireAuth, visitorRoutes);
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));

  const nativeFetch = globalThis.fetch;
  let sentPayload = null;
  globalThis.fetch = async (url, options) => {
    if (String(url).startsWith('https://comms-test.pahappa.net')) {
      sentPayload = JSON.parse(options.body);
      return { ok: true, json: async () => ({ Status: 'OK', Cost: 35, MsgFollowUpUniqueCode: 'gate-sms-1' }) };
    }
    return nativeFetch(url, options);
  };

  const base = 'http://127.0.0.1:' + server.address().port;
  const residentToken = signToken({ id: 1, role: 'resident', username: 'resident' });
  const guardToken = signToken({ id: 2, role: 'security', username: 'guard' });
  const auth = token => ({ Authorization: 'Bearer ' + token });

  try {
    const missingPhone = await nativeFetch(base + '/invites', {
      method: 'POST',
      headers: { ...auth(residentToken), 'Content-Type': 'application/json' },
      body: JSON.stringify({ guest_name: 'Guest', guest_email: 'guest@example.com' }),
    });
    assert.equal(missingPhone.status, 400);

    const createdResponse = await nativeFetch(base + '/invites', {
      method: 'POST',
      headers: { ...auth(residentToken), 'Content-Type': 'application/json' },
      body: JSON.stringify({ guest_name: 'Guest', guest_email: 'guest@example.com', guest_phone: '0701 234 567' }),
    });
    assert.equal(createdResponse.status, 201);
    const created = await createdResponse.json();
    const token = created.invite_url.split('/').at(-1);

    const form = new FormData();
    form.append('selfie', new Blob(['selfie'], { type: 'image/jpeg' }), 'selfie.jpg');
    form.append('id_photo', new Blob(['id'], { type: 'image/jpeg' }), 'id.jpg');
    const acceptedResponse = await nativeFetch(base + '/invites/' + token + '/accept', { method: 'POST', body: form });
    assert.equal(acceptedResponse.status, 200);
    const accepted = await acceptedResponse.json();
    assert.match(accepted.access_code, /^\d{6}$/);
    assert.equal(accepted.sms_status, 'accepted');
    assert.equal(sentPayload.method, 'SendSms');
    assert.equal(sentPayload.msgdata[0].number, '256701234567');
    assert.match(sentPayload.msgdata[0].message, new RegExp(accepted.access_code));

    const visitor = db.prepare('SELECT * FROM visitors WHERE accept_token = ?').get(token);
    assert.equal(visitor.gate_code, accepted.access_code);
    assert.equal(visitor.gate_code_sms_reference, 'gate-sms-1');

    const wrong = await nativeFetch(base + '/visitors/verify-code', {
      method: 'POST',
      headers: { ...auth(guardToken), 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: '000000' }),
    });
    assert.equal(wrong.status, 400);

    const verifiedResponse = await nativeFetch(base + '/visitors/verify-code', {
      method: 'POST',
      headers: { ...auth(guardToken), 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: accepted.access_code }),
    });
    assert.equal(verifiedResponse.status, 200);
    const verified = await verifiedResponse.json();
    assert.equal(verified.status, 'accepted');
    assert.equal(verified.gate_code, undefined);
    assert.equal(verified.has_gate_code, true);
    assert.match(verified.verification_token, /^[0-9a-f-]{36}$/);

    const unverifiedApproval = await nativeFetch(base + '/visitors/' + visitor.id, {
      method: 'PUT',
      headers: { ...auth(guardToken), 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'approved' }),
    });
    assert.equal(unverifiedApproval.status, 403);

    const approvalResponse = await nativeFetch(base + '/visitors/' + visitor.id, {
      method: 'PUT',
      headers: { ...auth(guardToken), 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'approved', verification_token: verified.verification_token }),
    });
    assert.equal(approvalResponse.status, 200);
    const checkedIn = await approvalResponse.json();
    assert.equal(checkedIn.status, 'checked_in');
    assert.ok(checkedIn.check_in_time);
  } finally {
    globalThis.fetch = nativeFetch;
    await new Promise(resolve => server.close(resolve));
    db.close();
    fs.rmSync(temp, { recursive: true, force: true });
  }
});
