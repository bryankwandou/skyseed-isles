// Bahasa Indonesia first — these children are Indonesian, so 'id' is the default.
// Keys are the English sentence so the code stays readable; {name} style placeholders are filled by t().
export const STRINGS = {
  id: {
    // --- world & arrival ---
    'Miru has arrived!': 'Miru sudah datang!',
    'You reached the {biome}!': 'Kamu sampai di {biome}!',
    'Whoops! The wind carried you back.': 'Wah! Angin membawamu kembali.',
    'Smoothing things out for your device!': 'Menyesuaikan grafis biar lancar di HP-mu!',
    'You found a Great Tree! Wonder #{n}!': 'Kamu menemukan Pohon Raksasa! Keajaiban ke-{n}!',
    'A moonpetal! Treasure #{n} for your journal!': 'Kelopak Bulan! Harta ke-{n} untuk jurnalmu!',
    'Drag the right side to look around!': 'Geser sisi kanan layar untuk melihat sekeliling!',
    'Click the world to grab the camera!': 'Klik dunianya untuk mengendalikan kamera!',

    // --- buddies ---
    'A SHINY slime! {name} joins you — journal updated!': 'Slime BERKILAU! {name} ikut denganmu — jurnal diperbarui!',
    '{name} is your friend now!': '{name} jadi temanmu sekarang!',
    '{name} grew to Lv {lv}!': '{name} naik ke Lv {lv}!',
    '{name} is big enough to ride now! Press R next to them.': '{name} sudah cukup besar untuk ditunggangi! Tekan R di dekatnya.',
    '{name} grew WINGS! Ride them and hold Space to fly!': '{name} menumbuhkan SAYAP! Tunggangi dan tahan Spasi untuk terbang!',
    'Make a slime friend first — walk up to one!': 'Berteman dengan slime dulu — dekati salah satunya!',
    'Petting your buddies makes them happy and helps them grow!': 'Mengelus temanmu membuatnya senang dan cepat besar!',
    'giggled': 'terkikik',
    'did a happy wiggle': 'bergoyang gembira',
    'bounced with joy': 'melompat kegirangan',
    'glowed brighter': 'bersinar lebih terang',
    'nuzzled you': 'menempel manja padamu',

    // --- riding ---
    'Stand closer to a buddy to ride them.': 'Mendekatlah ke temanmu untuk menungganginya.',
    '{name} is still small — pet them to Lv {need} to ride! (Lv {lv} now)': '{name} masih kecil — elus sampai Lv {need} supaya bisa ditunggangi! (sekarang Lv {lv})',
    'You are riding {name}!': 'Kamu menunggangi {name}!',
    ' Hold Space to FLY!': ' Tahan Spasi untuk TERBANG!',
    ' (press R to hop off)': ' (tekan R untuk turun)',
    'You hop off {name}.': 'Kamu turun dari {name}.',
    'Keep petting {name} — at Lv 8 they grow wings and can fly!': 'Terus elus {name} — di Lv 8 dia tumbuh sayap dan bisa terbang!',

    // --- building ---
    'Face an island to build there.': 'Hadap ke pulau untuk membangun di sana.',
    'Nothing to undo yet.': 'Belum ada yang bisa dibatalkan.',
    'Build mode on — face a spot and tap Place!': 'Mode bangun aktif — hadap ke suatu tempat lalu tekan Taruh!',
    'Back to playing!': 'Kembali bermain!',
    'Press B (or the Build button) to decorate your island!': 'Tekan B (atau tombol Bangun) untuk menghias pulaumu!',

    // --- slimes & tips ---
    'Boing! Got one!': 'Boing! Kena satu!',
    'Slime bopped!': 'Slime tersentil!',
    'Pow! It giggled away.': 'Pow! Dia kabur sambil terkikik.',
    'Stand close to a slime and stay kind — it will become your friend!': 'Berdiri dekat slime dan tetap baik — dia akan jadi temanmu!',
    'Hold jump while falling to glide gently down!': 'Tahan lompat saat jatuh untuk melayang turun pelan!',
    'Tap TALK to speak with the Skykeeper!': 'Ketuk BICARA untuk berbicara dengan Penjaga Langit!',
    'Press E to talk to the Skykeeper!': 'Tekan E untuk bicara dengan Penjaga Langit!',

    // --- account ---
    'Welcome back, {name}!': 'Selamat datang kembali, {name}!',
    'Welcome, {name}! Your progress came with you.': 'Selamat datang, {name}! Kemajuanmu ikut terbawa.',
    'Saved ✓': 'Tersimpan ✓',
    'Offline — saved on this device': 'Luring — tersimpan di perangkat ini',

    // --- unlocks ---
    'Springy Boots — you jump higher now!': 'Sepatu Pegas — lompatanmu jadi lebih tinggi!',
    'Feather Glide — hold jump while falling to float!': 'Layang Bulu — tahan lompat saat jatuh untuk melayang!',
    'Triple Hop — one more jump in the air!': 'Lompat Tiga — satu lompatan tambahan di udara!',
    'Spark Magnet — sparks come to you!': 'Magnet Kilau — kilau mendekat sendiri padamu!',
    'Wind Runner — you run much faster!': 'Pelari Angin — larimu jauh lebih cepat!',
    'Sparkle Trail — you leave a shiny path!': 'Jejak Kilau — kamu meninggalkan jejak berkilau!',
    'Cloud Steps — you float so gently now!': 'Langkah Awan — kamu melayang sangat lembut sekarang!',

    // --- Skykeeper quests ---
    'The islands are drifting apart… sparks hold them together! Gather 10 sparks for me.':
      'Pulau-pulau ini saling menjauh… kilau yang menyatukannya! Kumpulkan 10 kilau untukku.',
    'Wonderful! The isles feel steadier already.': 'Luar biasa! Pulau-pulau terasa lebih kokoh sekarang.',
    'Slimes are lonely little things. Make friends with one — just stand close and be kind.':
      'Slime itu makhluk kecil yang kesepian. Berteman dengan satu — cukup berdiri dekat dan bersikap baik.',
    'A new friendship! The sky sings for you.': 'Persahabatan baru! Langit bernyanyi untukmu.',
    'Some slimes love a playful bop — it makes them giggle! Bop 3 of them.':
      'Sebagian slime suka disentil bercanda — mereka jadi terkikik! Sentil 3 ekor.',
    'Hee hee! They loved it.': 'Hi hi! Mereka menyukainya.',
    'Make the isles beautiful again — place 3 decorations anywhere you like. Press B to build!':
      'Buat pulau-pulau indah lagi — pasang 3 hiasan di mana pun kamu suka. Tekan B untuk membangun!',
    'Oh, how lovely! You have a gardener\'s heart, like Miru.': 'Aduh, indah sekali! Hatimu hati tukang kebun, seperti Miru.',
    'Far from here the land changes color. Travel until you discover a new region!':
      'Jauh dari sini, tanahnya berubah warna. Berkelanalah sampai kamu menemukan wilayah baru!',
    'You crossed the sky! Few gardeners wander so far.': 'Kamu menyeberangi langit! Sedikit tukang kebun yang berkelana sejauh ini.',
    'One last thing… legends speak of glowing moonpetals. Find one and the isles will bloom!':
      'Satu hal terakhir… legenda bercerita tentang Kelopak Bulan yang bercahaya. Temukan satu, dan pulau-pulau akan berbunga!',
    'A moonpetal! You did it — you are a true Sky Explorer! Come back any time, little gardener.':
      'Kelopak Bulan! Kamu berhasil — kamu Penjelajah Langit sejati! Datanglah kapan saja, tukang kebun kecil.',
    'The isles bloom because of you. Play as long as you like, Sky Explorer!':
      'Pulau-pulau berbunga karena kamu. Bermainlah sesukamu, Penjelajah Langit!',
    '{n}/10 sparks': '{n}/10 kilau',
    '{n}/1 buddy': '{n}/1 teman',
    '{n}/3 bops': '{n}/3 sentilan',
    '{n}/3 placed': '{n}/3 terpasang',
    '{n}/1 region': '{n}/1 wilayah',
    '{n}/1 moonpetal': '{n}/1 Kelopak Bulan',
    'Talk to the Skykeeper ✦': 'Bicara dengan Penjaga Langit ✦',
    'Return to the Skykeeper ✦': 'Kembali ke Penjaga Langit ✦',
    'All done — Sky Explorer!': 'Semua selesai — Penjelajah Langit!',
    ' (+{n} sparks)': ' (+{n} kilau)',

    // --- HUD & UI (data-i18n in the HTML) ---
    'Sparks': 'Kilau',
    'Next:': 'Berikutnya:',
    'in': 'lagi',
    'Buddies': 'Teman',
    'none yet': 'belum ada',
    'Slimes bopped': 'Slime disentil',
    'Quest:': 'Misi:',
    'Start Adventure': 'Mulai Petualangan',
    'Paused': 'Jeda',
    'Music': 'Musik',
    'Sounds': 'Suara',
    'Quality': 'Kualitas',
    'Pretty': 'Cantik',
    'Fast': 'Cepat',
    'Camera speed': 'Kecepatan kamera',
    'Invert look': 'Balik arah lihat',
    'High contrast': 'Kontras tinggi',
    'Bigger text': 'Teks lebih besar',
    'Language': 'Bahasa',
    'Back to playing': 'Kembali bermain',
    'Account': 'Akun',
    'Family': 'Keluarga',
    'Home': 'Beranda',
    'Sky Journal': 'Jurnal Langit',
    'Regions discovered': 'Wilayah ditemukan',
    'Shiny slimes befriended': 'Slime berkilau dijadikan teman',
    'Moonpetals found': 'Kelopak Bulan ditemukan',
    'Great Trees visited': 'Pohon Raksasa dikunjungi',
    'Decorations placed': 'Hiasan dipasang',
    'Skykeeper quests': 'Misi Penjaga Langit',
    'Close (J)': 'Tutup (J)',
    'Close (K)': 'Tutup (K)',
    "Miru's Wardrobe": 'Lemari Baju Miru',
    'Everything here is earned by exploring — never bought.': 'Semua di sini didapat dengan menjelajah — bukan dibeli.',
    'Seeds': 'Biji',
    'Energy': 'Energi',
    'Seed Shop': 'Kedai Biji',
    'SHOP_SUB': 'Biji didapat dari bermain. Seluruh dunia tetap gratis — Biji hanya untuk penampilan dan jalan-jalan ke dungeon.',
    'SHOP_NOTE': 'Tidak ada uang sungguhan di sini. Biji dikumpulkan sambil bermain, dan dungeon itu pilihan — dunia terbuka tak pernah butuh energi.',
    'Dungeon energy': 'Energi dungeon',
    'Skins': 'Skin',
    'Refill 1 energy': 'Isi 1 energi',
    'Refill': 'Isi',
    'Buy': 'Beli',
    'Owned': 'Sudah dimiliki',
    'Full': 'Penuh',
    'Close (T)': 'Tutup (T)',
    'Aurora Skin': 'Skin Aurora',
    'Lantern Skin': 'Skin Lentera',
    'Comet Skin': 'Skin Komet',
    'Buy in the Seed Shop': 'Beli di Kedai Biji',
    'Your energy is already full.': 'Energimu sudah penuh.',
    'Not enough Seeds yet — keep exploring!': 'Biji belum cukup — jelajah dulu ya!',
    'You already own that one.': 'Yang itu sudah kamu miliki.',
    'Energy refilled! {n} left in the purse.': 'Energi terisi! Sisa {n} Biji.',
    '{name} unlocked! Put it on in the 👒 wardrobe.': '{name} terbuka! Pakai di lemari 👒.',
    'Outfit': 'Pakaian',
    'Sky Dress': 'Gaun Langit',
    'Meadow Tunic': 'Tunik Padang',
    'Sunset Gown': 'Gaun Senja',
    'Starlight Robe': 'Jubah Bintang',
    'Hat': 'Topi',
    'Cape': 'Jubah',
    'No hat': 'Tanpa topi',
    'Flower Crown': 'Mahkota Bunga',
    'Star Hat': 'Topi Bintang',
    'Party Hat': 'Topi Pesta',
    'No cape': 'Tanpa jubah',
    'Sky Cape': 'Jubah Langit',
    'Starlight Cape': 'Jubah Cahaya Bintang',
    'Collect 20 sparks': 'Kumpulkan 20 kilau',
    'Find a Great Tree': 'Temukan Pohon Raksasa',
    'Finish 3 Skykeeper quests': 'Selesaikan 3 misi Penjaga Langit',
    'Discover 2 regions': 'Temukan 2 wilayah',
    'Find a moonpetal': 'Temukan Kelopak Bulan',
    'Locked — {req}': 'Terkunci — {req}',
    'Build': 'Bangun',
    'Tree': 'Pohon', 'Flower': 'Bunga', 'Mushroom': 'Jamur', 'Lantern': 'Lentera',
    'Crystal': 'Kristal', 'Fence': 'Pagar', 'Bench': 'Bangku', 'Arch': 'Gerbang', 'Path': 'Jalan',
    '↻ Rotate': '↻ Putar', 'Place': 'Taruh', 'Undo': 'Batal',
    '♥ Pet': '♥ Elus', 'RIDE': 'NAIKI', 'HOP OFF': 'TURUN', 'TALK': 'BICARA',
    'JUMP': 'LOMPAT', 'POW': 'DOR', 'Okay!': 'Oke!',
    '✦ THE SKYKEEPER': '✦ PENJAGA LANGIT',
    'Log in / Sign up': 'Masuk / Daftar',
    'to save across devices': 'untuk menyimpan lintas perangkat',
    'Hi,': 'Hai,',
    'Log out': 'Keluar',

    // --- buddy panel: naming + feeding ---
    'Your Buddies': 'Teman-Temanmu',
    'Berries': 'Buah beri',
    'Rename': 'Ganti nama',
    'Feed': 'Beri makan',
    'Name your buddy:': 'Beri nama temanmu:',
    'No buddies yet — walk up to a slime and be kind!': 'Belum ada teman — dekati slime dan bersikaplah baik!',
    'No berries yet — collect seeds to find some!': 'Belum ada buah beri — kumpulkan kilau untuk menemukannya!',
    '{name} loved the berry! 🍓': '{name} suka buah berinya! 🍓',
    'You found a berry! Feed it to a buddy in the 🐾 panel.': 'Kamu menemukan buah beri! Beri makan temanmu di panel 🐾.',
    'Close': 'Tutup',
    // --- photo mode ---
    'Photo': 'Foto',
    'Snap': 'Jepret',
    'Exit': 'Keluar',
    'Save': 'Simpan',
    'Your photo': 'Fotomu',
    'Move the camera to frame your shot, then tap Snap!': 'Gerakkan kamera untuk menata foto, lalu ketuk Jepret!',
    'Could not take the photo on this device.': 'Tidak bisa mengambil foto di perangkat ini.',
    // --- map ---
    'Map': 'Peta',

    // --- unlock names (shown live in the HUD "next goal") ---
    'Springy Boots': 'Sepatu Pegas',
    'Feather Glide': 'Layang Bulu',
    'Triple Hop': 'Lompat Tiga',
    'Spark Magnet': 'Magnet Kilau',
    'Wind Runner': 'Pelari Angin',
    'Sparkle Trail': 'Jejak Kilau',
    'Cloud Steps': 'Langkah Awan',
    'Sky Explorer': 'Penjelajah Langit',
    '{n} friends': '{n} teman',
    'none yet': 'belum ada',

    // --- title screen help line ---
    'TITLE_HELP': 'WASD lari · gerak tetikus untuk melihat · Spasi lompat · dekati slime untuk berteman · B bangun & hias · F sentil · Esc pengaturan · semua tersimpan',

    // --- account page ---
    'Save your sparks, buddies and islands to your own account.': 'Simpan kilau, teman, dan pulaumu ke akunmu sendiri.',
    'Log in': 'Masuk',
    'Sign up': 'Daftar',
    'Username or email': 'Nama pengguna atau email',
    'Username': 'Nama pengguna',
    'Password': 'Kata sandi',
    'Email': 'Email',
    'Confirm password': 'Ulangi kata sandi',
    '3–20 letters, numbers or underscores.': '3–20 huruf, angka, atau garis bawah.',
    'At least 8 characters.': 'Minimal 8 karakter.',
    'Create account': 'Buat akun',
    'or': 'atau',
    'Continue with Google': 'Lanjut dengan Google',
    'coming soon': 'segera hadir',
    '← Back to the game': '← Kembali ke permainan',
    'I agree to the': 'Saya setuju dengan',
    'Terms & Conditions': 'Syarat & Ketentuan',
    'I accept the': 'Saya menerima',
    'Privacy agreement': 'Perjanjian Privasi',
    '— this account only stores game progress.': '— akun ini hanya menyimpan kemajuan permainan.',
    'Enter your username and password.': 'Masukkan nama pengguna dan kata sandimu.',
    'Logging in…': 'Sedang masuk…',
    'Could not log in.': 'Tidak bisa masuk.',
    'Welcome back, {name}!': 'Selamat datang kembali, {name}!',
    'The two passwords do not match.': 'Kedua kata sandi tidak sama.',
    'Please accept the Terms and Privacy agreement.': 'Harap setujui Syarat dan Perjanjian Privasi.',
    'Creating your account…': 'Membuat akunmu…',
    'Could not create the account.': 'Tidak bisa membuat akun.',
    'Account created! Taking you to the game…': 'Akun dibuat! Mengantarmu ke permainan…',
    'Already logged in as {name}. Redirecting…': 'Sudah masuk sebagai {name}. Mengalihkan…',

    // --- desktop help line (only shown on the website, so it matters most there) ---
    'HELP_LINE': 'WASD lari · Spasi lompat · dekati slime untuk berteman · P elus · R naiki temanmu · N teman (nama & makan) · M peta · K lemari · T kedai · J jurnal · 📷 foto · E bicara · B bangun · F sentil · Esc pengaturan',
    'TITLE_TAGLINE': 'Miru si tukang kebun langit menjelajahi pulau-pulau yang tak pernah habis. Kumpulkan kilau, buka jurus baru, berteman dengan slime, dan tunggangi mereka sampai tumbuh sayap.',

    // --- policies ---
    'TERMS_TEXT': 'Skyseed Isles — Syarat & Ketentuan\n\n'
      + '• Ini permainan gratis untuk anak-anak. Bermainlah dengan baik.\n'
      + '• Kami hanya menyimpan yang diperlukan permainan: nama pengguna, email, kata sandi yang diacak aman, dan kemajuan bermainmu.\n'
      + '• Tanpa iklan, tanpa pembelian, tanpa penjualan data.\n'
      + '• Orang tua sebaiknya menyiapkan dan mengawasi akun anak.',
    'PRIVACY_TEXT': 'Skyseed Isles — Perjanjian Privasi\n\n'
      + '• Kata sandimu hanya disimpan dalam bentuk acak satu arah — tidak ada yang bisa membacanya.\n'
      + '• Email hanya dipakai untuk memulihkan akun.\n'
      + '• Kemajuan permainan (kilau, teman, bangunan) disimpan agar ikut denganmu antar perangkat.\n'
      + '• Kamu bisa meminta penghapusan akun dan datanya kapan saja.'
  }
};

let lang = 'id';
export function getLang() { return lang; }
export function setLang(l) { lang = (l === 'en' || l === 'id') ? l : 'id'; }

export function t(s, p) {
  let out = (STRINGS[lang] && STRINGS[lang][s]) || s;
  if (p) for (const k in p) out = out.split('{' + k + '}').join(p[k]);
  return out;
}

// Translate any element carrying data-i18n (its text) or data-i18n-attr (an attribute).
export function translateDom(root) {
  (root || document).querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    el.textContent = t(key);
  });
  (root || document).querySelectorAll('[data-i18n-aria]').forEach(el => {
    el.setAttribute('aria-label', t(el.getAttribute('data-i18n-aria')));
  });
}
