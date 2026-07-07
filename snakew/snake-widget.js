/* Snake-in-the-bushes widget — shadow only until the mouse comes near;
 * hanging leaves fade in and rustle, and the snake pops out if you linger.
 * Usage:  SnakeWidget.init({ revealRadius: 280, ... });
 * Live tuning from the console:  SnakeWidget.set({ popDelay: 0.3 })
 */
(function (global) {
  'use strict';

  var DEFAULTS = {
    /* ---- behavior ---- */
    revealRadius: 280,  // px: mouse closer than this -> leaves appear
    popRadius:    140,  // px: mouse closer than this (for popDelay s) -> snake pops out
    popDelay:     0.7,  // seconds of lingering before the snake shows
    rustle:       1.0,  // 0..2.5 leaf shake amount
    shyDelay:     1.0,  // seconds after mouse leaves before hiding again

    /* ---- placement ---- */
    width:  220,        // CSS px of the bush
    leafShadowGap: 16,  // px of air between the hanging bush and its shadow
    maxScreenFrac: 0.15,// never wider than this fraction of the window
    left:   0,          // px from window left edge
    bottom: 0,          // px from window bottom edge
    zIndex: 9998,
    assetPath: 'snakew/assets/'
  };

  var S = {}, root, wrap, leavesImg, snakeImg, shadowImg;
  var dist = 1e9, nearSince = -1, awaySince = 0, snakeOn = false, leavesOn = false;
  var excite = 0, popKick = 0, prev = 0, reduced = false;

  function now() { return performance.now() / 1000; }

  function applySize() {
    var w = Math.min(S.width, Math.round(global.innerWidth * S.maxScreenFrac));
    root.style.width = w + 'px';
    // bush (tallest asset: snake, 558/400) + configurable gap + shadow (85% wide, 219/400)
    root.style.height = Math.round(w * 1.395 + S.leafShadowGap + w * 0.85 * 219 / 400) + 'px';
  }

  function onPoint(mx, my) {
    var r = root.getBoundingClientRect();
    dist = Math.hypot(mx - (r.left + r.width / 2), my - (r.top + r.height * 0.45));
  }

  function frame() {
    var t = now(), dt = Math.min(0.05, t - prev); prev = t;
    var inR1 = dist < S.revealRadius, inR2 = dist < S.popRadius;

    if (inR1) { leavesOn = true; awaySince = t; }
    else if (t - awaySince > S.shyDelay) leavesOn = false;

    if (inR2) {
      if (nearSince < 0) nearSince = t;
      if (t - nearSince > S.popDelay && !snakeOn && leavesOn) {
        snakeOn = true; popKick = 1; excite = Math.max(excite, 1);
      }
    } else {
      nearSince = -1;
      if (snakeOn && dist > S.popRadius * 1.3) { snakeOn = false; excite = Math.max(excite, 0.6); }
    }
    if (!leavesOn) snakeOn = false;

    leavesImg.style.opacity = (leavesOn && !snakeOn) ? 1 : 0;
    snakeImg.style.opacity = (leavesOn && snakeOn) ? 1 : 0;

    excite = Math.max(0, excite - dt * 1.4);
    popKick = Math.max(0, popKick - dt * 3.5);
    var amp = S.rustle * ((leavesOn ? 0.3 : 0) + excite * 1.6) * (reduced ? 0.3 : 1);
    if (leavesOn && !snakeOn && inR1) {
      var p = 1 - Math.min(1, Math.max(0, (dist - S.popRadius) / (S.revealRadius - S.popRadius)));
      excite = Math.max(excite, p * 0.5);
    }
    var rot = amp * 1.1 * Math.sin(t * 13) + amp * 0.5 * Math.sin(t * 7.3 + 1);
    var skew = amp * 0.7 * Math.sin(t * 11 + 2);
    var pop = 1 + popKick * 0.07 * Math.sin(popKick * Math.PI);
    wrap.style.transform = 'rotate(' + rot + 'deg) skewX(' + skew + 'deg) scale(' + pop.toFixed(4) + ')';

    requestAnimationFrame(frame);
  }

  function init(cfg) {
    if (!document.body) {
      document.addEventListener('DOMContentLoaded', function () { init(cfg); });
      return;
    }
    cfg = cfg || {};
    for (var key in DEFAULTS) S[key] = (key in cfg) ? cfg[key] : DEFAULTS[key];
    reduced = global.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

    root = document.createElement('div');
    root.setAttribute('aria-hidden', 'true');
    root.style.cssText = 'position:fixed;left:' + S.left + 'px;bottom:' + S.bottom +
      'px;z-index:' + S.zIndex + ';pointer-events:none;';

    // hanging bush: leaves anchored to the TOP, shadow separate on the ground below
    shadowImg = new Image(); shadowImg.src = S.assetPath + 'shadow.png';
    shadowImg.style.cssText = 'position:absolute;left:50%;bottom:0;transform:translateX(-50%);width:85%;';
    wrap = document.createElement('div');
    wrap.style.cssText = 'position:absolute;inset:0;transform-origin:50% 4%;';
    leavesImg = new Image(); leavesImg.src = S.assetPath + 'leaves.png';
    snakeImg = new Image(); snakeImg.src = S.assetPath + 'snake.png';
    var imgCss = 'position:absolute;left:50%;top:0;transform:translateX(-50%);width:100%;' +
      'opacity:0;transition:opacity .28s;';
    leavesImg.style.cssText = imgCss;
    snakeImg.style.cssText = imgCss;
    wrap.appendChild(leavesImg); wrap.appendChild(snakeImg);
    root.appendChild(shadowImg); root.appendChild(wrap);
    document.body.appendChild(root);
    applySize();
    global.addEventListener('resize', applySize);

    global.addEventListener('mousemove', function (e) { onPoint(e.clientX, e.clientY); });
    global.addEventListener('touchmove', function (e) {
      if (e.touches[0]) onPoint(e.touches[0].clientX, e.touches[0].clientY);
    }, { passive: true });

    prev = now();
    requestAnimationFrame(frame);
  }

  function set(cfg) {
    for (var key in cfg) if (key in S) S[key] = cfg[key];
    if (root) applySize();
    return JSON.parse(JSON.stringify(S));
  }

  global.SnakeWidget = { init: init, set: set };
})(window);
