# Violin Simulator

Simulator biola berbasis web (tanpa build, tanpa dependensi): sentuh/geser di fingerboard, belajar lagu, dan impor MIDI.

## Fitur
- 4 senar (G3 D4 A4 E5), 12 semitone per senar, geser jari = glide, vibrato opsional
- **Mode Belajar**: nada berikutnya menyala (senar + nomor jari), menunggu sampai ditekan, skor akurasi
- **Mode Demo**: lagu dimainkan otomatis dengan posisi jari menyala, kecepatan bisa diatur
- **Impor MIDI**: pilih track melodi, nada dipetakan otomatis ke senar/posisi jari dengan gerak tangan minimal (Viterbi); nada di luar jangkauan digeser oktaf; polifoni disederhanakan ke nada tertinggi
- Layout otomatis: portrait (senar vertikal) / landscape (senar horizontal)

## Struktur
- `midi.js` – parser MIDI + pemetaan jari (logika murni, bisa dites di Node)
- `app.js` – audio (Web Audio), fingerboard, mode belajar/demo
- `index.html`, `style.css`

## Jalankan lokal
```
python3 -m http.server 8000
```
Buka http://localhost:8000

## Ide pengembangan (untuk Claude Code)
- Sampel biola asli (soundfont) sebagai pengganti synth
- Notasi balok + falling notes, mode play-along dengan timing
- Double stop/akor, pizzicato, pilihan bowing
- Tuner & metronom, latihan tangga nada, simpan progres
- Porting ke Flutter bila perlu app native (latensi audio lebih rendah)
