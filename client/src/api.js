const API_BASE = '/api';

let token = localStorage.getItem('hostel_token') || null;

export function setToken(t) {
  token = t;
  if (t) localStorage.setItem('hostel_token', t);
  else localStorage.removeItem('hostel_token');
}

export function getToken() {
  return token;
}

async function request(method, path, body, isForm = false, options = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (!isForm) headers['Content-Type'] = 'application/json';

  const res = await fetch(`${API_BASE}${path}`, {
    method,
    signal: options.signal,
    headers,
    body: isForm ? body : body ? JSON.stringify(body) : undefined,
  });

  if (res.status === 401) {
    setToken(null);
    window.location.href = '/login';
    throw new Error('Unauthorized');
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

export const api = {
  get: (p) => request('GET', p),
  post: (p, b, options) => request('POST', p, b, false, options),
  put: (p, b) => request('PUT', p, b),
  del: (p, b) => request('DELETE', p, b),
  upload: (p, formData) => request('POST', p, formData, true),
};

// Authenticated documents never use public upload URLs.
export async function downloadAgreement(residentId,documentId,filename='tenancy-agreement.pdf') {
  const res=await fetch(`${API_BASE}/residents/${residentId}/agreements/${documentId}`,{headers:{Authorization:`Bearer ${getToken()}`}});
  if(!res.ok){const error=await res.json().catch(()=>({}));throw new Error(error.error||'Could not download agreement.');}
  const blob=await res.blob(),url=URL.createObjectURL(blob);
  const link=document.createElement('a');link.href=url;link.download=filename;link.click();
  setTimeout(()=>URL.revokeObjectURL(url),30000);
}
