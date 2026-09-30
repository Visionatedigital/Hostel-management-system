const DAY = 86400000;
export const today = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Africa/Kampala' });
export function validDate(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
}
export const nextDay = date => new Date(Date.parse(date) + DAY).toISOString().slice(0, 10);
export const days = (start, end) => Math.round((Date.parse(end) - Date.parse(start)) / DAY);
export function monthEndExclusive(month) {
  const [year, m] = month.split('-').map(Number);
  return new Date(Date.UTC(year, m, 1)).toISOString().slice(0, 10);
}
export function monthSlices(start, end) {
  const slices = [];
  for (let cursor = start; cursor < end;) {
    const month = cursor.slice(0, 7);
    const next = monthEndExclusive(month);
    const stop = end < next ? end : next;
    slices.push({ month, start: cursor, end: stop, weight: days(cursor, stop) / days(`${month}-01`, next) });
    cursor = stop;
  }
  return slices;
}
export function rentSchedule(stay) {
  const end = nextDay(stay.end_date);
  const slices = monthSlices(stay.start_date, end);
  if (stay.billing_basis === 'monthly') {
    return slices.map(slice => ({...slice, amount: stay.amount}));
  }
  const totalWeight = slices.reduce((sum, slice) => sum + slice.weight, 0);
  const shares = slices.map(slice => ({...slice, exact: stay.amount * slice.weight / totalWeight}));
  let remainder = stay.amount - shares.reduce((sum, slice) => sum + Math.floor(slice.exact), 0);
  const order = shares.map((slice, i) => ({i, fraction: slice.exact % 1})).sort((a, b) => b.fraction - a.fraction || a.i - b.i);
  const bonus = new Set(order.slice(0, remainder).map(item => item.i));
  return shares.map((slice, i) => ({month: slice.month, start: slice.start, end: slice.end, weight: slice.weight, amount: Math.floor(slice.exact) + (bonus.has(i) ? 1 : 0)}));
}
export function invoiceSchedule(stay) {
  if (stay.billing_basis === 'fixed') return [{amount: stay.amount, due_date: stay.start_date, period_start: stay.start_date, period_end: stay.end_date}];
  return rentSchedule(stay).filter(slice => slice.amount > 0).map(slice => ({amount: slice.amount, due_date: slice.start, period_start: slice.start, period_end: new Date(Date.parse(slice.end) - DAY).toISOString().slice(0, 10)}));
}
export function effectiveStays(stays, residents) {
  const fallback = residents.filter(r => r.status === 'active' && r.room_id).flatMap(r => {
    const first = stays.filter(s => s.resident_id === r.id).sort((a,b)=>a.start_date.localeCompare(b.start_date))[0];
    const start = r.move_in_date || '1900-01-01';
    let end = r.move_out_date || '9999-12-31';
    if (first) {
      const before = new Date(Date.parse(first.start_date)-DAY).toISOString().slice(0,10);
      if (before < end) end = before;
    }
    return start <= end ? [{id:`unpriced-${r.id}`,resident_id:r.id,room_id:r.room_id,start_date:start,end_date:end,unpriced:true}] : [];
  });
  return [...stays, ...fallback];
}

export function capacityExceeded(candidate, existing, capacity) {
  const start = candidate.start_date, end = nextDay(candidate.end_date);
  const events = [{date: start, change: 1}, {date: end, change: -1}];
  for (const stay of existing.filter(s => s.room_id === candidate.room_id)) {
    const a = stay.start_date > start ? stay.start_date : start;
    const b = stay.end_date >= candidate.end_date ? end : nextDay(stay.end_date);
    if (a < b) events.push({date: a, change: 1}, {date: b, change: -1});
  }
  events.sort((a, b) => a.date.localeCompare(b.date) || a.change - b.change);
  let occupied = 0;
  return events.some(event => (occupied += event.change) > capacity);
}
