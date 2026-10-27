/* Bola Api Arena — suara sintetis (WebAudio), tanpa file eksternal */
(function (root) {
  'use strict';
  var BA = root.BA;
  var A = BA.Audio = { ctx: null, on: true, master: null, crowdGain: null, ready: false };

  A.init = function () {
    if (A.ctx) { if (A.ctx.state === 'suspended') { try { A.ctx.resume(); } catch (e) { /* abaikan */ } } return; }
    var AC = root.AudioContext || root.webkitAudioContext;
    if (!AC) return;
    try {
      A.ctx = new AC();
      A.master = A.ctx.createGain(); A.master.gain.value = A.on ? 0.8 : 0; A.master.connect(A.ctx.destination);
      var len = A.ctx.sampleRate * 2, buf = A.ctx.createBuffer(1, len, A.ctx.sampleRate), d = buf.getChannelData(0);
      for (var i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      A.noiseBuf = buf;
      A.ready = true;
    } catch (e) { A.ctx = null; }
  };
  A.setOn = function (on) {
    A.on = !!on;
    if (A.master) A.master.gain.setTargetAtTime(A.on ? 0.8 : 0, A.ctx.currentTime, 0.05);
  };
  function ok() { return A.ready && A.on && A.ctx && A.ctx.state === 'running'; }
  function now() { return A.ctx.currentTime; }

  function env(g, t, a, peak, d) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
  }
  function tone(freq, dur, type, vol, slideTo, delay) {
    if (!ok()) return;
    try {
      var t = now() + (delay || 0), o = A.ctx.createOscillator(), g = A.ctx.createGain();
      o.type = type || 'sine'; o.frequency.setValueAtTime(freq, t);
      if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t + dur);
      env(g, t, 0.008, vol || 0.3, dur);
      o.connect(g); g.connect(A.master);
      o.start(t); o.stop(t + dur + 0.05);
    } catch (e) { /* abaikan */ }
  }
  function noise(dur, vol, ftype, freq, q, sweepTo, delay, attack) {
    if (!ok()) return;
    try {
      var t = now() + (delay || 0), s = A.ctx.createBufferSource(), f = A.ctx.createBiquadFilter(), g = A.ctx.createGain();
      s.buffer = A.noiseBuf; s.loop = true;
      f.type = ftype || 'lowpass'; f.frequency.setValueAtTime(freq || 1000, t); f.Q.value = q || 1;
      if (sweepTo) f.frequency.exponentialRampToValueAtTime(Math.max(30, sweepTo), t + dur);
      env(g, t, attack || 0.01, vol || 0.3, dur);
      s.connect(f); f.connect(g); g.connect(A.master);
      s.start(t, Math.random()); s.stop(t + dur + (attack || 0.01) + 0.05);
    } catch (e) { /* abaikan */ }
  }

  A.click = function () { tone(900, 0.05, 'triangle', 0.12); };
  A.kick = function (v) { v = v || 1; tone(150, 0.14, 'sine', 0.55 * v, 45); noise(0.05, 0.25 * v, 'highpass', 2500); };
  A.pass = function () { tone(220, 0.08, 'sine', 0.3, 90); noise(0.03, 0.12, 'highpass', 3000); };
  A.bounce = function (v) { tone(120, 0.08, 'sine', 0.18 * (v || 0.5), 60); };
  A.tackle = function () { noise(0.12, 0.3, 'lowpass', 600); tone(90, 0.1, 'sine', 0.3, 50); };
  A.whoosh = function (k) { noise(0.55, 0.25 * (k || 1), 'bandpass', 400, 1.2, 3500, 0, 0.12); };
  A.roar = function (type) {
    switch (type) {
      case 'naga': tone(95, 0.7, 'sawtooth', 0.22, 55); noise(0.7, 0.25, 'lowpass', 700, 1, 300, 0, 0.05); break;
      case 'macan': tone(140, 0.55, 'sawtooth', 0.22, 70); tone(146, 0.55, 'sawtooth', 0.15, 72); noise(0.5, 0.2, 'bandpass', 500, 2, 250); break;
      case 'garuda': tone(1500, 0.45, 'square', 0.08, 700); tone(1800, 0.35, 'sine', 0.12, 900, 0.12); break;
      case 'banteng': tone(80, 0.6, 'sawtooth', 0.25, 50); noise(0.6, 0.25, 'lowpass', 300); break;
      case 'keris': tone(1900, 0.6, 'triangle', 0.14, 2600); tone(2600, 0.5, 'sine', 0.1, 3200, 0.05); break;
      case 'meteor': noise(1.0, 0.35, 'lowpass', 200, 1, 900, 0, 0.3); tone(60, 1.0, 'sine', 0.3, 35); break;
      case 'beliung': noise(0.9, 0.3, 'bandpass', 300, 4, 2400, 0, 0.1); break;
      case 'tinju': tone(70, 0.4, 'square', 0.18, 40); noise(0.25, 0.3, 'lowpass', 500); break;
      default: noise(0.5, 0.25, 'lowpass', 600);
    }
  };
  A.clash = function () { tone(620, 0.25, 'square', 0.1, 520); tone(930, 0.3, 'triangle', 0.12, 780); noise(0.3, 0.3, 'highpass', 1800); };
  A.skill = function (fx) {
    if (fx === 'water') noise(0.7, 0.3, 'lowpass', 1500, 1, 400, 0, 0.05);
    else if (fx === 'wall' || fx === 'quake') { noise(0.8, 0.4, 'lowpass', 180, 1, 80); tone(50, 0.7, 'sine', 0.35, 30); }
    else if (fx === 'dome' || fx === 'wings') { tone(880, 0.6, 'sine', 0.14); tone(1320, 0.6, 'sine', 0.1, null, 0.06); tone(1760, 0.5, 'sine', 0.07, null, 0.12); }
    else if (fx === 'vortex') noise(0.7, 0.28, 'bandpass', 2000, 3, 500);
    else { tone(660, 0.4, 'triangle', 0.12, 990); }
  };
  A.goalBlast = function () {
    noise(0.9, 0.5, 'lowpass', 900, 1, 120);
    tone(55, 0.6, 'sine', 0.45, 35);
    A.cheer(2.5);
    A.whistle(false, 0.4);
  };
  A.cheer = function (dur) { noise(dur || 2, 0.22, 'bandpass', 1300, 0.7, 900, 0, 0.25); noise(dur || 2, 0.12, 'bandpass', 2600, 0.8, 1800, 0.1, 0.3); };
  A.groan = function () { noise(1.0, 0.16, 'bandpass', 500, 1, 300, 0, 0.2); };
  A.catchBall = function () { tone(130, 0.12, 'sine', 0.4, 70); noise(0.6, 0.22, 'highpass', 3000, 1, 6000, 0.05, 0.05); A.groan(); };
  A.parry = function () { noise(0.15, 0.4, 'bandpass', 1200, 1.5); tone(300, 0.15, 'square', 0.12, 150); A.groan(); };
  A.post = function () { tone(1480, 0.9, 'sine', 0.22, 1400); tone(2320, 0.7, 'sine', 0.14, 2250); tone(3100, 0.5, 'sine', 0.08); A.groan(); };
  A.whistle = function (short, delay) {
    if (!ok()) return;
    try {
      var t = now() + (delay || 0), o = A.ctx.createOscillator(), lfo = A.ctx.createOscillator(), lg = A.ctx.createGain(), g = A.ctx.createGain();
      o.type = 'sine'; o.frequency.value = 2900; lfo.frequency.value = 32; lg.gain.value = 120;
      lfo.connect(lg); lg.connect(o.frequency);
      var d = short ? 0.28 : 0.85;
      env(g, t, 0.02, 0.16, d);
      o.connect(g); g.connect(A.master);
      o.start(t); lfo.start(t); o.stop(t + d + 0.05); lfo.stop(t + d + 0.05);
    } catch (e) { /* abaikan */ }
  };
  A.thunder = function () { noise(2.2, 0.45, 'lowpass', 160, 1, 50, 0, 0.05); };
  A.train = function () { tone(330, 1.1, 'square', 0.06); tone(415, 1.1, 'square', 0.05); noise(3.5, 0.18, 'lowpass', 250, 1, 120, 0.2, 0.8); };
  A.sizzle = function () { noise(0.5, 0.2, 'highpass', 4000); };
  A.petir = function () { noise(0.4, 0.4, 'highpass', 1500); A.thunder(); };

  /* ---------- suara khas tiap jenis tim ---------- */
  /* nada dengan vibrato (LFO) untuk geraman, erangan, dan suara binatang */
  function vtone(freq, dur, type, vol, slideTo, delay, lfoHz, lfoAmt, ftype, ffreq) {
    if (!ok()) return;
    try {
      var t = now() + (delay || 0), o = A.ctx.createOscillator(), g = A.ctx.createGain(), lfo = A.ctx.createOscillator(), lg = A.ctx.createGain();
      o.type = type || 'sawtooth'; o.frequency.setValueAtTime(freq, t);
      if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t + dur);
      lfo.frequency.value = lfoHz || 6; lg.gain.value = lfoAmt || freq * 0.06; lfo.connect(lg); lg.connect(o.frequency);
      var node = o;
      if (ftype) { var f = A.ctx.createBiquadFilter(); f.type = ftype; f.frequency.value = ffreq || 800; f.Q.value = 1.2; o.connect(f); node = f; }
      env(g, t, 0.02, vol || 0.2, dur);
      node.connect(g); g.connect(A.master);
      o.start(t); lfo.start(t); o.stop(t + dur + 0.05); lfo.stop(t + dur + 0.05);
    } catch (e) { /* abaikan */ }
  }
  var voiceCD = {};
  /* ev: kick, tackle, hurt, goal, sad, roar, save, gocek */
  A.voice = function (kind, variant, ev) {
    if (!ok()) return;
    var key = kind + ':' + ev, t = now();
    var cd = { kick: 0.5, gocek: 0.6, tackle: 0.6, hurt: 0.6, goal: 1.5, sad: 1.5, roar: 1.0, save: 1.0 }[ev] || 0.6;
    if (voiceCD[key] && t - voiceCD[key] < cd) return;
    voiceCD[key] = t;
    var V = VOICES[kind] || VOICES.manusia;
    var fn = V[ev] || null;
    if (fn) fn(variant || '');
  };
  var VOICES = {
    manusia: {
      kick: function () { noise(0.12, 0.14, 'bandpass', 500, 1.5, 300, 0, 0.02); vtone(180, 0.12, 'triangle', 0.08, 120, 0, 8, 10, 'lowpass', 900); },
      tackle: function () { vtone(160, 0.18, 'sawtooth', 0.08, 110, 0, 10, 14, 'lowpass', 700); },
      hurt: function () { vtone(320, 0.28, 'triangle', 0.1, 180, 0, 12, 30, 'bandpass', 900); },
      goal: function () { for (var i = 0; i < 4; i++) vtone(420 + i * 30, 0.6, 'sawtooth', 0.05, 520, i * 0.05, 5, 10, 'bandpass', 1200); },
      sad: function () { vtone(300, 0.6, 'triangle', 0.06, 160, 0, 4, 10, 'lowpass', 800); },
      roar: function () { vtone(220, 0.5, 'sawtooth', 0.09, 330, 0, 7, 12, 'bandpass', 1000); }
    },
    siluman: {
      kick: function () { vtone(70, 0.35, 'sawtooth', 0.22, 50, 0, 18, 12, 'lowpass', 500); noise(0.3, 0.18, 'lowpass', 350, 1, 150); },
      gocek: function () { vtone(140, 0.2, 'square', 0.08, 90, 0, 25, 20, 'bandpass', 700); },
      tackle: function (v) { if (v === 'babi') { vtone(520, 0.25, 'sawtooth', 0.12, 380, 0, 30, 60, 'bandpass', 1400); vtone(700, 0.2, 'square', 0.06, 420, 0.1, 30, 60, 'bandpass', 1600); } else { vtone(80, 0.5, 'sawtooth', 0.22, 45, 0, 14, 10, 'lowpass', 600); noise(0.5, 0.2, 'lowpass', 300); } },
      hurt: function (v) { if (v === 'tuyul') vtone(900, 0.3, 'square', 0.07, 1400, 0, 30, 80, 'bandpass', 2200); else vtone(140, 0.45, 'sawtooth', 0.15, 70, 0, 20, 25, 'lowpass', 700); },
      goal: function () { vtone(60, 1.2, 'sawtooth', 0.26, 90, 0, 9, 8, 'lowpass', 700); noise(1.2, 0.22, 'lowpass', 500, 1, 200, 0, 0.1); vtone(120, 0.8, 'square', 0.08, 180, 0.3, 12, 14, 'bandpass', 900); },
      sad: function () { vtone(90, 0.9, 'sawtooth', 0.12, 50, 0, 6, 8, 'lowpass', 500); },
      roar: function (v) { if (v === 'ular') { noise(0.9, 0.3, 'highpass', 4000, 1, 7000, 0, 0.05); vtone(1200, 0.5, 'sine', 0.04, 900, 0, 30, 100); } else { vtone(55, 1.0, 'sawtooth', 0.28, 95, 0, 11, 10, 'lowpass', 800); noise(0.9, 0.25, 'lowpass', 600, 1, 250, 0, 0.08); } },
      save: function () { vtone(70, 0.6, 'sawtooth', 0.2, 50, 0, 15, 10, 'lowpass', 600); }
    },
    hantu: {
      kick: function () { vtone(900, 0.45, 'sine', 0.09, 420, 0, 5, 40); noise(0.4, 0.1, 'highpass', 3000, 1, 1500, 0, 0.15); },
      gocek: function () { noise(0.35, 0.12, 'bandpass', 2500, 3, 900, 0, 0.1); },
      tackle: function (v) { if (v === 'pocong') { for (var i = 0; i < 3; i++) vtone(220, 0.08, 'square', 0.08, 160, i * 0.09, 20, 20, 'bandpass', 900); } else { vtone(700, 0.6, 'sine', 0.1, 250, 0, 4, 60); } },
      hurt: function () { vtone(1100, 0.7, 'sine', 0.1, 300, 0, 6, 90); noise(0.6, 0.08, 'highpass', 2500); },
      goal: function (v) { if (v === 'jin') { vtone(200, 0.9, 'sawtooth', 0.14, 500, 0, 8, 25, 'bandpass', 1500); noise(0.9, 0.2, 'bandpass', 900, 2, 2500, 0, 0.1); } else { for (var i = 0; i < 7; i++) vtone(760 - i * 55, 0.16, 'sine', 0.1, 700 - i * 55, i * 0.13, 10, 25); noise(1.1, 0.1, 'highpass', 3000, 1, 1200, 0, 0.3); } },
      sad: function () { vtone(500, 1.4, 'sine', 0.08, 180, 0, 3, 40); },
      roar: function () { vtone(1400, 1.0, 'sine', 0.1, 260, 0, 7, 120); noise(1.0, 0.15, 'highpass', 2000, 1, 800, 0, 0.2); A.thunder(); },
      save: function () { for (var i = 0; i < 4; i++) vtone(620 - i * 60, 0.14, 'sine', 0.08, 600 - i * 60, i * 0.12, 10, 20); }
    },
    mamalia: {
      kick: function (v) { VOICES.mamalia.call(v, 0.7); },
      gocek: function (v) { VOICES.mamalia.call(v, 0.45); },
      tackle: function (v) { VOICES.mamalia.call(v, 1); },
      hurt: function (v) { if (v === 'anjing') { vtone(900, 0.5, 'triangle', 0.12, 500, 0, 8, 60, 'bandpass', 1500); } else if (v === 'kucing' || v === 'harimau') { vtone(800, 0.5, 'sawtooth', 0.08, 350, 0, 10, 60, 'bandpass', 1800); } else VOICES.mamalia.call(v, 0.8); },
      goal: function (v) { VOICES.mamalia.call(v, 1.4); setTimeout(function () { VOICES.mamalia.call(v, 1); }, 350); },
      sad: function (v) { vtone(v === 'kerbau' ? 90 : 260, 0.8, 'sawtooth', 0.08, v === 'kerbau' ? 60 : 160, 0, 4, 10, 'lowpass', 700); },
      roar: function (v) { VOICES.mamalia.call(v, 1.6); },
      save: function (v) { VOICES.mamalia.call(v, 1); },
      /* suara binatang: harimau mengaum, monyet mengoceh, kerbau melenguh, beruang menggeram, kucing mengeong, anjing menggonggong */
      call: function (v, k) {
        k = k || 1;
        if (v === 'harimau') { vtone(120, 0.6 * k, 'sawtooth', 0.2, 80, 0, 9, 12, 'lowpass', 900); noise(0.6 * k, 0.2, 'bandpass', 500, 2, 250); }
        else if (v === 'monyet') { for (var i = 0; i < 5; i++) vtone(900 + (i % 2) * 300, 0.07, 'square', 0.06, 1100, i * 0.09, 20, 60, 'bandpass', 2000); }
        else if (v === 'kerbau') { vtone(85, 0.9 * k, 'sawtooth', 0.2, 70, 0, 5, 6, 'lowpass', 400); vtone(170, 0.8 * k, 'triangle', 0.08, 140, 0.05, 5, 8, 'lowpass', 600); }
        else if (v === 'beruang') { vtone(70, 0.7 * k, 'sawtooth', 0.22, 55, 0, 14, 10, 'lowpass', 600); noise(0.6 * k, 0.2, 'lowpass', 350); }
        else if (v === 'kucing') { vtone(620, 0.45 * k, 'triangle', 0.1, 420, 0, 7, 40, 'bandpass', 1500); vtone(900, 0.35 * k, 'sine', 0.05, 600, 0.05, 7, 40); }
        else if (v === 'anjing') { for (var j = 0; j < 2; j++) { vtone(380, 0.12, 'sawtooth', 0.14, 260, j * 0.18, 20, 40, 'bandpass', 1100); noise(0.1, 0.1, 'bandpass', 900, 2, 500, j * 0.18); } }
        else { vtone(200, 0.4, 'sawtooth', 0.1, 150, 0, 8, 15, 'bandpass', 900); }
      }
    },
    robot: {
      kick: function () { noise(0.18, 0.14, 'bandpass', 1800, 4, 600, 0, 0.02); tone(1200, 0.06, 'square', 0.05); tone(1600, 0.06, 'square', 0.05, null, 0.07); },
      gocek: function () { noise(0.25, 0.12, 'bandpass', 2600, 6, 900, 0, 0.03); },
      tackle: function () { noise(0.25, 0.3, 'lowpass', 900, 1, 200); tone(90, 0.2, 'square', 0.14, 60); tone(2200, 0.05, 'square', 0.05, null, 0.05); },
      hurt: function () { for (var i = 0; i < 4; i++) tone(440, 0.07, 'square', 0.08, null, i * 0.09); noise(0.3, 0.12, 'highpass', 3000, 1, 1200, 0.1); },
      goal: function () { [523, 659, 784, 1046, 1318].forEach(function (f, i) { tone(f, 0.18, 'square', 0.07, null, i * 0.1); }); tone(1568, 0.5, 'square', 0.08, null, 0.5); noise(0.4, 0.1, 'highpass', 4000, 1, 8000, 0.5, 0.1); },
      sad: function () { tone(500, 0.3, 'square', 0.06, 380); tone(380, 0.5, 'square', 0.06, 180, 0.3); },
      roar: function () { noise(0.8, 0.3, 'bandpass', 300, 3, 3000, 0, 0.3); tone(60, 0.9, 'sawtooth', 0.14, 120); tone(2000, 0.1, 'square', 0.05, 2600, 0.6); },
      save: function () { tone(880, 0.08, 'square', 0.07); tone(660, 0.08, 'square', 0.07, null, 0.1); noise(0.3, 0.15, 'bandpass', 1500, 4, 500, 0.05, 0.02); }
    },
    migas: {
      kick: function () { noise(0.1, 0.12, 'bandpass', 2000, 2, 1500); vtone(190, 0.12, 'triangle', 0.08, 130, 0, 8, 10, 'lowpass', 900); },
      gocek: function () { tone(2100, 0.05, 'square', 0.04); },
      tackle: function () { vtone(170, 0.2, 'sawtooth', 0.09, 120, 0, 10, 14, 'lowpass', 700); noise(0.2, 0.1, 'bandpass', 1500, 3, 900, 0.05); },
      hurt: function () { A.whistle(true); vtone(300, 0.3, 'triangle', 0.09, 180, 0.1, 12, 30, 'bandpass', 900); },
      /* gol: klakson rig + obrolan radio */
      goal: function () { tone(220, 0.9, 'sawtooth', 0.12, 220); tone(277, 0.9, 'sawtooth', 0.1, 277); noise(0.8, 0.12, 'bandpass', 1800, 4, 1400, 0.9, 0.05); tone(1800, 0.06, 'square', 0.05, null, 1.7); },
      sad: function () { noise(0.6, 0.1, 'bandpass', 1600, 4, 1200, 0, 0.1); vtone(260, 0.5, 'triangle', 0.06, 160, 0.1, 4, 10, 'lowpass', 800); },
      roar: function () { tone(1800, 0.06, 'square', 0.06); noise(0.5, 0.14, 'bandpass', 1700, 4, 1300, 0.08, 0.05); vtone(240, 0.5, 'sawtooth', 0.08, 330, 0.3, 7, 12, 'bandpass', 1000); },
      save: function () { A.whistle(true); }
    },
    partai: {
      kick: function () { vtone(200, 0.14, 'sawtooth', 0.08, 140, 0, 8, 10, 'bandpass', 1100); },
      gocek: function () { vtone(500, 0.12, 'square', 0.05, 700, 0, 10, 20, 'bandpass', 1500); },
      tackle: function () { vtone(150, 0.2, 'sawtooth', 0.1, 100, 0, 10, 14, 'bandpass', 900); noise(0.2, 0.1, 'bandpass', 1200, 2, 700); },
      hurt: function () { vtone(350, 0.3, 'triangle', 0.1, 200, 0, 12, 30, 'bandpass', 1000); },
      /* gol: yel-yel megafon + tabuhan */
      goal: function () { [330, 330, 392, 440, 392, 330].forEach(function (f, i) { vtone(f, 0.16, 'square', 0.07, f, i * 0.17, 12, 8, 'bandpass', 1300); noise(0.08, 0.12, 'lowpass', 300, 1, 150, i * 0.17); }); noise(0.9, 0.14, 'bandpass', 1000, 1, 700, 1.0, 0.2); },
      sad: function () { vtone(280, 0.7, 'triangle', 0.06, 150, 0, 4, 10, 'lowpass', 800); noise(0.5, 0.08, 'bandpass', 800, 1, 500, 0, 0.2); },
      roar: function () { vtone(300, 0.5, 'square', 0.07, 400, 0, 9, 12, 'bandpass', 1300); noise(0.5, 0.12, 'bandpass', 1000, 1, 700, 0.1, 0.1); },
      save: function () { vtone(400, 0.25, 'square', 0.06, 520, 0, 10, 14, 'bandpass', 1300); }
    }
  };

  /* suara penonton latar */
  A.crowdMul = 1; // pengaturan: 0 = suara penonton mati
  A.crowdStart = function () {
    if (!A.ready || A.crowdSrc) return;
    try {
      // gumaman penonton: derau disaring sempit + dua LFO pelan supaya terdengar seperti riuh, bukan desis
      var s = A.ctx.createBufferSource(), f = A.ctx.createBiquadFilter(), f2 = A.ctx.createBiquadFilter(), g = A.ctx.createGain(), mod = A.ctx.createGain();
      s.buffer = A.noiseBuf; s.loop = true;
      f.type = 'bandpass'; f.frequency.value = 520; f.Q.value = 1.1;
      f2.type = 'lowpass'; f2.frequency.value = 1400; f2.Q.value = 0.4;
      g.gain.value = 0.0; mod.gain.value = 1;
      var l1 = A.ctx.createOscillator(), l1g = A.ctx.createGain(), l2 = A.ctx.createOscillator(), l2g = A.ctx.createGain();
      l1.type = 'sine'; l1.frequency.value = 0.23; l1g.gain.value = 0.35; l2.type = 'sine'; l2.frequency.value = 0.9; l2g.gain.value = 0.18;
      l1.connect(l1g); l1g.connect(mod.gain); l2.connect(l2g); l2g.connect(mod.gain);
      s.connect(f); f.connect(f2); f2.connect(mod); mod.connect(g); g.connect(A.master); s.start(); l1.start(); l2.start();
      A.crowdSrc = s; A.crowdGain = g; A.crowdLfo = [l1, l2];
    } catch (e) { /* abaikan */ }
  };
  A.setCrowdMul = function (m) { A.crowdMul = Math.max(0, Math.min(1, m)); A.crowdLevel(A.crowdRaw || 0); };
  A.crowdLevel = function (v) {
    A.crowdRaw = Math.max(0, Math.min(0.25, v));
    A.crowdV = A.crowdRaw * (A.crowdMul == null ? 1 : A.crowdMul);
    if (!A.crowdGain) return;
    try { A.crowdGain.gain.setTargetAtTime(A.crowdV * (A.ducked ? 0.45 : 1), A.ctx.currentTime, 0.4); } catch (e) { /* abaikan */ }
  };
  /* kecilkan riuh penonton selama narator bicara */
  A.duck = function (on) {
    on = !!on;
    if (A.ducked === on) return;
    A.ducked = on;
    if (!A.crowdGain || !A.ctx) return;
    try { A.crowdGain.gain.setTargetAtTime((A.crowdV || 0.05) * (on ? 0.45 : 1), A.ctx.currentTime, on ? 0.12 : 0.6); } catch (e) { /* abaikan */ }
  };
  A.crowdStop = function () {
    if (!A.crowdSrc) return;
    try { A.crowdSrc.stop(); } catch (e) { /* abaikan */ }
    try { (A.crowdLfo || []).forEach(function (o) { o.stop(); }); } catch (e2) { /* abaikan */ }
    A.crowdSrc = null; A.crowdGain = null; A.crowdLfo = null;
  };
})(typeof window !== 'undefined' ? window : globalThis);
