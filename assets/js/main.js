/* Couleurs d’ongles — animations & interactions
   GSAP + ScrollTrigger + Lenis (tout en local, aucun service tiers).
   On n’anime que transform et opacity (sauf quelques masques clip-path ponctuels). */
(function () {
  'use strict';

  var d = document, root = d.documentElement, body = d.body;
  var $ = function (s, c) { return (c || d).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || d).querySelectorAll(s)); };
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  var hasG = !!(window.gsap && window.ScrollTrigger);
  var lenis = null;
  var anchorY = {}; // positions de départ des sections épinglées

  window.CO = window.CO || { colors: [] };

  /* ------------------------------------------------------------------ */
  /* Utilitaires                                                         */
  /* ------------------------------------------------------------------ */
  function lock() { body.classList.add('is-locked'); if (lenis) lenis.stop(); }
  function unlock() { body.classList.remove('is-locked'); if (lenis) lenis.start(); }

  /* Découpe un élément en mots ou en lettres (masque qui monte). */
  function splitText(el, mode) {
    var out = [];
    if (/^H[1-6]$/.test(el.tagName)) el.setAttribute('aria-label', el.textContent.replace(/\s+/g, ' ').trim());
    (function walk(node) {
      Array.prototype.slice.call(node.childNodes).forEach(function (n) {
        if (n.nodeType === 3) {
          var frag = d.createDocumentFragment();
          n.textContent.split(/(\s+)/).forEach(function (p) {
            if (!p) return;
            if (/^\s+$/.test(p)) { frag.appendChild(d.createTextNode(' ')); return; }
            var w = d.createElement('span'); w.className = 'w'; w.setAttribute('aria-hidden', 'true');
            if (mode === 'chars') {
              Array.prototype.slice.call(p).forEach(function (ch) {
                var c = d.createElement('span'); c.className = 'c'; c.textContent = ch; w.appendChild(c); out.push(c);
              });
            } else {
              var i = d.createElement('span'); i.className = 'i'; i.textContent = p; w.appendChild(i); out.push(i);
            }
            frag.appendChild(w);
          });
          node.replaceChild(frag, n);
        } else if (n.nodeType === 1 && !/^(BR|SVG|IMG)$/i.test(n.tagName)) { walk(n); }
      });
    })(el);
    return out;
  }

  /* Découpe en mots simples (sans masque) en laissant les « pills » intactes. */
  function splitWords(el) {
    var out = [];
    (function walk(node) {
      Array.prototype.slice.call(node.childNodes).forEach(function (n) {
        if (n.nodeType === 3) {
          var frag = d.createDocumentFragment();
          n.textContent.split(/(\s+)/).forEach(function (p) {
            if (!p) return;
            if (/^\s+$/.test(p)) { frag.appendChild(d.createTextNode(' ')); return; }
            var s = d.createElement('span'); s.className = 'mw'; s.textContent = p; out.push(s); frag.appendChild(s);
          });
          node.replaceChild(frag, n);
        } else if (n.nodeType === 1 && !n.classList.contains('pill')) { walk(n); }
      });
    })(el);
    return out;
  }

  window.CO.scrollToEl = function (el, off) {
    var y = el.getBoundingClientRect().top + window.pageYOffset - (off || 0);
    if (lenis) lenis.scrollTo(y, { duration: 1.1 }); else window.scrollTo({ top: y, behavior: reduce ? 'auto' : 'smooth' });
  };

  function scrollToTarget(sel) {
    var t = $(sel);
    if (!t && sel !== '#top') return;
    var y = anchorY[sel] ? anchorY[sel]() : (sel === '#top' ? 0 : t.getBoundingClientRect().top + window.pageYOffset);
    if (lenis) lenis.scrollTo(y, { duration: 1.6, easing: function (x) { return x === 1 ? 1 : 1 - Math.pow(2, -10 * x); } });
    else window.scrollTo({ top: y, behavior: reduce ? 'auto' : 'smooth' });
  }

  /* ------------------------------------------------------------------ */
  /* Fonctions indépendantes de GSAP                                     */
  /* ------------------------------------------------------------------ */
  function initBasics() {
    var y = $('#year'); if (y) y.textContent = new Date().getFullYear();

    // liens d’ancre
    d.addEventListener('click', function (e) {
      var a = e.target.closest && e.target.closest('a[href^="#"]');
      if (!a) return;
      var h = a.getAttribute('href');
      if (!h || h === '#') return;
      if (!$(h) && h !== '#top') return;
      e.preventDefault();
      if ($('#menu').classList.contains('is-open')) closeMenu(true);
      scrollToTarget(h);
      if (history.replaceState) history.replaceState(null, '', h);
    });

    // vidéo : pause hors écran / onglet masqué
    var v = $('#heroVideo');
    if (v) {
      if (reduce) { v.removeAttribute('autoplay'); v.pause(); }
      else {
        var p = v.play(); if (p && p.catch) p.catch(function () {});
        d.addEventListener('visibilitychange', function () { if (d.hidden) v.pause(); else if (!reduce && window.pageYOffset < window.innerHeight * 1.2) v.play().catch(function () {}); });
      }
    }

    // FAQ : un seul volet ouvert à la fois
    $$('.qa').forEach(function (qa) {
      qa.addEventListener('toggle', function () {
        if (qa.open) $$('.qa').forEach(function (o) { if (o !== qa) o.open = false; });
      });
    });

    openNow();
    initMenu();
    initNav();
    initNuancier();
    initLightbox();
    initReviews();
  }

  /* barre de nav, progression, dock mobile (écouteur de scroll natif) */
  function initNav() {
    var nav = $('#nav'), bar = $('.progress span'), dock = $('#dock'), book = $('#reservation');
    var last = window.pageYOffset, ticking = false;
    function frame() {
      ticking = false;
      var y = window.pageYOffset, max = Math.max(1, root.scrollHeight - window.innerHeight);
      bar.style.transform = 'scaleX(' + Math.min(1, y / max) + ')';
      nav.classList.toggle('is-solid', y > 80);
      if (!body.classList.contains('menu-open')) {
        if (y > 500 && y > last + 4) nav.classList.add('is-hidden');
        else if (y < last - 4 || y < 80) nav.classList.remove('is-hidden');
      }
      if (dock) {
        var inBook = false;
        if (book) { var r = book.getBoundingClientRect(); inBook = r.top < window.innerHeight * .6 && r.bottom > window.innerHeight * .2; }
        dock.classList.toggle('is-on', y > window.innerHeight * .75);
        dock.classList.toggle('is-hide', inBook);
      }
      last = y;
    }
    window.addEventListener('scroll', function () { if (!ticking) { ticking = true; requestAnimationFrame(frame); } }, { passive: true });
    frame();
  }

  /* menu plein écran (mobile) */
  var menu, burger;
  function openMenu() {
    menu.classList.add('is-open'); menu.setAttribute('aria-hidden', 'false');
    burger.setAttribute('aria-expanded', 'true'); burger.setAttribute('aria-label', 'Fermer le menu');
    body.classList.add('menu-open'); $('#nav').classList.remove('is-hidden'); lock();
    if (hasG && !reduce) gsap.fromTo('.menu__nav a', { yPercent: 110, opacity: 0 }, { yPercent: 0, opacity: 1, stagger: .06, duration: .9, ease: 'expo.out', delay: .25 });
    var first = $('.menu__nav a'); if (first) setTimeout(function () { first.focus({ preventScroll: true }); }, 350);
  }
  function closeMenu(silent) {
    menu.classList.remove('is-open'); menu.setAttribute('aria-hidden', 'true');
    burger.setAttribute('aria-expanded', 'false'); burger.setAttribute('aria-label', 'Ouvrir le menu');
    body.classList.remove('menu-open'); unlock();
    if (!silent) burger.focus({ preventScroll: true });
  }
  function initMenu() {
    menu = $('#menu'); burger = $('#burger');
    if (!menu || !burger) return;
    burger.addEventListener('click', function () { if (menu.classList.contains('is-open')) closeMenu(); else openMenu(); });
    d.addEventListener('keydown', function (e) { if (e.key === 'Escape' && menu.classList.contains('is-open')) closeMenu(); });
    window.addEventListener('resize', function () { if (window.innerWidth > 900 && menu.classList.contains('is-open')) closeMenu(true); });
  }

  /* horaires : ouvert / fermé (heure de Paris) */
  function openNow() {
    var badge = $('#openNow'); if (!badge) return;
    var map = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 0 };
    var names = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
    var dow, hh, mm;
    try {
      var parts = new Intl.DateTimeFormat('en-US', { timeZone: 'Europe/Paris', weekday: 'short', hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(new Date());
      parts.forEach(function (p) {
        if (p.type === 'weekday') dow = map[p.value];
        if (p.type === 'hour') hh = parseInt(p.value, 10) % 24;
        if (p.type === 'minute') mm = parseInt(p.value, 10);
      });
    } catch (e) { var n = new Date(); dow = n.getDay(); hh = n.getHours(); mm = n.getMinutes(); }
    var mins = hh * 60 + mm, isWeek = dow >= 1 && dow <= 5, open = isWeek && mins >= 540 && mins < 1140;
    var txt;
    if (open) txt = 'Ouvert maintenant · jusqu’à 19h';
    else {
      var label;
      if (isWeek && mins < 540) label = 'aujourd’hui';
      else {
        var nd = dow, add = 0;
        do { nd = (nd + 1) % 7; add++; } while (nd === 0 || nd === 6);
        label = add === 1 ? 'demain' : names[nd];
      }
      txt = 'Fermé · ouvre ' + label + ' à 9h';
    }
    badge.classList.toggle('is-open', open);
    badge.querySelector('span').textContent = txt;
    var row = $('#hoursBody tr[data-d="' + dow + '"]'); if (row) row.classList.add('today');
  }

  /* ----------------------------- Nuancier ----------------------------- */
  function initNuancier() {
    var list = $('#swatches'); if (!list) return;
    var SW = [
      { n: 'Lait d’amande', c: '#F3E1D6', d: 'Un nude laiteux, doux et lumineux, qui va avec tout.' },
      { n: 'Poudre de rose', c: '#EBC2BC', d: 'Le rose qui a l’air d’être né sur tes ongles.' },
      { n: 'Rose ballerine', c: '#E9A6B5', d: 'Tendre et romantique, magnifique en baby boomer.' },
      { n: 'Fuchsia éclat', c: '#D61F77', d: 'Pour les jours où l’on veut que les mains se remarquent.' },
      { n: 'Cerise noire', c: '#B3122D', d: 'Un rouge profond, intemporel, ultra brillant.' },
      { n: 'Bordeaux velours', c: '#6A1626', d: 'Le bordeaux de la saison : chic et chaleureux.' },
      { n: 'Chocolat', c: '#4A2A22', d: 'Un brun gourmand qui flatte toutes les carnations.' },
      { n: 'Noir laqué', c: '#17110F', d: 'Effet miroir, contraste net, élégance totale.' },
      { n: 'Pêche solaire', c: '#F5B995', d: 'Une pêche lumineuse, comme un coucher de soleil d’été.' },
      { n: 'Lavande', c: '#B9A5E6', d: 'Un lilas poudré, tendre et très photogénique.' },
      { n: 'Vert sauge', c: '#9DB89A', d: 'Un vert apaisant, naturel et sophistiqué.' },
      { n: 'Bleu glacier', c: '#8EC9E8', d: 'Frais et lumineux, idéal pour l’été.' }
    ];
    var nails = $$('#hand .nail'), nameEl = $('#swName'), descEl = $('#swDesc'), addBtn = $('#swAdd'), picked = $('#swPicked');
    var cur = 0, btns = [];
    SW.forEach(function (s, i) {
      var li = d.createElement('li'); li.setAttribute('role', 'presentation');
      var b = d.createElement('button'); b.type = 'button'; b.className = 'sw'; b.setAttribute('role', 'option');
      b.setAttribute('aria-selected', i === 0 ? 'true' : 'false'); b.style.setProperty('--c', s.c); b.setAttribute('aria-label', s.n);
      b.innerHTML = '<span class="sw__d"></span><span class="sw__l">' + s.n + '</span>';
      b.addEventListener('click', function () { select(i); });
      b.addEventListener('mouseenter', function () { if (fine) select(i, true); });
      li.appendChild(b); list.appendChild(li); btns.push(b);
    });
    function isPicked(i) { return window.CO.colors.some(function (c) { return c.n === SW[i].n; }); }
    function select(i, soft) {
      cur = i;
      btns.forEach(function (b, k) { b.setAttribute('aria-selected', k === i ? 'true' : 'false'); });
      nails.forEach(function (n, k) {
        n.style.setProperty('--c', SW[i].c);
        n.classList.remove('is-shine'); void n.offsetWidth;
        setTimeout(function () { n.classList.add('is-shine'); }, k * 70);
      });
      nameEl.textContent = SW[i].n; descEl.textContent = SW[i].d;
      refreshBtn();
    }
    function refreshBtn() {
      var on = isPicked(cur);
      addBtn.querySelector('.btn__t').textContent = on ? 'Retirer de ma demande' : 'Ajouter à ma demande';
      btns.forEach(function (b, k) { b.classList.toggle('is-picked', isPicked(k)); });
      var n = window.CO.colors.length;
      picked.textContent = n ? 'Dans ta demande : ' + window.CO.colors.map(function (c) { return c.n; }).join(', ') + '.' : '';
    }
    addBtn.addEventListener('click', function () {
      var i = SW.findIndex(function (s) { return s.n === SW[cur].n; });
      var idx = window.CO.colors.findIndex(function (c) { return c.n === SW[i].n; });
      if (idx >= 0) window.CO.colors.splice(idx, 1);
      else { if (window.CO.colors.length >= 3) window.CO.colors.shift(); window.CO.colors.push({ n: SW[i].n, c: SW[i].c }); }
      refreshBtn();
      d.dispatchEvent(new CustomEvent('co:colors', { detail: window.CO.colors.slice() }));
    });
    d.addEventListener('co:colors-sync', refreshBtn);
    select(0);
  }

  /* ------------------------------ Lightbox ---------------------------- */
  function initLightbox() {
    var box = $('#lb'); if (!box) return;
    var items = $$('#galleryGrid .g button');
    var img = $('#lbImg'), cap = $('#lbCap'), idx = 0, opener = null;
    function show(i) {
      idx = (i + items.length) % items.length;
      var im = items[idx].querySelector('img'), fc = items[idx].querySelector('figcaption');
      img.src = im.currentSrc || im.src; img.alt = im.alt; cap.textContent = fc ? fc.textContent : '';
    }
    function open(i, btn) {
      opener = btn; show(i); box.hidden = false; lock();
      setTimeout(function () { $('#lbClose').focus(); }, 30);
      if (hasG && !reduce) gsap.fromTo(box, { opacity: 0 }, { opacity: 1, duration: .4, ease: 'power2.out' });
    }
    function close() { box.hidden = true; unlock(); if (opener) opener.focus({ preventScroll: true }); }
    items.forEach(function (b, i) { b.addEventListener('click', function () { open(i, b); }); });
    $('#lbClose').addEventListener('click', close);
    $('#lbPrev').addEventListener('click', function () { show(idx - 1); });
    $('#lbNext').addEventListener('click', function () { show(idx + 1); });
    box.addEventListener('click', function (e) { if (e.target === box) close(); });
    d.addEventListener('keydown', function (e) {
      if (box.hidden) return;
      if (e.key === 'Escape') close();
      else if (e.key === 'ArrowLeft') show(idx - 1);
      else if (e.key === 'ArrowRight') show(idx + 1);
      else if (e.key === 'Tab') {
        var f = [$('#lbPrev'), $('#lbNext'), $('#lbClose')].filter(Boolean), a = d.activeElement, k = f.indexOf(a);
        if (e.shiftKey && k <= 0) { e.preventDefault(); f[f.length - 1].focus(); }
        else if (!e.shiftKey && (k === f.length - 1 || k < 0)) { e.preventDefault(); f[0].focus(); }
      }
    });
  }

  /* ------------------------------- Avis ------------------------------- */
  function initReviews() {
    var vp = $('#revViewport'), line = $('#revLine'); if (!vp) return;
    var prev = $('#revPrev'), next = $('#revNext'), timer = null, hover = false, drag = null;
    function step() { var c = vp.querySelector('.rev'); return c ? c.getBoundingClientRect().width + 16 : 400; }
    function move(dir) {
      var max = vp.scrollWidth - vp.clientWidth;
      if (dir > 0 && vp.scrollLeft >= max - 8) vp.scrollTo({ left: 0, behavior: reduce ? 'auto' : 'smooth' });
      else vp.scrollBy({ left: dir * step(), behavior: reduce ? 'auto' : 'smooth' });
    }
    function upd() { var max = vp.scrollWidth - vp.clientWidth; var p = max > 0 ? vp.scrollLeft / max : 1; line.style.transform = 'scaleX(' + (0.08 + p * .92) + ')'; }
    prev.addEventListener('click', function () { move(-1); });
    next.addEventListener('click', function () { move(1); });
    vp.addEventListener('scroll', upd, { passive: true }); upd();
    vp.addEventListener('keydown', function (e) { if (e.key === 'ArrowRight') { e.preventDefault(); move(1); } if (e.key === 'ArrowLeft') { e.preventDefault(); move(-1); } });
    // glisser à la souris
    if (fine) {
      vp.addEventListener('pointerdown', function (e) { if (e.pointerType !== 'mouse') return; drag = { x: e.clientX, l: vp.scrollLeft, moved: false }; });
      window.addEventListener('pointermove', function (e) {
        if (!drag) return; var dx = e.clientX - drag.x;
        if (Math.abs(dx) > 4) { drag.moved = true; vp.style.scrollSnapType = 'none'; vp.style.cursor = 'grabbing'; }
        if (drag.moved) vp.scrollLeft = drag.l - dx;
      });
      window.addEventListener('pointerup', function () { if (!drag) return; drag = null; vp.style.scrollSnapType = ''; vp.style.cursor = ''; });
    }
    // lecture automatique douce
    if (!reduce) {
      var vis = false;
      new IntersectionObserver(function (en) { vis = en[0].isIntersecting; }, { threshold: .35 }).observe(vp);
      vp.addEventListener('mouseenter', function () { hover = true; }); vp.addEventListener('mouseleave', function () { hover = false; });
      vp.addEventListener('focusin', function () { hover = true; }); vp.addEventListener('focusout', function () { hover = false; });
      timer = setInterval(function () { if (vis && !hover && !d.hidden && !drag) move(1); }, 5200);
    }
  }

  /* ------------------------------------------------------------------ */
  /* Animations (GSAP)                                                   */
  /* ------------------------------------------------------------------ */
  function setupScroll() {
    gsap.registerPlugin(ScrollTrigger);
    ScrollTrigger.config({ ignoreMobileResize: true });
    if (reduce || !window.Lenis) return;
    lenis = new Lenis({
      duration: 1.15,
      easing: function (t) { return Math.min(1, 1.001 - Math.pow(2, -10 * t)); },
      smoothWheel: true, wheelMultiplier: .95, touchMultiplier: 1.3
    });
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add(function (t) { lenis.raf(t * 1000); });
    gsap.ticker.lagSmoothing(0);
    lenis.stop();
  }

  var heroChars = [], loaderChars = [];

  function prepare() {
    // loader
    var lw = $$('.loader__brand .lw');
    lw.forEach(function (n) { loaderChars = loaderChars.concat(splitText(n, 'chars')); });
    gsap.set($('.loader__fill'), { yPercent: 100 });
    gsap.set(loaderChars, { yPercent: 115 });
    gsap.set('.loader__top span, .loader__bottom span', { y: 16, opacity: 0 });

    // hero
    heroChars = splitText($('.hero__title .hl:first-child .hl__in'), 'chars').concat(splitText($('.hero__title .hl--it .hl__in'), 'chars'));
    gsap.set(heroChars, { yPercent: 118 });
    gsap.set('.hero__eyebrow', { y: 24, opacity: 0 });
    gsap.set('.hero__lead, .hero__ctas .btn', { y: 34, opacity: 0 });
    gsap.set('.hero__badge', { y: -20, opacity: 0 });
    gsap.set('.float', { y: 90, opacity: 0, scale: .86 });
    gsap.set('.hero__sticker', { scale: 0, rotation: -40 });
    gsap.set('.hero__scroll', { opacity: 0 });
    $('#nav').classList.add('no-t');
    gsap.set('.nav', { yPercent: -120 });
    gsap.set('#heroVideo', { scale: 1.3 });
  }

  function heroIn() {
    var tl = gsap.timeline({ defaults: { ease: 'expo.out' } });
    tl.to('#heroVideo', { scale: 1.02, duration: 2.8, ease: 'power3.out' }, 0)
      .to(heroChars, { yPercent: 0, duration: 1.5, stagger: .045 }, .05)
      .to('.hero__eyebrow', { y: 0, opacity: 1, duration: 1.1 }, .25)
      .to('.hero__lead, .hero__ctas .btn', { y: 0, opacity: 1, duration: 1.2, stagger: .1 }, .65)
      .to('.float', { y: 0, opacity: 1, scale: 1, duration: 1.5, stagger: .14 }, .5)
      .to('.hero__badge', { y: 0, opacity: 1, duration: 1 }, .9)
      .to('.hero__sticker', { scale: 1, rotation: 0, duration: 1.4, ease: 'elastic.out(1,.6)' }, 1)
      .to('.hero__scroll', { opacity: 1, duration: 1 }, 1.4)
      .to('.nav', { yPercent: 0, duration: 1.1, onComplete: function () { var n = $('#nav'); gsap.set(n, { clearProps: 'transform' }); n.classList.remove('no-t'); } }, .8);
  }

  function intro() {
    var loader = $('#loader'), done = false;
    var num = $('#loaderNum'), fill = $('.loader__fill');
    function finish() {
      loader.style.display = 'none'; root.classList.add('is-ready'); unlock();
      ScrollTrigger.refresh();
    }
    if (reduce) { // pas de mise en scène : tout apparaît
      gsap.set(heroChars, { yPercent: 0 });
      gsap.set('.hero__eyebrow, .hero__lead, .hero__ctas .btn, .hero__badge, .float, .hero__scroll', { clearProps: 'all' });
      gsap.set('.hero__sticker, .nav, #heroVideo', { clearProps: 'all' });
      $('#nav').classList.remove('no-t');
      finish(); return;
    }
    lock();
    var counter = { v: 0 };
    var tl = gsap.timeline();
    tl.to(loaderChars, { yPercent: 0, duration: 1, stagger: .04, ease: 'expo.out' }, 0)
      .to('.loader__top span, .loader__bottom span', { y: 0, opacity: 1, duration: .8, stagger: .06, ease: 'power3.out' }, .1)
      .to(fill, { yPercent: 0, duration: 1.9, ease: 'power2.inOut' }, .2)
      .to(counter, { v: 100, duration: 1.9, ease: 'power2.inOut', onUpdate: function () { num.textContent = Math.round(counter.v); } }, .2);
    var minDone = new Promise(function (res) { tl.eventCallback('onComplete', res); });
    var vid = $('#heroVideo');
    var vidReady = new Promise(function (res) {
      if (!vid || vid.readyState >= 3) return res();
      vid.addEventListener('canplay', res, { once: true }); vid.addEventListener('error', res, { once: true }); setTimeout(res, 2600);
    });
    var fontsReady = (d.fonts && d.fonts.ready) ? d.fonts.ready : Promise.resolve();
    function exit() {
      if (done) return; done = true; tl.progress(1); num.textContent = '100';
      var ex = gsap.timeline({ onComplete: finish });
      ex.to('.loader__nail', { scale: 1.14, duration: .35, ease: 'power2.out' })
        .to('.loader__brand, .loader__nail, .loader__top, .loader__bottom, .loader__count', { y: -40, opacity: 0, duration: .55, ease: 'power3.in', stagger: .04 }, '>-.05')
        .to('.loader__panel', { yPercent: -100, duration: 1.2, ease: 'expo.inOut' }, '>-.1')
        .to('.loader__wipe', { yPercent: -100, duration: 1.2, ease: 'expo.inOut' }, '<.13')
        .add(heroIn, '<.4');
    }
    Promise.all([minDone, vidReady, fontsReady]).then(exit);
    setTimeout(exit, 7000); // garde-fou : la page ne reste jamais bloquée
  }

  function hero() {
    var h = $('.hero');
    gsap.to('.hero__media', { yPercent: 14, ease: 'none', scrollTrigger: { trigger: h, start: 'top top', end: 'bottom top', scrub: true } });
    gsap.to('.hero__shade', { opacity: .55, ease: 'none', scrollTrigger: { trigger: h, start: 'top top', end: 'bottom top', scrub: true } });
    gsap.to('.hero__content', { yPercent: -16, ease: 'none', scrollTrigger: { trigger: h, start: 'top top', end: 'bottom top', scrub: true } });
    gsap.to('.hero__glow', { yPercent: 60, xPercent: -25, ease: 'none', scrollTrigger: { trigger: h, start: 'top top', end: 'bottom top', scrub: true } });
    $$('.float').forEach(function (f) {
      var depth = parseFloat(f.getAttribute('data-depth')) || 1;
      gsap.to(f.querySelector('.float__in'), { yPercent: -22 * depth, ease: 'none', scrollTrigger: { trigger: h, start: 'top top', end: 'bottom top', scrub: true } });
    });
    ScrollTrigger.create({ trigger: h, start: 'top top', end: 'bottom top', onToggle: function (s) { var v = $('#heroVideo'); if (!v || reduce) return; if (s.isActive) v.play().catch(function () {}); else v.pause(); } });
    // parallax souris (bureau)
    if (fine) {
      var fl = $$('.float');
      var qs = fl.map(function (f) { return { x: gsap.quickTo(f, 'x', { duration: 1.2, ease: 'power3.out' }), y: gsap.quickTo(f, 'y', { duration: 1.2, ease: 'power3.out' }), k: parseFloat(f.getAttribute('data-depth')) || 1 }; });
      h.addEventListener('pointermove', function (e) {
        if (!root.classList.contains('is-ready')) return;
        var nx = e.clientX / window.innerWidth - .5, ny = e.clientY / window.innerHeight - .5;
        qs.forEach(function (q) { q.x(-nx * 46 * q.k); q.y(-ny * 36 * q.k); });
      });
    }
  }

  function marquee() {
    var rows = $$('.marquee__row'), tweens = [];
    rows.forEach(function (row) {
      var list = $('.marquee__list', row), clone = list.cloneNode(true);
      clone.setAttribute('aria-hidden', 'true'); row.appendChild(clone);
      var dir = parseInt(row.getAttribute('data-dir'), 10) || 1;
      tweens.push(dir > 0
        ? gsap.to(row, { xPercent: -50, duration: 46, ease: 'none', repeat: -1 })
        : gsap.fromTo(row, { xPercent: -50 }, { xPercent: 0, duration: 54, ease: 'none', repeat: -1 }));
    });
    var st = ScrollTrigger.create({ start: 0, end: 'max' }), dir = 1, ts = 1;
    ScrollTrigger.create({ start: 0, end: 'max', onUpdate: function (self) { if (self.direction) dir = self.direction; } });
    gsap.ticker.add(function () {
      var v = Math.abs(st.getVelocity ? st.getVelocity() : 0);
      var target = dir * (1 + Math.min(v / 280, 8));
      ts += (target - ts) * .07;
      for (var i = 0; i < tweens.length; i++) tweens[i].timeScale(ts);
    });
  }

  function manifest() {
    var p = $('#manifestText'); if (!p) return;
    var words = splitWords(p);
    gsap.fromTo(words, { opacity: .14 }, { opacity: 1, ease: 'none', stagger: .12, duration: 1, scrollTrigger: { trigger: p, start: 'top 82%', end: 'bottom 58%', scrub: true } });
    $$('.pill', p).forEach(function (pill) {
      gsap.fromTo(pill, { scaleX: .15, opacity: 0, transformOrigin: '0% 50%' }, { scaleX: 1, opacity: 1, ease: 'power2.out', scrollTrigger: { trigger: pill, start: 'top 88%', end: 'top 60%', scrub: true } });
      gsap.fromTo(pill.querySelector('img'), { scale: 1.5 }, { scale: 1.05, ease: 'none', scrollTrigger: { trigger: pill, start: 'top 90%', end: 'bottom 20%', scrub: true } });
    });
  }

  function reveals() {
    // fondus génériques
    $$('[data-reveal]').forEach(function (el) {
      gsap.fromTo(el, { y: 36, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 1.1, ease: 'power3.out', scrollTrigger: { trigger: el, start: 'top 90%', once: true } });
    });
    // titres : mot par mot, masque qui monte
    $$('h2.split').forEach(function (h) {
      var words = splitText(h, 'words');
      gsap.from(words, { yPercent: 118, duration: 1.3, stagger: .07, ease: 'expo.out', scrollTrigger: { trigger: h, start: 'top 88%', once: true } });
    });
    // pied de page : lettres géantes
    var fb = $('.foot__big');
    if (fb) {
      var ch = splitText($('.fl:first-child .fl__in', fb), 'chars').concat(splitText($('.fl--it .fl__in', fb), 'chars'));
      fb.removeAttribute('aria-hidden');
      gsap.from(ch, { yPercent: 118, duration: 1.5, stagger: .045, ease: 'expo.out', scrollTrigger: { trigger: fb, start: 'top 92%', once: true } });
    }
    // galerie : rideau + parallax interne + inclinaison 3D
    var gs = $$('.g');
    if (gs.length) {
      gs.forEach(function (g) {
        var ph = $('.g__ph', g), im = $('img', g);
        gsap.set(ph, { clipPath: 'inset(100% 0% 0% 0%)' });
        gsap.set(im, { scale: 1.16 });
        if (!reduce) gsap.fromTo(im, { yPercent: -5 }, { yPercent: 5, ease: 'none', scrollTrigger: { trigger: g, start: 'top bottom', end: 'bottom top', scrub: true } });
        if (fine) {
          var b = $('button', g);
          b.addEventListener('pointermove', function (e) {
            var r = b.getBoundingClientRect(), nx = (e.clientX - r.left) / r.width - .5, ny = (e.clientY - r.top) / r.height - .5;
            gsap.to(ph, { rotationY: nx * 12, rotationX: -ny * 10, transformPerspective: 900, duration: .7, ease: 'power3.out', overwrite: 'auto' });
          });
          b.addEventListener('pointerenter', function () { gsap.to(im, { scale: 1.26, duration: 1.1, ease: 'power3.out', overwrite: 'auto' }); });
          b.addEventListener('pointerleave', function () { gsap.to(ph, { rotationY: 0, rotationX: 0, duration: 1, ease: 'elastic.out(1,.5)', overwrite: 'auto' }); gsap.to(im, { scale: 1.16, duration: 1, ease: 'power3.out', overwrite: 'auto' }); });
        }
      });
      ScrollTrigger.batch(gs, {
        start: 'top 94%', once: true,
        onEnter: function (batch) {
          gsap.to(batch.map(function (g) { return $('.g__ph', g); }), { clipPath: 'inset(0% 0% 0% 0%)', duration: 1.4, ease: 'expo.out', stagger: .09, clearProps: 'clipPath' });
        }
      });
    }
  }

  function counters() {
    $$('.count').forEach(function (el) {
      var to = parseFloat(el.getAttribute('data-to')), dec = parseInt(el.getAttribute('data-dec') || '0', 10), sep = el.getAttribute('data-sep');
      function fmt(v) {
        if (sep) return Math.round(v).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
        return v.toFixed(dec).replace('.', ',');
      }
      el.textContent = fmt(0);
      var o = { v: 0 };
      gsap.to(o, { v: to, duration: 2.6, ease: 'power3.out', onUpdate: function () { el.textContent = fmt(o.v); }, scrollTrigger: { trigger: el, start: 'top 88%', once: true } });
    });
    gsap.from('.stats__grid li', { y: 60, opacity: 0, duration: 1.2, stagger: .12, ease: 'power3.out', scrollTrigger: { trigger: '.stats__grid', start: 'top 88%', once: true } });
  }

  function interactions() {
    if (!fine || reduce) return;
    // boutons magnétiques
    $$('[data-magnetic]').forEach(function (el) {
      var t = el.querySelector('.btn__t');
      el.addEventListener('pointermove', function (e) {
        var r = el.getBoundingClientRect(), x = e.clientX - (r.left + r.width / 2), y = e.clientY - (r.top + r.height / 2);
        gsap.to(el, { x: x * .28, y: y * .4, duration: .5, ease: 'power3.out', overwrite: 'auto' });
        if (t) gsap.to(t, { x: x * .1, y: y * .16, duration: .5, ease: 'power3.out', overwrite: 'auto' });
      });
      el.addEventListener('pointerleave', function () {
        gsap.to(el, { x: 0, y: 0, duration: 1, ease: 'elastic.out(1,.4)', overwrite: 'auto' });
        if (t) gsap.to(t, { x: 0, y: 0, duration: 1, ease: 'elastic.out(1,.4)', overwrite: 'auto' });
      });
    });
    // cartes inclinables + reflet qui suit la souris
    $$('[data-tilt]').forEach(function (c) {
      var gl = c.querySelector('.glare');
      c.addEventListener('pointermove', function (e) {
        var r = c.getBoundingClientRect(), nx = (e.clientX - r.left) / r.width - .5, ny = (e.clientY - r.top) / r.height - .5;
        gsap.to(c, { rotationY: nx * 12, rotationX: -ny * 9, transformPerspective: 1000, duration: .6, ease: 'power3.out', overwrite: 'auto' });
        if (gl) gsap.to(gl, { x: e.clientX - r.left - gl.offsetWidth / 2, y: e.clientY - r.top - gl.offsetHeight / 2, duration: .4, ease: 'power3.out', overwrite: 'auto' });
      });
      c.addEventListener('pointerleave', function () { gsap.to(c, { rotationY: 0, rotationX: 0, duration: 1, ease: 'elastic.out(1,.5)', overwrite: 'auto' }); });
    });
    // curseur
    var cur = $('.cursor'), lab = $('.cursor__label'); if (!cur) return;
    var qx = gsap.quickTo(cur, 'x', { duration: .45, ease: 'power3.out' }), qy = gsap.quickTo(cur, 'y', { duration: .45, ease: 'power3.out' });
    window.addEventListener('pointermove', function (e) {
      cur.classList.add('is-on'); qx(e.clientX); qy(e.clientY);
      var t = e.target.closest ? e.target.closest('[data-cursor], a, button, summary, label, input, textarea') : null;
      var txt = t && t.getAttribute('data-cursor');
      cur.classList.toggle('is-label', !!txt); if (txt) lab.textContent = txt;
      cur.classList.toggle('is-link', !!t && !txt);
    }, { passive: true });
    d.addEventListener('pointerleave', function () { cur.classList.remove('is-on'); });
  }

  /* Sections épinglées / défilement horizontal : bureau + mouvement autorisé */
  function pins() {
    var mm = gsap.matchMedia();
    mm.add('(min-width: 901px) and (min-height: 560px) and (prefers-reduced-motion: no-preference)', function () {
      /* --- L’atelier : storytelling épinglé --- */
      var story = $('#atelier'), stage = $('.story__stage', story), steps = $$('.step', story), dots = $$('.story__dots i', story);
      story.classList.add('is-pinned');
      steps.forEach(function (s, i) {
        s.style.zIndex = i + 1;
        if (i > 0) {
          gsap.set($('.step__img', s), { clipPath: 'circle(0% at 82% 100%)' });
          gsap.set($('.step__text', s), { autoAlpha: 0, y: 60 });
        }
      });
      var tl = gsap.timeline({
        defaults: { ease: 'none' },
        scrollTrigger: {
          trigger: story, start: 'top top', end: '+=330%', pin: stage, scrub: .7, anticipatePin: 1, invalidateOnRefresh: true,
          onUpdate: function (self) {
            var idx = Math.min(steps.length - 1, Math.round(self.progress * (steps.length - 1)));
            dots.forEach(function (dt, k) { dt.classList.toggle('is-on', k === idx); });
          }
        }
      });
      steps.forEach(function (s, i) {
        if (!i) return; var t = i - 1;
        tl.to($('.step__text', steps[i - 1]), { autoAlpha: 0, y: -50, duration: .35 }, t + .05)
          .to($('.step__img', s), { clipPath: 'circle(150% at 82% 100%)', duration: .85 }, t + .1)
          .fromTo($('.step__img img', s), { scale: 1.4 }, { scale: 1, duration: .95 }, t + .1)
          .to($('.step__text', s), { autoAlpha: 1, y: 0, duration: .4 }, t + .5);
      });
      tl.to({}, { duration: .3 });
      if (dots[0]) dots[0].classList.add('is-on');
      anchorY['#atelier'] = function () { return tl.scrollTrigger.start; };
      // légère respiration (Ken Burns) sur la première photo
      gsap.fromTo($('.step__img img', steps[0]), { scale: 1.12 }, { scale: 1, ease: 'none', scrollTrigger: { trigger: story, start: 'top bottom', end: 'top top', scrub: true } });

      /* --- Prestations : défilement horizontal piloté par le scroll vertical --- */
      var hs = $('#prestations'), track = $('.hs__track', hs), bar = $('.hs__bar span', hs);
      hs.classList.add('is-hscroll');
      function dist() { return Math.max(0, track.scrollWidth - window.innerWidth); }
      var tw = gsap.to(track, {
        x: function () { return -dist(); }, ease: 'none',
        scrollTrigger: {
          trigger: hs, start: 'top top', end: function () { return '+=' + dist(); }, pin: true, scrub: .8, anticipatePin: 1, invalidateOnRefresh: true,
          onUpdate: function (self) { bar.style.transform = 'scaleX(' + self.progress + ')'; }
        }
      });
      $$('.hcard__media img', track).forEach(function (im) {
        gsap.fromTo(im, { xPercent: -9 }, { xPercent: 9, ease: 'none', scrollTrigger: { trigger: im.closest('.hcard'), containerAnimation: tw, start: 'left right', end: 'right left', scrub: true } });
      });
      anchorY['#prestations'] = function () { return tw.scrollTrigger.start; };

      return function () { story.classList.remove('is-pinned'); hs.classList.remove('is-hscroll'); delete anchorY['#atelier']; delete anchorY['#prestations']; };
    });
    // mobile : disposition simple (gérée en CSS), apparition douce des étapes
    mm.add('(max-width: 900px) and (prefers-reduced-motion: no-preference)', function () {
      $$('.step').forEach(function (s) {
        gsap.from(s.children, { y: 40, opacity: 0, duration: 1, stagger: .12, ease: 'power3.out', scrollTrigger: { trigger: s, start: 'top 85%', once: true } });
      });
    });
  }

  function boot() {
    initBasics();
    if (!hasG) { root.classList.add('fail'); $('#loader') && ($('#loader').style.display = 'none'); window.__coReady = true; return; }
    setupScroll();
    prepare();
    if (!reduce) { hero(); marquee(); manifest(); }
    pins();
    if (!reduce) { counters(); reveals(); }
    interactions();
    ScrollTrigger.sort();
    intro();
    window.addEventListener('load', function () { ScrollTrigger.refresh(); });
    if (d.fonts && d.fonts.ready) d.fonts.ready.then(function () { ScrollTrigger.refresh(); });
    window.__coReady = true;
  }

  try { boot(); } catch (err) {
    if (window.console) console.error('[Couleurs d’ongles]', err);
    root.classList.add('fail'); var l = $('#loader'); if (l) l.style.display = 'none'; unlock(); window.__coReady = true;
  }
})();
