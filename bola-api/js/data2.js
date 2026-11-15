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

  /* ---------------- Liga Bintang Dunia: klub-klub superstar rekaan ----------------
     Semua tim, nama, dan pemain di sini karangan sendiri (bukan klub atau atlet sungguhan), masing-masing punya satu
     bintang viral dengan gaya main khas. Nama/rupa atlet asli sengaja tidak dipakai karena perlu lisensi. */
  function G(name, num, style, skin, hair, hairC, head, body, height, face) {
    var g = P(name, num, 'GK', 'naga', 'sepatu', skin, hair, hairC, head, body, height, face); g.style = style; return g;
  }
  function W(def) { def.level = 2; def.kind = 'manusia'; def.star = 1; def.world = 1; D.TEAMS.push(def); return def; }
  D.WORLD_TEAMS = [
    W({ name: 'Samba Pantai', short: 'SBP', c1: '#ffd60a', c2: '#2b9348', gk: '#1d4ed8', outfit: 'jersey', pattern: 'polos', bottom: 'pendek', tactic: 'serang',
      desc: 'Raja goyang bola dari pantai. Bintangnya Juninho Brisa: gocekan samba dan tendangan pisang yang viral di mana-mana.',
      players: [G('Tiago Areia', 1, 'angin', 3, 'cepak', 0, 'none', 'sedang', 'tinggi'),
        P('Davi Coqueiro', 4, 'DF', 'banteng', 'sepatu', 4, 'cepak', 0, 'none', 'gempal', 'tinggi'),
        P('Juninho Brisa', 10, 'MF', 'keris', 'sepatu', 3, 'keriting', 2, 'bandana', 'kurus', 'pendek'),
        P('Caio Onda', 8, 'MF', 'beliung', 'sepatu', 2, 'belah', 0, 'none', 'kurus', 'sedang'),
        P('Lelo Mare', 9, 'FW', 'meteor', 'sepatu', 4, 'mohawk', 2, 'none', 'sedang', 'sedang'),
        P('Edu Cajueiro', 2, 'DF', 'tinju', 'sepatu', 3, 'keriting', 0, 'none', 'sedang', 'sedang'),
        P('Biel Farofa', 7, 'MF', 'macan', 'nyeker', 5, 'kuncir', 0, 'none', 'kurus', 'sedang'),
        P('Nando Praia', 3, 'DF', 'banteng', 'sepatu', 2, 'gondrong', 1, 'ikat', 'gempal', 'tinggi', 'brewok'),
        P('Lucao Mangue', 5, 'DF', 'tinju', 'sepatu', 5, 'botak', 0, 'none', 'gempal', 'tinggi'),
        P('Tuca Remo', 6, 'MF', 'garuda', 'sepatu', 3, 'cepak', 1, 'none', 'sedang', 'sedang'),
        P('Zeca Pipoca', 11, 'FW', 'macan', 'nyeker', 4, 'keriting', 0, 'topi', 'kurus', 'pendek'),
        P('Duda Vento', 12, 'FW', 'beliung', 'sepatu', 2, 'gondrong', 2, 'none', 'kurus', 'sedang'),
        P('Gui Pandeiro', 13, 'MF', 'keris', 'nyeker', 3, 'mohawk', 3, 'none', 'kurus', 'pendek'),
        P('Beto Caju', 14, 'DF', 'banteng', 'sepatu', 4, 'cepak', 0, 'none', 'gempal', 'sedang', 'kumis'),
        P('Ninho Areal', 15, 'MF', 'naga', 'sepatu', 2, 'belah', 1, 'none', 'sedang', 'sedang'),
        P('Tonho Jangada', 16, 'FW', 'garuda', 'sandal', 5, 'kuncir', 0, 'bandana', 'sedang', 'tinggi')] }),
    W({ name: 'Tango Perak', short: 'TGP', c1: '#8ecae6', c2: '#f8f9fa', gk: '#14213d', outfit: 'jersey', pattern: 'datar', bottom: 'pendek', tactic: 'seimbang',
      desc: 'Lincah, licik, dan penuh gaya. Bintangnya Nico Paredes: penyerang licin yang tendangan bebas melengkungnya ditonton jutaan kali.',
      players: [G('Bruno Ledesma', 1, 'macan', 1, 'gondrong', 1, 'none', 'gempal', 'tinggi', 'brewok'),
        P('Facu Ibarra', 2, 'DF', 'tinju', 'sepatu', 1, 'cepak', 1, 'none', 'gempal', 'tinggi'),
        P('Nico Paredes', 10, 'FW', 'keris', 'sepatu', 2, 'gondrong', 0, 'ikat', 'sedang', 'sedang'),
        P('Santi Correa', 8, 'MF', 'garuda', 'sepatu', 1, 'belah', 0, 'none', 'sedang', 'sedang'),
        P('Tomi Bustos', 9, 'FW', 'meteor', 'sepatu', 2, 'kuncir', 0, 'none', 'sedang', 'tinggi'),
        P('Gaston Rivas', 4, 'DF', 'banteng', 'sepatu', 0, 'gondrong', 1, 'bandana', 'gempal', 'sedang', 'brewok'),
        P('Lucho Quiroga', 5, 'MF', 'tinju', 'sepatu', 2, 'cepak', 0, 'none', 'gempal', 'sedang'),
        P('Mati Olmedo', 6, 'DF', 'banteng', 'sepatu', 1, 'belah', 1, 'none', 'sedang', 'tinggi'),
        P('Ruben Funes', 3, 'DF', 'tinju', 'sepatu', 2, 'botak', 0, 'none', 'gempal', 'tinggi'),
        P('Pipo Aranda', 7, 'MF', 'beliung', 'sepatu', 1, 'gondrong', 0, 'ikat', 'kurus', 'sedang'),
        P('Chino Godoy', 11, 'FW', 'macan', 'sepatu', 2, 'mohawk', 0, 'none', 'kurus', 'pendek'),
        P('Benja Sosa', 12, 'MF', 'keris', 'sepatu', 1, 'keriting', 1, 'none', 'kurus', 'pendek'),
        P('Ramiro Cabral', 13, 'DF', 'banteng', 'sepatu', 0, 'cepak', 2, 'none', 'gempal', 'tinggi'),
        P('Pancho Vera', 14, 'FW', 'naga', 'sepatu', 2, 'gondrong', 0, 'none', 'sedang', 'sedang', 'kumis'),
        P('Uli Medina', 15, 'MF', 'macan', 'nyeker', 1, 'kuncir', 1, 'none', 'kurus', 'sedang'),
        P('Kevo Arce', 16, 'DF', 'tinju', 'sepatu', 2, 'cepak', 0, 'topi', 'sedang', 'tinggi')] }),
    W({ name: 'Viking Fjord', short: 'VKF', c1: '#0b2545', c2: '#e0fbfc', gk: '#ef233c', outfit: 'jersey', pattern: 'selempang', bottom: 'pendek', tactic: 'serang',
      desc: 'Raksasa dari utara. Bintangnya Bjorn Strand: penyerang raksasa yang setiap golnya disambut teriakan perang ala viking.',
      players: [G('Odd Hagen', 1, 'karang', 0, 'cepak', 2, 'none', 'gempal', 'tinggi', 'brewok'),
        P('Sindre Aas', 4, 'DF', 'banteng', 'sepatu', 0, 'cepak', 2, 'none', 'gempal', 'tinggi'),
        P('Eirik Dahl', 8, 'MF', 'garuda', 'sepatu', 0, 'belah', 2, 'none', 'sedang', 'tinggi'),
        P('Mats Lunde', 7, 'MF', 'beliung', 'sepatu', 0, 'kuncir', 2, 'none', 'kurus', 'sedang'),
        P('Bjorn Strand', 9, 'FW', 'tinju', 'sepatu', 0, 'gondrong', 2, 'ikat', 'gempal', 'tinggi'),
        P('Ivar Berg', 2, 'DF', 'tinju', 'sepatu', 0, 'gondrong', 3, 'none', 'gempal', 'tinggi', 'jenggot'),
        P('Kasper Holm', 6, 'MF', 'macan', 'sepatu', 1, 'cepak', 1, 'none', 'sedang', 'tinggi'),
        P('Torstein Vik', 3, 'DF', 'banteng', 'sepatu', 0, 'botak', 0, 'none', 'gempal', 'tinggi', 'brewok'),
        P('Leif Moen', 5, 'DF', 'tinju', 'sepatu', 0, 'belah', 2, 'none', 'sedang', 'tinggi'),
        P('Henrik Sand', 10, 'MF', 'naga', 'sepatu', 0, 'cepak', 2, 'none', 'sedang', 'sedang'),
        P('Aksel Ruud', 11, 'FW', 'meteor', 'sepatu', 1, 'mohawk', 2, 'none', 'sedang', 'tinggi'),
        P('Sverre Lie', 12, 'FW', 'garuda', 'sepatu', 0, 'gondrong', 3, 'none', 'sedang', 'tinggi'),
        P('Joakim Foss', 13, 'MF', 'keris', 'sepatu', 0, 'belah', 1, 'kupluk', 'kurus', 'sedang'),
        P('Tor Eide', 14, 'DF', 'banteng', 'sepatu', 0, 'cepak', 2, 'none', 'gempal', 'tinggi'),
        P('Fredrik Nes', 15, 'MF', 'beliung', 'sepatu', 1, 'keriting', 2, 'none', 'kurus', 'tinggi'),
        P('Ulrik Brekke', 16, 'FW', 'naga', 'sepatu', 0, 'kuncir', 2, 'none', 'gempal', 'tinggi', 'brewok')] }),
    W({ name: 'Matador Merah', short: 'MTM', c1: '#c1121f', c2: '#ffb703', gk: '#3a0ca3', outfit: 'jersey', pattern: 'polos', bottom: 'pendek', tactic: 'seimbang',
      desc: 'Umpan pendek tak putus-putus sampai lawan pusing. Bintangnya Pablo Ruano: pengatur serangan yang umpan tanpa melihatnya selalu jadi bahan video.',
      players: [G('Iker Salcedo', 1, 'angin', 1, 'cepak', 1, 'none', 'sedang', 'tinggi'),
        P('Sergio Llorca', 4, 'DF', 'banteng', 'sepatu', 1, 'gondrong', 1, 'none', 'gempal', 'tinggi', 'jenggot'),
        P('Pablo Ruano', 10, 'MF', 'keris', 'sepatu', 2, 'keriting', 0, 'none', 'kurus', 'pendek'),
        P('Dani Ollero', 8, 'MF', 'garuda', 'sepatu', 1, 'belah', 1, 'none', 'kurus', 'pendek'),
        P('Alvaro Pena', 9, 'FW', 'meteor', 'sepatu', 1, 'cepak', 0, 'none', 'sedang', 'tinggi'),
        P('Hugo Mairena', 2, 'DF', 'tinju', 'sepatu', 2, 'belah', 0, 'none', 'sedang', 'sedang'),
        P('Rodrigo Abad', 6, 'MF', 'macan', 'sepatu', 1, 'cepak', 0, 'none', 'sedang', 'tinggi', 'brewok'),
        P('Marcos Vela', 3, 'DF', 'banteng', 'sepatu', 2, 'botak', 0, 'none', 'gempal', 'tinggi'),
        P('Jordi Trias', 5, 'DF', 'tinju', 'sepatu', 1, 'kuncir', 1, 'none', 'sedang', 'tinggi'),
        P('Quim Soler', 7, 'MF', 'beliung', 'sepatu', 2, 'gondrong', 0, 'bandana', 'kurus', 'pendek'),
        P('Adri Cano', 11, 'FW', 'macan', 'sepatu', 3, 'mohawk', 0, 'none', 'kurus', 'sedang'),
        P('Unai Ferrer', 12, 'MF', 'naga', 'sepatu', 1, 'belah', 1, 'none', 'kurus', 'sedang'),
        P('Pau Arnedo', 13, 'DF', 'banteng', 'sepatu', 1, 'cepak', 1, 'none', 'gempal', 'tinggi'),
        P('Nacho Ortiz', 14, 'FW', 'garuda', 'sepatu', 2, 'gondrong', 0, 'none', 'sedang', 'sedang', 'kumis'),
        P('Mikel Ibarguen', 15, 'MF', 'keris', 'sepatu', 1, 'cepak', 0, 'none', 'kurus', 'pendek'),
        P('Raul Bastida', 16, 'FW', 'meteor', 'sepatu', 2, 'kuncir', 0, 'none', 'sedang', 'tinggi')] }),
    W({ name: 'Ksatria Kabut', short: 'KSK', c1: '#f8f9fa', c2: '#0d1b2a', gk: '#ffb703', outfit: 'jersey', pattern: 'datar', bottom: 'pendek', tactic: 'serang',
      desc: 'Pressing tanpa henti di bawah gerimis. Bintangnya Jack Whitlow: gelandang serba bisa yang hobi mencetak gol di menit terakhir.',
      players: [G('Sam Pickering', 1, 'karang', 0, 'cepak', 1, 'none', 'gempal', 'tinggi'),
        P('Harry Colborne', 5, 'DF', 'banteng', 'sepatu', 0, 'cepak', 1, 'none', 'gempal', 'tinggi'),
        P('Jack Whitlow', 10, 'MF', 'garuda', 'sepatu', 0, 'belah', 1, 'none', 'sedang', 'sedang'),
        P('Tobi Ansah', 7, 'MF', 'macan', 'sepatu', 4, 'cepak', 0, 'none', 'kurus', 'sedang'),
        P('Ollie Stannard', 9, 'FW', 'meteor', 'sepatu', 0, 'cepak', 0, 'none', 'gempal', 'tinggi'),
        P('Reece Hartley', 2, 'DF', 'tinju', 'sepatu', 1, 'belah', 0, 'none', 'sedang', 'sedang'),
        P('Liam Moss', 4, 'MF', 'tinju', 'sepatu', 0, 'cepak', 1, 'none', 'gempal', 'tinggi'),
        P('Marc Guthrie', 6, 'DF', 'banteng', 'sepatu', 3, 'botak', 0, 'none', 'gempal', 'tinggi'),
        P('Kyle Brennan', 3, 'DF', 'tinju', 'sepatu', 5, 'keriting', 0, 'none', 'sedang', 'tinggi'),
        P('Alfie Palfrey', 20, 'MF', 'keris', 'sepatu', 0, 'gondrong', 2, 'none', 'kurus', 'sedang'),
        P('Ryan Dunmore', 11, 'FW', 'beliung', 'sepatu', 4, 'mohawk', 0, 'none', 'sedang', 'sedang'),
        P('Phil Ashdown', 12, 'MF', 'beliung', 'sepatu', 0, 'keriting', 3, 'none', 'kurus', 'pendek'),
        P('Jamie Calder', 13, 'DF', 'garuda', 'sepatu', 3, 'kuncir', 0, 'none', 'sedang', 'tinggi'),
        P('Eddie Thorne', 14, 'FW', 'naga', 'sepatu', 1, 'cepak', 0, 'none', 'sedang', 'tinggi', 'jenggot'),
        P('Conor Pryce', 15, 'MF', 'macan', 'sepatu', 0, 'belah', 0, 'none', 'sedang', 'sedang'),
        P('Ben Wakely', 16, 'DF', 'banteng', 'sepatu', 1, 'cepak', 2, 'none', 'gempal', 'tinggi', 'brewok')] }),
    W({ name: 'Singa Sabana', short: 'SSB', c1: '#2d6a4f', c2: '#f77f00', gk: '#ffd60a', outfit: 'jersey', pattern: 'selempang', bottom: 'pendek', tactic: 'serang',
      desc: 'Cepat, kuat, dan tak kenal lelah. Bintangnya Kwame Diallo: sayap secepat kilat yang larinya jadi meme di mana-mana.',
      players: [G('Youssef Belkadi', 1, 'harimau', 4, 'cepak', 0, 'none', 'sedang', 'tinggi'),
        P('Abdou Ndour', 4, 'DF', 'banteng', 'sepatu', 5, 'botak', 0, 'none', 'gempal', 'tinggi'),
        P('Kwame Diallo', 7, 'FW', 'macan', 'sepatu', 5, 'keriting', 0, 'none', 'kurus', 'sedang'),
        P('Amadou Toure', 8, 'MF', 'beliung', 'sepatu', 5, 'kuncir', 0, 'none', 'sedang', 'tinggi'),
        P('Chidi Obi', 9, 'FW', 'meteor', 'sepatu', 5, 'mohawk', 3, 'none', 'gempal', 'tinggi'),
        P('Issa Kamara', 2, 'DF', 'tinju', 'sepatu', 4, 'cepak', 0, 'none', 'sedang', 'tinggi'),
        P('Thomas Mensah', 6, 'MF', 'tinju', 'sepatu', 5, 'cepak', 0, 'none', 'gempal', 'tinggi'),
        P('Boubacar Dembaye', 3, 'DF', 'banteng', 'sepatu', 5, 'keriting', 0, 'none', 'gempal', 'tinggi', 'jenggot'),
        P('Nabil Benali', 5, 'DF', 'garuda', 'sepatu', 3, 'belah', 0, 'none', 'kurus', 'sedang'),
        P('Ibou Sene', 10, 'MF', 'keris', 'sepatu', 5, 'gondrong', 0, 'bandana', 'kurus', 'sedang'),
        P('Musa Adeyemi', 11, 'FW', 'naga', 'nyeker', 4, 'keriting', 2, 'none', 'kurus', 'tinggi'),
        P('Femi Balogun', 12, 'MF', 'macan', 'sepatu', 5, 'botak', 0, 'none', 'sedang', 'sedang'),
        P('Cheikh Fall', 13, 'DF', 'banteng', 'sepatu', 5, 'cepak', 0, 'none', 'gempal', 'tinggi'),
        P('Joel Asante', 14, 'FW', 'garuda', 'sepatu', 4, 'mohawk', 0, 'none', 'sedang', 'sedang'),
        P('Omar Sylla', 15, 'MF', 'beliung', 'sepatu', 5, 'kuncir', 0, 'ikat', 'kurus', 'sedang'),
        P('Kofi Agyei', 16, 'DF', 'tinju', 'sepatu', 4, 'cepak', 0, 'none', 'gempal', 'sedang', 'brewok')] }),
    W({ name: 'Sakura Kilat', short: 'SKK', c1: '#ffafcc', c2: '#1d3557', gk: '#06d6a0', outfit: 'jersey', pattern: 'belah', bottom: 'pendek', tactic: 'seimbang',
      desc: 'Umpan satu-dua secepat kereta peluru dan disiplin sampai menit akhir. Bintangnya Haruto Kanzaki: penggiring bola yang triknya ditonton jutaan kali.',
      players: [G('Daiki Tsuruga', 1, 'angin', 1, 'cepak', 0, 'none', 'sedang', 'tinggi'),
        P('Ko Nagase', 4, 'DF', 'banteng', 'sepatu', 1, 'belah', 0, 'none', 'gempal', 'tinggi'),
        P('Haruto Kanzaki', 7, 'FW', 'keris', 'sepatu', 1, 'belah', 1, 'none', 'kurus', 'pendek'),
        P('Riku Tanabe', 8, 'MF', 'beliung', 'sepatu', 1, 'cepak', 0, 'none', 'kurus', 'sedang'),
        P('Sora Miyazaki', 9, 'FW', 'meteor', 'sepatu', 1, 'mohawk', 3, 'none', 'sedang', 'sedang'),
        P('Kenta Hayashi', 2, 'DF', 'tinju', 'sepatu', 1, 'cepak', 0, 'none', 'sedang', 'sedang'),
        P('Yuma Endo', 6, 'MF', 'macan', 'sepatu', 1, 'belah', 0, 'none', 'sedang', 'sedang', 'kacamata'),
        P('Takumi Morioka', 3, 'DF', 'banteng', 'sepatu', 1, 'cepak', 0, 'none', 'gempal', 'tinggi'),
        P('Shun Yoshida', 5, 'DF', 'tinju', 'sepatu', 1, 'gondrong', 0, 'ikat', 'sedang', 'tinggi'),
        P('Ren Kubota', 10, 'MF', 'garuda', 'sepatu', 1, 'keriting', 1, 'none', 'kurus', 'pendek'),
        P('Kaoru Shimizu', 11, 'FW', 'macan', 'sepatu', 1, 'belah', 2, 'none', 'kurus', 'sedang'),
        P('Hiro Sakamoto', 12, 'MF', 'keris', 'sepatu', 1, 'cepak', 1, 'none', 'kurus', 'pendek'),
        P('Taiga Ono', 13, 'DF', 'banteng', 'sepatu', 1, 'botak', 0, 'none', 'gempal', 'tinggi'),
        P('Kaito Fujii', 14, 'FW', 'naga', 'sepatu', 1, 'kuncir', 0, 'none', 'sedang', 'tinggi'),
        P('Yuki Nakano', 15, 'MF', 'beliung', 'sepatu', 1, 'mohawk', 0, 'bandana', 'kurus', 'sedang'),
        P('Sho Ishikawa', 16, 'DF', 'tinju', 'sepatu', 1, 'cepak', 0, 'none', 'sedang', 'tinggi')] }),
    W({ name: 'Benteng Romawi', short: 'BRW', c1: '#1e6091', c2: '#f1faee', gk: '#2b2d42', outfit: 'jersey', pattern: 'polos', bottom: 'pendek', tactic: 'bertahan',
      desc: 'Pertahanan rapat seperti tembok kota tua, lalu menusuk lewat serangan balik. Bintangnya Matteo Bellandi: bek tampan yang tekelnya selalu bersih.',
      players: [G('Gino Montanari', 1, 'karang', 1, 'gondrong', 1, 'none', 'gempal', 'tinggi', 'brewok'),
        P('Matteo Bellandi', 4, 'DF', 'banteng', 'sepatu', 1, 'belah', 0, 'none', 'gempal', 'tinggi'),
        P('Lorenzo Pellicano', 8, 'MF', 'garuda', 'sepatu', 1, 'cepak', 0, 'none', 'sedang', 'sedang'),
        P('Federico Chiaretti', 7, 'MF', 'macan', 'sepatu', 1, 'gondrong', 1, 'ikat', 'kurus', 'sedang'),
        P('Ciro Lombardo', 9, 'FW', 'meteor', 'sepatu', 2, 'cepak', 0, 'none', 'sedang', 'sedang'),
        P('Alessio Bastone', 2, 'DF', 'tinju', 'sepatu', 1, 'cepak', 0, 'none', 'gempal', 'tinggi', 'jenggot'),
        P('Nicolo Barbieri', 6, 'MF', 'tinju', 'sepatu', 1, 'belah', 1, 'none', 'sedang', 'tinggi'),
        P('Giorgio Bastiani', 3, 'DF', 'banteng', 'sepatu', 2, 'botak', 0, 'none', 'gempal', 'tinggi'),
        P('Andrea Rinaldi', 5, 'DF', 'tinju', 'sepatu', 1, 'kuncir', 1, 'none', 'sedang', 'tinggi', 'brewok'),
        P('Sandro Tonelli', 10, 'MF', 'keris', 'sepatu', 1, 'gondrong', 0, 'none', 'kurus', 'sedang'),
        P('Davide Frattini', 11, 'FW', 'naga', 'sepatu', 2, 'mohawk', 0, 'none', 'sedang', 'tinggi'),
        P('Paolo Mancuso', 12, 'MF', 'beliung', 'sepatu', 1, 'keriting', 1, 'none', 'kurus', 'pendek'),
        P('Fabio Gentile', 13, 'DF', 'banteng', 'sepatu', 1, 'cepak', 0, 'none', 'gempal', 'tinggi'),
        P('Marco Vietti', 14, 'FW', 'garuda', 'sepatu', 1, 'gondrong', 1, 'bandana', 'sedang', 'tinggi', 'kumis'),
        P('Luca Ranieri', 15, 'MF', 'macan', 'sepatu', 2, 'belah', 0, 'none', 'sedang', 'sedang'),
        P('Pietro Zanetti', 16, 'DF', 'tinju', 'sepatu', 1, 'cepak', 4, 'none', 'gempal', 'tinggi')] })
  ];

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
