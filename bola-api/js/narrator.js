/* Bola Api Arena — narator pertandingan: Bahasa Indonesia / English, suara (Web Speech) + teks */
(function (root) {
  'use strict';
  var BA = root.BA, U = BA.U, D = BA.D;
  var N = BA.Narr = { lang: 'id', voice: true, subs: true, vol: 1, rate: 1, voiceURI: '', voices: [], tok: 0 };
  var synth = null;
  try { synth = root.speechSynthesis || null; } catch (e) { synth = null; }
  N.ttsOk = !!(synth && root.SpeechSynthesisUtterance);

  function now() { return (root.performance && root.performance.now) ? root.performance.now() : Date.now(); }

  /* ======================================================================
     KALIMAT NARATOR
     {p} pemain, {d} pemain lawan, {t} tim, {o} tim lawan, {s} jenis tendangan, {k} kiper, {j} jurus,
     {n} angka, {sc} skor, {a} arena, {w} cuaca
     ====================================================================== */
  var L = {};
  L.id = {
    kickoff: [
      'Selamat sore warga {a}! {t} melawan {o}, bola api siap menyala!',
      'Peluit berbunyi! {t} kontra {o}. Gorengan sudah siap, pertandingan dimulai!',
      'Laga antar kampung dimulai! {t} melawan {o}. Semoga tidak ada yang pulang pincang!',
      'Bola api dinyalakan! {t} dan {o} adu gengsi demi sekarung beras dan seekor kambing!',
      'Penonton memadati {a}. Ibu-ibu bawa termos, bapak-bapak bawa kursi plastik. Mulai!'
    ],
    practice: ['Selamat datang di sesi latihan tendangan. Tunjukkan api terbaikmu!', 'Latihan dimulai! Kiper sudah pasang kuda-kuda, ayo tendang!'],
    passStreak: [
      'Umpan demi umpan dari {t}, sudah {n} operan! Tiki-taka rasa kampung!',
      '{t} memainkan bola dari kaki ke kaki, {n} umpan beruntun. Lawan cuma bisa melongo!',
      '{n} operan! {t} main cantik seperti jalan-jalan sore ke pasar malam!',
      'Bola mengalir manis di kaki pemain {t}. Lawan kebagian lari-lari saja!'
    ],
    longPass: ['Umpan panjang dari {p}! Bola melayang melintasi lapangan!', '{p} melepas umpan jauh, setinggi layangan putus!', 'Bola lambung dari {p}! Siapa yang menyambut?'],
    throwin: ['Lemparan ke dalam untuk {t}.', 'Bola keluar, lemparan ke dalam {t}. Jangan sampai bolanya masuk got!', 'Lemparan ke dalam. Penonton di pinggir sigap mengembalikan bola.'],
    goalkick: ['Tendangan gawang.', 'Bola lewat garis belakang. Tendangan gawang untuk {t}.', 'Tendangan gawang, kiper ambil napas dulu.'],
    corner: ['Sepak pojok untuk {t}! Ini pojok ke-{n}.', 'Pojok ke-{n} untuk {t}! Pemain jangkung naik ke kotak penalti!', 'Sepak pojok! {t} punya peluang dari bola mati.'],
    pen3: ['Tiga sepak pojok! Sesuai aturan kampung, penalti untuk {t}!', 'Pojok ketiga! Aturan tarkam berlaku, {t} dapat penalti! Wasit tidak bisa menolak!'],
    penalty: ['PENALTI untuk {t}! Penonton menahan napas!', 'Wasit menunjuk titik putih! Penalti untuk {t}!'],
    tackle: [
      'Tekel bersih dari {p}! Bola direbut!', '{p} merebut bola dari {d}! Tegas tapi santun!',
      'Aduh, {d} kehilangan bola! {p} membaca gerakannya dengan jitu!', 'Rebutan mantap dari {p}! Kakinya seperti pengki menyapu halaman!',
      '{p} menyapu bola dari kaki {d}! Bersih seperti lantai habis dipel!'
    ],
    tackleMiss: [
      '{p} lolos dari hadangan {d}! Gocekan maut!', 'Aduh, {d} terkecoh! {p} meliuk-liuk seperti belut sawah!',
      '{d} cuma menebas angin! {p} sudah lewat duluan!', '{p} melewati {d} semudah menyalip angkot yang lagi ngetem!'
    ],
    slide: ['Sliding tackle dari {p}! Rumputnya sampai tercabut!', '{p} meluncur! Celananya pasti hijau kena rumput!', 'Sapuan meluncur dari {p}! Berani sekali!'],
    hot: ['Bola panas! {p} kelamaan pegang bola, akhirnya terlepas!', 'Kepanasan! {p} kebanyakan mikir, bola apinya lepas sendiri!'],
    petir: ['PETIR menyambar bola! Bola Petir aktif, tenaganya naik!', 'Duaar! Bola tersambar petir! Sekarang bolanya bertenaga ekstra!'],
    shot: ['{p} melepaskan {s}!', 'Awas! {s} dari kaki {p}!', '{p} menendang sekuat tenaga! {s} meluncur ke gawang!', 'Ini dia! {s} dari {p}!', '{p} mengeluarkan jurus {s}!'],
    shotUlt: ['JURUS PAMUNGKAS! {p} mengerahkan seluruh tenaga! {s}!', 'INILAH PAMUNGKAS {p}! {s} dengan api raksasa!', 'Semangat penuh! {p} melepas pamungkas {s}! Langit ikut memerah!'],
    shotPerfect: ['Tendangan {p} pas sekali! {s} dengan tenaga sempurna!', 'Sempurna! {p} menendang tepat di titik manis! {s}!'],
    sandal: ['Sandal {p} ikut terbang! Semoga tidak mendarat di panci bakso!', 'Waduh, sandal {p} lepas melayang ke atap warung!'],
    clash: [
      '{k} menyambut dengan {j}!', 'Kiper {k} mengeluarkan jurus {j}! Adu tenaga!', '{j}! {k} tidak mau gawangnya dijebol begitu saja!',
      'Perguruan silat beraksi! {k} memakai {j}!'
    ],
    clashNormal: ['{k} cuma bisa pasang badan dengan tangkapan biasa!', 'Tidak ada jurus di arah ini! {k} mengandalkan refleks saja!', '{k} melompat dengan tangkapan biasa. Cukupkah?'],
    miss: [
      'Melambung jauh! {p} terlalu bernafsu!', 'Tendangan {p} melenceng. Penonton di belakang gawang menunduk!', 'Waduh, bola {p} malah mengejar layangan!',
      'Melenceng! Kambing di belakang gawang sampai kaget!', '{p} memegang kepala. Peluang emas terbuang!'
    ],
    goal: [
      'GOOOL! {p} membobol gawang dengan {s}!', 'GOOOOL! {s} dari {p} tak terbendung! Jaringnya sampai bergoyang!', 'MASUK! {p} mencetak gol! Warga bersorak!',
      'GOOOL! Api {s} menjebol pertahanan! {p} jadi pahlawan kampung!', 'GOL! {p}! Pak RT sampai lompat dari kursinya!'
    ],
    goalFree: ['GOL! {p} menyambar bola liar!', 'Masuk! {p} tak menyia-nyiakan peluang!', 'GOL! {p} ada di tempat yang tepat pada waktu yang tepat!'],
    ownGoal: ['Waduh! Gol bunuh diri {p}! Bakal jadi bahan obrolan di pos ronda!', 'Gol bunuh diri! {p} salah alamat, gawang sendiri dijebol!'],
    save: ['{k} menangkap dengan {j}! Api padam!', 'Ditangkap! {j} milik {k} terlalu kuat!', 'Aman di tangan {k}! {j} meredam bola api!', 'Tangkapan luar biasa! {k} tak tertembus!'],
    saveNormal: ['{k} menangkap bola dengan tenang.', 'Tangkapan biasa, tapi meyakinkan dari {k}.', 'Bola dipeluk erat oleh {k}, seperti memeluk guling!'],
    parry: ['Ditepis {k}! Bola masih liar!', '{k} menepis! Rebutan di depan gawang!', 'Tepisan heroik dari {k}! Tangannya sampai kepanasan!'],
    parryOut: ['{k} menepis bola keluar lapangan! Sepak pojok!', 'Ditepis keluar oleh {k}! Ancaman belum selesai!'],
    post: ['KENA TIANG! Hampir saja!', 'Tiang gawang menyelamatkan! Tiangnya sampai bergetar!', 'Tiiiang! Bunyinya sampai terdengar ke kampung sebelah!'],
    equalizer: ['Skor imbang {sc}! Pertandingan makin panas!', 'Kedudukan sama kuat, {sc}! Siapa yang berani duluan?'],
    lead: ['{t} memimpin {sc}!', '{t} unggul {sc}! Pendukungnya joget di pinggir lapangan!'],
    extend: ['{t} menjauh, {sc}!', 'Keunggulan {t} bertambah, {sc}!'],
    rout: ['{t} pesta gol! {sc}! Kiper lawan butuh kopi pahit!', 'Hujan gol! {t} memimpin {sc}! Ini sih sudah bukan pertandingan lagi!'],
    comeback: ['Comeback! {t} membalikkan keadaan, {sc}!', 'Luar biasa! {t} bangkit dan kini memimpin {sc}!'],
    brace: ['Itu gol kedua {p} hari ini!', 'Dua gol untuk {p}! Lagi panas-panasnya!'],
    hattrick: ['HATTRICK! {p} mencetak tiga gol! Kambing hadiahnya buat dia!', 'Tiga gol! {p} mencetak hattrick! Namanya bakal dielu-elukan di pos ronda!'],
    late: ['Gol di detik-detik akhir! Dramatis sekali!', 'Gol telat yang menyakitkan! Penonton histeris!'],
    half: ['Pertandingan sudah setengah jalan. Skor {sc}.', 'Separuh waktu berlalu, kedudukan {sc}.'],
    min1: ['Satu menit tersisa! Skor {sc}!', 'Waktu tinggal satu menit! Masih ada harapan!'],
    sec10: ['Sepuluh detik terakhir!', 'Detik-detik terakhir! Ayo!'],
    golden: ['Waktu habis, skor sama! Gol Emas: siapa mencetak gol berikutnya, dialah juara!', 'Gol Emas! Satu gol lagi menentukan segalanya!'],
    shootout: ['Adu Penalti Api dimulai! Jantung penonton berdebar kencang!', 'Adu penalti! Saatnya ilmu silat para kiper diuji!'],
    penStep: ['{p} maju sebagai penendang.', 'Sekarang giliran {p}.', '{p} meletakkan bola. Tenang... tenang...'],
    penGoal: ['Masuk! {p} tenang sekali!', 'Gol! {p} tidak gentar!'],
    penMiss: ['Gagal! {p} tertunduk lesu!', 'Meleset! {p} langsung dihibur teman-temannya.'],
    endWin: ['Pertandingan selesai! {t} menang {sc}! Kambingnya dibawa pulang!', 'Peluit panjang! {t} juara hari ini, {sc}!', 'Selesai! {t} menang {sc}. Malam ini syukuran di balai desa!'],
    endDraw: ['Pertandingan selesai imbang {sc}. Sama-sama dapat gorengan!', 'Peluit akhir, skor sama {sc}. Damai itu indah!'],
    endBig: ['Pesta! {t} menang telak {sc}! Lawannya disuruh latihan lagi!'],
    train: ['Kereta lewat! Penonton melambaikan tangan ke masinis!', 'Tut tut! Kereta lewat, pertandingan jalan terus!'],
    ambient: [
      'Penjual cilok di pinggir lapangan laris manis sore ini.', 'Ibu-ibu sudah mulai bergosip, tapi mata tetap ke lapangan.',
      'Konon hadiah juara tarkam ini sekarung beras dan seekor kambing!', 'Ayam Pak RT sempat masuk lapangan, tapi sudah diamankan.',
      'Para pemain ini kalau hari biasa ada yang tukang ojek, ada yang guru ngaji. Hari ini mereka bintang!',
      'Wasit kita hari ini juga merangkap tukang parkir. Multitalenta!', 'Bola api tidak ada di buku aturan FIFA, tapi di kampung ini sah-sah saja!',
      'Kopi tubruk di warung sebelah sudah habis tiga termos sejak awal laga.', 'Anak-anak di belakang gawang siap memungut bola, imbalannya es lilin.',
      'Konon kiper-kiper di sini belajar silat sejak bisa jalan.', 'Penonton yang naik pohon pisang mohon hati-hati, pohonnya bukan tribun!',
      'Bapak-bapak di pinggir lapangan sudah merasa jadi pelatih semua.'
    ],
    ambLead: ['{t} masih memimpin {sc}.', 'Skor sementara {sc} untuk keunggulan {t}.'],
    ambDraw: ['Skor masih imbang {sc}. Siapa yang akan memecah kebuntuan?', 'Masih {sc}. Kedua tim saling intip.'],
    ambUlt: ['Semangat {t} sudah penuh! Jurus pamungkas siap dilepas!', 'Bar semangat {t} menyala penuh! Awas pamungkas!'],
    ambTired: ['Napas {p} sudah senin-kamis! Kebanyakan sprint!', '{p} mulai ngos-ngosan. Butuh es teh manis!'],
    w_hujan: ['Hujan makin deras, tapi semangat warga tak luntur!', 'Lapangan licin kena hujan, siap-siap ada yang terpeleset!'],
    w_badai: ['Petir menyambar-nyambar! Bola bisa jadi Bola Petir kapan saja!', 'Badai tak menghentikan tarkam! Warga tetap bertahan di pinggir lapangan!'],
    w_malam: ['Lampu petromak menyala, bola api makin membara di malam hari!', 'Malam minggu begini, nonton tarkam lebih seru daripada sinetron!'],
    w_angin: ['Angin kencang! Bola lambung bisa nyasar ke rumah tetangga!', 'Anginnya kencang, rambut gondrong para pemain berkibar seperti umbul-umbul!'],
    w_kabut: ['Kabut tebal, kiper harus pasang mata lebih tajam!', 'Kabut pagi menyelimuti lapangan. Bola api jadi seperti lentera!'],
    w_kemarau: ['Debu beterbangan! Es teh manis di warung jadi incaran.', 'Panasnya terik, keringat pemain sudah sebesar biji jagung!'],
    w_gerimis: ['Gerimis tipis di senja hari. Romantis, tapi ini pertandingan, bukan kencan!'],
    w_cerah: ['Cuaca cerah, cocok untuk main bola dan menjemur kerupuk.'],
    a_kampung: ['Umbul-umbul berkibar, suasana kampung meriah sekali!'],
    a_sawah: ['Kerbau di pematang sawah pun ikut menonton dengan serius.'],
    a_pantai: ['Ombak berdebur di belakang gawang. Hati-hati bola nyemplung ke laut!'],
    a_alun: ['Di bawah beringin, pedagang kaki lima ikut bersorak!'],
    a_tol: ['Mobil di atas jalan tol membunyikan klakson. Mungkin ikut mendukung!'],
    a_bukit: ['Di puncak bukit anginnya sejuk, tapi pertandingannya panas!'],
    a_sekolah: ['Halaman sekolah berubah jadi stadion. Pak kepala sekolah ikut menonton!'],
    a_rel: ['Hati-hati, kalau kereta lewat, pemain jangan ikut melambai!'],
    test: ['Tes, tes. Narator Bola Api Arena siap mengudara!', 'Halo warga! Suara narator sudah siap meramaikan pertandingan!']
  };
  L.en = {
    kickoff: [
      'Good afternoon from {a}! {t} take on {o}, and the fire ball is lit!',
      'And we are under way! {t} against {o}. The fried snacks are ready, so is the football!',
      'Village derby time! {t} versus {o}. Let us hope everyone goes home with all their toes!',
      'The ball is on fire! {t} and {o} battle for pride, a sack of rice and one very nervous goat!',
      'A packed crowd at {a}. Mums with flasks, dads with plastic chairs. Kick off!'
    ],
    practice: ['Welcome to shooting practice. Show us your hottest strike!', 'Practice time! The keeper is in his stance. Let it fly!'],
    passStreak: [
      '{n} passes in a row from {t}! Village tiki-taka!', '{t} are stroking it about, {n} passes, and the opposition just stand and stare!',
      '{n} passes! {t} are playing like it is a Sunday stroll through the night market!', 'Lovely movement from {t}. The other lot are only getting cardio!'
    ],
    longPass: ['Long ball from {p}! It sails across the pitch!', '{p} launches it, higher than a runaway kite!', 'A lofted pass from {p}! Who is on the end of it?'],
    throwin: ['Throw in to {t}.', 'Out of play, throw in {t}. Mind the drainage ditch!', 'Throw in. A helpful spectator tosses the ball back.'],
    goalkick: ['Goal kick.', 'Over the bye line. Goal kick to {t}.', 'Goal kick. The keeper takes a breather.'],
    corner: ['Corner kick to {t}! That is corner number {n}.', 'Corner number {n} for {t}! The big lads are heading forward!', 'Corner! {t} have a set piece chance.'],
    pen3: ['Three corners! By village rules, that is a penalty to {t}!', 'Corner number three! Tarkam law applies: penalty to {t}! The referee cannot argue!'],
    penalty: ['PENALTY to {t}! The crowd holds its breath!', 'The referee points to the spot! Penalty to {t}!'],
    tackle: [
      'Clean tackle from {p}! Ball won!', '{p} takes it off {d}! Firm but fair!', 'Oh, {d} loses it! {p} read that perfectly!',
      'Great challenge from {p}! Swept it away like a broom on a porch!', '{p} nicks it from {d}! Clean as a freshly mopped floor!'
    ],
    tackleMiss: [
      '{p} skips past {d}! Lovely footwork!', 'Oh dear, {d} has been fooled! {p} wriggles through like an eel!',
      '{d} only tackles thin air! {p} is long gone!', '{p} glides past {d} like overtaking a parked minibus!'
    ],
    slide: ['Sliding tackle from {p}! He has taken half the turf with him!', '{p} goes to ground! Those shorts will never be white again!', 'Brave slide from {p}!'],
    hot: ['Hot ball! {p} held it too long and it burns loose!', 'Too hot to handle! {p} dithered and the fire ball jumped away!'],
    petir: ['LIGHTNING strikes the ball! Thunder Ball is live!', 'Kaboom! The ball has been struck by lightning! Extra power now!'],
    shot: ['{p} unleashes the {s}!', 'Look out! The {s} from {p}!', '{p} hits it with everything! The {s} flies towards goal!', 'Here it comes! The {s} from {p}!', '{p} pulls out the {s}!'],
    shotUlt: ['ULTIMATE MOVE! {p} puts everything into it! The {s}!', 'HERE IS THE FINISHER from {p}! A giant {s}!', 'Spirit bar full! {p} lets loose the ultimate {s}! The sky turns red!'],
    shotPerfect: ['What a strike from {p}! The {s}, perfectly timed!', 'Perfect! {p} hits the sweet spot! The {s}!'],
    sandal: ['There goes the sandal of {p}! Hope it does not land in the meatball soup!', 'Oh no, the sandal of {p} has flown onto the stall roof!'],
    clash: ['{k} answers with {j}!', 'Keeper {k} summons {j}! A battle of power!', '{j}! {k} will not be beaten that easily!', 'Silat in goal! {k} uses {j}!'],
    clashNormal: ['{k} can only throw his body in the way!', 'No special move on this side! {k} relies on reflexes!', '{k} dives with an ordinary save. Is it enough?'],
    miss: [
      'Way over! {p} got far too excited!', 'Wide from {p}. The fans behind the goal duck for cover!', 'Oh dear, that one from {p} is chasing kites!',
      'Miles off! Even the goat behind the goal looked startled!', '{p} has his head in his hands. A golden chance wasted!'
    ],
    goal: [
      'GOOOAL! {p} scores with the {s}!', 'GOOOOAL! The {s} from {p} is unstoppable! The net is still shaking!', 'IT IS IN! {p} scores! The village erupts!',
      'GOOOAL! The {s} burns right through! {p} is a village hero!', 'GOAL! {p}! The village chief just leapt out of his chair!'
    ],
    goalFree: ['GOAL! {p} pounces on the loose ball!', 'In it goes! {p} makes no mistake!', 'GOAL! {p} in the right place at the right time!'],
    ownGoal: ['Oh no! An own goal from {p}! They will be talking about that at the night watch post!', 'Own goal! {p} picked the wrong net!'],
    save: ['{k} holds it with {j}! Fire extinguished!', 'Caught! The {j} of {k} is just too strong!', 'Safe hands, {k}! {j} smothers the fire ball!', 'Incredible save! {k} is unbeatable!'],
    saveNormal: ['{k} gathers it calmly.', 'A routine save, but a confident one from {k}.', '{k} hugs that ball like a bolster pillow!'],
    parry: ['Parried by {k}! The ball is still loose!', '{k} pushes it away! Scramble in the box!', 'Heroic parry from {k}! His palms must be burning!'],
    parryOut: ['{k} tips it out of play! Corner kick!', 'Pushed out by {k}! The danger is not over!'],
    post: ['OFF THE POST! So close!', 'The woodwork saves them! The post is still trembling!', 'Clang! You could hear that in the next village!'],
    equalizer: ['All square at {sc}! This is heating up!', 'Level at {sc}! Who blinks first?'],
    lead: ['{t} lead {sc}!', '{t} are in front, {sc}! Their fans are dancing on the touchline!'],
    extend: ['{t} pull further ahead, {sc}!', '{t} extend the lead, {sc}!'],
    rout: ['{t} are running riot! {sc}! The keeper needs a strong black coffee!', 'Goals galore! {t} lead {sc}! This is no longer a contest!'],
    comeback: ['What a comeback! {t} turn it around, {sc}!', 'Unbelievable! {t} fight back and lead {sc}!'],
    brace: ['That is his second of the day for {p}!', 'Two goals for {p}! He is on fire!'],
    hattrick: ['HAT TRICK! Three goals for {p}! Give that man the goat!', 'Three goals! A hat trick for {p}! They will sing his name tonight!'],
    late: ['A late goal! What drama!', 'Right at the death! The crowd goes wild!'],
    half: ['We are halfway through. It is {sc}.', 'Half the time gone, and the score is {sc}.'],
    min1: ['One minute to go! It is {sc}!', 'Just a minute left! Still time!'],
    sec10: ['Ten seconds left!', 'Final seconds! Come on!'],
    golden: ['Full time and all square! Golden goal: next goal wins it all!', 'Golden goal! One goal decides everything!'],
    shootout: ['The fire penalty shootout begins! Hearts are pounding!', 'Penalties! Time to test the silat of these keepers!'],
    penStep: ['{p} steps up to take it.', 'Now it is {p}.', '{p} places the ball. Stay calm...'],
    penGoal: ['Scored! Ice cool from {p}!', 'In! {p} shows no fear!'],
    penMiss: ['Missed! {p} hangs his head.', 'Off target! The team mates console {p}.'],
    endWin: ['Full time! {t} win {sc}! The goat goes home with them!', 'The final whistle! {t} are the champions today, {sc}!', 'That is it! {t} win {sc}. Party at the village hall tonight!'],
    endDraw: ['Full time and honours even at {sc}. Fried snacks for everyone!', 'Final whistle, all square at {sc}. Peace and love!'],
    endBig: ['What a rout! {t} win {sc}! Back to training for the other lot!'],
    train: ['A train goes by! The fans wave to the driver!', 'Choo choo! Train passing, the game goes on!'],
    ambient: [
      'The meatball seller on the touchline is doing a roaring trade.', 'The ladies have started gossiping, but their eyes never leave the pitch.',
      'Rumour has it the prize is a sack of rice and a goat!', 'The village chief\'s chicken wandered onto the pitch earlier. It has been escorted off.',
      'On weekdays these lads drive motorbike taxis and teach at the mosque. Today they are stars!', 'Our referee is also the parking attendant. Multi talented!',
      'Fire football is not in the FIFA rule book, but round here it is perfectly legal!', 'The coffee stall next door has gone through three flasks since kick off.',
      'The kids behind the goal will fetch the ball for an ice lolly.', 'They say keepers here learn silat before they can walk.',
      'Will the fans in the banana tree please be careful. It is not a grandstand!', 'Every man on the touchline is apparently a head coach.'
    ],
    ambLead: ['{t} still lead {sc}.', 'It is {sc} as things stand, {t} in front.'],
    ambDraw: ['Still level at {sc}. Who will break the deadlock?', 'Still {sc}. Cagey stuff.'],
    ambUlt: ['The spirit bar of {t} is full! Their ultimate is ready!', '{t} are fully fired up! Watch out for the finisher!'],
    ambTired: ['{p} is running on fumes! Too much sprinting!', '{p} is blowing hard. Somebody fetch him an iced tea!'],
    w_hujan: ['The rain is lashing down, but the village spirit will not wash away!', 'Slippery out there! Someone is going on their backside soon!'],
    w_badai: ['Lightning everywhere! The ball could become a Thunder Ball any moment!', 'A storm cannot stop tarkam! The fans are staying put!'],
    w_malam: ['The pressure lamps are glowing, and the fire ball burns brighter at night!', 'A Saturday night like this beats any soap opera!'],
    w_angin: ['Gale force winds! A high ball could end up in the neighbour\'s yard!', 'So windy the long hair of these players flaps like the bunting!'],
    w_kabut: ['Thick fog! The keepers need eagle eyes today!', 'Morning mist over the pitch. The fire ball looks like a lantern!'],
    w_kemarau: ['Dust flying everywhere! The iced tea is in high demand.', 'Scorching heat, the players are sweating buckets!'],
    w_gerimis: ['A light drizzle at dusk. Romantic, but this is a football match, not a date!'],
    w_cerah: ['Beautiful weather, perfect for football and drying crackers.'],
    a_kampung: ['Bunting everywhere, what a festive village atmosphere!'],
    a_sawah: ['Even the buffalo on the paddy dyke is watching intently.'],
    a_pantai: ['Waves crashing behind the goal. Careful, the ball might end up in the sea!'],
    a_alun: ['Under the banyan tree, the street food sellers are cheering along!'],
    a_tol: ['The cars on the toll road are honking. Maybe they are supporters!'],
    a_bukit: ['A cool breeze on top of the hill, but the game is red hot!'],
    a_sekolah: ['The school yard has become a stadium. Even the headmaster is watching!'],
    a_rel: ['Careful, when the train passes, players must not wave back!'],
    test: ['Testing, testing. The Fire Ball Arena commentator is on air!', 'Hello everyone! The commentator is ready to bring the match to life!']
  };
  var SHOT_EN = { naga: 'Fire Dragon', macan: 'Black Panther', garuda: 'Garuda Wings', banteng: 'Raging Bull', keris: 'Star Keris', meteor: 'Village Meteor', beliung: 'Fire Twister', tinju: 'Fire Fist' };
  var SKILL_EN = { tapak: 'the Iron Palm', cakar: 'the Eagle Claw', tameng: 'the Mystic Shield', karang: 'the Coral Fortress', banyu: 'the Water Curtain', selendang: 'the Magic Shawl', bayu: 'the Wind Vortex', seribu: 'the Thousand Hands', rajawali: 'the Hawk Wings', bumi: 'the Earth Stance' };
  var ARENA_EN = { kampung: 'the village pitch', sawah: 'the rice field', pantai: 'Sunset Beach', alun: 'the town square', tol: 'under the toll road', bukit: 'Red Clay Hill', sekolah: 'the school yard', rel: 'the railway pitch' };
  N.LINES = L;

  /* ======================================================================
     KALIMAT TAMBAHAN: jalannya laga (gocek, giringan, statistik, sepi, kiper nganggur) + sarkasme
     ====================================================================== */
  var EXTRA = {
    id: {
      gocek: ['Gocek manis dari {p}! Lawannya cuma bisa lihat punggung!', '{p} menggoyang pinggul! {d} ditinggal, mungkin lagi cari dompet!', 'Satu sentuhan, {p} lolos! Gocek kelas kampung, rasa liga dunia!', 'Wuih, {p} nge-gocek! {d} sampai salah arah pulang!'],
      dribbleRun: ['{p} membawa bola sendirian! Giringan panjang, kayak lari dikejar hansip!', 'Sprint! {p} membelah pertahanan {o}! Kencang sekali, pasti sarapan pecel!', '{p} menggiring terus! Teman-temannya lambai-lambai minta bola, dicuekin!', 'Giringan solo {p}! Lawannya kayak kerucut latihan!'],
      possession: ['Statistik sementara: {t} menguasai bola {n} persen. Sisanya cuma nonton!', 'Penguasaan bola {n} persen untuk {t}. Lawannya sudah ikut nyanyi di tribun!', 'Bola lebih sering di kaki {t}, {n} persen! Lawannya mungkin kebanyakan bengong!'],
      shotsStat: ['Sudah {n} tembakan ke gawang hari ini. Kipernya sampai hafal bentuk bolanya!', '{n} tendangan api sejauh ini! Rumput lapangan tinggal setengah!'],
      quiet: ['Hmm... sudah lama tidak ada tembakan. Lebih seru nonton cicak di dinding!', 'Pertandingan agak lesu. Bakso di pinggir lapangan lebih panas dari bolanya!', 'Sunyi senyap. Mungkin pemain lagi mikir bayar cicilan.', 'Sudah lama tidak ada peluang. Penonton mulai cek HP masing-masing!', 'Kalau begini terus, kambing hadiahnya ketiduran!'],
      keeperBored: ['{k} di gawang sudah lama nganggur. Dia mulai menghitung bintang.', 'Kiper {k} belum disentuh sama sekali. Mungkin sebentar lagi gelar tikar!', '{k} di bawah mistar santai, bisa sambil ngopi.'],
      ambLeadBig: ['{t} unggul {sc}. Lawannya mungkin lagi mikir: ini pertandingan atau latihan menembak?', 'Skor {sc}! {o} butuh keajaiban, atau dukun bola!', '{sc} untuk {t}. Pendukung {o} mulai tanya jadwal angkot pulang.'],
      missSarc: ['Melebar jauh! {p} bidik gawang, kena pohon pisang!', 'Waduh, {p}... itu gawangnya di sebelah sana!', 'Tendangan {p} melenceng! Bola apinya mendarat di sawah Pak Lurah!', '{p} menendang ke arah tribun! Penonton dapat souvenir!'],
      tackleSarc: ['{p} nyapu bersih, bola plus kakinya! Untung wasit lagi lihat HP!', 'Tekel {p}! {d} jatuh lebih dramatis dari sinetron sore!', '{p} merebut bola. {d} protes, tapi cuma ke angin.'],
      goalkickSarc: ['Tendangan gawang. Kiper lagi mikir mau tendang ke mana, atau ke warung.', 'Bola keluar. Tendangan gawang {t}, semoga tidak nyasar lagi.'],
      offside: ['OFFSIDE! {p} berdiri terlalu depan, hakim garis mengangkat bendera!', 'Bendera naik! {p} offside, mungkin dia pikir ini lomba lari.', 'Offside {p}! Sabar, bola belum ditendang kamu sudah di depan semua orang.', 'Posisi offside! Serangan {t} dihentikan wasit.'],
      foul: ['Pelanggaran! {p} menjatuhkan {d}. Tendangan bebas untuk {t}!', 'Wasit meniup peluit! {p} terlalu kasar pada {d}. Tendangan bebas.', '{p} menekel bukan bolanya, tapi kakinya {d}! Pelanggaran!', 'Dilanggar! {d} jatuh, wasit menunjuk titik tendangan bebas untuk {t}.'],
      foulSlide: ['Sliding tackle {p} telat! {d} terjungkal, pelanggaran!', 'Sapuan {p} kena orang, bukan bola! Pelanggaran keras!'],
      foulPen: ['PENALTI! {p} melanggar {d} di dalam kotak! Wasit tegas menunjuk titik putih!', 'Di dalam kotak penalti! {p} menjatuhkan {d}. Penalti untuk {t}!'],
      cardYellow: ['Kartu kuning untuk {p}! Wasit tidak mau tahu.', '{p} dapat kartu kuning. Sekali lagi, pulang duluan!', 'Kuning! {p} dicatat wasit, nanti dipotong uang saku.'],
      cardRed: ['KARTU MERAH! {p} diusir keluar lapangan! Timnya main dengan sepuluh orang!', 'Merah! {p} harus keluar. Silakan ke warung, Pak, pertandingan lanjut tanpa Anda.', '{p} dikeluarkan wasit! Penonton bersorak, sebagian menyoraki.'],
      freekick: ['Tendangan bebas untuk {t}. Pagar betis sudah disusun.', 'Tendangan bebas! Posisi bagus untuk mengarah ke gawang.', 'Bola mati untuk {t}. Semua menunggu, siapa yang akan mengambil?']
    },
    en: {
      gocek: ['Sweet skill from {p}! The defender only saw his back!', '{p} sells the dummy! {d} is left behind, probably looking for his wallet!', 'One touch and {p} is through! Village skills, world league flavour!', 'Oh, {p} with the step over! {d} went home the wrong way!'],
      dribbleRun: ['{p} goes it alone! A long run, like he is being chased by the night watch!', 'Sprint! {p} slices through {o}! Someone had a big breakfast!', '{p} keeps dribbling! His team mates wave for the ball and get ignored!', 'Solo run from {p}! The defenders look like training cones!'],
      possession: ['The stats so far: {t} with {n} percent possession. The others are just watching!', '{n} percent of the ball for {t}. Their opponents have joined the singing in the stands!', 'The ball lives with {t}, {n} percent! The other lot may be daydreaming!'],
      shotsStat: ['{n} shots on goal so far. The keeper knows the ball by name now!', '{n} fire shots and counting! Half the grass is gone!'],
      quiet: ['Hmm... no shots for a while. Watching a lizard on the wall would be more exciting!', 'A bit of a lull. The meatball soup is hotter than this ball!', 'Dead quiet. Maybe the players are thinking about their bills.', 'No chances for ages. The crowd is checking their phones!', 'Keep this up and the prize goat will fall asleep!'],
      keeperBored: ['{k} has had nothing to do. He is counting the stars.', 'Keeper {k} has not touched the ball. He may roll out a mat and nap!', '{k} is so relaxed back there he could brew a coffee.'],
      ambLeadBig: ['{t} lead {sc}. The others must wonder if this is a match or target practice!', '{sc}! {o} need a miracle, or a football shaman!', '{sc} to {t}. The {o} supporters are checking bus timetables home.'],
      missSarc: ['Miles wide! {p} aimed at goal and hit a banana tree!', 'Oh dear, {p}... the goal is over there!', 'That strike from {p} is off! The fire ball lands in the chief\'s rice field!', '{p} shoots at the stands! Free souvenirs for the crowd!'],
      tackleSarc: ['{p} sweeps up the ball and the legs! Lucky the ref was checking his phone!', 'Tackle from {p}! {d} goes down more dramatically than a soap opera!', '{p} wins it. {d} complains, but only to the wind.'],
      goalkickSarc: ['Goal kick. The keeper is deciding where to kick it, or whether to visit the snack stall.', 'Out of play. Goal kick to {t}, hopefully not into the ditch again.'],
      offside: ['OFFSIDE! {p} was too far forward, the flag goes up!', 'Flag up! {p} offside, maybe he thought it was a sprint race.', 'Offside against {p}! Patience, the ball had not even been kicked.', 'Offside position! The {t} attack is stopped.'],
      foul: ['Foul! {p} brings down {d}. Free kick to {t}!', 'The whistle goes! {p} was too rough on {d}. Free kick.', '{p} tackled the man, not the ball! Foul!', 'Fouled! {d} goes down and the referee points to the spot for a free kick to {t}.'],
      foulSlide: ['Late slide from {p}! {d} tumbles, foul!', 'That sweep from {p} got the man, not the ball! Nasty foul!'],
      foulPen: ['PENALTY! {p} fouls {d} inside the box! The referee points to the spot!', 'Inside the penalty area! {p} brings down {d}. Penalty to {t}!'],
      cardYellow: ['Yellow card for {p}! The referee has no patience today.', '{p} goes in the book. One more and he is off!', 'Yellow! {p} is noted, pocket money deducted later.'],
      cardRed: ['RED CARD! {p} is sent off! Down to ten men!', 'Red! {p} has to go. Off to the snack stall, sir, the match goes on without you.', '{p} is dismissed! The crowd cheers, some of them boo.'],
      freekick: ['Free kick to {t}. The wall is being set.', 'Free kick! A good position to aim at goal.', 'Dead ball for {t}. Everyone waits, who will take it?']
    }
  };
  Object.keys(EXTRA.id).forEach(function (k) { L.id[k] = EXTRA.id[k]; L.en[k] = EXTRA.en[k]; });

  /* ======================================================================
     PERSONA NARATOR: lima gaya suara & kalimat khas
     ====================================================================== */
  N.PERSONAS = [
    { id: 'ahong', n: 'Koh Ahong (logat Cina)', en: 'Koh Ahong (Chinese-Indonesian accent)', desc: 'Pria, logat Tionghoa pasar: cepat, cerewet, "haiya", "lu", "owe", suka hitung-hitungan.', descEn: 'Male, Chinese-Indonesian market accent: quick, chatty, loves counting things.', pitch: 0.7, rate: 1.05, gender: 'm', accent: 'cina', key: 'CINA' },
    { id: 'bejo', n: 'Mas Bejo (logat Jawa)', en: 'Mas Bejo (Javanese accent)', desc: 'Pria, logat Jawa medok: kalem, pelan, "jan", "to", "wes", humornya halus menyindir.', descEn: 'Male, thick Javanese accent: calm, slow, gentle teasing humour.', pitch: 0.6, rate: 0.9, gender: 'm', accent: 'jawa', key: 'JAWA' },
    { id: 'togar', n: 'Bang Togar (logat Batak)', en: 'Bang Togar (Batak accent)', desc: 'Pria, logat Batak: lantang, tegas, "bah!", "lae", "horas!", suka teriak.', descEn: 'Male, Batak accent: loud, blunt, shouts a lot.', pitch: 0.5, rate: 1.1, gender: 'm', accent: 'batak', key: 'BATAK' },
    { id: 'asep', n: 'Kang Asep (logat Sunda)', en: 'Kang Asep (Sundanese accent)', desc: 'Pria, logat Sunda: ramah, lembut, "euy", "atuh", "teh", "mah", sambil ngopi.', descEn: 'Male, Sundanese accent: friendly, soft, coffee-stall humour.', pitch: 0.65, rate: 0.95, gender: 'm', accent: 'sunda', key: 'SUNDA' },
    { id: 'zul', n: 'Encik Zul (logat Melayu)', en: 'Encik Zul (Malay accent)', desc: 'Pria, logat Melayu: santun, berirama, "lah", "tengok", "sangat", "macam mana".', descEn: 'Male, Malay accent: polite, melodic, "lah" at the end of everything.', pitch: 0.6, rate: 0.95, gender: 'm', accent: 'melayu', key: 'MELAYU' },
    { id: 'rere', n: 'Mbak Rere (wanita)', en: 'Miss Rere (female)', desc: 'Wanita, logat Jakarta ceria: cepat, hobi pantun, "gaes".', descEn: 'Female, cheerful Jakarta style: quick, rhymes and little jokes.', pitch: 1.35, rate: 1.0, gender: 'f', accent: 'jakarta', key: 'WANITA' }
  ];
  N.personaById = {}; N.PERSONAS.forEach(function (p) { N.personaById[p.id] = p; });
  /* kompatibel dengan paket "indonesianVoiceAI": CharacterProfiles & VoiceManager.speak(KEY, teks, {onStart, onEnd}) */
  N.CharacterProfiles = {}; N.PERSONAS.forEach(function (p) { N.CharacterProfiles[p.key] = { id: p.id, name: p.n, gender: p.gender === 'f' ? 'female' : 'male', pitch: p.pitch, rate: p.rate }; });
  N.speakAs = function (profileKey, text, opts) {
    opts = opts || {};
    var pe = N.PERSONAS.filter(function (p) { return p.key === String(profileKey || '').toUpperCase() || p.id === profileKey; })[0] || N.personaById.rere;
    if (!N.ttsOk || !text) { if (opts.onEnd) opts.onEnd(pe); return false; }
    var keep = N.persona; N.persona = pe; N.pickVoice();
    try {
      var u = new root.SpeechSynthesisUtterance(ttsText(String(text), 2));
      if (N.voiceObj) { u.voice = N.voiceObj; u.lang = N.voiceObj.lang; } else u.lang = N.lang === 'en' ? 'en-GB' : 'id-ID';
      u.pitch = U.clamp(pe.pitch, 0.1, 2); u.rate = U.clamp(N.rate * pe.rate, 0.5, 2); u.volume = N.vol;
      u.onstart = function () { if (opts.onStart) opts.onStart(pe); };
      u.onend = u.onerror = function () { if (opts.onEnd) opts.onEnd(pe); };
      interrupt(); N.tok++;
      synth.speak(u);
      return true;
    } catch (e) { if (opts.onEnd) opts.onEnd(pe); return false; }
    finally { N.persona = keep; N.pickVoice(); }
  };
  N.VoiceManager = { speak: function (k, t, o) { return N.speakAs(k, t, o); }, stop: function () { N.stop(); } };
  /* ---------- logat: ganti kata & sisipan khas tiap daerah (teks komentar & suara) ---------- */
  var ACCENT = {
    cina: { words: [[/\bsaya\b/gi, 'owe'], [/\bkamu\b/gi, 'lu'], [/\bkalian\b/gi, 'lu orang'], [/\btidak\b/gi, 'nggak'], [/\bbisa\b/gi, 'bisa'], [/\bsekali\b/gi, 'banget'], [/\bbagus\b/gi, 'hao'], [/\bsudah\b/gi, 'udah'], [/\bbenar\b/gi, 'bener']],
      open: ['Haiya, ', 'Aiyo, ', 'Wah, '], close: [' lho!', ' ya!', ' ah!', ''], pOpen: 0.4, pClose: 0.45 },
    jawa: { words: [[/\bsekali\b/gi, 'tenan'], [/\btidak\b/gi, 'ora'], [/\bsudah\b/gi, 'wes'], [/\bsangat\b/gi, 'banget'], [/\bbenar\b/gi, 'bener'], [/\bsaya\b/gi, 'kulo'], [/\bkamu\b/gi, 'sampeyan'], [/\bbagus\b/gi, 'apik']],
      open: ['Wah jan, ', 'Lha, ', 'Walah, ', 'Jan, '], close: [' to.', ' lho.', ' je.', ''], pOpen: 0.45, pClose: 0.5 },
    batak: { words: [[/\bsekali\b/gi, 'kali'], [/\bsangat\b/gi, 'kali'], [/\btidak\b/gi, 'nggak'], [/\bteman\b/gi, 'lae'], [/\bbagus\b/gi, 'mantap'], [/\bsaudara-saudara\b/gi, 'lae semua']],
      open: ['Bah! ', 'Horas! ', 'Bah, ', 'Mantap, '], close: [' bah!', ' lae!', '!', ''], pOpen: 0.55, pClose: 0.5 },
    sunda: { words: [[/\bsekali\b/gi, 'pisan'], [/\bsangat\b/gi, 'pisan'], [/\bsaya\b/gi, 'abdi'], [/\bkamu\b/gi, 'maneh'], [/\btidak\b/gi, 'teu'], [/\bbagus\b/gi, 'alus'], [/\bsudah\b/gi, 'geus']],
      open: ['Euy, ', 'Aduh, ', 'Wah atuh, '], close: [' euy.', ' atuh.', ' teh.', ' mah.', ''], pOpen: 0.4, pClose: 0.6 },
    melayu: { words: [[/\bsekali\b/gi, 'sangat'], [/\btidak\b/gi, 'tak'], [/\bbisa\b/gi, 'boleh'], [/\bbagus\b/gi, 'hebat'], [/\bbagaimana\b/gi, 'macam mana'], [/\blihat\b/gi, 'tengok'], [/\bsaya\b/gi, 'saya'], [/\bkamu\b/gi, 'awak'], [/\bsedang\b/gi, 'tengah']],
      open: ['Tengok tu, ', 'Alamak, ', 'Wah, '], close: [' lah!', ' kan?', ' lah.', ''], pOpen: 0.4, pClose: 0.6 },
    jakarta: { words: [[/\bsekali\b/gi, 'banget'], [/\bsangat\b/gi, 'banget'], [/\btidak\b/gi, 'nggak'], [/\bsudah\b/gi, 'udah']],
      open: ['Gaes, ', 'Wih, ', 'Eh, '], close: [' gaes!', ' sih!', '', ''], pOpen: 0.35, pClose: 0.45 }
  };
  N.accentize = function (text, pe) {
    pe = pe || N.persona; var ac = pe && ACCENT[pe.accent];
    if (!ac || N.lang === 'en') return text;
    var t = String(text);
    ac.words.forEach(function (w) { t = t.replace(w[0], function (m) { return m[0] === m[0].toUpperCase() && m[0] !== m[0].toLowerCase() ? w[1].charAt(0).toUpperCase() + w[1].slice(1) : w[1]; }); });
    var r = Math.random();
    if (r < ac.pOpen && !/^(GO|MASU|PENALTI|OFFSIDE|KARTU|TIANG)/i.test(t)) { var o = ac.open[Math.floor(Math.random() * ac.open.length)]; t = o + t.charAt(0).toLowerCase() + t.slice(1); }
    else if (r < ac.pOpen + ac.pClose) { var c = ac.close[Math.floor(Math.random() * ac.close.length)]; if (c) t = t.replace(/[.!?]+$/, '') + c; }
    return t.charAt(0).toUpperCase() + t.slice(1);
  };
  var PL = { id: {}, en: {} };
  PL.id.ahong = {
    kickoff: ['Haiya, {t} lawan {o} di {a}! Owe sudah hitung, bolanya cuma satu, pemainnya banyak. Mulai!', 'Aiyo, rame sekali! {t} versus {o}. Siapa menang, dia yang bayar bakmi!'],
    goal: ['GOL! Haiya, {p} itu hebat lho! {s} masuk, untung besar!', 'Masuk! {p}! Owe hitung lagi: satu gol, seratus senyum!', 'Aiyo GOL! {s} dari {p}! Kipernya rugi, penonton untung!'],
    save: ['Ditangkap {k}! Jurus {j}. Haiya, kuat lho tangannya!', 'Aman! {k} pakai {j}. Lu lihat? Itu baru kiper, nggak ada diskon!'],
    miss: ['Haiya, meleset {p}! Bolanya kabur ke pasar!', 'Aiyo, {p}... gawangnya di sana lho, bukan di langit!'],
    post: ['Tiang! Haiya, kurang sedikit lagi! Rugi ah!'],
    tackle: ['Tekel {p}! {d} jatuh, bolanya pindah tangan. Dagang bola namanya!'],
    endWin: ['Selesai! {t} menang {sc}! Haiya, malam ini traktir bakmi semua!'],
    ambient: ['Haiya, penonton rame, dagangan laris. Owe senang.', 'Lu lihat kipernya? Berdiri terus, kayak jaga toko.'],
    quiet: ['Haiya, sepi. Nggak ada tembakan, nggak ada untung.']
  };
  PL.id.bejo = {
    kickoff: ['Wah jan, {t} karo {o} di {a}. Tenang, Mas, pelan-pelan, yang penting masuk.', 'Lha, pertandingan dimulai to. {t} lawan {o}. Monggo, ditonton sambil ngeteh.'],
    goal: ['Gol, Mas! {p}! {s}-ne apik tenan.', 'Lha masuk to! {p} wes mencetak gol. Alhamdulillah, legaa.', 'Jan, gol! {s} dari {p}. Kipernya bengong, kayak ndelok wayang.'],
    save: ['Ditangkap {k} nganggo {j}. Kalem tapi mantep.', 'Aman, Mas. {k} wes siap, {j}-ne joss.'],
    miss: ['Walah, meleset. {p} kurang fokus, mungkin kelingan utang.', 'Ora masuk, Mas. {p} tendangane menyang sawah.'],
    post: ['Lha tiang to! Mepet tenan, jan.'],
    tackle: ['Tekel {p}. {d} tibo. Wes, ora opo-opo, bangun maneh.'],
    endWin: ['Rampung. {t} menang {sc}. Sing kalah ojo nesu, besok latihan maneh.'],
    ambient: ['Penontone akeh tenan, Mas. Sampai ibu-ibu arisan ikut nonton.', 'Wasite jalane alon, kayak mlaku nang pasar.'],
    quiet: ['Sepi, Mas. Nganti kulo ngantuk je.']
  };
  PL.id.togar = {
    kickoff: ['Bah! {t} lawan {o} di {a}! Horas! Jangan main pelan-pelan, lae!', 'Horas! Pertandingan dimulai! {t} versus {o}! Kalau takut, pulang saja!'],
    goal: ['BAH! GOL! {p}! {s}-nya keras kali, lae!', 'Mantap kali! {p} mencetak gol! Horas!', 'Gooool! Bah, {s} dari {p}! Kipernya terbang, bolanya tetap masuk!'],
    save: ['Bah, ditangkap {k}! {j}! Kuat kali kiper ini, lae!', 'Mantap! {k} dengan {j}! Nggak lolos, bah!'],
    miss: ['Bah! Meleset {p}! Itu bukan gawang, itu Danau Toba!', 'Macam mana ini, {p}! Tendang yang benar, lae!'],
    post: ['TIANG! Bah, kurang sedikit lagi!'],
    tackle: ['Tekel keras {p}! {d} jatuh! Jangan nangis, lae, ini bola!'],
    endWin: ['Selesai! {t} menang {sc}! Horas! Malam ini makan saksang!'],
    ambient: ['Bah, penontonnya ribut kali. Suaranya kalah sama saya!', 'Lae-lae di tribun sudah mulai nyanyi. Suaranya bagus, nadanya tidak.'],
    quiet: ['Bah, sepi kali! Tendang bolanya, jangan dielus-elus!']
  };
  PL.id.asep = {
    kickoff: ['Euy, {t} lawan {o} di {a}! Kopi geus diseduh, hayu urang nonton!', 'Wah atuh, dimulai, Kang! {t} versus {o}, ulah poho gorengannya.'],
    goal: ['Gol euy! {p}! {s}-na alus pisan!', 'Asyik, gol! {p} hebat pisan, Kang!', 'Masuk atuh! {p} mencetak gol, warung kopi rame euy!'],
    save: ['Ditangkap {k} euy! {j}-na kayak tutup panci, apina langsung redup!', 'Aman, Kang. {k} pakai {j}. Kalem, kayak ngaduk kopi.'],
    miss: ['Aduh, meleset euy! {p} tendangannya nyasar ke kebun singkong!', 'Yah, {p} teh... bolanya pengen jalan-jalan sendiri!'],
    post: ['Tiang, euy! Bunyinya kayak panci jatuh di warung!'],
    tackle: ['Tekel {p}! {d} kesapu kayak lantai warung isuk-isuk!'],
    endWin: ['Beres, Kang! {t} menang {sc}! Kopina gratis keur pemenang!'],
    ambient: ['Di warung sebelah, orang-orang taruhan gorengan. Nu kalah traktir tempe.', 'Angin sore enak euy. Cocok nonton bola bari ngemil.'],
    quiet: ['Sepi euy. Abdi seduh kopi heula, panggil kalau ada gol.']
  };
  PL.id.zul = {
    kickoff: ['Selamat petang semua! {t} lawan {o} di {a}. Tengok betul-betul, jangan kelip mata!', 'Alamak, seru ni! {t} versus {o}. Macam mana agaknya hasilnya?'],
    goal: ['GOL lah! {p}! {s} itu cantik sangat!', 'Masuk! {p} memang hebat lah. Kiper tak sempat tengok.', 'Gooool! {s} dari {p}! Tengok tu, jaringnya bergoyang!'],
    save: ['Ditangkap {k} dengan {j}! Mantap lah kiper ni!', 'Selamat! {k} guna {j}, api pun padam.'],
    miss: ['Alamak, tak masuk! {p} tendang ke mana tu?', 'Meleset lah. {p}, gawang tu depan, bukan tepi!'],
    post: ['Tiang! Alamak, dekat sangat!'],
    tackle: ['Tekel {p}! {d} jatuh. Tak apa lah, bangun balik.'],
    endWin: ['Tamat! {t} menang {sc}! Tahniah! Mari makan nasi lemak!'],
    ambient: ['Penonton ramai sangat lah malam ni. Ada yang bawa tikar.', 'Kiper tu relaks sangat, boleh minum teh tarik dulu.'],
    quiet: ['Sunyi lah. Tak ada tembakan, saya tengok jam je.']
  };
  PL.id.rere = {
    kickoff: ['Halo gaes! {t} lawan {o} di {a}! Siap-siap, bakal panas dan seru banget!', 'Buah manggis buah kedondong, {t} dan {o} siap bertarung, dong!'],
    goal: ['GOOOL gaes! {p} keren banget! {s}-nya kece parah!', 'Masuuuk! {p} bikin aku teriak sampai serak! {s} juara!', 'Yeay, gol! {p}! Nasi uduk pakai sambal, golnya bikin kesengsem total!'],
    save: ['Ditangkap {k}! {j}-nya gemes banget, apinya langsung mingkem!', 'Aman gaes! {k} sama {j} kayak superhero kampung!'],
    miss: ['Yah, meleset gaes! {p} jangan sedih, masih ada bakso!', 'Hmm, {p} kurang pas. Nggak papa, coba lagi, semangat!'],
    post: ['Tiang gaes! Deg-degan parah!'],
    tackle: ['Tekel {p}! {d} kesandung, kayak kesandung kenangan!'],
    endWin: ['Selesai gaes! {t} menang {sc}! Ikan hiu makan tomat, {t} memang hebat!'],
    ambient: ['Gaes, ibu-ibu di pinggir lapangan sudah mulai nge-vlog!', 'Anak-anak di belakang gawang sibuk rebutan bola nyasar!'],
    quiet: ['Sepi nih gaes. Kalian masih di sini kan? Jangan tidur dulu!']
  };
  PL.en.ahong = {
    kickoff: ['Haiya, {t} against {o} at {a}! One ball, many players, I already counted. Go!'],
    goal: ['GOAL! Haiya, {p} is good one! {s} goes in, big profit!', 'In it goes! {p}! One goal, one hundred smiles, I counted.'],
    save: ['Caught by {k}! The {j}. Haiya, strong hands, no discount!'],
    miss: ['Aiyo, {p}... the goal is over there, not in the sky!'],
    post: ['The post! Haiya, so close, such a loss!'],
    endWin: ['Finished! {t} win {sc}! Haiya, noodles for everybody tonight!'],
    ambient: ['Big crowd, good business. Owe is happy.'],
    quiet: ['Haiya, so quiet. No shots, no profit.']
  };
  PL.en.bejo = {
    kickoff: ['Well now, {t} and {o} at {a}. Slowly, slowly, the important thing is it goes in.'],
    goal: ['Goal! {p}! The {s} was lovely, truly.', 'It went in, did it not. {p} scores. The keeper stood like a puppet show.'],
    save: ['Caught by {k} with the {j}. Calm but firm.'],
    miss: ['Oh dear, wide. {p} lost focus, perhaps remembering a debt.'],
    post: ['The post, you see. So very close.'],
    endWin: ['Done. {t} win {sc}. Losers, do not sulk, practise tomorrow.'],
    ambient: ['Big crowd, even the ladies from the savings club came.'],
    quiet: ['Quiet. I am getting sleepy, truly.']
  };
  PL.en.togar = {
    kickoff: ['Bah! {t} against {o} at {a}! Horas! No soft play, my friend!'],
    goal: ['BAH! GOAL! {p}! That {s} was hard, so hard!', 'Horas! {p} scores! Keeper flew, ball still went in!'],
    save: ['Bah, caught by {k}! The {j}! Strong keeper, this one!'],
    miss: ['Bah! Wide, {p}! That is not a goal, that is Lake Toba!'],
    post: ['THE POST! Bah, so close!'],
    endWin: ['Finished! {t} win {sc}! Horas! Big dinner tonight!'],
    ambient: ['Bah, the crowd is loud. Not louder than me!'],
    quiet: ['Bah, so quiet! Kick the ball, do not pet it!']
  };
  PL.en.asep = {
    kickoff: ['Right then! {t} versus {o} at {a}! The coffee is brewed, let us watch!'],
    goal: ['GOAL, my friend! {p}! That {s} made me spill my coffee!', 'It is in! {p} scores and the coffee stall goes wild!'],
    save: ['Caught by {k}! That {j} is like a pot lid, the fire just dims!'],
    miss: ['Oh no, wide! {p} sent that into the cassava patch!'],
    post: ['The post! Sounds like a pan dropping in the kitchen!'],
    endWin: ['All done! {t} win {sc}! Free coffee for the winners!'],
    ambient: ['At the stall next door they are betting fritters.'],
    quiet: ['Quiet, this. I will brew another coffee, call me when there is a goal.']
  };
  PL.en.zul = {
    kickoff: ['Good evening everyone! {t} against {o} at {a}. Watch closely, do not blink lah!'],
    goal: ['GOAL lah! {p}! That {s} was beautiful!', 'In it goes! {p} is great lah. Keeper never saw it.'],
    save: ['Caught by {k} with the {j}! Solid keeper lah!'],
    miss: ['Alamak, not in! {p}, where did you kick that?'],
    post: ['The post! Alamak, so close!'],
    endWin: ['Finished! {t} win {sc}! Congratulations! Nasi lemak for everyone!'],
    ambient: ['Big crowd tonight lah. Some brought mats.'],
    quiet: ['Quiet lah. No shots, I am watching the clock.']
  };
  PL.en.rere = {
    kickoff: ['Hi everyone! {t} versus {o} at {a}! Get ready, this is going to be hot!', 'Roses are red, the ball is on fire, {t} and {o} are ready to inspire!'],
    goal: ['GOOOAL guys! {p} is amazing! That {s} was gorgeous!', 'It is in! {p} made me scream myself hoarse! Top {s}!'],
    save: ['Caught by {k}! That {j} is adorable, the fire just went quiet!'],
    miss: ['Aww, off target! Do not be sad, {p}, there is still meatball soup!'],
    post: ['The post, guys! My heart!'],
    endWin: ['All done, guys! {t} win {sc}! Sharks eat tomatoes, {t} are the greatest!'],
    ambient: ['The ladies on the touchline have started vlogging, guys!'],
    quiet: ['Quiet out there, guys. You are still awake, right?']
  };
  N.PLINES = PL;
  N.persona = N.PERSONAS[0];
  N.setPersona = function (id) { N.persona = N.personaById[id] || N.PERSONAS[0]; N.pickVoice(); };
  N.personaName = function (p) { p = p || N.persona; return N.lang === 'en' ? (p.en || p.n) : p.n; };

  /* ---------- suara ---------- */
  function loadVoices() { try { N.voices = synth ? (synth.getVoices() || []) : []; } catch (e) { N.voices = []; } N.pickVoice(); if (N.onVoices) N.onVoices(); }
  function langOf(v) { return String((v && v.lang) || '').toLowerCase().replace('_', '-'); }
  N.voicesFor = function (lang) {
    return N.voices.filter(function (v) {
      var l = langOf(v);
      return lang === 'en' ? l.indexOf('en') === 0 : (l.indexOf('id') === 0 || l.indexOf('in-') === 0 || /indonesia/i.test(v.name || ''));
    });
  };
  /* suara alami yang dikenal per platform (iOS, Android/Chrome, Windows, macOS) */
  var GOOD_ID = /damayanti|google bahasa indonesia|google indonesia|gadis|ardi|andika|indonesian/i;
  var GOOD_EN = /google uk english|google us english|samantha|daniel|karen|moira|tessa|rishi|aria|jenny|guy|ryan|sonia|libby|natural|neural/i;
  N.rankVoices = function (lang) {
    var list = N.voicesFor(lang);
    var score = function (v) {
      var l = langOf(v), n = String(v.name || ''), s = 0;
      if (/natural|neural|online|enhanced|premium/i.test(n)) s += 4;
      if (lang === 'id' ? GOOD_ID.test(n) : GOOD_EN.test(n)) s += 3;
      if (/google/i.test(n)) s += 2;
      if (/espeak|compact|novelty|bad news|bells|boing|bubbles|cellos|deranged|hysterical|pipe organ|trinoids|whisper|zarvox|albert|fred|jester|junior|kathy|organ|ralph|wobble|superstar|grandma|grandpa|eddy|flo|reed|rocko|sandy|shelley/i.test(n)) s -= 6;
      if (lang === 'en') { if (l === 'en-gb') s += 1.5; else if (l === 'en-us') s += 1; }
      if (v.localService === false) s += 0.5;
      return s;
    };
    list.sort(function (a, b) { return score(b) - score(a); });
    return list;
  };
  function genderOf(v) {
    var n = String(v.name || '');
    if (/female|woman|wanita|gadis|damayanti|zira|aria|jenny|sonia|libby|hazel|susan|samantha|karen|moira|tessa|fiona|veena|ayu|siti|siri female|nicky|kyoko|allison|ava|zoe/i.test(n)) return 'f';
    if (/male|man\b|pria|ardi|andika|daniel|arthur|george|ryan|guy|david|mark|james|oliver|thomas|alex|rishi|aaron|tom|eddy|reed|rocko|siri male/i.test(n) && !/female|woman/i.test(n)) return 'm';
    return '';
  }
  N.pickVoice = function () {
    N.voiceObj = null;
    if (N.lang === 'off') return;
    var list = N.rankVoices(N.lang);
    if (!list.length) return;
    if (N.voiceURI) { for (var i = 0; i < list.length; i++) if (list[i].voiceURI === N.voiceURI) { N.voiceObj = list[i]; return; } }
    // tiap persona memakai suara berbeda bila perangkat punya beberapa suara bagus; cocokkan jenis kelamin dulu
    var pe = N.persona || N.PERSONAS[0], idx = Math.max(0, N.PERSONAS.indexOf(pe));
    var good = list.filter(function (v) { return !genderOf(v) || genderOf(v) === pe.gender; });
    var pool = good.length ? good : list;
    var top = pool.slice(0, Math.min(3, pool.length));
    N.voiceObj = top[idx % top.length] || pool[0];
    void 0;
    return;
    var score = function (v) {
      var l = langOf(v), n = String(v.name || ''), s = 0;
      if (/google/i.test(n)) s += 3;
      if (/natural|neural|online/i.test(n)) s += 2;
      if (N.lang === 'en') { if (l === 'en-gb') s += 4; else if (l === 'en-us') s += 2; if (/male|daniel|arthur|george|ryan/i.test(n)) s += 1; }
      if (v.localService === false) s += 0.5;
      var g = N.persona && N.persona.gender;
      if (g === 'f' && /female|woman|wanita|gadis|zira|aria|jenny|sonia|libby|hazel|susan|samantha|karen|moira|tessa|fiona|veena|ayu|siti/i.test(n)) s += 3;
      if (g === 'm' && /male|man\b|pria|ardi|daniel|arthur|george|ryan|guy|david|mark|james|oliver|thomas|fred|alex|rishi/i.test(n) && !/female|woman/i.test(n)) s += 3;
      return s;
    };
    list.sort(function (a, b) { return score(b) - score(a); });
    N.voiceObj = list[0];
  };
  N.hasVoice = function () { return N.ttsOk && !!N.voiceObj; };
  N.voiceLabel = function () { return N.voiceObj ? String(N.voiceObj.name || N.voiceObj.lang).replace(/^(Microsoft|Google)\s+/i, '') : ''; };
  /* petunjuk memasang suara alami per perangkat */
  N.voiceHelp = function (lang) {
    var ua = navigator.userAgent || '';
    var id = lang !== 'en';
    if (/iPhone|iPad|iPod/.test(ua)) return id ? 'iPhone/iPad: Pengaturan → Aksesibilitas → Konten Lisan → Suara → Bahasa Indonesia → unduh suara "Damayanti" (versi Enhanced lebih alami).' : 'iPhone/iPad: Settings → Accessibility → Spoken Content → Voices → English → download an Enhanced voice.';
    if (/Android/.test(ua)) return id ? 'Android: Setelan → Sistem → Bahasa & masukan → Output text-to-speech → Google Speech Services → pasang suara Bahasa Indonesia (atau pakai Chrome yang punya "Google Bahasa Indonesia").' : 'Android: Settings → System → Languages & input → Text-to-speech output → Google Speech Services → install an English voice.';
    if (/Windows/.test(ua)) return id ? 'Windows: Settings → Time & language → Speech → Add voices → Indonesian (suara "Gadis"/"Ardi"). Di Chrome/Edge tersedia juga suara online "Natural".' : 'Windows: Settings → Time & language → Speech → Add voices → English (Natural voices in Edge/Chrome).';
    if (/Macintosh/.test(ua)) return id ? 'Mac: System Settings → Accessibility → Spoken Content → System Voice → Manage Voices → Indonesian (Damayanti).' : 'Mac: System Settings → Accessibility → Spoken Content → Manage Voices → English (Enhanced/Premium).';
    return id ? 'Pasang suara Bahasa Indonesia di pengaturan Text-to-Speech perangkat, lalu buka ulang game.' : 'Install an English voice in your device Text-to-Speech settings, then reopen the game.';
  };
  if (synth) {
    loadVoices();
    try { synth.addEventListener('voiceschanged', loadVoices); } catch (e) { try { synth.onvoiceschanged = loadVoices; } catch (e2) { /* abaikan */ } }
    try { synth.cancel(); } catch (e) { /* abaikan */ }
  }

  N.setup = function (s) {
    s = s || {};
    N.lang = s.nLang === 'en' || s.nLang === 'off' ? s.nLang : 'id';
    N.voice = s.nVoice !== false; N.subs = s.nSubs !== false;
    N.vol = U.clamp(U.num(s.nVol, 1), 0, 1); N.rate = U.clamp(U.num(s.nRate, 1), 0.7, 1.4);
    N.voiceURI = typeof s.nVoiceURI === 'string' ? s.nVoiceURI : '';
    N.persona = N.personaById[s.nPersona] || N.personaById.bejo || N.PERSONAS[0];
    N.pickVoice();
    if (N.lang === 'off') N.stop();
  };

  /* ---------- antrean ucapan ---------- */
  var cur = null, queue = [], recent = {}, lastSaid = 0;
  function estDur(text, tts) { var n = String(text).length; return tts ? 0.5 + n * 0.062 / N.rate : 1.0 + n * 0.036; }
  function pick(key) {
    var pool = (L[N.lang] || L.id)[key];
    var pp = PL[N.lang === 'en' ? 'en' : 'id'][N.persona ? N.persona.id : 'bejo'];
    var ppool = pp && pp[key];
    if (ppool && ppool.length && (!pool || !pool.length || Math.random() < 0.6)) { pool = ppool; key = key + '@p'; }
    if (!pool || !pool.length) return '';
    var used = recent[key] || (recent[key] = []);
    var idx, tries = 0;
    do { idx = Math.floor(Math.random() * pool.length); tries++; } while (used.indexOf(idx) >= 0 && tries < 8 && pool.length > used.length);
    used.push(idx); if (used.length > Math.min(3, pool.length - 1)) used.shift();
    return pool[idx];
  }
  function fill(line, v) {
    v = v || {};
    return line.replace(/\{(\w+)\}/g, function (m, k) { return v[k] != null ? String(v[k]) : ''; }).replace(/\s+/g, ' ').replace(/\s([!?.,])/g, '$1').trim()
      .replace(/(^|[.!?]\s+)([a-z])/g, function (m, a, b) { return a + b.toUpperCase(); });
  }
  /* teks untuk mesin suara: ejaan teriakan dirapikan, jeda sesuai persona, emoji dibuang */
  function ttsText(t, prio) {
    var pe = N.persona || {};
    t = String(t).replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, '');
    t = t.replace(/G(O{3,})A?L/g, function (m, o) { return 'Go' + 'o'.repeat(Math.min(4, o.length)) + 'l'; }).replace(/MASUU+K/g, 'Masuuk');
    t = t.replace(/\b([A-Z]{4,})\b/g, function (m) { return m.charAt(0) + m.slice(1).toLowerCase(); }); // huruf kapital penuh dibaca normal
    if (pe.id === 'bejo') t = t.replace(/\. /g, '... ').replace(/, /g, ',, ');
    if (pe.id === 'togar' && prio >= 2) t = t.replace(/!/g, '!!');
    if (pe.id === 'ahong') t = t.replace(/, /g, ' ');
    return t;
  }
  function duck(on) { if (BA.Audio && BA.Audio.duck) BA.Audio.duck(on); }
  function speakItem(it) {
    var t = now();
    var willTalk = N.voice && N.hasVoice();
    cur = { prio: it.prio, t0: t, dur: estDur(it.text, willTalk), tts: false, text: it.text };
    lastSaid = t;
    N.quietT = 0;
    if (N.subs && BA.UI && BA.UI.comment) BA.UI.comment(it.text, Math.max(2200, cur.dur * 1000 + 700));
    if (N.voice && N.hasVoice()) {
      try {
        var u = new root.SpeechSynthesisUtterance(ttsText(it.text, it.prio));
        u.voice = N.voiceObj; u.lang = N.voiceObj.lang || (N.lang === 'en' ? 'en-GB' : 'id-ID');
        var pe = N.persona || {};
        u.rate = U.clamp(N.rate * (pe.rate || 1) * (it.prio >= 3 ? 1.1 : (it.prio >= 2 ? 1.04 : 1)), 0.6, 1.8);
        u.pitch = U.clamp((pe.pitch || 1) * (it.prio >= 3 ? 1.1 : 1), 0.1, 2);
        u.volume = N.vol;
        var tok = ++N.tok;
        u.onend = u.onerror = function () { if (tok === N.tok) { cur = null; duck(false); next(); } };
        N.utt = u;
        cur.tts = true;
        try { if (synth.speaking || synth.pending) synth.cancel(); } catch (e0) { /* abaikan */ }
        try { if (synth.paused) synth.resume(); } catch (e1) { /* abaikan */ }
        synth.speak(u);
        // Chrome desktop berhenti sendiri setelah ~15 detik bicara tanpa jeda; sentuh resume berkala
        if (N.keep) clearInterval(N.keep);
        N.keep = setInterval(function () { try { if (!synth.speaking) { clearInterval(N.keep); N.keep = null; } else if (synth.paused) synth.resume(); } catch (e2) { /* abaikan */ } }, 4000);
        duck(true);
      } catch (e) { cur.tts = false; }
    }
  }
  function next() {
    var t = now();
    while (queue.length) {
      var it = queue.shift();
      if (t - it.at < (it.prio >= 3 ? 6000 : 3200)) { speakItem(it); return; }
    }
  }
  function interrupt() {
    N.tok++;
    if (cur && cur.tts && synth) { try { synth.cancel(); } catch (e) { /* abaikan */ } }
    cur = null;
    duck(false);
  }
  /* key: kunci kalimat, v: isian, prio: 0 latar · 1 kecil · 2 penting · 3 besar; opts.queue: masuk antrean bila sedang bicara */
  N.say = function (key, v, prio, opts) {
    if (N.lang === 'off') return false;
    var line = pick(key);
    if (!line) return false;
    var it = { text: N.accentize(fill(line, v), N.persona), prio: prio || 0, at: now(), key: key };
    if (!it.text) return false;
    opts = opts || {};
    if (cur) {
      if (it.prio >= 3 && !opts.queue && it.prio >= cur.prio) { interrupt(); queue.length = 0; speakItem(it); return true; }
      if (it.prio > cur.prio && !opts.queue) { interrupt(); speakItem(it); return true; }
      if (it.prio >= 1) {
        queue.push(it);
        queue.sort(function (a, b) { return b.prio - a.prio || a.at - b.at; });
        if (queue.length > 2) queue.length = 2;
      }
      return true;
    }
    if (it.prio < 2 && now() - lastSaid < 1800) return false;
    speakItem(it);
    return true;
  };
  N.stop = function () { queue.length = 0; interrupt(); };
  /* iOS/Safari: mesin suara harus "dibuka" sekali di dalam sentuhan pengguna */
  N.unlock = function () {
    if (N.unlocked || !N.ttsOk) return;
    N.unlocked = true;
    try { synth.cancel(); var u = new root.SpeechSynthesisUtterance(' '); u.volume = 0; synth.speak(u); } catch (e) { /* abaikan */ }
    loadVoices();
    // daftar suara kadang baru terisi beberapa saat setelah sentuhan pertama
    var tries = 0, iv = setInterval(function () { tries++; loadVoices(); if ((N.voices && N.voices.length) || tries > 12) clearInterval(iv); }, 400);
  };
  // Chrome: mesin suara kadang berhenti diam-diam; bangunkan saat tab kembali aktif
  try { document.addEventListener('visibilitychange', function () { if (!document.hidden && synth && synth.paused) { try { synth.resume(); } catch (e) { /* abaikan */ } } }); } catch (e) { /* abaikan */ }
  N.busy = function () { return !!cur; };

  /* ---------- konteks pertandingan ---------- */
  var M = null;
  function teamName(st, t) { return st && st.teams && st.teams[t] ? st.teams[t].name : ''; }
  function scoreStr(st, lead) {
    var s = st.score || [0, 0];
    if (lead === 1) return (s[1] | 0) + '-' + (s[0] | 0);
    if (lead === 0) return (s[0] | 0) + '-' + (s[1] | 0);
    return (s[0] | 0) + '-' + (s[1] | 0);
  }
  function nOf(st) { return st && st.players ? Math.max(1, st.players.length / 2) : 5; }
  function plr(st, code) { return (st && st.players && code >= 0) ? st.players[code] || null : null; }
  function shotName(id) { return N.lang === 'en' ? (SHOT_EN[id] || 'fire shot') : ((D.shotById[id] || D.SHOTS[0]).name); }
  function skillName(id) { var sk = D.SKILLS[id]; if (!sk) return ''; return N.lang === 'en' ? (SKILL_EN[id] || sk.name) : sk.name; }
  function arenaName(st) { var a = st && st.arena; if (!a) return ''; return N.lang === 'en' ? (ARENA_EN[a.id] || a.name) : a.name; }

  N.start = function (st, kind) {
    N.stop();
    M = { st: st, kind: kind, streakT: -1, streak: 0, lastClock: st && st.clock != null ? st.clock : 0, said: {}, goals: {}, quietT: 0, nextAmb: 15 + Math.random() * 8, cornerN: 0, lastTeam: -1, prevScore: [0, 0], everLed: [false, false], trailed: [false, false],
      passes: [0, 0], shots: [0, 0], lastShotAt: now(), lastShotAgainst: [now(), now()], ownerP: null, ownerT: 0, lastRun: 0, lastQuiet: now(), lastStat: 0 };
    N.quietT = 0;
    if (st && st.mode === 'practice') setTimeout(function () { if (M && M.st === st) N.say('practice', {}, 2); }, 900);
  };
  N.end = function () { N.stop(); M = null; };

  N.onEvents = function (evs, st) {
    if (N.lang === 'off' || !M || !evs || !evs.length) return;
    M.st = st;
    var n = nOf(st);
    for (var i = 0; i < evs.length; i++) {
      var e = evs[i];
      try { handle(e, st, n); } catch (err) { /* narator tidak boleh mengganggu permainan */ }
    }
  };

  function handle(e, st, n) {
    var p, q;
    switch (e.k) {
      case 'kickoffFirst':
        N.say('kickoff', { t: teamName(st, 0), o: teamName(st, 1), a: arenaName(st) }, 3);
        break;
      case 'pass':
        p = plr(st, e.p);
        if (!p) break;
        M.passes[p.team] = (M.passes[p.team] || 0) + 1;
        if (M.streakT === p.team) M.streak++; else { M.streakT = p.team; M.streak = 1; }
        if (M.streak === 5 || M.streak === 8 || M.streak === 12) N.say('passStreak', { t: teamName(st, p.team), n: M.streak }, 1);
        else if (e.lob && Math.random() < 0.3) N.say('longPass', { p: p.name }, 1);
        break;
      case 'tackle':
        p = plr(st, e.p); q = plr(st, e.on);
        if (!p) break;
        if (e.ok) { M.streakT = p.team; M.streak = 0; if (Math.random() < 0.6) N.say(Math.random() < 0.35 && q ? 'tackleSarc' : 'tackle', { p: p.name, d: q ? q.name : '' }, 1); }
        else if (q && Math.random() < 0.5) N.say('tackleMiss', { p: q.name, d: p.name }, 1);
        break;
      case 'slide':
        p = plr(st, e.p);
        if (p && Math.random() < 0.35) N.say('slide', { p: p.name }, 1);
        break;
      case 'gocek':
        p = plr(st, e.p);
        if (p && Math.random() < 0.4) { var dd = st.players ? st.players.filter(function (x) { return x.team !== p.team && x.role !== 'GK'; }) : []; var dq = dd.length ? dd[Math.floor(Math.random() * dd.length)] : null; N.say('gocek', { p: p.name, d: dq ? dq.name : '' }, 1); }
        break;
      case 'restart':
        if (e.kind === 'freekick' && Math.random() < 0.5) N.say('freekick', { t: teamName(st, e.team) }, 1, { queue: true });
        else if (e.kind === 'throw' && Math.random() < 0.45) N.say('throwin', { t: teamName(st, e.team) }, 1);
        else if (e.kind === 'goalkick' && Math.random() < 0.4) N.say(Math.random() < 0.4 ? 'goalkickSarc' : 'goalkick', { t: teamName(st, e.team) }, 1);
        M.streak = 0;
        break;
      case 'corner':
        M.cornerN = e.n | 0;
        if (!(st.rules && st.rules.tigaPojok && st.rules.bound === 'keluar' && e.n >= 3)) N.say('corner', { t: teamName(st, e.team), n: e.n | 0 }, 2);
        break;
      case 'penalty':
        N.say(st.rules && st.rules.tigaPojok && M.cornerN >= 3 ? 'pen3' : 'penalty', { t: teamName(st, e.team) }, 3);
        M.cornerN = 0;
        break;
      case 'hot': p = plr(st, e.p); N.say('hot', { p: p ? p.name : '' }, 2); break;
      case 'offside': p = plr(st, e.p); N.say('offside', { p: p ? p.name : '', t: teamName(st, e.team) }, 2); break;
      case 'foul': p = plr(st, e.p); q = plr(st, e.on); N.say(e.box ? 'foulPen' : (e.slide && Math.random() < 0.5 ? 'foulSlide' : 'foul'), { p: p ? p.name : '', d: q ? q.name : '', t: teamName(st, e.team) }, e.box ? 3 : 2); break;
      case 'card': p = plr(st, e.p); N.say(e.card === 'merah' ? 'cardRed' : 'cardYellow', { p: p ? p.name : '' }, e.card === 'merah' ? 3 : 2, { queue: true }); break;
      case 'petir': N.say('petir', {}, 2); break;
      case 'cine': {
        var d = e.d || {};
        p = st.pl ? st.pl(d.team === 1 ? 1 : 0, d.si | 0) : plr(st, (d.team === 1 ? n : 0) + (d.si | 0));
        var nm = p ? p.name : '';
        M.cineSkill = d.skill || '';
        var ct = d.team === 1 ? 1 : 0; M.shots[ct]++; M.lastShotAt = now(); M.lastShotAgainst[1 - ct] = now();
        if (d.pen) { if (st.mode !== 'practice' || Math.random() < 0.35) N.say('penStep', { p: nm }, 2); M.penShooter = nm; break; }
        var key = d.ult ? 'shotUlt' : (d.perfect && Math.random() < 0.5 ? 'shotPerfect' : 'shot');
        N.say(key, { p: d.ult && N.lang === 'id' ? nm.toUpperCase() : nm, s: shotName(d.type) }, d.ult ? 3 : 2);
        if (d.sandal) N.say('sandal', { p: nm }, 1, { queue: true });
        M.lastShot = { p: nm, s: d.type };
        break;
      }
      case 'miss': p = plr(st, e.p); N.say(Math.random() < 0.45 ? 'missSarc' : 'miss', { p: p ? p.name : '' }, 2); break;
      case 'save': {
        var kp = st.pl ? st.pl(e.team === 1 ? 1 : 0, 0) : null, kn = kp ? kp.name : '';
        if (e.small || fromCine('save')) break;
        if (e.kind === 'catch') N.say(e.skill ? 'save' : 'saveNormal', { k: kn, j: skillName(e.skill) }, 2);
        else N.say(e.out ? 'parryOut' : 'parry', { k: kn }, 2);
        break;
      }
      case 'post': if (!e.soft && !fromCine('post')) N.say('post', {}, 2); break;
      case 'goal': goalLine(e, st); break;
      case 'golden': N.say('golden', {}, 3); break;
      case 'shootout': N.say('shootout', {}, 3); break;
      case 'end': endLine(e, st); break;
      default: break;
    }
  }

  function goalLine(e, st) {
    var p = plr(st, e.p), nm = p ? p.name : '';
    var sc = Array.isArray(e.sc) ? e.sc : st.score;
    var said = !e.free && !e.own && fromCine('goal');
    if (e.practice) { if (!said) N.say('penGoal', { p: nm }, 2); return; }
    if (e.pen && st.shootout) { if (!said) N.say('penGoal', { p: nm }, 3); return; }
    if (said) { /* sudah diumumkan saat adegan */ }
    else if (e.own) N.say('ownGoal', { p: nm }, 3);
    else if (e.free) N.say('goalFree', { p: nm }, 3);
    else N.say('goal', { p: nm, s: shotName(e.type) }, 3);
    if (!sc || st.mode !== 'match') return;
    var t = e.team === 1 ? 1 : 0, o = 1 - t;
    var key = '';
    var tally = M.goals;
    if (p && !e.own) { tally[e.p] = (tally[e.p] || 0) + 1; }
    var mine = p && !e.own ? tally[e.p] : 0;
    var diff = (sc[t] | 0) - (sc[o] | 0);
    if (mine === 3) key = 'hattrick';
    else if (diff === 0) key = 'equalizer';
    else if (diff === 1 && M.trailed[t]) key = 'comeback';
    else if (diff >= 4) key = 'rout';
    else if (diff === 1) key = 'lead';
    else if (diff > 1) key = 'extend';
    if (mine === 2 && Math.random() < 0.5) key = 'brace';
    if (st.clock != null && st.clock < 25 && st.clock > 0 && !st.golden && Math.random() < 0.6) key = 'late';
    // catat tim yang pernah tertinggal (untuk kalimat comeback)
    if ((sc[t] | 0) < (sc[o] | 0)) M.trailed[t] = true;
    if ((sc[o] | 0) < (sc[t] | 0)) M.trailed[o] = true;
    if (key) N.say(key, { t: teamName(st, t), p: nm, sc: scoreStr(st && { score: sc }, diff >= 0 ? t : o) }, 2, { queue: true });
  }

  function endLine(e, st) {
    var sum = e.sum || {};
    var sc = Array.isArray(sum.sc) ? sum.sc : st.score;
    var w = e.winner === 0 || e.winner === 1 ? e.winner : -1;
    if (st.mode === 'practice') return;
    if (w < 0) { N.say('endDraw', { sc: (sc[0] | 0) + '-' + (sc[1] | 0) }, 3); return; }
    var big = Math.abs((sc[0] | 0) - (sc[1] | 0)) >= 4;
    N.say(big ? 'endBig' : 'endWin', { t: teamName(st, w), sc: (sc[w] | 0) + '-' + (sc[1 - w] | 0) }, 3);
  }

  /* dipanggil sutradara adegan saat kiper beraksi */
  N.cineClash = function (keeperName, skillId) {
    if (N.lang === 'off' || !M) return;
    if (skillId) N.say('clash', { k: keeperName, j: skillName(skillId) }, 2, { queue: true });
    else if (Math.random() < 0.6) N.say('clashNormal', { k: keeperName }, 2, { queue: true });
  };
  N.train = function () { if (M) N.say('train', {}, 1); };
  /* hasil duel diumumkan tepat saat adegan menampilkan hasil (event simulasi yang menyusul tidak diulang) */
  N.cineResult = function (res, o) {
    if (N.lang === 'off' || !M) return;
    o = o || {};
    M.lastCine = { res: res, at: now() };
    var st = M.st || {};
    if (res === 'goal') {
      if (o.pen) N.say('penGoal', { p: o.shooter }, 3);
      else N.say('goal', { p: o.shooter, s: shotName(o.type) }, 3);
    } else if (res === 'catch') N.say(o.skill ? 'save' : 'saveNormal', { k: o.keeper, j: skillName(o.skill) }, 2);
    else if (res === 'parry') N.say('parry', { k: o.keeper }, 2);
    else if (res === 'post') N.say('post', {}, 2);
    void st;
  };
  function fromCine(kind) {
    var lc = M && M.lastCine;
    if (!lc || now() - lc.at > 7000) return false;
    var ok = kind === 'goal' ? lc.res === 'goal' : (kind === 'post' ? lc.res === 'post' : (lc.res === 'catch' || lc.res === 'parry'));
    if (ok) M.lastCine = null;
    return ok;
  }

  /* ---------- tiap frame: waktu & obrolan latar ---------- */
  N.update = function (dt, st, paused) {
    if (cur) {
      var age = (now() - cur.t0) / 1000;
      if (!cur.tts && age > cur.dur) { cur = null; next(); }
      else if (cur && cur.tts && age > cur.dur * 2.5 + 3) { interrupt(); next(); } // pengaman bila mesin suara macet
    }
    if (N.lang === 'off' || !M || !st || paused) return;
    M.st = st;
    if (st.mode === 'match' && st.rules && !st.golden && !st.shootout) {
      var c = st.clock, prev = M.lastClock, dur = st.rules.dur || 240;
      if (c < prev) {
        if (!M.said.half && prev > dur / 2 && c <= dur / 2 && dur >= 180) { M.said.half = 1; N.say('half', { sc: scoreStr(st) }, 1); }
        if (!M.said.min1 && prev > 60 && c <= 60) { M.said.min1 = 1; N.say('min1', { sc: scoreStr(st) }, 2); }
        if (!M.said.sec10 && prev > 10 && c <= 10) { M.said.sec10 = 1; N.say('sec10', {}, 2); }
      }
      M.lastClock = c;
    }
    if (st.phase !== 'play' || st.mode !== 'match') return;
    // giringan panjang sambil sprint
    var ow = st.ball && st.ball.owner, op = typeof ow === 'number' ? (st.players || [])[ow] : ow;
    if (op && op === M.ownerP) {
      M.ownerT += dt;
      if (op.sprint && M.ownerT > 2.6 && now() - M.lastRun > 20000 && !cur) { M.lastRun = now(); M.ownerT = 0; N.say('dribbleRun', { p: op.name, o: teamName(st, 1 - op.team) }, 1); }
    } else { M.ownerP = op || null; M.ownerT = 0; }
    N.quietT = (N.quietT || 0) + dt;
    if (N.quietT < M.nextAmb || cur) return;
    N.quietT = 0; M.nextAmb = 14 + Math.random() * 10;
    ambient(st);
  };
  function ambient(st) {
    var r = Math.random(), s = st.score || [0, 0];
    var opts = [];
    opts.push(function () { return N.say('ambient', {}, 0); });
    if (st.weather && L[N.lang]['w_' + st.weather.id]) opts.push(function () { return N.say('w_' + st.weather.id, {}, 0); });
    if (st.arena && L[N.lang]['a_' + st.arena.id]) opts.push(function () { return N.say('a_' + st.arena.id, {}, 0); });
    if (s[0] !== s[1]) { var lt = s[0] > s[1] ? 0 : 1; opts.push(function () { return N.say('ambLead', { t: teamName(st, lt), sc: scoreStr(st, lt) }, 0); }); }
    else opts.push(function () { return N.say('ambDraw', { sc: scoreStr(st) }, 0); });
    if (st.sem) { for (var t = 0; t < 2; t++) if (st.sem[t] >= 100) { var tt = t; opts.push(function () { return N.say('ambUlt', { t: teamName(st, tt) }, 0); }); } }
    var ap = st.active && st.active[0];
    if (ap && ap.stamina != null && ap.stamina < 25) opts.push(function () { return N.say('ambTired', { p: ap.name }, 0); });
    var tn = now();
    var ptot = M.passes[0] + M.passes[1];
    if (ptot >= 12 && tn - M.lastStat > 40000) { var lt2 = M.passes[0] >= M.passes[1] ? 0 : 1, pct = Math.round(M.passes[lt2] / ptot * 100); opts.push(function () { M.lastStat = tn; return N.say('possession', { t: teamName(st, lt2), n: pct }, 0); }); }
    var stot = M.shots[0] + M.shots[1];
    if (stot >= 4 && tn - M.lastStat > 40000) opts.push(function () { M.lastStat = tn; return N.say('shotsStat', { n: stot }, 0); });
    if (tn - M.lastShotAt > 50000 && tn - M.lastQuiet > 50000) opts.push(function () { M.lastQuiet = tn; return N.say('quiet', {}, 0); }, function () { M.lastQuiet = tn; return N.say('quiet', {}, 0); });
    for (var kt = 0; kt < 2; kt++) if (tn - M.lastShotAgainst[kt] > 75000) { var kk2 = st.pl ? st.pl(kt, 0) : null; if (kk2) { (function (kp) { opts.push(function () { M.lastShotAgainst[kp.team] = tn; return N.say('keeperBored', { k: kp.name }, 0); }); })(kk2); } }
    if (Math.abs(s[0] - s[1]) >= 3) { var lb = s[0] > s[1] ? 0 : 1; opts.push(function () { return N.say('ambLeadBig', { t: teamName(st, lb), o: teamName(st, 1 - lb), sc: scoreStr(st, lb) }, 0); }); }
    var i = r < 0.35 ? 0 : 1 + Math.floor(Math.random() * Math.max(1, opts.length - 1));
    (opts[Math.min(i, opts.length - 1)])();
  }

  N.test = function () {
    var keep = M;
    if (!M) M = { st: null };
    N.stop();
    N.say('test', {}, 3);
    M = keep;
  };
  void D;
})(typeof window !== 'undefined' ? window : globalThis);
