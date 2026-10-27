/* Bola Api Arena — mode online lewat kapabilitas "room" (kode / QR), plus tampilan jarak jauh untuk tamu */
(function (root) {
  'use strict';
  var BA = root.BA, U = BA.U, D = BA.D, Sim = BA.Sim;

  var Net = BA.Net = {
    room: null, avail: null, nr: null, role: null, code: null, other: null, otherPeer: null,
    lastOtherAt: 0, connected: false, unsubs: [], listeners: {}, mine: {}
  };
  /* ukuran JSON dalam byte UTF-8 (batas presence 4 KiB) */
  Net.bytes = function (o) {
    var s;
    try { s = JSON.stringify(o); } catch (e) { return 99999; }
    try { return unescape(encodeURIComponent(s)).length; } catch (e2) { return s.length * 3; }
  };
  Net.LIMIT = 3900;
  Net.on = function (ev, fn) { Net.listeners[ev] = fn; };
  function fire(ev, a) { var f = Net.listeners[ev]; if (f) { try { f(a); } catch (e) { if (root.console) root.console.error(e); } } }

  /* ======================================================================
     TRANSPORT SUPABASE REALTIME (di luar claude.ai: Vercel/GitHub Pages/file mandiri)
     Presence untuk tahu siapa di room, Broadcast untuk kiriman keadaan (lobi & laga).
     ====================================================================== */
  Net.SB = { url: '', key: '', lib: 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.49.4/dist/umd/supabase.js' };
  Net.transport = '';
  Net.sbClient = null;
  function loadScript(src) {
    return new Promise(function (resolve, reject) {
      var sc = document.createElement('script'); sc.src = src; sc.async = true;
      sc.onload = function () { resolve(); }; sc.onerror = function () { reject(new Error('gagal memuat ' + src)); };
      document.head.appendChild(sc);
    });
  }
  Net.sbReady = function () {
    if (Net.sbClient) return Promise.resolve(Net.sbClient);
    if (!Net.SB.url || !Net.SB.key) return Promise.reject({ code: 'no-config' });
    var mk = function () {
      var lib = root.supabase;
      if (!lib || typeof lib.createClient !== 'function') throw new Error('pustaka supabase tidak ada');
      Net.sbClient = lib.createClient(Net.SB.url, Net.SB.key, { realtime: { params: { eventsPerSecond: 40 } } });
      return Net.sbClient;
    };
    if (root.supabase && typeof root.supabase.createClient === 'function') { try { return Promise.resolve(mk()); } catch (e) { return Promise.reject(e); } }
    return loadScript(Net.SB.lib).then(mk);
  };
  Net.myId = 'u' + Math.random().toString(36).slice(2, 10);
  Net.sbJoin = function (code, role, presence) {
    return Net.sbReady().then(function (client) {
      return new Promise(function (resolve, reject) {
        var topic = Net.roomName(code);
        var ch = client.channel(topic, { config: { presence: { key: Net.myId }, broadcast: { self: false, ack: false } } });
        var want = role === 'host' ? 'g' : 'h', settled = false;
        var sb = Net.sb = { ch: ch, topic: topic, role: role, peer: null };
        Net.role = role; Net.code = code; Net.other = null; Net.otherPeer = null; Net.lastOtherAt = 0;
        Net.mine = Object.assign({ r: role === 'host' ? 'h' : 'g', v: 1, id: Net.myId }, presence || {});
        function scan() {
          if (Net.sb !== sb) return;
          var st = ch.presenceState() || {}, found = null;
          Object.keys(st).sort().forEach(function (k) {
            if (k === Net.myId || found) return;
            var metas = st[k] || [], m = metas[0] || {};
            if (m.r === want && m.v === 1) found = k;
          });
          if (found && found !== sb.peer) { sb.peer = found; Net.otherPeer = found; fire('joined', { peer: found }); Net.sbPush(); }
          else if (!found && sb.peer) { sb.peer = null; Net.otherPeer = null; Net.other = null; fire('left', 'sb'); }
        }
        ch.on('presence', { event: 'sync' }, scan);
        ch.on('presence', { event: 'leave' }, scan);
        ch.on('broadcast', { event: 'p' }, function (msg) {
          if (Net.sb !== sb) return;
          var p = msg && msg.payload; if (!p || p.id === Net.myId || p.r !== want) return;
          if (!sb.peer) { sb.peer = p.id; Net.otherPeer = p.id; fire('joined', { peer: p.id }); }
          Net.other = p; Net.lastOtherAt = Date.now(); fire('presence', p);
        });
        ch.subscribe(function (status, err) {
          if (Net.sb !== sb) return;
          if (status === 'SUBSCRIBED') {
            ch.track({ r: Net.mine.r, v: 1 }).then(function () {
              if (!settled) { settled = true; Net.connected = true; fire('conn', true); resolve(ch); }
              Net.sbPush();
              /* kirim ulang berkala selama lawan sudah hadir tapi kabarnya belum/lama tidak diterima — siaran pertama bisa hilang saat lawan baru bergabung */
              if (!sb.alive) sb.alive = setInterval(function () {
                if (Net.sb !== sb) { clearInterval(sb.alive); return; }
                if (sb.peer && Date.now() - Net.lastOtherAt > 1500) Net.sbPush();
              }, 1200);
            }, function (e) { if (!settled) { settled = true; reject({ code: 'track', message: String(e) }); } });
          } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            if (!settled) { settled = true; reject({ code: status.toLowerCase(), message: err ? String(err) : '' }); } else fire('error', { code: status.toLowerCase() });
          } else if (status === 'CLOSED' && settled) { fire('error', { code: 'closed' }); }
        });
        setTimeout(function () { if (!settled) { settled = true; reject({ code: 'timeout' }); } }, 12000);
      });
    });
  };
  Net.sbPush = function () {
    var sb = Net.sb; if (!sb) return;
    try { sb.ch.send({ type: 'broadcast', event: 'p', payload: Net.mine }); } catch (e) { fire('sendError', e); }
  };
  Net.sbSend = function (patch) {
    var merged = Object.assign({}, Net.mine);
    Object.keys(patch).forEach(function (k) { if (patch[k] === null) delete merged[k]; else merged[k] = patch[k]; });
    merged.r = Net.mine.r; merged.v = 1; merged.id = Net.myId;
    Net.mine = merged;
    Net.sbPush();
    return Promise.resolve();
  };
  Net.sbLeave = function () {
    var sb = Net.sb; if (!sb) return;
    Net.sb = null;
    if (sb.alive) clearInterval(sb.alive);
    try { sb.ch.untrack(); } catch (e) { /* abaikan */ }
    try { sb.ch.unsubscribe(); if (Net.sbClient) Net.sbClient.removeChannel(sb.ch); } catch (e2) { /* abaikan */ }
  };

  /* cek apakah tampilan ini bisa memakai room (null = tidak bisa) */
  Net.check = function () {
    if (Net.avail !== null) return Promise.resolve(Net.avail);
    if (!root.claude || typeof root.claude.use !== 'function') {
      // di luar claude.ai: pakai Supabase Realtime bila dikonfigurasi
      if (Net.SB.url && Net.SB.key && navigator.onLine !== false) {
        return Net.sbReady().then(function () { Net.transport = 'sb'; Net.avail = true; return true; }, function () { Net.avail = false; return false; });
      }
      Net.avail = false; return Promise.resolve(false);
    }
    Net.transport = 'room';
    var done = false;
    return new Promise(function (resolve) {
      var to = setTimeout(function () { if (!done) { done = true; Net.avail = false; resolve(false); } }, 11000);
      try {
        root.claude.use('room').then(function (r) {
          if (done) return; done = true; clearTimeout(to);
          Net.room = r; Net.avail = !!r; resolve(Net.avail);
        }, function () { if (done) return; done = true; clearTimeout(to); Net.avail = false; resolve(false); });
      } catch (e) { done = true; clearTimeout(to); Net.avail = false; resolve(false); }
    });
  };

  Net.roomName = function (code) { return 'bolaapi-' + String(code).toLowerCase(); };
  Net.cleanCode = function (s) {
    s = String(s || '').toLowerCase();
    try { if (/%[0-9a-f]{2}/.test(s)) s = decodeURIComponent(s); } catch (e) { /* biarkan apa adanya */ }
    var m = s.match(/[?&]r(?:oom)?=([a-z0-9]{4,6})(?:[&#\s]|$)/) || s.match(/bola-([a-z0-9]{4,6})/) || s.match(/bolaapi-([a-z0-9]{4,6})/) || s.match(/^\s*([a-z0-9]{4,6})\s*$/);
    return m ? m[1] : null;
  };

  Net.join = function (code, role, presence) {
    if (Net.transport === 'sb') {
      Net.leave();
      return Net.sbJoin(code, role, presence).catch(function (e) {
        /* socket kadang macet "connecting" (mis. setelah muat ulang paksa): buang klien, buat baru, coba sekali lagi */
        if (!e || !/timeout|timed_out|channel_error/.test(String(e.code))) throw e;
        Net.sbLeave();
        try { if (Net.sbClient) Net.sbClient.realtime.disconnect(); } catch (x) { /* abaikan */ }
        Net.sbClient = null;
        return Net.sbJoin(code, role, presence);
      });
    }
    if (!Net.room) return Promise.reject({ code: 'unavailable' });
    Net.leave();
    Net.role = role; Net.code = code; Net.other = null; Net.otherPeer = null; Net.lastOtherAt = 0; Net.mine = {};
    return Net.room.join(Net.roomName(code)).then(function (nr) {
      Net.nr = nr;
      Net.unsubs.push(nr.onPeers(function (ch) { Net.handlePeers(ch); }, function (e) { fire('error', e); }));
      Net.unsubs.push(nr.onConnection(function (c) { Net.connected = c; fire('conn', c); }, function (e) { fire('error', e); }));
      return Net.send(Object.assign({ r: role === 'host' ? 'h' : 'g', v: 1 }, presence || {})).then(function () { return nr; });
    });
  };

  Net.handlePeers = function (ch) {
    var want = Net.role === 'host' ? 'g' : 'h';
    var found = null;
    (ch.peers || []).forEach(function (p) {
      if (p.sameTab || p.kind !== 'viewer') return;
      var pr = p.presence || {};
      if (pr.r === want && pr.v === 1 && !found) found = p;
    });
    var prevPeer = Net.otherPeer;
    if (found) {
      var isNew = !prevPeer || prevPeer !== found.peer;
      Net.otherPeer = found.peer;
      if (found.presence !== Net.other) { Net.other = found.presence; Net.lastOtherAt = Date.now(); fire('presence', found.presence); }
      if (isNew) fire('joined', found);
    } else if (prevPeer) {
      var still = (ch.peers || []).some(function (p) { return p.peer === prevPeer; });
      if (!still) { Net.otherPeer = null; Net.other = null; fire('left', prevPeer); }
    }
  };

  Net.send = function (patch) {
    if (Net.lan) return Net.lanSend(patch);
    if (Net.sb) return Net.sbSend(patch);
    if (!Net.nr) return Promise.resolve();
    // jaga agar objek presence gabungan tetap di bawah 4 KiB
    var merged = Object.assign({}, Net.mine);
    Object.keys(patch).forEach(function (k) { if (patch[k] === null) delete merged[k]; else merged[k] = patch[k]; });
    if (Net.bytes(merged) > Net.LIMIT) { fire('sendError', { code: 'too_big' }); return Promise.resolve(); }
    Net.mine = merged;
    try {
      return Net.nr.presence(patch).catch(function (e) { fire('sendError', e); });
    } catch (e) { return Promise.resolve(); }
  };

  Net.leave = function () {
    Net.unsubs.forEach(function (u) { try { u(); } catch (e) { /* abaikan */ } });
    Net.unsubs = [];
    if (Net.nr) { try { Net.nr.leave(); } catch (e) { /* abaikan */ } }
    Net.lanClose();
    Net.sbLeave();
    Net.nr = null; Net.role = null; Net.other = null; Net.otherPeer = null; Net.mine = {};
  };

  /* ======================================================================
     MODE WIFI LOKAL: WebRTC DataChannel antar dua HP di WiFi/hotspot yang sama, tanpa server & tanpa internet.
     Kode sambungan (SDP) ditukar lewat QR, salin-tempel, atau WhatsApp.
     ====================================================================== */
  Net.lan = null;
  Net.lanOk = function () { return typeof root.RTCPeerConnection === 'function'; };
  function b64u(str) { var b = btoa(unescape(encodeURIComponent(str))); return b.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
  function unb64u(str) { str = str.replace(/-/g, '+').replace(/_/g, '/'); while (str.length % 4) str += '='; return decodeURIComponent(escape(atob(str))); }
  /* ringkas SDP: buang baris yang tidak perlu agar muat di QR */
  function packSdp(desc) {
    var lines = desc.sdp.split(/\r?\n/).filter(function (l) { return l && !/^a=(ssrc|msid-semantic|extmap|rtcp-fb|fmtp|rtpmap|ice-options|end-of-candidates)/.test(l); });
    return 'BAL1:' + (desc.type === 'offer' ? 'o' : 'a') + ':' + b64u(lines.join('\n'));
  }
  function unpackSdp(str) {
    var m = String(str || '').trim().match(/BAL1:([oa]):([A-Za-z0-9_-]+)/);
    if (!m) return null;
    var sdp = unb64u(m[2]).split('\n').join('\r\n') + '\r\n';
    return { type: m[1] === 'o' ? 'offer' : 'answer', sdp: sdp };
  }
  Net.lanParse = function (str) { try { return unpackSdp(str); } catch (e) { return null; } };
  function waitIce(pc) {
    return new Promise(function (resolve) {
      if (pc.iceGatheringState === 'complete') { resolve(); return; }
      var done = false, fin = function () { if (!done) { done = true; resolve(); } };
      pc.addEventListener('icegatheringstatechange', function () { if (pc.iceGatheringState === 'complete') fin(); });
      setTimeout(fin, 2500);
    });
  }
  function lanSetup(role) {
    Net.leave();
    var pc = new root.RTCPeerConnection({ iceServers: [] });
    var lan = Net.lan = { pc: pc, role: role, dc: null, open: false, lastRx: 0 };
    Net.role = role; Net.mine = {}; Net.other = null; Net.otherPeer = null; Net.lastOtherAt = 0;
    pc.onconnectionstatechange = function () {
      if (Net.lan !== lan) return;
      var st = pc.connectionState;
      if (st === 'failed' || st === 'disconnected' || st === 'closed') { if (lan.open) { lan.open = false; Net.other = null; Net.otherPeer = null; fire('left', 'lan'); } else fire('error', { code: 'rtc-' + st }); }
    };
    return pc;
  }
  function wireDc(dc) {
    var lan = Net.lan; lan.dc = dc;
    dc.onopen = function () {
      if (Net.lan !== lan) return;
      lan.open = true; Net.otherPeer = 'lan'; Net.connected = true; fire('conn', true);
      try { dc.send(JSON.stringify({ p: Net.mine })); } catch (e) { /* abaikan */ }
      fire('joined', { peer: 'lan' });
    };
    dc.onmessage = function (ev) {
      if (Net.lan !== lan) return;
      var o; try { o = JSON.parse(ev.data); } catch (e) { return; }
      if (!o || typeof o !== 'object') return;
      if (o.p) { Net.other = o.p; Net.lastOtherAt = Date.now(); lan.lastRx = Date.now(); fire('presence', o.p); }
    };
    dc.onclose = function () { if (Net.lan === lan && lan.open) { lan.open = false; Net.other = null; Net.otherPeer = null; fire('left', 'lan'); } };
  }
  /* tuan rumah: buat kode undangan */
  Net.lanOffer = function () {
    if (!Net.lanOk()) return Promise.reject({ code: 'no-webrtc' });
    var pc = lanSetup('host');
    wireDc(pc.createDataChannel('bola', { ordered: true }));
    return pc.createOffer().then(function (o) { return pc.setLocalDescription(o); }).then(function () { return waitIce(pc); }).then(function () { return packSdp(pc.localDescription); });
  };
  /* tamu: terima kode undangan, hasilkan kode balasan */
  Net.lanAnswer = function (offerStr) {
    if (!Net.lanOk()) return Promise.reject({ code: 'no-webrtc' });
    var desc = unpackSdp(offerStr);
    if (!desc || desc.type !== 'offer') return Promise.reject({ code: 'bad-offer' });
    var pc = lanSetup('guest');
    pc.ondatachannel = function (e) { wireDc(e.channel); };
    return pc.setRemoteDescription(desc).then(function () { return pc.createAnswer(); }).then(function (a) { return pc.setLocalDescription(a); }).then(function () { return waitIce(pc); }).then(function () { return packSdp(pc.localDescription); });
  };
  /* tuan rumah: terima kode balasan tamu */
  Net.lanAccept = function (answerStr) {
    var desc = unpackSdp(answerStr);
    if (!Net.lan || Net.lan.role !== 'host') return Promise.reject({ code: 'no-host' });
    if (!desc || desc.type !== 'answer') return Promise.reject({ code: 'bad-answer' });
    return Net.lan.pc.setRemoteDescription(desc);
  };
  Net.lanSend = function (patch) {
    var lan = Net.lan; if (!lan) return Promise.resolve();
    var merged = Object.assign({}, Net.mine);
    Object.keys(patch).forEach(function (k) { if (patch[k] === null) delete merged[k]; else merged[k] = patch[k]; });
    Net.mine = merged;
    if (lan.open && lan.dc && lan.dc.readyState === 'open') { try { lan.dc.send(JSON.stringify({ p: merged })); } catch (e) { fire('sendError', e); } }
    return Promise.resolve();
  };
  Net.lanClose = function () {
    var lan = Net.lan; if (!lan) return;
    Net.lan = null;
    try { if (lan.dc) lan.dc.close(); } catch (e) { /* abaikan */ }
    try { lan.pc.close(); } catch (e2) { /* abaikan */ }
  };

  /* ---------- QR ---------- */
  Net.artifactUrl = '';
  Net.qrText = function (code) {
    if (!Net.artifactUrl) return 'BOLAAPI-' + code.toUpperCase();
    var base = Net.artifactUrl.split('#')[0];
    // di claude.ai hanya #anchor yang sampai ke halaman; di hosting sendiri pakai ?r= karena Instagram/WhatsApp sering membuang bagian #
    if (root.claude) return base + '#bola-' + code;
    return base.split('?')[0] + '?r=' + String(code).toUpperCase();
  };
  Net.drawQR = function (el, text, big) {
    el.innerHTML = '';
    if (typeof root.QRCode !== 'function') { el.textContent = 'QR tidak tersedia, pakai kode di bawah.'; return false; }
    try {
      new root.QRCode(el, { text: text, width: big ? 300 : 220, height: big ? 300 : 220, colorDark: '#1a1020', colorLight: '#fff7e8', correctLevel: big ? root.QRCode.CorrectLevel.L : root.QRCode.CorrectLevel.M });
      return true;
    } catch (e) { el.textContent = 'QR gagal dibuat, pakai kode di bawah.'; return false; }
  };
  /* baca QR dari foto (input file kamera): coba beberapa skala & potongan tengah karena jsQR peka ukuran modul */
  Net.scanFile = function (file, raw) {
    return new Promise(function (resolve, reject) {
      if (!file) { reject(new Error('Tidak ada foto')); return; }
      if (typeof root.jsQR !== 'function') { reject(new Error('Pembaca QR tidak tersedia')); return; }
      var img = new Image(), url = URL.createObjectURL(file);
      img.onload = function () {
        var w = img.naturalWidth, h = img.naturalHeight;
        if (!(w > 0 && h > 0)) { URL.revokeObjectURL(url); reject(new Error('Foto tidak bisa dibuka')); return; }
        var plans = [];
        [null, 0.62].forEach(function (crop) { [1100, 800, 600, 1500, 420].forEach(function (max) { plans.push({ crop: crop, max: max }); }); });
        var c = document.createElement('canvas'), x = c.getContext('2d', { willReadFrequently: true });
        var i = 0, foundText = null;
        function attempt() {
          if (i >= plans.length) {
            URL.revokeObjectURL(url);
            reject(new Error(foundText ? 'QR bukan kode Bola Api Arena' : 'QR tidak terbaca. Coba foto lebih dekat dan terang.'));
            return;
          }
          var pl = plans[i++];
          try {
            var sw = w, sh = h, sx = 0, sy = 0;
            if (pl.crop) { sw = Math.round(w * pl.crop); sh = Math.round(h * pl.crop); sx = Math.round((w - sw) / 2); sy = Math.round((h - sh) / 2); }
            var sc = Math.min(1, pl.max / Math.max(sw, sh));
            if (sc >= 1 && pl.max > 1100 && !pl.crop) { setTimeout(attempt, 0); return; } // skala sama dengan percobaan sebelumnya
            c.width = Math.max(1, Math.round(sw * sc)); c.height = Math.max(1, Math.round(sh * sc));
            x.drawImage(img, sx, sy, sw, sh, 0, 0, c.width, c.height);
            var data = x.getImageData(0, 0, c.width, c.height);
            var res = root.jsQR(data.data, c.width, c.height, { inversionAttempts: 'attemptBoth' });
            if (res && res.data) {
              var code = raw ? (/BAL1:/.test(res.data) ? res.data : null) : Net.cleanCode(res.data);
              if (code) { URL.revokeObjectURL(url); resolve(code); return; }
              foundText = res.data;
            }
          } catch (e) { /* coba rencana berikutnya */ }
          setTimeout(attempt, 0);
        }
        attempt();
      };
      img.onerror = function () { URL.revokeObjectURL(url); reject(new Error('Foto tidak bisa dibuka')); };
      img.src = url;
    });
  };

  /* ---------- pindai QR langsung dari kamera (getUserMedia + jsQR); gagal → pemanggil memakai foto ---------- */
  Net.cam = null;
  Net.camSupported = function () {
    try { return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia && typeof root.jsQR === 'function'); } catch (e) { return false; }
  };
  Net.scanCamera = function (video, onCode, onFail, onStatus, raw) {
    Net.stopCamera();
    if (!Net.camSupported()) { onFail(new Error('Kamera langsung tidak tersedia di browser ini')); return; }
    var cam = Net.cam = { video: video, stream: null, raf: 0, dead: false, t0: Date.now(), frames: 0, raw: !!raw };
    var cons = [{ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false }, { video: { facingMode: 'environment' }, audio: false }, { video: true, audio: false }];
    var i = 0;
    function tryNext(err) {
      if (cam.dead) return;
      if (i >= cons.length) { Net.stopCamera(); onFail(err || new Error('Kamera tidak bisa dibuka')); return; }
      var c = cons[i++];
      var pr;
      try { pr = navigator.mediaDevices.getUserMedia(c); } catch (e) { tryNext(e); return; }
      pr.then(function (stream) {
        if (cam.dead) { stream.getTracks().forEach(function (t) { t.stop(); }); return; }
        cam.stream = stream;
        video.setAttribute('playsinline', 'true'); video.muted = true; video.autoplay = true;
        video.srcObject = stream;
        var pp = video.play(); if (pp && pp.catch) pp.catch(function () { /* abaikan */ });
        if (onStatus) onStatus('Arahkan kamera ke QR tuan rumah…');
        loop();
      }, function (e) { tryNext(e); });
    }
    var canvas = document.createElement('canvas'), ctx = canvas.getContext('2d', { willReadFrequently: true });
    function loop() {
      if (cam.dead) return;
      cam.raf = root.requestAnimationFrame(loop);
      cam.frames++;
      if (cam.frames % 3) return; // ~20 fps cukup, hemat baterai
      var w = video.videoWidth, h = video.videoHeight;
      if (!(w > 0 && h > 0)) return;
      var sc = Math.min(1, 640 / Math.max(w, h));
      canvas.width = Math.round(w * sc); canvas.height = Math.round(h * sc);
      try {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        var data = ctx.getImageData(0, 0, canvas.width, canvas.height);
        var res = root.jsQR(data.data, canvas.width, canvas.height, { inversionAttempts: 'dontInvert' });
        if (res && res.data) {
          if (cam.raw) { if (/BAL1:/.test(res.data)) { Net.stopCamera(); onCode(res.data); return; } }
          else { var code = Net.cleanCode(res.data); if (code) { Net.stopCamera(); onCode(code); return; } }
          if (onStatus) onStatus('QR terbaca tapi bukan kode Bola Api Arena.');
        }
      } catch (e) { /* frame berikutnya */ }
    }
    tryNext();
  };
  Net.stopCamera = function () {
    var cam = Net.cam; if (!cam) return;
    cam.dead = true;
    if (cam.raf) root.cancelAnimationFrame(cam.raf);
    if (cam.stream) { try { cam.stream.getTracks().forEach(function (t) { t.stop(); }); } catch (e) { /* abaikan */ } }
    try { cam.video.pause(); cam.video.srcObject = null; } catch (e2) { /* abaikan */ }
    Net.cam = null;
  };
  /* bagikan tautan room (WhatsApp dll.) lewat Web Share, atau salin ke papan klip */
  Net.shareLink = function (code) {
    var url = Net.qrText(code);
    var text = 'Ayo tanding Bola Api Arena! Buka tautan ini lalu tekan Gabung: ' + url + ' (kode room ' + String(code).toUpperCase() + ')';
    return new Promise(function (resolve) {
      if (navigator.share) {
        try { navigator.share({ title: 'Bola Api Arena', text: text, url: url }).then(function () { resolve('shared'); }, function () { copy(); }); return; } catch (e) { /* lanjut salin */ }
      }
      copy();
      function copy() {
        try { if (navigator.clipboard && navigator.clipboard.writeText) { navigator.clipboard.writeText(text).then(function () { resolve('copied'); }, function () { resolve('manual'); }); return; } } catch (e) { /* abaikan */ }
        resolve('manual');
      }
    });
  };
  /* browser dalam aplikasi (WhatsApp/Instagram/Facebook) sering memblokir kamera & room */
  Net.inAppBrowser = function () {
    var ua = navigator.userAgent || '';
    return /FBAN|FBAV|Instagram|Line\/|WhatsApp|Twitter|TikTok|; wv\)|Snapchat/i.test(ua);
  };

  /* ---------- event yang diteruskan ke tamu ---------- */
  var SEND_KINDS = { whistle: 1, kick: 1, pass: 1, tackle: 1, slide: 1, gocek: 1, cine: 1, goal: 1, save: 1, post: 1, miss: 1, say: 1, hot: 1, petir: 1, corner: 1, penalty: 1, shootout: 1, penres: 1, end: 1, golden: 1, restart: 1, kickoffFirst: 1, offside: 1, foul: 1, card: 1 };
  Net.HostLink = function (sim, mid) {
    this.sim = sim; this.mid = mid; this.ring = []; this.lastSend = 0; this.lastIn = null; this.ackId = 0;
  };
  Net.HostLink.prototype.feed = function (events) {
    var self = this;
    events.forEach(function (e) {
      if (!SEND_KINDS[e.k]) return;
      var o = { id: e.id, k: e.k };
      Object.keys(e).forEach(function (key) { if (key !== 'id' && key !== 'k') o[key] = e[key]; });
      self.ring.push(o);
    });
    if (this.ring.length > 14) this.ring.splice(0, this.ring.length - 14);
  };
  Net.HostLink.prototype.tick = function (nowMs, extra) {
    if (nowMs - this.lastSend < (Net.transport === 'sb' ? 80 : 66)) return;
    this.lastSend = nowMs;
    var ack = this.ackId;
    var ev = this.ring.filter(function (e) { return e.id > ack; });
    var patch = { st: 'play', mid: this.mid, s: this.sim.snapshot(), e: ev };
    if (extra) Object.keys(extra).forEach(function (k) { patch[k] = extra[k]; });
    // ukur objek gabungan (tim + aturan + snapshot + event)
    var full = Object.assign({}, Net.mine, patch);
    if (Net.bytes(full) > Net.LIMIT) {
      patch.e = ev.filter(function (e) { return e.k === 'cine' || e.k === 'goal' || e.k === 'end' || e.k === 'penres'; }).slice(-3);
      full.e = patch.e;
      if (Net.bytes(full) > Net.LIMIT) { patch.e = ev.filter(function (e) { return e.k === 'end' || e.k === 'cine'; }).slice(-1); full.e = patch.e; }
      if (Net.bytes(full) > Net.LIMIT) { patch.e = []; }
    }
    Net.send(patch);
  };
  Net.HostLink.prototype.readGuest = function (pres) {
    if (!pres) return null;
    if (Array.isArray(pres.ack) && pres.ack[0] === this.mid && typeof pres.ack[1] === 'number') this.ackId = Math.max(this.ackId, pres.ack[1]);
    var a = pres.i;
    if (!Array.isArray(a)) return null;
    return {
      mx: U.num(a[0], 0) / 100, mz: U.num(a[1], 0) / 100, sprint: !!a[2], passSeq: a[3] | 0, gocekSeq: a[4] | 0, switchSeq: a[5] | 0,
      shootHeld: !!a[6], shootSeq: a[7] | 0, charge: U.num(a[8], 0) / 100, zc: a[9] | 0, zr: a[10] | 0, skipSeq: a[11] | 0, chase: !!a[12]
    };
  };
  Net.packInput = function (inp) {
    return [Math.round(inp.mx * 100), Math.round(inp.mz * 100), inp.sprint ? 1 : 0, inp.passSeq, inp.gocekSeq, inp.switchSeq, inp.shootHeld ? 1 : 0, inp.shootSeq, Math.round(inp.charge * 100), inp.zc, inp.zr, inp.skipSeq, inp.chase ? 1 : 0];
  };

  /* ---------- tampilan jarak jauh (tamu) ---------- */
  var RemoteView = BA.RemoteView = function (cfg) {
    this.cfg = cfg;
    D.useField(cfg.field);
    this.field = D.FIELD.id; this.n = D.FIELD.n;
    this.teams = D.resolveKits(D.sanitizeTeam(cfg.teams[0]), D.sanitizeTeam(cfg.teams[1]));
    this.rules = Object.assign(D.defaultRules(), cfg.rules || {});
    this.mode = cfg.mode || 'match';
    this.arena = D.arenaById[cfg.arena] || D.ARENAS[0];
    this.weather = D.weatherById[cfg.weather] || D.WEATHERS[0];
    this.ballDef = D.ballById[cfg.ball] || D.BALLS[0];
    this.players = [];
    for (var t = 0; t < 2; t++) for (var i = 0; i < this.n; i++) {
      var c = this.teams[t].players[i];
      this.players.push({ team: t, idx: i, cfg: c, role: c.role, name: c.name, num: c.num, shot: D.shotById[c.shot] || D.SHOTS[0], style: D.styleById[c.style] || D.STYLES[0],
        x: 0, z: 0, facing: 0, anim: 'idle', animT: 0, hidden: false, gkHold: false, celebrate: false, st: D.playerStats(c, this.teams[t].level) });
    }
    this.ball = { x: 0, y: 0.13, z: 0, owner: null, petirT: 0, holdT: 0, vx: 0, vz: 0 };
    this.score = [0, 0]; this.sem = [0, 0]; this.clock = this.rules.dur; this.phase = 'kickoff'; this.timeScale = 1;
    this.active = [null, null]; this.aim = null; this.pen = null; this.shootout = null; this.revealed = [{}, {}]; this.corners = [0, 0];
    this.golden = false; this.winner = -1; this.goalTeam = -1;
    this.buf = []; this.lastEv = 0; this.renderHt = null; this.got = false; this.lastRecv = 0;
    this.humans = [true, true];
  };
  RemoteView.prototype.dirOf = function (team) { return team === 0 ? 1 : -1; };
  RemoteView.prototype.pl = function (t, i) { return (i >= 0 && i < this.n) ? (this.players[t * this.n + i] || null) : null; };
  RemoteView.prototype.oppGoalX = function (team) { return this.dirOf(team) * D.FIELD.L / 2; };
  RemoteView.prototype.inShotRange = function (p) { var F = D.FIELD; return U.dist(p.x, p.z, this.oppGoalX(p.team), 0) < F.shot && Math.abs(p.z) < Math.max(12.5, F.boxW / 2 + 4); };

  RemoteView.prototype.push = function (s, nowMs) {
    if (!s || s.v !== 1 || !Array.isArray(s.p) || s.p.length < this.n * 10 || !Array.isArray(s.b)) return;
    var last = this.buf[this.buf.length - 1];
    if (last && s.ht <= last.ht) {
      if (s.ht < last.ht - 2000) this.buf = []; // tuan rumah memulai ulang
      else return;
    }
    this.buf.push({ ht: s.ht, at: nowMs, s: s });
    if (this.buf.length > 30) this.buf.shift();
    this.lastRecv = nowMs;
    this.apply(s);
  };

  /* status non-posisi diambil dari snapshot terbaru */
  RemoteView.prototype.apply = function (s) {
    this.got = true;
    this.phase = Sim.PHASES[s.ph] || 'play';
    this.timeScale = U.num(s.ts, 100) / 100;
    this.clock = U.num(s.ck, 0) / 10;
    this.score = [s.sc[0] | 0, s.sc[1] | 0];
    this.sem = [U.num(s.se[0], 0), U.num(s.se[1], 0)];
    this.active = [s.ac[0] >= 0 ? this.pl(0, s.ac[0]) : null, s.ac[1] >= 0 ? this.pl(1, s.ac[1]) : null];
    var n2 = this.n * 2;
    this.aim = (s.am >= 0 && s.am < n2) ? { p: this.players[s.am], team: Math.floor(s.am / this.n) } : null;
    this.ball.owner = s.b[3] >= 0 && s.b[3] < n2 ? this.players[s.b[3]] : null;
    this.ball.petirT = s.b[4] ? 1 : 0;
    this.ball.holdT = U.num(s.b[5], 0) / 10;
    this.corners = Array.isArray(s.cn) ? s.cn : [0, 0];
    this.golden = !!s.gg;
    this.winner = U.num(s.wn, -1);
    this.goalTeam = U.num(s.gt, -1);
    if (Array.isArray(s.pn)) {
      this.pen = { state: Sim.PEN_STATES[s.pn[0]] || 'setup', team: s.pn[1] | 0, kind: ['single', 'shootout', 'practice'][s.pn[2]] || 'single', shooter: this.pl(s.pn[1] | 0, s.pn[3] | 0) };
    } else this.pen = null;
    if (Array.isArray(s.so)) {
      var k0 = String(s.so[0] || '').split('').map(Number), k1 = String(s.so[1] || '').split('').map(Number);
      this.shootout = { kicks: [k0, k1], done: !!s.so[2], winner: s.so[3] };
    } else this.shootout = null;
    var self = this;
    if (Array.isArray(s.rv)) [0, 1].forEach(function (t) {
      var map = {}, k = self.pl(t, 0);
      String(s.rv[t] || '').split(',').forEach(function (z) { if (z && k && k.style.map[z]) map[z] = k.style.map[z]; });
      self.revealed[t] = map;
    });
    for (var i = 0; i < n2; i++) {
      var p = this.players[i], f = s.p[i * 5 + 4] | 0;
      var an = Sim.ANIMS[s.p[i * 5 + 3] | 0] || 'idle';
      if (an !== p.anim) { p.anim = an; p.animT = 0; }
      p.hidden = !!(f & 1); p.gkHold = !!(f & 2); p.celebrate = !!(f & 4); p.throwIn = !!(f & 8); p.sprint = !!(f & 16);
    }
  };

  /* interpolasi posisi */
  RemoteView.prototype.update = function (dt, nowMs) {
    this.players.forEach(function (p) { p.animT += dt; });
    if (!this.buf.length) return;
    var newest = this.buf[this.buf.length - 1];
    var delay = 110;
    var target = newest.ht - delay;
    if (this.renderHt === null || Math.abs(this.renderHt - target) > 600) this.renderHt = target;
    else {
      this.renderHt += dt * 1000 * Math.max(0.05, this.timeScale);
      this.renderHt += (target - this.renderHt) * Math.min(1, dt * 2);
    }
    var a = null, b = null;
    for (var i = 0; i < this.buf.length - 1; i++) {
      if (this.buf[i].ht <= this.renderHt && this.buf[i + 1].ht >= this.renderHt) { a = this.buf[i]; b = this.buf[i + 1]; break; }
    }
    if (!a) { a = b = (this.renderHt < this.buf[0].ht) ? this.buf[0] : newest; }
    var k = (a === b || b.ht === a.ht) ? 1 : U.clamp((this.renderHt - a.ht) / (b.ht - a.ht), 0, 1);
    var sa = a.s, sb = b.s;
    for (var j = 0; j < this.players.length; j++) {
      var p = this.players[j], o = j * 5;
      var ax = sa.p[o] / 100, az = sa.p[o + 1] / 100, bx = sb.p[o] / 100, bz = sb.p[o + 1] / 100;
      if (Math.abs(bx - ax) > 6 || Math.abs(bz - az) > 6) { ax = bx; az = bz; }
      var nx = U.lerp(ax, bx, k), nz = U.lerp(az, bz, k);
      p.vx = dt > 0 ? (nx - p.x) / dt : 0; p.vz = dt > 0 ? (nz - p.z) / dt : 0;
      p.x = nx; p.z = nz;
      p.facing = U.angLerp(sa.p[o + 2] / 100, sb.p[o + 2] / 100, k);
    }
    var bA = sa.b, bB = sb.b;
    var bx2 = bA[0] / 100, by2 = bA[1] / 100, bz2 = bA[2] / 100;
    if (Math.abs(bB[0] - bA[0]) < 800 && Math.abs(bB[2] - bA[2]) < 800) {
      bx2 = U.lerp(bA[0], bB[0], k) / 100; by2 = U.lerp(bA[1], bB[1], k) / 100; bz2 = U.lerp(bA[2], bB[2], k) / 100;
    } else { bx2 = bB[0] / 100; by2 = bB[1] / 100; bz2 = bB[2] / 100; }
    this.ball.x = bx2; this.ball.y = by2; this.ball.z = bz2;
    // buang buffer lama
    while (this.buf.length > 2 && this.buf[1].ht < this.renderHt - 200) this.buf.shift();
    void nowMs;
  };

  /* ambil event baru dari presence tuan rumah */
  RemoteView.prototype.newEvents = function (list) {
    var out = [], self = this;
    if (!Array.isArray(list)) return out;
    list.forEach(function (e) { if (e && typeof e.id === 'number' && e.id > self.lastEv) out.push(e); });
    out.sort(function (a, b) { return a.id - b.id; });
    if (out.length) this.lastEv = out[out.length - 1].id;
    return out;
  };
})(typeof window !== 'undefined' ? window : globalThis);
