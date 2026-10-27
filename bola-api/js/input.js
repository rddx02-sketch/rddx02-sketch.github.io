/* Bola Api Arena — masukan: layar sentuh (joystick + tombol), keyboard yang bisa diatur, dan stik PS / gamepad */
(function (root) {
  'use strict';
  var BA = root.BA, U = BA.U;
  var I = BA.Input = {
    jx: 0, jy: 0, kx: 0, ky: 0, sx: 0, sy: 0, zc: 0, zr: 1,
    passSeq: 0, gocekSeq: 0, switchSeq: 0, shootSeq: 0, skipSeq: 0,
    shootHeld: false, chargeStart: 0, charge: 0, lastCharge: 0, sprint: false,
    autoSprint: true, sprintBtn: false, enabled: false, cine: false,
    onPause: null, onSkip: null, onCam: null, onDevice: null, onNav: null, onOk: null, onBack: null, onPadChange: null,
    joy: { id: null, ox: 0, oy: 0, x: 0, y: 0, active: false },
    device: 'touch', rumbleOn: true, deadzone: 0.2,
    padOk: false, padId: '', padIdx: null, padStyleCur: 'ps', cap: null
  };
  var CHARGE_MS = 1100;

  function now() { return (root.performance && root.performance.now) ? root.performance.now() : Date.now(); }

  /* ---------- daftar aksi & tombol bawaan ---------- */
  I.ACTIONS = [
    { id: 'up', n: 'Gerak ke atas' }, { id: 'down', n: 'Gerak ke bawah' }, { id: 'left', n: 'Gerak ke kiri' }, { id: 'right', n: 'Gerak ke kanan' },
    { id: 'sprint', n: 'Sprint (tahan)' }, { id: 'pass', n: 'Oper / lempar bola' }, { id: 'shoot', n: 'Tendang (tahan, lepas)' },
    { id: 'gocek', n: 'Gocek / rebut bola' }, { id: 'switch', n: 'Ganti pemain' }, { id: 'cam', n: 'Ganti kamera' },
    { id: 'skip', n: 'Lewati adegan' }, { id: 'pause', n: 'Jeda' }
  ];
  I.DEF_KEYS = {
    up: ['KeyW', 'ArrowUp'], down: ['KeyS', 'ArrowDown'], left: ['KeyA', 'ArrowLeft'], right: ['KeyD', 'ArrowRight'],
    sprint: ['ShiftLeft', 'ShiftRight'], pass: ['KeyJ', ''], shoot: ['KeyK', ''], gocek: ['KeyL', ''], switch: ['KeyI', ''],
    cam: ['KeyC', ''], skip: ['Space', ''], pause: ['Escape', 'KeyP']
  };
  /* indeks tombol "standard gamepad": 0 ✕, 1 ○, 2 □, 3 △, 4 L1, 5 R1, 6 L2, 7 R2, 8 SHARE, 9 OPTIONS, 10 L3, 11 R3, 12-15 D-pad */
  I.DEF_PAD = {
    up: [12, -1], down: [13, -1], left: [14, -1], right: [15, -1], sprint: [5, 7], pass: [0, -1], shoot: [2, -1],
    gocek: [1, -1], switch: [3, 4], cam: [11, -1], skip: [8, -1], pause: [9, -1]
  };
  var BLOCKED = { Tab: 1, MetaLeft: 1, MetaRight: 1, ContextMenu: 1, F5: 1, F11: 1, F12: 1, OSLeft: 1, OSRight: 1 };
  I.keys = {}; I.pad = {};

  function cleanKeys(src) {
    var out = {};
    I.ACTIONS.forEach(function (a) {
      var v = src && Array.isArray(src[a.id]) ? src[a.id] : I.DEF_KEYS[a.id];
      var arr = [0, 1].map(function (i) { var c = v[i]; return (typeof c === 'string' && /^[A-Za-z0-9]{1,24}$/.test(c) && !BLOCKED[c]) ? c : ''; });
      out[a.id] = arr;
    });
    return out;
  }
  function cleanPad(src) {
    var out = {};
    I.ACTIONS.forEach(function (a) {
      var v = src && Array.isArray(src[a.id]) ? src[a.id] : I.DEF_PAD[a.id];
      out[a.id] = [0, 1].map(function (i) { var b = v[i]; return (typeof b === 'number' && b >= 0 && b < 32 && b === Math.floor(b)) ? b : -1; });
    });
    return out;
  }
  I.cleanKeys = cleanKeys; I.cleanPad = cleanPad;

  var keyAct = {}, padAct = {};
  function rebuild() {
    keyAct = {}; padAct = {};
    I.ACTIONS.forEach(function (a) {
      I.keys[a.id].forEach(function (c) { if (c) (keyAct[c] = keyAct[c] || []).push(a.id); });
      I.pad[a.id].forEach(function (b) { if (b >= 0) (padAct[b] = padAct[b] || []).push(a.id); });
    });
  }
  I.setBindings = function (keys, pad) { I.keys = cleanKeys(keys); I.pad = cleanPad(pad); rebuild(); };
  I.setBindings(null, null);

  /* status tiap aksi: berapa tombol keyboard (k) / stik (p) yang sedang ditekan */
  var st = {};
  I.ACTIONS.forEach(function (a) { st[a.id] = { k: 0, p: 0 }; });
  function held(a) { var s = st[a]; return s.k + s.p > 0; }
  I.held = held;

  /* ---------- nama tombol ---------- */
  var KEY_NAMES = { ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→', ShiftLeft: 'Shift Kiri', ShiftRight: 'Shift Kanan', ControlLeft: 'Ctrl Kiri', ControlRight: 'Ctrl Kanan',
    AltLeft: 'Alt Kiri', AltRight: 'Alt Kanan', Space: 'Spasi', Escape: 'Esc', Enter: 'Enter', NumpadEnter: 'Num Enter', Backspace: '⌫', CapsLock: 'Caps', Semicolon: ';', Quote: "'",
    Comma: ',', Period: '.', Slash: '/', Backslash: '\\', BracketLeft: '[', BracketRight: ']', Minus: '-', Equal: '=', Backquote: '`', Insert: 'Ins', Delete: 'Del', Home: 'Home', End: 'End', PageUp: 'PgUp', PageDown: 'PgDn' };
  I.keyName = function (c) {
    if (!c) return '—';
    if (KEY_NAMES[c]) return KEY_NAMES[c];
    if (/^Key[A-Z]$/.test(c)) return c.slice(3);
    if (/^Digit\d$/.test(c)) return c.slice(5);
    if (/^Numpad/.test(c)) return 'Num ' + c.slice(6);
    return c;
  };
  var PS_NAMES = ['✕', '○', '□', '△', 'L1', 'R1', 'L2', 'R2', 'SHARE', 'OPTIONS', 'L3', 'R3', 'D-pad ↑', 'D-pad ↓', 'D-pad ←', 'D-pad →', 'PS', 'TOUCHPAD'];
  var XB_NAMES = ['A', 'B', 'X', 'Y', 'LB', 'RB', 'LT', 'RT', 'VIEW', 'MENU', 'LS', 'RS', 'D-pad ↑', 'D-pad ↓', 'D-pad ←', 'D-pad →', 'XBOX'];
  I.padStyle = function (gp) {
    var id = String((gp && gp.id) || '').toLowerCase();
    if (/xbox|xinput|045e|microsoft/.test(id)) return 'xbox';
    return 'ps';
  };
  I.padName = function (b, style) {
    if (b == null || b < 0) return '—';
    var list = (style || I.padStyleCur) === 'xbox' ? XB_NAMES : PS_NAMES;
    return list[b] || ('Tombol ' + b);
  };

  /* ---------- pengaturan ulang tombol ---------- */
  I.capture = function (kind, action, slot, cb) {
    I.cancelCapture();
    I.cap = { kind: kind, action: action, slot: slot === 1 ? 1 : 0, cb: cb, t: now() };
  };
  I.cancelCapture = function () { if (I.cap) { var c = I.cap; I.cap = null; if (c.cb) c.cb(null); } };
  function assign(kind, action, slot, val) {
    var map = kind === 'key' ? I.keys : I.pad, none = kind === 'key' ? '' : -1, moved = null;
    if (!map[action]) return null;
    if (val !== none) {
      I.ACTIONS.forEach(function (a) {
        var arr = map[a.id];
        for (var i = 0; i < 2; i++) if (arr[i] === val && !(a.id === action && i === slot)) { arr[i] = none; moved = a.id; }
      });
    }
    map[action][slot] = val;
    rebuild();
    return moved;
  }
  function finishCap(val) {
    var c = I.cap; I.cap = null;
    var moved = assign(c.kind, c.action, c.slot, val);
    I.releaseAll();
    if (c.cb) c.cb({ val: val, moved: moved });
  }

  /* ---------- perangkat aktif (sentuh / keyboard / stik) ---------- */
  function setDevice(d) {
    if (I.device === d) return;
    I.device = d;
    if (document.body) document.body.setAttribute('data-dev', d);
    if (I.onDevice) I.onDevice(d);
  }
  I.setDevice = setDevice;

  /* ---------- inisialisasi ---------- */
  I.init = function (els) {
    I.els = els;
    var coarse = false;
    try { coarse = !!(root.matchMedia && root.matchMedia('(pointer: coarse)').matches) || (navigator.maxTouchPoints > 0 && !(root.matchMedia && root.matchMedia('(pointer: fine)').matches)); } catch (e) { coarse = false; }
    I.device = coarse ? 'touch' : 'kb';
    if (document.body) document.body.setAttribute('data-dev', I.device);
    var zone = els.joyZone;
    zone.addEventListener('pointerdown', joyDown, { passive: false });
    root.addEventListener('pointermove', joyMove, { passive: false });
    root.addEventListener('pointerup', joyUp, { passive: false });
    root.addEventListener('pointercancel', joyUp, { passive: false });
    root.addEventListener('pointerdown', function (e) {
      if (e.pointerType === 'touch' || e.pointerType === 'pen') setDevice('touch');
      if (document.body) document.body.classList.remove('kbnav');
    }, { capture: true, passive: true });
    bindBtn(els.shoot, function () { if (I.cine) { skipNow(); return; } shootDown(); }, function () { shootUp(); });
    bindBtn(els.pass, function () { if (I.cine) { skipNow(); return; } I.passSeq++; tick(); });
    bindBtn(els.gocek, function () { if (I.cine) { skipNow(); return; } I.gocekSeq++; I.gocekBtn = true; I.gocekAt = now(); tick(); }, function () { I.gocekBtn = false; });
    bindBtn(els.sw, function () { I.switchSeq++; tick(); });
    bindBtn(els.sprint, function () { I.sprintBtn = true; tick(); }, function () { I.sprintBtn = false; });
    if (els.skip) els.skip.addEventListener('pointerdown', function (e) { e.preventDefault(); skipNow(); });
    root.addEventListener('keydown', keyDown);
    root.addEventListener('keyup', keyUp);
    root.addEventListener('blur', function () { I.releaseAll(); });
    // stik
    try { I.padOk = typeof navigator.getGamepads === 'function'; if (I.padOk) navigator.getGamepads(); } catch (e) { I.padOk = false; I.padErr = true; }
    root.addEventListener('gamepadconnected', function () { I.padOk = true; });
    root.addEventListener('gamepaddisconnected', function () { /* status diperbarui saat polling */ });
  };

  function tick() { if (BA.Audio) BA.Audio.init(); if (navigator.vibrate && I.rumbleOn) { try { navigator.vibrate(8); } catch (e) { /* abaikan */ } } }
  function skipNow() { I.skipSeq++; if (I.onSkip) I.onSkip(); }

  function bindBtn(el, down, up) {
    if (!el) return;
    var active = null;
    el.addEventListener('pointerdown', function (e) {
      if (!I.enabled || I.editing) return;
      e.preventDefault(); e.stopPropagation();
      active = e.pointerId;
      try { el.setPointerCapture(e.pointerId); } catch (er) { /* abaikan */ }
      el.classList.add('on');
      down();
    }, { passive: false });
    var end = function (e) {
      if (active === null || (e && e.pointerId !== active)) return;
      active = null;
      el.classList.remove('on');
      if (up) up();
    };
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', end);
    el.addEventListener('lostpointercapture', end);
    el.addEventListener('contextmenu', function (e) { e.preventDefault(); });
  }

  function shootDown() {
    if (I.shootHeld) return;
    I.shootHeld = true; I.chargeStart = now(); I.charge = 0;
    tick();
  }
  function shootUp() {
    if (!I.shootHeld) return;
    I.charge = Math.min(1.2, (now() - I.chargeStart) / CHARGE_MS);
    I.lastCharge = I.charge;
    I.shootHeld = false;
    I.shootSeq++;
  }
  I.cancelShoot = function () { I.shootHeld = false; I.charge = 0; };
  I.setCine = function (on) {
    on = !!on;
    if (on && !I.cine) I.cancelShoot();
    I.cine = on;
  };

  /* ---------- joystick sentuh ---------- */
  function joyDown(e) {
    if (!I.enabled || I.editing || I.joy.id !== null) return;
    e.preventDefault();
    I.joy.id = e.pointerId; I.joy.active = true;
    I.joy.ox = e.clientX; I.joy.oy = e.clientY; I.joy.x = e.clientX; I.joy.y = e.clientY;
    if (BA.Audio) BA.Audio.init();
    drawJoy();
  }
  function joyMove(e) {
    if (e.pointerId !== I.joy.id) return;
    e.preventDefault();
    I.joy.x = e.clientX; I.joy.y = e.clientY;
    drawJoy();
  }
  function joyUp(e) {
    if (e.pointerId !== I.joy.id) return;
    I.joy.id = null; I.joy.active = false;
    I.jx = 0; I.jy = 0;
    drawJoy();
  }
  function drawJoy() {
    var j = I.joy, R = 56;
    var dx = j.x - j.ox, dy = j.y - j.oy, d = Math.sqrt(dx * dx + dy * dy);
    if (d > R) { dx = dx / d * R; dy = dy / d * R; }
    if (j.active) { I.jx = dx / R; I.jy = dy / R; }
    var base = I.els && I.els.joyBase, knob = I.els && I.els.joyKnob;
    if (!base) return;
    if (!j.active) { base.classList.remove('show'); return; }
    base.classList.add('show');
    base.style.transform = 'translate(' + (j.ox - 64) + 'px,' + (j.oy - 64) + 'px)';
    knob.style.transform = 'translate(' + dx + 'px,' + dy + 'px)';
  }

  /* ---------- aksi ---------- */
  function press(a, src) {
    var s = st[a]; if (!s) return;
    var was = s.k + s.p > 0;
    if (src === 'k') s.k++; else s.p++;
    if (!was) fire(a, true);
  }
  function release(a, src) {
    var s = st[a]; if (!s) return;
    var was = s.k + s.p > 0;
    if (src === 'k') { if (s.k <= 0) return; s.k--; } else { if (s.p <= 0) return; s.p--; }
    if (was && s.k + s.p === 0) fire(a, false);
  }
  function fire(a, down) {
    if (a === 'pause') { if (down && I.onPause) I.onPause(); return; }
    if (!I.enabled) return;
    if (I.cine) {
      if (down && (a === 'skip' || a === 'pass' || a === 'shoot' || a === 'gocek')) skipNow();
      return;
    }
    switch (a) {
      case 'pass': if (down) I.passSeq++; break;
      case 'gocek': if (down) { I.gocekSeq++; I.gocekAt = now(); } break;
      case 'switch': if (down) I.switchSeq++; break;
      case 'shoot': if (down) shootDown(); else shootUp(); break;
      case 'skip': if (down) skipNow(); break;
      case 'cam': if (down && I.onCam) I.onCam(); break;
      default: break;
    }
  }

  /* ---------- keyboard ---------- */
  var downKeys = {};
  function isTyping(e) {
    var t = e.target, tag = (t && t.tagName) || '';
    return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || !!(t && t.isContentEditable);
  }
  function keyDown(e) {
    var code = e.code || '';
    if (I.cap && I.cap.kind === 'key') {
      e.preventDefault(); e.stopPropagation();
      if (code === 'Escape') { I.cancelCapture(); return; }
      if (code === 'Backspace' || code === 'Delete') { finishCap(''); return; }
      if (!code || BLOCKED[code] || !/^[A-Za-z0-9]{1,24}$/.test(code)) return;
      finishCap(code);
      return;
    }
    if (isTyping(e)) { if (code === 'Escape' && e.target.blur) e.target.blur(); return; }
    if (I.editing) { if (code === 'Escape') { e.preventDefault(); if (BA.Layout) BA.Layout.cancel(); } return; }
    if (!I.enabled) {
      // navigasi menu dengan keyboard
      if (code === 'Escape') { e.preventDefault(); if (I.onBack) I.onBack(true); return; }
      if (code === 'KeyP' && (keyAct[code] || []).indexOf('pause') >= 0) { if (I.onPause) I.onPause(); return; }
      var dir = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right' }[code];
      if (dir) { e.preventDefault(); if (I.onNav) I.onNav(dir); }
      return;
    }
    if (BA.Audio) BA.Audio.init();
    var acts = keyAct[code];
    if (!acts) return;
    e.preventDefault();
    setDevice('kb');
    if (e.repeat || downKeys[code]) return;
    downKeys[code] = true;
    acts.forEach(function (a) { press(a, 'k'); });
  }
  function keyUp(e) {
    var code = e.code || '';
    if (!downKeys[code]) return;
    delete downKeys[code];
    (keyAct[code] || []).forEach(function (a) { release(a, 'k'); });
  }

  I.releaseAll = function () {
    downKeys = {};
    I.ACTIONS.forEach(function (a) { st[a.id].k = 0; st[a.id].p = 0; });
    I.sprintBtn = false; I.gocekBtn = false; I.gocekAt = 0; I.chase = false;
    if (I.shootHeld) { I.shootHeld = false; I.lastCharge = Math.max(0.5, Math.min(0.8, I.charge)); I.charge = 0; }
    I.joy.id = null; I.joy.active = false; I.jx = 0; I.jy = 0;
    drawJoy();
    if (I.els) [I.els.shoot, I.els.pass, I.els.gocek, I.els.sw, I.els.sprint].forEach(function (b) { if (b) b.classList.remove('on'); });
  };

  /* ---------- stik / gamepad ---------- */
  var prevB = [], padSt = { x: 0, y: 0, mag: 0 }, navDir = '', navT = 0, lastPoll = 0;
  function anyPressed(g) {
    var B = g.buttons || [];
    for (var i = 0; i < B.length; i++) { var b = B[i]; if (b && (b.pressed || b.value > 0.5)) return true; }
    return false;
  }
  I.activePad = function () {
    if (!I.padOk || I.padIdx == null) return null;
    try { var l = navigator.getGamepads(); var g = l && l[I.padIdx]; return g && g.connected ? g : null; } catch (e) { return null; }
  };
  function nav(dir) { if (I.onNav) I.onNav(dir); }
  function padDown(b) {
    if (I.cap) {
      if (I.cap.kind === 'pad') finishCap(b);
      return;
    }
    if (!I.enabled) {
      if (b === 12) nav('up'); else if (b === 13) nav('down'); else if (b === 14) nav('left'); else if (b === 15) nav('right');
      else if (b === 0) { if (I.onOk) I.onOk(); }
      else if (b === 1) { if (I.onBack) I.onBack(false); }
      else if ((padAct[b] || []).indexOf('pause') >= 0) { if (I.onPause) I.onPause(); }
      return;
    }
    (padAct[b] || []).forEach(function (a) { press(a, 'p'); });
  }
  function padUp(b) { (padAct[b] || []).forEach(function (a) { release(a, 'p'); }); }
  function hatDirs(v) {
    // d-pad pada sumbu "hat" (stik non-standar): -1 atas ... searah jarum jam, >1 netral
    if (typeof v !== 'number' || v > 1.05 || v < -1.05) return 0;
    var i = Math.round((v + 1) / (2 / 7));
    return [1, 1 | 8, 8, 2 | 8, 2, 2 | 4, 4, 1 | 4][U.clamp(i, 0, 7)];
  }
  function pollPad(dt) {
    padSt.x = 0; padSt.y = 0; padSt.mag = 0;
    if (!I.padOk) return;
    var list;
    try { list = navigator.getGamepads(); } catch (e) { I.padOk = false; I.padErr = true; return; }
    var gp = null, i;
    if (list) {
      if (I.padIdx != null && list[I.padIdx] && list[I.padIdx].connected) gp = list[I.padIdx];
      for (i = 0; i < list.length; i++) {
        var g = list[i];
        if (!g || !g.connected || !g.buttons) continue;
        if (!gp) gp = g;
        else if (g !== gp && anyPressed(g)) gp = g;
      }
    }
    if (!gp) {
      if (I.padId) { I.padId = ''; I.padIdx = null; for (i = 0; i < prevB.length; i++) if (prevB[i]) padUp(i); prevB = []; if (I.onPadChange) I.onPadChange(false); }
      return;
    }
    if (gp.id !== I.padId || gp.index !== I.padIdx) {
      var fresh = !I.padId;
      I.padId = gp.id; I.padIdx = gp.index; I.padStyleCur = I.padStyle(gp);
      // tombol yang sudah tertekan saat stik baru dipilih tidak dihitung sebagai tekanan
      prevB = [];
      for (i = 0; i < gp.buttons.length; i++) { var b0 = gp.buttons[i]; prevB[i] = !!(b0 && (b0.pressed || b0.value > 0.45)); }
      if (I.onPadChange) I.onPadChange(true, fresh);
    }
    var any = false, B = gp.buttons;
    for (i = 0; i < B.length && i < 32; i++) {
      var btn = B[i];
      var pr = !!(btn && (btn.pressed || btn.value > 0.45));
      if (pr && !prevB[i]) { any = true; padDown(i); }
      else if (!pr && prevB[i]) padUp(i);
      prevB[i] = pr;
    }
    // d-pad lewat sumbu hat untuk stik non-standar
    if (gp.mapping !== 'standard' && B.length <= 12 && gp.axes && gp.axes.length > 9) {
      var h = hatDirs(gp.axes[9]), bits = [1, 2, 4, 8], vb = [12, 13, 14, 15];
      for (i = 0; i < 4; i++) {
        var on = !!(h & bits[i]), idx = 32 + i;
        if (on && !prevB[idx]) { any = true; padDown(vb[i]); }
        else if (!on && prevB[idx]) padUp(vb[i]);
        prevB[idx] = on;
      }
    }
    var ax = (gp.axes && gp.axes[0]) || 0, ay = (gp.axes && gp.axes[1]) || 0;
    var m = Math.sqrt(ax * ax + ay * ay), dz = U.clamp(I.deadzone, 0.05, 0.6);
    if (m > dz) {
      var mag = Math.min(1, (m - dz) / (1 - dz));
      padSt.x = ax / m * mag; padSt.y = ay / m * mag; padSt.mag = mag;
      if (mag > 0.35) any = true;
    }
    if (any) setDevice('pad');
    if (!I.enabled && !I.cap) {
      var d = '';
      if (Math.abs(ax) > 0.6 || Math.abs(ay) > 0.6) d = Math.abs(ax) > Math.abs(ay) ? (ax > 0 ? 'right' : 'left') : (ay > 0 ? 'down' : 'up');
      if (!d) navDir = '';
      else if (d !== navDir) { navDir = d; navT = 0.4; nav(d); }
      else { navT -= dt; if (navT <= 0) { navT = 0.14; nav(d); } }
    }
    if (I.cap && I.cap.kind === 'pad' && now() - I.cap.t > 9000) I.cancelCapture();
  }

  /* getar stik (bila didukung) */
  I.rumble = function (strong, weak, ms) {
    if (!I.rumbleOn || I.device !== 'pad') return;
    var gp = I.activePad();
    if (!gp) return;
    try {
      var va = gp.vibrationActuator;
      if (va && va.playEffect) {
        var p = va.playEffect(va.type || 'dual-rumble', { startDelay: 0, duration: ms || 120, strongMagnitude: U.clamp(strong || 0, 0, 1), weakMagnitude: U.clamp(weak || 0, 0, 1) });
        if (p && p.catch) p.catch(function () { /* abaikan */ });
      } else if (gp.hapticActuators && gp.hapticActuators[0] && gp.hapticActuators[0].pulse) {
        gp.hapticActuators[0].pulse(U.clamp(Math.max(strong || 0, weak || 0), 0, 1), ms || 120);
      }
    } catch (e) { /* abaikan */ }
  };

  /* ---------- dipanggil tiap frame ---------- */
  I.update = function () {
    var t = now(), dt = lastPoll ? Math.min(0.1, (t - lastPoll) / 1000) : 0.016;
    lastPoll = t;
    pollPad(dt);
    I.kx = (held('right') ? 1 : 0) - (held('left') ? 1 : 0);
    I.ky = (held('down') ? 1 : 0) - (held('up') ? 1 : 0);
    if (I.shootHeld) {
      I.charge = Math.min(1.2, (now() - I.chargeStart) / CHARGE_MS);
      if (I.charge >= 1.2) shootUp();
    }
    var x, y;
    // prioritas: joystick layar, lalu tombol arah (keyboard/D-pad), lalu analog stik (analog yang sedikit "drift" tidak mengalahkan keyboard)
    if (I.joy.active) { x = I.jx; y = I.jy; }
    else if (I.kx || I.ky) { x = I.kx; y = I.ky; }
    else if (padSt.mag > 0) { x = padSt.x; y = padSt.y; }
    else { x = 0; y = 0; }
    var l = Math.sqrt(x * x + y * y);
    if (l > 1) { x /= l; y /= l; l = 1; }
    if (l < 0.14) { x = 0; y = 0; }
    I.sx = x; I.sy = y;
    I.zc = x < -0.35 ? -1 : (x > 0.35 ? 1 : 0);
    I.zr = y < -0.35 ? 0 : (y > 0.35 ? 2 : 1);
    I.sprint = held('sprint') || I.sprintBtn || (I.autoSprint && I.joy.active && l > 0.93);
    // tombol rebut ditahan lama: pemain aktif mengejar bola otomatis
    I.chase = (held('gocek') || I.gocekBtn) && I.gocekAt > 0 && now() - I.gocekAt > 280;
  };

  /* bentuk masukan untuk simulasi (arah sudah diubah ke dunia oleh pemanggil) */
  I.toSim = function (wx, wz) {
    return {
      mx: wx, mz: wz, sprint: I.sprint, passSeq: I.passSeq, gocekSeq: I.gocekSeq, switchSeq: I.switchSeq,
      shootHeld: I.shootHeld, shootSeq: I.shootSeq, charge: I.shootHeld ? I.charge : I.lastCharge, zc: I.zc, zr: I.zr, skipSeq: I.skipSeq, chase: !!I.chase
    };
  };
  I.chargeNow = function () { return I.shootHeld ? I.charge : 0; };
  I.setEnabled = function (on) { I.enabled = !!on; if (!on) { I.releaseAll(); I.cine = false; } };
})(typeof window !== 'undefined' ? window : globalThis);
