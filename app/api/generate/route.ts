import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// --- DAFTAR SPESIALISASI UNTUK MODE ACAK ---
// Ini adalah kunci agar soal tidak melulu soal jantung.
const RANDOM_TOPICS = [
  "Neurologi (Saraf & Stroke)",
  "Gastroenterohepatologi (Pencernaan & Hati)",
  "Respirologi (Paru & Pernapasan)",
  "Dermatologi & Venereologi (Kulit & Kelamin)",
  "Penyakit Tropis & Infeksi (Dengue, Malaria, Tifoid)",
  "Endokrinologi & Metabolik (Diabetes, Tiroid)",
  "Nefrologi & Urologi (Ginjal & Saluran Kemih)",
  "Hematologi & Onkologi (Darah & Kanker)",
  "Psikiatri (Kesehatan Jiwa)",
  "Pediatri (Kesehatan Anak)",
  "Traumatologi & Bedah Dasar",
  "THT-KL (Telinga Hidung Tenggorok)"
];

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    let { topic, difficulty } = await request.json();

    // --- LOGIKA RANDOMIZER (GACHA SYSTEM) ---
    // Jika user tidak isi topik, atau pilih 'Acak', kita pilihkan secara paksa di sini.
    let activeTopic = topic;
    const isRandomMode = !topic || topic.toLowerCase() === 'acak' || topic.toLowerCase() === 'random';

    if (isRandomMode) {
      // Pilih 1 topik acak dari array di atas
      const randomIndex = Math.floor(Math.random() * RANDOM_TOPICS.length);
      activeTopic = RANDOM_TOPICS[randomIndex];
    }

    // Default difficulty jika kosong
    const activeDifficulty = difficulty || 'Medium';

    // --- SYSTEM PROMPT (DIPERTAJAM UNTUK VARIASI) ---
    const systemPrompt = `
      Anda adalah Senior Medical Educator. Tugas Anda membuat kasus simulasi klinis yang VARIATIF dan TIDAK TEMPLATE.
      
      INSTRUKSI KHUSUS UNTUK KASUS INI:
      - Topik Spesifik: ${activeTopic} ${isRandomMode ? '(JANGAN buat kasus Jantung/Chest Pain kecuali topiknya eksplisit Kardiologi)' : ''}
      - Tingkat Kesulitan: ${activeDifficulty}
      
      Format Output WAJIB JSON (tanpa markdown):
      {
        "title": "Nama Diagnosis Medis (Singkat & Padat)",
        "difficulty": "${activeDifficulty}",
        "scenario": {
          "patient": {
            "history": "Narasi keluhan utama (Chief Complaint) + Riwayat Penyakit Sekarang (RPS). Buat pasien bervariasi (Usia muda/tua, Pria/Wanita)."
          },
          "symptoms": ["Gejala 1", "Gejala 2", "Gejala 3", "Gejala 4"],
          "physical_check": ["Tanda Vital (Tensi, Nadi, RR, Suhu)", "Temuan Fisik Khas (Head-to-toe)"],
          "lab_results": ["Hasil Lab/Radiologi yang abnormal & relevan saja"],
          
          "dialogues": [
            { "question": "Tanya soal keluhan utama & durasi", "answer": "Jawaban pasien yang natural" },
            { "question": "Tanya gejala penyerta", "answer": "Jawaban pasien" },
            { "question": "Tanya riwayat penyakit dahulu/keluarga", "answer": "Jawaban pasien" },
            { "question": "Tanya kebiasaan/faktor risiko", "answer": "Jawaban pasien" }
          ],

          "explanation": "Tuliskan PATOFISIOLOGI lengkap dan definisi penyakit ini secara ilmiah (Medical Textbook Style). Jelaskan mekanisme kenapa gejala itu muncul. Minimal 2-3 kalimat panjang.",
          
          "treatment": [
            "Langkah 1 (Tindakan Awal/Stabilisasi)",
            "Langkah 2 (Farmakologi: Nama Obat & Golongan)",
            "Langkah 3 (Pemeriksaan Penunjang Lanjutan/Rujuk)"
          ],

          "options": ["Diagnosis Benar", "Diagnosis Banding 1", "Diagnosis Banding 2", "Diagnosis Salah"]
        },
        "correct_diagnosis": "Diagnosis Benar (Sama dengan title)"
      }
    `;

    const completion = await openai.chat.completions.create({
      messages: [{ role: "system", content: systemPrompt }],
      model: "gpt-4o-mini", 
      temperature: 0.85, // Temperatur tinggi = Lebih Kreatif/Acak
      response_format: { type: "json_object" }
    });

    const content = completion.choices[0].message.content;
    if (!content) throw new Error("Gagal generate konten AI");
    const gameData = JSON.parse(content);

    // Simpan ke database
    const { data, error } = await supabase
      .from('disease_cards')
      .insert([{
          title: gameData.title,
          difficulty: gameData.difficulty,
          correct_diagnosis: gameData.correct_diagnosis,
          scenario: gameData.scenario,
          content: gameData
      }])
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, id: data.id });

  } catch (error) {
    console.error('Error generating game:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}