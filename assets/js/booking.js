/* Couleurs d’ongles — assistant de réservation (100 % statique, sans serveur)
   Le visiteur compose sa demande ; le site prépare le message et l’ouvre dans
   SMS / Instagram / e-mail, ou génère un fichier agenda (.ics).
   Aucun envoi automatique, aucun service tiers, aucun abonnement. */
(function () {
  'use strict';

  var d = document;
  var form = d.getElementById('wizard');
  if (!form) return;
  var $ = function (s, c) { return (c || d).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || d).querySelectorAll(s)); };

  var PHONE = '+33683384496', PHONE_TXT = '06 83 38 44 96', MAIL = 'couleursonglesadeline@gmail.com';
  var NB = '\u00a0';
  var state = { step: 1, xl: false, date: null, win: '', winLabel: '', flex: false, colors: [] };
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ------------------------------ dates ------------------------------ */
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function iso(dt) { return dt.getFullYear() + '-' + pad(dt.getMonth() + 1) + '-' + pad(dt.getDate()); }
  function easter(y) { // algorithme de Meeus/Jones/Butcher
    var a = y % 19, b = Math.floor(y / 100), c = y % 100, dd = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25),
      g = Math.floor((b - f + 1) / 3), h = (19 * a + b - dd - g + 15) % 30, i = Math.floor(c / 4), k = c % 4,
      l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451),
      month = Math.floor((h + l - 7 * m + 114) / 31), day = ((h + l - 7 * m + 114) % 31) + 1;
    return new Date(y, month - 1, day);
  }
  var holCache = {};
  function holidays(y) {
    if (holCache[y]) return holCache[y];
    var s = {}, add = function (dt) { s[iso(dt)] = 1; };
    [[0, 1], [4, 1], [4, 8], [6, 14], [7, 15], [10, 1], [10, 11], [11, 25]].forEach(function (md) { add(new Date(y, md[0], md[1])); });
    var e = easter(y);
    [1, 39, 50].forEach(function (n) { add(new Date(e.getFullYear(), e.getMonth(), e.getDate() + n)); });
    return (holCache[y] = s);
  }
  var today = new Date(); today.setHours(0, 0, 0, 0);
  var minDate = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
  var maxDate = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 7 * 12);
  function bookable(dt) {
    var w = dt.getDay();
    return dt >= minDate && dt <= maxDate && w >= 1 && w <= 5 && !holidays(dt.getFullYear())[iso(dt)];
  }
  var fmtLong = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  var fmtMonth = new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric' });

  /* ----------------------------- services ---------------------------- */
  var svcInputs = $$('#svcOpts input[name=svc]');
  function selectedSvc() { return svcInputs.filter(function (i) { return i.checked; }); }
  function xlApplies() { return selectedSvc().some(function (i) { return i.value === 'gel' || i.value === 'rempl'; }); }
  function total() {
    var s = selectedSvc(), t = 0, devis = false;
    s.forEach(function (i) { t += parseInt(i.getAttribute('data-price'), 10) || 0; if (i.value === 'art') devis = true; });
    if (state.xl && xlApplies()) t += 5;
    return { t: t, devis: devis };
  }
  function svcText() {
    var s = selectedSvc();
    if (!s.length) return '';
    var parts = s.map(function (i) {
      var p = parseInt(i.getAttribute('data-price'), 10);
      return i.getAttribute('data-name') + (i.value === 'art' ? ' (sur devis)' : ' (' + p + ' €)');
    });
    if (state.xl && xlApplies()) parts.push('longueur L/XL (+5 €)');
    return parts.join(', ');
  }
  svcInputs.forEach(function (inp) {
    inp.addEventListener('change', function () {
      if (inp.checked && inp.getAttribute('data-grp') === 'gel') {
        svcInputs.forEach(function (o) { if (o !== inp && o.getAttribute('data-grp') === 'gel') o.checked = false; });
      }
      var wrap = $('#xlWrap'); wrap.hidden = !xlApplies();
      if (!xlApplies()) { state.xl = false; $('#xlLen').checked = false; }
      $('#err1').textContent = '';
      render();
    });
  });
  $('#xlLen').addEventListener('change', function (e) { state.xl = e.target.checked; render(); });

  /* ---------------------------- calendrier --------------------------- */
  var cal = $('#cal'), view = { y: minDate.getFullYear(), m: minDate.getMonth() };
  function renderCal(focusSel) {
    var first = new Date(view.y, view.m, 1);
    var prevOk = new Date(view.y, view.m, 0) >= minDate, nextOk = new Date(view.y, view.m + 1, 1) <= maxDate;
    var h = '<div class="cal__head"><button type="button" class="cal__prev" aria-label="Mois précédent"' + (prevOk ? '' : ' disabled') + '><svg aria-hidden="true" style="transform:scaleX(-1)"><use href="#i-arrow"/></svg></button>' +
      '<b aria-live="polite">' + fmtMonth.format(first) + '</b>' +
      '<button type="button" class="cal__next" aria-label="Mois suivant"' + (nextOk ? '' : ' disabled') + '><svg aria-hidden="true"><use href="#i-arrow"/></svg></button></div><div class="cal__grid" role="group" aria-label="Jours du mois">';
    ['lun', 'mar', 'mer', 'jeu', 'ven', 'sam', 'dim'].forEach(function (x) { h += '<span class="cal__dow" aria-hidden="true">' + x + '</span>'; });
    var off = (first.getDay() + 6) % 7; for (var i = 0; i < off; i++) h += '<span class="cal__empty"></span>';
    var n = new Date(view.y, view.m + 1, 0).getDate();
    for (var day = 1; day <= n; day++) {
      var dt = new Date(view.y, view.m, day), ok = bookable(dt), id = iso(dt), sel = state.date === id;
      h += '<button type="button" class="cal__day' + (sel ? ' is-sel' : '') + (dt.getTime() === today.getTime() ? ' is-today' : '') + '" data-d="' + id + '"' + (ok ? '' : ' disabled') +
        ' aria-label="' + fmtLong.format(dt) + (ok ? '' : ' (indisponible)') + '" aria-pressed="' + (sel ? 'true' : 'false') + '">' + day + '</button>';
    }
    cal.innerHTML = h + '</div>';
    if (focusSel) { var b = $('.cal__day.is-sel', cal); if (b) b.focus({ preventScroll: true }); }
  }
  cal.addEventListener('click', function (e) {
    var t = e.target.closest('button'); if (!t) return;
    if (t.classList.contains('cal__prev')) { view.m--; if (view.m < 0) { view.m = 11; view.y--; } renderCal(); }
    else if (t.classList.contains('cal__next')) { view.m++; if (view.m > 11) { view.m = 0; view.y++; } renderCal(); }
    else if (t.classList.contains('cal__day')) { state.date = t.getAttribute('data-d'); $('#err2').textContent = ''; renderCal(true); render(); }
  });
  $$('#wins input').forEach(function (r) {
    r.addEventListener('change', function () { state.win = r.value; state.winLabel = r.getAttribute('data-label'); $('#err2').textContent = ''; render(); });
  });
  $('#flex').addEventListener('change', function (e) { state.flex = e.target.checked; $('#err2').textContent = ''; render(); });

  function dateObj() { if (!state.date) return null; var p = state.date.split('-'); return new Date(+p[0], +p[1] - 1, +p[2]); }
  function whenText() {
    var o = dateObj(), s = '';
    if (o) s = fmtLong.format(o);
    if (state.flex) s = (s ? s + ' (ou ' : 'Flexible (') + 'premier créneau libre)';
    if (state.winLabel) s += (s ? ', ' : '') + state.winLabel;
    return s;
  }

  /* ----------------------------- champs ------------------------------ */
  var fName = $('#fName'), fTel = $('#fTel'), fMail = $('#fMail'), fNote = $('#fNote');
  [fName, fTel, fMail, fNote].forEach(function (f) { f.addEventListener('input', function () { $('#err3').textContent = ''; render(); }); });
  $$('input[name=first]').forEach(function (r) { r.addEventListener('change', render); });
  function firstVal() { var r = $('input[name=first]:checked'); return r ? (r.value === 'oui' ? 'oui' : 'non, déjà cliente') : ''; }
  function validTel(v) { var t = v.replace(/[\s.\-()]/g, ''); return /^(?:\+33|0033|0)[1-9]\d{8}$/.test(t); }
  function validMail(v) { return !v || /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v); }

  /* ---------------------------- couleurs ----------------------------- */
  d.addEventListener('co:colors', function (e) { state.colors = e.detail || []; render(); });
  function renderChips() {
    var box = $('#chips');
    if (!state.colors.length) { box.innerHTML = '<p style="font-size:.92rem;opacity:.7">Astuce : choisis tes teintes dans le nuancier plus haut, elles s’ajoutent ici automatiquement.</p>'; return; }
    box.innerHTML = state.colors.map(function (c) { return '<span class="chip"><i style="--c:' + c.c + '"></i>' + c.n + '</span>'; }).join('');
  }

  /* ----------------------------- message ----------------------------- */
  function message(short) {
    var L = [];
    L.push('Bonjour Adeline, je souhaite prendre rendez-vous chez Couleurs d’ongles.');
    L.push('');
    L.push('Prestation(s) : ' + svcText());
    L.push('Créneau souhaité : ' + whenText());
    if (state.colors.length) L.push('Couleurs / inspirations : ' + state.colors.map(function (c) { return c.n; }).join(', '));
    var f = firstVal(); if (f) L.push('Première visite : ' + f);
    var note = fNote.value.trim(); if (note && !short) L.push('Remarques : ' + note);
    L.push('');
    L.push('Nom : ' + fName.value.trim() + ' — Tél. : ' + fTel.value.trim());
    var mail = fMail.value.trim(); if (mail && !short) L.push('E-mail : ' + mail);
    L.push('Merci ! (demande faite depuis le site)');
    return L.join('\n');
  }

  /* ------------------------------ ticket ----------------------------- */
  function money(n) { return n + NB + '€'; }
  function render() {
    var s = selectedSvc();
    $('#tSvc').innerHTML = s.length ? s.map(function (i) { return i.getAttribute('data-name'); }).join('<br>') + (state.xl && xlApplies() ? '<br>Longueur L/XL' : '') : '—';
    $('#tWhen').textContent = whenText() || '—';
    $('#tCol').textContent = state.colors.length ? state.colors.map(function (c) { return c.n; }).join(', ') : '—';
    var t = total();
    $('#tTotal').innerHTML = money(t.t) + (t.devis ? '<small style="font-size:.9rem;opacity:.7"> + devis</small>' : '');
    renderChips();
    if (state.step === 4) refreshOutputs();
  }

  /* ----------------------------- étapes ------------------------------ */
  var panels = $$('.wiz__panel'), stepLis = $$('#wizSteps li'), bar = $('#wizBar'), prevB = $('#wizPrev'), nextB = $('#wizNext');
  function go(n, scroll) {
    state.step = n;
    panels.forEach(function (p) { p.classList.toggle('is-on', +p.getAttribute('data-step') === n); });
    stepLis.forEach(function (li, i) { li.classList.toggle('is-on', i + 1 === n); li.classList.toggle('is-done', i + 1 < n); });
    bar.style.transform = 'scaleX(' + (n / 4) + ')';
    prevB.hidden = n === 1; nextB.hidden = n === 4;
    nextB.querySelector('.btn__t').textContent = n === 3 ? 'Voir mon message' : 'Continuer';
    if (n === 4) refreshOutputs();
    if (scroll !== false) {
      var top = $('.wiz__steps', form);
      if (window.CO && window.CO.scrollToEl) window.CO.scrollToEl(top, 120);
      else top.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
      var first = panels[n - 1].querySelector('legend'); if (first) { first.setAttribute('tabindex', '-1'); setTimeout(function () { first.focus({ preventScroll: true }); }, 60); }
    }
  }
  function validate(n) {
    if (n === 1) {
      if (!selectedSvc().length) { $('#err1').textContent = 'Choisis au moins une prestation pour continuer.'; return false; }
    } else if (n === 2) {
      if (!state.date && !state.flex) { $('#err2').textContent = 'Choisis un jour dans le calendrier (ou coche « flexible »).'; return false; }
      if (!state.win) { $('#err2').textContent = 'Choisis un créneau : matin, début d’après-midi ou fin d’après-midi.'; return false; }
    } else if (n === 3) {
      var e3 = $('#err3');
      if (fName.value.trim().length < 2) { e3.textContent = 'Indique ton prénom et ton nom.'; fName.focus(); return false; }
      if (!validTel(fTel.value)) { e3.textContent = 'Indique un numéro de téléphone français valide (ex. 06 12 34 56 78).'; fTel.focus(); return false; }
      if (!validMail(fMail.value.trim())) { e3.textContent = 'Cette adresse e-mail ne semble pas valide.'; fMail.focus(); return false; }
    }
    return true;
  }
  nextB.addEventListener('click', function () { if (validate(state.step)) go(state.step + 1); });
  prevB.addEventListener('click', function () { go(state.step - 1); });
  form.addEventListener('submit', function (e) { e.preventDefault(); if (state.step < 4 && validate(state.step)) go(state.step + 1); });
  stepLis.forEach(function (li, i) { li.addEventListener('click', function () { if (i + 1 < state.step) go(i + 1); }); });

  /* ----------------------- sorties : SMS / IG / mail ----------------- */
  var smsB = $('#sendSms'), igB = $('#sendIg'), mailB = $('#sendMail'), note = $('#okNote');
  function refreshOutputs() {
    var msg = message(false);
    $('#msgPreview').textContent = msg;
    smsB.href = 'sms:' + PHONE + '?&body=' + encodeURIComponent(msg);
    mailB.href = 'mailto:' + MAIL + '?subject=' + encodeURIComponent('Demande de rendez-vous – ' + fName.value.trim()) + '&body=' + encodeURIComponent(msg.replace(/\n/g, '\r\n'));
    drawQr();
    $('#dlIcs').disabled = !state.date;
    $('#dlIcs').style.opacity = state.date ? '' : '.45';
  }
  function copy(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) return navigator.clipboard.writeText(text);
    return new Promise(function (res, rej) {
      var ta = d.createElement('textarea'); ta.value = text; ta.setAttribute('readonly', ''); ta.style.cssText = 'position:fixed;opacity:0;top:0';
      d.body.appendChild(ta); ta.select();
      try { d.execCommand('copy') ? res() : rej(); } catch (e) { rej(e); } d.body.removeChild(ta);
    });
  }
  $('#copyMsg').addEventListener('click', function () {
    copy(message(false)).then(function () { note.textContent = 'Message copié ✓ Tu peux le coller où tu veux.'; }, function () { note.textContent = 'Copie impossible ici : sélectionne le texte du message ci-dessus et copie-le.'; });
  });
  igB.addEventListener('click', function () {
    copy(message(false)).then(function () { note.textContent = 'Message copié ✓ Colle-le dans la conversation Instagram avec Adeline.'; }, function () { note.textContent = 'Instagram s’ouvre : copie le message ci-dessus pour le coller dans la conversation.'; });
  });
  smsB.addEventListener('click', function () { note.textContent = 'Ton application SMS s’ouvre avec le message prêt. Sur ordinateur, scanne plutôt le code ci-dessous.'; });
  mailB.addEventListener('click', function () { note.textContent = 'Ton application e-mail s’ouvre avec le message prêt à envoyer.'; });

  /* QR code (ordinateur) : ouvre le SMS prêt à l’envoi sur le téléphone */
  var desktop = window.matchMedia('(hover: hover) and (pointer: fine) and (min-width: 901px)').matches;
  function drawQr() {
    var box = $('#qrBox'), img = $('#qrImg');
    if (!desktop || typeof window.qrcode !== 'function') { box.hidden = true; return; }
    try {
      window.qrcode.stringToBytes = window.qrcode.stringToBytesFuncs['UTF-8'];
      // message compact pour un QR facile à scanner
      var names = selectedSvc().map(function (i) { return i.getAttribute('data-name'); }).join(' + ');
      var txt = 'SMSTO:' + PHONE + ':Bonjour Adeline, je souhaite un RDV : ' + names + ' - ' + whenText() + '. ' + fName.value.trim() + ', ' + fTel.value.trim();
      var qr = window.qrcode(0, 'L'); qr.addData(txt); qr.make();
      img.innerHTML = qr.createSvgTag({ cellSize: 4, margin: 0, scalable: true });
      box.hidden = false;
    } catch (e) { box.hidden = true; }
  }

  /* fichier agenda (.ics) */
  function icsEsc(s) { return String(s).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n'); }
  function fold(line) { var out = [], l = line; while (l.length > 70) { out.push(l.slice(0, 70)); l = ' ' + l.slice(70); } out.push(l); return out.join('\r\n'); }
  $('#dlIcs').addEventListener('click', function () {
    var o = dateObj(); if (!o) { note.textContent = 'Choisis d’abord un jour à l’étape « Créneau » pour créer un rappel agenda.'; return; }
    var startH = state.win === 'matin' ? 9 : state.win === 'midi' ? 12 : 15;
    var st = new Date(o.getFullYear(), o.getMonth(), o.getDate(), startH, 0), en = new Date(o.getFullYear(), o.getMonth(), o.getDate(), startH + 2, 0);
    var f = function (dt) { return dt.getFullYear() + pad(dt.getMonth() + 1) + pad(dt.getDate()) + 'T' + pad(dt.getHours()) + pad(dt.getMinutes()) + '00'; };
    var stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
    var lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Couleurs d’ongles//Demande de rendez-vous//FR', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', 'BEGIN:VEVENT',
      'UID:' + Date.now() + '@couleursdongles', 'DTSTAMP:' + stamp, 'DTSTART:' + f(st), 'DTEND:' + f(en),
      'SUMMARY:' + icsEsc('Rendez-vous Couleurs d’ongles (à confirmer)'),
      'LOCATION:' + icsEsc('Couleurs d’ongles, 3 rue de l’Hubac, 04000 Digne-les-Bains'),
      'DESCRIPTION:' + icsEsc('Demande de rendez-vous à confirmer avec Adeline (' + PHONE_TXT + ').\n' + svcText() + '\nCréneau souhaité : ' + whenText()),
      'STATUS:TENTATIVE', 'BEGIN:VALARM', 'TRIGGER:-P1D', 'ACTION:DISPLAY', 'DESCRIPTION:Rendez-vous Couleurs d’ongles demain', 'END:VALARM', 'END:VEVENT', 'END:VCALENDAR'];
    var blob = new Blob([lines.map(fold).join('\r\n') + '\r\n'], { type: 'text/calendar;charset=utf-8' });
    var a = d.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'rdv-couleurs-dongles.ics'; d.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); d.body.removeChild(a); }, 500);
    note.textContent = 'Rappel agenda créé (provisoire) : pense à confirmer le créneau avec Adeline.';
  });

  /* init */
  renderCal(); render(); go(1, false);
})();
