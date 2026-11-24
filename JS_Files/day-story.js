/* ═══════════════════════════════════════════════════════════════
   A DAY IN MY LIFE — homepage animation strip (canvas)
   ───────────────────────────────────────────────────────────────
   One character walks left to right through her day. At each
   station she stops for an activity and a caption appears:

     06:30 Rise & shine      bed, dawn
     07:15 Coffee first      kitchen counter
     09:30 Building pipelines desk + laptop dashboard
     12:00 Team sync         whiteboard + teammates
     15:00 Hackathon win!    trophy + confetti
     18:00 Badminton         rally with a partner
     19:30 Painting          easel
     20:45 Clay time         pottery wheel
     22:30 Good night        bed, stars

   The sky follows the clock (sunrise → day → sunset → night) over
   a city skyline. Wide screens see the whole room; narrow screens
   get a camera that follows her. Colours follow the light/dark
   theme ("themechange" event). Respects prefers-reduced-motion
   (shows one still frame) and pauses when off-screen.
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var canvas = document.getElementById('stickStoryCanvas');
  var layer = document.getElementById('stickStoryLayer');
  if (!canvas || !layer) return;
  var ctx = canvas.getContext('2d');
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ── World ─────────────────────────────────────────────── */
  var WORLD_W = 2050, H = 430, GROUND = 352;
  var MIN_SCALE = 0.5;            // below this, the camera follows her instead
  var scale = 1, viewW = WORLD_W, camX = 0;

  var STATIONS = [
    { id: 'wake',      x: 120, sx: 212,  hour: 6.5,  dur: 4.2, label: 'Rise & shine' },
    { id: 'coffee',    x: 345, sx: 345,  hour: 7.25, dur: 3.6, label: 'Coffee first' },
    { id: 'desk',      x: 575, sx: 545,  hour: 9.5,  dur: 4.6, label: 'Building data pipelines' },
    { id: 'meeting',   x: 815, sx: 805,  hour: 12,   dur: 4.0, label: 'Team sync' },
    { id: 'trophy',    x: 1050, sx: 1070, hour: 15,   dur: 4.2, label: 'Hackathon win!' },
    { id: 'badminton', x: 1275, sx: 1285, hour: 18,   dur: 4.6, label: 'Badminton' },
    { id: 'paint',     x: 1505, sx: 1513, hour: 19.5, dur: 4.2, label: 'Painting' },
    { id: 'pottery',   x: 1710, sx: 1689, hour: 20.75, dur: 4.0, label: 'Clay time' },
    { id: 'sleep',     x: 1925, sx: 1899, hour: 22.5, dur: 4.6, label: 'Good night' }
  ];
  var WALK_SPEED = 95;            // world units per second

  /* ── Colours ───────────────────────────────────────────── */
  var PAL = {
    dark: {
      bg: '#0b1220', floor: '#101a2c', floorLine: '#2b3a5c', furniture: '#a78bfa', furnitureDim: '#4c3f8f',
      fill: '#16213a', text: '#e6edf7', soft: '#94a3bf', pill: 'rgba(16,26,44,.92)', pillLine: 'rgba(244,114,182,.55)',
      accent: '#f472b6', accent2: '#a78bfa', screen: '#0f1a30', paper: '#f8fafc',
      skin: '#c68863', hair: '#2b1a17', top: '#f472b6', pants: '#7c6be0', shoe: '#1d1730',
      mate1: '#38bdf8', mate2: '#a78bfa', mateHair: '#1f1a2e',
      building: 'rgba(148,163,191,', window: '#fcd34d',
      sky: [ [5.5, '#0a1022', '#121a33'], [6.5, '#3b2550', '#8a4a63'], [8, '#1d3557', '#3d5a80'], [12, '#173a63', '#2c5d8f'],
             [16.5, '#1f3a63', '#3d5a80'], [18, '#47285e', '#b3576f'], [19.5, '#23194a', '#4a2b63'], [21, '#0b1124', '#151d3b'], [24, '#070b18', '#0e1530'] ]
    },
    light: {
      bg: '#fbf6f9', floor: '#f6eef3', floorLine: '#e3d2dd', furniture: '#6d28d9', furnitureDim: '#d6c8f5',
      fill: '#ffffff', text: '#1c1726', soft: '#5c5670', pill: 'rgba(255,255,255,.94)', pillLine: 'rgba(190,24,93,.45)',
      accent: '#be185d', accent2: '#6d28d9', screen: '#1e1b3a', paper: '#ffffff',
      skin: '#c68863', hair: '#2b1a17', top: '#db2777', pants: '#5b4bc4', shoe: '#2a2440',
      mate1: '#0284c7', mate2: '#7c3aed', mateHair: '#2a2338',
      building: 'rgba(109,40,217,', window: '#f59e0b',
      sky: [ [5.5, '#c7c2e8', '#e7d6ea'], [6.5, '#fbd0d9', '#fde2c8'], [8, '#d6e8fb', '#eef6ff'], [12, '#cfe3fb', '#f1f8ff'],
             [16.5, '#dbe7fb', '#f7efff'], [18, '#f9c6d9', '#fde3b8'], [19.5, '#b9a8ef', '#e9b8d8'], [21, '#3b3478', '#5b4a9a'], [24, '#26215a', '#3b3478'] ]
    }
  };
  var C = PAL[document.body.classList.contains('light-theme') ? 'light' : 'dark'];
  window.addEventListener('themechange', function (e) {
    C = PAL[e.detail && e.detail.theme === 'light' ? 'light' : 'dark'];
    if (reduce) draw();
  });

  /* ── Sizing ────────────────────────────────────────────── */
  function resize() {
    var w = layer.clientWidth || 1;
    scale = Math.max(w / WORLD_W, MIN_SCALE);
    viewW = w / scale;
    var hpx = H * scale;
    layer.style.height = hpx + 'px';
    canvas.style.width = w + 'px';
    canvas.style.height = hpx + 'px';
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(hpx * dpr);
    ctx.setTransform(scale * dpr, 0, 0, scale * dpr, 0, 0);
    if (reduce) draw();
  }
  window.addEventListener('resize', resize);

  /* ── Small helpers ─────────────────────────────────────── */
  function lerp(a, b, t) { return a + (b - a) * t; }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function ease(t) { return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; }
  function hex(c) { var n = parseInt(c.slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; }
  function mix(a, b, t) { var x = hex(a), y = hex(b); return 'rgb(' + x.map(function (v, i) { return Math.round(lerp(v, y[i], t)); }).join(',') + ')'; }
  function rr(x, y, w, h, r) { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); }
  function line(x1, y1, x2, y2) { ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); }
  function rand(seed) { var s = Math.sin(seed * 9301 + 49297) * 233280; return s - Math.floor(s); }

  /* ── Timeline: walk → activity → walk … ────────────────── */
  var steps = [];
  (function buildTimeline() {
    var t = 0, x = STATIONS[0].sx;
    STATIONS.forEach(function (st, i) {
      if (i > 0) {
        var d = Math.abs(st.sx - x) / WALK_SPEED;
        steps.push({ kind: 'walk', from: x, to: st.sx, t0: t, t1: t + d, h0: STATIONS[i - 1].hour + 0.35, h1: st.hour });
        t += d;
      }
      steps.push({ kind: 'act', st: st, t0: t, t1: t + st.dur, h0: st.hour, h1: st.hour + 0.35 });
      t += st.dur;
      x = st.sx;
    });
    steps.push({ kind: 'fade', t0: t, t1: t + 1.4, h0: 22.85, h1: 24 });
  })();
  var LOOP = steps[steps.length - 1].t1;

  function stateAt(time) {
    var s = steps.find(function (st) { return time >= st.t0 && time < st.t1; }) || steps[steps.length - 1];
    var k = clamp((time - s.t0) / (s.t1 - s.t0), 0, 1);
    return { step: s, k: k, hour: lerp(s.h0, s.h1, s.kind === 'walk' ? ease(k) : k) };
  }

  /* ── Background: sky, sun/moon, stars, skyline, floor ──── */
  function skyColours(hour) {
    var keys = C.sky, i = 0;
    while (i < keys.length - 2 && hour > keys[i + 1][0]) i++;
    var a = keys[i], b = keys[i + 1];
    var t = clamp((hour - a[0]) / (b[0] - a[0]), 0, 1);
    return [mix(a[1], b[1], t), mix(a[2], b[2], t)];
  }
  function nightness(hour) {
    if (hour < 6) return 1;
    if (hour < 7.5) return 1 - (hour - 6) / 1.5;
    if (hour < 18.5) return 0;
    if (hour < 21) return (hour - 18.5) / 2.5;
    return 1;
  }
  var BUILDINGS = [];
  (function () {
    var x = -20, i = 0;
    while (x < WORLD_W + 40) {
      var w = 46 + rand(i) * 70, h = 60 + rand(i + 50) * 150;
      BUILDINGS.push({ x: x, w: w, h: h, seed: i });
      x += w + 6 + rand(i + 99) * 26; i++;
    }
  })();

  function drawBackground(hour, time) {
    var sky = skyColours(hour);
    var g = ctx.createLinearGradient(0, 0, 0, GROUND);
    g.addColorStop(0, C.bg);
    g.addColorStop(0.18, sky[0]);
    g.addColorStop(1, sky[1]);
    ctx.fillStyle = g;
    ctx.fillRect(camX - 10, 0, viewW + 20, GROUND);

    var night = nightness(hour);
    // stars
    if (night > 0.02) {
      for (var i = 0; i < 90; i++) {
        var sx = rand(i) * WORLD_W, sy = 30 + rand(i + 300) * 170;
        if (sx < camX - 5 || sx > camX + viewW + 5) continue;
        var tw = 0.55 + 0.45 * Math.sin(time * 2 + i);
        ctx.fillStyle = 'rgba(255,255,255,' + (night * tw * 0.85).toFixed(3) + ')';
        ctx.fillRect(sx, sy, i % 7 === 0 ? 2.2 : 1.4, i % 7 === 0 ? 2.2 : 1.4);
      }
    }
    // sun (6 → 19) and moon (18.5 → 24) travel across the view
    var cx0 = camX + 60, cx1 = camX + viewW - 60;
    if (hour > 5.8 && hour < 19.2) {
      var p = (hour - 5.8) / 13.4;
      var sx2 = lerp(cx0, cx1, p), sy2 = 175 - Math.sin(p * Math.PI) * 125;
      var halo = ctx.createRadialGradient(sx2, sy2, 4, sx2, sy2, 70);
      halo.addColorStop(0, 'rgba(255,214,140,.55)'); halo.addColorStop(1, 'rgba(255,214,140,0)');
      ctx.fillStyle = halo; ctx.fillRect(sx2 - 70, sy2 - 70, 140, 140);
      ctx.fillStyle = '#ffd38a'; ctx.beginPath(); ctx.arc(sx2, sy2, 17, 0, Math.PI * 2); ctx.fill();
    }
    if (hour > 18.3) {
      var m = clamp((hour - 18.3) / 5.7, 0, 1);
      var mx = lerp(cx0 + 80, cx1, m), my = 185 - Math.sin(m * Math.PI * 0.9 + 0.2) * 120;
      ctx.fillStyle = 'rgba(226,232,245,' + Math.min(1, night * 1.4) + ')';
      ctx.beginPath(); ctx.arc(mx, my, 14, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = skyColours(hour)[0];
      ctx.beginPath(); ctx.arc(mx + 6, my - 4, 12, 0, Math.PI * 2); ctx.fill();
    }
    // skyline
    BUILDINGS.forEach(function (b) {
      if (b.x + b.w < camX - 10 || b.x > camX + viewW + 10) return;
      ctx.fillStyle = C.building + (0.10 + night * 0.08) + ')';
      ctx.fillRect(b.x, GROUND - b.h, b.w, b.h);
      // lit windows at dusk / night
      if (night > 0.1) {
        for (var wy = GROUND - b.h + 10; wy < GROUND - 14; wy += 14) {
          for (var wx = b.x + 7; wx < b.x + b.w - 8; wx += 12) {
            if (rand(b.seed * 31 + wx * 0.7 + wy) > 0.62) {
              ctx.fillStyle = 'rgba(252,211,77,' + (night * 0.55).toFixed(3) + ')';
              ctx.fillRect(wx, wy, 4, 6);
            }
          }
        }
      }
    });
    // floor
    ctx.fillStyle = C.floor;
    ctx.fillRect(camX - 10, GROUND, viewW + 20, H - GROUND);
    ctx.strokeStyle = C.floorLine; ctx.lineWidth = 2;
    line(camX - 10, GROUND, camX + viewW + 10, GROUND);
  }

  /* ── The character ─────────────────────────────────────
     Side view. Angles are in radians from straight down;
     positive = towards the way she faces. */
  var BODY = { head: 11, neck: 5, torso: 36, upper: 18, fore: 17, thigh: 24, shin: 24 };

  function limb(x, y, dir, a1, l1, a2, l2) {
    var kx = x + dir * Math.sin(a1) * l1, ky = y + Math.cos(a1) * l1;
    var ex = kx + dir * Math.sin(a2) * l2, ey = ky + Math.cos(a2) * l2;
    return [kx, ky, ex, ey];
  }
  function stroke2(x, y, p, w, c1, c2) {
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.strokeStyle = c1; ctx.lineWidth = w; line(x, y, p[0], p[1]);
    ctx.strokeStyle = c2 || c1; line(p[0], p[1], p[2], p[3]);
  }

  /* person: { x, ground, dir, pose, look: {top, pants, hair, hairStyle, glasses}, t } */
  function drawPerson(o) {
    var P = o.pose, dir = o.dir, L = o.look;
    var hipX = o.x, hipY;
    if (P.hipY != null) hipY = P.hipY;
    else {
      var drop = Math.max(Math.cos(P.legB[0]) * BODY.thigh + Math.cos(P.legB[1]) * BODY.shin,
                          Math.cos(P.legF[0]) * BODY.thigh + Math.cos(P.legF[1]) * BODY.shin);
      hipY = o.ground - drop - 3;
    }
    var lean = P.lean || 0;
    var shX = hipX + dir * Math.sin(lean) * BODY.torso, shY = hipY - Math.cos(lean) * BODY.torso;

    // back leg + back arm (slightly darker)
    var lb = limb(hipX, hipY, dir, P.legB[0], BODY.thigh, P.legB[1], BODY.shin);
    stroke2(hipX, hipY, lb, 8, shade(L.pants, -0.18));
    shoe(lb[2], lb[3], dir, P.legB[1]);
    var ab = limb(shX, shY + 3, dir, P.armB[0] + lean, BODY.upper, P.armB[1] + lean, BODY.fore);
    stroke2(shX, shY + 3, ab, 6, shade(L.top, -0.2), shade(C.skin, -0.12));
    if (o.itemBack) o.itemBack(ab[2], ab[3]);

    // torso
    ctx.save();
    ctx.translate(hipX, hipY); ctx.rotate(dir * lean);
    ctx.fillStyle = L.top;
    ctx.beginPath();
    ctx.moveTo(-7, 2); ctx.lineTo(7, 2);
    ctx.quadraticCurveTo(10, -BODY.torso * 0.55, 8, -BODY.torso + 4);
    ctx.quadraticCurveTo(0, -BODY.torso - 3, -8, -BODY.torso + 4);
    ctx.quadraticCurveTo(-10, -BODY.torso * 0.55, -7, 2);
    ctx.fill();
    // belt line
    ctx.fillStyle = shade(L.pants, -0.1);
    ctx.fillRect(-7, -3, 14, 5);
    ctx.restore();

    // front leg
    var lf = limb(hipX, hipY, dir, P.legF[0], BODY.thigh, P.legF[1], BODY.shin);
    stroke2(hipX, hipY, lf, 8, L.pants);
    shoe(lf[2], lf[3], dir, P.legF[1]);

    // head
    var neckTop = [shX + dir * Math.sin(lean) * BODY.neck, shY - Math.cos(lean) * BODY.neck];
    var hx = neckTop[0] + dir * Math.sin(lean + (P.head || 0)) * BODY.head, hy = neckTop[1] - Math.cos(lean + (P.head || 0)) * BODY.head;
    ctx.strokeStyle = C.skin; ctx.lineWidth = 5; ctx.lineCap = 'round'; line(shX, shY, neckTop[0], neckTop[1]);
    drawHead(hx, hy, dir, lean + (P.head || 0), L, o.t || 0, P.hairSwing || 0);

    // front arm + held item
    var af = limb(shX, shY + 3, dir, P.armF[0] + lean, BODY.upper, P.armF[1] + lean, BODY.fore);
    stroke2(shX, shY + 3, af, 6, L.top, C.skin);
    ctx.fillStyle = C.skin; ctx.beginPath(); ctx.arc(af[2], af[3], 3.2, 0, Math.PI * 2); ctx.fill();
    if (o.item) o.item(af[2], af[3]);
    return { hand: [af[2], af[3]], head: [hx, hy], hip: [hipX, hipY] };
  }
  function shoe(x, y, dir, a) {
    ctx.fillStyle = C.shoe;
    ctx.beginPath(); ctx.ellipse(x + dir * 4, y + 1, 7, 3.6, 0, 0, Math.PI * 2); ctx.fill();
  }
  function shade(c, amt) {
    if (c.charAt(0) !== '#') return c;
    var v = hex(c).map(function (x) { return clamp(Math.round(x + (amt < 0 ? x * amt : (255 - x) * amt)), 0, 255); });
    return 'rgb(' + v.join(',') + ')';
  }
  function drawHead(x, y, dir, tilt, L, t, swing) {
    ctx.save();
    ctx.translate(x, y); ctx.rotate(dir * tilt * 0.6);
    // ponytail behind
    if (L.hairStyle === 'ponytail') {
      var sw = Math.sin(t * 6) * 3 * swing;
      ctx.fillStyle = L.hair;
      ctx.beginPath();
      ctx.moveTo(-dir * 6, -6);
      ctx.quadraticCurveTo(-dir * 20, -2 + sw, -dir * 16 + sw, 20);
      ctx.quadraticCurveTo(-dir * 12, 8, -dir * 4, 2);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = C.accent; ctx.beginPath(); ctx.arc(-dir * 9, -5, 2.4, 0, Math.PI * 2); ctx.fill(); // hair tie
    }
    // face
    ctx.fillStyle = C.skin;
    ctx.beginPath(); ctx.arc(0, 0, BODY.head, 0, Math.PI * 2); ctx.fill();
    // hair cap
    ctx.fillStyle = L.hair;
    ctx.beginPath();
    ctx.arc(0, -1, BODY.head + 1, Math.PI * 1.02, Math.PI * 1.98);
    ctx.quadraticCurveTo(dir * 2, -6, -dir * 10, 4);
    ctx.closePath(); ctx.fill();
    if (L.hairStyle === 'short') { ctx.beginPath(); ctx.arc(-dir * 2, -3, BODY.head, Math.PI, Math.PI * 2); ctx.fill(); }
    // eye + glasses
    ctx.fillStyle = '#1b1b2a';
    ctx.beginPath(); ctx.arc(dir * 5.5, -1, 1.3, 0, Math.PI * 2); ctx.fill();
    if (L.glasses) {
      ctx.strokeStyle = C.accent; ctx.lineWidth = 1.3;
      rr(dir * 2.5 - (dir < 0 ? 6.5 : 0), -4, 6.5, 5, 1.5); ctx.stroke();
      line(dir * 2.5, -2, -dir * 4, -3);
    }
    // smile
    ctx.strokeStyle = 'rgba(90,40,40,.7)'; ctx.lineWidth = 1.1;
    ctx.beginPath(); ctx.arc(dir * 6, 4, 2.4, 0.1 * Math.PI, 0.8 * Math.PI); ctx.stroke();
    ctx.restore();
  }

  /* Poses */
  var D = Math.PI / 180;
  function pStand() { return { legB: [0, 0], legF: [0, 0], armB: [0.05, 0.1], armF: [-0.05, 0.05] }; }
  function pWalk(ph) {
    var s = Math.sin(ph), c = Math.cos(ph);
    return {
      legF: [0.42 * s, 0.42 * s - 0.55 * Math.max(0, -c)],
      legB: [-0.42 * s, -0.42 * s - 0.55 * Math.max(0, c)],
      armF: [-0.45 * s, -0.45 * s + 0.35],
      armB: [0.45 * s, 0.45 * s + 0.35],
      lean: 0.06, hairSwing: 1
    };
  }
  /* lie = 1 flat on the bed, 0 sitting up on it */
  function pLie(seatY, lie) {
    return { hipY: seatY, lean: -lie * 1.42, legB: [88 * D, (88 - (1 - lie) * 84) * D], legF: [92 * D, (92 - (1 - lie) * 88) * D],
             armB: [0.25, 0.6], armF: [0.35 - lie * 0.2, 0.7], head: lie * 0.25 };
  }
  function pSit(seatY) { return { hipY: seatY, legB: [88 * D, 4 * D], legF: [92 * D, 0], armB: [0.2, 1.2], armF: [0.35, 1.3], lean: 0.05 }; }

  /* ── Props ─────────────────────────────────────────────── */
  function stroke(c, w) { ctx.strokeStyle = c || C.furniture; ctx.lineWidth = w || 2; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; }

  function bed(x, lamp) {
    stroke();
    ctx.fillStyle = C.fill;
    rr(x - 70, GROUND - 32, 150, 22, 4); ctx.fill(); ctx.stroke();           // mattress
    line(x - 72, GROUND - 52, x - 72, GROUND); line(x + 82, GROUND - 40, x + 82, GROUND); // head/foot boards
    line(x - 72, GROUND - 52, x - 64, GROUND - 52);
    ctx.fillStyle = C.paper; rr(x - 64, GROUND - 42, 30, 11, 5); ctx.fill(); ctx.stroke(); // pillow
    if (lamp) {
      stroke(C.furnitureDim); line(x - 100, GROUND, x - 100, GROUND - 46);
      ctx.fillStyle = C.accent2; ctx.beginPath(); ctx.moveTo(x - 110, GROUND - 46); ctx.lineTo(x - 90, GROUND - 46); ctx.lineTo(x - 95, GROUND - 60); ctx.lineTo(x - 105, GROUND - 60); ctx.fill();
      if (lamp > 0.05) { var gl = ctx.createRadialGradient(x - 100, GROUND - 46, 2, x - 100, GROUND - 46, 80); gl.addColorStop(0, 'rgba(252,211,77,' + 0.35 * lamp + ')'); gl.addColorStop(1, 'rgba(252,211,77,0)'); ctx.fillStyle = gl; ctx.fillRect(x - 180, GROUND - 126, 160, 160); }
    }
  }
  function blanket(x, k) {
    ctx.fillStyle = C.accent2; ctx.globalAlpha = 0.85;
    rr(x - 20, GROUND - 37, 96 - 40 * k, 14, 5); ctx.fill(); ctx.globalAlpha = 1;
  }
  function kitchen(x, t) {
    stroke(); ctx.fillStyle = C.fill;
    rr(x + 14, GROUND - 58, 96, 58, 4); ctx.fill(); ctx.stroke();            // counter
    line(x + 62, GROUND - 50, x + 62, GROUND - 6);
    ctx.fillStyle = C.furnitureDim; rr(x + 72, GROUND - 92, 26, 34, 4); ctx.fill();       // coffee machine
    ctx.fillStyle = C.accent; ctx.fillRect(x + 77, GROUND - 84, 16, 4);
    for (var i = 0; i < 3; i++) {                                             // plant
      ctx.strokeStyle = '#34d399'; ctx.lineWidth = 2;
      line(x + 30, GROUND - 58, x + 22 + i * 8, GROUND - 78 - (i % 2) * 6);
    }
    ctx.fillStyle = C.furniture; rr(x + 24, GROUND - 64, 12, 7, 2); ctx.fill();
  }
  function mug(x, y, steam, t) {
    ctx.fillStyle = C.paper; rr(x - 4, y - 9, 9, 10, 2); ctx.fill();
    ctx.strokeStyle = C.paper; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.arc(x + 6, y - 4, 3, -1.2, 1.2); ctx.stroke();
    if (steam) {
      ctx.strokeStyle = 'rgba(203,213,225,.65)'; ctx.lineWidth = 1.4;
      for (var i = 0; i < 2; i++) {
        var o = (t * 18 + i * 9) % 18;
        ctx.beginPath(); ctx.moveTo(x - 1 + i * 4, y - 12 - o);
        ctx.quadraticCurveTo(x + 3 + i * 4, y - 16 - o, x - 1 + i * 4, y - 20 - o); ctx.stroke();
      }
    }
  }
  function desk(x, t, typing) {
    stroke(); ctx.fillStyle = C.fill;
    rr(x - 10, GROUND - 62, 120, 7, 2); ctx.fill(); ctx.stroke();            // desk top
    line(x - 4, GROUND - 55, x - 4, GROUND); line(x + 104, GROUND - 55, x + 104, GROUND);
    // chair
    line(x - 46, GROUND - 44, x - 18, GROUND - 44); line(x - 44, GROUND - 44, x - 44, GROUND);
    line(x - 20, GROUND - 44, x - 20, GROUND); line(x - 46, GROUND - 44, x - 50, GROUND - 92);
    // laptop: screen faces her (left)
    ctx.fillStyle = C.screen; ctx.strokeStyle = C.furniture;
    ctx.beginPath(); ctx.moveTo(x + 6, GROUND - 64); ctx.lineTo(x + 52, GROUND - 64); ctx.lineTo(x + 58, GROUND - 112); ctx.lineTo(x + 10, GROUND - 112); ctx.closePath(); ctx.fill(); ctx.stroke();
    // mini dashboard on the screen: bars + a line
    for (var i = 0; i < 5; i++) {
      var bh = 8 + (Math.sin(t * 2.2 + i * 1.3) * 0.5 + 0.5) * (typing ? 22 : 8);
      ctx.fillStyle = i % 2 ? C.accent2 : C.accent;
      ctx.fillRect(x + 15 + i * 7, GROUND - 70 - bh, 4.5, bh);
    }
    ctx.strokeStyle = '#38bdf8'; ctx.lineWidth = 1.4; ctx.beginPath();
    for (var j = 0; j < 6; j++) { var px = x + 14 + j * 7.5, py = GROUND - 100 + Math.sin(t * 1.6 + j) * 4 - j * 1.2; j ? ctx.lineTo(px, py) : ctx.moveTo(px, py); }
    ctx.stroke();
    mug(x + 82, GROUND - 63, true, t);
    // desk lamp
    stroke(C.furnitureDim); line(x + 96, GROUND - 62, x + 96, GROUND - 96); line(x + 96, GROUND - 96, x + 80, GROUND - 104);
  }
  function whiteboard(x, k, t) {
    stroke(); ctx.fillStyle = C.paper;
    rr(x + 10, GROUND - 158, 120, 78, 4); ctx.fill(); ctx.stroke();
    line(x + 30, GROUND - 80, x + 22, GROUND); line(x + 110, GROUND - 80, x + 118, GROUND);
    // growing chart
    ctx.strokeStyle = '#be185d'; ctx.lineWidth = 2.4; ctx.beginPath();
    var pts = [[0, 0], [18, -10], [36, -6], [54, -24], [72, -20], [90, -40]];
    var n = Math.max(1, Math.floor(1 + k * (pts.length - 1)));
    pts.slice(0, n + 1).forEach(function (p, i) { var px = x + 22 + p[0], py = GROUND - 96 + p[1]; i ? ctx.lineTo(px, py) : ctx.moveTo(px, py); });
    ctx.stroke();
    ctx.fillStyle = '#fbbf24'; ctx.fillRect(x + 104, GROUND - 150, 18, 14);          // sticky notes
    ctx.fillStyle = '#93c5fd'; ctx.fillRect(x + 84, GROUND - 150, 16, 14);
  }
  function trophyStand(x, k) {
    stroke(); ctx.fillStyle = C.fill;
    rr(x + 24, GROUND - 46, 52, 46, 3); ctx.fill(); ctx.stroke();            // plinth
    ctx.fillStyle = C.accent; ctx.font = '700 11px Inter, sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('2nd', x + 50, GROUND - 18);
    // banner
    ctx.fillStyle = C.accent2; ctx.globalAlpha = 0.18; rr(x - 40, GROUND - 210, 180, 34, 6); ctx.fill(); ctx.globalAlpha = 1;
    ctx.fillStyle = C.accent2; ctx.font = '600 11px Inter, sans-serif'; ctx.fillText('AGENTIC AI HACKATHON', x + 50, GROUND - 189);
  }
  function trophy(x, y) {           // blue crystal on a clear block, like the real one
    ctx.fillStyle = 'rgba(226,232,245,.55)'; ctx.strokeStyle = 'rgba(226,232,245,.9)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(x - 6, y); ctx.lineTo(x + 6, y); ctx.lineTo(x + 4, y - 22); ctx.lineTo(x - 4, y - 22); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#3b82f6';
    ctx.beginPath(); ctx.moveTo(x - 8, y - 26); ctx.lineTo(x + 8, y - 26); ctx.lineTo(x, y - 16); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#93c5fd'; ctx.beginPath(); ctx.moveTo(x - 8, y - 26); ctx.lineTo(x + 8, y - 26); ctx.lineTo(x + 4, y - 31); ctx.lineTo(x - 4, y - 31); ctx.closePath(); ctx.fill();
  }
  var confetti = [];
  function burst(x, y) {
    confetti = [];
    for (var i = 0; i < 46; i++) confetti.push({ x: x, y: y, vx: (rand(i) - 0.5) * 150, vy: -80 - rand(i + 7) * 120, r: rand(i + 3) * 6, c: [C.accent, C.accent2, '#fbbf24', '#38bdf8'][i % 4], life: 1 });
  }
  function drawConfetti(dt) {
    confetti.forEach(function (p) {
      p.vy += 160 * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.r += dt * 6; p.life -= dt * 0.45;
      if (p.life <= 0) return;
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.r); ctx.globalAlpha = Math.max(0, p.life);
      ctx.fillStyle = p.c; ctx.fillRect(-3, -1.5, 6, 3); ctx.restore();
    });
    confetti = confetti.filter(function (p) { return p.life > 0 && p.y < GROUND + 10; });
  }
  function net(x) {
    stroke(); line(x, GROUND, x, GROUND - 78);
    ctx.strokeStyle = C.furnitureDim; ctx.lineWidth = 1;
    for (var y = GROUND - 76; y < GROUND - 44; y += 6) line(x - 2, y, x + 2, y);
    stroke(C.paper, 2); line(x - 2, GROUND - 78, x + 2, GROUND - 78);
  }
  function racket(x, y, ang) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(ang);
    stroke(C.text, 1.8); line(0, 0, 0, -14);
    ctx.strokeStyle = C.accent; ctx.lineWidth = 1.8; ctx.beginPath(); ctx.ellipse(0, -21, 5.5, 7.5, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
  }
  function easelProp(x, k) {
    stroke();
    line(x + 40, GROUND - 120, x + 22, GROUND); line(x + 40, GROUND - 120, x + 58, GROUND); line(x + 40, GROUND - 100, x + 40, GROUND);
    ctx.fillStyle = C.paper; rr(x + 12, GROUND - 124, 58, 50, 2); ctx.fill(); ctx.stroke();
    ctx.save(); ctx.beginPath(); ctx.rect(x + 13, GROUND - 123, 56 * k, 48); ctx.clip();      // painting appears left → right
    ctx.fillStyle = '#fbcfe8'; ctx.fillRect(x + 13, GROUND - 123, 56, 48);
    ctx.fillStyle = '#fbbf24'; ctx.beginPath(); ctx.arc(x + 52, GROUND - 108, 7, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#a78bfa'; ctx.beginPath(); ctx.moveTo(x + 13, GROUND - 76); ctx.lineTo(x + 34, GROUND - 102); ctx.lineTo(x + 50, GROUND - 84); ctx.lineTo(x + 69, GROUND - 76); ctx.fill();
    ctx.fillStyle = '#f472b6'; ctx.fillRect(x + 13, GROUND - 82, 56, 6);
    ctx.restore();
    ctx.fillStyle = C.furnitureDim; rr(x - 2, GROUND - 26, 20, 26, 2); ctx.fill();          // paint stool
  }
  function brush(x, y) { stroke(C.text, 1.6); line(x, y, x + 9, y - 7); ctx.fillStyle = C.accent; ctx.beginPath(); ctx.arc(x + 10, y - 8, 1.8, 0, Math.PI * 2); ctx.fill(); }
  function potteryProp(x, k, t) {
    stroke(); ctx.fillStyle = C.fill;
    rr(x - 34, GROUND - 30, 26, 6, 2); ctx.fill(); ctx.stroke();               // stool
    line(x - 30, GROUND - 24, x - 30, GROUND); line(x - 12, GROUND - 24, x - 12, GROUND);
    rr(x + 8, GROUND - 40, 50, 40, 4); ctx.fill(); ctx.stroke();              // wheel base
    ctx.fillStyle = C.furnitureDim; ctx.beginPath(); ctx.ellipse(x + 33, GROUND - 42, 22, 5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = C.furniture; ctx.lineWidth = 1;                            // spin marks
    for (var i = 0; i < 3; i++) { var a = t * 8 + i * 2.1; line(x + 33 + Math.cos(a) * 18, GROUND - 42 + Math.sin(a) * 4, x + 33 + Math.cos(a) * 12, GROUND - 42 + Math.sin(a) * 3); }
    var h = 8 + 26 * k;                                                          // clay pot rising
    ctx.fillStyle = '#c2703d';
    ctx.beginPath();
    ctx.moveTo(x + 24, GROUND - 44);
    ctx.quadraticCurveTo(x + 18, GROUND - 44 - h * 0.5, x + 28, GROUND - 44 - h);
    ctx.lineTo(x + 38, GROUND - 44 - h);
    ctx.quadraticCurveTo(x + 48, GROUND - 44 - h * 0.5, x + 42, GROUND - 44);
    ctx.closePath(); ctx.fill();
  }

  /* ── Captions + clock ──────────────────────────────────── */
  function fmtHour(h) {
    h = ((h % 24) + 24) % 24;
    var hh = Math.floor(h), mm = Math.floor((h - hh) * 60 / 5) * 5;
    return (hh < 10 ? '0' : '') + hh + ':' + (mm < 10 ? '0' : '') + mm;
  }
  function caption(st, alpha) {
    if (alpha <= 0.01) return;
    var text = st.label, time = fmtHour(st.hour);
    ctx.save(); ctx.globalAlpha = alpha;
    ctx.font = '600 15px Inter, sans-serif';
    var tw = ctx.measureText(text).width;
    ctx.font = '700 12px Inter, sans-serif';
    var tt = ctx.measureText(time).width;
    var w = tw + tt + 36, x = clamp(st.x + 30 - w / 2, camX + 8, camX + viewW - w - 8), y = GROUND - 262 + (1 - alpha) * 8;
    ctx.fillStyle = C.pill; ctx.strokeStyle = C.pillLine; ctx.lineWidth = 1.2;
    rr(x, y, w, 32, 16); ctx.fill(); ctx.stroke();
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillStyle = C.accent; ctx.font = '700 12px Inter, sans-serif'; ctx.fillText(time, x + 14, y + 16.5);
    ctx.fillStyle = C.text; ctx.font = '600 15px Inter, sans-serif'; ctx.fillText(text, x + 22 + tt, y + 16.5);
    ctx.restore();
  }
  function clock(hour) {
    var x = camX + 16, y = 16;
    ctx.save();
    ctx.fillStyle = C.pill; ctx.strokeStyle = C.pillLine; ctx.lineWidth = 1;
    rr(x, y, 96, 34, 9); ctx.fill(); ctx.stroke();
    var day = hour >= 6 && hour < 18.5;
    ctx.fillStyle = day ? '#fbbf24' : '#e2e8f5';
    ctx.beginPath(); ctx.arc(x + 17, y + 17, 6, 0, Math.PI * 2); ctx.fill();
    if (!day) { ctx.fillStyle = C.pill; ctx.beginPath(); ctx.arc(x + 20, y + 14, 5, 0, Math.PI * 2); ctx.fill(); }
    ctx.fillStyle = C.text; ctx.font = '700 15px Inter, sans-serif'; ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
    ctx.fillText(fmtHour(hour), x + 31, y + 18);
    ctx.restore();
  }

  /* ── Scene: everything for one moment in the loop ──────── */
  var ME = function () { return { top: C.top, pants: C.pants, hair: C.hair, hairStyle: 'ponytail', glasses: true }; };
  var burstDone = false;

  function draw(time, dt) {
    time = time || 0; dt = dt || 0;
    var S = stateAt(time), step = S.step, k = S.k, hour = S.hour;

    // where is she?
    var x, act = null;
    if (step.kind === 'walk') x = lerp(step.from, step.to, k);
    else if (step.kind === 'act') { x = step.st.sx; act = step.st.id; }
    else x = STATIONS[STATIONS.length - 1].x;

    // camera (only moves when the room is wider than the screen)
    if (viewW < WORLD_W) {
      var target = clamp(x - viewW * 0.42, 0, WORLD_W - viewW);
      camX = dt ? lerp(camX, target, Math.min(1, dt * 3)) : target;
    } else camX = (WORLD_W - viewW) / 2;

    ctx.save();
    ctx.translate(-camX, 0);
    ctx.clearRect(camX - 10, 0, viewW + 20, H);
    drawBackground(hour, time);

    var night = nightness(hour);
    var st = STATIONS;
    // props (static parts)
    bed(st[0].x, 0);
    kitchen(st[1].x, time);
    desk(st[2].x, time, act === 'desk');
    whiteboard(st[3].x, act === 'meeting' ? k : (time > steps.find(function (s) { return s.st && s.st.id === 'meeting'; }).t1 ? 1 : 0), time);
    trophyStand(st[4].x, k);
    net(st[5].x + 70);
    easelProp(st[6].x, act === 'paint' ? ease(k) : (hour > st[6].hour + 0.3 ? 1 : 0));
    potteryProp(st[7].x, act === 'pottery' ? ease(k) : (hour > st[7].hour + 0.3 ? 1 : 0), act === 'pottery' ? time : 0);
    bed(st[8].x, night);

    // the trophy waits on its plinth until she picks it up
    var holdingTrophy = act === 'trophy' && k > 0.18;
    if (!holdingTrophy && hour < st[4].hour) trophy(st[4].x + 50, GROUND - 46);
    if (!holdingTrophy && hour > st[4].hour + 0.3) trophy(st[4].x + 50, GROUND - 46);

    // teammates at the meeting (around from late morning to early afternoon)
    if (hour > 11 && hour < 13.5) {
      var mt = act === 'meeting' ? time : 0;
      drawPerson({ x: st[3].x + 160, ground: GROUND, dir: -1, t: mt, look: { top: C.mate1, pants: '#334155', hair: C.mateHair, hairStyle: 'short', glasses: false },
        pose: { legB: [0, 0], legF: [0.05, 0], armB: [0.1, 0.2], armF: [0.2, 0.9 + Math.sin(mt * 3) * 0.15] } });
      drawPerson({ x: st[3].x + 205, ground: GROUND, dir: -1, t: mt, look: { top: C.mate2, pants: '#3f3a5a', hair: C.mateHair, hairStyle: 'ponytail', glasses: false },
        pose: { legB: [0, 0], legF: [-0.05, 0], armB: [0.05, 0.1], armF: [-0.05, 0.6 + Math.sin(mt * 2.4 + 1) * 0.2] } });
    }
    // badminton partner
    var shuttleT = 0;
    if (hour > 17.4 && hour < 18.9) {
      var bt = act === 'badminton' ? time : 0;
      shuttleT = (bt * 0.9) % 2;
      var pSwing = shuttleT > 1.75 ? 1 : 0;
      drawPerson({ x: st[5].x + 145, ground: GROUND, dir: -1, t: bt, look: { top: C.mate1, pants: '#334155', hair: C.mateHair, hairStyle: 'short' },
        pose: { legB: [-0.25, -0.1], legF: [0.25, 0.1], armB: [0.2, 0.4], armF: [-2.2 + pSwing * 1.4, -2.6 + pSwing * 1.2] },
        item: function (hx, hy) { racket(hx, hy, -0.4 - pSwing * 0.8); } });
    }

    // ── her pose for this moment ──
    var pose, item = null, itemBack = null, dir = 1, lying = null;
    if (step.kind === 'walk') { pose = pWalk(time * 7.5); }
    else if (step.kind === 'fade') { lying = 1; }
    else switch (act) {
      case 'wake':
        if (k < 0.35) lying = 1;
        else if (k < 0.6) lying = 1 - ease((k - 0.35) / 0.25);
        else { var sk = (k - 0.6) / 0.4; pose = pStand(); pose.armF = [-2.7 * Math.sin(sk * Math.PI), -2.9 * Math.sin(sk * Math.PI)]; pose.armB = [-2.5 * Math.sin(sk * Math.PI), -2.8 * Math.sin(sk * Math.PI)]; }
        break;
      case 'coffee':
        pose = pStand();
        var sip = Math.max(0, Math.sin(k * Math.PI * 3));
        pose.armF = [0.2 - sip * 0.5, -1.8 - sip * 0.9];
        pose.head = -0.12 * sip;
        item = function (hx, hy) { mug(hx + 2, hy + 3, true, time); };
        break;
      case 'desk':
        pose = pSit(GROUND - 66);
        var tap = Math.sin(time * 16) * 0.08;
        pose.armF = [0.55, 1.55 + tap]; pose.armB = [0.45, 1.5 - tap]; pose.head = 0.12;
        break;
      case 'meeting':
        pose = pStand();
        var point = Math.sin(k * Math.PI);
        pose.armF = [0.4 + point * 1.6, 0.6 + point * 1.3];
        dir = 1;
        item = function (hx, hy) { stroke('#be185d', 2.2); line(hx, hy, hx + 6, hy - 3); };
        break;
      case 'trophy':
        if (k < 0.1) burstDone = false;
        pose = pStand();
        if (k < 0.18) { pose.armF = [0.3 + k * 4, 0.6 + k * 3]; }
        else {
          var lift = ease(clamp((k - 0.18) / 0.25, 0, 1)), bob = Math.sin(time * 6) * 0.08 * lift;
          pose.armF = [-0.2 - 2.6 * lift + bob, -0.3 - 2.6 * lift + bob];
          pose.armB = [-0.2 - 2.4 * lift - bob, -0.3 - 2.5 * lift - bob];
          pose.legF = [0.05, 0]; pose.legB = [-0.05, 0];
          item = function (hx, hy) { trophy(hx + 1, hy + 8); };
          if (!burstDone && k > 0.38) { burstDone = true; burst(x + 4, GROUND - 160); }
        }
        break;
      case 'badminton':
        var sw = shuttleT < 0.25 ? 1 : 0;
        pose = { legB: [-0.3, -0.12], legF: [0.3, 0.12], armB: [0.3, 0.5], armF: [-2.3 + sw * 1.5, -2.7 + sw * 1.3], hairSwing: 1 };
        item = function (hx, hy) { racket(hx, hy, 0.4 + sw * 0.9); };
        break;
      case 'paint':
        pose = pSit(GROUND - 30);
        var stroke2a = Math.sin(time * 5) * 0.25;
        pose.armF = [0.9 + stroke2a, 1.9 + stroke2a]; pose.lean = 0.12;
        item = function (hx, hy) { brush(hx, hy); };
        break;
      case 'pottery':
        pose = pSit(GROUND - 34);
        var cup = Math.sin(time * 4) * 0.06;
        pose.armF = [1.0 + cup, 1.75]; pose.armB = [0.95 - cup, 1.7]; pose.lean = 0.28;
        break;
      case 'sleep':
        if (k < 0.2) { var y2 = Math.sin(k / 0.2 * Math.PI); pose = pStand(); pose.armF = [-2.6 * y2, -2.9 * y2]; pose.armB = [-2.4 * y2, -2.8 * y2]; } // big yawn
        else lying = ease(clamp((k - 0.2) / 0.3, 0, 1));
        break;
    }

    // draw her (lying = in bed)
    var bedX = act === 'wake' || (step.kind !== 'walk' && step.st && step.st.id === 'wake') ? st[0].x : st[8].x;
    if (step.kind === 'fade' || act === 'sleep') bedX = st[8].x;
    if (lying != null) {
      // lying → sitting up: rotate a seated figure back onto the pillow
      drawPerson({ x: bedX - 4, ground: GROUND, dir: 1, t: time, look: ME(), pose: pLie(GROUND - 34, lying) });
      blanket(bedX, 1 - lying);
      if (lying > 0.9 && (act === 'sleep' || step.kind === 'fade')) {      // Zzz
        ctx.fillStyle = C.soft; ctx.font = '700 14px Inter, sans-serif'; ctx.textAlign = 'left';
        for (var z = 0; z < 3; z++) {
          var zt = (time * 0.8 + z * 0.33) % 1;
          ctx.globalAlpha = 1 - zt; ctx.fillText('z', bedX - 50 + zt * 22 + z * 4, GROUND - 60 - zt * 34 - z * 8);
        }
        ctx.globalAlpha = 1;
      }
    } else {
      drawPerson({ x: x, ground: GROUND, dir: dir, t: time, look: ME(), pose: pose, item: item, itemBack: itemBack });
    }
    if (act === 'wake' && k < 0.6) blanket(st[0].x, k > 0.35 ? ease((k - 0.35) / 0.25) : 0);

    // shuttlecock
    if (act === 'badminton') {
      var fx = x + 22, tx = st[5].x + 128, u = shuttleT < 1 ? shuttleT : 2 - shuttleT;
      var sx = lerp(fx, tx, u), sy = GROUND - 120 - Math.sin(u * Math.PI) * 90;
      ctx.fillStyle = C.paper; ctx.beginPath(); ctx.arc(sx, sy, 3, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = C.paper; ctx.lineWidth = 1; line(sx, sy, sx + (shuttleT < 1 ? -6 : 6), sy - 3);
    }
    drawConfetti(dt);

    // captions: fade in on arrival, out on leaving
    STATIONS.forEach(function (s) {
      var a = 0;
      if (step.kind === 'act' && step.st === s) a = Math.min(1, k * 6, (1 - k) * 6);
      caption(s, a);
    });
    clock(hour);

    // end of the day: fade to the page colour, then a new day starts
    if (step.kind === 'fade') { ctx.fillStyle = C.bg; ctx.globalAlpha = ease(k); ctx.fillRect(camX - 10, 0, viewW + 20, H); ctx.globalAlpha = 1; }
    if (step.kind === 'act' && step.st.id === 'wake' && k < 0.12) { ctx.fillStyle = C.bg; ctx.globalAlpha = 1 - k / 0.12; ctx.fillRect(camX - 10, 0, viewW + 20, H); ctx.globalAlpha = 1; }
    ctx.restore();
  }

  /* ── Loop (paused when hidden) ─────────────────────────── */
  var visible = true, start = null, prev = null, raf = null;
  function frame(now) {
    raf = null;
    if (!visible || document.hidden) { prev = null; return; }
    if (start == null) start = now;
    var dt = prev == null ? 0 : Math.min(0.05, (now - prev) / 1000);
    prev = now;
    draw(((now - start) / 1000) % LOOP, dt);
    raf = requestAnimationFrame(frame);
  }
  function kick() { if (!reduce && raf == null && visible && !document.hidden) raf = requestAnimationFrame(frame); }
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (entries) { visible = entries[0].isIntersecting; if (visible) kick(); }).observe(layer);
  }
  document.addEventListener('visibilitychange', kick);

  resize();
  if (reduce) {
    // One still frame: at the desk, mid-morning.
    var deskStep = steps.find(function (s) { return s.st && s.st.id === 'desk'; });
    draw((deskStep.t0 + deskStep.t1) / 2, 0);
  } else kick();

  // Let tests jump to a moment: window.dayStory.at('trophy', 0.6)
  window.dayStory = {
    loop: LOOP,
    at: function (id, frac) {
      var s = steps.find(function (x) { return x.st && x.st.id === id; });
      if (s) { start = performance.now() - (s.t0 + (s.t1 - s.t0) * (frac || 0.5)) * 1000; prev = null; }
    }
  };
})();
