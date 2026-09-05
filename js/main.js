document.addEventListener('DOMContentLoaded', () => {
  initNav();
  initHaloCanvas();
  initScrollReveal();
  initCardMotion();
});

/* ---------------------------------------------------------
   モバイルナビの開閉
--------------------------------------------------------- */
function initNav() {
  const toggle = document.querySelector('.nav-toggle');
  const nav = document.querySelector('.main-nav');
  if (!toggle || !nav) return;

  toggle.addEventListener('click', () => {
    const isOpen = nav.classList.toggle('open');
    toggle.setAttribute('aria-expanded', String(isOpen));
  });

  nav.querySelectorAll('a').forEach((link) => {
    link.addEventListener('click', () => {
      nav.classList.remove('open');
      toggle.setAttribute('aria-expanded', 'false');
    });
  });
}

/* ---------------------------------------------------------
   ヒーローの Halo（光の輪）パーティクルアニメーション
   ・屋号のモチーフである「輪」に沿って粒子を周回させる（常時、呼吸するように拡縮）
   ・マウス／指が近づいた粒子はやわらかく外側へ逃げる（PC・スマホ両対応）
   ・軌跡がうっすら尾を引くトレイル表現で、より目を引く見た目にする
   ・prefers-reduced-motion では静止したリングを1回だけ描画
   ・スクロールに合わせて緩やかにパララックスする
--------------------------------------------------------- */
function initHaloCanvas() {
  const canvas = document.getElementById('halo-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  let width, height, dpr;
  let particles = [];
  let pointer = { x: -9999, y: -9999, active: false };
  let trailFill = 'rgba(245, 246, 250, 0.22)';

  const palette = ['#e7a33e', '#ef7f6c', '#f0b563'];

  function readTrailColor() {
    const bg = getComputedStyle(document.body).getPropertyValue('--bg').trim();
    const rgb = hexToRgb(bg);
    if (rgb) trailFill = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.22)`;
  }

  function hexToRgb(hex) {
    const m = hex.replace('#', '').match(/^([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i);
    if (!m) return null;
    return { r: parseInt(m[1], 16), g: parseInt(m[2], 16), b: parseInt(m[3], 16) };
  }

  function resize() {
    const rect = canvas.parentElement.getBoundingClientRect();
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    width = rect.width;
    height = rect.height;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    readTrailColor();
    buildParticles();
  }

  function buildParticles() {
    const cx = width * 0.7;
    const cy = height * 0.42;
    const baseRadius = Math.min(width, height) * (width < 640 ? 0.44 : 0.36);
    const count = Math.round(width < 640 ? 46 : 70);

    particles = Array.from({ length: count }, (_, i) => {
      const angle = (i / count) * Math.PI * 2;
      return {
        cx, cy,
        angle,
        angleOffset: i * 12.9,
        baseRadius: baseRadius + (Math.sin(i * 12.9) * 20),
        speed: (0.0016 + (i % 5) * 0.0003) * (i % 2 === 0 ? 1 : -1) * 0.4 + 0.0014,
        size: 1.6 + (i % 4) * 0.9,
        color: palette[i % palette.length],
      };
    });
  }

  function frame(time) {
    // 完全にクリアせず、うっすら塗り重ねることで光の尾（トレイル）を作る
    ctx.fillStyle = trailFill;
    ctx.fillRect(0, 0, width, height);

    const breathe = Math.sin(time * 0.0007) * 12; // リング全体がゆっくり呼吸する

    const pts = particles.map((p) => {
      p.angle += p.speed;
      let radius = p.baseRadius + breathe;
      let x = p.cx + Math.cos(p.angle) * radius;
      let y = p.cy + Math.sin(p.angle) * radius * 0.6; // 楕円のリング

      // カーソル／指が近いと外側へ逃がす
      const dx = x - pointer.x;
      const dy = y - pointer.y;
      const dist = Math.hypot(dx, dy);
      const influence = 130;
      if (dist < influence) {
        const push = (influence - dist) / influence;
        x += (dx / (dist || 1)) * push * 40;
        y += (dy / (dist || 1)) * push * 40;
      }
      return { x, y, size: p.size, color: p.color };
    });

    // 粒子同士を結ぶ、うっすらとした線
    ctx.lineWidth = 1;
    for (let i = 0; i < pts.length; i++) {
      for (let j = i + 1; j < pts.length; j++) {
        const dx = pts[i].x - pts[j].x;
        const dy = pts[i].y - pts[j].y;
        const d = Math.hypot(dx, dy);
        if (d < 52) {
          ctx.strokeStyle = `rgba(231, 163, 62, ${0.18 * (1 - d / 52)})`;
          ctx.beginPath();
          ctx.moveTo(pts[i].x, pts[i].y);
          ctx.lineTo(pts[j].x, pts[j].y);
          ctx.stroke();
        }
      }
    }

    // 粒子本体（うっすら発光させる）
    pts.forEach((p) => {
      ctx.save();
      ctx.shadowBlur = 10;
      ctx.shadowColor = p.color;
      ctx.beginPath();
      ctx.fillStyle = p.color;
      ctx.globalAlpha = 0.9;
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });

    requestAnimationFrame(frame);
  }

  function drawStatic() {
    resize();
    ctx.clearRect(0, 0, width, height);
    const cx = width * 0.7, cy = height * 0.42;
    const r = Math.min(width, height) * 0.36;
    ctx.strokeStyle = 'rgba(231, 163, 62, 0.35)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.ellipse(cx, cy, r, r * 0.6, 0, 0, Math.PI * 2);
    ctx.stroke();
  }

  function setPointerFromEvent(e) {
    const rect = canvas.getBoundingClientRect();
    const point = e.touches && e.touches[0] ? e.touches[0] : e;
    pointer.x = point.clientX - rect.left;
    pointer.y = point.clientY - rect.top;
  }

  window.addEventListener('resize', () => {
    if (reduceMotion) { drawStatic(); return; }
    resize();
  });

  const host = canvas.parentElement;
  host.addEventListener('mousemove', setPointerFromEvent);
  host.addEventListener('mouseleave', () => { pointer.x = -9999; pointer.y = -9999; });
  host.addEventListener('touchmove', (e) => { setPointerFromEvent(e); }, { passive: true });
  host.addEventListener('touchstart', (e) => { setPointerFromEvent(e); }, { passive: true });
  host.addEventListener('touchend', () => { pointer.x = -9999; pointer.y = -9999; });

  // 緩やかなパララックス：スクロールに応じてリング全体を少しだけ動かす
  let ticking = false;
  window.addEventListener('scroll', () => {
    if (reduceMotion || ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      const offset = Math.min(window.scrollY * 0.18, 60);
      canvas.style.transform = `translateY(${offset}px)`;
      ticking = false;
    });
  }, { passive: true });

  if (reduceMotion) {
    drawStatic();
    return;
  }

  resize();
  requestAnimationFrame(frame);
}

/* ---------------------------------------------------------
   スクロールでふわっと出現する演出（IntersectionObserver）
   JS無効時は何もクラスが付かず、通常表示のまま読める
--------------------------------------------------------- */
function initScrollReveal() {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const targets = document.querySelectorAll('.card, .case-study, .contact-card, .section-head, .greeting');
  if (!targets.length) return;

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('reveal-in');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.15, rootMargin: '0px 0px -40px 0px' });

  targets.forEach((el, i) => {
    el.classList.add('reveal-init');
    el.style.transitionDelay = `${Math.min(i % 3, 2) * 90}ms`;
    observer.observe(el);
  });
}

/* ---------------------------------------------------------
   カードの動き：
   ・ホバー可能な端末（PC）→ マウス追従チルト
   ・タッチ端末（スマホ）→ 常時ふわふわ浮遊させて「動いている感」を出す
--------------------------------------------------------- */
function initCardMotion() {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const canHover = window.matchMedia('(hover: hover)').matches;
  const cards = document.querySelectorAll('.card');

  if (canHover) {
    cards.forEach((card) => {
      card.addEventListener('mousemove', (e) => {
        const rect = card.getBoundingClientRect();
        const px = (e.clientX - rect.left) / rect.width - 0.5;
        const py = (e.clientY - rect.top) / rect.height - 0.5;
        card.style.transform = `perspective(700px) rotateX(${(-py * 8).toFixed(2)}deg) rotateY(${(px * 8).toFixed(2)}deg) translateY(-3px)`;
      });
      card.addEventListener('mouseleave', () => { card.style.transform = ''; });
    });
  } else {
    cards.forEach((card) => card.classList.add('idle-float'));
  }
}
