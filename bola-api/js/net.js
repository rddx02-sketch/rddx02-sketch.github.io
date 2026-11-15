/* Bola Api Arena — mode online sampai 8 pemain (1 tuan rumah + 7 tamu): room claude.ai, Supabase Realtime, atau WiFi lokal (WebRTC); plus tampilan jarak jauh untuk tamu */
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
  /* ======================================================================
     DAFTAR PESERTA ROOM (sama untuk semua jalur: room claude.ai, Supabase, WiFi lokal)
     Tuan rumah melihat semua tamu (sampai 7); tamu hanya melihat tuan rumah.
     peers[id] = { id, role: 'h'|'g', pres: keadaan terakhir, at: waktu kabar terakhir, seq: urutan masuk }
     ====================================================================== */
  Net.myId = 'u' + Math.random().toString(36).slice(2, 10);
  Net.peers = {}; Net.selfId = ''; Net.joinSeq = 0; Net.V = 2; Net.MAX_GUESTS = 7;
  var FAST = ['s', 'e', 'i', 'ack', 'cmd'];
  function wanted(r) { return Net.role === 'host' ? r === 'g' : r === 'h'; }
  function refreshOther() {
    var list = Net.peerList();
    var p = list[0] || null;
    Net.other = p ? p.pres : null; Net.otherPeer = p ? p.id : null;
  }
  /* daftar peserta lain menurut urutan masuk */
  Net.peerList = function () {
    return Object.keys(Net.peers).map(function (k) { return Net.peers[k]; }).sort(function (a, b) { return a.seq - b.seq; });
  };
  Net.hostPeer = function () { var l = Net.peerList(); for (var i = 0; i < l.length; i++) if (l[i].role === 'h') return l[i]; return null; };
  Net.guestPeers = function () { return Net.peerList().filter(function (p) { return p.role === 'g'; }); };
  function peerSet(id, role, pres, partial) {
    if (!id || !wanted(role)) return null;
    var p = Net.peers[id], isNew = !p;
    /* kabar pamit: peserta sengaja keluar — langsung dianggap pergi (tanpa menunggu sambungan putus) */
    if (pres && pres.st === 'bye') { if (p) { p.pres = pres; peerDrop(id); } return null; }
    if (isNew) {
      if (partial) return null; /* kiriman cepat dari peserta yang belum dikenal: tunggu kabar lengkapnya */
      if (Net.role === 'host' && Object.keys(Net.peers).length >= Net.MAX_GUESTS) return null;
      if (Net.role === 'guest' && Object.keys(Net.peers).length >= 1) return null; /* hanya satu tuan rumah */
      p = Net.peers[id] = { id: id, role: role, pres: {}, at: 0, seq: ++Net.joinSeq };
    }
    if (partial) { Object.keys(pres).forEach(function (k) { if (pres[k] === null) delete p.pres[k]; else p.pres[k] = pres[k]; }); }
    else {
      var np = pres || {};
      /* Supabase & WiFi lokal: kabar lengkap saat laga tidak membawa kiriman cepat, jadi yang terakhir diterima dipertahankan.
         (Room claude.ai selalu membawa keadaan utuh, dan objeknya beku: jangan diubah.) */
      if (!isNew && np.st === 'play' && (Net.sb || Net.lan)) {
        var keep = null;
        FAST.forEach(function (k) { if (np[k] === undefined && p.pres[k] !== undefined) { if (!keep) keep = Object.assign({}, np); keep[k] = p.pres[k]; } });
        if (keep) np = keep;
      }
      p.pres = np;
    }
    p.at = Date.now(); Net.lastOtherAt = p.at;
    refreshOther();
    if (isNew) fire('joined', p);
    fire('presence', p);
    return p;
  }
  function peerDrop(id) {
    var p = Net.peers[id];
    if (!p) return;
    delete Net.peers[id];
    refreshOther();
    fire('left', p);
  }
  function mergeMine(patch) {
    var merged = Object.assign({}, Net.mine);
    Object.keys(patch).forEach(function (k) { if (patch[k] === null) delete merged[k]; else merged[k] = patch[k]; });
    return merged;
  }

  /* ---------- Supabase: presence untuk hadir/pergi, broadcast 'p' = keadaan lengkap, 'f' = kiriman cepat saat laga ---------- */
  Net.sbJoin = function (code, role, presence) {
    return Net.sbReady().then(function (client) {
      return new Promise(function (resolve, reject) {
        var topic = Net.roomName(code);
        var ch = client.channel(topic, { config: { presence: { key: Net.myId }, broadcast: { self: false, ack: false } } });
        var settled = false;
        var sb = Net.sb = { ch: ch, topic: topic, role: role };
        Net.role = role; Net.code = code; Net.peers = {}; Net.other = null; Net.otherPeer = null; Net.lastOtherAt = 0; Net.selfId = Net.myId;
        Net.mine = Object.assign({ r: role === 'host' ? 'h' : 'g', v: Net.V, id: Net.myId }, presence || {});
        function scan() {
          if (Net.sb !== sb) return;
          var st = ch.presenceState() || {}, here = {}, fresh = false;
          Object.keys(st).forEach(function (k) {
            if (k === Net.myId) return;
            var m = (st[k] || [])[0] || {};
            if (m.v === Net.V && wanted(m.r)) { here[k] = 1; if (!Net.peers[k]) fresh = true; }
          });
          Object.keys(Net.peers).forEach(function (id) { if (!here[id]) peerDrop(id); });
          if (fresh) Net.sbPush(); /* ada peserta baru: perkenalkan diri */
        }
        ch.on('presence', { event: 'sync' }, scan);
        ch.on('presence', { event: 'leave' }, scan);
        ch.on('broadcast', { event: 'p' }, function (msg) {
          if (Net.sb !== sb) return;
          var p = msg && msg.payload;
          if (!p || p.id === Net.myId || p.v !== Net.V) return;
          var isNew = !Net.peers[p.id];
          if (peerSet(p.id, p.r, p) && isNew) Net.sbPush();
        });
        ch.on('broadcast', { event: 'f' }, function (msg) {
          if (Net.sb !== sb) return;
          var p = msg && msg.payload;
          if (!p || p.id === Net.myId || !p.d || typeof p.d !== 'object') return;
          peerSet(p.id, p.r, p.d, true);
        });
        ch.subscribe(function (status, err) {
          if (Net.sb !== sb) return;
          if (status === 'SUBSCRIBED') {
            ch.track({ r: Net.mine.r, v: Net.V }).then(function () {
              if (!settled) { settled = true; Net.connected = true; fire('conn', true); resolve(ch); }
              Net.sbPush();
              /* kirim ulang berkala: siaran pertama bisa hilang saat peserta baru bergabung; keadaan lobi juga ikut tersegarkan */
              if (!sb.alive) sb.alive = setInterval(function () {
                if (Net.sb !== sb) { clearInterval(sb.alive); return; }
                var st = ch.presenceState() || {}, others = Object.keys(st).filter(function (k) { return k !== Net.myId; }).length;
                if (others > 0) Net.sbPush();
              }, 1500);
            }, function (e) { if (!settled) { settled = true; reject({ code: 'track', message: String(e) }); } });
          } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            if (!settled) { settled = true; reject({ code: status.toLowerCase(), message: err ? String(err) : '' }); } else fire('error', { code: status.toLowerCase() });
          } else if (status === 'CLOSED' && settled) { fire('error', { code: 'closed' }); }
        });
        setTimeout(function () { if (!settled) { settled = true; reject({ code: 'timeout' }); } }, 12000);
      });
    });
  };
  /* keadaan lengkap tanpa kiriman cepat (snapshot/event/masukan tidak diulang di siaran 'p') */
  Net.sbPush = function () {
    var sb = Net.sb; if (!sb) return;
    var m = Net.mine, o = {};
    Object.keys(m).forEach(function (k) { if (k !== 's' && k !== 'e' && k !== 'i') o[k] = m[k]; });
    try { sb.ch.send({ type: 'broadcast', event: 'p', payload: o }); } catch (e) { fire('sendError', e); }
  };
  function sbClose(sb) {
    if (!sb) return;
    if (sb.alive) clearInterval(sb.alive);
    try { sb.ch.untrack(); } catch (e) { /* abaikan */ }
    try { sb.ch.unsubscribe(); if (Net.sbClient) Net.sbClient.removeChannel(sb.ch); } catch (e2) { /* abaikan */ }
  }
  Net.sbLeave = function () {
    var sb = Net.sb; if (!sb) return;
    Net.sb = null;
    sbClose(sb);
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
      Net.leave(); Net.flushClose();
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
    Net.leave(); Net.flushClose();
    Net.role = role; Net.code = code; Net.peers = {}; Net.other = null; Net.otherPeer = null; Net.lastOtherAt = 0; Net.mine = {}; Net.selfId = '';
    return Net.room.join(Net.roomName(code)).then(function (nr) {
      Net.nr = nr;
      Net.unsubs.push(nr.onPeers(function (ch) { Net.handlePeers(ch); }, function (e) { fire('error', e); }));
      Net.unsubs.push(nr.onConnection(function (c) { Net.connected = c; fire('conn', c); }, function (e) { fire('error', e); }));
      return Net.send(Object.assign({ r: role === 'host' ? 'h' : 'g', v: Net.V }, presence || {})).then(function () { return nr; });
    });
  };

  /* room claude.ai: label peer sama di semua halaman, jadi dipakai sebagai id peserta */
  Net.handlePeers = function (ch) {
    var seen = {};
    (ch.peers || []).forEach(function (p) {
      if (p.kind !== 'viewer') return;
      if (p.sameTab) { Net.selfId = p.peer; return; }
      var pr = p.presence || {};
      if (pr.v !== Net.V || !wanted(pr.r)) return;
      var cur = Net.peers[p.peer];
      if (cur) { seen[p.peer] = 1; if (cur.pres !== pr) peerSet(p.peer, pr.r, pr); }
      else if (peerSet(p.peer, pr.r, pr)) seen[p.peer] = 1;
    });
    Object.keys(Net.peers).forEach(function (id) { if (!seen[id]) peerDrop(id); });
  };

  /* keadaan saya (lobi, daftar pemain, aturan): digabung & disiarkan ke semua peserta */
  Net.send = function (patch) {
    if (Net.lan) { Net.mine = mergeMine(patch); lanCast({ p: Net.mine }); return Promise.resolve(); }
    if (Net.sb) { Net.mine = mergeMine(patch); Net.mine.r = Net.role === 'host' ? 'h' : 'g'; Net.mine.v = Net.V; Net.mine.id = Net.myId; Net.sbPush(); return Promise.resolve(); }
    if (!Net.nr) return Promise.resolve();
    // jaga agar objek presence gabungan tetap di bawah 4 KiB
    var merged = mergeMine(patch);
    if (Net.bytes(merged) > Net.LIMIT) { fire('sendError', { code: 'too_big' }); return Promise.resolve(); }
    Net.mine = merged;
    try {
      return Net.nr.presence(patch).catch(function (e) { fire('sendError', e); });
    } catch (e) { return Promise.resolve(); }
  };
  /* kiriman cepat saat laga (snapshot + event dari tuan rumah, masukan dari tamu).
     Room claude.ai hanya punya presence, jadi ikut digabung di sana; Supabase & WiFi lokal memakai pesan kecil terpisah */
  Net.sendFast = function (obj) {
    if (Net.lan) { lanCast({ f: obj }); return Promise.resolve(); }
    if (Net.sb) {
      try { Net.sb.ch.send({ type: 'broadcast', event: 'f', payload: { id: Net.myId, r: Net.role === 'host' ? 'h' : 'g', d: obj } }); } catch (e) { fire('sendError', e); }
      return Promise.resolve();
    }
    return Net.send(obj);
  };

  /* Keluar dari room. Kalau masih ada peserta lain, pamit dulu (st: 'bye') supaya mereka tahu ini sengaja dan tidak
     menunggu sambungan kembali; sambungan lama ditutup sesaat kemudian agar kabar pamit sempat terkirim. */
  Net.pendingClose = null;
  Net.flushClose = function () { var f = Net.pendingClose; Net.pendingClose = null; if (f) f(); };
  Net.leave = function () {
    Net.unsubs.forEach(function (u) { try { u(); } catch (e) { /* abaikan */ } });
    Net.unsubs = [];
    var nr = Net.nr, sb = Net.sb, lan = Net.lan;
    var close = function () {
      if (nr) { try { nr.leave(); } catch (e) { /* abaikan */ } }
      lanCloseObj(lan);
      sbClose(sb);
    };
    if ((nr || sb || lan) && Object.keys(Net.peers).length) {
      try {
        if (lan) lanCast({ p: { r: Net.mine.r, v: Net.V, st: 'bye' } });
        else if (sb) sb.ch.send({ type: 'broadcast', event: 'p', payload: { r: Net.role === 'host' ? 'h' : 'g', v: Net.V, id: Net.myId, st: 'bye' } });
        else { var pr = nr.presence({ st: 'bye', s: null, e: null, i: null, ack: null, cmd: null }); if (pr && pr.catch) pr.catch(function () { /* abaikan */ }); }
      } catch (e) { /* abaikan */ }
      Net.flushClose();
      var tm = setTimeout(function () { if (Net.pendingClose === fin) Net.pendingClose = null; close(); }, 350);
      var fin = function () { clearTimeout(tm); close(); };
      Net.pendingClose = fin;
    } else close();
    Net.lan = null; Net.sb = null;
    Net.nr = null; Net.role = null; Net.other = null; Net.otherPeer = null; Net.mine = {}; Net.peers = {}; Net.selfId = '';
  };

  /* ======================================================================
     MODE WIFI LOKAL: WebRTC DataChannel di WiFi/hotspot yang sama, tanpa server & tanpa internet.
     Tuan rumah membuka satu sambungan per tamu (sampai 7); kode sambungan (SDP) ditukar lewat QR, salin-tempel, atau WhatsApp.
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
  /* satu sambungan WebRTC. Tuan rumah: id tamu 'L1', 'L2', …; tamu: sambungannya ke tuan rumah ber-id 'host' */
  function lanConn(lan, id) {
    var pc = new root.RTCPeerConnection({ iceServers: [] });
    var c = { pc: pc, dc: null, open: false, id: id, dead: false };
    lan.conns.push(c);
    var lost = function () {
      if (Net.lan !== lan || c.dead) return;
      var was = c.open;
      c.dead = true; c.open = false;
      lan.conns = lan.conns.filter(function (x) { return x !== c; });
      if (lan.pending === c) lan.pending = null;
      try { pc.close(); } catch (e) { /* abaikan */ }
      if (was) peerDrop(c.id); else fire('error', { code: 'rtc-gagal' });
    };
    pc.onconnectionstatechange = function () {
      var st = pc.connectionState;
      if (st === 'failed' || st === 'disconnected' || st === 'closed') lost();
    };
    c.wire = function (dc) {
      c.dc = dc;
      dc.onopen = function () {
        if (Net.lan !== lan || c.dead) return;
        c.open = true; Net.connected = true; fire('conn', true);
        if (lan.pending === c) lan.pending = null;
        try {
          if (lan.role === 'host') dc.send(JSON.stringify({ you: c.id }));
          dc.send(JSON.stringify({ p: Net.mine }));
        } catch (e) { /* abaikan */ }
      };
      dc.onmessage = function (ev) {
        if (Net.lan !== lan || c.dead) return;
        var o; try { o = JSON.parse(ev.data); } catch (e) { return; }
        if (!o || typeof o !== 'object') return;
        var role = lan.role === 'host' ? 'g' : 'h';
        if (typeof o.you === 'string' && lan.role === 'guest') Net.selfId = o.you;
        if (o.p && typeof o.p === 'object') peerSet(c.id, role, o.p);
        else if (o.f && typeof o.f === 'object') peerSet(c.id, role, o.f, true);
      };
      dc.onclose = function () { lost(); };
    };
    return c;
  }
  function lanCast(msg) {
    var lan = Net.lan; if (!lan) return;
    var txt;
    try { txt = JSON.stringify(msg); } catch (e) { return; }
    lan.conns.forEach(function (c) { if (c.open && c.dc && c.dc.readyState === 'open') { try { c.dc.send(txt); } catch (e) { fire('sendError', e); } } });
  }
  function lanStart(role) {
    Net.leave(); Net.flushClose();
    Net.lan = { role: role, conns: [], pending: null, n: 0 };
    Net.role = role; Net.mine = {}; Net.peers = {}; Net.other = null; Net.otherPeer = null; Net.lastOtherAt = 0; Net.selfId = role === 'host' ? 'host' : '';
    return Net.lan;
  }
  Net.lanOpenCount = function () { return Net.lan ? Net.lan.conns.filter(function (c) { return c.open; }).length : 0; };
  /* tuan rumah: buat kode undangan untuk SATU tamu berikutnya (sambungan tamu lain tetap hidup) */
  Net.lanOffer = function () {
    if (!Net.lanOk()) return Promise.reject({ code: 'no-webrtc' });
    var lan = (Net.lan && Net.lan.role === 'host') ? Net.lan : lanStart('host');
    if (lan.conns.filter(function (c) { return c.open; }).length >= Net.MAX_GUESTS) return Promise.reject({ code: 'penuh' });
    if (lan.pending) { var old = lan.pending; lan.pending = null; old.dead = true; lan.conns = lan.conns.filter(function (x) { return x !== old; }); try { old.pc.close(); } catch (e) { /* abaikan */ } }
    var c = lanConn(lan, 'L' + (++lan.n));
    lan.pending = c;
    c.wire(c.pc.createDataChannel('bola', { ordered: true }));
    return c.pc.createOffer().then(function (o) { return c.pc.setLocalDescription(o); }).then(function () { return waitIce(c.pc); }).then(function () { return packSdp(c.pc.localDescription); });
  };
  /* tamu: terima kode undangan, hasilkan kode balasan */
  Net.lanAnswer = function (offerStr) {
    if (!Net.lanOk()) return Promise.reject({ code: 'no-webrtc' });
    var desc = unpackSdp(offerStr);
    if (!desc || desc.type !== 'offer') return Promise.reject({ code: 'bad-offer' });
    var lan = lanStart('guest');
    var c = lanConn(lan, 'host');
    c.pc.ondatachannel = function (e) { c.wire(e.channel); };
    return c.pc.setRemoteDescription(desc).then(function () { return c.pc.createAnswer(); }).then(function (a) { return c.pc.setLocalDescription(a); }).then(function () { return waitIce(c.pc); }).then(function () { return packSdp(c.pc.localDescription); });
  };
  /* tuan rumah: terima kode balasan tamu untuk undangan yang sedang menunggu */
  Net.lanAccept = function (answerStr) {
    var desc = unpackSdp(answerStr);
    if (!Net.lan || Net.lan.role !== 'host' || !Net.lan.pending) return Promise.reject({ code: 'no-host' });
    if (!desc || desc.type !== 'answer') return Promise.reject({ code: 'bad-answer' });
    return Net.lan.pending.pc.setRemoteDescription(desc);
  };
  function lanCloseObj(lan) {
    if (!lan) return;
    lan.conns.forEach(function (c) {
      c.dead = true;
      try { if (c.dc) c.dc.close(); } catch (e) { /* abaikan */ }
      try { c.pc.close(); } catch (e2) { /* abaikan */ }
    });
  }
  Net.lanClose = function () {
    var lan = Net.lan; if (!lan) return;
    Net.lan = null;
    lanCloseObj(lan);
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
    var Tt = function (s) { return BA.t ? BA.t.apply(null, arguments) : s; };
    var text = Tt('Ayo tanding Bola Api Arena! Buka tautan ini lalu tekan Gabung: {0}', url) + ' (' + Tt('kode room {0}', String(code).toUpperCase()) + ')';
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
  var SEND_KINDS = { whistle: 1, kick: 1, pass: 1, tackle: 1, slide: 1, gocek: 1, cine: 1, goal: 1, save: 1, post: 1, miss: 1, say: 1, hot: 1, petir: 1, corner: 1, penalty: 1, shootout: 1, penres: 1, end: 1, golden: 1, restart: 1, kickoffFirst: 1, offside: 1, foul: 1, card: 1,
    half: 1, backpass: 1, strike: 1, block: 1, injury: 1, sub: 1, teamset: 1 };
  /* event yang wajib sampai walau kiriman dipangkas karena batas ukuran */
  var MUST = { cine: 1, goal: 1, end: 1, penres: 1, sub: 1 };
  Net.HostLink = function (sim, mid) {
    this.sim = sim; this.mid = mid; this.ring = []; this.lastSend = 0; this.acks = {}; this.cmdSeq = {}; this.fitAt = 0; this.onCmd = null;
  };
  Net.HostLink.prototype.feed = function (events) {
    var self = this;
    events.forEach(function (e) {
      if (!SEND_KINDS[e.k]) return;
      var o = { id: e.id, k: e.k };
      Object.keys(e).forEach(function (key) { if (key !== 'id' && key !== 'k') o[key] = e[key]; });
      self.ring.push(o);
    });
    if (this.ring.length > 18) this.ring.splice(0, this.ring.length - 18);
  };
  /* id event terakhir yang sudah diterima SEMUA tamu yang masih tersambung */
  Net.HostLink.prototype.minAck = function () {
    var g = Net.guestPeers(), m = null, self = this;
    g.forEach(function (p) { var a = self.acks[p.id] || 0; if (m === null || a < m) m = a; });
    return m === null ? 0 : m;
  };
  Net.HostLink.prototype.tick = function (nowMs, extra) {
    var gap = Net.lan ? 50 : (Net.transport === 'sb' ? (Net.guestPeers().length > 2 ? 100 : 80) : 66);
    if (nowMs - this.lastSend < gap) return;
    this.lastSend = nowMs;
    var ack = this.minAck();
    var ev = this.ring.filter(function (e) { return e.id > ack; });
    var withFit = nowMs - this.fitAt > 1000;
    if (withFit) this.fitAt = nowMs;
    var patch = { st: 'play', mid: this.mid, s: this.sim.snapshot(withFit), e: ev };
    if (extra) Object.keys(extra).forEach(function (k) { patch[k] = extra[k]; });
    if (!Net.lan && !Net.sb) {
      // room claude.ai: ukur objek presence gabungan (daftar pemain + aturan + snapshot + event) terhadap batas 4 KiB
      var full = Object.assign({}, Net.mine, patch);
      if (Net.bytes(full) > Net.LIMIT) {
        patch.e = ev.filter(function (e) { return MUST[e.k]; }).slice(-3);
        full.e = patch.e;
        if (Net.bytes(full) > Net.LIMIT) { patch.e = ev.filter(function (e) { return e.k === 'end' || e.k === 'cine'; }).slice(-1); full.e = patch.e; }
        if (Net.bytes(full) > Net.LIMIT) { patch.e = []; }
      }
    }
    Net.sendFast(patch);
  };
  /* baca masukan satu tamu (pres = keadaan terakhirnya); id = id peserta untuk catatan ack & perintah */
  Net.HostLink.prototype.readGuest = function (pres, id) {
    if (!pres) return null;
    id = id || '_';
    if (Array.isArray(pres.ack) && pres.ack[0] === this.mid && typeof pres.ack[1] === 'number') this.acks[id] = Math.max(this.acks[id] || 0, pres.ack[1]);
    /* perintah kapten (formasi, pergantian): [mid, nomor urut terakhir, [[nomor, perintah], …]] — tiap nomor dijalankan sekali */
    if (Array.isArray(pres.cmd) && pres.cmd[0] === this.mid && Array.isArray(pres.cmd[2])) {
      var list = pres.cmd[2], done = this.cmdSeq[id] || 0;
      for (var ci = 0; ci < list.length && ci < 8; ci++) {
        var it = list[ci];
        if (!Array.isArray(it) || typeof it[0] !== 'number' || it[0] <= done || !it[1] || typeof it[1] !== 'object') continue;
        done = it[0];
        if (this.onCmd) this.onCmd(id, it[1]);
      }
      this.cmdSeq[id] = done;
    }
    var a = pres.i;
    if (!Array.isArray(a)) return null;
    return {
      mx: U.num(a[0], 0) / 100, mz: U.num(a[1], 0) / 100, sprint: !!a[2], passSeq: a[3] | 0, gocekSeq: a[4] | 0, switchSeq: a[5] | 0,
      shootHeld: !!a[6], shootSeq: a[7] | 0, charge: U.num(a[8], 0) / 100, zc: a[9] | 0, zr: a[10] | 0, skipSeq: a[11] | 0, chase: !!a[12],
      passCharge: U.num(a[13], 0) / 100, lobSeq: a[14] | 0, lobCharge: U.num(a[15], 0) / 100,
      longSeq: a[16] | 0, longCharge: U.num(a[17], 0) / 100, chipSeq: a[18] | 0, chipCharge: U.num(a[19], 0) / 100, easy: !!a[20]
    };
  };
  Net.packInput = function (inp) {
    return [Math.round(inp.mx * 100), Math.round(inp.mz * 100), inp.sprint ? 1 : 0, inp.passSeq, inp.gocekSeq, inp.switchSeq, inp.shootHeld ? 1 : 0, inp.shootSeq, Math.round(inp.charge * 100), inp.zc, inp.zr, inp.skipSeq, inp.chase ? 1 : 0,
      Math.round((inp.passCharge || 0) * 100), inp.lobSeq | 0, Math.round((inp.lobCharge || 0) * 100),
      inp.longSeq | 0, Math.round((inp.longCharge || 0) * 100), inp.chipSeq | 0, Math.round((inp.chipCharge || 0) * 100), inp.easy ? 1 : 0];
  };

  /* ---------- tampilan jarak jauh (tamu) ---------- */
  var ROLE_IDS = ['GK', 'DF', 'MF', 'FW'];
  var RemoteView = BA.RemoteView = function (cfg) {
    this.cfg = cfg;
    D.useField(cfg.field);
    this.field = D.FIELD.id; this.n = D.FIELD.n;
    this.teams = D.resolveKits(D.matchTeam(cfg.teams[0], this.field), D.matchTeam(cfg.teams[1], this.field));
    this.rules = Object.assign(D.defaultRules(), cfg.rules || {});
    this.mode = cfg.mode || 'match';
    this.arena = D.arenaById[cfg.arena] || D.ARENAS[0];
    this.weather = D.weatherById[cfg.weather] || D.WEATHERS[0];
    if (this.arena.indoor) this.weather = D.WEATHERS[0];
    this.ballDef = D.ballById[cfg.ball] || D.BALLS[0];
    this.players = [];
    for (var t = 0; t < 2; t++) {
      var slots = D.formSlots(this.n, this.teams[t].form, this.teams[t].players);
      for (var i = 0; i < this.n; i++) {
        var c = this.teams[t].players[i];
        this.players.push({ team: t, idx: i, cfg: c, role: (slots[i] && slots[i].role) || c.role, name: c.name, num: c.num, shot: D.shotById[c.shot] || D.SHOTS[0], style: D.styleById[c.style] || D.STYLES[0],
          x: 0, z: 0, facing: 0, anim: 'idle', animT: 0, hidden: false, gkHold: false, celebrate: false, st: D.playerStats(c, this.teams[t].level),
          energy: 100, stamina: 100, injured: false, diveSide: 0, slotIdx: i, slot: slots[i] || { fx: 0.4, fz: 0 } });
      }
    }
    this.ball = { x: 0, y: 0.13, z: 0, owner: null, petirT: 0, holdT: 0, vx: 0, vz: 0 };
    this.score = [0, 0]; this.sem = [0, 0]; this.clock = this.rules.dur; this.phase = 'kickoff'; this.timeScale = 1;
    this.active = [null, null]; this.aim = null; this.pen = null; this.shootout = null; this.revealed = [{}, {}]; this.corners = [0, 0];
    this.golden = false; this.winner = -1; this.goalTeam = -1; this.half = 1; this.swap = false; this.coop = false; this.active2 = null;
    this.buf = []; this.lastEv = 0; this.renderHt = null; this.got = false; this.lastRecv = 0;
    /* kursi: tim tiap pengendali manusia (dari tuan rumah) */
    var st = Array.isArray(cfg.seats) ? cfg.seats : [0, 1];
    this.seats = st.map(function (tm) { return (tm === 0 || tm === 1) ? { team: tm, p: null } : null; });
    this.humans = [this.seats.some(function (s) { return s && s.team === 0; }), this.seats.some(function (s) { return s && s.team === 1; })];
    var n = this.n, self = this;
    this.subsLeft = [D.MAX_SUBS, D.MAX_SUBS];
    this.bench = [0, 1].map(function (tt) { var out = []; for (var j = 0; j < D.BENCH; j++) if (self.teams[tt].players[n + j]) out.push({ i: n + j, used: false }); return out; });
  };
  RemoteView.prototype.dirOf = function (team) { return (team === 0 ? 1 : -1) * (this.swap ? -1 : 1); };
  RemoteView.prototype.pl = function (t, i) { return (i >= 0 && i < this.n) ? (this.players[t * this.n + i] || null) : null; };
  RemoteView.prototype.code = function (p) { return p ? p.team * this.n + p.idx : -1; };
  RemoteView.prototype.oppGoalX = function (team) { return this.dirOf(team) * D.FIELD.L / 2; };
  RemoteView.prototype.inShotRange = function (p) { var F = D.FIELD; return U.dist(p.x, p.z, this.oppGoalX(p.team), 0) < F.shot && Math.abs(p.z) < Math.max(12.5, F.boxW / 2 + 4); };
  RemoteView.prototype.strikeRange = Sim ? Sim.prototype.strikeRange : function () { return 0; };
  RemoteView.prototype.seatP = function (si) { var s = this.seats[si]; return s ? s.p : null; };
  RemoteView.prototype.seatOf = function (p) { if (!p) return -1; for (var i = 0; i < this.seats.length; i++) if (this.seats[i] && this.seats[i].p === p) return i; return -1; };
  RemoteView.prototype.teamSeats = function (team) { var out = []; for (var i = 0; i < this.seats.length; i++) if (this.seats[i] && this.seats[i].team === team) out.push(i); return out; };
  RemoteView.prototype.isCtl = function (p) { return this.seatOf(p) >= 0; };
  RemoteView.prototype.penSeat = function (pen) { return pen && typeof pen.seat === 'number' ? pen.seat : -1; };

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
    var n2 = this.n * 2, i;
    if (Array.isArray(s.cp)) for (i = 0; i < this.seats.length; i++) { if (this.seats[i]) this.seats[i].p = (s.cp[i] >= 0 && s.cp[i] < n2) ? this.players[s.cp[i]] : null; }
    this.aim = (s.am >= 0 && s.am < n2) ? { p: this.players[s.am], team: Math.floor(s.am / this.n) } : null;
    this.ball.owner = s.b[3] >= 0 && s.b[3] < n2 ? this.players[s.b[3]] : null;
    this.ball.petirT = s.b[4] ? 1 : 0;
    this.ball.holdT = U.num(s.b[5], 0) / 10;
    this.corners = Array.isArray(s.cn) ? s.cn : [0, 0];
    this.golden = !!s.gg;
    this.winner = U.num(s.wn, -1);
    this.goalTeam = U.num(s.gt, -1);
    this.half = U.num(s.hf, 1); this.swap = !!s.sw;
    if (Array.isArray(s.pn)) {
      this.pen = { state: Sim.PEN_STATES[s.pn[0]] || 'setup', team: s.pn[1] | 0, kind: ['single', 'shootout', 'practice'][s.pn[2]] || 'single', shooter: this.pl(s.pn[1] | 0, s.pn[3] | 0), seat: typeof s.pn[4] === 'number' ? s.pn[4] : -1 };
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
    for (i = 0; i < n2; i++) {
      var p = this.players[i], f = s.p[i * 5 + 4] | 0;
      var an = Sim.ANIMS[s.p[i * 5 + 3] | 0] || 'idle';
      if (an !== p.anim) { p.anim = an; p.animT = 0; }
      p.hidden = !!(f & 1); p.gkHold = !!(f & 2); p.celebrate = !!(f & 4); p.throwIn = !!(f & 8); p.sprint = !!(f & 16);
      p.diveSide = (f & 32) ? 1 : ((f & 64) ? -1 : 0); p.injured = !!(f & 128);
    }
    if (s.fit && typeof s.fit === 'object') this.applyFit(s.fit);
  };
  /* kebugaran, slot/peran, formasi, taktik, sisa pergantian (dikirim tuan rumah ±1× per detik) */
  RemoteView.prototype.applyFit = function (ft) {
    var n2 = this.n * 2, tacs = D.TACTICS, self = this, i;
    if (Array.isArray(ft.e)) for (i = 0; i < n2; i++) if (typeof ft.e[i] === 'number') { this.players[i].energy = U.clamp(ft.e[i], 0, 100); this.players[i].stamina = this.players[i].energy; }
    if (Array.isArray(ft.s)) for (i = 0; i < n2; i++) if (typeof ft.s[i] === 'number') this.players[i].slotIdx = U.clamp(ft.s[i] | 0, 0, this.n - 1);
    if (Array.isArray(ft.r)) for (i = 0; i < n2; i++) if (ROLE_IDS[ft.r[i]]) this.players[i].role = ROLE_IDS[ft.r[i]];
    [0, 1].forEach(function (t) {
      var team = self.teams[t];
      if (Array.isArray(ft.f)) { var fo = ft.f[t]; if (fo && D.formById(self.n, fo)) team.form = fo; else delete team.form; }
      if (Array.isArray(ft.tc) && tacs[ft.tc[t]]) team.tactic = tacs[ft.tc[t]].id;
      if (Array.isArray(ft.su) && typeof ft.su[t] === 'number') self.subsLeft[t] = U.clamp(ft.su[t] | 0, 0, D.MAX_SUBS);
      if (Array.isArray(ft.bn) && Array.isArray(ft.bn[t])) self.bench[t].forEach(function (b, j) { b.used = !!ft.bn[t][j]; });
      if (Array.isArray(ft.au)) team.autoSub = !!ft.au[t];
      var slots = D.formSlots(self.n, team.form, team.players);
      self.players.forEach(function (p) { if (p.team === t && slots[p.slotIdx]) p.slot = slots[p.slotIdx]; });
    });
  };
  /* event pergantian pemain dari tuan rumah: tukar di daftar tim & perbarui pemain di lapangan */
  RemoteView.prototype.applySub = function (e) {
    var t = e.team | 0, team = this.teams[t], p = this.pl(t, e.idx | 0), bi = e.bi | 0;
    if (!team || !p || !team.players[bi] || bi < this.n) return false;
    if (team.players[bi].name !== e.on && p.name === e.on) return false; /* sudah diterapkan */
    var old = team.players[p.idx], nw = team.players[bi];
    team.players[p.idx] = nw; team.players[bi] = old;
    p.cfg = nw; p.name = nw.name; p.num = nw.num; p.st = D.playerStats(nw, team.level);
    p.shot = D.shotById[nw.shot] || D.SHOTS[0]; p.style = D.styleById[nw.style] || D.STYLES[0];
    p.energy = 100; p.injured = false;
    var b = this.bench[t][e.j | 0]; if (b) b.used = true;
    if (typeof e.left === 'number') this.subsLeft[t] = e.left;
    return true;
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

  /* ambil event baru dari kiriman tuan rumah */
  RemoteView.prototype.newEvents = function (list) {
    var out = [], self = this;
    if (!Array.isArray(list)) return out;
    list.forEach(function (e) { if (e && typeof e.id === 'number' && e.id > self.lastEv) out.push(e); });
    out.sort(function (a, b) { return a.id - b.id; });
    if (out.length) this.lastEv = out[out.length - 1].id;
    return out;
  };
})(typeof window !== 'undefined' ? window : globalThis);
