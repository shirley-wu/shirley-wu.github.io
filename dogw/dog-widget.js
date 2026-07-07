/* Dog mascot widget — layered-canvas "fake live2d" animation.
 * Usage:  DogWidget.init({ headFollow: 0.5, ... });
 * Tune live from the browser console:  DogWidget.set({ headFollow: 0.8 })
 */
(function (global) {
  'use strict';

  var DEFAULTS = {
    /* ---- motion hyperparameters (same meaning as the demo sliders) ---- */
    headFollow: 0.5,   // 0..2  how far the head/body leans toward the mouse
    furSway:    1.0,   // 0..2.5  ripple through the head fur
    blinkEvery: 4,     // seconds (average) between blinks
    panting:    0.6,   // 0..1.5  tongue bob amount
    breathing:  1.0,   // 0..2  chest rise amount
    tailWag:    1.0,   // 0..2  wag strength (hover over the dog to trigger)
    idleWander: true,  // look around on its own when the mouse is idle

    /* ---- placement ---- */
    width:  340,       // CSS px of the whole canvas (dog is ~90% of it)
    maxScreenFrac: 0.15, // never wider than this fraction of the window (phones)
    right:  0,         // px from window right edge
    bottom: 0,         // px from window bottom edge
    zIndex: 9999,
    assetPath: 'dogw/assets/'
  };

  // source-space geometry (must match the prepared assets)
  var W = 550, H = 541, GROUND = 500;
  var PADX = 30, PADT = 22, PADB = 8, CW = W + 2 * PADX, CH = H + PADT + PADB;
  var POS = { eyeL: [46, 51], eyeR: [106, 53], muzzle: [44, 82], tongue: [62, 121], tail: [330, 360] };
  var TAIL_ROOT = 55;

  var S = {}, img = {}, cv, ctx, dpr;
  var spring = { x: 0, y: 0 }, target = { x: 0, y: 0 }, lastMouse = -1e9;
  var blink = { t: 1e9, dur: 0.13, next: 2.0 };
  var wagAmp = 0, wagUntil = -1e9, nextAutoWag = 5, wagPhase = 0, pantPhase = 0;
  var prev = 0;

  function now() { return performance.now() / 1000; }
  function applySize() {
    var w = Math.min(S.width, Math.round(global.innerWidth * S.maxScreenFrac));
    cv.style.width = w + 'px';
    cv.style.height = Math.round(w * CH / CW) + 'px';
  }
  function wBody(y) { var g = Math.max(0, Math.min(1, (460 - y) / 390)); return Math.pow(g, 1.4); }
  function wHead(y) { return y < 210 ? Math.pow((210 - y) / 210, 1.2) : 0; }
  function dxRow(y, hx, swayT) {
    return hx * (0.35 * wBody(y) + 0.75 * wHead(y)) + S.furSway * 1.4 * Math.sin(swayT + y * 0.05) * wHead(y);
  }
  function dyRow(y, hy, headBob) { return hy * (0.25 * wBody(y) + 0.65 * wHead(y)) + headBob * wHead(y); }

  function onMouse(mx, my) {
    var r = cv.getBoundingClientRect();
    var cx = r.left + r.width * 0.2, cy = r.top + r.height * 0.15;
    target.x = Math.max(-1, Math.min(1, (mx - cx) / (global.innerWidth * 0.4)));
    target.y = Math.max(-1, Math.min(1, (my - cy) / (global.innerHeight * 0.45)));
    lastMouse = now();
    // hovering over the dog makes him wag (canvas is pointer-events:none,
    // so this is done by coordinates, without stealing any clicks)
    if (mx >= r.left && mx <= r.right && my >= r.top && my <= r.bottom) wagUntil = now() + 2.5;
  }

  function frame() {
    var t = now(), dt = Math.min(0.05, t - prev); prev = t;

    if (S.idleWander && t - lastMouse > 2.5) {
      target.x = 0.5 * Math.sin(t * 0.33) + 0.22 * Math.sin(t * 0.71 + 1.3);
      target.y = 0.22 * Math.sin(t * 0.23 + 0.8) + 0.1 * Math.sin(t * 0.57);
    }
    var k = 1 - Math.exp(-dt * 5.5);
    spring.x += (target.x - spring.x) * k;
    spring.y += (target.y - spring.y) * k;

    blink.t += dt;
    if (blink.t > blink.next) {
      blink.t = 0; blink.next = S.blinkEvery * (0.6 + Math.random() * 0.9);
      if (Math.random() < 0.18) blink.next = 0.25;
    }
    var lid = 0;
    if (blink.t < blink.dur * 2) lid = Math.sin(Math.PI * Math.min(1, blink.t / (blink.dur * 2)));

    if (S.idleWander && t > nextAutoWag) { wagUntil = t + 1.2 + Math.random() * 1.8; nextAutoWag = t + 6 + Math.random() * 10; }
    wagAmp += ((t < wagUntil ? 1 : 0) - wagAmp) * (1 - Math.exp(-dt * 6));
    wagPhase += dt * 2 * Math.PI * 3.1 * (0.4 + 0.6 * wagAmp);
    var wag = S.tailWag * wagAmp * 15 * Math.sin(wagPhase) + S.tailWag * 1.2 * Math.sin(t * 1.1);

    pantPhase += dt * 2 * Math.PI * 1.9;
    var pantDy = S.panting * 1.7 * (0.5 - 0.5 * Math.cos(pantPhase));
    var breathS = 1 + 0.010 * S.breathing * Math.sin(t * 2 * Math.PI / 3.4);
    var headBob = S.breathing * 1.1 * Math.sin(t * 2 * Math.PI / 3.4 - 0.7);

    var hx = spring.x * 11 * S.headFollow, hy = spring.y * 7 * S.headFollow;
    var swayT = t * 1.15;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, CW, CH);
    ctx.translate(PADX, PADT);
    ctx.translate(W / 2, GROUND); ctx.scale(1, breathS); ctx.translate(-W / 2, -GROUND);

    // tail (behind body), column-warped from the root outward
    var tw = img.tail.naturalWidth, th = img.tail.naturalHeight;
    var tdx = dxRow(400, hx, swayT);
    for (var x = 0; x < tw; x += 2) {
      var u = Math.max(0, (x - TAIL_ROOT) / (tw - TAIL_ROOT));
      var tdy = wag * Math.pow(u, 1.6);
      ctx.drawImage(img.tail, x, 0, 4, th, POS.tail[0] + x + tdx * (1 - u * 0.5), POS.tail[1] + tdy, 4, th);
    }
    // body: row-shear warp — one surface, one silhouette
    for (var y = 0; y < H; y += 2) {
      ctx.drawImage(img.base, 0, y, W, 4, dxRow(y, hx, swayT), y + dyRow(y, hy, headBob), W, 4);
    }
    // interior patches with slightly deeper parallax
    var mdx = dxRow(120, hx, swayT) + hx * 0.25, mdy = dyRow(120, hy, headBob) + hy * 0.18;
    ctx.drawImage(img.muzzle, POS.muzzle[0] + mdx, POS.muzzle[1] + mdy);
    ctx.drawImage(img.tongue, POS.tongue[0] + mdx, POS.tongue[1] + mdy + pantDy);

    var edx = dxRow(65, hx, swayT) + hx * 0.3, edy = dyRow(65, hy, headBob) + hy * 0.22;
    var eyes = [[POS.eyeL, img.eyeL], [POS.eyeR, img.eyeR]], i, p, im2, w2, h2, pv;
    for (i = 0; i < 2; i++) {
      p = eyes[i][0]; im2 = eyes[i][1];
      w2 = im2.naturalWidth; h2 = im2.naturalHeight; pv = p[1] + h2 * 0.62;
      ctx.save();
      ctx.translate(p[0] + edx + w2 / 2, pv + edy);
      ctx.scale(1, Math.max(0.05, 1 - lid));
      ctx.drawImage(im2, -w2 / 2, -h2 * 0.62);
      ctx.restore();
    }
    if (lid > 0.65) {
      ctx.strokeStyle = 'rgba(24,15,8,' + ((lid - 0.65) / 0.35).toFixed(3) + ')';
      ctx.lineWidth = 2; ctx.lineCap = 'round';
      for (i = 0; i < 2; i++) {
        p = eyes[i][0]; im2 = eyes[i][1];
        w2 = im2.naturalWidth; pv = p[1] + im2.naturalHeight * 0.62 + edy;
        ctx.beginPath();
        ctx.moveTo(p[0] + 3 + edx, pv);
        ctx.quadraticCurveTo(p[0] + w2 / 2 + edx, pv + 3, p[0] + w2 - 3 + edx, pv);
        ctx.stroke();
      }
    }
    requestAnimationFrame(frame);
  }

  function init(cfg) {
    if (!document.body) {
      document.addEventListener('DOMContentLoaded', function () { init(cfg); });
      return;
    }
    cfg = cfg || {};
    for (var key in DEFAULTS) S[key] = (key in cfg) ? cfg[key] : DEFAULTS[key];
    if (global.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) S.idleWander = false;

    cv = document.createElement('canvas');
    dpr = Math.min(2, global.devicePixelRatio || 1);
    cv.width = CW * dpr; cv.height = CH * dpr;
    cv.setAttribute('aria-hidden', 'true');
    cv.style.cssText = 'position:fixed;right:' + S.right + 'px;bottom:' + S.bottom +
      'px;z-index:' + S.zIndex + ';pointer-events:none;background:transparent;';
    applySize();
    global.addEventListener('resize', applySize);
    document.body.appendChild(cv);
    ctx = cv.getContext('2d');

    global.addEventListener('mousemove', function (e) { onMouse(e.clientX, e.clientY); });
    global.addEventListener('touchmove', function (e) {
      if (e.touches[0]) onMouse(e.touches[0].clientX, e.touches[0].clientY);
    }, { passive: true });

    var names = ['base', 'tail', 'eyeL', 'eyeR', 'muzzle', 'tongue'];
    var files = ['base.png', 'tail.png', 'eye_l.png', 'eye_r.png', 'muzzle.png', 'tongue.png'];
    var loaded = 0;
    names.forEach(function (n, idx) {
      img[n] = new Image();
      img[n].onload = function () { if (++loaded === names.length) { prev = now(); requestAnimationFrame(frame); } };
      img[n].src = S.assetPath + files[idx];
    });
  }

  // live tuning from the console, e.g. DogWidget.set({ headFollow: 0.8 })
  function set(cfg) { for (var key in cfg) if (key in S) S[key] = cfg[key]; return JSON.parse(JSON.stringify(S)); }

  global.DogWidget = { init: init, set: set };
})(window);
