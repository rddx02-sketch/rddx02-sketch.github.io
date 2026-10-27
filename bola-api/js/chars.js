/* Bola Api Arena — warga kampung detail.
   Satu SkinnedMesh per pemain (satu tarikan gambar), kerangka 22 tulang, tekstur atlas (wajah, jersey bernomor & bernama,
   celana, kaos kaki, sepatu, sarung tangan kiper), rambut & aksesori 3D, animasi prosedural berbasis langkah:
   jalan / lari / sprint / giring / langkah samping / mundur, tendang & umpan, tekel & sliding, kiper siaga / tangkap /
   terbang / lempar / tendang lambung, lemparan ke dalam, selebrasi, kecewa, dan jurus silat untuk adegan. */
(function (root) {
  'use strict';
  var BA = root.BA, U = BA.U, D = BA.D, R3 = BA.R3;
  var THREE = root.THREE;
  var Chars = BA.Chars = {};
  var TAU = Math.PI * 2;

  /* ======================================================================
     1. ATLAS TEKSTUR
     ====================================================================== */
  /* daerah atlas: x, y, w, h dalam piksel pada kanvas 512 */
  var REG = {
    torso: [0, 0, 256, 192], arm: [256, 0, 64, 192], thigh: [320, 0, 64, 192], shin: [384, 0, 64, 192],
    fore: [448, 0, 32, 192], hand: [480, 0, 32, 96], neck: [480, 96, 32, 96],
    face: [0, 192, 160, 160], head: [160, 192, 64, 64], hair: [224, 192, 96, 96], shoe: [320, 192, 96, 64],
    sole: [416, 192, 96, 32], acc1: [416, 224, 96, 32], acc2: [160, 256, 64, 48], dark: [160, 304, 64, 48],
    foot: [320, 256, 64, 48], strap: [384, 256, 32, 48], white: [416, 256, 96, 48], skirt: [0, 352, 256, 160], pants: [256, 352, 128, 160],
    metal: [384, 352, 64, 80], glow: [448, 352, 64, 40], fur: [448, 392, 64, 40], acc3: [384, 432, 128, 80], kafan: [224, 288, 96, 64]
  };
  var PAD = 3;
  function uvOf(reg, u, v) {
    var r = REG[reg];
    var x = r[0] + PAD + U.clamp(u, 0, 1) * (r[2] - 2 * PAD);
    var y = r[1] + PAD + (1 - U.clamp(v, 0, 1)) * (r[3] - 2 * PAD);
    return [x / 512, 1 - y / 512];
  }
  /* proyeksi wajah: kepala lokal (x,y) -> uv daerah wajah */
  var FACE_HW = 0.108, FACE_HH = 0.13;
  function faceUV(x, y) { return uvOf('face', 0.5 + x / (2 * FACE_HW), 0.5 + y / (2 * FACE_HH)); }

  var SPONSORS = ['WARUNG BU TINI', 'BENGKEL JAYA', 'PECEL LELE CAK MAN', 'BAKSO MAS JOKO', 'TOKO ABADI', 'KOPI TUBRUK', 'LAUNDRY KILAT', 'SOTO PAK GENDUT', 'MIE AYAM BAROKAH', 'PULSA MURAH', 'SATE MADURA', 'ES DAWET AYU'];
  function hashStr(s) { var h = 2166136261; s = String(s); for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }

  function outfitInfo(pc, team) {
    var isGK = pc.role === 'GK';
    var c1 = isGK ? team.gk : team.c1;
    var c2 = isGK ? U.mixHex(team.gk, '#000000', 0.42) : team.c2;
    if (D.colorDist && D.colorDist(c1, c2) < 60) c2 = U.lum(c1) > 0.5 ? U.mixHex(c1, '#000000', 0.5) : U.mixHex(c1, '#ffffff', 0.55);
    var shorts = isGK ? '#23232b' : team.c2;
    if (U.lum(shorts) > 0.85 && U.lum(c1) > 0.85) shorts = '#2a3a55';
    var bottom = pc.bottom || team.bottom || 'pendek';
    if (isGK && bottom === 'sarung') bottom = 'training';
    var outfit = isGK ? 'jersey' : (team.outfit || 'jersey');
    var foot = pc.foot || 'sepatu';
    var shoe = isGK ? '#141414' : (U.lum(team.c1) > 0.75 ? '#1b1b1b' : U.mixHex(team.c1, '#000000', 0.32));
    var sock = (foot === 'sepatu') ? (isGK ? U.mixHex(team.gk, '#000000', 0.2) : (outfit === 'jersey' ? team.c2 : '#f0f0f0')) : null;
    var info = { isGK: isGK, c1: c1, c2: c2, shorts: shorts, bottom: bottom, outfit: outfit, foot: foot, shoe: shoe, sock: sock,
      pattern: isGK ? 'datar' : (outfit === 'jersey' ? (team.pattern || 'polos') : 'polos'), longSleeve: isGK };
    Looks.applyInfo(info, pc, team);
    return info;
  }

  function paintAtlas(size, pc, team, info) {
    var k = size / 512;
    return R3.canvasTex(size, size, function (x) {
      x.save(); x.scale(k, k);
      var skin = pc.skinColor || D.SKINS[U.idx(pc.skin, D.SKINS.length, 2)];
      var skinD = U.mixHex(skin, '#000000', 0.18), skinL = U.mixHex(skin, '#ffffff', 0.1);
      var hairC = pc.hairColor || (D.HAIR_COLORS[U.idx(pc.hairC, D.HAIR_COLORS.length, 0)] || D.HAIR_COLORS[0]).c;
      function R(n) { return REG[n]; }
      function fill(n, col) { var r = R(n); x.fillStyle = col; x.fillRect(r[0], r[1], r[2], r[3]); }
      function grad(n, a, b) { var r = R(n); var g = x.createLinearGradient(0, r[1], 0, r[1] + r[3]); g.addColorStop(0, a); g.addColorStop(1, b); x.fillStyle = g; x.fillRect(r[0], r[1], r[2], r[3]); }
      function noise(n, col, cnt, sz, alpha) {
        var r = R(n), rnd = U.rng(hashStr(n + pc.name));
        x.fillStyle = col; x.globalAlpha = alpha;
        for (var i = 0; i < cnt; i++) x.fillRect(r[0] + rnd() * r[2], r[1] + rnd() * r[3], sz * (0.5 + rnd()), sz * (0.5 + rnd()));
        x.globalAlpha = 1;
      }
      // ---------- baju (badan) ----------
      var tr = R('torso'), TX = tr[0], TY = tr[1], TW = tr[2], TH = tr[3];
      var vHem = 0.135; // batas bawah baju (di bawahnya celana)
      function ty(v) { return TY + (1 - v) * TH; }
      function tx(u) { return TX + u * TW; }
      x.fillStyle = info.c1; x.fillRect(TX, TY, TW, ty(vHem) - TY);
      // pola
      x.fillStyle = info.c2;
      var shirtTop = ty(1), shirtBot = ty(vHem);
      if (info.pattern === 'tegak') { for (var i = 0; i < 12; i++) if (i % 2) x.fillRect(tx(i / 12), shirtTop, TW / 12, shirtBot - shirtTop); }
      else if (info.pattern === 'datar') { for (var j = 0; j < 9; j++) if (j % 2) x.fillRect(TX, shirtTop + j * (shirtBot - shirtTop) / 9, TW, (shirtBot - shirtTop) / 9); }
      else if (info.pattern === 'belah') { x.fillRect(tx(0.5), shirtTop, TW * 0.25, shirtBot - shirtTop); x.fillRect(tx(0), shirtTop, TW * 0.25, shirtBot - shirtTop); }
      else if (info.pattern === 'selempang') {
        [0.25, 0.75].forEach(function (cu) {
          x.save(); x.beginPath(); x.rect(TX, shirtTop, TW, shirtBot - shirtTop); x.clip();
          x.translate(tx(cu), (shirtTop + shirtBot) / 2); x.rotate(cu < 0.5 ? -0.55 : 0.55);
          x.fillRect(-TW * 0.04, -TH, TW * 0.08, TH * 2); x.restore();
        });
      }
      if (info.isGK) { x.globalAlpha = 0.18; x.fillStyle = '#000'; for (var g2 = 0; g2 < 14; g2++) x.fillRect(TX, shirtTop + g2 * 12, TW, 4); x.globalAlpha = 1; }
      // kerutan kain halus
      x.globalAlpha = 0.07; x.fillStyle = '#000';
      for (var f = 0; f < 18; f++) { x.beginPath(); x.ellipse(tx((f * 0.137) % 1), ty(0.2 + (f % 5) * 0.14), 10, 2, 0.3, 0, TAU); x.fill(); }
      x.globalAlpha = 1;
      // kerah (V di depan) & lis bawah
      x.fillStyle = info.c2 === info.c1 ? U.mixHex(info.c1, '#000', 0.3) : info.c2;
      x.fillRect(TX, ty(1), TW, 7);
      if (info.outfit === 'jersey') {
        x.beginPath(); x.moveTo(tx(0.25) - 18, ty(1)); x.lineTo(tx(0.25), ty(0.9)); x.lineTo(tx(0.25) + 18, ty(1)); x.lineTo(tx(0.25) + 12, ty(1)); x.lineTo(tx(0.25), ty(0.935)); x.lineTo(tx(0.25) - 12, ty(1)); x.closePath(); x.fill();
      }
      x.fillStyle = U.mixHex(info.c1, '#000000', 0.25); x.fillRect(TX, ty(vHem) - 5, TW, 5);
      // singlet: bahu & ketiak terbuka
      if (info.outfit === 'singlet') {
        x.fillStyle = skin;
        [0, 0.5, 1].forEach(function (cu) { x.beginPath(); x.ellipse(tx(cu), ty(0.98), TW * 0.11, TH * 0.24, 0, 0, TAU); x.fill(); });
        x.fillStyle = info.c2; x.fillRect(tx(0.13), ty(1), TW * 0.24, 5); x.fillRect(tx(0.63), ty(1), TW * 0.24, 5);
      }
      // nama & nomor punggung
      var num = String(U.clamp(pc.num | 0, 0, 99));
      var nfg = info.isGK ? '#ffffff' : (info.outfit === 'jersey' ? (U.lum(info.c1) > 0.6 ? info.c2 : '#ffffff') : '#ffffff');
      if (D.colorDist && D.colorDist(nfg, info.c1) < 120) nfg = U.lum(info.c1) > 0.55 ? '#1b1b1b' : '#ffffff';
      var nst = U.lum(nfg) > 0.5 ? 'rgba(0,0,0,0.55)' : 'rgba(255,255,255,0.6)';
      x.textAlign = 'center'; x.textBaseline = 'middle';
      x.font = 'bold 64px Bungee, Impact, "Arial Black", sans-serif';
      x.lineWidth = 6; x.strokeStyle = nst; x.strokeText(num, tx(0.75), ty(0.57));
      x.fillStyle = nfg; x.fillText(num, tx(0.75), ty(0.57));
      x.font = 'bold 15px "Barlow Semi Condensed", "Arial Narrow", sans-serif';
      x.fillText(String(pc.name || '').toUpperCase().slice(0, 12), tx(0.75), ty(0.86));
      // depan: logo tim, nomor kecil, sponsor kampung
      x.fillStyle = info.c2; x.beginPath(); x.arc(tx(0.32), ty(0.77), 9, 0, TAU); x.fill();
      x.fillStyle = info.c1; x.font = 'bold 9px Bungee, Impact, sans-serif'; x.fillText((team.short || 'TIM').slice(0, 1), tx(0.32), ty(0.77) + 1);
      x.fillStyle = nfg; x.font = 'bold 18px Bungee, Impact, sans-serif'; x.fillText(num, tx(0.18), ty(0.77));
      if (!info.isGK || true) {
        var sp = SPONSORS[hashStr(team.name || 'x') % SPONSORS.length];
        x.font = 'bold 12px "Barlow Semi Condensed", "Arial Narrow", sans-serif';
        x.fillStyle = U.lum(info.c1) > 0.6 ? 'rgba(20,20,20,0.85)' : 'rgba(255,255,255,0.9)';
        x.fillText(sp, tx(0.25), ty(0.58));
      }
      if (info.outfit === 'kaos') {
        // sablon api di dada
        x.fillStyle = info.c2; var cx = tx(0.25), cy = ty(0.42);
        x.beginPath(); x.moveTo(cx - 12, cy + 16); x.quadraticCurveTo(cx - 16, cy - 4, cx - 4, cy - 20); x.quadraticCurveTo(cx - 2, cy - 6, cx + 4, cy - 12);
        x.quadraticCurveTo(cx + 18, cy + 2, cx + 10, cy + 16); x.closePath(); x.fill();
      }
      // celana (bagian bawah badan)
      var bcol = info.bottom === 'training' ? '#1f2233' : info.shorts;
      x.fillStyle = bcol; x.fillRect(TX, ty(vHem), TW, TY + TH - ty(vHem));
      x.fillStyle = info.c1; x.fillRect(tx(0.5) - 3, ty(vHem), 6, TY + TH - ty(vHem)); x.fillRect(tx(0) , ty(vHem), 3, TY + TH - ty(vHem)); x.fillRect(tx(1) - 3, ty(vHem), 3, TY + TH - ty(vHem));
      // ---------- lengan atas (lengan baju + kulit) ----------
      var ar = R('arm'), sleeveEnd = info.outfit === 'singlet' ? 1.02 : 0.47;
      x.fillStyle = skin; x.fillRect(ar[0], ar[1], ar[2], ar[3]);
      if (info.longSleeve) { x.fillStyle = info.c1; x.fillRect(ar[0], ar[1], ar[2], ar[3]); x.fillStyle = info.c2; x.fillRect(ar[0], ar[1] + ar[3] * 0.5, ar[2], 6); }
      else if (info.outfit !== 'singlet') {
        x.fillStyle = info.c1; x.fillRect(ar[0], ar[1], ar[2], ar[3] * sleeveEnd);
        if (info.pattern === 'tegak') { x.fillStyle = info.c2; for (var a2 = 0; a2 < 4; a2++) if (a2 % 2) x.fillRect(ar[0] + a2 * ar[2] / 4, ar[1], ar[2] / 4, ar[3] * sleeveEnd); }
        x.fillStyle = info.c2; x.fillRect(ar[0], ar[1] + ar[3] * sleeveEnd - 7, ar[2], 7);
      }
      // ---------- lengan bawah ----------
      var fo = R('fore');
      grad('fore', skinL, skin);
      if (info.longSleeve) { x.fillStyle = info.c1; x.fillRect(fo[0], fo[1], fo[2], fo[3] * 0.85); x.fillStyle = info.c2; x.fillRect(fo[0], fo[1] + fo[3] * 0.85 - 8, fo[2], 8); }
      // tangan / sarung tangan kiper
      if (info.isGK) {
        var hr = R('hand'); x.fillStyle = '#f2f2ee'; x.fillRect(hr[0], hr[1], hr[2], hr[3]);
        x.fillStyle = info.c1; x.fillRect(hr[0], hr[1], hr[2], hr[3] * 0.35); x.fillStyle = '#2b2b2b'; x.fillRect(hr[0], hr[1] + hr[3] * 0.62, hr[2], 5);
      } else fill('hand', skin);
      grad('neck', skinD, skin);
      // ---------- paha ----------
      var th = R('thigh'), hemV = 0.5;
      grad('thigh', skin, skinD);
      if (info.bottom === 'training') { x.fillStyle = '#1f2233'; x.fillRect(th[0], th[1], th[2], th[3]); x.fillStyle = '#ffffff'; x.fillRect(th[0] + th[2] / 2 - 2, th[1], 4, th[3]); }
      else if (info.bottom !== 'sarung') {
        x.fillStyle = info.shorts; x.fillRect(th[0], th[1], th[2], th[3] * hemV);
        x.fillStyle = info.c1; x.fillRect(th[0] + th[2] / 2 - 3, th[1], 6, th[3] * hemV);
        x.fillStyle = U.mixHex(info.shorts, '#000000', 0.3); x.fillRect(th[0], th[1] + th[3] * hemV - 5, th[2], 5);
      }
      // ---------- betis + kaos kaki ----------
      var sh = R('shin');
      grad('shin', skin, skinD);
      if (info.bottom === 'training') { x.fillStyle = '#1f2233'; x.fillRect(sh[0], sh[1], sh[2], sh[3]); x.fillStyle = '#ffffff'; x.fillRect(sh[0] + sh[2] / 2 - 2, sh[1], 4, sh[3]); }
      else if (info.sock) {
        var sockTop = sh[1] + sh[3] * 0.24;
        x.fillStyle = info.sock; x.fillRect(sh[0], sockTop, sh[2], sh[1] + sh[3] - sockTop);
        x.fillStyle = info.isGK ? '#111' : info.c1; x.fillRect(sh[0], sockTop + 6, sh[2], 6); x.fillRect(sh[0], sockTop + 16, sh[2], 3);
        x.globalAlpha = 0.12; x.fillStyle = '#000'; for (var r3 = 0; r3 < 6; r3++) x.fillRect(sh[0], sockTop + 26 + r3 * 18, sh[2], 2); x.globalAlpha = 1;
      }
      // ---------- wajah ----------
      paintFace(x, pc, skin, skinD, skinL, hairC);
      // kepala belakang & rambut
      grad('head', skinL, skin);
      if (pc.hair === 'cepak' || pc.hair === 'mohawk' || pc.hair === 'botak') noise('head', hairC, pc.hair === 'botak' ? 40 : 260, 1.4, pc.hair === 'botak' ? 0.08 : 0.35);
      fill('hair', hairC);
      var hrR = R('hair'), hl = U.mixHex(hairC, '#ffffff', 0.22), hd = U.mixHex(hairC, '#000000', 0.35);
      for (var s2 = 0; s2 < 90; s2++) { x.strokeStyle = s2 % 3 ? hd : hl; x.globalAlpha = 0.35; x.lineWidth = 1; x.beginPath(); var sx = hrR[0] + ((s2 * 37) % 96), sy = hrR[1] + ((s2 * 53) % 96); x.moveTo(sx, sy); x.lineTo(sx + 3, sy + 14); x.stroke(); }
      x.globalAlpha = 1;
      // sepatu, sol, kaki telanjang, tali sandal
      var so = R('shoe');
      x.fillStyle = info.shoe; x.fillRect(so[0], so[1], so[2], so[3]);
      var stripe = U.lum(info.shoe) < 0.3 ? '#f2f2f2' : '#1b1b1b';
      x.fillStyle = stripe; for (var st2 = 0; st2 < 3; st2++) { x.save(); x.translate(so[0] + 30 + st2 * 12, so[1] + so[3] * 0.5); x.rotate(0.5); x.fillRect(-3, -16, 6, 32); x.restore(); }
      x.fillStyle = U.mixHex(info.shoe, '#000000', 0.35); x.fillRect(so[0] + so[2] * 0.78, so[1], so[2] * 0.22, so[3]);
      fill('sole', info.isGK ? '#e8e8e8' : '#efefef');
      var sl = R('sole'); x.fillStyle = '#9a9a9a'; for (var st3 = 0; st3 < 8; st3++) x.fillRect(sl[0] + 6 + st3 * 11, sl[1] + 10, 4, 4);
      grad('foot', skin, skinD);
      var ft = R('foot'); x.fillStyle = skinD; for (var tn = 0; tn < 5; tn++) x.fillRect(ft[0] + 8 + tn * 10, ft[1] + 4, 6, 4);
      var sCol = ['#2b6cb0', '#e53e3e', '#38a169', '#1a1a1a'][U.idx(pc.num, 4, 0) % 4];
      fill('strap', sCol);
      // aksesori kepala, warna gelap (kacamata), putih (mata sclera kacamata), sarung, celana training
      fill('acc1', pc.head === 'ikat' ? '#d62828' : (pc.head === 'caping' ? '#d9b56c' : (pc.head === 'kupluk' ? '#2b2b33' : team.c1)));
      if (pc.head === 'caping') noise('acc1', '#a8843f', 60, 2, 0.6);
      if (pc.head === 'kupluk') { var a1 = R('acc1'); x.fillStyle = '#4a4a55'; for (var kb = 0; kb < 6; kb++) x.fillRect(a1[0] + kb * 16, a1[1], 8, a1[3]); }
      fill('acc2', pc.head === 'bandana' ? team.c2 : team.c2);
      if (pc.head === 'bandana') { var a2r = R('acc2'); x.fillStyle = '#ffffff'; for (var bd = 0; bd < 14; bd++) { x.beginPath(); x.arc(a2r[0] + (bd * 23) % 64, a2r[1] + (bd * 17) % 48, 2, 0, TAU); x.fill(); } }
      fill('dark', '#141414');
      fill('white', '#f4f4f0');
      var sk = R('skirt'), dark = U.mixHex(team.c2, '#000000', 0.35), light = U.mixHex(team.c2, '#ffffff', 0.25);
      x.fillStyle = team.c2; x.fillRect(sk[0], sk[1], sk[2], sk[3]);
      x.globalAlpha = 0.55; x.fillStyle = dark;
      for (var q = 0; q < 8; q++) { x.fillRect(sk[0] + q * 32, sk[1], 14, sk[3]); x.fillRect(sk[0], sk[1] + q * 20, sk[2], 9); }
      x.globalAlpha = 0.5; x.fillStyle = light;
      for (q = 0; q < 8; q++) { x.fillRect(sk[0] + q * 32 + 20, sk[1], 3, sk[3]); x.fillRect(sk[0], sk[1] + q * 20 + 13, sk[2], 2); }
      x.globalAlpha = 1;
      x.fillStyle = U.mixHex(team.c2, '#000000', 0.45); x.fillRect(sk[0], sk[1], sk[2], 10);
      fill('pants', '#1f2233');
      fill('metal', '#8d99ae'); fill('glow', '#ffffff'); fill('fur', hairC); fill('acc3', '#f4f4f0'); fill('kafan', '#e9e4d6');
      Looks.paint(x, pc, team, info, { R: R, fill: fill, grad: grad, noise: noise, tx: tx, ty: ty, skin: skin, skinD: skinD, skinL: skinL, hairC: hairC, vHem: vHem });
      x.restore();
    }, { aniso: true });
  }

  function paintFace(x, pc, skin, skinD, skinL, hairC) {
    var r = REG.face, X = r[0] + PAD, Y = r[1] + PAD, W = r[2] - 2 * PAD, H = r[3] - 2 * PAD;
    function P(hx, hy) { return [X + (0.5 + hx / (2 * FACE_HW)) * W, Y + (1 - (0.5 + hy / (2 * FACE_HH))) * H]; }
    // dasar kulit dengan gradasi (dahi terang, rahang lebih gelap)
    var g = x.createLinearGradient(0, r[1], 0, r[1] + r[3]);
    g.addColorStop(0, skinL); g.addColorStop(0.55, skin); g.addColorStop(1, skinD);
    x.fillStyle = g; x.fillRect(r[0], r[1], r[2], r[3]);
    // bayangan rahang & pipi
    x.globalAlpha = 0.18; x.fillStyle = U.mixHex(skin, '#5a2a1a', 0.5);
    [-1, 1].forEach(function (s) { var c = P(s * 0.06, -0.05); x.beginPath(); x.ellipse(c[0], c[1], 12, 18, 0, 0, TAU); x.fill(); });
    x.globalAlpha = 0.12; x.fillStyle = '#d0575a';
    [-1, 1].forEach(function (s) { var c = P(s * 0.05, -0.02); x.beginPath(); x.ellipse(c[0], c[1], 10, 6, 0, 0, TAU); x.fill(); });
    x.globalAlpha = 1;
    var brow = U.mixHex(hairC, '#000000', 0.15);
    [-1, 1].forEach(function (s) {
      var e = P(s * 0.036, 0.012), ew = 9.5, eh = 4.6;
      // kelopak & bola mata
      x.fillStyle = U.mixHex(skin, '#000000', 0.25); x.beginPath(); x.ellipse(e[0], e[1] - 1, ew + 2, eh + 2.4, 0, 0, TAU); x.fill();
      x.fillStyle = '#f5f1ea'; x.beginPath(); x.ellipse(e[0], e[1], ew, eh, 0, 0, TAU); x.fill();
      x.fillStyle = '#4a2b17'; x.beginPath(); x.arc(e[0] + s * 0.6, e[1] + 0.3, 3.9, 0, TAU); x.fill();
      x.fillStyle = '#0d0806'; x.beginPath(); x.arc(e[0] + s * 0.6, e[1] + 0.3, 1.9, 0, TAU); x.fill();
      x.fillStyle = '#ffffff'; x.beginPath(); x.arc(e[0] + s * 0.6 + 1.4, e[1] - 1.2, 1.1, 0, TAU); x.fill();
      x.strokeStyle = '#1f130d'; x.lineWidth = 1.8; x.beginPath(); x.ellipse(e[0], e[1] + 0.6, ew + 0.3, eh + 0.8, 0, Math.PI * 1.05, Math.PI * 1.95); x.stroke();
      // alis
      var b = P(s * 0.037, 0.04);
      x.strokeStyle = brow; x.lineWidth = 3.4; x.lineCap = 'round';
      x.beginPath(); x.moveTo(b[0] - s * 11, b[1] + 1.5); x.quadraticCurveTo(b[0], b[1] - 3.2, b[0] + s * 10, b[1] + 0.5); x.stroke();
    });
    // hidung
    var n0 = P(0, 0.005), n1 = P(0, -0.03);
    x.strokeStyle = U.mixHex(skin, '#3a1a0a', 0.35); x.lineWidth = 1.6; x.globalAlpha = 0.6;
    x.beginPath(); x.moveTo(n0[0] + 3, n0[1]); x.quadraticCurveTo(n1[0] + 6, n1[1] - 4, n1[0] + 4, n1[1]); x.stroke();
    x.globalAlpha = 0.7; x.fillStyle = U.mixHex(skin, '#2a0f05', 0.5);
    [-1, 1].forEach(function (s) { x.beginPath(); x.ellipse(n1[0] + s * 4.5, n1[1] + 1, 2.4, 1.5, 0, 0, TAU); x.fill(); });
    x.globalAlpha = 1;
    // mulut
    var m = P(0, -0.058);
    x.fillStyle = U.mixHex(skin, '#7a2a2a', 0.45); x.beginPath(); x.ellipse(m[0], m[1] + 2, 13, 4, 0, 0, Math.PI); x.fill();
    x.strokeStyle = U.mixHex(skin, '#3a0a0a', 0.6); x.lineWidth = 2;
    x.beginPath(); x.moveTo(m[0] - 14, m[1] - 1); x.quadraticCurveTo(m[0], m[1] + 3.5, m[0] + 14, m[1] - 1); x.stroke();
    // rambut wajah
    var hc = hairC;
    if (pc.face === 'kumis') {
      x.fillStyle = hc; x.beginPath(); x.moveTo(m[0] - 17, m[1] + 1); x.quadraticCurveTo(m[0] - 8, m[1] - 10, m[0], m[1] - 5); x.quadraticCurveTo(m[0] + 8, m[1] - 10, m[0] + 17, m[1] + 1);
      x.quadraticCurveTo(m[0] + 8, m[1] - 3, m[0], m[1] - 2); x.quadraticCurveTo(m[0] - 8, m[1] - 3, m[0] - 17, m[1] + 1); x.fill();
    } else if (pc.face === 'brewok' || pc.face === 'jenggot') {
      var rnd = U.rng(hashStr(pc.name + 'jg'));
      x.fillStyle = hc;
      var n = pc.face === 'brewok' ? 900 : 380;
      for (var i = 0; i < n; i++) {
        var hx = (rnd() - 0.5) * 0.2, hy = -0.02 - rnd() * 0.11;
        if (pc.face === 'jenggot' && Math.abs(hx) > 0.035) continue;
        if (Math.abs(hx) < 0.022 && hy > -0.07 && hy < -0.045) continue; // bibir
        var dd = hx * hx / 0.01 + (hy + 0.03) * (hy + 0.03) / 0.012;
        if (pc.face === 'brewok' && dd < 0.25 && hy > -0.04) continue;
        var pp = P(hx, hy); x.globalAlpha = 0.55; x.fillRect(pp[0], pp[1], 1.6, 2.6);
      }
      x.globalAlpha = 1;
    }
    // garis rambut di dahi
    x.fillStyle = hairC; x.globalAlpha = (pc.hair === 'botak') ? 0 : 0.9;
    var t0 = P(0, FACE_HH * 0.98);
    x.fillRect(r[0], r[1], r[2], Math.max(0, t0[1] - r[1] + 6));
    x.globalAlpha = 1;
  }

  /* ======================================================================
     2. PEMBANGUN GEOMETRI
     ====================================================================== */
  function GB() { this.p = []; this.n = []; this.uv = []; this.si = []; this.sw = []; this.ix = []; }
  GB.prototype.count = function () { return this.p.length / 3; };
  GB.prototype.v = function (x, y, z, uv, w) {
    this.p.push(x, y, z); this.n.push(0, 0, 0); this.uv.push(uv[0], uv[1]);
    var b0 = w[0][0], w0 = w[0][1], b1 = w.length > 1 ? w[1][0] : 0, w1 = w.length > 1 ? w[1][1] : 0;
    var t = w0 + w1 || 1;
    this.si.push(b0, b1, 0, 0); this.sw.push(w0 / t, w1 / t, 0, 0);
    return this.p.length / 3 - 1;
  };
  GB.prototype.t = function (a, b, c) { this.ix.push(a, b, c); };
  /* normal halus per bagian: akumulasi normal muka + gabung titik yang posisinya sama (sambungan uv) */
  GB.prototype.smooth = function (v0, i0, flipIfInward, center) {
    var p = this.p, n = this.n, ix = this.ix, i, a, b, c;
    if (flipIfInward && ix.length > i0) {
      // pastikan muka menghadap keluar
      var out = 0;
      for (i = i0; i < ix.length; i += 3) {
        a = ix[i] * 3; b = ix[i + 1] * 3; c = ix[i + 2] * 3;
        var e1x = p[b] - p[a], e1y = p[b + 1] - p[a + 1], e1z = p[b + 2] - p[a + 2];
        var e2x = p[c] - p[a], e2y = p[c + 1] - p[a + 1], e2z = p[c + 2] - p[a + 2];
        var nx = e1y * e2z - e1z * e2y, ny = e1z * e2x - e1x * e2z, nz = e1x * e2y - e1y * e2x;
        var cx = (p[a] + p[b] + p[c]) / 3 - center[0], cy = (p[a + 1] + p[b + 1] + p[c + 1]) / 3 - center[1], cz = (p[a + 2] + p[b + 2] + p[c + 2]) / 3 - center[2];
        out += (nx * cx + ny * cy + nz * cz) > 0 ? 1 : -1;
      }
      if (out < 0) for (i = i0; i < ix.length; i += 3) { var tmp = ix[i + 1]; ix[i + 1] = ix[i + 2]; ix[i + 2] = tmp; }
    }
    for (i = i0; i < ix.length; i += 3) {
      a = ix[i] * 3; b = ix[i + 1] * 3; c = ix[i + 2] * 3;
      var ux = p[b] - p[a], uy = p[b + 1] - p[a + 1], uz = p[b + 2] - p[a + 2];
      var vx = p[c] - p[a], vy = p[c + 1] - p[a + 1], vz = p[c + 2] - p[a + 2];
      var fx = uy * vz - uz * vy, fy = uz * vx - ux * vz, fz = ux * vy - uy * vx;
      n[a] += fx; n[a + 1] += fy; n[a + 2] += fz; n[b] += fx; n[b + 1] += fy; n[b + 2] += fz; n[c] += fx; n[c + 1] += fy; n[c + 2] += fz;
    }
    var map = {}, vc = this.count();
    for (i = v0; i < vc; i++) {
      var key = Math.round(p[i * 3] * 2000) + ',' + Math.round(p[i * 3 + 1] * 2000) + ',' + Math.round(p[i * 3 + 2] * 2000);
      (map[key] = map[key] || []).push(i);
    }
    Object.keys(map).forEach(function (k) {
      var l = map[k]; if (l.length < 2) return;
      var sx = 0, sy = 0, sz = 0;
      l.forEach(function (j) { sx += n[j * 3]; sy += n[j * 3 + 1]; sz += n[j * 3 + 2]; });
      l.forEach(function (j) { n[j * 3] = sx; n[j * 3 + 1] = sy; n[j * 3 + 2] = sz; });
    });
    for (i = v0; i < vc; i++) {
      var L = Math.sqrt(n[i * 3] * n[i * 3] + n[i * 3 + 1] * n[i * 3 + 1] + n[i * 3 + 2] * n[i * 3 + 2]) || 1;
      n[i * 3] /= L; n[i * 3 + 1] /= L; n[i * 3 + 2] /= L;
    }
  };

  /* loft: deretan cincin elips di sepanjang sumbu ('y' = tegak, 'z' = mendatar ke depan).
     ring: {a: posisi sepanjang sumbu, rx, ry (lebar & tebal), cx, cy (geser pusat), v (tekstur), w (bobot tulang)}
     opt: {o: titik asal [x,y,z], axis, seg, reg, u0, u1, th0, capA, capB, uvFn} */
  GB.prototype.loft = function (rings, opt) {
    var v0 = this.count(), i0 = this.ix.length;
    var seg = opt.seg || 12, o = opt.o || [0, 0, 0], ax = opt.axis || 'y';
    var th0 = opt.th0 == null ? -Math.PI / 2 : opt.th0;
    var u0 = opt.u0 == null ? 0 : opt.u0, u1 = opt.u1 == null ? 1 : opt.u1;
    var self = this, cen = [0, 0, 0];
    function pos(rg, th) {
      var s = Math.sin(th), c = Math.cos(th);
      if (ax === 'y') return [o[0] + (rg.cx || 0) + s * rg.rx, o[1] + rg.a, o[2] + (rg.cy || 0) + c * rg.ry];
      return [o[0] + (rg.cx || 0) + s * rg.rx, o[1] + (rg.cy || 0) + c * rg.ry, o[2] + rg.a];
    }
    rings.forEach(function (rg) {
      for (var j = 0; j <= seg; j++) {
        var th = th0 + j / seg * TAU, P = pos(rg, th);
        var uv = opt.uvFn ? opt.uvFn(P, rg, j / seg) : uvOf(opt.reg, u0 + (u1 - u0) * j / seg, rg.v);
        self.v(P[0], P[1], P[2], uv, rg.w);
      }
    });
    var row = seg + 1;
    for (var i = 0; i < rings.length - 1; i++) {
      for (var j = 0; j < seg; j++) {
        var a = v0 + i * row + j, b = a + 1, c = a + row + 1, d = a + row;
        this.t(a, b, c); this.t(a, c, d);
      }
    }
    // pusat rata-rata untuk cek arah muka
    var last = rings[rings.length - 1], first = rings[0];
    var mid = { a: (first.a + last.a) / 2, rx: 0, ry: 0, cx: ((first.cx || 0) + (last.cx || 0)) / 2, cy: ((first.cy || 0) + (last.cy || 0)) / 2 };
    var mp = pos(mid, 0); cen[0] = mp[0]; cen[1] = mp[1]; cen[2] = mp[2];
    function cap(rg, ringIdx) {
      var P = pos({ a: rg.a, rx: 0, ry: 0, cx: rg.cx, cy: rg.cy }, 0);
      var uv = opt.uvFn ? opt.uvFn(P, rg, 0.5) : uvOf(opt.reg, (u0 + u1) / 2, rg.v);
      var c = self.v(P[0], P[1], P[2], uv, rg.w);
      for (var j = 0; j < seg; j++) {
        var a = v0 + ringIdx * row + j;
        self.t(c, a + 1, a);
      }
    }
    if (opt.capA) cap(rings[0], 0);
    if (opt.capB) cap(last, rings.length - 1);
    this.smooth(v0, i0, true, cen);
    return v0;
  };

  /* elipsoid (atau sebagian): th = keliling sumbu y (0 = depan +z), ph = dari atas (0) ke bawah (pi) */
  GB.prototype.blob = function (o, rx, ry, rz, segT, segP, thA, thB, phA, phB, uvFn, wFn, deform) {
    var v0 = this.count(), i0 = this.ix.length;
    for (var i = 0; i <= segP; i++) {
      var ph = phA + (phB - phA) * i / segP;
      for (var j = 0; j <= segT; j++) {
        var th = thA + (thB - thA) * j / segT;
        var lx = Math.sin(ph) * Math.sin(th), ly = Math.cos(ph), lz = Math.sin(ph) * Math.cos(th);
        var P = [lx * rx, ly * ry, lz * rz];
        if (deform) deform(P, lx, ly, lz);
        var X = o[0] + P[0], Y = o[1] + P[1], Z = o[2] + P[2];
        this.v(X, Y, Z, uvFn(P, lx, ly, lz), wFn ? wFn(P) : [[0, 1]]);
      }
    }
    var row = segT + 1;
    for (i = 0; i < segP; i++) for (j = 0; j < segT; j++) {
      var a = v0 + i * row + j, b = a + 1, c = a + row + 1, d = a + row;
      this.t(a, d, c); this.t(a, c, b);
    }
    this.smooth(v0, i0, true, o);
    return v0;
  };

  /* kotak membulat sederhana (sol sepatu, sabuk, gagang) */
  GB.prototype.box = function (o, sx, sy, sz, uv, w) {
    var v0 = this.count(), i0 = this.ix.length, hx = sx / 2, hy = sy / 2, hz = sz / 2, self = this;
    var F = [[[1, 0, 0], [0, 0, -1], [0, 1, 0]], [[-1, 0, 0], [0, 0, 1], [0, 1, 0]], [[0, 1, 0], [1, 0, 0], [0, 0, -1]], [[0, -1, 0], [1, 0, 0], [0, 0, 1]], [[0, 0, 1], [1, 0, 0], [0, 1, 0]], [[0, 0, -1], [-1, 0, 0], [0, 1, 0]]];
    F.forEach(function (f) {
      var nrm = f[0], ua = f[1], va = f[2], base = self.count();
      [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(function (q) {
        var x = o[0] + nrm[0] * hx + ua[0] * q[0] * hx + va[0] * q[1] * hx;
        var y = o[1] + nrm[1] * hy + ua[1] * q[0] * hy + va[1] * q[1] * hy;
        var z = o[2] + nrm[2] * hz + ua[2] * q[0] * hz + va[2] * q[1] * hz;
        self.v(x, y, z, uv, w);
      });
      self.t(base, base + 1, base + 2); self.t(base, base + 2, base + 3);
    });
    this.smooth(v0, i0, true, o);
    return v0;
  };

  GB.prototype.geometry = function () {
    var g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.n, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(this.si, 4));
    g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(this.sw, 4));
    g.setIndex(this.ix);
    g.computeBoundingSphere();
    return g;
  };

  /* ======================================================================
     3. KERANGKA & MODEL
     ====================================================================== */
  var BN = { base: 0, pelvis: 1, spine: 2, chest: 3, neck: 4, head: 5, claL: 6, armL: 7, foreL: 8, handL: 9, claR: 10, armR: 11, foreR: 12, handR: 13,
    thighL: 14, shinL: 15, footL: 16, toeL: 17, thighR: 18, shinR: 19, footR: 20, toeR: 21 };
  var BONE_NAMES = Object.keys(BN);
  Chars.BN = BN;

  function sstep(a, b, x) { var t = U.clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); }

  var Char = Chars.Char = function (pc, team, opts) {
    opts = opts || {};
    pc = pc || {};
    pc = Looks.merge(pc, team);
    var look = pc.look || {};
    var hs = ({ pendek: 0.94, sedang: 1, tinggi: 1.06 }[pc.height] || 1) * (look.height || 1);
    var ws = ({ kurus: 0.88, sedang: 1, gempal: 1.16 }[pc.body] || 1) * (look.body || 1);
    var info = outfitInfo(pc, team);
    this.look = look;
    this.cfg = pc; this.team = team; this.hs = hs; this.ws = ws; this.isGK = info.isGK; this.info = info;
    var q = opts.texSize || (R3.quality === 0 ? 256 : 512);
    // ---- tulang (posisi istirahat relatif induk) ----
    var L = {
      hip: 0.95 * hs, spine: 0.1 * hs, chest: 0.2 * hs, neck: 0.215 * hs, head: 0.085 * hs,
      cla: [0.03, 0.165 * hs, -0.005], arm: [0.148 * ws, 0.008, 0], upper: 0.285 * hs, fore: 0.255 * hs,
      thigh: [0.093 * ws, -0.035 * hs, 0.0], upLeg: 0.44 * hs, shin: 0.415 * hs, toe: [0, -0.045, 0.125 * hs]
    };
    this.L = L;
    var bones = [], B = {};
    function mk(name, parent, x, y, z) { var b = new THREE.Bone(); b.name = name; b.position.set(x, y, z); if (parent) B[parent].add(b); B[name] = b; bones[BN[name]] = b; return b; }
    mk('base', null, 0, 0, 0);
    mk('pelvis', 'base', 0, L.hip, 0);
    mk('spine', 'pelvis', 0, L.spine, 0);
    mk('chest', 'spine', 0, L.chest, 0);
    mk('neck', 'chest', 0, L.neck, -0.01);
    mk('head', 'neck', 0, L.head, 0.012);
    [1, -1].forEach(function (s) {
      var sd = s > 0 ? 'L' : 'R';
      mk('cla' + sd, 'chest', s * L.cla[0], L.cla[1], L.cla[2]);
      mk('arm' + sd, 'cla' + sd, s * L.arm[0], L.arm[1], L.arm[2]);
      mk('fore' + sd, 'arm' + sd, 0, -L.upper, 0);
      mk('hand' + sd, 'fore' + sd, 0, -L.fore, 0);
      mk('thigh' + sd, 'pelvis', s * L.thigh[0], L.thigh[1], L.thigh[2]);
      mk('shin' + sd, 'thigh' + sd, 0, -L.upLeg, 0);
      mk('foot' + sd, 'shin' + sd, 0, -L.shin, 0);
      mk('toe' + sd, 'foot' + sd, 0, L.toe[1], L.toe[2]);
    });
    // euler: tubuh YXZ (putar lalu condong), anggota gerak ZXY (puntir, ayun, buka)
    ['pelvis', 'spine', 'chest', 'neck', 'head', 'base'].forEach(function (n) { B[n].rotation.order = 'YXZ'; });
    ['armL', 'armR', 'foreL', 'foreR', 'thighL', 'thighR', 'claL', 'claR', 'handL', 'handR'].forEach(function (n) { B[n].rotation.order = 'ZXY'; });
    this.B = B; this.bones = bones;
    // posisi dunia (bind pose) tiap tulang
    B.base.updateMatrixWorld(true);
    var W = {};
    BONE_NAMES.forEach(function (n) { var v = new THREE.Vector3(); B[n].getWorldPosition(v); W[n] = [v.x, v.y, v.z]; });
    this.W = W;
    // ---- geometri ----
    var gb = new GB();
    buildBody(gb, pc, team, info, W, L, hs, ws);
    var geo = gb.geometry();
    this.tris = gb.ix.length / 3;
    var tex = paintAtlas(q, pc, team, info);
    this.tex = tex;
    var std = R3.quality > 0 && !opts.lambert;
    var mp = std ? { map: tex, roughness: look.metal ? 0.38 : 0.82, metalness: look.metal ? 0.55 : 0, skinning: true } : { map: tex, skinning: true };
    if (look.ghost) { mp.transparent = true; mp.opacity = look.opacity || 0.74; mp.emissive = new THREE.Color(look.emissive || '#1c2a3a'); mp.depthWrite = true; }
    var mat = std ? new THREE.MeshStandardMaterial(mp) : new THREE.MeshLambertMaterial(mp);
    var mesh = new THREE.SkinnedMesh(geo, mat);
    mesh.add(B.base);
    mesh.bind(new THREE.Skeleton(bones));
    mesh.frustumCulled = false;
    mesh.castShadow = true;
    this.mesh = mesh;
    var root3 = this.root = new THREE.Group();
    root3.add(mesh);
    this.body = B.base; // kompatibel: rotasi seluruh badan
    this.head = B.head;
    Looks.attach(this, pc, team, info);
    // bayangan bulat (tetap dipakai bila bayangan nyata mati)
    this.shadow = new THREE.Mesh(R3.geo.circle, Chars.shadowMat());
    this.shadow.rotation.x = -Math.PI / 2; this.shadow.position.y = 0.02; this.shadow.scale.set(0.42, 0.42, 1);
    this.shadow.visible = !R3.shadows;
    root3.add(this.shadow);
    // status animasi
    this.P = zeroPose(); this.from = null; this.fadeT = 1; this.fadeDur = 0.15;
    this.phase = Math.random() * TAU; this.t = Math.random() * 10;
    this.anim = 'idle'; this.animT = 0; this.lastX = null; this.lastZ = null; this.speed = 0; this.vx = 0; this.vz = 0;
    this.lastFacing = null; this.turnRate = 0; this.var = hashStr(pc.name + (pc.num | 0)) % 4;
    this.touchPh = 0;
    this.setPose('idle', 0);
  };

  Chars.shadowMat = function () {
    if (!Chars._sm) { Chars._sm = new THREE.MeshBasicMaterial({ map: R3.tex.blob, transparent: true, depthWrite: false }); Chars._sm.__baShared = true; }
    return Chars._sm;
  };

  /* bobot campuran dua tulang */
  function W2(a, b, t) { return t <= 0 ? [[a, 1]] : (t >= 1 ? [[b, 1]] : [[a, 1 - t], [b, t]]); }

  function buildBody(gb, pc, team, info, W, L, hs, ws) {
    var seg = R3.quality === 0 ? 10 : 14;
    var segL = R3.quality === 0 ? 8 : 12;
    var pel = W.pelvis;
    // ---------- badan (pinggul -> kerah) ----------
    var y0 = -0.13 * hs, y1 = 0.535 * hs, span = y1 - y0;
    function tv(y) { return (y - y0) / span; }
    var shirtLoose = info.outfit === 'kaos' ? 1.04 : 1;
    var torso = [
      [-0.13, 0.135, 0.1, 0.0, 0], [-0.075, 0.156, 0.112, 0, 0], [-0.045, 0.16, 0.114, 0.002, 0],
      [-0.04, 0.17 * shirtLoose, 0.122 * shirtLoose, 0.004, 0.02], [0.02, 0.164 * shirtLoose, 0.116 * shirtLoose, 0.006, 0.25], [0.12, 0.148 * shirtLoose, 0.108 * shirtLoose, 0.012, 0.55],
      [0.22, 0.154 * shirtLoose, 0.116, 0.017, 0.85], [0.32, 0.166, 0.125, 0.024, 1], [0.41, 0.172, 0.121, 0.017, 1],
      [0.465, 0.162, 0.104, 0.004, 1], [0.505, 0.118, 0.084, -0.002, 1.1], [0.535, 0.07, 0.066, 0.004, 1.4]
    ].map(function (r) {
      var y = r[0] * hs, wgt = r[4];
      var w = wgt <= 0.02 ? [[BN.pelvis, 1]] : (wgt < 1 ? W2(BN.pelvis, BN.spine, wgt * 1.2 > 1 ? 1 : wgt * 1.2) : (wgt === 1 ? [[BN.chest, 1]] : W2(BN.chest, BN.neck, (wgt - 1) * 0.9)));
      if (wgt > 0.5 && wgt < 1) w = W2(BN.spine, BN.chest, (wgt - 0.5) * 2);
      return { a: y, rx: r[1] * ws, ry: r[2] * (0.92 + ws * 0.08), cy: r[3], v: tv(y), w: w };
    });
    gb.loft(torso, { o: pel, axis: 'y', seg: seg + 6, reg: 'torso', capA: true });
    // ---------- leher ----------
    var nk = W.neck;
    gb.loft([
      { a: -0.03, rx: 0.056, ry: 0.054, cy: 0.0, v: 0, w: [[BN.chest, 1]] },
      { a: 0.03, rx: 0.051, ry: 0.05, cy: 0.004, v: 0.5, w: W2(BN.chest, BN.neck, 0.6) },
      { a: 0.095, rx: 0.048, ry: 0.048, cy: 0.012, v: 1, w: W2(BN.neck, BN.head, 0.5) }
    ], { o: nk, axis: 'y', seg: segL, reg: 'neck' });
    // ---------- kepala ----------
    buildHead(gb, pc, team, info, W, hs);
    // ---------- lengan ----------
    [1, -1].forEach(function (s) {
      var sd = s > 0 ? 'L' : 'R';
      var sh = W['arm' + sd], el = W['fore' + sd], wr = W['hand' + sd];
      var A = BN['arm' + sd], Fo = BN['fore' + sd], H = BN['hand' + sd];
      var thIn = s > 0 ? -Math.PI / 2 : Math.PI / 2; // sambungan uv di sisi dalam
      var la = L.upper, armR = 0.05 * Math.sqrt(ws);
      var sleeveA = info.outfit === 'singlet' ? -1 : 0.43;
      var rings = [
        { a: 0.045, rx: armR * 1.05, ry: armR * 1.05, cx: -s * 0.01, v: 1, w: W2(BN.chest, A, 0.5) },
        { a: 0.0, rx: armR * 1.35, ry: armR * 1.3, v: 0.93, w: W2(BN.chest, A, 0.8) },
        { a: -0.05 * hs, rx: armR * 1.32, ry: armR * 1.25, v: 0.84, w: [[A, 1]] }
      ];
      if (sleeveA > 0 && !info.longSleeve) {
        rings.push({ a: -la * 0.38, rx: armR * 1.26, ry: armR * 1.22, v: 0.56, w: [[A, 1]] });
        rings.push({ a: -la * 0.4, rx: armR * 1.0, ry: armR * 0.98, v: 0.52, w: [[A, 1]] });
      }
      rings.push({ a: -la * 0.62, rx: armR * 1.0, ry: armR * 0.98, v: 0.36, w: [[A, 1]] });
      rings.push({ a: -la * 0.9, rx: armR * 0.86, ry: armR * 0.84, v: 0.12, w: W2(A, Fo, 0.25) });
      rings.push({ a: -la * 1.0, rx: armR * 0.82, ry: armR * 0.82, v: 0.0, w: W2(A, Fo, 0.5) });
      gb.loft(rings, { o: sh, axis: 'y', seg: segL, reg: 'arm', th0: thIn });
      // lengan bawah
      var lf = L.fore;
      gb.loft([
        { a: 0.02, rx: armR * 0.84, ry: armR * 0.84, v: 1, w: W2(A, Fo, 0.6) },
        { a: -lf * 0.22, rx: armR * 0.92, ry: armR * 0.86, cy: 0.004, v: 0.78, w: [[Fo, 1]] },
        { a: -lf * 0.62, rx: armR * 0.72, ry: armR * 0.64, v: 0.38, w: [[Fo, 1]] },
        { a: -lf * 0.97, rx: armR * 0.6, ry: armR * 0.48, v: 0.03, w: W2(Fo, H, 0.4) },
        { a: -lf * 1.02, rx: armR * 0.6, ry: armR * 0.48, v: 0.0, w: W2(Fo, H, 0.7) }
      ], { o: el, axis: 'y', seg: segL, reg: 'fore', th0: thIn });
      buildHand(gb, wr, s, H, info.isGK, hs);
    });
    // ---------- kaki ----------
    [1, -1].forEach(function (s) {
      var sd = s > 0 ? 'L' : 'R';
      var hp = W['thigh' + sd], kn = W['shin' + sd], an = W['foot' + sd];
      var T = BN['thigh' + sd], S = BN['shin' + sd], Fb = BN['foot' + sd], To = BN['toe' + sd];
      var thIn = s > 0 ? -Math.PI / 2 : Math.PI / 2;
      var lt = L.upLeg, tr = 0.082 * Math.pow(ws, 0.8);
      var shortsLoose = info.bottom === 'pendek' ? 1.16 : 1.0;
      var thighRings = [
        { a: 0.06, rx: tr * 1.02, ry: tr * 1.0, cx: s * 0.004, v: 1, w: W2(BN.pelvis, T, 0.35) },
        { a: 0.0, rx: tr * 1.06 * shortsLoose, ry: tr * 1.04 * shortsLoose, v: 0.93, w: W2(BN.pelvis, T, 0.7) },
        { a: -lt * 0.25, rx: tr * 1.02 * shortsLoose, ry: tr * 1.0 * shortsLoose, cy: 0.006, v: 0.72, w: [[T, 1]] }
      ];
      if (info.bottom === 'pendek') {
        thighRings.push({ a: -lt * 0.44, rx: tr * 1.0 * shortsLoose, ry: tr * 0.98 * shortsLoose, cy: 0.006, v: 0.52, w: [[T, 1]] });
        thighRings.push({ a: -lt * 0.45, rx: tr * 0.84, ry: tr * 0.84, cy: 0.008, v: 0.49, w: [[T, 1]] });
      } else thighRings.push({ a: -lt * 0.45, rx: tr * 0.9, ry: tr * 0.88, cy: 0.008, v: 0.5, w: [[T, 1]] });
      thighRings.push({ a: -lt * 0.75, rx: tr * 0.76, ry: tr * 0.74, cy: 0.006, v: 0.24, w: [[T, 1]] });
      thighRings.push({ a: -lt * 0.95, rx: tr * 0.62, ry: tr * 0.62, cy: 0.004, v: 0.05, w: W2(T, S, 0.3) });
      thighRings.push({ a: -lt * 1.0, rx: tr * 0.6, ry: tr * 0.6, cy: 0.004, v: 0.0, w: W2(T, S, 0.5) });
      gb.loft(thighRings, { o: hp, axis: 'y', seg: segL, reg: 'thigh', th0: thIn });
      // betis
      var ls = L.shin;
      var sockR = info.sock ? 1.04 : 1;
      gb.loft([
        { a: 0.025, rx: tr * 0.6, ry: tr * 0.6, cy: 0.004, v: 1, w: W2(T, S, 0.6) },
        { a: -ls * 0.12, rx: tr * 0.6, ry: tr * 0.62, cy: -0.004, v: 0.88, w: [[S, 1]] },
        { a: -ls * 0.3, rx: tr * 0.64 * sockR, ry: tr * 0.7 * sockR, cy: -0.012, v: 0.7, w: [[S, 1]] },
        { a: -ls * 0.62, rx: tr * 0.5 * sockR, ry: tr * 0.52 * sockR, cy: -0.004, v: 0.38, w: [[S, 1]] },
        { a: -ls * 0.92, rx: tr * 0.4 * sockR, ry: tr * 0.42 * sockR, v: 0.08, w: W2(S, Fb, 0.3) },
        { a: -ls * 1.0, rx: tr * 0.42 * sockR, ry: tr * 0.44 * sockR, v: 0.0, w: W2(S, Fb, 0.6) }
      ], { o: kn, axis: 'y', seg: segL, reg: 'shin', th0: thIn });
      buildFoot(gb, an, s, Fb, To, info, hs);
    });
    // ---------- sarung (rok lilit) ----------
    if (info.bottom === 'sarung') {
      var sr = [[0.02, 0.17, 0.125, 0], [-0.1, 0.19, 0.14, 0.15], [-0.26, 0.21, 0.15, 0.45], [-0.42, 0.215, 0.155, 0.7], [-0.52, 0.212, 0.152, 0.85]].map(function (r) {
        return { a: r[0] * hs, rx: r[1] * ws, ry: r[2] * ws, v: 1 - r[3], w: [[BN.pelvis, 1]] };
      });
      gb.loft(sr, { o: pel, axis: 'y', seg: seg + 6, reg: 'skirt' });
    }
    Looks.body(gb, pc, team, info, W, L, hs, ws, seg);
  }

  function buildHead(gb, pc, team, info, W, hs) {
    var hd = W.head;
    var c = [hd[0], hd[1] + 0.082, hd[2] + 0.016];
    var rx = 0.092, ry = 0.116, rz = 0.105;
    var H = [[BN.head, 1]];
    var segT = R3.quality === 0 ? 10 : 14, segP = R3.quality === 0 ? 10 : 14;
    var look = info.look || {};
    function shapeHead(P, lx, ly, lz) {
      if (look.headShape === 'box') { var m = Math.max(Math.abs(lx), Math.abs(ly), Math.abs(lz), 0.3); var f = Math.pow(1 / m, 0.6); P[0] *= f; P[1] *= f; P[2] *= f; return; }
      if (look.headShape === 'ball') return;
      // rahang lebih sempit, dagu sedikit maju, belakang kepala membulat
      if (ly < 0) { var k = -ly; P[0] *= 1 - 0.16 * k * k; P[2] *= 1 - 0.08 * k; if (lz > 0) P[2] += 0.012 * k * lz; }
      if (lz < 0) P[2] *= 1.04;
      if (ly > 0.2 && lz > 0.3) P[2] -= 0.008 * ly; // dahi miring
      if (look.jaw) { if (ly < -0.3) { P[0] *= look.jaw; P[2] *= 1 + (look.jaw - 1) * 0.5; } }
    }
    // wajah (separuh depan)
    gb.blob(c, rx, ry, rz, segT, segP, -Math.PI / 2, Math.PI / 2, 0, Math.PI * 0.86, function (P) { return faceUV(P[0], P[1]); }, function () { return H; }, shapeHead);
    // belakang kepala
    gb.blob(c, rx, ry, rz, segT, segP, Math.PI / 2, Math.PI * 1.5, 0, Math.PI * 0.86, function (P, lx, ly) { return uvOf('head', 0.5 + lx * 0.45, 0.5 + ly * 0.45); }, function () { return H; }, shapeHead);
    // telinga
    if (!look.ears && !look.noEars) [1, -1].forEach(function (s) {
      var eo = [c[0] + s * rx * 0.97, c[1] - 0.008, c[2] - 0.012];
      gb.blob(eo, 0.014, 0.027, 0.019, 6, 6, 0, TAU, 0, Math.PI, function () { return faceUV(s * 0.1, -0.005); }, function () { return H; });
    });
    // hidung
    if (!look.snout && !look.noNose) gb.blob([c[0], c[1] - 0.018, c[2] + rz * 0.9], 0.015, 0.026, 0.02, 6, 6, 0, TAU, 0, Math.PI, function (P) { return faceUV(P[0], -0.015 + P[1] * 0.3); }, function () { return H; },
      function (P, lx, ly, lz) { if (lz < 0) P[2] *= 0.3; if (ly < 0 && lz > 0) P[2] += 0.006; });
    // rambut
    buildHair(gb, pc.hair, c, rx, ry, rz, hs);
    buildHeadwear(gb, pc.head, c, rx, ry, rz);
    Looks.head(gb, pc, team, info, c, rx, ry, rz, hs);
    if (pc.face === 'kacamata' || look.glasses) {
      [1, -1].forEach(function (s) {
        var go = [c[0] + s * 0.036, c[1] + 0.012, c[2] + rz * 0.93];
        gb.loft([
          { a: -0.004, rx: 0.02, ry: 0.016, v: 0.5, w: H }, { a: 0.004, rx: 0.02, ry: 0.016, v: 0.5, w: H },
          { a: 0.004, rx: 0.016, ry: 0.012, v: 0.5, w: H }, { a: -0.004, rx: 0.016, ry: 0.012, v: 0.5, w: H }, { a: -0.004, rx: 0.02, ry: 0.016, v: 0.5, w: H }
        ], { o: go, axis: 'z', seg: 12, reg: look.glasses ? 'acc3' : 'dark', u0: look.glasses ? 0.55 : 0, u1: look.glasses ? 0.95 : 1 });
        gb.box([c[0] + s * 0.075, c[1] + 0.014, c[2] + 0.03], 0.004, 0.005, 0.11, uvOf('dark', 0.5, 0.5), H);
      });
      gb.box([c[0], c[1] + 0.016, c[2] + rz * 0.93], 0.016, 0.004, 0.004, uvOf('dark', 0.5, 0.5), H);
    }
  }

  /* garis rambut: titik rambut yang berada di wajah (depan, di bawah dahi) ditarik masuk ke kepala */
  function hairline(P, lx, ly, lz, low) {
    var front = lz > 0.18 ? Math.min(1, (lz - 0.18) / 0.5) : 0;
    var limit = 0.58 * front + (low || 0.05) * (1 - front);
    if (lz > -0.1 && ly < limit) { P[0] *= 0.86; P[1] *= 0.86; P[2] *= 0.86; }
  }
  function buildHair(gb, style, c, rx, ry, rz, hs) {
    if (style === 'botak') return;
    var H = [[BN.head, 1]];
    var hairUV = function (P, lx, ly, lz) { return uvOf('hair', 0.5 + lx * 0.45, 0.5 + ly * 0.3 + lz * 0.15); };
    var seg = R3.quality === 0 ? 12 : 16;
    var g = 0.011;
    if (style === 'cepak') {
      gb.blob(c, rx + 0.006, ry + 0.006, rz + 0.006, seg, 7, 0, TAU, 0, Math.PI * 0.46, hairUV, function () { return H; }, function (P, lx, ly, lz) { hairline(P, lx, ly, lz, 0.3); });
      return;
    }
    if (style === 'mohawk') {
      gb.blob(c, rx + 0.003, ry + 0.003, rz + 0.003, seg, 6, 0, TAU, 0, Math.PI * 0.38, hairUV, function () { return H; });
      // jambul tengah
      var crest = [];
      for (var i = 0; i <= 8; i++) {
        var a = -0.95 + i / 8 * 2.1; // dari dahi ke belakang
        var py = c[1] + Math.cos(a) * ry, pz = c[2] + Math.sin(a) * rz;
        crest.push({ a: pz, rx: 0.016, ry: 0.035 + Math.sin(i / 8 * Math.PI) * 0.03, cy: py - c[1] + 0.022, v: i / 8, w: H });
      }
      crest.forEach(function (r) { r.a = r.a; });
      gb.loft(crest, { o: [c[0], c[1], 0], axis: 'z', seg: 8, reg: 'hair', capA: true, capB: true });
      return;
    }
    if (style === 'keriting') {
      var rnd = U.rng(77);
      gb.blob(c, rx + 0.03, ry + 0.022, rz + 0.026, seg + 4, 10, 0, TAU, 0, Math.PI * 0.55, hairUV, function () { return H; }, function (P, lx, ly, lz) {
        var bump = 1 + 0.07 * Math.sin(lx * 23 + ly * 17) * Math.cos(lz * 19 + ly * 11);
        P[0] *= bump; P[1] *= bump; P[2] *= bump;
        if (lz > 0.3 && ly < 0.62) { P[0] *= 0.8; P[1] *= 0.8; P[2] *= 0.8; }
      });
      void rnd;
      return;
    }
    // belah / gondrong / kuncir: tudung rambut lebih tebal dengan poni
    gb.blob(c, rx + g, ry + g, rz + g * 1.2, seg + 2, 10, 0, TAU, 0, Math.PI * (style === 'gondrong' ? 0.66 : 0.56), hairUV, function () { return H; }, function (P, lx, ly, lz) {
      if (style === 'belah' && lx > 0.1 && ly > 0.4) P[1] += 0.012 * lx; // belahan pinggir: satu sisi lebih tebal
      if (lz > 0.55 && ly < 0.75 && ly > 0.5) { P[1] += 0.01; P[2] += 0.004; } // poni sedikit menonjol
      if (lz < -0.2) P[2] *= 1.05;
      hairline(P, lx, ly, lz, style === 'gondrong' ? -0.35 : 0.0);
    });
    if (style === 'belah') {
      // jambul samping
      gb.blob([c[0] - 0.035, c[1] + ry * 0.82, c[2] + rz * 0.45], 0.06, 0.026, 0.05, 8, 6, 0, TAU, 0, Math.PI, hairUV, function () { return H; });
    }
    if (style === 'gondrong') {
      // rambut panjang jatuh ke tengkuk/bahu
      var back = [];
      for (var k = 0; k <= 5; k++) {
        var t = k / 5;
        back.push({ a: 0.02 - t * 0.2, rx: (rx + 0.016) * (1 - t * 0.15), ry: 0.05 - t * 0.012, cy: -rz * 0.62 - t * 0.02, v: 1 - t, w: t < 0.6 ? H : W2(BN.head, BN.neck, (t - 0.6) * 1.5) });
      }
      gb.loft(back, { o: c, axis: 'y', seg: 12, reg: 'hair', th0: -Math.PI / 2, capB: true });
    }
    if (style === 'kuncir') {
      var pt = [];
      for (var m = 0; m <= 6; m++) {
        var tt = m / 6;
        pt.push({ a: 0.035 - tt * 0.17, rx: 0.026 * (1 - tt * 0.6) + 0.006, ry: 0.024 * (1 - tt * 0.6) + 0.006, cy: -rz - 0.02 - Math.sin(tt * 1.4) * 0.03, v: 1 - tt, w: tt < 0.4 ? H : W2(BN.head, BN.neck, tt) });
      }
      gb.loft(pt, { o: c, axis: 'y', seg: 8, reg: 'hair', capB: true });
      gb.blob([c[0], c[1] + 0.03, c[2] - rz - 0.012], 0.03, 0.03, 0.022, 8, 6, 0, TAU, 0, Math.PI, function () { return uvOf('acc1', 0.5, 0.5); }, function () { return H; });
    }
  }

  function buildHeadwear(gb, kind, c, rx, ry, rz) {
    var H = [[BN.head, 1]];
    if (!kind || kind === 'none') return;
    var accUV = function (reg) { return function (P, lx, ly, lz) { return uvOf(reg, 0.5 + lx * 0.45, 0.5 + ly * 0.3 + lz * 0.15); }; };
    if (kind === 'ikat') {
      gb.loft([
        { a: 0.028, rx: rx + 0.016, ry: rz + 0.018, v: 1, w: H }, { a: 0.058, rx: rx + 0.014, ry: rz + 0.016, v: 0, w: H }
      ], { o: c, axis: 'y', seg: 18, reg: 'acc1' });
      // simpul & ekor
      gb.blob([c[0], c[1] + 0.045, c[2] - rz - 0.018], 0.018, 0.016, 0.012, 6, 5, 0, TAU, 0, Math.PI, function () { return uvOf('acc1', 0.5, 0.5); }, function () { return H; });
      [1, -1].forEach(function (s) { gb.box([c[0] + s * 0.018, c[1] + 0.0, c[2] - rz - 0.03], 0.016, 0.07, 0.006, uvOf('acc1', 0.5, 0.5), W2(BN.head, BN.neck, 0.3)); });
    } else if (kind === 'topi') {
      gb.blob(c, rx + 0.018, ry + 0.012, rz + 0.016, 16, 8, 0, TAU, 0, Math.PI * 0.46, accUV('acc1'), function () { return H; });
      // pet di belakang (topi terbalik)
      gb.loft([
        { a: -0.012, rx: 0.07, ry: 0.006, cy: 0, v: 0.5, w: H }, { a: -0.09, rx: 0.065, ry: 0.006, cy: -0.004, v: 0.5, w: H }
      ], { o: [c[0], c[1] + ry * 0.42, c[2] - rz], axis: 'z', seg: 10, reg: 'acc2', capA: true, capB: true });
    } else if (kind === 'bandana') {
      gb.blob(c, rx + 0.014, ry + 0.012, rz + 0.016, 16, 8, 0, TAU, 0, Math.PI * 0.44, accUV('acc2'), function () { return H; });
      gb.blob([c[0], c[1] + 0.03, c[2] - rz - 0.02], 0.022, 0.018, 0.016, 6, 5, 0, TAU, 0, Math.PI, function () { return uvOf('acc2', 0.5, 0.5); }, function () { return H; });
    } else if (kind === 'caping') {
      var cr = [];
      for (var i = 0; i <= 6; i++) { var t = i / 6; cr.push({ a: ry * 0.62 + (1 - t) * 0.16, rx: 0.005 + t * 0.29, ry: 0.005 + t * 0.29, v: 1 - t, w: H }); }
      cr.push({ a: ry * 0.6, rx: 0.29, ry: 0.29, v: 0, w: H });
      cr.push({ a: ry * 0.66, rx: 0.08, ry: 0.08, v: 0, w: H });
      gb.loft(cr, { o: c, axis: 'y', seg: 18, reg: 'acc1', capA: true });
    } else if (kind === 'kupluk') {
      gb.blob(c, rx + 0.016, ry + 0.02, rz + 0.016, 16, 9, 0, TAU, 0, Math.PI * 0.5, accUV('acc1'), function () { return H; }, function (P, lx, ly) { if (ly > 0.6) P[1] += 0.02 * (ly - 0.6) * 3; });
      gb.loft([{ a: 0.0, rx: rx + 0.024, ry: rz + 0.024, v: 1, w: H }, { a: 0.03, rx: rx + 0.022, ry: rz + 0.022, v: 0, w: H }], { o: c, axis: 'y', seg: 18, reg: 'acc1' });
    }
  }

  function buildHand(gb, wr, s, H, gk, hs) {
    var k = gk ? 1.22 : 1;
    var reg = 'hand';
    var w = [[H, 1]];
    // telapak: lebar ke arah depan-belakang, tipis ke samping (telapak menghadap paha)
    gb.loft([
      { a: 0.0, rx: 0.017 * k, ry: 0.026 * k, v: 1, w: w }, { a: -0.04 * k, rx: 0.019 * k, ry: 0.039 * k, cy: 0.004 * k, v: 0.6, w: w },
      { a: -0.08 * k, rx: 0.017 * k, ry: 0.04 * k, cy: 0.004 * k, v: 0.25, w: w }, { a: -0.092 * k, rx: 0.014 * k, ry: 0.034 * k, cy: 0.004 * k, v: 0.1, w: w }
    ], { o: wr, axis: 'y', seg: 10, reg: reg, capA: true, capB: true });
    if (R3.quality === 0) return;
    // jari berjajar depan-belakang, melengkung ke arah telapak (ke dalam)
    for (var f = 0; f < 4; f++) {
      var fz = (0.028 - f * 0.017) * k, len = (f === 1 || f === 2 ? 0.075 : 0.062) * k;
      var o = [wr[0], wr[1] - 0.088 * k, wr[2] + fz];
      var rings = [];
      for (var i = 0; i <= 3; i++) {
        var t = i / 3;
        rings.push({ a: -t * len, rx: 0.0085 * k * (1 - t * 0.25), ry: 0.0085 * k * (1 - t * 0.25), cx: -s * t * t * 0.022 * k, v: 1 - t, w: w });
      }
      gb.loft(rings, { o: o, axis: 'y', seg: 6, reg: reg, capB: true });
    }
    // ibu jari di depan, sedikit ke dalam
    var tr = [];
    for (var j = 0; j <= 3; j++) { var tt = j / 3; tr.push({ a: -tt * 0.05 * k, rx: 0.01 * k, ry: 0.01 * k, cy: (0.034 + tt * 0.012) * k, cx: -s * (0.008 + tt * 0.012) * k, v: 1 - tt, w: w }); }
    gb.loft(tr, { o: [wr[0], wr[1] - 0.025 * k, wr[2]], axis: 'y', seg: 6, reg: reg, capB: true });
  }

  function buildFoot(gb, an, s, Fb, To, info, hs) {
    var foot = info.foot, len = 0.25 * hs;
    var wF = [[Fb, 1]], wT = [[To, 1]];
    var o = [an[0], an[1], an[2]];
    var g = -o[1]; // tanah relatif terhadap pergelangan
    function ring(a, rx, ry, base, v, w) { return { a: a * hs, rx: rx, ry: ry, cy: g + base + ry, v: v, w: w }; }
    if (foot === 'sepatu') {
      // sepatu bola: badan sepatu di atas sol, ujung membulat
      var sb = 0.013;
      gb.loft([
        ring(-0.062, 0.03, 0.03, sb, 0.95, wF), ring(-0.045, 0.041, 0.05, sb, 0.85, wF), ring(0.0, 0.046, 0.06, sb, 0.7, wF),
        ring(0.05, 0.05, 0.048, sb, 0.5, W2(Fb, To, 0.35)), ring(0.11, 0.05, 0.034, sb, 0.32, W2(Fb, To, 0.8)),
        ring(0.165, 0.042, 0.026, sb, 0.15, wT), ring(0.195, 0.026, 0.018, sb, 0.04, wT), ring(0.205, 0.01, 0.009, sb, 0.0, wT)
      ], { o: o, axis: 'z', seg: 12, reg: 'shoe', th0: 0, capA: true, capB: true });
      // sol dua bagian: tumit-tengah ikut tulang kaki, depan ikut tulang jari
      var zMid = 0.1 * hs, zA = -0.064 * hs, zB = 0.205 * hs;
      gb.box([o[0], g + sb / 2 + 0.001, o[2] + (zA + zMid) / 2], 0.092, sb, zMid - zA, uvOf('sole', 0.5, 0.5), wF);
      gb.box([o[0], g + sb / 2 + 0.001, o[2] + (zMid + zB) / 2 - 0.004], 0.088, sb, zB - zMid, uvOf('sole', 0.5, 0.5), wT);
    } else {
      // kaki telanjang (nyeker / sandal)
      var lift = foot === 'sandal' ? 0.012 : 0;
      gb.loft([
        ring(-0.058, 0.03, 0.032, lift, 0.95, wF), ring(-0.03, 0.038, 0.044, lift, 0.8, wF), ring(0.03, 0.042, 0.036, lift, 0.55, W2(Fb, To, 0.3)),
        ring(0.1, 0.046, 0.022, lift, 0.3, W2(Fb, To, 0.8)), ring(0.15, 0.043, 0.015, lift, 0.1, wT), ring(0.17, 0.022, 0.009, lift, 0.0, wT)
      ], { o: o, axis: 'z', seg: 10, reg: 'foot', th0: 0, capA: true, capB: true });
      if (foot === 'sandal') {
        gb.box([o[0], g + 0.006, o[2] + 0.06 * hs], 0.1, 0.012, 0.27 * hs, uvOf('strap', 0.5, 0.5), W2(Fb, To, 0.35));
        [1, -1].forEach(function (k) { gb.box([o[0] + k * 0.022, g + 0.03, o[2] + 0.075 * hs], 0.007, 0.012, 0.075, uvOf('strap', 0.5, 0.5), W2(Fb, To, 0.5)); });
      }
    }
  }

  /* ======================================================================
     3b. WUJUD KHUSUS PER JENIS TIM (siluman, hantu, mamalia, robot, migas, partai)
     ====================================================================== */
  var Looks = Chars.Looks = {};
  var LOOK = {
    siluman: {
      genderuwo: { skin: '#4a3222', fur: 'noise', furC: '#1d110a', eyes: '#ff3b1f', glow: true, fangs: true, hair: 'gondrong', hairC: '#1a0e08', ears: 'runcing', body: 1.14, height: 1.05, jaw: 1.1, face: 'brewok' },
      buto: { skin: '#4f7a2c', eyes: '#ffd400', glow: true, tusks: true, horns: 'satu', ears: 'runcing', hair: 'botak', body: 1.2, height: 1.1, jaw: 1.18, face: 'polos', noseC: '#2f4f1a' },
      ular: { skin: '#3f7f4f', scales: true, eyes: '#d6ff3a', slit: true, glow: true, hair: 'botak', tail: 'ular', noEars: true, face: 'polos', noNose: true, tongue: true },
      babi: { skin: '#d99a8c', snout: 'babi', ears: 'babi', eyes: '#2a1a1a', tusks: true, body: 1.16, hair: 'botak', face: 'polos' },
      tuyul: { skin: '#9bbf8a', eyes: '#ff2a2a', glow: true, bigEyes: true, hair: 'botak', height: 0.8, body: 0.92, face: 'polos', ears: 'runcing' }
    },
    hantu: {
      kuntilanak: { skin: '#e8e6e0', eyes: '#111111', sockets: true, hair: 'gondrong', hairC: '#0a0a0a', outfit: 'daster', ghost: true, opacity: 0.86, float: true, face: 'polos', lips: '#5a1a1a' },
      pocong: { skin: '#cfd6c8', eyes: '#111111', sockets: true, hair: 'botak', outfit: 'kafan', ghost: true, opacity: 0.86, face: 'polos', noEars: true },
      sundel: { skin: '#e0dcd4', eyes: '#111111', sockets: true, hair: 'gondrong', hairC: '#0a0a0a', outfit: 'daster', ghost: true, opacity: 0.86, float: true, face: 'polos', lips: '#7a1a1a', holeBack: true },
      wewe: { skin: '#b7a78f', eyes: '#2a2a2a', sockets: true, hair: 'gondrong', hairC: '#8a8a8a', outfit: 'daster', ghost: true, opacity: 0.8, body: 1.12, face: 'polos', fangs: true },
      jin: { skin: '#3a2150', eyes: '#ffb020', glow: true, hair: 'mohawk', hairC: '#ff6a1a', outfit: 'singlet', ghost: true, opacity: 0.8, emissive: '#3a1a08', float: true, face: 'jenggot', ears: 'runcing', body: 1.1 }
    },
    mamalia: {
      harimau: { skin: '#e8872b', fur: 'stripes', furC: '#1a1a1a', ears: 'kucing', snout: 'kucing', tail: 'panjang', eyes: '#f7d23f', slit: true, hair: 'botak', body: 1.1, face: 'polos', whiskers: true },
      monyet: { skin: '#8a6a4a', fur: 'noise', furC: '#4a3222', ears: 'bulat', snout: 'monyet', tail: 'panjang', eyes: '#3a2a1a', hair: 'cepak', hairC: '#4a3222', face: 'polos', height: 0.92 },
      kerbau: { skin: '#5a5a62', horns: 'kerbau', ears: 'sapi', snout: 'sapi', tail: 'pendek', eyes: '#1a1a1a', hair: 'botak', body: 1.2, height: 1.06, face: 'polos' },
      beruang: { skin: '#5a3a22', fur: 'noise', furC: '#2e1a0e', ears: 'bulat', snout: 'beruang', eyes: '#1a1a1a', hair: 'botak', body: 1.22, height: 1.06, face: 'polos', tail: 'pendek' },
      kucing: { skin: '#f0a040', fur: 'stripes', furC: '#b85c1a', ears: 'kucing', snout: 'kucing', tail: 'panjang', eyes: '#7fe36a', slit: true, hair: 'botak', height: 0.9, body: 0.94, face: 'polos', whiskers: true },
      anjing: { skin: '#c9a46a', fur: 'noise', furC: '#8a6a3a', ears: 'jatuh', snout: 'anjing', tail: 'panjang', eyes: '#3a2a1a', hair: 'botak', face: 'polos' }
    },
    robot: {
      kotak: { metal: true, skin: '#8d99ae', visor: '#38e8ff', headShape: 'box', antenna: true, hair: 'botak', face: 'polos', noEars: true, noNose: true, outfit: 'robot' },
      bulat: { metal: true, skin: '#cfd8dc', visor: '#7bff6a', headShape: 'ball', hair: 'botak', face: 'polos', noEars: true, noNose: true, outfit: 'robot' },
      tempur: { metal: true, skin: '#4a4e57', visor: '#ff3b1f', headShape: 'box', shoulder: true, hair: 'botak', face: 'polos', noEars: true, noNose: true, outfit: 'robot', body: 1.15 },
      kurir: { metal: true, skin: '#ffb703', visor: '#1b1b1b', visorGlow: '#8ecae6', headShape: 'ball', antenna: true, hair: 'botak', face: 'polos', noEars: true, noNose: true, outfit: 'robot', height: 0.95 }
    },
    migas: { _: { outfit: 'coverall', gloves: true, boots: true } },
    partai: {
      safari: { outfit: 'safari', peci: true },
      batik: { outfit: 'batik', peci: true },
      rompi: { outfit: 'rompi', peci: true }
    }
  };
  Looks.LOOK = LOOK;
  Looks.of = function (pc, team) {
    var kind = (team && team.kind) || 'manusia';
    var tab = LOOK[kind]; if (!tab) return null;
    var vid = D.variantOf ? D.variantOf(team, pc, pc && pc.num) : '';
    var l = tab[vid] || tab._ || null;
    if (!l) return null;
    l = Object.assign({ kind: kind, variant: vid }, l);
    if (kind === 'migas') l.ppe = (team && team.ppe) || 'helm';
    return l;
  };
  /* salinan konfigurasi pemain dengan penyesuaian wujud (rambut, wajah, warna kulit) */
  Looks.merge = function (pc, team) {
    var look = Looks.of(pc, team);
    var out = Object.assign({}, pc || {});
    out.look = look || {};
    if (!look) return out;
    if (look.hair) out.hair = look.hair;
    if (look.hairC) out.hairColor = look.hairC;
    if (look.face) out.face = look.face;
    if (look.skin) out.skinColor = look.skin;
    if (look.kind === 'robot' || look.kind === 'hantu' || look.kind === 'siluman' || look.kind === 'mamalia') out.head = 'none';
    if (look.kind === 'migas' || look.kind === 'partai') out.head = 'none';
    if (look.kind === 'migas' && (look.ppe === 'kacamata' || look.ppe === 'helm_kacamata')) look.glasses = true;
    if (look.kind === 'migas' && look.ppe !== 'tanpa' && look.ppe !== 'kacamata') look.hardhat = true;
    return out;
  };
  Looks.applyInfo = function (info, pc, team) {
    var look = pc.look || Looks.of(pc, team) || {};
    info.look = look;
    if (!look.kind) return;
    if (look.outfit) info.outfit = look.outfit;
    if (look.kind === 'migas') { info.longSleeve = true; info.bottom = 'training'; info.gloves = true; info.sock = null; info.shoe = '#3a2a1a'; }
    if (look.kind === 'robot') { info.longSleeve = true; info.bottom = 'training'; info.sock = null; info.shoe = U.mixHex(look.skin, '#000000', 0.5); info.gloves = true; }
    if (look.kind === 'partai') { info.longSleeve = look.outfit !== 'safari'; info.bottom = 'training'; info.sock = null; info.shoe = '#1b1b1b'; }
    if (look.outfit === 'kafan') { info.longSleeve = true; info.bottom = 'training'; info.sock = null; info.c1 = '#e9e4d6'; info.c2 = '#bfb9a8'; }
    if (look.outfit === 'daster') { info.longSleeve = true; info.bottom = 'training'; info.sock = null; info.c1 = '#f1efe9'; info.c2 = '#d9d4c8'; }
    if (look.kind === 'hantu' || look.kind === 'siluman' || look.kind === 'mamalia') { if (info.foot === 'sepatu') info.sock = null; }
    if (look.kind === 'siluman' || look.kind === 'mamalia') { if (look.variant !== 'tuyul') info.bottom = info.bottom === 'training' ? 'pendek' : info.bottom; }
  };

  /* ---------- lukisan tekstur ---------- */
  Looks.paint = function (x, pc, team, info, h) {
    var look = info.look || {};
    if (!look.kind) return;
    var R = h.R, skin = h.skin, skinD = h.skinD, skinL = h.skinL;
    var rnd = U.rng(hashStr('look' + pc.name + (pc.num | 0)));
    var tr = R('torso'), TX = tr[0], TY = tr[1], TW = tr[2], TH = tr[3];
    var tx = h.tx, ty = h.ty, vHem = h.vHem;
    function band(r, v0, v1, col) { x.fillStyle = col; x.fillRect(r[0], r[1] + r[3] * (1 - v1), r[2], r[3] * (v1 - v0)); }
    function reflect(r, v, thick) {
      thick = thick || 0.06;
      band(r, v - thick / 2 - 0.012, v - thick / 2, '#f2d03b'); band(r, v - thick / 2, v + thick / 2, '#d7d7d2'); band(r, v + thick / 2, v + thick / 2 + 0.012, '#f2d03b');
      x.globalAlpha = 0.35; x.fillStyle = '#ffffff'; x.fillRect(r[0], r[1] + r[3] * (1 - v - thick / 2) + 2, r[2], 3); x.globalAlpha = 1;
    }
    function panelLines(r, n, col) { x.strokeStyle = col; x.lineWidth = 1.5; x.globalAlpha = 0.55; for (var i = 1; i < n; i++) { x.beginPath(); x.moveTo(r[0], r[1] + r[3] * i / n); x.lineTo(r[0] + r[2], r[1] + r[3] * i / n); x.stroke(); } x.globalAlpha = 1; }
    function rivets(r, n, col) { x.fillStyle = col; for (var i = 0; i < n; i++) { x.beginPath(); x.arc(r[0] + 4 + rnd() * (r[2] - 8), r[1] + 4 + rnd() * (r[3] - 8), 1.6, 0, TAU); x.fill(); } }
    function furOn(reg, kind, col, alpha) {
      var r = R(reg); x.save(); x.beginPath(); x.rect(r[0], r[1], r[2], r[3]); x.clip();
      if (kind === 'stripes') {
        x.strokeStyle = col; x.lineWidth = 4; x.globalAlpha = alpha || 0.85; x.lineCap = 'round';
        for (var i = 0; i < 10; i++) { var yy = r[1] + (i + 0.5) * r[3] / 10; x.beginPath(); x.moveTo(r[0] - 4, yy + (rnd() - 0.5) * 6); x.quadraticCurveTo(r[0] + r[2] * 0.5, yy + (rnd() - 0.5) * 10, r[0] + r[2] + 4, yy + (rnd() - 0.5) * 6); x.stroke(); }
      } else if (kind === 'scales') {
        x.strokeStyle = col; x.lineWidth = 1.2; x.globalAlpha = alpha || 0.5;
        for (var yy2 = r[1]; yy2 < r[1] + r[3]; yy2 += 6) for (var xx = r[0] + ((yy2 / 6) % 2) * 4; xx < r[0] + r[2]; xx += 8) { x.beginPath(); x.arc(xx, yy2, 4, 0, Math.PI); x.stroke(); }
      } else {
        x.strokeStyle = col; x.lineWidth = 1.2; x.globalAlpha = alpha || 0.5;
        var n = Math.round(r[2] * r[3] / 22);
        for (var k = 0; k < n; k++) { var sx = r[0] + rnd() * r[2], sy = r[1] + rnd() * r[3]; x.beginPath(); x.moveTo(sx, sy); x.lineTo(sx + (rnd() - 0.5) * 3, sy + 4 + rnd() * 5); x.stroke(); }
      }
      x.globalAlpha = 1; x.restore();
    }
    var fr = R('face'), FX = fr[0] + PAD, FY = fr[1] + PAD, FW = fr[2] - 2 * PAD, FH = fr[3] - 2 * PAD;
    function P(hx, hy) { return [FX + (0.5 + hx / (2 * FACE_HW)) * FW, FY + (1 - (0.5 + hy / (2 * FACE_HH))) * FH]; }
    var skinRegs = ['arm', 'fore', 'hand', 'thigh', 'shin', 'foot', 'neck', 'head'];
    // ---------- bulu / sisik pada kulit ----------
    if (look.fur || look.scales) {
      var kindF = look.scales ? 'scales' : look.fur, colF = look.furC || U.mixHex(skin, '#000000', 0.45);
      skinRegs.forEach(function (rg) { if (!(info.longSleeve && (rg === 'arm' || rg === 'fore'))) furOn(rg, kindF, colF, kindF === 'stripes' ? 0.85 : 0.45); });
      // wajah: hindari area mata
      x.save(); x.beginPath(); x.rect(fr[0], fr[1], fr[2], fr[3]); var e1 = P(-0.036, 0.012), e2 = P(0.036, 0.012);
      x.rect(e1[0] - 16, e1[1] - 10, 32, 20); x.rect(e2[0] - 16, e2[1] - 10, 32, 20); x.clip('evenodd');
      furOn('face', kindF, colF, kindF === 'stripes' ? 0.7 : 0.35); x.restore();
    }
    // ---------- kostum ----------
    if (look.outfit === 'coverall') {
      var cc = info.c1, cd = U.mixHex(cc, '#000000', 0.22);
      x.fillStyle = cc; x.fillRect(TX, TY, TW, TH);
      // resleting depan, saku dada, lipatan
      x.fillStyle = cd; x.fillRect(tx(0.25) - 2, ty(0.98), 4, ty(0.2) - ty(0.98));
      [0.14, 0.36].forEach(function (u) { x.fillStyle = cd; x.fillRect(tx(u) - 14, ty(0.72), 28, 22); x.fillStyle = cc; x.fillRect(tx(u) - 13, ty(0.72) + 2, 26, 18); x.fillStyle = cd; x.fillRect(tx(u) - 14, ty(0.72), 28, 4); });
      reflect(tr, 0.6, 0.05); reflect(tr, 0.22, 0.05);
      x.fillStyle = '#ffffff'; x.fillRect(tx(0.36) - 16, ty(0.8) - 1, 32, 8); x.fillStyle = '#1b1b1b'; x.font = 'bold 7px "Barlow Semi Condensed", "Arial Narrow", sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
      x.fillText(String(pc.name || '').toUpperCase().slice(0, 9), tx(0.36), ty(0.8) + 3);
      x.fillStyle = '#ffffff'; x.font = 'bold 9px Bungee, Impact, sans-serif'; x.fillText('RIG ' + (team.short || ''), tx(0.14), ty(0.56));
      // punggung: nomor & tulisan
      var nfg2 = U.lum(cc) > 0.6 ? '#1b1b1b' : '#ffffff';
      x.fillStyle = nfg2; x.font = 'bold 56px Bungee, Impact, "Arial Black", sans-serif'; x.fillText(String(pc.num | 0), tx(0.75), ty(0.5));
      x.font = 'bold 13px "Barlow Semi Condensed", sans-serif'; x.fillText('SAFETY FIRST', tx(0.75), ty(0.8));
      x.fillText(String(pc.name || '').toUpperCase().slice(0, 12), tx(0.75), ty(0.3));
      ['arm', 'fore', 'thigh', 'shin'].forEach(function (rg) { var r = R(rg); x.fillStyle = cc; x.fillRect(r[0], r[1], r[2], r[3]); });
      reflect(R('arm'), 0.4, 0.08); reflect(R('fore'), 0.15, 0.1); reflect(R('shin'), 0.5, 0.08);
      // sarung tangan & sepatu safety
      var hr = R('hand'); x.fillStyle = '#d9d2c5'; x.fillRect(hr[0], hr[1], hr[2], hr[3]); x.fillStyle = '#6b5a3e'; x.fillRect(hr[0], hr[1] + hr[3] * 0.3, hr[2], hr[3] * 0.7); x.fillStyle = '#f2d03b'; x.fillRect(hr[0], hr[1], hr[2], 5);
      var so = R('shoe'); x.fillStyle = '#3a2a1a'; x.fillRect(so[0], so[1], so[2], so[3]); x.fillStyle = '#f2d03b'; for (var l2 = 0; l2 < 4; l2++) x.fillRect(so[0] + 30 + l2 * 10, so[1] + 20, 4, 12);
      h.fill('acc3', info.isGK ? '#f2d03b' : '#f4f4f0'); var a3 = R('acc3'); x.fillStyle = '#d0d0c8'; x.fillRect(a3[0], a3[1] + a3[3] * 0.48, a3[2] * 0.5, 3); x.fillStyle = '#9fd8e8'; x.fillRect(a3[0] + a3[2] * 0.55, a3[1], a3[2] * 0.45, a3[3]); x.globalAlpha = 0.5; x.fillStyle = '#ffffff'; x.fillRect(a3[0] + a3[2] * 0.6, a3[1] + 6, a3[2] * 0.3, 6); x.globalAlpha = 1;
    } else if (look.outfit === 'robot') {
      var mc = look.skin || '#8d99ae', md = U.mixHex(mc, '#000000', 0.35), ml = U.mixHex(mc, '#ffffff', 0.25), ac = info.isGK ? team.gk : team.c2;
      [['torso', 1], ['arm', 1], ['fore', 1], ['thigh', 1], ['shin', 1], ['neck', 1], ['hand', 0.5], ['head', 1], ['foot', 1], ['shoe', 1], ['metal', 1]].forEach(function (e) {
        var r = R(e[0]); var g = x.createLinearGradient(r[0], r[1], r[0] + r[2], r[1] + r[3]); g.addColorStop(0, ml); g.addColorStop(0.5, mc); g.addColorStop(1, md); x.fillStyle = g; x.fillRect(r[0], r[1], r[2], r[3]);
        panelLines(r, e[0] === 'torso' ? 5 : 3, md); rivets(r, e[0] === 'torso' ? 18 : 6, md);
      });
      // sendi gelap
      [['arm', 0.5], ['fore', 0.1], ['thigh', 0.5], ['shin', 0.1], ['neck', 0.5]].forEach(function (e) { band(R(e[0]), e[1] - 0.04, e[1] + 0.04, '#2b2d33'); });
      // dada: inti bercahaya, garis aksen, nomor
      x.fillStyle = ac; x.fillRect(TX, ty(0.98), TW, 6); x.fillRect(TX, ty(vHem) - 6, TW, 6);
      x.fillStyle = '#1b1b1b'; x.beginPath(); x.arc(tx(0.25), ty(0.66), 15, 0, TAU); x.fill();
      var cg = x.createRadialGradient(tx(0.25), ty(0.66), 2, tx(0.25), ty(0.66), 12); cg.addColorStop(0, '#ffffff'); cg.addColorStop(0.5, look.visor || '#38e8ff'); cg.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = cg; x.beginPath(); x.arc(tx(0.25), ty(0.66), 12, 0, TAU); x.fill();
      x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillStyle = ac; x.font = 'bold 54px Bungee, Impact, "Arial Black", sans-serif'; x.fillText(String(pc.num | 0), tx(0.75), ty(0.55));
      x.fillStyle = '#ffffff'; x.font = 'bold 11px "Barlow Semi Condensed", sans-serif'; x.fillText(String(pc.name || '').toUpperCase().slice(0, 12), tx(0.75), ty(0.84));
      x.fillStyle = ac; x.fillRect(tx(0.08), ty(0.4), TW * 0.34, 4);
      // wajah: pelat logam + visor
      var g2 = x.createLinearGradient(fr[0], fr[1], fr[0], fr[1] + fr[3]); g2.addColorStop(0, ml); g2.addColorStop(1, md); x.fillStyle = g2; x.fillRect(fr[0], fr[1], fr[2], fr[3]);
      rivets(fr, 10, md);
      var vA = P(-0.09, 0.03), vB = P(0.09, -0.005);
      x.fillStyle = '#0d0f14'; x.fillRect(vA[0], vA[1], vB[0] - vA[0], vB[1] - vA[1]);
      var vg = x.createLinearGradient(vA[0], vA[1], vB[0], vA[1]); vg.addColorStop(0, look.visorGlow || look.visor); vg.addColorStop(0.5, '#ffffff'); vg.addColorStop(1, look.visorGlow || look.visor);
      x.fillStyle = vg; x.globalAlpha = 0.9; x.fillRect(vA[0] + 3, vA[1] + (vB[1] - vA[1]) * 0.35, vB[0] - vA[0] - 6, (vB[1] - vA[1]) * 0.3); x.globalAlpha = 1;
      // kisi bicara
      var m0 = P(-0.03, -0.05); x.fillStyle = md; for (var gi = 0; gi < 5; gi++) x.fillRect(m0[0] + gi * 6, m0[1], 3, 10);
      h.fill('glow', look.visor || '#38e8ff');
    } else if (look.outfit === 'kafan') {
      var kc = '#e9e4d6', kd = '#b9b2a0';
      ['torso', 'arm', 'fore', 'thigh', 'shin', 'neck', 'head', 'hand', 'foot', 'kafan', 'shoe'].forEach(function (rg) { var r = R(rg); x.fillStyle = kc; x.fillRect(r[0], r[1], r[2], r[3]); x.strokeStyle = kd; x.lineWidth = 1.5; x.globalAlpha = 0.6; for (var i = 0; i < 12; i++) { x.beginPath(); x.moveTo(r[0] + rnd() * r[2], r[1]); x.quadraticCurveTo(r[0] + rnd() * r[2], r[1] + r[3] / 2, r[0] + rnd() * r[2], r[1] + r[3]); x.stroke(); } x.globalAlpha = 1; });
      // tali pocong: leher, perut, lutut
      band(tr, 0.93, 0.98, '#8a7a5a'); band(tr, 0.3, 0.35, '#8a7a5a'); band(R('shin'), 0.86, 0.92, '#8a7a5a'); band(R('kafan'), 0.4, 0.5, '#8a7a5a');
      x.globalAlpha = 0.25; x.fillStyle = '#5a4a2a'; for (var nb = 0; nb < 30; nb++) { var rr = R(['torso', 'thigh', 'shin', 'kafan'][nb % 4]); x.beginPath(); x.ellipse(rr[0] + rnd() * rr[2], rr[1] + rnd() * rr[3], 6 + rnd() * 10, 3 + rnd() * 4, rnd() * 3, 0, TAU); x.fill(); } x.globalAlpha = 1;
      // wajah pucat kehijauan dengan rongga mata gelap
      var fg = x.createLinearGradient(fr[0], fr[1], fr[0], fr[1] + fr[3]); fg.addColorStop(0, '#d8ddd0'); fg.addColorStop(1, '#a9b3a0'); x.fillStyle = fg; x.fillRect(fr[0], fr[1], fr[2], fr[3]);
    } else if (look.outfit === 'daster') {
      var dc = '#f1efe9', dd = '#c9c4b6';
      ['torso', 'arm', 'fore', 'skirt'].forEach(function (rg) { var r = R(rg); x.fillStyle = dc; x.fillRect(r[0], r[1], r[2], r[3]); x.strokeStyle = dd; x.lineWidth = 2; x.globalAlpha = 0.6; for (var i = 0; i < 10; i++) { var sx = r[0] + (i + 0.5) * r[2] / 10; x.beginPath(); x.moveTo(sx, r[1]); x.quadraticCurveTo(sx + (rnd() - 0.5) * 12, r[1] + r[3] / 2, sx + (rnd() - 0.5) * 8, r[1] + r[3]); x.stroke(); } x.globalAlpha = 1; });
      // noda tanah & renda leher
      x.globalAlpha = 0.22; x.fillStyle = '#5a4a3a'; for (var nd = 0; nd < 14; nd++) { var rr2 = R(nd % 2 ? 'skirt' : 'torso'); x.beginPath(); x.ellipse(rr2[0] + rnd() * rr2[2], rr2[1] + rr2[3] * (0.5 + rnd() * 0.5), 8 + rnd() * 14, 4 + rnd() * 6, rnd() * 3, 0, TAU); x.fill(); } x.globalAlpha = 1;
      x.fillStyle = dd; x.fillRect(TX, ty(1), TW, 8);
      if (look.holeBack) { x.fillStyle = '#2a0f0f'; x.beginPath(); x.ellipse(tx(0.75), ty(0.62), 22, 30, 0, 0, TAU); x.fill(); x.fillStyle = '#6a1a1a'; x.beginPath(); x.ellipse(tx(0.75), ty(0.62), 14, 20, 0, 0, TAU); x.fill(); }
      ['thigh', 'shin'].forEach(function (rg) { h.grad(rg, skin, skinD); });
    } else if (look.outfit === 'safari' || look.outfit === 'batik' || look.outfit === 'rompi') {
      var pc1 = team.c1, pc2 = team.c2;
      if (look.outfit === 'safari') {
        var sc = info.isGK ? team.gk : U.mixHex(pc1, '#c8b890', 0.45), sd = U.mixHex(sc, '#000000', 0.3);
        x.fillStyle = sc; x.fillRect(TX, TY, TW, ty(vHem) - TY);
        // saku 4, kancing, epolet, kerah
        [[0.12, 0.72], [0.38, 0.72], [0.12, 0.32], [0.38, 0.32]].forEach(function (q) { x.fillStyle = sd; x.fillRect(tx(q[0]) - 15, ty(q[1]), 30, 26); x.fillStyle = sc; x.fillRect(tx(q[0]) - 14, ty(q[1]) + 2, 28, 23); x.fillStyle = sd; x.fillRect(tx(q[0]) - 15, ty(q[1]), 30, 5); });
        x.fillStyle = sd; x.fillRect(tx(0.25) - 1, ty(0.98), 2, ty(vHem) - ty(0.98)); for (var kb = 0; kb < 6; kb++) { x.fillStyle = '#2b2b2b'; x.beginPath(); x.arc(tx(0.25), ty(0.92 - kb * 0.13), 2.2, 0, TAU); x.fill(); }
        x.fillStyle = sd; x.fillRect(tx(0.0), ty(1), TW * 0.12, 6); x.fillRect(tx(0.38), ty(1), TW * 0.12, 6);
        var ar2 = R('arm'); x.fillStyle = sc; x.fillRect(ar2[0], ar2[1], ar2[2], ar2[3] * 0.5); x.fillStyle = sd; x.fillRect(ar2[0], ar2[1] + ar2[3] * 0.5 - 5, ar2[2], 5);
        h.grad('fore', skinL, skin);
      } else if (look.outfit === 'batik') {
        var bb = U.mixHex(pc1, '#5a3a1a', 0.35), bl = U.mixHex(pc2, '#ffffff', 0.3);
        ['torso', 'arm', 'fore'].forEach(function (rg) {
          var r = R(rg), lim = rg === 'torso' ? ty(vHem) - r[1] : r[3];
          x.fillStyle = bb; x.fillRect(r[0], r[1], r[2], lim);
          x.save(); x.beginPath(); x.rect(r[0], r[1], r[2], lim); x.clip();
          x.strokeStyle = bl; x.lineWidth = 1.6; x.globalAlpha = 0.85;
          for (var yy = r[1] - 10; yy < r[1] + lim + 10; yy += 14) for (var xx = r[0] - 10; xx < r[0] + r[2] + 10; xx += 14) {
            x.beginPath(); x.arc(xx + ((yy / 14) % 2) * 7, yy, 4.5, 0, TAU); x.stroke(); x.beginPath(); x.arc(xx + ((yy / 14) % 2) * 7, yy, 1.5, 0, TAU); x.stroke();
          }
          x.strokeStyle = pc2; x.globalAlpha = 0.6; for (var pg = -40; pg < r[2] + lim; pg += 22) { x.beginPath(); x.moveTo(r[0] + pg, r[1]); x.lineTo(r[0] + pg - lim, r[1] + lim); x.stroke(); }
          x.globalAlpha = 1; x.restore();
        });
        x.fillStyle = U.mixHex(bb, '#000000', 0.3); x.fillRect(TX, ty(1), TW, 7); for (var kb2 = 0; kb2 < 6; kb2++) { x.fillStyle = '#f4e8c8'; x.beginPath(); x.arc(tx(0.25), ty(0.92 - kb2 * 0.13), 2.2, 0, TAU); x.fill(); }
      } else {
        // rompi partai di atas kemeja putih
        x.fillStyle = '#f7f5ef'; x.fillRect(TX, TY, TW, ty(vHem) - TY); ['arm', 'fore'].forEach(function (rg) { var r = R(rg); x.fillStyle = '#f7f5ef'; x.fillRect(r[0], r[1], r[2], r[3]); });
        x.fillStyle = pc1; x.fillRect(tx(0.06), ty(0.98), TW * 0.38, ty(vHem) - ty(0.98)); x.fillRect(tx(0.56), ty(0.98), TW * 0.38, ty(vHem) - ty(0.98));
        x.fillStyle = pc2; x.fillRect(tx(0.06), ty(0.98), TW * 0.38, 5); x.fillRect(tx(0.56), ty(0.98), TW * 0.38, 5); x.fillRect(tx(0.06), ty(vHem) - 5, TW * 0.38, 5); x.fillRect(tx(0.56), ty(vHem) - 5, TW * 0.38, 5);
        x.fillStyle = pc2; x.fillRect(tx(0.25) - 2, ty(0.98), 4, ty(vHem) - ty(0.98));
        x.textAlign = 'center'; x.textBaseline = 'middle'; var vf = U.lum(pc1) > 0.6 ? '#1b1b1b' : '#ffffff';
        x.fillStyle = vf; x.font = 'bold 44px Bungee, Impact, "Arial Black", sans-serif'; x.fillText(String(pc.num | 0), tx(0.75), ty(0.55));
        x.font = 'bold 10px Bungee, Impact, sans-serif'; x.fillText('NO. URUT ' + (pc.num | 0), tx(0.75), ty(0.3));
        x.font = 'bold 9px Bungee, Impact, sans-serif'; x.fillText((team.short || 'PRT'), tx(0.14), ty(0.75));
        x.fillStyle = pc2; x.beginPath(); x.arc(tx(0.36), ty(0.75), 9, 0, TAU); x.fill(); x.fillStyle = pc1; x.beginPath(); x.arc(tx(0.36), ty(0.75), 5, 0, TAU); x.fill();
      }
      // celana kain gelap
      var pcol = '#2b2b33';
      x.fillStyle = pcol; x.fillRect(TX, ty(vHem), TW, TY + TH - ty(vHem)); ['thigh', 'shin', 'pants'].forEach(function (rg) { var r = R(rg); x.fillStyle = pcol; x.fillRect(r[0], r[1], r[2], r[3]); x.fillStyle = '#3a3a44'; x.fillRect(r[0] + r[2] / 2 - 1, r[1], 2, r[3]); });
      x.fillStyle = '#5a4a2a'; x.fillRect(TX, ty(vHem) - 3, TW, 6); x.fillStyle = '#c9a227'; x.fillRect(tx(0.25) - 5, ty(vHem) - 3, 10, 6);
      var so2 = R('shoe'); x.fillStyle = '#1b1b1b'; x.fillRect(so2[0], so2[1], so2[2], so2[3]); x.fillStyle = '#3a3a3a'; x.fillRect(so2[0], so2[1] + so2[3] * 0.4, so2[2], 3);
      h.fill('dark', '#141414'); var a1 = R('acc1'); x.fillStyle = '#111111'; x.fillRect(a1[0], a1[1], a1[2], a1[3]); x.fillStyle = '#333333'; x.fillRect(a1[0], a1[1] + a1[3] * 0.45, a1[2], 3);
    }
    // ---------- wajah khusus ----------
    if (look.kind === 'robot') return;
    var eyeC = look.eyes;
    [-1, 1].forEach(function (sd) {
      var e = P(sd * 0.036, 0.012);
      if (look.sockets) { x.fillStyle = 'rgba(20,10,20,0.75)'; x.beginPath(); x.ellipse(e[0], e[1], 13, 8, 0, 0, TAU); x.fill(); }
      if (look.bigEyes) { x.fillStyle = '#f5f1ea'; x.beginPath(); x.ellipse(e[0], e[1], 12, 8, 0, 0, TAU); x.fill(); }
      if (eyeC) {
        var r1 = look.bigEyes ? 6 : 4.2;
        x.fillStyle = eyeC; x.beginPath(); x.arc(e[0] + sd * 0.6, e[1] + 0.3, r1, 0, TAU); x.fill();
        x.fillStyle = '#060606';
        if (look.slit) { x.beginPath(); x.ellipse(e[0] + sd * 0.6, e[1] + 0.3, 1.1, r1 * 0.9, 0, 0, TAU); x.fill(); }
        else { x.beginPath(); x.arc(e[0] + sd * 0.6, e[1] + 0.3, r1 * 0.45, 0, TAU); x.fill(); }
        x.fillStyle = '#ffffff'; x.beginPath(); x.arc(e[0] + sd * 0.6 + 1.4, e[1] - 1.2, 1.1, 0, TAU); x.fill();
      }
    });
    var m = P(0, -0.058);
    if (look.lips) { x.strokeStyle = look.lips; x.lineWidth = 3; x.beginPath(); x.moveTo(m[0] - 14, m[1] - 1); x.quadraticCurveTo(m[0], m[1] + 4, m[0] + 14, m[1] - 1); x.stroke(); }
    if (look.fangs) { x.fillStyle = '#f7f3e8'; [-1, 1].forEach(function (sd) { x.beginPath(); x.moveTo(m[0] + sd * 10 - 3, m[1] - 1); x.lineTo(m[0] + sd * 10 + 3, m[1] - 1); x.lineTo(m[0] + sd * 10, m[1] + 9); x.closePath(); x.fill(); }); }
    if (look.tongue) { x.fillStyle = '#c0304a'; x.beginPath(); x.moveTo(m[0] - 2, m[1] + 2); x.lineTo(m[0] + 2, m[1] + 2); x.lineTo(m[0] + 3, m[1] + 14); x.lineTo(m[0], m[1] + 10); x.lineTo(m[0] - 3, m[1] + 14); x.closePath(); x.fill(); }
    if (look.snout) {
      // bantalan hidung gelap & garis moncong (dipetakan ke geometri moncong)
      var n1 = P(0, -0.015);
      x.fillStyle = look.snout === 'babi' ? U.mixHex(skin, '#c05070', 0.4) : U.mixHex(skin, '#ffffff', 0.25);
      x.beginPath(); x.ellipse(n1[0], n1[1] + 10, 24, 18, 0, 0, TAU); x.fill();
      x.fillStyle = look.snout === 'babi' ? '#7a3a4a' : '#1a1210';
      if (look.snout === 'babi') { x.beginPath(); x.ellipse(n1[0], n1[1] - 2, 14, 9, 0, 0, TAU); x.fill(); x.fillStyle = '#3a1a22'; [-1, 1].forEach(function (sd) { x.beginPath(); x.ellipse(n1[0] + sd * 5, n1[1] - 2, 3, 4, 0, 0, TAU); x.fill(); }); }
      else { x.beginPath(); x.moveTo(n1[0] - 8, n1[1] - 6); x.lineTo(n1[0] + 8, n1[1] - 6); x.lineTo(n1[0], n1[1] + 2); x.closePath(); x.fill(); x.fillRect(n1[0] - 1, n1[1], 2, 8); }
      if (look.whiskers) { x.strokeStyle = '#111'; x.lineWidth = 1; [-1, 1].forEach(function (sd) { for (var w = 0; w < 3; w++) { x.beginPath(); x.moveTo(n1[0] + sd * 8, n1[1] + 4 + w * 3); x.lineTo(n1[0] + sd * 30, n1[1] - 2 + w * 6); x.stroke(); } }); }
    }
    if (look.noseC) { var nn = P(0, -0.03); x.fillStyle = look.noseC; x.beginPath(); x.ellipse(nn[0], nn[1], 7, 5, 0, 0, TAU); x.fill(); }
    // warna aksesori (tanduk, telinga, ekor, helm)
    h.fill('acc2', look.hornC || (look.kind === 'mamalia' ? '#d9c9a8' : '#e8dcc0'));
    if (look.kind === 'siluman' || look.kind === 'mamalia') { h.fill('fur', look.furC || skinD); h.grad('acc1', skinL, skinD); }
    if (look.kind === 'migas' && !look.outfit) h.fill('acc3', '#f4f4f0');
  };

  /* ---------- geometri tambahan badan: ekor, bahu robot, kafan, daster ---------- */
  Looks.body = function (gb, pc, team, info, W, L, hs, ws, seg) {
    var look = info.look || {}; if (!look.kind) return;
    var pel = W.pelvis, PW = [[BN.pelvis, 1]];
    if (look.tail) {
      var rings = [], n = look.tail === 'pendek' ? 4 : 8, len = look.tail === 'pendek' ? 0.16 : (look.tail === 'ular' ? 0.75 : 0.55);
      for (var i = 0; i <= n; i++) {
        var t = i / n, r0 = look.tail === 'ular' ? 0.05 : 0.022;
        rings.push({ a: -0.02 - t * len, rx: r0 * (1 - t * 0.75) + 0.004, ry: r0 * (1 - t * 0.75) + 0.004, cy: -0.1 * hs + (look.tail === 'ular' ? -0.55 * hs * t + 0.05 * Math.sin(t * 6) : Math.sin(t * 2.6) * 0.16 - t * 0.05), v: 1 - t, w: t < 0.3 ? PW : PW });
      }
      gb.loft(rings, { o: [pel[0], pel[1], pel[2] - 0.1 * ws], axis: 'z', seg: 8, reg: look.scales ? 'acc1' : 'fur', capB: true });
    }
    if (look.shoulder) {
      [1, -1].forEach(function (s) {
        var sh = W['arm' + (s > 0 ? 'L' : 'R')];
        gb.blob([sh[0] + s * 0.02, sh[1] + 0.035, sh[2]], 0.085, 0.05, 0.08, 10, 6, 0, TAU, 0, Math.PI * 0.55, function (P, lx, ly, lz) { return uvOf('metal', 0.5 + lx * 0.4, 0.5 + ly * 0.4); }, function () { return W2(BN.chest, BN['arm' + (s > 0 ? 'L' : 'R')], 0.6); });
      });
    }
    if (look.outfit === 'kafan') {
      // kain kafan membungkus dari leher sampai mata kaki (lengan tetap keluar)
      var top = W.neck[1] - pel[1] + 0.02, bot = -0.95 * hs;
      var kr = [];
      for (var k = 0; k <= 7; k++) { var tt = k / 7, y = top + (bot - top) * tt; kr.push({ a: y, rx: (0.19 + Math.sin(tt * Math.PI) * 0.03) * ws, ry: (0.14 + Math.sin(tt * Math.PI) * 0.03) * ws, v: 1 - tt, w: tt < 0.3 ? W2(BN.pelvis, BN.chest, 1 - tt * 3) : PW }); }
      kr.push({ a: bot - 0.02, rx: 0.1 * ws, ry: 0.08 * ws, v: 0, w: PW });
      gb.loft(kr, { o: pel, axis: 'y', seg: seg + 6, reg: 'kafan', capB: true });
    }
    if (look.outfit === 'daster') {
      var dr = [];
      for (var d = 0; d <= 6; d++) { var td = d / 6, yd = 0.12 * hs - td * 1.02 * hs; dr.push({ a: yd, rx: (0.17 + td * 0.14) * ws, ry: (0.12 + td * 0.12) * ws, v: 1 - td, w: td < 0.2 ? W2(BN.pelvis, BN.spine, 0.5) : PW }); }
      gb.loft(dr, { o: pel, axis: 'y', seg: seg + 6, reg: 'skirt' });
    }
  };

  /* ---------- geometri tambahan kepala: tanduk, taring, telinga, moncong, antena, helm proyek, peci ---------- */
  Looks.head = function (gb, pc, team, info, c, rx, ry, rz, hs) {
    var look = info.look || {}; if (!look.kind) return;
    var H = [[BN.head, 1]];
    var accUV = function (reg) { return function (P, lx, ly, lz) { return uvOf(reg, 0.5 + lx * 0.45, 0.5 + ly * 0.3 + lz * 0.15); }; };
    function cone(o, len, r0, bend, reg, tilt) {
      var rings = [];
      for (var i = 0; i <= 5; i++) { var t = i / 5; rings.push({ a: t * len, rx: r0 * (1 - t * 0.85) + 0.002, ry: r0 * (1 - t * 0.85) + 0.002, cx: (bend ? bend[0] : 0) * t * t, cy: (bend ? bend[1] : 0) * t * t + (tilt || 0) * t, v: 1 - t, w: H }); }
      gb.loft(rings, { o: o, axis: 'y', seg: 8, reg: reg, capA: true, capB: true });
    }
    if (look.horns === 'satu') cone([c[0], c[1] + ry * 0.85, c[2] + rz * 0.3], 0.09, 0.02, [0, 0.03], 'acc2');
    if (look.horns === 'kerbau') [1, -1].forEach(function (s) { cone([c[0] + s * rx * 0.8, c[1] + ry * 0.55, c[2] - 0.01], 0.13, 0.022, [s * 0.09, -0.02], 'acc2'); });
    if (look.tusks) [1, -1].forEach(function (s) { cone([c[0] + s * 0.034, c[1] - ry * 0.62, c[2] + rz * 0.82], 0.045, 0.009, [s * 0.006, 0.012], 'white'); });
    if (look.ears === 'runcing') [1, -1].forEach(function (s) { gb.blob([c[0] + s * rx * 1.05, c[1] + 0.005, c[2] - 0.015], 0.05, 0.02, 0.022, 8, 6, 0, TAU, 0, Math.PI, function (P, lx, ly, lz) { return uvOf('acc1', 0.5 + lx * 0.4, 0.5 + ly * 0.4); }, function () { return H; }, function (P, lx) { if (lx * s > 0) { P[0] *= 1.3; P[1] *= 0.5; P[2] *= 0.6; } }); });
    if (look.ears === 'kucing') [1, -1].forEach(function (s) { cone([c[0] + s * rx * 0.62, c[1] + ry * 0.72, c[2] - 0.01], 0.06, 0.028, [s * 0.008, 0], 'acc1'); });
    if (look.ears === 'babi') [1, -1].forEach(function (s) { cone([c[0] + s * rx * 0.75, c[1] + ry * 0.6, c[2] - 0.01], 0.075, 0.03, [s * 0.03, 0.02], 'acc1'); });
    if (look.ears === 'bulat') [1, -1].forEach(function (s) { gb.blob([c[0] + s * rx * 0.8, c[1] + ry * 0.78, c[2] - 0.01], 0.034, 0.032, 0.016, 8, 6, 0, TAU, 0, Math.PI, function (P, lx, ly) { return uvOf('acc1', 0.5 + lx * 0.4, 0.5 + ly * 0.4); }, function () { return H; }); });
    if (look.ears === 'sapi') [1, -1].forEach(function (s) { gb.blob([c[0] + s * rx * 1.15, c[1] + ry * 0.25, c[2] - 0.02], 0.055, 0.02, 0.028, 8, 6, 0, TAU, 0, Math.PI, function (P, lx, ly) { return uvOf('acc1', 0.5 + lx * 0.4, 0.5 + ly * 0.4); }, function () { return H; }); });
    if (look.ears === 'jatuh') [1, -1].forEach(function (s) { gb.box([c[0] + s * rx * 0.98, c[1] + ry * 0.1, c[2] - 0.02], 0.016, 0.11, 0.05, uvOf('acc1', 0.5, 0.5), H); });
    if (look.snout) {
      var sz = { babi: [0.042, 0.034, 0.03], kucing: [0.044, 0.026, 0.03], anjing: [0.034, 0.03, 0.06], beruang: [0.04, 0.032, 0.055], sapi: [0.052, 0.036, 0.045], monyet: [0.042, 0.036, 0.03] }[look.snout] || [0.04, 0.03, 0.04];
      gb.blob([c[0], c[1] - 0.03, c[2] + rz * 0.78], sz[0], sz[1], sz[2], 10, 8, 0, TAU, 0, Math.PI, function (P, lx, ly, lz) { return faceUV(lx * 0.06, -0.015 + ly * 0.03 + (lz > 0 ? 0 : -0.01)); }, function () { return H; },
        function (P, lx, ly, lz) { if (lz < 0) P[2] *= 0.3; if (look.snout === 'babi' && lz > 0.6) P[2] *= 0.85; });
    }
    if (look.antenna) { gb.box([c[0] + 0.045, c[1] + ry * 0.9 + 0.035, c[2] - 0.01], 0.008, 0.07, 0.008, uvOf('metal', 0.5, 0.5), H); gb.blob([c[0] + 0.045, c[1] + ry * 0.9 + 0.075, c[2] - 0.01], 0.014, 0.014, 0.014, 6, 5, 0, TAU, 0, Math.PI, function () { return uvOf('glow', 0.5, 0.5); }, function () { return H; }); }
    if (look.headShape === 'box') {
      // pelipis & rahang logam
      [1, -1].forEach(function (s) { gb.box([c[0] + s * rx * 1.02, c[1] - 0.01, c[2] - 0.01], 0.02, 0.09, 0.09, uvOf('metal', 0.5, 0.5), H); });
    }
    if (look.hardhat) {
      gb.blob(c, rx + 0.024, ry + 0.02, rz + 0.026, 16, 8, 0, TAU, 0, Math.PI * 0.46, function (P, lx, ly, lz) { return uvOf('acc3', 0.05 + (0.5 + lx * 0.45) * 0.45, 0.5 + ly * 0.3 + lz * 0.15); }, function () { return H; }, function (P, lx, ly) { if (Math.abs(lx) < 0.12 && ly > 0.5) P[1] += 0.008; });
      gb.loft([{ a: ry * 0.34, rx: rx + 0.05, ry: rz + 0.06, cy: 0.012, v: 0.5, w: H }, { a: ry * 0.42, rx: rx + 0.05, ry: rz + 0.06, cy: 0.012, v: 0.45, w: H }, { a: ry * 0.42, rx: rx + 0.025, ry: rz + 0.027, v: 0.4, w: H }], { o: c, axis: 'y', seg: 18, reg: 'acc3', u0: 0.05, u1: 0.5 });
    }
    if (look.peci) {
      gb.loft([{ a: ry * 0.42, rx: rx + 0.012, ry: rz + 0.012, v: 1, w: H }, { a: ry * 0.42 + 0.075, rx: rx + 0.004, ry: rz + 0.004, v: 0, w: H }], { o: c, axis: 'y', seg: 18, reg: 'acc1', capB: true });
    }
    if (look.outfit === 'kafan') {
      // ikatan kain di atas kepala
      cone([c[0], c[1] + ry * 0.9, c[2]], 0.09, 0.05, null, 'kafan');
      gb.blob(c, rx + 0.014, ry + 0.012, rz + 0.014, 14, 8, 0, TAU, 0, Math.PI * 0.5, function (P, lx, ly, lz) { return uvOf('kafan', 0.5 + lx * 0.45, 0.5 + ly * 0.3 + lz * 0.15); }, function () { return H; }, function (P, lx, ly, lz) { if (lz > 0.3 && ly < 0.55) { P[0] *= 0.9; P[1] *= 0.9; P[2] *= 0.9; } });
    }
  };

  /* ---------- mata/visor menyala sebagai mesh kecil di tulang kepala ---------- */
  var glowCache = {};
  function glowMat(col) { if (!glowCache[col]) { glowCache[col] = new THREE.MeshBasicMaterial({ color: col }); glowCache[col].__baShared = true; } return glowCache[col]; }
  Looks.attach = function (ch, pc, team, info) {
    var look = pc.look || {}; if (!look.kind) return;
    ch.extras = [];
    var c = [0, 0.082, 0.016]; // pusat kepala relatif tulang kepala
    var rz = 0.105;
    if (look.glow && look.eyes) {
      [1, -1].forEach(function (s) {
        var m = new THREE.Mesh(R3.geo.sphereLo, glowMat(look.eyes));
        var r = look.bigEyes ? 0.012 : 0.0085;
        m.scale.setScalar(r); m.position.set(s * 0.036, c[1] + 0.012, c[2] + rz * 0.95);
        ch.B.head.add(m); ch.extras.push(m);
      });
    }
    if (look.visor) {
      var vm = new THREE.Mesh(R3.geo.box || new THREE.BoxGeometry(1, 1, 1), glowMat(look.visorGlow || look.visor));
      vm.scale.set(0.15, 0.012, 0.01); vm.position.set(0, c[1] + 0.012, c[2] + rz * 0.98);
      ch.B.head.add(vm); ch.extras.push(vm);
    }
  };

  /* ======================================================================
     4. POSE & ANIMASI
     ====================================================================== */
  var CH = ['rootY', 'rootX', 'rootZ', 'rootP', 'rootR', 'hipY', 'hipX', 'hipZ', 'pelX', 'pelY', 'pelZ', 'spX', 'spY', 'spZ', 'chX', 'chY', 'chZ', 'nkX', 'nkY', 'hdX', 'hdY', 'hdZ',
    'clL', 'clR', 'aLX', 'aLY', 'aLZ', 'fLX', 'fLY', 'hLX', 'hLZ', 'aRX', 'aRY', 'aRZ', 'fRX', 'fRY', 'hRX', 'hRZ',
    'tLX', 'tLY', 'tLZ', 'sLX', 'ftLX', 'ftLZ', 'toLX', 'tRX', 'tRY', 'tRZ', 'sRX', 'ftRX', 'ftRZ', 'toRX'];
  function zeroPose() {
    var P = {};
    CH.forEach(function (c) { P[c] = 0; });
    // lengan menggantung santai sedikit terbuka
    P.aLZ = 0.1; P.aRZ = 0.1; P.fLX = -0.18; P.fRX = -0.18; P.sLX = 0.04; P.sRX = 0.04;
    return P;
  }
  Chars.zeroPose = zeroPose;
  function mix(A, B, k) { var o = {}; for (var i = 0; i < CH.length; i++) { var c = CH[i]; o[c] = A[c] + (B[c] - A[c]) * k; } return o; }
  function bump(x, c, w) { var d = (x - c) / w; return d > -1 && d < 1 ? 0.5 + 0.5 * Math.cos(d * Math.PI) : 0; }
  function wrapPh(p) { p = p % TAU; return p < 0 ? p + TAU : p; }
  /* jarak sudut melingkar */
  function bumpC(ph, c, w) { var d = wrapPh(ph - c + Math.PI) - Math.PI; return bump(d, 0, w); }

  /* siklus langkah: ph 0 = tumit kiri menapak; s = laju (m/dt) */
  function gait(P, ph, s, o) {
    o = o || {};
    var run = sstep(1.6, 4.2, s), spr = o.sprint ? sstep(5.2, 7.2, s) : sstep(7, 8.5, s), walk = 1 - run;
    var drib = o.dribble ? 1 : 0;
    var A = (0.32 + 0.4 * run + 0.22 * spr) * (1 - drib * 0.22);
    var K = 0.55 + 0.75 * run + 0.55 * spr - drib * 0.1;
    function leg(sd, p) {
      var th = A * Math.cos(p);                                   // + = ke depan
      var swing = bumpC(p, Math.PI * 1.35, Math.PI * (0.55 + 0.1 * run));
      var load = bumpC(p, Math.PI * 0.22, Math.PI * 0.3);
      var kn = 0.1 + K * swing + (0.12 + 0.25 * run) * load + drib * 0.12;
      var ft = -0.18 * bumpC(p, 0, Math.PI * 0.25) + (0.45 + 0.3 * spr) * bumpC(p, Math.PI * 0.82, Math.PI * 0.28) - 0.12 * swing;
      P['t' + sd + 'X'] = -(th + 0.04 + 0.12 * spr * swing) - drib * 0.08;
      P['s' + sd + 'X'] = kn;
      P['ft' + sd + 'X'] = ft;
      P['to' + sd + 'X'] = -0.35 * bumpC(p, Math.PI * 0.82, Math.PI * 0.22);
    }
    leg('L', ph); leg('R', ph + Math.PI);
    var c2 = Math.cos(2 * ph - 0.7);
    P.hipY = -(0.012 + 0.02 * run + 0.015 * spr) * (0.5 + 0.5 * c2) - drib * 0.035 - 0.01 * run;
    P.hipX = 0.012 * walk * Math.sin(ph);
    P.pelY = -0.13 * (0.5 + run * 0.5) * Math.cos(ph);
    P.pelZ = 0.05 * Math.sin(ph) * (0.6 + 0.4 * walk);
    P.spX = 0.03 + 0.1 * run + 0.13 * spr + drib * 0.1;
    P.chY = 0.2 * (0.4 + 0.6 * run) * Math.cos(ph);
    P.chX = 0.02 + 0.03 * run;
    var B2 = (0.22 + 0.5 * run + 0.45 * spr) * (1 - drib * 0.55);
    P.aLX = B2 * Math.cos(ph) + 0.08 * run; P.aRX = -B2 * Math.cos(ph) + 0.08 * run;
    P.aLZ = 0.1 + 0.05 * run + drib * 0.28; P.aRZ = 0.1 + 0.05 * run + drib * 0.28;
    var el = 0.25 + 1.0 * run + 0.35 * spr;
    P.fLX = -(el + 0.25 * run * Math.max(0, -Math.cos(ph))); P.fRX = -(el + 0.25 * run * Math.max(0, Math.cos(ph)));
    P.hdX = -(P.spX + P.chX) * 0.45 + drib * 0.3;
    P.hdY = -P.chY * 0.6 - P.pelY * 0.3;
    P.nkX = 0.03;
  }

  /* langkah menyamping (kiper & bertahan) */
  function sideStep(P, ph, s, dirSide) {
    var a = Math.min(1, s / 3) * 0.3;
    var open = Math.max(0, Math.sin(ph)) * a;
    P.tLZ = 0.12 + (dirSide > 0 ? open : a - open) * 0.8; P.tRZ = 0.12 + (dirSide < 0 ? open : a - open) * 0.8;
    P.tLX = -0.25; P.tRX = -0.25; P.sLX = 0.45; P.sRX = 0.45;
    P.hipY = -0.07 - 0.02 * Math.abs(Math.cos(ph)); P.spX = 0.18;
    P.sLX += 0.12 * Math.max(0, Math.sin(ph)); P.sRX += 0.12 * Math.max(0, -Math.sin(ph));
  }

  function key(t, frames) {
    // interpolasi kurva halus antar bingkai kunci [[t, nilai], ...]
    if (t <= frames[0][0]) return frames[0][1];
    for (var i = 0; i < frames.length - 1; i++) {
      var a = frames[i], b = frames[i + 1];
      if (t <= b[0]) { var k = (t - a[0]) / (b[0] - a[0]); k = k * k * (3 - 2 * k); return a[1] + (b[1] - a[1]) * k; }
    }
    return frames[frames.length - 1][1];
  }

  Chars.CONTACT = 0.1; // detik dari awal animasi tendang ke saat kaki menyentuh bola

  Char.prototype.target = function (anim, t, sp, aT, o) {
    var P = zeroPose(), self = this, v = this.var;
    o = o || {};
    var ph = this.phase;
    switch (anim) {
      case 'run':
        if (o.side) { sideStep(P, ph, sp, o.side); break; }
        gait(P, ph, sp, { sprint: o.sprint, dribble: o.dribble });
        if (o.back) { P.spX -= 0.12; P.hdX += 0.08; }
        P.rootR = U.clamp(-this.turnRate * 0.045 * Math.min(1, sp / 6), -0.28, 0.28);
        break;
      case 'kick': case 'shoot': {
        var T = U.clamp(aT, 0, 0.6), c = Chars.CONTACT;
        // kaki kanan menendang, kaki kiri menumpu
        P.tRX = key(T, [[0, 0.75], [c * 0.45, 0.85], [c, -0.42], [0.24, -1.25], [0.42, -0.5], [0.6, -0.1]]);
        P.sRX = key(T, [[0, 1.65], [c * 0.45, 1.85], [c, 0.22], [0.24, 0.38], [0.42, 0.75], [0.6, 0.3]]);
        P.ftRX = key(T, [[0, 0.55], [c, 0.65], [0.24, 0.45], [0.6, 0.05]]);
        P.tRY = 0.08;
        P.tLX = key(T, [[0, -0.42], [c, -0.18], [0.24, 0.12], [0.6, -0.1]]); P.sLX = key(T, [[0, 0.35], [c, 0.5], [0.24, 0.3], [0.6, 0.15]]);
        P.ftLX = -0.05;
        P.hipY = key(T, [[0, -0.04], [c, -0.07], [0.24, 0.02], [0.45, -0.02], [0.6, 0]]);
        P.spX = key(T, [[0, -0.12], [c, 0.08], [0.24, -0.12], [0.6, 0.04]]);
        P.chY = key(T, [[0, -0.42], [c, 0.08], [0.24, 0.32], [0.6, 0.05]]);
        P.pelY = key(T, [[0, -0.25], [c, 0.1], [0.24, 0.3], [0.6, 0]]);
        P.aLZ = key(T, [[0, 1.05], [c, 1.25], [0.3, 0.8], [0.6, 0.25]]); P.aLX = key(T, [[0, -0.35], [c, -0.55], [0.3, 0.2], [0.6, 0]]);
        P.aRZ = key(T, [[0, 0.55], [c, 0.35], [0.3, 0.6], [0.6, 0.2]]); P.aRX = key(T, [[0, 0.55], [c, -0.3], [0.3, -0.6], [0.6, -0.1]]);
        P.fLX = -0.5; P.fRX = -0.6;
        P.hdX = 0.22; P.rootR = key(T, [[0, 0], [c, -0.06], [0.3, 0.04], [0.6, 0]]);
        break;
      }
      case 'pass': {
        var Tp = U.clamp(aT, 0, 0.4), cp = 0.08;
        P.tRX = key(Tp, [[0, 0.4], [cp, -0.28], [0.2, -0.62], [0.4, -0.1]]);
        P.sRX = key(Tp, [[0, 0.85], [cp, 0.2], [0.2, 0.3], [0.4, 0.2]]);
        P.tRY = key(Tp, [[0, 0.3], [cp, 0.65], [0.2, 0.55], [0.4, 0.1]]); // kaki bagian dalam
        P.ftRX = 0.1; P.tLX = -0.15; P.sLX = 0.35; P.hipY = -0.04;
        P.spX = 0.08; P.chY = key(Tp, [[0, -0.2], [cp, 0.1], [0.4, 0]]);
        P.aLZ = 0.6; P.aLX = -0.2; P.aRZ = 0.35; P.aRX = 0.15; P.fLX = -0.6; P.fRX = -0.5; P.hdX = 0.18;
        break;
      }
      case 'aim': {
        // ancang-ancang tendangan keras, sedikit bergetar
        var trem = Math.sin(t * 38) * 0.012;
        P.tRX = 0.7 + trem; P.sRX = 1.6; P.ftRX = 0.5; P.tLX = -0.35; P.sLX = 0.4;
        P.hipY = -0.05; P.spX = -0.1; P.chY = -0.4; P.pelY = -0.22;
        P.aLZ = 1.0; P.aLX = -0.3; P.aRZ = 0.55; P.aRX = 0.5; P.fLX = -0.4; P.fRX = -0.5; P.hdX = 0.2;
        break;
      }
      case 'tackle': {
        if (o.slide) {
          // sliding tackle: rebah ke samping, kaki kanan lurus ke depan
          P.hipY = -0.66; P.rootP = 0; P.rootR = 0.32;
          P.tRX = -1.42; P.sRX = 0.08; P.ftRX = 0.35; P.tLX = -0.55; P.sLX = 1.9; P.tLZ = 0.35;
          P.spX = -0.5; P.chX = -0.1; P.hdX = 0.45;
          P.aLZ = 1.25; P.aLX = 0.35; P.fLX = -0.2; P.aRZ = 0.9; P.aRX = -0.6; P.fRX = -0.4;
        } else {
          var Tt = U.clamp(aT, 0, 0.4);
          P.tRX = key(Tt, [[0, 0.1], [0.12, -0.95], [0.4, -0.5]]); P.sRX = key(Tt, [[0, 0.6], [0.12, 0.15], [0.4, 0.4]]); P.tRY = 0.5;
          P.tLX = 0.15; P.sLX = 0.7; P.hipY = -0.14; P.spX = 0.35; P.hdX = 0.1;
          P.aLZ = 0.8; P.aLX = -0.4; P.aRZ = 0.6; P.aRX = 0.4; P.fLX = -0.7; P.fRX = -0.6;
        }
        break;
      }
      case 'stun': {
        P.rootR = Math.sin(t * 11) * 0.14; P.spX = 0.25; P.hdX = 0.35; P.hipY = -0.08;
        P.aLZ = 0.9 + Math.sin(t * 17) * 0.4; P.aRZ = 0.9 + Math.cos(t * 15) * 0.4; P.aLX = -0.4; P.aRX = 0.3; P.fLX = -0.6; P.fRX = -0.8;
        P.sLX = 0.4; P.sRX = 0.55; P.tLX = -0.2; P.tRX = 0.1;
        break;
      }
      case 'celebrate': {
        var moving = sp > 1.2;
        if (moving) gait(P, ph, sp, { sprint: sp > 6 });
        if (v === 0) { // pesawat
          P.aLZ = 1.55; P.aRZ = 1.55; P.aLX = 0; P.aRX = 0; P.fLX = -0.05; P.fRX = -0.05;
          P.rootR = Math.sin(t * 2.6) * 0.32; P.chY = 0; P.hdX = -0.1;
        } else if (v === 1) { // tinju ke langit
          var jmp = moving ? 0 : Math.max(0, Math.sin(t * 5.5));
          P.rootY = jmp * 0.32; P.aRX = -2.9; P.aRZ = 0.2; P.fRX = -0.15; P.aLZ = 0.5; P.aLX = -0.3; P.fLX = -1.4;
          if (!moving) { P.tLX = -0.3 * (1 - jmp); P.sLX = 0.6 * (1 - jmp) + 0.1; P.tRX = -0.3 * (1 - jmp); P.sRX = 0.6 * (1 - jmp) + 0.1; }
          P.hdX = -0.35;
        } else if (v === 2) { // seluncur lutut lalu tangan terbuka
          if (!moving || sp < 3.2) {
            P.hipY = -0.48; P.tLX = 0.05; P.sLX = 2.3; P.tRX = 0.05; P.sRX = 2.3; P.ftLX = 0.9; P.ftRX = 0.9;
            P.spX = -0.4; P.hdX = -0.45; P.aLZ = 1.75; P.aRZ = 1.75; P.aLX = -0.5; P.aRX = -0.5; P.fLX = -0.3; P.fRX = -0.3;
          } else { P.aLZ = 0.9; P.aRZ = 0.9; P.aLX = -1.2; P.aRX = -1.2; }
        } else { // joget kampung
          var j = t * 7;
          P.hipX = Math.sin(j) * 0.06; P.pelZ = Math.sin(j) * 0.12; P.chZ = -Math.sin(j) * 0.14; P.hipY = -0.06 - Math.abs(Math.sin(j)) * 0.04;
          P.aLX = -1.2 + Math.sin(j * 0.5) * 0.4; P.aRX = -1.2 - Math.sin(j * 0.5) * 0.4; P.aLZ = 0.7; P.aRZ = 0.7; P.fLX = -1.3; P.fRX = -1.3;
          P.hLX = Math.sin(j) * 0.6; P.hRX = -Math.sin(j) * 0.6;
          if (!moving) { P.sLX = 0.35 + Math.max(0, Math.sin(j)) * 0.3; P.sRX = 0.35 + Math.max(0, -Math.sin(j)) * 0.3; P.tLX = -0.2; P.tRX = -0.2; }
          P.hdZ = Math.sin(j) * 0.15;
        }
        break;
      }
      case 'cheer': { // kawan setim: lompat dan tepuk tangan
        var jj = Math.max(0, Math.sin(t * 6 + v));
        P.rootY = jj * 0.18; P.aLX = -1.7; P.aRX = -1.7; P.aLZ = 0.25 + Math.abs(Math.sin(t * 12)) * 0.25; P.aRZ = P.aLZ; P.fLX = -0.9; P.fRX = -0.9;
        P.sLX = 0.2 + 0.4 * (1 - jj); P.sRX = P.sLX; P.tLX = -0.15 * (1 - jj); P.tRX = P.tLX; P.hdX = -0.25;
        break;
      }
      case 'sad': {
        if (sp > 0.8) gait(P, ph, sp, {});
        if (v % 2 === 0) { // tangan di kepala
          P.aLX = -2.5; P.aRX = -2.5; P.aLZ = 0.55; P.aRZ = 0.55; P.fLX = -2.1; P.fRX = -2.1; P.hdX = 0.25; P.spX = 0.05;
        } else { // membungkuk, tangan di lutut
          P.spX = 0.55; P.hdX = 0.1; P.aLX = -0.55; P.aRX = -0.55; P.aLZ = 0.15; P.aRZ = 0.15; P.fLX = -0.2; P.fRX = -0.2;
          P.tLX = -0.35; P.tRX = -0.35; P.sLX = 0.6; P.sRX = 0.6; P.hipY = -0.1;
        }
        break;
      }
      case 'gkReady': {
        if (o.side) sideStep(P, ph, sp, o.side);
        else {
          P.tLZ = 0.24; P.tRZ = 0.24; P.tLX = -0.55; P.tRX = -0.55; P.sLX = 0.95; P.sRX = 0.95; P.ftLX = -0.35; P.ftRX = -0.35;
          P.hipY = -0.17 + Math.sin(t * 6.5) * 0.012;
        }
        P.spX = 0.38; P.chX = 0.05; P.hdX = -0.3;
        P.aLX = -0.75; P.aRX = -0.75; P.aLZ = 0.48; P.aRZ = 0.48; P.fLX = -0.65; P.fRX = -0.65; P.hLX = -0.6; P.hRX = -0.6;
        break;
      }
      case 'gkHold': {
        if (sp > 0.6) gait(P, ph, sp, {});
        P.aLX = -0.95; P.aRX = -0.95; P.aLZ = 0.32; P.aRZ = 0.32; P.fLX = -1.95; P.fRX = -1.95; P.fLY = 0.5; P.fRY = 0.5; P.spX += 0.12; P.hdX = 0.15;
        break;
      }
      case 'gkDive': {
        var dd = o.dive || 1, k2 = U.clamp(aT / 0.35, 0, 1);
        if (o.forward) {
          // menyergap ke depan, rendah
          P.rootP = 1.25 * k2; P.hipY = -0.55 * k2; P.aLX = -2.8; P.aRX = -2.8; P.aLZ = 0.2; P.aRZ = 0.2; P.fLX = -0.2; P.fRX = -0.2;
          P.tLX = 0.3; P.tRX = 0.3; P.sLX = 0.4; P.sRX = 0.4; P.hdX = -0.6;
        } else {
          // terbang ke samping
          P.rootR = -dd * 1.35 * k2; P.rootY = 0.25 * Math.sin(k2 * Math.PI * 0.8);
          var up = dd > 0 ? 'L' : 'R', dn = dd > 0 ? 'R' : 'L';
          P['a' + up + 'Z'] = 2.75; P['a' + up + 'X'] = -0.25; P['f' + up + 'X'] = -0.1;
          P['a' + dn + 'Z'] = 2.35; P['a' + dn + 'X'] = -0.55; P['f' + dn + 'X'] = -0.25;
          P['t' + up + 'Z'] = 0.35; P['t' + dn + 'Z'] = 0.05; P.tLX = -0.2; P.tRX = -0.35; P.sLX = 0.5; P.sRX = 0.6;
          P.spZ = dd * 0.15; P.hdZ = dd * 0.1;
        }
        break;
      }
      case 'gkCatchHigh': {
        P.aLX = -2.7; P.aRX = -2.7; P.aLZ = 0.22; P.aRZ = 0.22; P.fLX = -0.5; P.fRX = -0.5; P.hLX = -0.8; P.hRX = -0.8;
        P.rootY = 0.12; P.tLX = -0.1; P.sLX = 0.3; P.ftLX = 0.4; P.ftRX = 0.4; P.hdX = -0.45;
        break;
      }
      case 'gkCatchLow': {
        P.spX = 0.8; P.hipY = -0.22; P.tLX = -0.55; P.tRX = -0.55; P.sLX = 1.0; P.sRX = 1.0; P.tLZ = 0.12; P.tRZ = 0.12;
        P.aLX = -0.4; P.aRX = -0.4; P.aLZ = 0.08; P.aRZ = 0.08; P.fLX = -0.8; P.fRX = -0.8; P.hdX = -0.2;
        break;
      }
      case 'throw': {
        var Tw = U.clamp(aT / 0.42, 0, 1);
        P.aRX = key(Tw, [[0, 2.3], [0.35, 2.6], [0.55, -0.8], [1, -0.3]]); P.fRX = key(Tw, [[0, -1.2], [0.4, -1.4], [0.6, -0.2], [1, -0.4]]);
        P.aRZ = 0.25; P.aLX = key(Tw, [[0, -1.0], [0.5, -0.8], [1, 0.2]]); P.aLZ = 0.4; P.fLX = -0.5;
        P.tLX = key(Tw, [[0, -0.1], [0.5, -0.5], [1, -0.3]]); P.sLX = 0.3; P.tRX = 0.2; P.sRX = 0.4;
        P.spX = key(Tw, [[0, -0.2], [0.55, 0.3], [1, 0.1]]); P.chY = key(Tw, [[0, -0.5], [0.55, 0.3], [1, 0]]);
        break;
      }
      case 'punt': {
        // tendangan lambung kiper dari tangan
        var Tq = U.clamp(aT, 0, 0.6);
        P.tRX = key(Tq, [[0, 0.5], [0.1, -0.6], [0.28, -1.6], [0.6, -0.3]]); P.sRX = key(Tq, [[0, 1.3], [0.1, 0.25], [0.28, 0.2], [0.6, 0.4]]);
        P.ftRX = 0.5; P.tLX = 0.1; P.sLX = 0.3; P.spX = key(Tq, [[0, 0.05], [0.28, -0.3], [0.6, 0]]);
        P.aLZ = 1.2; P.aRZ = 0.9; P.aLX = -0.6; P.aRX = 0.3;
        break;
      }
      case 'throwin': {
        // lemparan ke dalam: bola di atas kepala, badan melengkung lalu melempar
        var Ti = U.clamp(aT, 0, 1), rel = o.release ? U.clamp(o.release / 0.35, 0, 1) : 0;
        var up = -2.9 + rel * 1.4;
        P.aLX = up; P.aRX = up; P.aLZ = 0.2; P.aRZ = 0.2; P.fLX = -1.25 + rel * 1.0; P.fRX = -1.25 + rel * 1.0;
        P.spX = -0.22 + rel * 0.5; P.chX = -0.1 + rel * 0.15; P.hdX = -0.15 + rel * 0.2;
        P.tLX = -0.25; P.sLX = 0.25; P.tRX = 0.15; P.sRX = 0.2; P.ftRX = 0.4;
        void Ti;
        break;
      }
      // ----- jurus silat kiper (adegan) -----
      case 'silat_palm': {
        var s1 = U.clamp(aT / 0.18, 0, 1);
        P.tLZ = 0.42; P.tRZ = 0.42; P.tLX = -0.5; P.tRX = -0.5; P.sLX = 0.95; P.sRX = 0.95; P.hipY = -0.24;
        P.aRX = -1.55 * s1; P.aRZ = 0.05; P.fRX = -0.05; P.hRX = 1.2 * s1;
        P.aLX = 0.2; P.aLZ = 0.35; P.fLX = -1.9; P.chY = 0.35 * s1; P.spX = 0.1 - 0.1 * s1; P.hdX = -0.15;
        break;
      }
      case 'silat_claw': {
        var s2 = U.clamp(aT / 0.2, 0, 1);
        P.tLX = -0.7; P.sLX = 0.9; P.tRX = 0.35; P.sRX = 0.25; P.hipY = 0.05;
        P.aLZ = 2.4 - s2 * 0.8; P.aRZ = 2.4 - s2 * 0.8; P.aLX = -0.8 * s2; P.aRX = -0.8 * s2; P.fLX = -1.0; P.fRX = -1.0; P.hLX = -0.6; P.hRX = -0.6;
        P.spX = -0.15 + s2 * 0.35; P.hdX = -0.2;
        break;
      }
      case 'silat_stance': {
        P.tLZ = 0.55; P.tRZ = 0.55; P.tLX = -0.5; P.tRX = -0.5; P.sLX = 1.05; P.sRX = 1.05; P.hipY = -0.32;
        P.aLX = -1.3; P.aRX = -1.3; P.fLX = -1.45; P.fRX = -1.45; P.aLZ = -0.3; P.aRZ = -0.3; P.spX = 0.05;
        break;
      }
      case 'silat_wings': {
        var s3 = U.clamp(aT / 0.25, 0, 1);
        P.aLZ = 1.55 * s3 + 0.1; P.aRZ = 1.55 * s3 + 0.1; P.aLX = -0.2; P.aRX = -0.2; P.fLX = -0.05; P.fRX = -0.05;
        P.tLX = -0.3; P.sLX = 0.55; P.rootY = 0.06; P.hdX = -0.25; P.spX = -0.1;
        break;
      }
      case 'silat_both': {
        var s4 = U.clamp(aT / 0.18, 0, 1);
        P.aLX = -1.5 * s4; P.aRX = -1.5 * s4; P.fLX = -0.08; P.fRX = -0.08; P.aLZ = 0.16; P.aRZ = 0.16; P.hLX = 1.0 * s4; P.hRX = 1.0 * s4;
        P.tLZ = 0.35; P.tRZ = 0.35; P.tLX = -0.35; P.tRX = -0.35; P.sLX = 0.7; P.sRX = 0.7; P.hipY = -0.14; P.spX = 0.1;
        break;
      }
      case 'silat_stomp': {
        var s5 = U.clamp(aT / 0.3, 0, 1);
        P.tLX = key(s5, [[0, -1.25], [0.6, -1.3], [1, -0.35]]); P.sLX = key(s5, [[0, 1.7], [0.6, 1.6], [1, 0.6]]);
        P.hipY = key(s5, [[0, 0.05], [1, -0.25]]); P.tLZ = 0.4; P.tRZ = 0.3; P.sRX = 0.6; P.tRX = -0.3;
        P.aLZ = 1.25; P.aRZ = 1.25; P.fLX = -0.8; P.fRX = -0.8; P.aLX = -0.2; P.aRX = -0.2;
        break;
      }
      default: { // idle
        var br = Math.sin(t * 2.1) * 0.012;
        P.chX = br; P.hipY = -0.005 + br * 0.3;
        P.hdY = Math.sin(t * 0.37 + v) * 0.35; P.hdX = Math.sin(t * 0.5) * 0.05;
        P.tLZ = 0.06; P.tRZ = 0.06;
        if (v === 1 && !o.gk) { P.aLZ = 0.55; P.aRZ = 0.55; P.aLX = 0.35; P.aRX = 0.35; P.fLX = -2.0; P.fRX = -2.0; P.fLY = 1.0; P.fRY = 1.0; } // tangan di pinggang
        else if (v === 2) { P.sLX = 0.15 + Math.max(0, Math.sin(t * 6)) * 0.1; P.sRX = 0.15 + Math.max(0, -Math.sin(t * 6)) * 0.1; P.hipY -= 0.02; } // jinjit lompat kecil
        else { P.pelZ = Math.sin(t * 0.8) * 0.03; P.tLX = 0.02; P.sLX = 0.08; }
      }
    }
    void self;
    return P;
  };

  /* panggil tiap frame. x,z,facing dari simulasi */
  Char.prototype.update = function (dt, x, z, facing, anim, aT, opts) {
    opts = opts || {};
    this.t += dt;
    if (this.lastX === null) { this.lastX = x; this.lastZ = z; }
    var mx = x - this.lastX, mz = z - this.lastZ, mv = Math.sqrt(mx * mx + mz * mz);
    var inst = dt > 0 ? mv / dt : 0;
    if (inst > 25) { inst = 0; mx = mz = 0; } // teleport
    this.speed = U.damp(this.speed, inst, 9, dt);
    if (dt > 0 && inst < 25) { this.vx = U.damp(this.vx, mx / dt, 9, dt); this.vz = U.damp(this.vz, mz / dt, 9, dt); }
    this.lastX = x; this.lastZ = z;
    this.root.position.x = x; this.root.position.z = z;
    if (this.look.float) { var fl = 0.1 + Math.sin(this.t * 2.3 + this.phase) * 0.05; this.root.position.y = fl; this.shadow.position.y = 0.02 - fl; }
    if (U.fin(facing)) {
      var cur = this.root.rotation.y;
      var nf = U.angLerp(cur, facing, 1 - Math.exp(-16 * dt));
      var dAng = U.wrap(nf - cur);
      this.turnRate = U.damp(this.turnRate, dt > 0 ? dAng / dt : 0, 6, dt);
      this.root.rotation.y = nf;
    }
    // arah gerak relatif badan
    var fy = this.root.rotation.y, fwdX = Math.sin(fy), fwdZ = Math.cos(fy);
    var vf = this.vx * fwdX + this.vz * fwdZ, vl = this.vx * fwdZ - this.vz * fwdX; // vl + = ke kanan badan
    var sp = this.speed;
    var o = { sprint: opts.sprint || sp > 7, dribble: !!opts.owner, gk: this.isGK, slide: !!opts.slide, dive: opts.dive, forward: opts.forward, release: opts.release };
    var a = anim;
    if (a === 'run' || a === 'gkReady') {
      if (sp > 0.6 && Math.abs(vl) > Math.abs(vf) * 1.15 && sp < 5) o.side = vl > 0 ? -1 : 1;
      else if (a === 'gkReady' && sp > 1.6) a = 'run';
      if (vf < -0.8 && !o.side) o.back = true;
    }
    if (a === 'idle' && sp > 0.7) a = 'run';
    // fase langkah mengikuti jarak tempuh (kaki tidak meluncur)
    var stride = 1.25 + 0.17 * Math.min(sp, 9) + (o.sprint ? 0.25 : 0);
    var dirSign = o.back ? -1 : 1;
    if (a === 'run' || a === 'celebrate' || a === 'sad' || a === 'gkHold' || a === 'gkReady') this.phase += dirSign * TAU * Math.max(sp, a === 'celebrate' ? 0 : 0) * dt / stride;
    if (o.side) this.phase += TAU * sp * dt / 1.1;
    if (a !== this.anim) {
      // silang-pudar dari pose sekarang ke animasi baru
      this.from = mix(this.P, this.P, 0); this.fadeT = 0;
      this.fadeDur = (a === 'kick' || a === 'shoot' || a === 'pass') ? 0.06 : (a === 'gkDive' || a === 'tackle' ? 0.08 : (this.anim === 'run' && a === 'idle' ? 0.25 : 0.16));
      this.anim = a;
    }
    var T = this.target(a, this.t, sp, aT == null ? this.animT : aT, o);
    if (this.from && this.fadeT < 1 && !opts.snap) {
      this.fadeT = Math.min(1, this.fadeT + dt / this.fadeDur);
      var k = this.fadeT * this.fadeT * (3 - 2 * this.fadeT);
      this.P = mix(this.from, T, k);
    } else this.P = T;
    this.apply();
  };

  Char.prototype.apply = function () {
    var P = this.P, B = this.B, L = this.L;
    B.base.position.y = P.rootY;
    B.base.rotation.set(P.rootP, 0, P.rootR);
    B.pelvis.position.set(P.hipX, L.hip + P.hipY, P.hipZ);
    B.pelvis.rotation.set(P.pelX, P.pelY, P.pelZ);
    B.spine.rotation.set(P.spX, P.spY, P.spZ);
    B.chest.rotation.set(P.chX, P.chY, P.chZ);
    B.neck.rotation.set(P.nkX, P.nkY, 0);
    B.head.rotation.set(P.hdX, P.hdY, P.hdZ);
    B.claL.rotation.set(0, 0, P.clL); B.claR.rotation.set(0, 0, -P.clR);
    B.armL.rotation.set(P.aLX, P.aLY, P.aLZ); B.armR.rotation.set(P.aRX, -P.aRY, -P.aRZ);
    B.foreL.rotation.set(P.fLX, P.fLY, 0); B.foreR.rotation.set(P.fRX, -P.fRY, 0);
    B.handL.rotation.set(P.hLX, 0, P.hLZ); B.handR.rotation.set(P.hRX, 0, -P.hRZ);
    B.thighL.rotation.set(P.tLX, P.tLY, P.tLZ); B.thighR.rotation.set(P.tRX, -P.tRY, -P.tRZ);
    B.shinL.rotation.set(P.sLX, 0, 0); B.shinR.rotation.set(P.sRX, 0, 0);
    B.footL.rotation.set(P.ftLX, 0, P.ftLZ); B.footR.rotation.set(P.ftRX, 0, -P.ftRZ);
    B.toeL.rotation.set(P.toLX, 0, 0); B.toeR.rotation.set(P.toRX, 0, 0);
    // bayangan bulat mengikuti panggul
    this.shadow.scale.setScalar(0.42 * (1 - Math.min(0.5, Math.max(0, P.rootY) * 0.8)));
  };

  Char.prototype.setPose = function (anim, t) {
    this.anim = anim; this.from = null; this.fadeT = 1;
    this.P = this.target(anim, t || 0, 0, 0.15, { gk: this.isGK });
    this.apply();
  };

  /* posisi bola saat digiring: maju-mundur mengikuti sentuhan kaki kanan tiap satu siklus langkah */
  Char.prototype.dribbleBall = function (out) {
    var sp = this.speed, fy = this.root.rotation.y;
    var u = wrapPh(this.phase - (Math.PI - 0.35)) / TAU; // 0 = baru disentuh kaki kanan
    var moving = U.clamp(sp / 1.2, 0, 1);
    var lead = 0.34 + moving * (0.16 + 0.085 * Math.min(sp, 9)) * Math.pow(Math.sin(Math.PI * u), 0.85);
    var side = 0.06 * moving;
    out.x = this.root.position.x + Math.sin(fy) * lead - Math.cos(fy) * side;
    out.z = this.root.position.z + Math.cos(fy) * lead + Math.sin(fy) * side;
    return out;
  };

  /* posisi dunia sebuah titik tulang (untuk bola di tangan, kaki, dada) */
  var tmpV = new THREE.Vector3();
  Char.prototype.anchor = function (name, out, lx, ly, lz) {
    var b = this.B[name];
    if (!b) return null;
    b.updateWorldMatrix(true, false);
    out = out || new THREE.Vector3();
    out.set(lx || 0, ly || 0, lz || 0).applyMatrix4(b.matrixWorld);
    return out;
  };
  /* bola di antara kedua tangan (kiper memegang / lemparan ke dalam) */
  Char.prototype.handsBall = function (out) {
    out = out || new THREE.Vector3();
    this.anchor('handL', out, 0, -0.08, 0.04);
    this.anchor('handR', tmpV, 0, -0.08, 0.04);
    return out.add(tmpV).multiplyScalar(0.5);
  };

  Char.prototype.dispose = function () {
    if (this.root.parent) this.root.parent.remove(this.root);
    this.mesh.geometry.dispose();
    this.mesh.material.dispose();
    if (this.tex) this.tex.dispose();
    if (this.mesh.skeleton && this.mesh.skeleton.boneTexture) this.mesh.skeleton.boneTexture.dispose();
    if (this.extras) this.extras.forEach(function (m) { if (m.parent) m.parent.remove(m); if (m.material && !m.material.__baShared) m.material.dispose(); });
  };

  Chars.build = function (pc, team, opts) { return new Char(pc, team, opts); };
  Chars.clearCache = function () { /* tekstur dibuat per pemain; tidak ada cache bersama */ };
  Chars.clearMats = function () { };
})(typeof window !== 'undefined' ? window : globalThis);
