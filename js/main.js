(function(){
'use strict';
const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const fine = window.matchMedia('(pointer: fine)').matches;
const isMobile = window.innerWidth < 700;

/* ════════════════════════════════════════════════
   BOOT SEQUENCE
   ════════════════════════════════════════════════ */
(function boot(){
  const el = document.getElementById('boot');
  if (reduced){ el.remove(); return; }
  el.querySelectorAll('[data-t]').forEach(line => {
    setTimeout(() => {
      line.classList.add('in');
      const bar = line.querySelector('i');
      if (bar) requestAnimationFrame(() => bar.style.width = '100%');
    }, +line.dataset.t);
  });
  setTimeout(() => el.classList.add('done'), 1750);
  setTimeout(() => el.remove(), 2500);
})();

/* ════════════════════════════════════════════════
   SCROLL PROGRESS — the spine of everything
   p: raw scroll [0,1] · sp: smoothed p
   ════════════════════════════════════════════════ */
let p = 0, sp = 0;
function readScroll(){
  const max = document.documentElement.scrollHeight - window.innerHeight;
  p = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
}
window.addEventListener('scroll', readScroll, { passive:true });
readScroll();

/* ════════════════════════════════════════════════
   THE FIELD — one particle system, five states
   noise → labeled grid → clusters → network → glyph
   ════════════════════════════════════════════════ */
const STAGE_STOPS = [0, .25, .52, .78, 1];
const STAGE_NAMES = ['noise','labeling','training','converging','inference'];
const PALETTE = [
  [0.039, 0.4, 1.0],    // accent blue
  [0.486, 0.424, 1.0],  // violet
  [0.086, 0.722, 0.651],// teal
  [0.961, 0.62, 0.043], // amber
];

let netEdges = null, fieldOK = false;

if (typeof THREE !== 'undefined'){
  fieldOK = true;
  const canvas = document.getElementById('field');
  const renderer = new THREE.WebGLRenderer({ canvas, alpha:true, antialias:true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(50, 1, .1, 200);
  camera.position.z = 30;

  const N = isMobile ? 700 : 1500;

  // soft round sprite
  const sprite = (() => {
    const c = document.createElement('canvas'); c.width = c.height = 64;
    const g = c.getContext('2d');
    const grad = g.createRadialGradient(32,32,0,32,32,30);
    grad.addColorStop(0,'rgba(255,255,255,1)');
    grad.addColorStop(.5,'rgba(255,255,255,.75)');
    grad.addColorStop(1,'rgba(255,255,255,0)');
    g.fillStyle = grad; g.beginPath(); g.arc(32,32,30,0,Math.PI*2); g.fill();
    return new THREE.CanvasTexture(c);
  })();

  const gauss = () => {
    let u=0,v=0;
    while(!u)u=Math.random(); while(!v)v=Math.random();
    return Math.sqrt(-2*Math.log(u))*Math.cos(2*Math.PI*v);
  };

  /* ---- stage target generators (each returns Float32Array N*3) ---- */

  // 0 · NOISE — wide random field
  function genNoise(){
    const a = new Float32Array(N*3);
    for (let i=0;i<N;i++){
      a[i*3]   = (Math.random()-.5)*46;
      a[i*3+1] = (Math.random()-.5)*30;
      a[i*3+2] = (Math.random()-.5)*26 - 4;
    }
    return a;
  }

  // 1 · GRID — dataset rows snapping into order (labeling)
  function genGrid(){
    const a = new Float32Array(N*3);
    const cols = Math.ceil(Math.sqrt(N * 1.7));
    const rows = Math.ceil(N / cols);
    const w = 34, h = 22;
    for (let i=0;i<N;i++){
      const cx = i % cols, cy = Math.floor(i / cols);
      a[i*3]   = (cx/(cols-1) - .5) * w;
      a[i*3+1] = ((cy/(rows-1) - .5) * -h);
      a[i*3+2] = -4 + gauss()*.25;
    }
    return a;
  }

  // 2 · CLUSTERS — embeddings grouping by class (training)
  const CLUSTER_CENTERS = [[-10,5,-6],[9,7,-10],[11,-6,-4],[-7,-7,-9]];
  function genClusters(classOf){
    const a = new Float32Array(N*3);
    for (let i=0;i<N;i++){
      const c = CLUSTER_CENTERS[classOf[i]];
      a[i*3]   = c[0] + gauss()*2.6;
      a[i*3+1] = c[1] + gauss()*2.1;
      a[i*3+2] = c[2] + gauss()*2.4;
    }
    return a;
  }

  // 3 · NETWORK — layered neural net (converging)
  const LAYERS = [4,6,6,3];
  const nodePos = [];
  (function buildNodes(){
    const lx = [-12,-4,4,12];
    LAYERS.forEach((count, li) => {
      for (let ni=0;ni<count;ni++){
        const y = (ni - (count-1)/2) * (16/Math.max(...LAYERS));
        nodePos.push([lx[li], y, -5, li]);
      }
    });
  })();
  function genNetwork(){
    const a = new Float32Array(N*3);
    for (let i=0;i<N;i++){
      const node = nodePos[i % nodePos.length];
      a[i*3]   = node[0] + gauss()*.55;
      a[i*3+1] = node[1] + gauss()*.55;
      a[i*3+2] = node[2] + gauss()*.55;
    }
    return a;
  }

  // 4 · GLYPH — particles spell "FG" (inference: the model is him)
  function genGlyph(){
    const c = document.createElement('canvas');
    c.width = 360; c.height = 160;
    const g = c.getContext('2d');
    g.fillStyle = '#000';
    g.font = '900 130px Inter, Arial, sans-serif';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText('FG', 180, 86);
    const img = g.getImageData(0,0,360,160).data;
    const pts = [];
    for (let y=0;y<160;y+=2){
      for (let x=0;x<360;x+=2){
        if (img[(y*360+x)*4+3] > 128) pts.push([x,y]);
      }
    }
    const a = new Float32Array(N*3);
    const scaleX = 22/360, off = -11;
    for (let i=0;i<N;i++){
      const pt = pts[Math.floor(Math.random()*pts.length)] || [180,80];
      a[i*3]   = pt[0]*scaleX + off + gauss()*.06;
      a[i*3+1] = -(pt[1]*scaleX - 80*scaleX) + gauss()*.06;
      a[i*3+2] = -4 + gauss()*.4;
    }
    return a;
  }

  // class assignment (stable per particle — drives color + clusters)
  const classOf = new Uint8Array(N);
  for (let i=0;i<N;i++) classOf[i] = Math.floor(Math.random()*4);

  const STAGES = [genNoise(), genGrid(), genClusters(classOf), genNetwork(), genGlyph()];

  /* ---- buffers ---- */
  const pos = new Float32Array(STAGES[0]);            // live positions
  const col = new Float32Array(N*3);
  const seeds = new Float32Array(N);
  for (let i=0;i<N;i++) seeds[i] = Math.random()*Math.PI*2;

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const mat = new THREE.PointsMaterial({
    size:.36, map:sprite, transparent:true, opacity:.62,
    vertexColors:true, depthWrite:false, sizeAttenuation:true,
  });
  scene.add(new THREE.Points(geo, mat));

  /* ---- network edges (visible only near stage 3) ---- */
  (function buildEdges(){
    const lines = [];
    let aStart = 0;
    for (let li=0; li<LAYERS.length-1; li++){
      const bStart = aStart + LAYERS[li];
      for (let i=0;i<LAYERS[li];i++){
        for (let j=0;j<LAYERS[li+1];j++){
          const A = nodePos[aStart+i], B = nodePos[bStart+j];
          lines.push(A[0],A[1],A[2], B[0],B[1],B[2]);
        }
      }
      aStart = bStart;
    }
    const lgeo = new THREE.BufferGeometry();
    lgeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(lines),3));
    const lmat = new THREE.LineBasicMaterial({ color:0x0A66FF, transparent:true, opacity:0 });
    netEdges = new THREE.LineSegments(lgeo, lmat);
    scene.add(netEdges);
  })();

  /* ---- stage blending ---- */
  const GRAY = [0.62,0.64,0.70];
  function stageBlend(t){
    // returns [indexA, indexB, mix]
    for (let s=0;s<STAGE_STOPS.length-1;s++){
      if (t <= STAGE_STOPS[s+1]){
        const span = STAGE_STOPS[s+1]-STAGE_STOPS[s];
        let m = (t - STAGE_STOPS[s]) / span;
        m = m*m*(3-2*m);            // smoothstep
        return [s, s+1, m];
      }
    }
    return [STAGE_STOPS.length-2, STAGE_STOPS.length-1, 1];
  }

  /* ---- pointer parallax ---- */
  let mx=0,my=0,tx=0,ty=0;
  window.addEventListener('pointermove', e => {
    tx = e.clientX/window.innerWidth - .5;
    ty = e.clientY/window.innerHeight - .5;
  }, {passive:true});

  function resize(){
    renderer.setSize(window.innerWidth, window.innerHeight, false);
    camera.aspect = window.innerWidth/window.innerHeight;
    camera.updateProjectionMatrix();
  }
  window.addEventListener('resize', resize);
  resize();

  /* ---- main loop ---- */
  let t = 0;
  function tick(){
    t += .004;
    sp += (p - sp) * .055;                 // smooth the scroll spine
    mx += (tx-mx)*.04; my += (ty-my)*.04;

    const [sa, sb, m] = stageBlend(sp);
    const A = STAGES[sa], B = STAGES[sb];

    // color emergence: gray → class color as labeling happens (stage 1+)
    const colorW = Math.min(1, Math.max(0, (sp - .12) / .2));
    // jitter dies down as the model converges
    const jit = .35 * (1 - sp*.85);

    for (let i=0;i<N;i++){
      const ix = i*3;
      const txp = A[ix]   + (B[ix]  -A[ix]  )*m;
      const typ = A[ix+1] + (B[ix+1]-A[ix+1])*m;
      const tzp = A[ix+2] + (B[ix+2]-A[ix+2])*m;
      // spring toward blended target + living jitter
      pos[ix]   += (txp + Math.sin(t*2+seeds[i])    *jit - pos[ix]  ) * .07;
      pos[ix+1] += (typ + Math.cos(t*1.7+seeds[i]*2)*jit - pos[ix+1]) * .07;
      pos[ix+2] += (tzp - pos[ix+2]) * .07;

      const pc = PALETTE[classOf[i]];
      col[ix]   = GRAY[0] + (pc[0]-GRAY[0])*colorW;
      col[ix+1] = GRAY[1] + (pc[1]-GRAY[1])*colorW;
      col[ix+2] = GRAY[2] + (pc[2]-GRAY[2])*colorW;
    }
    geo.attributes.position.needsUpdate = true;
    geo.attributes.color.needsUpdate = true;

    // edges fade in/out around the network stage
    const netW = Math.max(0, 1 - Math.abs(sp - .78)/.16);
    netEdges.material.opacity = netW * .1;

    scene.rotation.y = mx*.16 + Math.sin(t*.4)*.02;
    scene.rotation.x = my*.1;

    renderer.render(scene, camera);
    if (!reduced) requestAnimationFrame(tick);
  }
  if (reduced){
    // static mid-state for reduced motion
    sp = .5; p = .5;
    tick();
  } else {
    requestAnimationFrame(tick);
  }
}

/* ════════════════════════════════════════════════
   HUD — epoch, loss, stage all derive from sp
   ════════════════════════════════════════════════ */
(function hud(){
  const eStage = document.getElementById('hud-stage');
  const eEpoch = document.getElementById('hud-epoch');
  const eLoss  = document.getElementById('hud-loss');
  const eBar   = document.getElementById('hud-bar');
  const eProg  = document.getElementById('progress');
  let lastStage = -1;
  function frame(){
    const s = fieldOK ? sp : p;
    // loss: exponential decay + tiny tremor
    const loss = 2.8471 * Math.exp(-4.6*s) + .012 + Math.sin(Date.now()*.004)*.004*(1-s);
    eLoss.textContent = loss.toFixed(4);
    const epoch = Math.min(12, Math.floor(s*12.99));
    eEpoch.textContent = String(epoch).padStart(3,'0') + '/012';
    eBar.style.width = (s*100).toFixed(1) + '%';
    eProg.style.width = (p*100).toFixed(2) + '%';
    // stage name
    let si = 0;
    for (let i=0;i<STAGE_STOPS.length-1;i++) if (s > (STAGE_STOPS[i]+STAGE_STOPS[i+1])/2) si = i+1;
    if (si !== lastStage){ eStage.textContent = STAGE_NAMES[si]; lastStage = si; }
    requestAnimationFrame(frame);
  }
  if (!reduced) requestAnimationFrame(frame);
  else { eStage.textContent='inference'; eEpoch.textContent='012/012'; eLoss.textContent='0.0120'; eBar.style.width='100%'; }
})();

/* ════════════════════════════════════════════════
   CUSTOM CURSOR — annotation crosshair
   ════════════════════════════════════════════════ */
(function cursor(){
  if (!fine || reduced) return;
  const cur = document.getElementById('cursor');
  document.body.classList.add('cursor-on');
  let cx=-100, cy=-100, x=-100, y=-100, live=false;
  window.addEventListener('pointermove', e => {
    cx = e.clientX; cy = e.clientY;
    if (!live){ cur.classList.add('live'); live = true; x = cx; y = cy; }
  }, {passive:true});
  document.addEventListener('mouseleave', () => { cur.classList.remove('live'); live=false; });
  function frame(){
    x += (cx-x)*.3; y += (cy-y)*.3;
    cur.style.transform = 'translate(' + x + 'px,' + y + 'px) translate(-50%,-50%)';
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  // states
  document.querySelectorAll('[data-annotate]').forEach(el => {
    el.addEventListener('pointerenter', () => cur.classList.add('scan'));
    el.addEventListener('pointerleave', () => cur.classList.remove('scan'));
  });
  document.querySelectorAll('a,button').forEach(el => {
    el.addEventListener('pointerenter', () => cur.classList.add('link'));
    el.addEventListener('pointerleave', () => cur.classList.remove('link'));
  });
})();

/* ════════════════════════════════════════════════
   MAGNETIC BUTTONS
   ════════════════════════════════════════════════ */
(function magnetic(){
  if (!fine || reduced) return;
  document.querySelectorAll('.magnetic').forEach(el => {
    el.addEventListener('pointermove', e => {
      const r = el.getBoundingClientRect();
      const dx = e.clientX - (r.left + r.width/2);
      const dy = e.clientY - (r.top + r.height/2);
      el.style.transform = 'translate(' + dx*.18 + 'px,' + dy*.22 + 'px)';
    });
    el.addEventListener('pointerleave', () => { el.style.transform = ''; });
  });
})();

/* ════════════════════════════════════════════════
   ANNOTATION MODE — the site labels itself
   ════════════════════════════════════════════════ */
(function annotations(){
  const layer = document.getElementById('annot-layer');
  const toggle = document.getElementById('annotToggle');
  const targets = Array.from(document.querySelectorAll('[data-annotate]'));
  const boxes = new Map();
  let allMode = false, hovered = null, rafId = null;

  function makeBox(el){
    const box = document.createElement('div');
    const v = el.dataset.c === '2' ? ' alt2' : el.dataset.c === '3' ? ' alt3' : '';
    box.className = 'bbox' + v;
    box.innerHTML =
      '<span class="handle h-tl"></span><span class="handle h-tr"></span>' +
      '<span class="handle h-bl"></span><span class="handle h-br"></span>' +
      '<span class="tag">' + el.dataset.annotate +
      ' <span class="conf">' + (el.dataset.conf || '0.90') + '</span></span>';
    layer.appendChild(box);
    return box;
  }
  function place(el, box){
    const r = el.getBoundingClientRect();
    const pad = 6;
    box.style.top    = (r.top - pad) + 'px';
    box.style.left   = (r.left - pad) + 'px';
    box.style.width  = (r.width + pad*2) + 'px';
    box.style.height = (r.height + pad*2) + 'px';
  }
  function frame(){
    boxes.forEach((box, el) => {
      const active = allMode || el === hovered;
      if (active){ place(el, box); box.classList.add('show'); }
      else box.classList.remove('show');
    });
    if (allMode || hovered) rafId = requestAnimationFrame(frame);
    else rafId = null;
  }
  const ensure = () => { if (!rafId) rafId = requestAnimationFrame(frame); };

  targets.forEach(el => {
    boxes.set(el, makeBox(el));
    el.addEventListener('pointerenter', () => { hovered = el; ensure(); });
    el.addEventListener('pointerleave', () => { if (hovered === el) hovered = null; ensure(); });
  });
  toggle.addEventListener('click', () => {
    allMode = !allMode;
    toggle.classList.toggle('on', allMode);
    toggle.setAttribute('aria-pressed', String(allMode));
    ensure();
  });
  ensure();
})();

/* ════════════════════════════════════════════════
   REVEALS · NAV · CARD GLOW
   ════════════════════════════════════════════════ */
(function misc(){
  const nav = document.getElementById('nav');
  window.addEventListener('scroll', () => {
    nav.classList.toggle('scrolled', window.scrollY > 40);
  }, {passive:true});

  if ('IntersectionObserver' in window && !reduced){
    const io = new IntersectionObserver(entries => {
      entries.forEach(e => {
        if (e.isIntersecting){ e.target.classList.add('revealed'); io.unobserve(e.target); }
      });
    }, {threshold:.12});
    document.querySelectorAll('.reveal').forEach(el => io.observe(el));
  } else {
    document.querySelectorAll('.reveal').forEach(el => el.classList.add('revealed'));
  }

  document.querySelectorAll('.proj').forEach(card => {
    card.addEventListener('pointermove', e => {
      const r = card.getBoundingClientRect();
      card.style.setProperty('--mx', ((e.clientX-r.left)/r.width*100)+'%');
      card.style.setProperty('--my', ((e.clientY-r.top)/r.height*100)+'%');
    }, {passive:true});
  });
})();

})();
