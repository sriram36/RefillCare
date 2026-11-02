// RefillCare Role Views & Action Handlers

let CART = [];
let RES = [];

async function customer() {
  const [rf, os, pr, nt] = await Promise.all([
    api('refills'),
    api('orders'),
    api('profiles'),
    api('notes')
  ]);
  const due = rf.filter(r => r.due);

  const consentBanner = !U.consent_at ? `
    <div class="card" style="border: 2px solid var(--amber); background: var(--amber-light); margin-bottom: 20px;">
      <h3 style="margin-top:0">${esc(t('consent_title'))}</h3>
      <p style="white-space: pre-line; line-height: 1.6;">${esc(t('consent_body'))}</p>
      <button class="p" onclick="act(async () => {
        const res = await post('consent');
        U.consent_at = res.consent_at;
        localStorage.u = JSON.stringify(U);
      }, 'Consent recorded')">${esc(t('consent_btn'))}</button>
    </div>` : '';

  $('#app').innerHTML = `
    ${consentBanner}
    <button class="p big" onclick="document.getElementById('up').scrollIntoView({behavior:'smooth'})">💊 ${t('reorder')}</button>

    <h2>${t('low')}</h2>
    ${due.length
      ? due.map(r => `
          <div class="card row">
            <div>
              <b>${esc(r.name)}</b><br>
              <span class="mute">${t('for_lbl')} ${esc(r.for_name)}. About ${r.days_left} days left.</span>
            </div>
            <button class="p" onclick="act(()=>post('refills/${r.id}/reorder'), 'Sent to the pharmacist')">Reorder</button>
          </div>`).join('')
      : `<p class="mute">${t('no_low')}</p>`
    }

    <h2>${t('search_title')}</h2>
    <input id="sq" placeholder="${esc(t('search_ph'))}" oninput="srch(this.value)" style="width:100%" aria-label="Search medicines">
    <div id="sr"></div>
    <div id="cart"></div>

    <h2 id="up">${t('upload')}</h2>
    <form class="card" onsubmit="up(event)">
      <div class="row" style="justify-content:flex-start">
        <select name="for_name" aria-label="Who is it for">
          ${pr.map(p => `<option>${esc(p.name)}</option>`).join('')}
        </select>
        <button type="button" onclick="addp()">${t('add_person')}</button>
        <select name="payment" aria-label="Payment">
          <option value="cod">${t('cod')}</option>
          <option value="upi_test">${t('upi_test')}</option>
        </select>
        <select name="area" aria-label="Delivery area">
          ${['Park Street', 'Salt Lake', 'Behala', 'Howrah'].map(a => `<option>${a}</option>`).join('')}
        </select>
        <input type="file" name="file" accept="image/png,image/jpeg">
        <select name="demo">
          <option value="">No demo</option>
          <option value="clean">Demo: clear printed</option>
          <option value="handwritten">Demo: handwritten</option>
          <option value="blurry">Demo: blurry</option>
          <option value="schedx">Demo: restricted item</option>
          <option value="h1">Demo: controlled (H1)</option>
        </select>
        <button class="p">${t('send')}</button>
      </div>
      <p class="mute">${t('rx_safety_note')}</p>
    </form>

    ${nt.length ? `<h2>${t('messages')}</h2>${nt.map(n => `<div class="card mute">${esc(n.text)}</div>`).join('')}` : ''}

    <h2>${t('orders')}</h2>
    ${os.length
      ? os.map(o => `
          <div class="card">
            <div class="row">
              <b>${o.code}</b>
              ${pill(o.status)}
            </div>
            ${timeline(o.status)}
            <div class="mute">
              ${t('for_lbl')} ${esc(o.for_name)}${o.store ? '. ' + t('store_lbl') + ': ' + esc(o.store) : ''}${o.payment === 'upi_test' ? '. ' + t('paid_upi') + (o.payment_ref ? ` (${esc(o.payment_ref)})` : '') : '. ' + t('pay_delivery')}
            </div>
            ${o.delivery_partner && o.status === 'dispatched' ? `<div class="ok" style="font-size:0.88rem;margin-top:2px">🚚 ${esc(t('delivery_by'))}: <b>${esc(o.delivery_partner)}</b></div>` : ''}
            ${o.total_savings ? `<div style="margin-top:4px"><span class="pill ok">🎉 ${esc(t('saved_lbl'))} ₹${o.total_savings}</span></div>` : ''}
            ${o.note ? `<div class="${o.status === 'on_hold' ? 'bad' : 'mute'}">${esc(o.note)}</div>` : ''}
            ${o.status === 'on_hold'
              ? `<form onsubmit="reup(event, '${o.code}')" class="row" style="justify-content:flex-start;margin-top:8px">
                  <input type="file" name="file" accept="image/png,image/jpeg">
                  <select name="demo">
                    <option value="">No demo</option>
                    <option value="clean">Demo: clear printed</option>
                    <option value="handwritten">Demo: handwritten</option>
                    <option value="blurry">Demo: blurry</option>
                  </select>
                  <button class="p">${t('upload_new')}</button>
                </form>`
              : ''
            }
            ${o.items.map(i => `
              <div style="padding:4px 0">
                ${esc(i.name)} × ${i.qty} ${i.status === 'rejected' ? `<span class="bad">(${esc(i.reason)})</span>` : ''}
                ${i.offer_med && i.consent == null
                  ? `<div class="card" style="margin-top:8px">
                      ${t('generic_offer')} <b>${esc(i.offer_med.name)}</b> (₹${i.offer_med.price} ${t('instead_of')} ₹${i.price}).
                      <button class="p" onclick="act(()=>post('items/${i.id}/consent', {accept:true}), 'Generic accepted')">${t('accept')}</button>
                      <button onclick="act(()=>post('items/${i.id}/consent', {accept:false}), 'Keeping the original')">${t('keep_original')}</button>
                    </div>`
                  : ''
                }
                ${i.offer
                  ? ` <span class="mute">${i.consent == null ? t('waiting_customer') : i.consent ? t('generic_accepted') : t('generic_kept')}</span>`
                  : ''
                }
              </div>`).join('')}
          </div>`).join('')
      : `<div class="card mute">${t('no_orders')}</div>`
    }

    <div style="margin-top:24px;padding-top:16px;border-top:1px solid var(--line)">
      <button onclick="exportData()">${t('export_data')}</button>
    </div>`;
  showc();
}

async function srch(v) {
  if (v.trim().length < 2) {
    $('#sr').innerHTML = '';
    return;
  }
  try {
    RES = await api('search?term=' + encodeURIComponent(v));
    $('#sr').innerHTML = RES.map((m, i) => `
      <div class="card row">
        <span>${esc(m.name)} <span class="pill">${m.schedule}</span> ₹${m.price}</span>
        ${m.rule === 'ok'
          ? `<button onclick="addc(${i})">Add</button>`
          : `<span class="mute">${m.rule === 'rx' ? 'Needs a prescription. Upload one below.' : 'Not sold online'}</span>`
        }
      </div>`).join('') || '<p class="mute">No match.</p>';
  } catch (err) {
    toast(err.message);
  }
}

function addc(i) {
  const med = RES[i];
  const existing = CART.find(c => c.id === med.id);
  if (existing) {
    existing.qty++;
  } else {
    CART.push({ id: med.id, name: med.name, price: med.price, qty: 1 });
  }
  showc();
}

function showc() {
  const container = $('#cart');
  if (!container) return;
  const getVal = name => document.querySelector('[name=' + name + ']').value;
  container.innerHTML = CART.length ? `
    <div class="card">
      <b>${t('cart_title')}</b>
      ${CART.map(c => `<div>${esc(c.name)} × ${c.qty} (₹${c.price * c.qty})</div>`).join('')}
      <div class="row" style="justify-content:flex-start;margin-top:8px">
        <button class="p" onclick="act(async () => {
          await post('cart', {
            for_name: getVal('for_name'),
            payment: getVal('payment'),
            area: getVal('area'),
            lines: CART.map(c => ({ med_id: c.id, qty: c.qty }))
          });
          CART = [];
        }, 'Order placed')">${t('place_order')}</button>
        <button onclick="CART=[];showc()">${t('clear_cart')}</button>
      </div>
    </div>` : '';
}

function up(e) {
  e.preventDefault();
  const fd = new FormData(e.target);
  if (!fd.get('file').size) fd.delete('file');
  act(() => api('orders', { method: 'POST', body: fd }), 'Sent to the pharmacist');
}

function reup(e, code) {
  e.preventDefault();
  const fd = new FormData(e.target);
  if (!fd.get('file').size) fd.delete('file');
  act(() => api('orders/' + code + '/reupload', { method: 'POST', body: fd }), 'New photo sent');
}

function addp() {
  const name = prompt('Name:');
  if (!name || !name.trim()) return;
  const relation = prompt('Relation (e.g. Mother, Father, Child, Self):', 'Family') || 'Family';
  const isMinor = confirm('Is this person under 18 years old?');
  let guardianConsent = false;
  if (isMinor) {
    guardianConsent = confirm('As parent/guardian, do you consent to processing health and prescription data for this minor under DPDP Act?');
    if (!guardianConsent) {
      alert('Guardian consent is required to add an under-18 family profile.');
      return;
    }
  }
  act(() => post('profiles', {
    name: name.trim(),
    relation: relation.trim(),
    is_minor: isMinor,
    guardian_consent: guardianConsent
  }), 'Added');
}

async function exportData() {
  try {
    const data = await api('me/export');
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `refillcare-data-${U.phone}.json`;
    a.click();
    toast('Data export ready');
  } catch (err) {
    toast(err.message);
  }
}

async function pharmacist() {
  if (TAB === 'd') return dash();
  const orders = await api('orders');
  SEL = (SEL && orders.find(o => o.code === SEL.code)) ||
        orders.find(o => o.status === 'awaiting_pharmacist') ||
        orders[0];

  $('#app').innerHTML = `
    <div class="row" style="justify-content:flex-start;margin-bottom:12px">
      <button class="p" onclick="TAB='d';render()">Dashboard</button>
    </div>
    <h2>Verification queue</h2>
    <div class="split">
      <div>
        ${orders.map(o => `
          <div class="card q ${SEL && o.code === SEL.code ? 'on' : ''}" onclick="SEL=${esc(JSON.stringify({code: o.code}))};render()">
            <div class="row">
              <b>${o.code}</b>
              ${pill(o.status)}
            </div>
            <div class="mute" style="margin-top:4px">${esc(o.for_name)}</div>
          </div>`).join('') || '<p class="mute">Queue is empty.</p>'
        }
      </div>
      <div id="rv"></div>
    </div>`;

  if (SEL) review(SEL);
}

async function review(order) {
  $('#rv').innerHTML = `
    <div class="row">
      <h2 style="margin:0">${order.code} · ${esc(order.for_name)}</h2>
      ${pill(order.status)}
    </div>
    ${order.note ? `<p class="warn">${esc(order.note)}</p>` : ''}
    <div class="two" style="margin-top:14px">
      <div class="card" id="img">
        <p class="mute">Loading prescription…</p>
      </div>
      <div>
        ${order.items.map(item => `
          <div class="card">
            <div class="row">
              <b>${esc(item.name)}</b>
              <span class="pill">${item.schedule}</span>
            </div>
            <div class="${item.conf < 0.75 ? 'warn' : 'ok'}" style="margin-top:4px;font-size:0.9rem">
              ${item.conf < 0.75 ? '⚠️ Low confidence. Check against image.' : '✓ Matched'} (${Math.round(item.conf * 100)}%)
            </div>
            ${item.status === 'draft'
              ? `<div class="row" style="justify-content:flex-start;margin-top:10px">
                  <input id="q${item.id}" type="number" min="1" max="50" value="${item.qty}" style="width:80px" aria-label="Quantity">
                  <button class="p" onclick="appr(${item.id}, '${item.schedule}')">Approve</button>
                  <button class="d" onclick="rej(${item.id})">Reject</button>
                </div>`
              : `<div style="margin-top:6px" class="${item.status === 'approved' ? 'ok' : 'bad'}">
                  ${item.status === 'approved' ? 'Approved' : 'Rejected: ' + esc(item.reason)}
                  ${item.status === 'approved' && item.generic && !item.offer
                    ? ` <button onclick="act(()=>post('items/${item.id}/offer-generic'), 'Generic offered')">Offer cheaper generic (₹${item.generic.price})</button>`
                    : ''
                  }
                  ${item.offer
                    ? ` <span class="mute">${item.consent == null ? 'Waiting for customer' : item.consent ? 'Customer accepted the generic' : 'Customer kept the original'}</span>`
                    : ''
                  }
                </div>`
            }
          </div>`).join('') || '<div class="card mute">No lines were read. Ask for a new photo.</div>'
        }
        <div class="row" style="justify-content:flex-start;margin-top:12px">
          <button onclick="hold('${order.code}')">Ask for new photo</button>
        </div>
        <div style="margin-top:14px">
          <details>
            <summary style="cursor:pointer;font-size:0.88rem;color:var(--mute)"><b>Prescription access audit log (DPDP Act)</b></summary>
            <div id="rx-audit" style="margin-top:8px;font-size:0.85rem" class="mute">Loading access logs…</div>
          </details>
        </div>
      </div>
    </div>`;

  try {
    const response = await fetch('/api/orders/' + order.code + '/rx', { headers: { Authorization: T } });
    if (!response.ok) throw 0;
    const blob = await response.blob();
    $('#img').innerHTML = `<img class="rx" alt="Prescription" src="${URL.createObjectURL(blob)}">`;
  } catch {
    $('#img').innerHTML = '<p class="mute">No prescription image on file for this order.</p>';
  }

  api('orders/' + order.code + '/audit').then(logs => {
    const el = $('#rx-audit');
    if (!el) return;
    if (!logs.length) { el.textContent = 'No access events logged yet.'; return; }
    el.innerHTML = logs.map(a => `<div>${new Date(a.ts * 1000).toLocaleTimeString()}: <b>${esc(a.actor)}</b> ${esc(a.action)}</div>`).join('');
  }).catch(() => {});
}

function appr(id, schedule) {
  const body = { action: 'approve', qty: +$('#q' + id).value };
  if (schedule === 'H1') {
    body.prescriber = prompt('Prescriber name (H1 register)');
    body.patient = prompt('Patient name (H1 register)');
    if (!body.prescriber || !body.patient) return;
  }
  act(() => post('items/' + id + '/decide', body), 'Approved');
}

function rej(id) {
  const reason = prompt('Reason for rejecting (required)');
  if (reason) {
    act(() => post('items/' + id + '/decide', { action: 'reject', reason }), 'Rejected');
  }
}

function hold(code) {
  const reason = prompt('What should the customer fix?', 'Please upload a clearer photo.');
  if (reason) {
    act(() => post('orders/' + code + '/hold', { reason }), 'Customer asked to re-upload');
  }
}

function pack(code) {
  const invoice = prompt('Store invoice number');
  if (invoice) act(() => post('orders/' + code + '/pack', { invoice }), 'Packed');
}

function dispatchOrder(code) {
  const partner = prompt('Delivery partner / courier:', 'Local Express Delivery') || 'Local Express Delivery';
  act(() => post('orders/' + code + '/dispatch', { partner }), 'Handed to delivery');
}

function stk(e) {
  e.preventDefault();
  act(() => api('stock', { method: 'POST', body: new FormData(e.target) }), 'Stock updated');
}

async function dash() {
  const d = await api('dashboard');
  const rows = obj => Object.entries(obj).map(([k, v]) => `
    <div class="row" style="padding:4px 0">
      <span>${esc(k)}</span>
      <b>${v}</b>
    </div>`).join('');

  $('#app').innerHTML = `
    <div class="row" style="justify-content:flex-start">
      <button class="p" onclick="TAB='q';render()">Queue</button>
    </div>
    <h2>Across all stores</h2>
    <div class="card">Median time to verify: <b>${d.median_verify_min ?? 'n/a'} min</b></div>

    <div class="card row" style="justify-content:space-around;text-align:center">
      <div class="stat-card"><div class="stat-label">Total Stores</div><div class="stat-num">${d.network_overview?.total_stores ?? 3}</div></div>
      <div class="stat-card"><div class="stat-label">Active Orders</div><div class="stat-num">${d.network_overview?.active_orders ?? 0}</div></div>
      <div class="stat-card"><div class="stat-label">Total Orders</div><div class="stat-num">${d.network_overview?.total_orders ?? 0}</div></div>
    </div>

    <h2>46-Store network summary</h2>
    <div class="card" style="overflow-x:auto">
      <table class="data-table">
        <thead>
          <tr>
            <th>Store</th>
            <th>Total</th>
            <th>Awaiting</th>
            <th>Approved</th>
            <th>Packed</th>
            <th>Dispatched</th>
            <th>Stock status</th>
          </tr>
        </thead>
        <tbody>
          ${(d.stores_summary || []).map(s => `
            <tr>
              <td><b>${esc(s.name)}</b></td>
              <td>${s.total_orders}</td>
              <td>${s.awaiting}</td>
              <td>${s.approved}</td>
              <td>${s.packed}</td>
              <td>${s.dispatched}</td>
              <td>${s.low_stock_count > 0 ? `<span class="pill bad">⚠️ ${s.low_stock_count} low</span>` : '<span class="pill ok">✓ Healthy</span>'}</td>
            </tr>`).join('')}
        </tbody>
      </table>
    </div>

    ${d.low_stock_alerts && d.low_stock_alerts.length ? `
      <h2>Low-stock inventory alerts (&le; 5 units)</h2>
      <div class="card">
        ${d.low_stock_alerts.map(a => `
          <div class="row" style="padding:6px 0;border-bottom:1px solid var(--line)">
            <span><b>${esc(a.med_name)}</b> (${esc(a.store_name)})</span>
            <span class="pill bad">${a.qty} in stock</span>
          </div>`).join('')}
      </div>` : ''
    }

    <div class="two">
      <div class="card">
        <b>Orders by store</b>
        ${rows(d.by_store)}
      </div>
      <div class="card">
        <b>Rejections</b>
        ${rows(d.rejections) || '<p class="mute">None yet.</p>'}
      </div>
    </div>

    <h2>H1 register</h2>
    ${d.register.map(r => `
      <div class="card">
        ${esc(r.order_code)}: prescriber ${esc(r.prescriber)}, patient ${esc(r.patient)}, quantity ${r.qty}
      </div>`).join('') || '<p class="mute">No H1 sales yet.</p>'
    }

    <h2>Daily stock file</h2>
    <form class="card" onsubmit="stk(event)">
      <input type="file" name="file" accept=".csv" required>
      <button class="p">Upload stock CSV</button>
    </form>

    <h2>Refill reminders</h2>
    <div class="card">
      <button class="p" onclick="act(()=>post('reminders/run'), 'Reminders sent')">Send today's reminders</button>
    </div>

    <h2>Recent activity</h2>
    ${d.audit.map(a => `
      <div class="mute" style="padding:2px 0">
        ${new Date(a.ts * 1000).toLocaleTimeString()}: <b>${esc(a.actor)}</b>, ${esc(a.action)}, ${esc(a.entity)}
      </div>`).join('')
    }`;
}

async function storeView() {
  const orders = await api('orders');
  $('#app').innerHTML = `
    <h2>Orders for your store</h2>
    ${orders.map(o => `
      <div class="card">
        <div class="row">
          <b>${o.code}</b>
          ${pill(o.status)}
        </div>
        <div class="mute" style="margin-top:4px">
          For ${esc(o.for_name)}${o.payment === 'upi_test' ? '. UPI (test mode): paid' : '. Collect cash on delivery'}
        </div>
        ${o.items.filter(i => i.status !== 'rejected').map(i => `<div style="padding:2px 0">${esc(i.name)} × ${i.qty}</div>`).join('')}
        ${o.status === 'awaiting_pharmacist'
          ? '<div class="mute" style="margin-top:8px">Waiting for pharmacist approval. Do not pack yet.</div>'
          : o.status === 'approved'
          ? `<button class="p" style="margin-top:8px" onclick="pack('${o.code}')">Pack and enter invoice number</button>`
          : o.status === 'packed'
          ? `<button class="p" style="margin-top:8px" onclick="dispatchOrder('${o.code}')">Hand to delivery</button>`
          : `<div class="ok" style="margin-top:8px">✓ Handed to delivery${o.delivery_partner ? ` (${esc(o.delivery_partner)})` : ''}. Invoice ${esc(o.invoice_no)}</div>`
        }
      </div>`).join('') || '<div class="card mute">No orders for your store yet.</div>'
    }`;
}

