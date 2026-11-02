// RefillCare UI Components
const LBL = {
  awaiting_pharmacist: ['Waiting for pharmacist', 'warn'],
  on_hold: ['Please upload a clearer photo', 'bad'],
  approved: ['Approved', 'ok'],
  packed: ['Packed', 'ok'],
  dispatched: ['On the way', 'ok'],
  rejected: ['Not available', 'bad']
};

const pill = status => {
  const key = 'status_' + status;
  const translated = L[LG] && L[LG][key];
  const [defaultLabel, colorClass] = LBL[status] || [status, ''];
  const label = translated || defaultLabel;
  return `<span class="pill ${colorClass}">${label}</span>`;
};

const timeline = status => {
  if (status === 'rejected') {
    return `<div class="timeline"><span class="tl-step done"><span class="tl-dot">✓</span> ${esc(t('step_placed'))}</span><span class="tl-sep done"></span><span class="tl-step hold" style="color:var(--red)"><span class="tl-dot" style="background:var(--red);border-color:var(--red);color:#fff">✕</span> ${esc(t('status_rejected'))}</span></div>`;
  }
  const isHold = status === 'on_hold';
  const s2Done = ['approved', 'packed', 'dispatched'].includes(status);
  const s2Active = status === 'awaiting_pharmacist';
  const s3Done = ['packed', 'dispatched'].includes(status);
  const s3Active = status === 'approved';
  const s4Done = status === 'dispatched';
  const s4Active = status === 'packed';
  const s5Done = status === 'dispatched';

  return `
    <div class="timeline" aria-label="Order progress">
      <span class="tl-step done"><span class="tl-dot">✓</span> ${esc(t('step_placed'))}</span>
      <span class="tl-sep ${s2Done ? 'done' : ''}"></span>
      <span class="tl-step ${s2Done ? 'done' : isHold ? 'hold' : s2Active ? 'active' : ''}">
        <span class="tl-dot">${s2Done ? '✓' : isHold ? '!' : '2'}</span> ${esc(isHold ? t('status_on_hold') : t('step_review'))}
      </span>
      <span class="tl-sep ${s3Done ? 'done' : ''}"></span>
      <span class="tl-step ${s3Done ? 'done' : s3Active ? 'active' : ''}">
        <span class="tl-dot">${s3Done ? '✓' : '3'}</span> ${esc(t('step_approved'))}
      </span>
      <span class="tl-sep ${s4Done ? 'done' : ''}"></span>
      <span class="tl-step ${s4Done ? 'done' : s4Active ? 'active' : ''}">
        <span class="tl-dot">${s4Done ? '✓' : '4'}</span> ${esc(t('step_packed'))}
      </span>
      <span class="tl-sep ${s5Done ? 'done' : ''}"></span>
      <span class="tl-step ${s5Done ? 'done' : ''}">
        <span class="tl-dot">${s5Done ? '✓' : '5'}</span> ${esc(t('step_dispatched'))}
      </span>
    </div>`;
};
