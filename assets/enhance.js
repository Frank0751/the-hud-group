/* Shared enhancements for the main site pages (everything except apply.html).
   Scroll progress, nav shadow, mobile menu fallback, staggered reveals, animated counters, offline support.
   Every feature is optional: if this file fails to load, the pages still work. */
(function () {
  'use strict';
  var doc = document, root = doc.documentElement;
  var calm = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- scroll progress + nav shadow ---------- */
  var nav = doc.querySelector('.nav');
  var bar = doc.createElement('div');
  bar.className = 'scroll-progress'; bar.setAttribute('aria-hidden', 'true');
  doc.body.insertBefore(bar, doc.body.firstChild);
  var cssProgress = window.CSS && CSS.supports && CSS.supports('animation-timeline: scroll()');
  var ticking = false;
  function onScroll() {
    if (nav) { nav.classList.toggle('is-scrolled', window.scrollY > 12); }
    if (!cssProgress) {
      var max = root.scrollHeight - window.innerHeight;
      bar.style.transform = 'scaleX(' + (max > 0 ? Math.min(1, window.scrollY / max) : 0) + ')';
    }
    ticking = false;
  }
  window.addEventListener('scroll', function () { if (!ticking) { ticking = true; window.requestAnimationFrame(onScroll); } }, { passive: true });
  onScroll();

  /* ---------- mobile menu, only on pages that do not ship their own ---------- */
  var links = doc.querySelector('.nav-links');
  if (nav && links && !doc.querySelector('.nav-hamburger')) {
    var ham = doc.createElement('button');
    ham.className = 'nav-hamburger'; ham.type = 'button';
    ham.setAttribute('aria-label', 'Menu'); ham.setAttribute('aria-expanded', 'false');
    ham.innerHTML = '<span></span><span></span><span></span>';
    nav.appendChild(ham);
    var setOpen = function (open) { links.classList.toggle('open', open); ham.classList.toggle('active', open); ham.setAttribute('aria-expanded', String(open)); };
    ham.addEventListener('click', function () { setOpen(!links.classList.contains('open')); });
    doc.addEventListener('click', function (e) { if (!nav.contains(e.target)) { setOpen(false); } });
    links.addEventListener('click', function (e) { if (e.target.closest('a')) { setOpen(false); } });
    doc.addEventListener('keydown', function (e) { if (e.key === 'Escape') { setOpen(false); } });
  }

  if (!('IntersectionObserver' in window)) { register(); return; }

  /* ---------- staggered reveals: siblings that animate in arrive one after another ---------- */
  if (!calm) {
    var groups = [];
    Array.prototype.forEach.call(doc.querySelectorAll('.animate-on-scroll'), function (el) {
      var parent = el.parentElement; if (!parent) { return; }
      if (groups.indexOf(parent) === -1) { groups.push(parent); }
    });
    groups.forEach(function (parent) {
      var kids = Array.prototype.filter.call(parent.children, function (c) { return c.classList.contains('animate-on-scroll'); });
      if (kids.length < 2) { return; }
      kids.forEach(function (el, i) {
        el.style.transitionDelay = Math.min(i, 8) * 70 + 'ms';
        var io = new IntersectionObserver(function (entries) {
          if (entries[0].isIntersecting) { io.disconnect(); window.setTimeout(function () { el.style.transitionDelay = ''; }, 1400); }
        }, { threshold: 0.05 });
        io.observe(el);
      });
    });
  }

  /* ---------- animated counters for plain statistics such as "30" or "500+" ---------- */
  if (!calm) {
    var counters = Array.prototype.filter.call(doc.querySelectorAll('[class*="num"], [class*="stat"]'), function (el) {
      // pages that already animate a number mark it with data-count: leave those alone
      return el.children.length === 0 && !el.hasAttribute('data-count') && /^[1-9]\d{0,3}\+?$/.test(el.textContent.trim());
    });
    var cio = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) { return; }
        var el = entry.target; cio.unobserve(el);
        var text = el.textContent.trim(), plus = /\+$/.test(text), end = parseInt(text, 10);
        if (end < 3) { return; }
        var start = null, dur = 1300;
        el.style.fontVariantNumeric = 'tabular-nums lining-nums';
        var step = function (t) {
          if (start === null) { start = t; }
          var p = Math.min(1, (t - start) / dur), eased = 1 - Math.pow(1 - p, 3);
          el.textContent = Math.round(end * eased) + (plus ? '+' : '');
          if (p < 1) { window.requestAnimationFrame(step); } else { el.textContent = text; }
        };
        window.requestAnimationFrame(step);
      });
    }, { threshold: 0.6 });
    counters.forEach(function (el) { cio.observe(el); });
  }

  register();

  /* ---------- offline support and faster repeat visits ---------- */
  function register() {
    if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
      window.addEventListener('load', function () { navigator.serviceWorker.register('/sw.js').catch(function () { /* optional */ }); });
    }
  }
})();
