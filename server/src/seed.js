import bcrypt from 'bcryptjs';
import db from './db.js';

function reset() {
  db.exec(`
    DELETE FROM inspections;
    DELETE FROM announcements;
    DELETE FROM maintenance_requests;
    DELETE FROM payments;
    DELETE FROM visitors;
    DELETE FROM residents;
    DELETE FROM rooms;
    DELETE FROM users;
    DELETE FROM sqlite_sequence;
  `);
}

const hash = (pw) => bcrypt.hashSync(pw, 10);

function seed() {
  reset();

  // Users
  const insUser = db.prepare(
    `INSERT INTO users (username, password_hash, full_name, role, phone, active)
     VALUES (@username, @password_hash, @full_name, @role, @phone, 1)`
  );
  insUser.run({ username: 'admin',  password_hash: hash('admin123'),  full_name: 'Admin User',  role: 'admin',    phone: '+256700000001' });
  insUser.run({ username: 'guard',  password_hash: hash('guard123'),  full_name: 'Guard On Duty',role: 'security', phone: '+256700000002' });

  // Rooms
  const insRoom = db.prepare(
    `INSERT INTO rooms (name, floor, type, capacity, status, notes)
     VALUES (@name, @floor, @type, @capacity, @status, @notes)`
  );
  const rooms = [
    { name: 'Room 101', floor: 'Ground', type: 'double', capacity: 2, status: 'occupied', notes: 'Near gate' },
    { name: 'Room 102', floor: 'Ground', type: 'triple', capacity: 3, status: 'occupied', notes: '' },
    { name: 'Room 103', floor: 'Ground', type: 'double', capacity: 2, status: 'occupied', notes: '' },
    { name: 'Room 201', floor: 'First',  type: 'triple', capacity: 3, status: 'occupied', notes: '' },
    { name: 'Room 202', floor: 'First',  type: 'single', capacity: 1, status: 'occupied', notes: 'Single room' },
    { name: 'Room 203', floor: 'First',  type: 'double', capacity: 2, status: 'available', notes: '' },
  ];
  const roomIds = {};
  for (const r of rooms) {
    const info = insRoom.run(r);
    roomIds[r.name] = info.lastInsertRowid;
  }

  // Residents
  const insResident = db.prepare(
    `INSERT INTO residents (first_name, last_name, phone, email, national_id, photo_path, room_id, status, move_in_date, notes)
     VALUES (@first_name, @last_name, @phone, @email, @national_id, @photo_path, @room_id, @status, @move_in_date, @notes)`
  );
  const residents = [
    { first_name: 'John',   last_name: 'Okello',   phone: '+256701111111', email: 'john.okello@example.com',   national_id: 'UG10000001', photo_path: null, room: 'Room 101', status: 'active', move_in_date: '2026-01-15', notes: '' },
    { first_name: 'Sarah',  last_name: 'Nakato',   phone: '+256702222222', email: 'sarah.nakato@example.com',  national_id: 'UG10000002', photo_path: null, room: 'Room 101', status: 'active', move_in_date: '2026-01-15', notes: '' },
    { first_name: 'Brian',  last_name: 'Mugisha',  phone: '+256703333333', email: 'brian.mugisha@example.com', national_id: 'UG10000003', photo_path: null, room: 'Room 102', status: 'active', move_in_date: '2026-02-01', notes: '' },
    { first_name: 'Grace',  last_name: 'Achieng',  phone: '+256704444444', email: 'grace.achieng@example.com', national_id: 'UG10000004', photo_path: null, room: 'Room 102', status: 'active', move_in_date: '2026-02-01', notes: '' },
    { first_name: 'Daniel', last_name: 'Kato',     phone: '+256705555555', email: 'daniel.kato@example.com',    national_id: 'UG10000005', photo_path: null, room: 'Room 102', status: 'active', move_in_date: '2026-02-01', notes: '' },
    { first_name: 'Amina',  last_name: 'Hassan',   phone: '+256706666666', email: 'amina.hassan@example.com',  national_id: 'UG10000006', photo_path: null, room: 'Room 103', status: 'active', move_in_date: '2026-03-10', notes: '' },
    { first_name: 'Peter',  last_name: 'Otim',     phone: '+256707777777', email: 'peter.otim@example.com',    national_id: 'UG10000007', photo_path: null, room: 'Room 103', status: 'active', move_in_date: '2026-03-10', notes: '' },
    { first_name: 'Linda',  last_name: 'Nansubuga',phone: '+256708888888', email: 'linda.nansubuga@example.com',national_id: 'UG10000008', photo_path: null, room: 'Room 201', status: 'active', move_in_date: '2026-04-05', notes: '' },
    { first_name: 'Isaac',  last_name: 'Ssemakula',phone: '+256709999999', email: 'isaac.ssemakula@example.com',national_id: 'UG10000009', photo_path: null, room: 'Room 201', status: 'active', move_in_date: '2026-04-05', notes: '' },
    { first_name: 'Faith',  last_name: 'Nabirye',  phone: '+256710101010', email: 'faith.nabirye@example.com', national_id: 'UG10000010', photo_path: null, room: 'Room 201', status: 'active', move_in_date: '2026-04-05', notes: '' },
    { first_name: 'Mark',   last_name: 'Lwanga',   phone: '+256711111111', email: 'mark.lwanga@example.com',   national_id: 'UG10000011', photo_path: null, room: 'Room 202', status: 'active', move_in_date: '2026-05-20', notes: '' },
    { first_name: 'Rebecca',last_name: 'Auma',     phone: '+256712121212', email: 'rebecca.auma@example.com',  national_id: 'UG10000012', photo_path: null, room: 'Room 103', status: 'pending', move_in_date: null, notes: 'Awaiting move-in' },
  ];
  const residentIds = {};
  for (const r of residents) {
    const info = insResident.run({
      first_name: r.first_name, last_name: r.last_name, phone: r.phone, email: r.email,
      national_id: r.national_id, photo_path: r.photo_path, room_id: roomIds[r.room],
      status: r.status, move_in_date: r.move_in_date, notes: r.notes,
    });
    residentIds[`${r.first_name} ${r.last_name}`] = info.lastInsertRowid;
  }

  // Resident login accounts (linked to residents)
  const insResidentUser = db.prepare(
    `INSERT INTO users (username, password_hash, full_name, role, phone, active, resident_id)
     VALUES (?, ?, ?, 'resident', ?, 1, ?)`
  );
  insResidentUser.run('john', hash('resident123'), 'John Okello', '+256701111111', residentIds['John Okello']);
  insResidentUser.run('sarah', hash('resident123'), 'Sarah Nakato', '+256702222222', residentIds['Sarah Nakato']);

  // Visitors
  const insVisitor = db.prepare(
    `INSERT INTO visitors (resident_id, guest_name, guest_phone, id_number, purpose, expected_arrival, expected_departure, status, ref, check_in_time, check_out_time)
     VALUES (@resident_id, @guest_name, @guest_phone, @id_number, @purpose, @expected_arrival, @expected_departure, @status, @ref, @check_in_time, @check_out_time)`
  );
  const visitors = [
    { resident: 'John Okello',  guest_name: 'David Okafor', guest_phone: '+256720000001', id_number: 'ID9990001', purpose: 'Visit',        expected_arrival: '2026-09-16 14:00', expected_departure: '2026-09-16 18:00', status: 'checked_in',  check_in_time: '2026-09-16 14:12', check_out_time: null },
    { resident: 'Sarah Nakato', guest_name: 'Mary Nam',     guest_phone: '+256720000002', id_number: 'ID9990002', purpose: 'Study visit',  expected_arrival: '2026-09-16 16:00', expected_departure: '2026-09-16 20:00', status: 'approved',    check_in_time: null, check_out_time: null },
    { resident: 'Brian Mugisha',guest_name: 'Paul Kaggwa',  guest_phone: '+256720000003', id_number: 'ID9990003', purpose: 'Family',       expected_arrival: '2026-09-16 15:00', expected_departure: '2026-09-16 19:00', status: 'invited',     check_in_time: null, check_out_time: null },
    { resident: 'Amina Hassan', guest_name: 'Zainab Ali',   guest_phone: '+256720000004', id_number: 'ID9990004', purpose: 'Delivery',     expected_arrival: '2026-09-15 12:00', expected_departure: '2026-09-15 15:00', status: 'overdue',     check_in_time: '2026-09-15 12:30', check_out_time: null },
  ];
  let refNo = 1000;
  for (const v of visitors) {
    insVisitor.run({
      resident_id: residentIds[v.resident], guest_name: v.guest_name, guest_phone: v.guest_phone,
      id_number: v.id_number, purpose: v.purpose, expected_arrival: v.expected_arrival,
      expected_departure: v.expected_departure, status: v.status, ref: `VLT-${++refNo}`,
      check_in_time: v.check_in_time, check_out_time: v.check_out_time,
    });
  }

  // Payments
  const insPayment = db.prepare(
    `INSERT INTO payments (resident_id, amount, type, status, method, reference, due_date, paid_at, description)
     VALUES (@resident_id, @amount, @type, @status, @method, @reference, @due_date, @paid_at, @description)`
  );
  const payments = [
    { resident: 'John Okello',   amount: 350000, type: 'rent', status: 'paid',    method: 'mtn_momo',    due_date: '2026-09-01', paid_at: '2026-08-28', description: 'September rent' },
    { resident: 'John Okello',   amount: 350000, type: 'rent', status: 'pending', method: null,          due_date: '2026-10-01', paid_at: null,       description: 'October rent' },
    { resident: 'Sarah Nakato',  amount: 350000, type: 'rent', status: 'pending', method: null,          due_date: '2026-09-01', paid_at: null,       description: 'September rent' },
    { resident: 'Brian Mugisha', amount: 300000, type: 'rent', status: 'paid',    method: 'airtel_money', due_date: '2026-09-01', paid_at: '2026-08-30', description: 'September rent' },
    { resident: 'Grace Achieng', amount: 300000, type: 'rent', status: 'failed',  method: 'mtn_momo',    due_date: '2026-09-01', paid_at: null,       description: 'September rent' },
    { resident: 'Mark Lwanga',   amount: 200000, type: 'deposit', status: 'paid', method: 'bank',       due_date: null,          paid_at: '2026-05-18', description: 'Security deposit' },
  ];
  for (const p of payments) {
    insPayment.run({
      resident_id: residentIds[p.resident], amount: p.amount, type: p.type, status: p.status,
      method: p.method, reference: null, due_date: p.due_date, paid_at: p.paid_at, description: p.description,
    });
  }

  // Maintenance
  const insMaint = db.prepare(
    `INSERT INTO maintenance_requests (resident_id, room_id, category, description, priority, status, assigned_to)
     VALUES (@resident_id, @room_id, @category, @description, @priority, @status, @assigned_to)`
  );
  const maints = [
    { resident: 'John Okello',  room: 'Room 101', category: 'Plumbing',          priority: 'high',   status: 'open',        assigned: null,               description: 'Shower tap leaking' },
    { resident: 'John Okello',  room: 'Room 101', category: 'Carpentry & Doors', priority: 'normal', status: 'open',        assigned: null,               description: 'Door handle broken' },
    { resident: 'Grace Achieng',room: 'Room 102', category: 'Electrical',        priority: 'urgent', status: 'assigned',    assigned: 'James Okwera',     description: 'No power in room' },
    { resident: 'Faith Nabirye',room: 'Room 201', category: 'Carpentry & Doors', priority: 'normal', status: 'in_progress', assigned: 'Samuel Wamala',    description: 'Broken wardrobe door' },
  ];
  for (const m of maints) {
    insMaint.run({
      resident_id: residentIds[m.resident], room_id: roomIds[m.room], category: m.category,
      description: m.description, priority: m.priority, status: m.status, assigned_to: m.assigned,
    });
  }

  // Announcements
  const insAnn = db.prepare(
    `INSERT INTO announcements (title, body, audience, created_by) VALUES (@title, @body, @audience, 1)`
  );
  insAnn.run({ title: 'Water outage Saturday', body: 'Water will be off from 9am to 2pm for tank maintenance.', audience: 'residents' });
  insAnn.run({ title: 'Visitor hours reminder', body: 'All visitors must check out by 10pm unless approved for overnight stay.', audience: 'all' });

  // Inspections
  const insInsp = db.prepare(
    `INSERT INTO inspections (room_id, resident_id, inspection_date, condition_notes, returned_keys, deductions_proposed, deposit_status)
     VALUES (@room_id, @resident_id, @inspection_date, @condition_notes, @returned_keys, @deductions_proposed, @deposit_status)`
  );
  insInsp.run({
    room_id: roomIds['Room 203'], resident_id: null, inspection_date: '2026-09-10',
    condition_notes: 'Room in good condition', returned_keys: 1, deductions_proposed: 0, deposit_status: 'refunded',
  });

  console.log('Seed complete.');
  console.log('Logins -> admin/admin123 · guard/guard123 · john/resident123 (resident)');
}

seed();
