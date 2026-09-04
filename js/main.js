document.addEventListener('DOMContentLoaded', () => {
  initNav();
  initHaloCanvas();
  initScrollReveal();
  initCardTilt();
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
   ・屋号のモチーフである「輪」に沿って粒子を周回させる
   ・カーソルに近づいた粒子はやわらかく外側へ逃げる
   ・prefers-reduced-motion では静止したリングを1回だけ描画
--------------------------------------------------------- */
function initHaloCanvas() {
  const canvas = document.getElementById('halo-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  let width, height, dpr;
  let particles = [];
  let mouse = { x: -9999, y: -9999 };
  let rafId = null;

  const palette = ['#e7a33e', '#ef7f6c', '#f0b563'];

  function resize() {
    const rect = canvas.parentElement.getBoundingClientRect();
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    width = rect.width;
    height = rect.height;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    buildParticles();
  }

  function buildParticles() {
    const cx = width * 0.72;
    const cy = height * 0.42;
    const baseRadius = Math.min(width, height) * 0.34;
    const count = Math.round(width < 640 ? 34 : 60);

    particles = Array.from({ length: count }, (_, i) => {
      const angle = (i / count) * Math.PI * 2;
      return {
        cx, cy,
        angle,
        baseRadius: baseRadius + (Math.sin(i * 12.9) * 18),
        speed: 0.0009 + (i % 5) * 0.00012,
        size: 1.2 + (i % 4) * 0.6,
        color: palette[i % palette.length],
      };
    });
  }

  function frame(time) {
    ctx.clearRect(0, 0, width, height);

    const pts = particles.map((p) => {
      p.angle += p.speed;
      let radius = p.baseRadius;
      let x = p.cx + Math.cos(p.angle) * radius;
      let y = p.cy + Math.sin(p.angle) * radius * 0.62; // 楕円のリングにする

      // カーソル近接で外側へ逃がす
      const dx = x - mouse.x;
      const dy = y - mouse.y;
      const dist = Math.hypot(dx, dy);
      const influence = 90;
      if (dist < influence) {
        const push = (influence - dist) / influence;
        x += (dx / (dist || 1)) * push * 26;
        y += (dy / (dist || 1)) * push * 26;
      }
      return { x, y, size: p.size, color: p.color };
    });

    // 粒子同士を結ぶ、うっすらとした線（近い粒子だけ）
    ctx.lineWidth = 1;
    for (let i = 0; i < pts.length; i++) {
      for (let j = i + 1; j < pts.length; j++) {
        const dx = pts[i].x - pts[j].x;
        const dy = pts[i].y - pts[j].y;
        const d = Math.hypot(dx, dy);
        if (d < 46) {
          ctx.strokeStyle = `rgba(231, 163, 62, ${0.14 * (1 - d / 46)})`;
          ctx.beginPath();
          ctx.moveTo(pts[i].x, pts[i].y);
          ctx.lineTo(pts[j].x, pts[j].y);
          ctx.stroke();
        }
      }
    }

    // 粒子本体
    pts.forEach((p) => {
      ctx.beginPath();
      ctx.fillStyle = p.color;
      ctx.globalAlpha = 0.85;
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.globalAlpha = 1;

    rafId = requestAnimationFrame(frame);
  }

  function drawStatic() {
    // reduced-motion 用：静止したリングを1回だけ描く
    resize();
    ctx.clearRect(0, 0, width, height);
    const cx = width * 0.72, cy = height * 0.42;
    const r = Math.min(width, height) * 0.34;
    ctx.strokeStyle = 'rgba(231, 163, 62, 0.35)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.ellipse(cx, cy, r, r * 0.62, 0, 0, Math.PI * 2);
    ctx.stroke();
  }

  window.addEventListener('resize', () => {
    if (reduceMotion) { drawStatic(); return; }
    resize();
  });

  canvas.parentElement.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    mouse.x = e.clientX - rect.left;
    mouse.y = e.clientY - rect.top;
  });
  canvas.parentElement.addEventListener('mouseleave', () => {
    mouse.x = -9999; mouse.y = -9999;
  });

  if (reduceMotion) {
    drawStatic();
    return;
  }

  resize();
  rafId = requestAnimationFrame(frame);
}

/* ---------------------------------------------------------
   スクロールでふわっと出現する演出（IntersectionObserver）
   JS無効時は何もクラスが付かず、通常表示のまま読める
--------------------------------------------------------- */
function initScrollReveal() {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const targets = document.querySelectorAll('.card, .case-study, .contact-card, .section-head');
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
    el.style.transitionDelay = `${Math.min(i % 3, 2) * 70}ms`;
    observer.observe(el);
  });
}

/* ---------------------------------------------------------
   カードのマウス追従チルト（軽い立体感の演出）
--------------------------------------------------------- */
function initCardTilt() {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  if (window.matchMedia('(hover: none)').matches) return; // タッチ端末では無効

  document.querySelectorAll('.card').forEach((card) => {
    card.addEventListener('mousemove', (e) => {
      const rect = card.getBoundingClientRect();
      const px = (e.clientX - rect.left) / rect.width - 0.5;
      const py = (e.clientY - rect.top) / rect.height - 0.5;
      card.style.transform = `perspective(700px) rotateX(${(-py * 6).toFixed(2)}deg) rotateY(${(px * 6).toFixed(2)}deg) translateY(-2px)`;
    });
    card.addEventListener('mouseleave', () => {
      card.style.transform = '';
    });
  });
}
