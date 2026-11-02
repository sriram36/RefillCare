// RefillCare API & State Client
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;'
}[c]));

let T = localStorage.t || '';
let U = JSON.parse(localStorage.u || 'null');
let SEL = null;
let LG = localStorage.lg || 'en';
let TAB = 'q';

function toast(m) {
  const el = $('#toast');
  if (!el) return;
  el.textContent = m;
  el.style.display = 'block';
  setTimeout(() => { el.style.display = 'none'; }, 4000);
}

async function api(path, options = {}) {
  const isFormData = options.body instanceof FormData;
  const response = await fetch('/api/' + path, {
    ...options,
    headers: {
      ...(options.body && !isFormData ? { 'Content-Type': 'application/json' } : {}),
      Authorization: T
    }
  });
  const data = await response.json().catch(() => ({}));
  if (response.status === 401 && T) {
    out();
  }
  if (!response.ok) {
    throw new Error(data.detail?.message || data.detail || 'Something went wrong. Try again.');
  }
  return data;
}

const post = (path, body) => api(path, {
  method: 'POST',
  body: body === undefined ? undefined : JSON.stringify(body)
});

async function out() {
  try {
    if (T) await post('logout');
  } catch (e) {}
  T = '';
  U = null;
  localStorage.clear();
  render();
}

async function act(fn, msg) {
  try {
    await fn();
    if (msg) toast(msg);
    render();
  } catch (err) {
    toast(err.message);
  }
}

