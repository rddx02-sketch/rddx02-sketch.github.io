/* Bola Api Arena — data tambahan: pemain cadangan, tim bintang tamu, formasi, susunan pemain, kebugaran, arena baru */
(function (root) {
  'use strict';
  var BA = root.BA, U = BA.U, D = BA.D;

  /* ---------------- pemain cadangan tim NPC (indeks 11..15) ---------------- */
  var SHOTS = ['naga', 'macan', 'garuda', 'banteng', 'keris', 'meteor', 'beliung', 'tinju'];
  var HAIRS = ['cepak', 'belah', 'gondrong', 'mohawk', 'keriting', 'kuncir', 'botak'];
  var HEADS = ['none', 'none', 'ikat', 'none', 'topi', 'none', 'bandana', 'kupluk'];
  var FEET = ['sepatu', 'nyeker', 'sepatu', 'sandal'];
  var BODIES = ['sedang', 'kurus', 'gempal'], HEIGHTS = ['sedang', 'tinggi', 'pendek'], FACES = ['polos', 'polos', 'kumis', 'polos', 'brewok', 'kacamata', 'jenggot'];
  var BROLES = ['MF', 'DF', 'FW', 'MF', 'DF'];
  function benchPlayer(name, k, ti, variant) {
    var h = ti * 7 + k * 13 + 3;
    var role = BROLES[k % BROLES.length];
    var p = {
      name: name, num: 12 + k, role: role,
      shot: role === 'DF' ? (h % 2 ? 'banteng' : 'tinju') : SHOTS[h % SHOTS.length], style: 'elang', foot: FEET[h % FEET.length],
      skin: (h * 3) % 6, hair: HAIRS[(h * 5) % HAIRS.length], hairC: (h * 7) % 5, head: HEADS[(h * 3) % HEADS.length],
      body: BODIES[(h * 11) % BODIES.length], height: HEIGHTS[(h * 5) % HEIGHTS.length], face: FACES[(h * 3) % FACES.length]
    };
    if (variant) p.variant = variant;
    return p;
  }
  var BENCH_NAMES = [
    ['Seno', 'Yanu', 'Gino', 'Heru', 'Oki'],
    ['Entis', 'Jajang', 'Opik', 'Deden', 'Maman'],
    ['Karyo', 'Sarmin', 'Untung', 'Wiryo', 'Mujib'],
    ['Poltak', 'Jefri', 'Anton', 'Ramli', 'Togar'],
    ['Sholeh', 'Karim', 'Faiz', 'Nanang', 'Huda'],
    ['Giman', 'Pras', 'Nopal', 'Agil', 'Samsul'],
    [['Buto Terong', 'buto'], ['Ular Blorong', 'ular'], ['Celeng Ireng', 'babi'], ['Tuyul Usil', 'tuyul'], ['Wedhon Tua', 'genderuwo']],
    [['Kunti Merah', 'kuntilanak'], ['Pocong Mumun', 'pocong'], ['Jin Botol', 'jin'], ['Sundel Malam', 'sundel'], ['Wewe Kecil', 'wewe']],
    [['Macan Tutul', 'harimau'], ['Monyet Usil', 'monyet'], ['Kerbau Bule', 'kerbau'], ['Kucing Liar', 'kucing'], ['Anjing Hutan', 'anjing']],
    [['Unit-12', 'tempur'], ['Unit-13', 'kotak'], ['Unit-14', 'kurir'], ['Unit-15', 'bulat'], ['Unit-16', 'tempur']],
    ['Derrickman', 'Welder Asep', 'Kapten Laut', 'Koki Rig', 'Mekanik Oji'],
    [['Bu Caleg', 'batik'], ['Buzzer', 'rompi'], ['Pak Ranting', 'safari'], ['Tim Survei', 'rompi'], ['Simpatisan', 'batik']]
  ];
  D.TEAMS.forEach(function (t, ti) {
    var names = BENCH_NAMES[ti];
    if (!names || t.players.length > 11) return;
    names.forEach(function (nm, k) {
      var name = Array.isArray(nm) ? nm[0] : nm, variant = Array.isArray(nm) ? nm[1] : '';
      t.players.push(benchPlayer(name, k, ti, variant));
    });
  });

  /* ---------------- tim bintang tamu (tokoh rekaan): bintang dunia yang sedang liburan lalu iseng ikut tarkam ---------------- */
  function P(name, num, role, shot, foot, skin, hair, hairC, head, body, height, face) {
    return { name: name, num: num, role: role, shot: shot, style: 'elang', foot: foot, skin: skin, hair: hair, hairC: hairC, head: head, body: body, height: height, face: face || 'polos' };
  }
  D.STAR_TEAM = {
    name: 'Bintang Liburan', short: 'BLN', c1: '#00a6c8', c2: '#ffe14d', gk: '#ff5d8f', outfit: 'jersey', pattern: 'selempang', bottom: 'pendek', tactic: 'serang', level: 2, kind: 'manusia', star: 1,
    desc: 'Bintang-bintang dunia rekaan yang sedang liburan di kampung, lalu iseng ikut tarkam.',
    players: [
      (function () { var g = P('Otto Brandt', 1, 'GK', 'naga', 'sepatu', 0, 'cepak', 2, 'none', 'gempal', 'tinggi', 'brewok'); g.style = 'karang'; return g; })(),
      P('Kofi Mensa', 4, 'DF', 'banteng', 'sepatu', 5, 'botak', 0, 'none', 'gempal', 'tinggi'),
      P('Nilo Costa', 8, 'MF', 'keris', 'sepatu', 2, 'keriting', 0, 'none', 'kurus', 'pendek'),
      P('Yuto Arai', 7, 'MF', 'beliung', 'sepatu', 1, 'belah', 0, 'ikat', 'kurus', 'sedang'),
      P('Rafa Duarte', 9, 'FW', 'meteor', 'sepatu', 3, 'mohawk', 2, 'none', 'sedang', 'tinggi'),
      P('Luca Ferri', 2, 'DF', 'tinju', 'sepatu', 1, 'gondrong', 1, 'bandana', 'sedang', 'tinggi', 'brewok'),
      P('Sekou Kone', 6, 'MF', 'macan', 'sepatu', 5, 'kuncir', 0, 'none', 'sedang', 'sedang'),
      P('Dag Solberg', 3, 'DF', 'banteng', 'sepatu', 0, 'cepak', 2, 'none', 'gempal', 'tinggi'),
      P('Tomas Rey', 5, 'DF', 'tinju', 'sepatu', 2, 'belah', 1, 'none', 'sedang', 'sedang', 'kumis'),
      P('Emre Kaya', 10, 'MF', 'garuda', 'sepatu', 2, 'gondrong', 0, 'none', 'kurus', 'sedang', 'jenggot'),
      P('Jonas Vik', 11, 'FW', 'naga', 'sepatu', 0, 'cepak', 2, 'none', 'sedang', 'tinggi'),
      P('Zed Okoro', 12, 'FW', 'macan', 'nyeker', 4, 'keriting', 2, 'none', 'kurus', 'sedang'),
      P('Mateo Luz', 13, 'MF', 'keris', 'sepatu', 3, 'kuncir', 0, 'topi', 'kurus', 'pendek'),
      P('Idris Bello', 14, 'DF', 'banteng', 'sepatu', 5, 'cepak', 0, 'none', 'gempal', 'tinggi'),
      P('Kenji Mori', 15, 'MF', 'beliung', 'sepatu', 1, 'mohawk', 3, 'none', 'sedang', 'sedang', 'kacamata'),
      P('Paulo Viera', 16, 'FW', 'garuda', 'sandal', 3, 'gondrong', 1, 'bandana', 'sedang', 'tinggi')
    ]
  };
  D.TEAMS.push(D.STAR_TEAM);

  /* ---------------- formasi ---------------- */
  /* baris: [peran, jumlah, fx (jarak dari gawang sendiri 0..1)] */
  D.FORMS = {
    5: [
      { id: '2-2', rows: [['DF', 2, 0.24], ['FW', 2, 0.62]] },
      { id: '1-2-1', rows: [['DF', 1, 0.2], ['MF', 2, 0.42], ['FW', 1, 0.66]] },
      { id: '2-1-1', rows: [['DF', 2, 0.22], ['MF', 1, 0.44], ['FW', 1, 0.66]] },
      { id: '1-1-2', rows: [['DF', 1, 0.2], ['MF', 1, 0.4], ['FW', 2, 0.64]] },
      { id: '3-1', rows: [['DF', 3, 0.22], ['FW', 1, 0.62]] },
      { id: '1-3', rows: [['DF', 1, 0.2], ['FW', 3, 0.58]] }
    ],
    7: [
      { id: '2-3-1', rows: [['DF', 2, 0.2], ['MF', 3, 0.42], ['FW', 1, 0.66]] },
      { id: '3-2-1', rows: [['DF', 3, 0.2], ['MF', 2, 0.42], ['FW', 1, 0.66]] },
      { id: '2-2-2', rows: [['DF', 2, 0.2], ['MF', 2, 0.42], ['FW', 2, 0.64]] },
      { id: '3-1-2', rows: [['DF', 3, 0.2], ['MF', 1, 0.4], ['FW', 2, 0.64]] },
      { id: '1-3-2', rows: [['DF', 1, 0.18], ['MF', 3, 0.4], ['FW', 2, 0.64]] },
      { id: '2-1-3', rows: [['DF', 2, 0.2], ['MF', 1, 0.4], ['FW', 3, 0.62]] }
    ],
    11: [
      { id: '4-4-2', rows: [['DF', 4, 0.19], ['MF', 4, 0.42], ['FW', 2, 0.64]] },
      { id: '4-3-3', rows: [['DF', 4, 0.19], ['MF', 3, 0.4], ['FW', 3, 0.63]] },
      { id: '4-2-3-1', rows: [['DF', 4, 0.19], ['MF', 2, 0.34], ['MF', 3, 0.5], ['FW', 1, 0.66]] },
      { id: '3-5-2', rows: [['DF', 3, 0.19], ['MF', 5, 0.42], ['FW', 2, 0.64]] },
      { id: '5-3-2', rows: [['DF', 5, 0.19], ['MF', 3, 0.42], ['FW', 2, 0.64]] },
      { id: '4-5-1', rows: [['DF', 4, 0.19], ['MF', 5, 0.42], ['FW', 1, 0.65]] },
      { id: '3-4-3', rows: [['DF', 3, 0.19], ['MF', 4, 0.42], ['FW', 3, 0.63]] },
      { id: '5-4-1', rows: [['DF', 5, 0.18], ['MF', 4, 0.4], ['FW', 1, 0.64]] }
    ]
  };
  D.formsOf = function (n) { return D.FORMS[n] || []; };
  D.formById = function (n, id) { var l = D.formsOf(n); for (var i = 0; i < l.length; i++) if (l[i].id === id) return l[i]; return null; };
  var SPREAD = { 1: [0], 2: [-0.22, 0.22], 3: [-0.3, 0, 0.3], 4: [-0.36, -0.12, 0.12, 0.36], 5: [-0.4, -0.2, 0, 0.2, 0.4] };
  /* slot posisi untuk n pemain: [{fx, fz, role}]. formId kosong/tak dikenal = otomatis dari peran pemain */
  D.formSlots = function (n, formId, players) {
    var f = formId ? D.formById(n, formId) : null;
    if (!f) {
      var auto = D.formation((players || []).slice(0, n));
      return auto.map(function (s, i) { return { fx: s.fx, fz: s.fz, role: i === 0 ? 'GK' : ((players[i] && players[i].role) || 'MF') }; });
    }
    var slots = [{ fx: 0.02, fz: 0, role: 'GK' }];
    f.rows.forEach(function (r) {
      var sp = SPREAD[r[1]] || SPREAD[1];
      sp.forEach(function (fz, k) {
        var wide = r[1] >= 4 && (k === 0 || k === r[1] - 1) ? 0.035 : 0;
        slots.push({ fx: r[2] + wide, fz: fz, role: r[0] });
      });
    });
    while (slots.length < n) slots.push({ fx: 0.4, fz: 0, role: 'MF' });
    return slots.slice(0, n);
  };
  /* formasi yang paling cocok dengan peran pemain (untuk tombol "otomatis" di layar strategi) */
  D.formGuess = function (n, players) {
    var c = { DF: 0, MF: 0, FW: 0 };
    (players || []).slice(1, n).forEach(function (p) { c[p.role === 'DF' || p.role === 'FW' ? p.role : 'MF']++; });
    var best = null, bs = 1e9;
    D.formsOf(n).forEach(function (f) {
      var d = { DF: 0, MF: 0, FW: 0 };
      f.rows.forEach(function (r) { d[r[0]] += r[1]; });
      var s = Math.abs(d.DF - c.DF) + Math.abs(d.MF - c.MF) + Math.abs(d.FW - c.FW);
      if (s < bs) { bs = s; best = f; }
    });
    return best ? best.id : '';
  };

  /* tim siap tanding untuk ukuran lapangan tertentu: divalidasi, pemain diurutkan sesuai susunan
     (n pertama = pemain inti menurut slot formasi, 5 berikutnya = cadangan), formasi dipasang di .form */
  D.matchTeam = function (team, fieldId) {
    var t = D.sanitizeTeam(team);
    var e = t.setup && t.setup[fieldId];
    if (e) {
      if (e.l && D.validOrder(e.l)) t.players = e.l.map(function (i) { return t.players[i]; });
      if (e.f) t.form = e.f;
    }
    delete t.setup;
    var n = D.squadOf(fieldId);
    if (t.form && !D.formById(n, t.form)) delete t.form;
    if (team && team.star) t.star = 1;
    return t;
  };
  /* susunan yang sedang dipakai tim untuk satu ukuran lapangan (dipakai layar strategi) */
  D.setupOf = function (team, fieldId) {
    var e = (team && team.setup && team.setup[fieldId]) || {};
    var l = D.validOrder(e.l) ? e.l.slice() : [];
    if (!l.length) for (var i = 0; i < D.MAX_SQUAD; i++) l.push(i);
    return { f: e.f || '', l: l };
  };

  /* ---------------- kebugaran pemain ---------------- */
  D.FIT = [{ id: 'bugar', n: 'Bugar', min: 60, c: '#58d68d' }, { id: 'lelah', n: 'Lelah', min: 30, c: '#ffd23f' }, { id: 'lemah', n: 'Lemah', min: 0, c: '#ff7b54' }];
  D.fitOf = function (energy, injured) {
    if (injured) return { id: 'cedera', n: 'Cedera', c: '#ff3d5a' };
    for (var i = 0; i < D.FIT.length; i++) if (energy >= D.FIT[i].min) return D.FIT[i];
    return D.FIT[D.FIT.length - 1];
  };

  /* ---------------- 10 arena baru (semua bisa dipakai di tiga ukuran lapangan) ---------------- */
  var NEW_ARENAS = [
    { id: 'pasarmalam', name: 'Pasar Malam', desc: 'Lapangan di tengah pasar malam: bianglala berputar, lampu warna-warni, tenda jajanan.', surface: 'tanah', fric: 2.9, bounce: 0.52, fence: 'tali', time: 'malam', bunting: 1 },
    { id: 'candi', name: 'Pelataran Candi', desc: 'Pelataran batu di kaki candi purba. Lantai keras, bola memantul kencang.', surface: 'batu', fric: 2.3, bounce: 0.66, fence: 'tembok', time: 'pagi' },
    { id: 'kebunteh', name: 'Kebun Teh', desc: 'Rumput sejuk di lereng kebun teh berundak, gunung berkabut di kejauhan.', surface: 'rumput', fric: 3.3, bounce: 0.54, fence: 'bambu', time: 'pagi' },
    { id: 'dermaga', name: 'Dermaga Nelayan', desc: 'Lantai papan dermaga di atas laut. Perahu nelayan bersandar, bola cepat meluncur.', surface: 'papan', fric: 2.4, bounce: 0.6, fence: 'tali', time: 'senja' },
    { id: 'kawah', name: 'Kawah Geni', desc: 'Lapangan abu vulkanik di bibir kawah. Lava menyala, asap mengepul.', surface: 'abu', fric: 3.4, bounce: 0.48, fence: 'besi', time: 'senja' },
    { id: 'atap', name: 'Atap Kota', desc: 'Lapangan futsal di atap gedung, dikelilingi gedung pencakar langit dan papan reklame.', surface: 'karet', fric: 2.5, bounce: 0.62, fence: 'jaring', time: 'malam' },
    { id: 'bambu', name: 'Hutan Bambu', desc: 'Tanah lapang di tengah rumpun bambu tinggi yang bergoyang ditiup angin.', surface: 'tanah', fric: 3.0, bounce: 0.5, fence: 'bambu', time: 'siang', windBias: 0.8 },
    { id: 'gor', name: 'GOR Futsal', desc: 'Gedung olahraga dalam ruangan: lantai vinil mengilap, tribun, lampu terang. Tanpa angin.', surface: 'vinil', fric: 2.2, bounce: 0.64, fence: 'jaring', time: 'siang', indoor: 1, stands: 1 },
    { id: 'anjungan', name: 'Anjungan Lepas Pantai', desc: 'Geladak baja anjungan migas di tengah laut. Angin kencang, menara bor dan suar menyala.', surface: 'baja', fric: 2.3, bounce: 0.66, fence: 'besi', time: 'sore', windBias: 1.9 },
    { id: 'gbk', name: 'Stadion Utama', desc: 'Stadion raksasa bertingkat dua dengan atap melingkar, layar raksasa, dan lautan penonton.', surface: 'stadion', fric: 2.9, bounce: 0.6, fence: 'besi', time: 'malam', stands: 1, standGap: 7 }
  ];
  NEW_ARENAS.forEach(function (a) { if (!D.arenaById[a.id]) { D.ARENAS.push(a); D.arenaById[a.id] = a; } });
  if (D.arenaById.stadion) D.arenaById.stadion.stands = 1;
  ['kampung', 'rel', 'sawah', 'sekolah', 'alun'].forEach(function (id) { if (D.arenaById[id]) D.arenaById[id].bunting = 1; });

  void U;
})(typeof window !== 'undefined' ? window : globalThis);
