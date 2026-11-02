// RefillCare Main Application Controller

function fill(phone) {
  const el = $('#ph');
  if (el) el.value = phone;
}

async function login() {
  try {
    const res = await post('login', {
      phone: $('#ph').value,
      otp: $('#otp').value
    });
    T = res.token;
    U = res.user;
    localStorage.t = T;
    localStorage.u = JSON.stringify(U);
    render();
  } catch (err) {
    toast(err.message);
  }
}

async function render() {
  $('#who').innerHTML = `
    <select onchange="LG=this.value;localStorage.lg=LG;render()" aria-label="Language">
      <option value="en">English</option>
      <option value="bn" ${LG === 'bn' ? 'selected' : ''}>বাংলা</option>
      <option value="hi" ${LG === 'hi' ? 'selected' : ''}>हिन्दी</option>
    </select>
    ` + (U ? `<span class="pill" style="font-weight:600">${esc(U.name)} (${esc(U.role)})</span> <button onclick="out()">Sign out</button>` : '');

  if (!U) {
    $('#app').innerHTML = `
      <div class="card" style="max-width:520px;margin:20px auto">
        <h2>Sign in</h2>
        <p class="mute">Demo OTP is 123456.</p>
        <div class="row" style="margin-top:12px">
          <input id="ph" inputmode="numeric" placeholder="Phone number" style="flex:1">
          <input id="otp" placeholder="OTP" value="123456" style="width:110px">
          <button class="p" onclick="login()">Sign in</button>
        </div>
      </div>
      <div class="card" style="max-width:520px;margin:20px auto">
        <b>Quick demo accounts</b>
        <div class="row" style="justify-content:flex-start;margin-top:10px;gap:8px">
          <button onclick="fill('9000000001')">Customer: Debasish</button>
          <button onclick="fill('9000000002')">Customer: Rina</button>
          <button onclick="fill('9000000099')">Pharmacist: Anita</button>
          <button onclick="fill('9000000081')">Store: Salt Lake</button>
          <button onclick="fill('9000000083')">Store: Howrah</button>
        </div>
      </div>`;
    return;
  }

  $('#app').innerHTML = '<p class="mute">Loading…</p>';
  try {
    if (U.role === 'customer') {
      await customer();
    } else if (U.role === 'store') {
      await storeView();
    } else {
      await pharmacist();
    }
  } catch (err) {
    $('#app').innerHTML = `<div class="card bad">${esc(err.message)} <button onclick="render()">Try again</button></div>`;
  }
}

// Initial application boot
render();
