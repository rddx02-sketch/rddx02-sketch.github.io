/* Bola Api Arena — data permainan: lapangan, tendangan, jurus kiper, arena, cuaca, bola, tim */
(function (root) {
  'use strict';
  var BA = root.BA = root.BA || {};
  var U = BA.U;
  var D = BA.D = {};

  /* ---------------- ukuran lapangan & jumlah pemain ---------------- */
  D.FIELDS = [
    { id: 'kampung', name: 'Lapangan Kampung', short: '5 vs 5', n: 5, desc: 'Lapangan kecil 44×26 m, 5 lawan 5. Cepat, rapat, penuh benturan.',
      L: 44, W: 26, goalW: 5.2, goalH: 2.2, goalD: 1.6, boxL: 6.5, boxW: 13, sixL: 0, sixW: 0, pen: 7.5, circle: 4, arc: 0, shot: 25 },
    { id: 'desa', name: 'Lapangan Desa', short: '7 vs 7', n: 7, desc: 'Lapangan 68×44 m, 7 lawan 7. Ruang lebih lega untuk umpan panjang.',
      L: 68, W: 44, goalW: 6.4, goalH: 2.3, goalD: 1.9, boxL: 11, boxW: 26, sixL: 3.6, sixW: 12, pen: 9, circle: 6.5, arc: 6.5, shot: 28 },
    { id: 'asli', name: 'Ukuran Asli', short: '11 vs 11', n: 11, desc: 'Lapangan resmi 105×68 m, 11 lawan 11, gawang 7,32×2,44 m seperti sepak bola sungguhan.',
      L: 105, W: 68, goalW: 7.32, goalH: 2.44, goalD: 2.2, boxL: 16.5, boxW: 40.3, sixL: 5.5, sixW: 18.32, pen: 11, circle: 9.15, arc: 9.15, shot: 32 }
  ];
  D.fieldById = {};
  D.FIELDS.forEach(function (f) { D.fieldById[f.id] = f; });
  D.FIELD = { ballR: 0.13 };
  /* zona gawang (tinggi & jarak samping) mengikuti ukuran gawang */
  D.ZONE_Y = [1.72, 1.08, 0.38];
  D.ZONE_DZ = 1.78;
  D.useField = function (id) {
    var f = D.fieldById[id] || D.FIELDS[0];
    Object.keys(f).forEach(function (k) { if (k !== 'name' && k !== 'desc' && k !== 'short') D.FIELD[k] = f[k]; });
    D.FIELD.id = f.id; D.FIELD.ballR = 0.13;
    D.FIELD.fs = f.L / 44;                       // skala jarak terhadap lapangan kampung
    D.FIELD.ss = Math.sqrt(D.FIELD.fs);          // skala lunak (radius AI, kecepatan)
    var gy = f.goalH / 2.2, gz = f.goalW / 5.2;
    D.ZONE_Y[0] = 1.72 * gy; D.ZONE_Y[1] = 1.08 * gy; D.ZONE_Y[2] = 0.38 * gy;
    D.ZONE_DZ = 1.78 * gz;
    return D.FIELD;
  };
  D.useField('kampung');
  D.squadOf = function (fieldId) { return (D.fieldById[fieldId] || D.FIELDS[0]).n; };

  /* 9 arah gawang dari sudut pandang penendang (kiri/kanan = kiri/kanan penendang) */
  D.ZONES = [
    { id: 'TL', c: -1, r: 0, name: 'Kiri Atas' }, { id: 'TC', c: 0, r: 0, name: 'Tengah Atas' }, { id: 'TR', c: 1, r: 0, name: 'Kanan Atas' },
    { id: 'ML', c: -1, r: 1, name: 'Kiri' }, { id: 'C', c: 0, r: 1, name: 'Tengah' }, { id: 'MR', c: 1, r: 1, name: 'Kanan' },
    { id: 'BL', c: -1, r: 2, name: 'Kiri Bawah' }, { id: 'BC', c: 0, r: 2, name: 'Tengah Bawah' }, { id: 'BR', c: 1, r: 2, name: 'Kanan Bawah' }
  ];
  D.zoneOf = function (c, r) {
    c = U.clamp(Math.round(U.num(c, 0)), -1, 1); r = U.clamp(Math.round(U.num(r, 1)), 0, 2);
    return D.ZONES[r * 3 + c + 1];
  };
  D.zoneById = {};
  D.ZONES.forEach(function (z) { D.zoneById[z.id] = z; });

  /* ---------------- tipe tendangan striker ---------------- */
  D.SHOTS = [
    { id: 'naga', name: 'Naga Geni', desc: 'Api menjelma naga meliuk. Kuat ke semua arah dan menembus jurus kiper.', fire: ['#ff4d1a', '#ffb02e'], all: 1.15, pierce: 0.08 },
    { id: 'macan', name: 'Macan Kumbang', desc: 'Api menjadi macan menerkam. Paling ganas ke sisi kiri dan kanan.', fire: ['#ff7a00', '#ffd166'], side: 1.22, mid: 1.0 },
    { id: 'garuda', name: 'Garuda Mega', desc: 'Api mengembang jadi sayap garuda. Paling ganas ke arah atas.', fire: ['#ffb703', '#fff3b0'], row: [1.24, 1.06, 0.94] },
    { id: 'banteng', name: 'Banteng Amuk', desc: 'Api menyeruduk seperti banteng. Paling ganas ke arah bawah.', fire: ['#e63946', '#ff9f1c'], row: [0.9, 1.08, 1.27] },
    { id: 'keris', name: 'Keris Lintang', desc: 'Api memipih jadi keris berputar. Sangat cepat, kiper telat bereaksi.', fire: ['#19c8ff', '#e0fbff'], all: 1.08, react: 0.86 },
    { id: 'meteor', name: 'Meteor Kampung', desc: 'Api naik lalu jatuh seperti meteor. Mematikan ke tengah atas.', fire: ['#ff5400', '#ffbd00'], zone: { TC: 1.32, TL: 1.15, TR: 1.15 }, other: 0.96 },
    { id: 'beliung', name: 'Beliung Api', desc: 'Api berputar jadi puting beliung. Bila ditepis, bola liar condong ke kawan.', fire: ['#ff6d00', '#ff2e88'], all: 1.1, rebound: true },
    { id: 'tinju', name: 'Tinju Geni', desc: 'Api mengepal jadi tinju raksasa. Brutal di jalur tengah, tapi agak lambat.', fire: ['#ff2e00', '#ffb347'], mid: 1.32, side: 1.05, react: 1.06 }
  ];
  D.shotById = {};
  D.SHOTS.forEach(function (s) { D.shotById[s.id] = s; });
  D.shotMult = function (shot, zoneId) {
    var z = D.zoneById[zoneId] || D.zoneById.C;
    if (!shot) return 1;
    if (shot.all) return shot.all;
    if (shot.row) return shot.row[z.r];
    if (shot.zone) return shot.zone[zoneId] || shot.other || 1;
    if (shot.side || shot.mid) return z.c === 0 ? (shot.mid || 1) : (shot.side || 1);
    return 1;
  };
  /* arah terbaik untuk tiap tipe (dipakai AI) */
  D.shotBestZones = function (shot) {
    var out = [];
    D.ZONES.forEach(function (z) { out.push({ id: z.id, m: D.shotMult(shot, z.id) }); });
    out.sort(function (a, b) { return b.m - a.m; });
    return out;
  };

  /* ---------------- jurus silat kiper ---------------- */
  D.SKILLS = {
    tapak: { id: 'tapak', name: 'Tapak Wesi', mult: 1.33, fx: 'palm', col: '#ffd166', desc: 'Telapak besi raksasa mendorong bola.' },
    cakar: { id: 'cakar', name: 'Cakar Elang', mult: 1.30, fx: 'claw', col: '#fff1c1', desc: 'Cakaran tenaga dalam merobek api.' },
    tameng: { id: 'tameng', name: 'Tameng Gaib', mult: 1.38, fx: 'dome', col: '#ffcf3f', desc: 'Kubah gaib keemasan menutup gawang.' },
    karang: { id: 'karang', name: 'Benteng Karang', mult: 1.36, fx: 'wall', col: '#c9a27e', desc: 'Dinding batu menjulang dari tanah.' },
    banyu: { id: 'banyu', name: 'Tirai Banyu', mult: 1.35, fx: 'water', col: '#4cc9f0', desc: 'Tirai air memadamkan api.' },
    selendang: { id: 'selendang', name: 'Selendang Sakti', mult: 1.29, fx: 'scarf', col: '#ff4fa3', desc: 'Selendang sakti membelit bola.' },
    bayu: { id: 'bayu', name: 'Pusaran Bayu', mult: 1.31, fx: 'vortex', col: '#bdf7ff', desc: 'Pusaran angin membelokkan bola.' },
    seribu: { id: 'seribu', name: 'Seribu Tangan', mult: 1.34, fx: 'hands', col: '#7cc6ff', desc: 'Tangan-tangan bayangan menangkap dari segala arah.' },
    rajawali: { id: 'rajawali', name: 'Sayap Rajawali', mult: 1.32, fx: 'wings', col: '#fff6d6', desc: 'Sayap cahaya mengepak menahan bola.' },
    bumi: { id: 'bumi', name: 'Kuda-kuda Bumi', mult: 1.33, fx: 'quake', col: '#ffb86b', desc: 'Hentakan kaki mengguncang tanah.' }
  };
  D.STYLES = [
    { id: 'elang', name: 'Perguruan Elang Putih', desc: 'Kuat menjaga sisi atas.', map: { TL: 'cakar', TC: 'rajawali', TR: 'seribu', ML: 'tapak', MR: 'selendang' } },
    { id: 'macan', name: 'Perguruan Macan Loreng', desc: 'Kuat menjaga sisi kiri dan kanan.', map: { TL: 'tapak', TR: 'cakar', ML: 'seribu', MR: 'bayu', BR: 'karang' } },
    { id: 'naga', name: 'Perguruan Naga Bumi', desc: 'Kuat menjaga bawah dan tengah.', map: { BL: 'karang', BC: 'bumi', BR: 'banyu', C: 'tameng', MR: 'bayu' } },
    { id: 'karang', name: 'Perguruan Batu Karang', desc: 'Tembok di jalur tengah, lemah di pojok.', map: { C: 'tameng', TC: 'tapak', BC: 'karang', ML: 'banyu', MR: 'seribu' } },
    { id: 'angin', name: 'Perguruan Angin Selatan', desc: 'Menjaga empat pojok gawang.', map: { TL: 'bayu', TR: 'rajawali', BL: 'selendang', BR: 'banyu', C: 'bumi' } },
    { id: 'harimau', name: 'Perguruan Harimau Gunung', desc: 'Campuran atas dan bawah.', map: { TL: 'seribu', TR: 'tapak', BL: 'bumi', BR: 'cakar', TC: 'tameng' } }
  ];
  D.styleById = {};
  D.STYLES.forEach(function (s) { D.styleById[s.id] = s; });

  /* ---------------- arena ---------------- */
  D.ARENAS = [
    { id: 'kampung', name: 'Lapangan Kampung', desc: 'Rumput belang di tengah rumah warga, umbul-umbul berkibar.', surface: 'rumput', fric: 3.2, bounce: 0.55, fence: 'bambu', time: 'sore' },
    { id: 'sawah', name: 'Sawah Kering', desc: 'Sawah selepas panen. Tanah retak, bola agak tersendat.', surface: 'sawah', fric: 3.9, bounce: 0.45, fence: 'tali', time: 'sore' },
    { id: 'pantai', name: 'Pantai Senja', desc: 'Pasir berat, bola cepat melambat. Ombak di belakang gawang.', surface: 'pasir', fric: 5.2, bounce: 0.32, fence: 'tali', time: 'senja' },
    { id: 'alun', name: 'Alun-alun Kota', desc: 'Lapangan luas di bawah beringin, gerobak jajanan berjajar.', surface: 'rumput', fric: 3.0, bounce: 0.58, fence: 'besi', time: 'sore' },
    { id: 'tol', name: 'Kolong Tol', desc: 'Lantai semen di bawah jalan tol. Bola memantul liar, gaya jalanan asli.', surface: 'semen', fric: 2.1, bounce: 0.68, fence: 'tembok', time: 'sore' },
    { id: 'bukit', name: 'Bukit Tanah Merah', desc: 'Tanah liat merah di puncak bukit. Angin sering bertiup.', surface: 'tanahmerah', fric: 2.8, bounce: 0.5, fence: 'bambu', time: 'siang', windBias: 1.6 },
    { id: 'sekolah', name: 'Halaman Sekolah', desc: 'Lapangan upacara beraspal, tiang bendera di pinggir.', surface: 'aspal', fric: 2.2, bounce: 0.64, fence: 'jaring', time: 'siang' },
    { id: 'rel', name: 'Pinggir Rel', desc: 'Lapangan tanah di samping rel. Kereta lewat, penonton melambai.', surface: 'tanah', fric: 2.8, bounce: 0.5, fence: 'bambu', time: 'sore' },
    { id: 'stadion', name: 'Stadion Kabupaten', desc: 'Stadion sungguhan: tribun beton mengelilingi lapangan, lampu sorot menara, papan skor. Rumput rapi, bola lancar.', surface: 'stadion', fric: 2.9, bounce: 0.6, fence: 'besi', time: 'malam' }
  ];
  D.arenaById = {};
  D.ARENAS.forEach(function (a) { D.arenaById[a.id] = a; });

  /* ---------------- cuaca ---------------- */
  D.WEATHERS = [
    { id: 'cerah', name: 'Cerah Sore', desc: 'Cahaya keemasan, kondisi normal.' },
    { id: 'malam', name: 'Malam Obor', desc: 'Lampu petromak dan obor. Api makin menyala, tendangan +5%.', shot: 1.05, night: 1 },
    { id: 'hujan', name: 'Hujan Deras', desc: 'Bola berat dan licin. Tendangan −8%, tangkapan biasa −12%.', shot: 0.92, keepNormal: 0.88, fric: 1.3, bounceMul: 0.8, rain: 1, dark: 0.55 },
    { id: 'angin', name: 'Angin Kencang', desc: 'Bola di udara terbawa angin. Umpan lambung jadi liar.', wind: 4.2 },
    { id: 'kabut', name: 'Kabut Pagi', desc: 'Jarak pandang pendek. Refleks kiper −7%.', keep: 0.93, fog: 0.05 },
    { id: 'kemarau', name: 'Kemarau Berdebu', desc: 'Terik dan berdebu. Stamina cepat habis, bola memantul tinggi.', stam: 1.45, bounceMul: 1.15, dust: 1 },
    { id: 'gerimis', name: 'Gerimis Senja', desc: 'Gerimis tipis, langit jingga keunguan. Sedikit licin.', shot: 0.97, keepNormal: 0.95, fric: 1.1, rain: 0.35, dusk: 1 },
    { id: 'badai', name: 'Badai Petir', desc: 'Hujan dan petir. Petir bisa menyambar bola jadi Bola Petir (+25%).', shot: 0.95, keepNormal: 0.9, fric: 1.25, rain: 1, dark: 0.75, lightning: 1 }
  ];
  D.weatherById = {};
  D.WEATHERS.forEach(function (w) { D.weatherById[w.id] = w; });

  /* ---------------- jenis bola ---------------- */
  D.BALLS = [
    { id: 'merah', name: 'Bola Api Merah', desc: 'Bola standar. Seimbang di semua hal.', fire: ['#ff4d1a', '#ffcc33'] },
    { id: 'biru', name: 'Bola Api Biru', desc: 'Api lebih panas: tendangan +10%, tapi lebih liar saat digiring.', pow: 1.1, ctrl: 0.85, fire: ['#2f7bff', '#bfe3ff'] },
    { id: 'hijau', name: 'Bola Api Hijau', desc: 'Ringan dan melengkung. Umpan lebih cepat.', pow: 0.98, spd: 1.12, wind: 1.4, fire: ['#22c55e', '#d6ffb8'] },
    { id: 'plastik', name: 'Bola Plastik Api', desc: 'Bola plastik kampung: ringan, memantul tinggi, mudah terbawa angin. Tendangan −8%.', pow: 0.92, spd: 1.08, bounce: 1.3, wind: 2.2, fire: ['#ff8c1a', '#fff09a'] },
    { id: 'takraw', name: 'Bola Rotan Api', desc: 'Bola rotan takraw. Pantulannya susah ditebak.', pow: 0.96, bounce: 1.2, erratic: 1, fire: ['#ff6a00', '#ffe08a'] },
    { id: 'kulit', name: 'Bola Kulit Api', desc: 'Bola kulit lawas yang berat. Tendangan +14%, tapi bola lebih lambat.', pow: 1.14, spd: 0.9, bounce: 0.85, react: 1.06, fire: ['#d9480f', '#ffb066'] },
    { id: 'emas', name: 'Bola Api Emas', desc: 'Bola legenda. Semangat tim terisi 50% lebih cepat.', pow: 1.05, spirit: 1.5, fire: ['#ffb700', '#fff2a8'] }
  ];
  D.ballById = {};
  D.BALLS.forEach(function (b) { D.ballById[b.id] = b; });
  D.bv = function (b, key, def) { return (b && typeof b[key] === 'number') ? b[key] : (def === undefined ? 1 : def); };
  D.wv = D.bv;

  /* ---------------- aturan ---------------- */
  D.DURATIONS = [{ v: 120, n: '2 menit' }, { v: 240, n: '4 menit' }, { v: 360, n: '6 menit' }];
  D.TIES = [{ id: 'penalti', n: 'Adu Penalti Api' }, { id: 'emas', n: 'Gol Emas' }, { id: 'seri', n: 'Hasil Seri' }];
  D.BOUNDS = [{ id: 'pantul', n: 'Pagar Pantul', desc: 'Bola memantul di pagar, permainan tidak berhenti.' }, { id: 'keluar', n: 'Bola Keluar', desc: 'Ada lemparan ke dalam, tendangan gawang, dan sepak pojok.' }];
  D.DIFFS = [{ id: 0, n: 'Mudah' }, { id: 1, n: 'Sedang' }, { id: 2, n: 'Sulit' }];
  D.RULESETS = [
    { id: 'tarkam', n: 'Tarkam', desc: 'Aturan kampung: pagar pantul atau bola keluar, 3 pojok = penalti, bola panas. Tanpa offside.' },
    { id: 'pro', n: 'Liga Pro', desc: 'Aturan sepak bola resmi: offside, pelanggaran = tendangan bebas, pelanggaran di kotak = penalti, kartu kuning/merah, lemparan ke dalam, sepak pojok, tendangan gawang. Paling pas di lapangan Ukuran Asli 11 vs 11 dengan Stadion.' }
  ];
  D.defaultRules = function () { return { dur: 240, tie: 'penalti', bound: 'pantul', tigaPojok: true, bolaPanas: true, diff: 1, pro: false }; };
  /* aturan resmi memaksa bola keluar & mematikan aturan kampung */
  D.applyRuleset = function (r) { if (r && r.pro) { r.bound = 'keluar'; r.tigaPojok = false; r.bolaPanas = false; } return r; };

  /* ---------------- penampilan ---------------- */
  D.SKINS = ['#f3cfae', '#e3b07c', '#c98c55', '#a8693a', '#8a5129', '#5e381c'];
  D.HAIRS = [{ id: 'botak', n: 'Botak' }, { id: 'cepak', n: 'Cepak' }, { id: 'belah', n: 'Belah Pinggir' }, { id: 'gondrong', n: 'Gondrong' }, { id: 'mohawk', n: 'Mohawk' }, { id: 'keriting', n: 'Keriting' }, { id: 'kuncir', n: 'Kuncir' }];
  D.HAIR_COLORS = [{ c: '#1b1410', n: 'Hitam' }, { c: '#4a2c1a', n: 'Coklat' }, { c: '#d9a441', n: 'Pirang Semir' }, { c: '#b23a1e', n: 'Merah Semir' }, { c: '#9a9a9a', n: 'Uban' }];
  D.HEADS = [{ id: 'none', n: 'Tanpa' }, { id: 'ikat', n: 'Ikat Kepala' }, { id: 'topi', n: 'Topi Terbalik' }, { id: 'bandana', n: 'Bandana' }, { id: 'caping', n: 'Caping' }, { id: 'kupluk', n: 'Kupluk' }];
  D.FEET = [
    { id: 'sepatu', n: 'Sepatu Bola', desc: 'Tendangan +6%, kontrol stabil.' },
    { id: 'nyeker', n: 'Nyeker', desc: 'Bertelanjang kaki: lari +5%, gocek lebih lincah.' },
    { id: 'sandal', n: 'Sandal Jepit', desc: 'Gaya santai. Sandal kadang terbang saat menendang keras!' }
  ];
  D.BODIES = [{ id: 'kurus', n: 'Kurus' }, { id: 'sedang', n: 'Sedang' }, { id: 'gempal', n: 'Gempal' }];
  D.FACES = [{ id: 'polos', n: 'Polos' }, { id: 'kumis', n: 'Kumis' }, { id: 'brewok', n: 'Brewok' }, { id: 'jenggot', n: 'Jenggot' }, { id: 'kacamata', n: 'Kacamata' }];
  D.HEIGHTS = [{ id: 'pendek', n: 'Pendek' }, { id: 'sedang', n: 'Sedang' }, { id: 'tinggi', n: 'Tinggi' }];
  D.ROLES = [{ id: 'GK', n: 'Kiper' }, { id: 'DF', n: 'Bek' }, { id: 'MF', n: 'Gelandang' }, { id: 'FW', n: 'Penyerang' }];
  D.OUTFITS = [{ id: 'jersey', n: 'Jersey Bola' }, { id: 'kaos', n: 'Kaos Seragam' }, { id: 'singlet', n: 'Kaos Singlet' }];
  D.PATTERNS = [{ id: 'polos', n: 'Polos' }, { id: 'tegak', n: 'Garis Tegak' }, { id: 'datar', n: 'Garis Datar' }, { id: 'belah', n: 'Belah Dua' }, { id: 'selempang', n: 'Selempang' }];
  D.BOTTOMS = [{ id: 'pendek', n: 'Celana Pendek' }, { id: 'sarung', n: 'Sarung' }, { id: 'training', n: 'Celana Training' }];
  D.TACTICS = [{ id: 'seimbang', n: 'Seimbang', desc: 'Menyerang dan bertahan sama rata.' }, { id: 'serang', n: 'Serang Total', desc: 'Semua maju, lini belakang tipis.' }, { id: 'bertahan', n: 'Gerendel', desc: 'Rapat di belakang, menunggu serangan balik.' }];
  /* jenis anggota tim: menentukan wujud, kostum khas, dan suara */
  D.KINDS = [
    { id: 'manusia', n: 'Warga Kampung', desc: 'Manusia biasa: jersey, kaos, atau singlet.', variants: [] },
    { id: 'siluman', n: 'Siluman', desc: 'Makhluk jadi-jadian beda jenis: genderuwo, buto ijo, siluman ular, babi, dan tuyul.',
      variants: [{ id: 'genderuwo', n: 'Genderuwo' }, { id: 'buto', n: 'Buto Ijo' }, { id: 'ular', n: 'Siluman Ular' }, { id: 'babi', n: 'Siluman Babi' }, { id: 'tuyul', n: 'Tuyul' }] },
    { id: 'hantu', n: 'Hantu', desc: 'Arwah penasaran: kuntilanak, pocong, sundel bolong, wewe gombel, dan jin.',
      variants: [{ id: 'kuntilanak', n: 'Kuntilanak' }, { id: 'pocong', n: 'Pocong' }, { id: 'sundel', n: 'Sundel Bolong' }, { id: 'wewe', n: 'Wewe Gombel' }, { id: 'jin', n: 'Jin Api' }] },
    { id: 'mamalia', n: 'Binatang Mamalia', desc: 'Satwa berbulu: harimau, monyet, kerbau, beruang, kucing, anjing.',
      variants: [{ id: 'harimau', n: 'Harimau' }, { id: 'monyet', n: 'Monyet' }, { id: 'kerbau', n: 'Kerbau' }, { id: 'beruang', n: 'Beruang' }, { id: 'kucing', n: 'Kucing' }, { id: 'anjing', n: 'Anjing' }] },
    { id: 'robot', n: 'Robot Mekanik', desc: 'Mesin berlapis baja dengan visor menyala dan sendi hidrolik.',
      variants: [{ id: 'kotak', n: 'Tipe Kotak' }, { id: 'bulat', n: 'Tipe Bulat' }, { id: 'tempur', n: 'Tipe Tempur' }, { id: 'kurir', n: 'Tipe Kurir' }] },
    { id: 'migas', n: 'Pekerja Migas', desc: 'Kru lapangan oil & gas bercoverall reflektif; pilih helm proyek atau APD khusus.', variants: [] },
    { id: 'partai', n: 'Orang Partai', desc: 'Kader partai berbaju safari, batik, atau rompi nomor urut, lengkap dengan peci.',
      variants: [{ id: 'safari', n: 'Safari' }, { id: 'batik', n: 'Batik' }, { id: 'rompi', n: 'Rompi Kader' }] }
  ];
  D.kindById = {}; D.KINDS.forEach(function (k) { D.kindById[k.id] = k; });
  D.PPE = [{ id: 'helm', n: 'Helm proyek' }, { id: 'helm_kacamata', n: 'Helm + kacamata safety' }, { id: 'kacamata', n: 'Kacamata safety' }, { id: 'tanpa', n: 'Tanpa helm' }];
  /* varian efektif pemain: id varian valid untuk jenis tim; manusia/migas tidak punya varian */
  D.variantOf = function (team, p, i) {
    var k = D.kindById[(team && team.kind) || 'manusia'] || D.KINDS[0];
    if (!k.variants.length) return '';
    var ids = k.variants.map(function (v) { return v.id; });
    if (p && ids.indexOf(p.variant) >= 0) return p.variant;
    return ids[(U.num(i, 0) | 0) % ids.length];
  };
  D.TEAM_COLORS = ['#d62828', '#f77f00', '#fcbf49', '#2a9d8f', '#1d3557', '#457b9d', '#6a4c93', '#f1faee', '#1b1b1b', '#e63946', '#06d6a0', '#ff5d8f', '#8d6e63', '#3a86ff', '#ffbe0b', '#9ef01a'];

  function P(name, num, role, shot, style, foot, skin, hair, hairC, head, body, height, face) {
    return { name: name, num: num, role: role, shot: shot, style: style, foot: foot, skin: skin, hair: hair, hairC: hairC, head: head, body: body, height: height, face: face || 'polos' };
  }

  D.TEAMS = [
    {
      name: 'Garuda Pos Ronda', short: 'GPR', c1: '#d62828', c2: '#f7f3e8', gk: '#2b2d42', outfit: 'jersey', pattern: 'belah', bottom: 'pendek', tactic: 'seimbang', level: 0,
      players: [P('Pak RT', 1, 'GK', 'naga', 'karang', 'sepatu', 3, 'botak', 0, 'kupluk', 'gempal', 'sedang'),
        P('Wawan', 4, 'DF', 'banteng', 'elang', 'sepatu', 2, 'cepak', 0, 'none', 'gempal', 'tinggi'),
        P('Dimas', 8, 'MF', 'macan', 'elang', 'nyeker', 1, 'belah', 1, 'ikat', 'sedang', 'sedang'),
        P('Tole', 7, 'MF', 'keris', 'elang', 'sandal', 4, 'keriting', 0, 'none', 'kurus', 'pendek'),
        P('Bayu', 9, 'FW', 'naga', 'elang', 'sepatu', 2, 'mohawk', 3, 'none', 'sedang', 'tinggi'),
        P('Jono', 2, 'DF', 'tinju', 'elang', 'sepatu', 3, 'cepak', 0, 'none', 'gempal', 'sedang'),
        P('Pardi', 6, 'MF', 'beliung', 'elang', 'nyeker', 4, 'belah', 0, 'none', 'kurus', 'sedang'),
        P('Kasno', 3, 'DF', 'banteng', 'elang', 'sepatu', 2, 'botak', 0, 'ikat', 'gempal', 'tinggi'),
        P('Supri', 5, 'DF', 'tinju', 'elang', 'sandal', 3, 'keriting', 1, 'none', 'sedang', 'sedang'),
        P('Imam', 10, 'MF', 'garuda', 'elang', 'sepatu', 1, 'kuncir', 0, 'none', 'kurus', 'tinggi'),
        P('Robi', 11, 'FW', 'meteor', 'elang', 'sepatu', 2, 'cepak', 2, 'topi', 'sedang', 'sedang')]
    },
    {
      name: 'Macan Kali Bening', short: 'MKB', c1: '#f77f00', c2: '#1b1b1b', gk: '#3a86ff', outfit: 'kaos', pattern: 'polos', bottom: 'sarung', tactic: 'serang', level: 0,
      players: [P('Mbah Darmo', 1, 'GK', 'naga', 'macan', 'nyeker', 4, 'cepak', 4, 'caping', 'kurus', 'tinggi'),
        P('Udin', 5, 'DF', 'banteng', 'elang', 'nyeker', 3, 'cepak', 0, 'none', 'gempal', 'sedang'),
        P('Asep', 6, 'MF', 'beliung', 'elang', 'sandal', 2, 'gondrong', 0, 'bandana', 'sedang', 'sedang'),
        P('Gilang', 11, 'MF', 'macan', 'elang', 'nyeker', 1, 'kuncir', 1, 'none', 'kurus', 'sedang'),
        P('Ujang', 10, 'FW', 'garuda', 'elang', 'sepatu', 2, 'belah', 2, 'topi', 'sedang', 'tinggi'),
        P('Tarno', 2, 'DF', 'banteng', 'elang', 'nyeker', 4, 'botak', 0, 'none', 'gempal', 'tinggi'),
        P('Ipul', 8, 'MF', 'keris', 'elang', 'sandal', 2, 'mohawk', 0, 'none', 'kurus', 'pendek'),
        P('Dadang', 3, 'DF', 'tinju', 'elang', 'nyeker', 3, 'cepak', 0, 'kupluk', 'gempal', 'sedang'),
        P('Cecep', 4, 'DF', 'banteng', 'elang', 'sepatu', 1, 'belah', 1, 'none', 'sedang', 'tinggi'),
        P('Asri', 7, 'MF', 'naga', 'elang', 'nyeker', 2, 'gondrong', 1, 'ikat', 'kurus', 'sedang'),
        P('Yayan', 9, 'FW', 'meteor', 'elang', 'sepatu', 3, 'keriting', 0, 'none', 'sedang', 'tinggi')]
    },
    {
      name: 'Banteng Sawah', short: 'BSW', c1: '#2a9d8f', c2: '#e9c46a', gk: '#e76f51', outfit: 'jersey', pattern: 'tegak', bottom: 'pendek', tactic: 'bertahan', level: 0,
      players: [P('Kang Didin', 1, 'GK', 'naga', 'naga', 'sepatu', 2, 'cepak', 0, 'none', 'gempal', 'tinggi'),
        P('Sapto', 3, 'DF', 'tinju', 'elang', 'sepatu', 4, 'botak', 0, 'ikat', 'gempal', 'tinggi'),
        P('Eko', 6, 'MF', 'banteng', 'elang', 'nyeker', 3, 'cepak', 1, 'none', 'sedang', 'sedang'),
        P('Rendi', 8, 'MF', 'keris', 'elang', 'sepatu', 1, 'belah', 0, 'none', 'kurus', 'sedang'),
        P('Fajar', 9, 'FW', 'meteor', 'elang', 'sepatu', 2, 'mohawk', 2, 'none', 'sedang', 'tinggi'),
        P('Marno', 2, 'DF', 'banteng', 'elang', 'sepatu', 4, 'cepak', 4, 'caping', 'gempal', 'sedang'),
        P('Totok', 7, 'MF', 'macan', 'elang', 'nyeker', 3, 'belah', 0, 'none', 'sedang', 'pendek'),
        P('Paijo', 4, 'DF', 'tinju', 'elang', 'sandal', 5, 'botak', 0, 'none', 'gempal', 'tinggi'),
        P('Rohim', 5, 'DF', 'banteng', 'elang', 'sepatu', 2, 'kuncir', 1, 'none', 'sedang', 'sedang'),
        P('Gatot', 10, 'MF', 'beliung', 'elang', 'sepatu', 3, 'cepak', 0, 'ikat', 'gempal', 'sedang'),
        P('Bowo', 11, 'FW', 'garuda', 'elang', 'sepatu', 1, 'gondrong', 0, 'none', 'kurus', 'tinggi')]
    },
    {
      name: 'Naga Pasar Pagi', short: 'NPP', c1: '#1d3557', c2: '#f4d35e', gk: '#e63946', outfit: 'jersey', pattern: 'selempang', bottom: 'training', tactic: 'seimbang', level: 1,
      players: [P('Bang Ucok', 1, 'GK', 'naga', 'angin', 'sepatu', 3, 'keriting', 0, 'none', 'gempal', 'tinggi'),
        P('Hendra', 2, 'DF', 'banteng', 'elang', 'sepatu', 2, 'cepak', 0, 'none', 'gempal', 'tinggi'),
        P('Arif', 8, 'MF', 'naga', 'elang', 'sepatu', 1, 'belah', 1, 'none', 'sedang', 'sedang'),
        P('Iwan', 7, 'MF', 'beliung', 'elang', 'nyeker', 4, 'gondrong', 0, 'ikat', 'kurus', 'sedang'),
        P('Rizal', 9, 'FW', 'tinju', 'elang', 'sepatu', 2, 'cepak', 3, 'none', 'gempal', 'tinggi'),
        P('Bonar', 3, 'DF', 'banteng', 'elang', 'sepatu', 4, 'keriting', 0, 'none', 'gempal', 'tinggi'),
        P('Fikri', 6, 'MF', 'keris', 'elang', 'sepatu', 1, 'belah', 0, 'none', 'kurus', 'sedang'),
        P('Sihol', 4, 'DF', 'tinju', 'elang', 'sepatu', 3, 'cepak', 0, 'none', 'gempal', 'tinggi'),
        P('Tigor', 5, 'DF', 'banteng', 'elang', 'nyeker', 4, 'botak', 0, 'ikat', 'gempal', 'sedang'),
        P('Lukman', 10, 'MF', 'naga', 'elang', 'sepatu', 2, 'kuncir', 1, 'none', 'sedang', 'sedang'),
        P('Danu', 11, 'FW', 'macan', 'elang', 'sepatu', 2, 'mohawk', 2, 'none', 'kurus', 'tinggi')]
    },
    {
      name: 'Elang Bukit Kapur', short: 'EBK', c1: '#f1faee', c2: '#457b9d', gk: '#2d6a4f', outfit: 'kaos', pattern: 'datar', bottom: 'pendek', tactic: 'serang', level: 1,
      players: [P('Cak Mat', 1, 'GK', 'naga', 'elang', 'sepatu', 3, 'cepak', 0, 'topi', 'sedang', 'tinggi'),
        P('Yanto', 4, 'DF', 'tinju', 'elang', 'sepatu', 4, 'botak', 0, 'none', 'gempal', 'sedang'),
        P('Bagas', 6, 'MF', 'garuda', 'elang', 'sepatu', 2, 'belah', 2, 'none', 'sedang', 'tinggi'),
        P('Jalu', 11, 'MF', 'keris', 'elang', 'nyeker', 1, 'kuncir', 0, 'bandana', 'kurus', 'pendek'),
        P('Dodi', 9, 'FW', 'meteor', 'elang', 'sepatu', 3, 'mohawk', 0, 'none', 'sedang', 'sedang'),
        P('Sugeng', 2, 'DF', 'banteng', 'elang', 'sepatu', 3, 'cepak', 4, 'none', 'gempal', 'sedang'),
        P('Lutfi', 8, 'MF', 'beliung', 'elang', 'nyeker', 2, 'belah', 1, 'bandana', 'kurus', 'sedang'),
        P('Rudi', 3, 'DF', 'tinju', 'elang', 'sepatu', 1, 'botak', 0, 'none', 'gempal', 'tinggi'),
        P('Harun', 5, 'DF', 'banteng', 'elang', 'sepatu', 4, 'keriting', 0, 'none', 'sedang', 'tinggi'),
        P('Zaki', 7, 'MF', 'macan', 'elang', 'sandal', 2, 'gondrong', 2, 'none', 'kurus', 'pendek'),
        P('Bima', 10, 'FW', 'garuda', 'elang', 'sepatu', 3, 'cepak', 0, 'topi', 'gempal', 'tinggi')]
    },
    {
      name: 'Laskar Tambak', short: 'LTB', c1: '#6a4c93', c2: '#ffca3a', gk: '#1982c4', outfit: 'singlet', pattern: 'polos', bottom: 'pendek', tactic: 'seimbang', level: 2,
      players: [P('Mas Pur', 1, 'GK', 'naga', 'harimau', 'sepatu', 4, 'cepak', 0, 'none', 'gempal', 'tinggi'),
        P('Gondo', 5, 'DF', 'banteng', 'elang', 'nyeker', 5, 'botak', 0, 'ikat', 'gempal', 'tinggi'),
        P('Kiki', 7, 'MF', 'macan', 'elang', 'sepatu', 2, 'belah', 1, 'none', 'kurus', 'sedang'),
        P('Rusdi', 8, 'MF', 'naga', 'elang', 'sandal', 3, 'gondrong', 1, 'none', 'sedang', 'sedang'),
        P('Ucup', 10, 'FW', 'garuda', 'elang', 'sepatu', 1, 'keriting', 2, 'none', 'sedang', 'tinggi'),
        P('Rahman', 2, 'DF', 'tinju', 'elang', 'sepatu', 3, 'cepak', 0, 'none', 'gempal', 'tinggi'),
        P('Ilham', 6, 'MF', 'keris', 'elang', 'nyeker', 2, 'belah', 0, 'none', 'kurus', 'sedang'),
        P('Wahyu', 3, 'DF', 'banteng', 'elang', 'sepatu', 4, 'botak', 0, 'ikat', 'gempal', 'sedang'),
        P('Yudi', 4, 'DF', 'tinju', 'elang', 'sandal', 3, 'mohawk', 1, 'none', 'sedang', 'tinggi'),
        P('Tejo', 11, 'MF', 'beliung', 'elang', 'sepatu', 5, 'kuncir', 0, 'none', 'sedang', 'sedang'),
        P('Surya', 9, 'FW', 'meteor', 'elang', 'sepatu', 1, 'gondrong', 3, 'bandana', 'kurus', 'tinggi')]
    }
    ,
    {
      name: 'Siluman Alas Roban', short: 'SAR', c1: '#2d6a4f', c2: '#1b1b1b', gk: '#9b2226', outfit: 'singlet', pattern: 'polos', bottom: 'sarung', tactic: 'serang', level: 2, kind: 'siluman',
      players: [P('Ki Genderuwo', 1, 'GK', 'naga', 'macan', 'nyeker', 4, 'gondrong', 0, 'none', 'gempal', 'tinggi'),
        P('Buto Lempung', 4, 'DF', 'banteng', 'elang', 'nyeker', 3, 'botak', 0, 'none', 'gempal', 'tinggi'),
        P('Nyi Ular', 8, 'MF', 'keris', 'elang', 'nyeker', 2, 'gondrong', 0, 'none', 'kurus', 'sedang'),
        P('Celeng Gotak', 7, 'MF', 'beliung', 'elang', 'nyeker', 3, 'cepak', 0, 'none', 'gempal', 'pendek'),
        P('Tuyul Kecil', 9, 'FW', 'meteor', 'elang', 'nyeker', 2, 'botak', 0, 'none', 'kurus', 'pendek'),
        P('Wedhon', 2, 'DF', 'tinju', 'elang', 'nyeker', 4, 'gondrong', 0, 'none', 'gempal', 'tinggi'),
        P('Buto Cakil', 6, 'MF', 'macan', 'elang', 'nyeker', 3, 'botak', 0, 'none', 'gempal', 'sedang'),
        P('Naga Kali', 3, 'DF', 'banteng', 'elang', 'nyeker', 2, 'gondrong', 0, 'none', 'sedang', 'tinggi'),
        P('Babi Ngepet', 5, 'DF', 'tinju', 'elang', 'nyeker', 3, 'cepak', 0, 'none', 'gempal', 'sedang'),
        P('Tuyul Gundul', 10, 'MF', 'garuda', 'elang', 'nyeker', 2, 'botak', 0, 'none', 'kurus', 'pendek'),
        P('Genderuwo Jr', 11, 'FW', 'naga', 'elang', 'nyeker', 4, 'gondrong', 0, 'none', 'gempal', 'tinggi')]
    },
    {
      name: 'Hantu Rumah Kosong', short: 'HRK', c1: '#f1f1f1', c2: '#4a4e69', gk: '#9a8c98', outfit: 'jersey', pattern: 'polos', bottom: 'training', tactic: 'seimbang', level: 2, kind: 'hantu',
      players: [P('Mbak Kunti', 1, 'GK', 'naga', 'angin', 'nyeker', 0, 'gondrong', 0, 'none', 'kurus', 'tinggi'),
        P('Pocong Loncat', 4, 'DF', 'banteng', 'elang', 'nyeker', 0, 'botak', 0, 'none', 'sedang', 'sedang'),
        P('Sundel', 8, 'MF', 'keris', 'elang', 'nyeker', 0, 'gondrong', 0, 'none', 'kurus', 'tinggi'),
        P('Wewe', 7, 'MF', 'beliung', 'elang', 'nyeker', 0, 'gondrong', 4, 'none', 'kurus', 'sedang'),
        P('Jin Ifrit', 9, 'FW', 'meteor', 'elang', 'nyeker', 0, 'mohawk', 3, 'none', 'gempal', 'tinggi'),
        P('Pocong Sawah', 2, 'DF', 'tinju', 'elang', 'nyeker', 0, 'botak', 0, 'none', 'sedang', 'pendek'),
        P('Kunti Muda', 6, 'MF', 'macan', 'elang', 'nyeker', 0, 'gondrong', 0, 'none', 'kurus', 'sedang'),
        P('Jin Lampu', 3, 'DF', 'banteng', 'elang', 'nyeker', 0, 'mohawk', 3, 'none', 'gempal', 'tinggi'),
        P('Wewe Tua', 5, 'DF', 'tinju', 'elang', 'nyeker', 0, 'gondrong', 4, 'none', 'kurus', 'sedang'),
        P('Sundel Pasar', 10, 'MF', 'garuda', 'elang', 'nyeker', 0, 'gondrong', 0, 'none', 'kurus', 'tinggi'),
        P('Pocong Kuburan', 11, 'FW', 'naga', 'elang', 'nyeker', 0, 'botak', 0, 'none', 'sedang', 'sedang')]
    },
    {
      name: 'Satwa Rimba Raya', short: 'SRR', c1: '#bc6c25', c2: '#283618', gk: '#606c38', outfit: 'singlet', pattern: 'polos', bottom: 'pendek', tactic: 'serang', level: 1, kind: 'mamalia',
      players: [P('Kerbau Jantan', 1, 'GK', 'naga', 'karang', 'nyeker', 3, 'cepak', 0, 'none', 'gempal', 'tinggi'),
        P('Beruang Madu', 4, 'DF', 'banteng', 'elang', 'nyeker', 4, 'cepak', 0, 'none', 'gempal', 'tinggi'),
        P('Si Macan', 8, 'MF', 'macan', 'elang', 'nyeker', 2, 'cepak', 0, 'none', 'sedang', 'sedang'),
        P('Monyet Lincah', 7, 'MF', 'beliung', 'elang', 'nyeker', 3, 'cepak', 0, 'none', 'kurus', 'pendek'),
        P('Kucing Oren', 9, 'FW', 'meteor', 'elang', 'nyeker', 2, 'cepak', 0, 'none', 'kurus', 'pendek'),
        P('Anjing Kampung', 2, 'DF', 'tinju', 'elang', 'nyeker', 3, 'cepak', 0, 'none', 'sedang', 'sedang'),
        P('Harimau Loreng', 6, 'MF', 'keris', 'elang', 'nyeker', 2, 'cepak', 0, 'none', 'sedang', 'tinggi'),
        P('Kerbau Lumpur', 3, 'DF', 'banteng', 'elang', 'nyeker', 4, 'cepak', 0, 'none', 'gempal', 'tinggi'),
        P('Beruang Hitam', 5, 'DF', 'tinju', 'elang', 'nyeker', 5, 'cepak', 0, 'none', 'gempal', 'sedang'),
        P('Monyet Ekor', 10, 'MF', 'garuda', 'elang', 'nyeker', 3, 'cepak', 0, 'none', 'kurus', 'pendek'),
        P('Kucing Hitam', 11, 'FW', 'naga', 'elang', 'nyeker', 5, 'cepak', 0, 'none', 'kurus', 'sedang')]
    },
    {
      name: 'Robot Pabrik Baja', short: 'RPB', c1: '#8d99ae', c2: '#ef233c', gk: '#edf2f4', outfit: 'jersey', pattern: 'polos', bottom: 'training', tactic: 'bertahan', level: 2, kind: 'robot',
      players: [P('Unit-00', 1, 'GK', 'naga', 'harimau', 'sepatu', 1, 'botak', 0, 'none', 'gempal', 'tinggi'),
        P('Unit-04', 4, 'DF', 'banteng', 'elang', 'sepatu', 1, 'botak', 0, 'none', 'gempal', 'tinggi'),
        P('Unit-08', 8, 'MF', 'beliung', 'elang', 'sepatu', 1, 'botak', 0, 'none', 'sedang', 'sedang'),
        P('Unit-07', 7, 'MF', 'keris', 'elang', 'sepatu', 1, 'botak', 0, 'none', 'kurus', 'sedang'),
        P('Unit-09', 9, 'FW', 'meteor', 'elang', 'sepatu', 1, 'botak', 0, 'none', 'sedang', 'tinggi'),
        P('Unit-02', 2, 'DF', 'tinju', 'elang', 'sepatu', 1, 'botak', 0, 'none', 'gempal', 'sedang'),
        P('Unit-06', 6, 'MF', 'macan', 'elang', 'sepatu', 1, 'botak', 0, 'none', 'sedang', 'sedang'),
        P('Unit-03', 3, 'DF', 'banteng', 'elang', 'sepatu', 1, 'botak', 0, 'none', 'gempal', 'tinggi'),
        P('Unit-05', 5, 'DF', 'tinju', 'elang', 'sepatu', 1, 'botak', 0, 'none', 'sedang', 'sedang'),
        P('Unit-10', 10, 'MF', 'garuda', 'elang', 'sepatu', 1, 'botak', 0, 'none', 'kurus', 'tinggi'),
        P('Unit-11', 11, 'FW', 'naga', 'elang', 'sepatu', 1, 'botak', 0, 'none', 'sedang', 'tinggi')]
    },
    {
      name: 'Rig Lepas Pantai', short: 'RLP', c1: '#f77f00', c2: '#1d3557', gk: '#d62828', outfit: 'jersey', pattern: 'polos', bottom: 'training', tactic: 'seimbang', level: 1, kind: 'migas', ppe: 'helm',
      players: [P('Pak Rig', 1, 'GK', 'naga', 'karang', 'sepatu', 3, 'cepak', 0, 'none', 'gempal', 'tinggi', 'kumis'),
        P('Toolpusher', 4, 'DF', 'banteng', 'elang', 'sepatu', 2, 'botak', 0, 'none', 'gempal', 'tinggi', 'brewok'),
        P('Driller Joni', 8, 'MF', 'beliung', 'elang', 'sepatu', 3, 'cepak', 0, 'none', 'sedang', 'sedang'),
        P('Roughneck', 7, 'MF', 'tinju', 'elang', 'sepatu', 4, 'cepak', 0, 'none', 'gempal', 'sedang'),
        P('Wireline Edo', 9, 'FW', 'meteor', 'elang', 'sepatu', 2, 'cepak', 0, 'none', 'sedang', 'tinggi'),
        P('HSE Budi', 2, 'DF', 'banteng', 'elang', 'sepatu', 3, 'belah', 0, 'none', 'sedang', 'sedang', 'kacamata'),
        P('Mud Engineer', 6, 'MF', 'keris', 'elang', 'sepatu', 1, 'cepak', 0, 'none', 'kurus', 'sedang'),
        P('Crane Op', 3, 'DF', 'tinju', 'elang', 'sepatu', 4, 'botak', 0, 'none', 'gempal', 'tinggi'),
        P('Roustabout', 5, 'DF', 'banteng', 'elang', 'sepatu', 3, 'cepak', 0, 'none', 'gempal', 'sedang'),
        P('Geolog Sari', 10, 'MF', 'garuda', 'elang', 'sepatu', 2, 'kuncir', 0, 'none', 'kurus', 'sedang'),
        P('Medic Rina', 11, 'FW', 'naga', 'elang', 'sepatu', 1, 'kuncir', 0, 'none', 'kurus', 'sedang')]
    },
    {
      name: 'Partai Bola Rakyat', short: 'PBR', c1: '#ffbe0b', c2: '#1b1b1b', gk: '#3a86ff', outfit: 'kaos', pattern: 'polos', bottom: 'training', tactic: 'bertahan', level: 1, kind: 'partai',
      players: [P('Pak Ketum', 1, 'GK', 'naga', 'elang', 'sepatu', 3, 'belah', 4, 'none', 'gempal', 'sedang', 'kumis'),
        P('Pak Sekjen', 4, 'DF', 'banteng', 'elang', 'sepatu', 2, 'belah', 0, 'none', 'gempal', 'tinggi'),
        P('Bu Bendahara', 8, 'MF', 'keris', 'elang', 'sepatu', 1, 'kuncir', 0, 'none', 'kurus', 'sedang'),
        P('Caleg Dapil 3', 7, 'MF', 'beliung', 'elang', 'sepatu', 3, 'cepak', 0, 'none', 'sedang', 'sedang', 'kacamata'),
        P('Jubir Partai', 9, 'FW', 'meteor', 'elang', 'sepatu', 2, 'belah', 0, 'none', 'kurus', 'tinggi'),
        P('Tim Sukses', 2, 'DF', 'tinju', 'elang', 'sepatu', 4, 'cepak', 0, 'none', 'gempal', 'sedang'),
        P('Kader Muda', 6, 'MF', 'macan', 'elang', 'sepatu', 2, 'cepak', 0, 'none', 'sedang', 'sedang'),
        P('Pak Dewan', 3, 'DF', 'banteng', 'elang', 'sepatu', 3, 'belah', 4, 'none', 'gempal', 'tinggi', 'kumis'),
        P('Saksi TPS', 5, 'DF', 'tinju', 'elang', 'sepatu', 2, 'cepak', 0, 'none', 'sedang', 'sedang'),
        P('Relawan', 10, 'MF', 'garuda', 'elang', 'sepatu', 3, 'keriting', 0, 'none', 'kurus', 'sedang'),
        P('Orator', 11, 'FW', 'naga', 'elang', 'sepatu', 2, 'gondrong', 0, 'none', 'sedang', 'tinggi')]
    }
  ];

  (function () {
    var faces = { 'Pak RT': 'kumis', 'Mbah Darmo': 'jenggot', 'Kang Didin': 'brewok', 'Bang Ucok': 'kumis', 'Cak Mat': 'kumis', 'Mas Pur': 'brewok',
      'Wawan': 'brewok', 'Tole': 'kacamata', 'Udin': 'kumis', 'Sapto': 'jenggot', 'Hendra': 'kacamata', 'Yanto': 'kumis', 'Gondo': 'brewok',
      'Pardi': 'kumis', 'Dadang': 'brewok', 'Paijo': 'kumis', 'Tigor': 'brewok', 'Harun': 'jenggot', 'Wahyu': 'kacamata', 'Ipul': 'kacamata', 'Lukman': 'kacamata' };
    D.TEAMS.forEach(function (t) { t.players.forEach(function (p) { if (faces[p.name]) p.face = faces[p.name]; }); });
    // varian wujud tim NPC ditebak dari nama pemain
    var VAR_RX = [[/kunti/i, 'kuntilanak'], [/pocong/i, 'pocong'], [/sundel/i, 'sundel'], [/wewe/i, 'wewe'], [/jin/i, 'jin'],
      [/genderuwo|wedhon/i, 'genderuwo'], [/buto/i, 'buto'], [/ular|naga/i, 'ular'], [/celeng|babi/i, 'babi'], [/tuyul/i, 'tuyul'],
      [/harimau|macan/i, 'harimau'], [/monyet/i, 'monyet'], [/kerbau/i, 'kerbau'], [/beruang/i, 'beruang'], [/kucing/i, 'kucing'], [/anjing/i, 'anjing']];
    D.TEAMS.forEach(function (t) {
      var k = D.kindById[t.kind || 'manusia']; if (!k || !k.variants.length) return;
      var ids = k.variants.map(function (v) { return v.id; });
      t.players.forEach(function (p, i) {
        var hit = null; VAR_RX.forEach(function (r) { if (!hit && r[0].test(p.name) && ids.indexOf(r[1]) >= 0) hit = r[1]; });
        p.variant = hit || ids[i % ids.length];
      });
    });
  })();

  D.defaultMyTeam = function () {
    return {
      name: 'Tunas Kampung', short: 'TKP', c1: '#ff6b35', c2: '#004e89', gk: '#ffd23f', outfit: 'jersey', pattern: 'tegak', bottom: 'pendek', tactic: 'seimbang', level: 1, kind: 'manusia', ppe: 'helm',
      players: [P('Pak Darto', 1, 'GK', 'naga', 'elang', 'sepatu', 2, 'cepak', 4, 'none', 'gempal', 'tinggi', 'kumis'),
        P('Rahmat', 4, 'DF', 'banteng', 'elang', 'sepatu', 3, 'cepak', 0, 'none', 'gempal', 'tinggi'),
        P('Yusuf', 8, 'MF', 'macan', 'elang', 'nyeker', 2, 'belah', 1, 'ikat', 'sedang', 'sedang'),
        P('Andi', 7, 'MF', 'keris', 'elang', 'sandal', 1, 'keriting', 0, 'none', 'kurus', 'pendek'),
        P('Satria', 9, 'FW', 'naga', 'elang', 'sepatu', 2, 'mohawk', 3, 'none', 'sedang', 'tinggi'),
        P('Agus', 2, 'DF', 'tinju', 'elang', 'sepatu', 3, 'cepak', 0, 'none', 'gempal', 'sedang'),
        P('Bambang', 6, 'MF', 'beliung', 'elang', 'nyeker', 2, 'belah', 1, 'none', 'sedang', 'sedang'),
        P('Teguh', 3, 'DF', 'banteng', 'elang', 'sepatu', 4, 'botak', 0, 'ikat', 'gempal', 'tinggi', 'brewok'),
        P('Slamet', 5, 'DF', 'tinju', 'elang', 'sandal', 1, 'keriting', 0, 'none', 'sedang', 'sedang'),
        P('Joko', 10, 'MF', 'garuda', 'elang', 'sepatu', 2, 'kuncir', 0, 'none', 'kurus', 'tinggi', 'kacamata'),
        P('Galih', 11, 'FW', 'meteor', 'elang', 'sepatu', 3, 'gondrong', 1, 'bandana', 'sedang', 'tinggi')]
    };
  };

  D.MAX_SQUAD = 11;
  /* kelompok pemain di editor: 5 inti, +2 untuk 7 vs 7, +4 untuk 11 vs 11 */
  D.SQUAD_GROUPS = [{ from: 0, to: 5, n: 'Inti · main di semua lapangan' }, { from: 5, to: 7, n: 'Tambahan 7 vs 7' }, { from: 7, to: 11, n: 'Tambahan 11 vs 11' }];

  /* susunan posisi (formasi) untuk n pemain berdasarkan peran; fx = jarak dari gawang sendiri (0..1), fz = sisi (-0.5..0.5) */
  D.formation = function (players) {
    var slots = [], groups = { DF: [], MF: [], FW: [] };
    players.forEach(function (p, i) { if (i === 0 || p.role === 'GK') slots[i] = { fx: 0.02, fz: 0 }; else (groups[p.role] || groups.MF).push(i); });
    var big = players.length >= 9;
    var fxOf = big ? { DF: 0.19, MF: 0.41, FW: 0.63 } : { DF: 0.22, MF: 0.43, FW: 0.65 };
    Object.keys(groups).forEach(function (role) {
      var g = groups[role], n = g.length;
      var sp = n <= 1 ? 0 : (n === 2 ? 0.44 : (n === 3 ? 0.3 : Math.min(0.24, 0.76 / (n - 1))));
      g.forEach(function (idx, k) {
        var fz = (k - (n - 1) / 2) * sp;
        // bek sayap & gelandang sayap sedikit lebih maju di formasi besar
        var push = big && n >= 4 && (k === 0 || k === n - 1) ? 0.04 : 0;
        slots[idx] = { fx: fxOf[role] + push, fz: fz };
      });
    });
    return slots;
  };

  /* ---------------- validasi & kompresi tim (untuk simpan & jaringan) ---------------- */
  function ids(arr) { return arr.map(function (o) { return o.id; }); }
  var ROLE_IDS = ids(D.ROLES), SHOT_IDS = ids(D.SHOTS), STYLE_IDS = ids(D.STYLES), FOOT_IDS = ids(D.FEET), HAIR_IDS = ids(D.HAIRS),
    HEAD_IDS = ids(D.HEADS), BODY_IDS = ids(D.BODIES), H_IDS = ids(D.HEIGHTS), OUT_IDS = ids(D.OUTFITS), PAT_IDS = ids(D.PATTERNS),
    BOT_IDS = ids(D.BOTTOMS), TAC_IDS = ids(D.TACTICS), FACE_IDS = ids(D.FACES), KIND_IDS = ids(D.KINDS), PPE_IDS = ids(D.PPE);
  D.KIND_IDS = KIND_IDS;
  function pickId(v, list, def) { return list.indexOf(v) >= 0 ? v : def; }

  D.sanitizeTeam = function (t) {
    var d = D.defaultMyTeam();
    if (!t || typeof t !== 'object') return d;
    var out = {
      name: U.cleanText(t.name, 20) || d.name,
      short: (U.cleanText(t.short, 3) || (U.cleanText(t.name, 20) || 'TIM').slice(0, 3)).toUpperCase(),
      c1: U.cleanColor(t.c1, d.c1), c2: U.cleanColor(t.c2, d.c2), gk: U.cleanColor(t.gk, d.gk),
      outfit: pickId(t.outfit, OUT_IDS, 'jersey'), pattern: pickId(t.pattern, PAT_IDS, 'polos'), bottom: pickId(t.bottom, BOT_IDS, 'pendek'),
      tactic: pickId(t.tactic, TAC_IDS, 'seimbang'), level: U.clamp(Math.round(U.num(t.level, 1)), 0, 2),
      kind: pickId(t.kind, KIND_IDS, 'manusia'), ppe: pickId(t.ppe, PPE_IDS, 'helm'), players: []
    };
    var kindDef = D.kindById[out.kind], VAR_IDS = kindDef.variants.map(function (v) { return v.id; });
    var src = Array.isArray(t.players) ? t.players : [];
    for (var i = 0; i < D.MAX_SQUAD; i++) {
      var p = src[i] || {}, dp = d.players[i];
      var role = i === 0 ? 'GK' : pickId(p.role, ROLE_IDS, dp.role);
      if (i > 0 && role === 'GK') role = dp.role;
      out.players.push({
        name: U.cleanText(p.name, 12) || dp.name,
        num: U.clamp(Math.round(U.num(p.num, dp.num)), 0, 99),
        role: role,
        shot: pickId(p.shot, SHOT_IDS, dp.shot),
        style: pickId(p.style, STYLE_IDS, dp.style),
        foot: pickId(p.foot, FOOT_IDS, dp.foot),
        skin: U.idx(p.skin, D.SKINS.length, dp.skin),
        hair: pickId(p.hair, HAIR_IDS, dp.hair),
        hairC: U.idx(p.hairC, D.HAIR_COLORS.length, dp.hairC),
        head: pickId(p.head, HEAD_IDS, dp.head),
        body: pickId(p.body, BODY_IDS, dp.body),
        height: pickId(p.height, H_IDS, dp.height),
        face: pickId(p.face, FACE_IDS, dp.face || 'polos'),
        variant: VAR_IDS.length ? (VAR_IDS.indexOf(p.variant) >= 0 ? p.variant : VAR_IDS[i % VAR_IDS.length]) : ''
      });
    }
    return out;
  };

  /* ---------------- seragam bentrok: tim kedua memakai seragam tandang ---------------- */
  function cdist(a, b) {
    var A = U.hexToRgb(a), B = U.hexToRgb(b);
    var r1 = A[0] * 255, g1 = A[1] * 255, b1 = A[2] * 255, r2 = B[0] * 255, g2 = B[1] * 255, b2 = B[2] * 255;
    var rm = (r1 + r2) / 2, dr = r1 - r2, dg = g1 - g2, db = b1 - b2;
    return Math.sqrt((2 + rm / 256) * dr * dr + 4 * dg * dg + (2 + (255 - rm) / 256) * db * db);
  }
  D.colorDist = cdist;
  var ALT_KITS = ['#f2f2f2', '#1b1b1b', '#3a86ff', '#ffbe0b', '#06d6a0', '#d62828', '#6a4c93', '#ff5d8f', '#2a9d8f'];
  function farthest(avoid) {
    var best = ALT_KITS[0], bd = -1;
    ALT_KITS.forEach(function (c) {
      var d = Infinity;
      avoid.forEach(function (x) { d = Math.min(d, cdist(c, x)); });
      if (d > bd) { bd = d; best = c; }
    });
    return best;
  }
  D.KIT_GAP = 160;
  D.resolveKits = function (a, b) {
    var T = D.KIT_GAP;
    var A = Object.assign({}, a), B = Object.assign({}, b);
    if (cdist(A.c1, B.c1) < T) {
      if (cdist(A.c1, B.c2) >= T && cdist(A.c2, B.c2) >= T * 0.5) { var tmp = B.c1; B.c1 = B.c2; B.c2 = tmp; }
      else {
        B.c1 = farthest([A.c1, A.c2]);
        if (cdist(B.c1, B.c2) < T) B.c2 = U.lum(B.c1) > 0.5 ? '#1b1b1b' : '#f2f2f2';
      }
      B.away = true;
    }
    if (cdist(A.gk, A.c1) < T || cdist(A.gk, B.c1) < T) A.gk = farthest([A.c1, B.c1, B.gk]);
    if (cdist(B.gk, B.c1) < T || cdist(B.gk, A.c1) < T || cdist(B.gk, A.gk) < T) B.gk = farthest([A.c1, B.c1, A.gk]);
    if (A.short === B.short) B.short = B.short.slice(0, 2) + '2';
    if (A.name === B.name) B.name = B.name.slice(0, 17) + ' B';
    return [A, B];
  };

  /* bentuk ringkas (indeks angka) supaya muat di saluran online */
  D.packTeam = function (t) {
    t = D.sanitizeTeam(t);
    return {
      n: t.name, s: t.short, a: t.c1, b: t.c2, k: t.gk, o: OUT_IDS.indexOf(t.outfit), p: PAT_IDS.indexOf(t.pattern),
      w: BOT_IDS.indexOf(t.bottom), t: TAC_IDS.indexOf(t.tactic), l: t.level, K: KIND_IDS.indexOf(t.kind), E: PPE_IDS.indexOf(t.ppe),
      P: t.players.map(function (p) {
        var vids = D.kindById[t.kind].variants.map(function (v) { return v.id; });
        return [p.name, p.num, ROLE_IDS.indexOf(p.role), SHOT_IDS.indexOf(p.shot), STYLE_IDS.indexOf(p.style), FOOT_IDS.indexOf(p.foot),
          p.skin, HAIR_IDS.indexOf(p.hair), p.hairC, HEAD_IDS.indexOf(p.head), BODY_IDS.indexOf(p.body), H_IDS.indexOf(p.height), FACE_IDS.indexOf(p.face), Math.max(0, vids.indexOf(p.variant))];
      })
    };
  };
  D.unpackTeam = function (o) {
    if (!o || typeof o !== 'object') return D.sanitizeTeam(null);
    function at(list, i) { return list[U.idx(i, list.length, 0)]; }
    var t = {
      name: o.n, short: o.s, c1: o.a, c2: o.b, gk: o.k, outfit: at(OUT_IDS, o.o), pattern: at(PAT_IDS, o.p), bottom: at(BOT_IDS, o.w),
      tactic: at(TAC_IDS, o.t), level: o.l, kind: at(KIND_IDS, o.K), ppe: at(PPE_IDS, o.E), players: []
    };
    var vids = D.kindById[t.kind].variants.map(function (v) { return v.id; });
    var P2 = Array.isArray(o.P) ? o.P : [];
    for (var i = 0; i < D.MAX_SQUAD; i++) {
      var a = Array.isArray(P2[i]) ? P2[i] : [];
      t.players.push({
        name: a[0], num: a[1], role: at(ROLE_IDS, a[2]), shot: at(SHOT_IDS, a[3]), style: at(STYLE_IDS, a[4]), foot: at(FOOT_IDS, a[5]),
        skin: a[6], hair: at(HAIR_IDS, a[7]), hairC: a[8], head: at(HEAD_IDS, a[9]), body: at(BODY_IDS, a[10]), height: at(H_IDS, a[11]), face: at(FACE_IDS, a[12]), variant: vids.length ? at(vids, a[13]) : ''
      });
    }
    return D.sanitizeTeam(t);
  };

  /* ---------------- statistik pemain dari peran + penampilan ---------------- */
  D.playerStats = function (p, level) {
    var base = {
      GK: { lari: 56, tendang: 62, gocek: 52, tekel: 55, stamina: 70, refleks: 74, tenaga: 74 },
      DF: { lari: 68, tendang: 68, gocek: 60, tekel: 80, stamina: 78, refleks: 40, tenaga: 40 },
      MF: { lari: 73, tendang: 72, gocek: 78, tekel: 68, stamina: 80, refleks: 40, tenaga: 40 },
      FW: { lari: 77, tendang: 81, gocek: 74, tekel: 54, stamina: 72, refleks: 40, tenaga: 40 }
    }[p.role] || null;
    var s = U.copy(base || { lari: 70, tendang: 70, gocek: 70, tekel: 60, stamina: 75, refleks: 40, tenaga: 40 });
    if (p.body === 'kurus') { s.lari += 5; s.tendang -= 4; s.tekel -= 3; s.stamina += 4; s.refleks += 4; s.tenaga -= 3; }
    if (p.body === 'gempal') { s.lari -= 5; s.tendang += 6; s.tekel += 5; s.stamina -= 4; s.tenaga += 5; s.refleks -= 3; }
    if (p.height === 'pendek') { s.lari += 2; s.gocek += 4; s.tenaga -= 2; }
    if (p.height === 'tinggi') { s.lari -= 1; s.gocek -= 3; s.tenaga += 3; s.refleks += 1; }
    if (p.foot === 'nyeker') { s.lari += 4; s.gocek += 3; }
    if (p.foot === 'sepatu') { s.tendang += 2; }
    if (p.foot === 'sandal') { s.lari -= 2; s.gocek += 1; }
    var lv = (U.num(level, 1) - 1) * 3;
    Object.keys(s).forEach(function (k) { s[k] = U.clamp(Math.round(s[k] + lv), 30, 99); });
    s.footMul = p.foot === 'sepatu' ? 1.06 : (p.foot === 'sandal' ? 0.98 : 1.0);
    return s;
  };

})(typeof window !== 'undefined' ? window : globalThis);
