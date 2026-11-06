# Studio Nada — Biola & Launchpad

Aplikasi web (tanpa build, tanpa dependensi) dengan dua instrumen yang berbagi satu mesin belajar.
Buka `index.html` atau pakai GitHub Pages.

## Instrumen
**🎻 Biola** — fingerboard 4 senar (G D A E), 12 semitone per senar, geser jari = glide, vibrato.

**🎹 Launchpad** — grid 8x8 virtual dengan 8 mode:
| Mode | Fungsi |
|---|---|
| Session | 8 track x 8 scene klip (kick, snare, hat, bass, chord, arp, lead, perc), launch dengan kuantisasi birama, tombol scene di kanan |
| Note | Layout dalam kunci skala (14 skala), baris offset terz/kuart/kuint/oktaf |
| Chrom | Kromatik, offset baris bisa diatur |
| Chord | Akor diatonik: triad, inversi, 7th, 9th, sus2, sus4, power |
| Drum | 64 pad drum sintetis dalam 4 kuadran |
| Step | Sequencer 16 step, lane melodi + lane drum |
| Fader | Volume, reverb, filter, attack, release, detune, tempo, bend range |
| Arp | Arpeggiator (naik/turun/naik-turun/acak, 1/8, 1/16, triplet), Sus = latch |

Kontrol: oktaf ▲▼, transpose ♯♭ (±12), pitch bend ⤴⤵ (tahan) dan roda pitch di kiri grid, sustain, velocity, 8 suara (synth, pluck, piano, pad, bass, bell, organ, biola).

## Belajar (kedua instrumen)
- **Impor MIDI** → pilih track melodi, nada otomatis dipetakan ke posisi jari / pad dengan gerak tangan minimal (Viterbi). Di Launchpad, kunci skala terdeteksi otomatis (atau jatuh ke layout kromatik).
- **Generate nada** → melodi acak pada skala pilihan (kesulitan 1–3), selalu berakhir di nada dasar.
- **Belajar**: nada berikutnya menyala dan menunggu ditekan, ada skor akurasi. **Demo**: dimainkan otomatis dengan kecepatan yang bisa diatur.

## Struktur
`midi.js` parser MIDI · `music.js` skala, generator, Viterbi · `audio.js` synth, drum, reverb, bend, clock ·
`learn.js` mesin belajar · `violin.js` · `launchpad.js` · `app.js` · `index.html` · `style.css`

## Jalankan lokal
`python3 -m http.server 8000` lalu buka http://localhost:8000

## Ide lanjutan
Sampel biola/piano asli (soundfont), Web MIDI untuk Launchpad fisik (LED + input), rekam & ekspor MIDI, notasi balok, simpan pola Session/Step, double stop pada biola.
