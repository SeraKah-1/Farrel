import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Daftar Topik Variatif (Agar tidak melulu Jantung)
const RANDOM_TOPICS = [
  "Neurologi (Saraf, Stroke, Vertigo)",
  "Gastroenterohepatologi (Lambung, Usus, Hati)",
  "Respirologi (Paru, Asma, Pneumonia, TBC)",
  "Dermatologi (Penyakit Kulit, Infeksi, Alergi)",
  "Penyakit Tropis & Infeksi (Dengue, Malaria, Tifoid)",
  "Endokrinologi (Diabetes, Tiroid)",
  "Urologi (Ginjal, Saluran Kemih, Batu)",
  "Hematologi (Anemia, Kelainan Darah)",
  "Psikiatri (Kecemasan, Depresi, Skizofrenia)",
  "Pediatri (Penyakit Anak Umum)",
  "THT (Telinga, Hidung, Tenggorok)",
  "Mata (Katarak, Konjungtivitis, Glaukoma)"
];

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    let { topic, difficulty } = await request.json();

    // --- LOGIKA GACHA TOPIK ---
    // Jika user memilih 'Acak' atau kosong, pilih salah satu dari list di atas
    let activeTopic = topic;
    const isRandomMode = !topic || topic.toLowerCase() === 'acak' || topic.toLowerCase() === 'random';

    if (isRandomMode) {
      const randomIndex = Math.floor(Math.random() * RANDOM_TOPICS.length);
      activeTopic = RANDOM_TOPICS[randomIndex];
    }
    
    const activeDifficulty = difficulty || 'Medium';

    // --- SYSTEM PROMPT ---
    const systemPrompt = `
      Anda adalah Senior Medical Educator. Tugas: Buat simulasi kasus klinis untuk mahasiswa kedokteran.
      
      KONTEKS:
      - Topik: ${activeTopic} ${isRandomMode ? '(JANGAN buat kasus Nyeri Dada/Jantung kecuali topik eksplisit Kardiologi)' : ''}
      - Kesulitan: ${activeDifficulty}
      
      ATURAN JSON (OUTPUT HARUS JSON MURNI TANPA MARKDOWN):
      1. Field 'case_title' HARUS BERISI: "Kasus [Nama Pasien] - [Keluhan Utama]". JANGAN TULIS DIAGNOSIS DISINI.
      2. Field 'correct_diagnosis' adalah kunci jawaban rahasia.
      3. Anamnesis harus ada 6 pertanyaan (3 Relevan, 2 Noise/Sampah, 1 Jebakan).
      
      STRUKTUR JSON TARGET:
      {
        "meta": {
           "case_title": "Kasus Bpk. [Nama] - [Keluhan]", 
           "difficulty": "${activeDifficulty}"
        },
        "patient": {
           "name": "Nama Indonesia (Natural)",
           "age": "Angka Usia",
           "job": "Pekerjaan Pasien",
           "chief_complaint": "Keluhan utama singkat",
           "history_now": "Narasi RPS lengkap (2-3 kalimat)."
        },
        "anamnesis": [
           { "question": "Pertanyaan...", "answer": "Jawaban...", "type": "relevant" },
           { "question": "Pertanyaan...", "answer": "Jawaban...", "type": "relevant" },
           { "question": "Pertanyaan...", "answer": "Jawaban...", "type": "relevant" },
           { "question": "Pertanyaan...", "answer": "Jawaban...", "type": "noise" },
           { "question": "Pertanyaan...", "answer": "Jawaban...", "type": "noise" },
           { "question": "Pertanyaan...", "answer": "Jawaban...", "type": "trap" }
        ],
        "examinations": {
           "physical": {
              "vitals": { "bp": "120/80 mmHg", "hr": "80 bpm", "temp": "36.5 C", "rr": "20 x/m", "spo2": "98%" },
              "observations": ["Temuan fisik 1", "Temuan fisik 2"]
           },
           "labs": [
              { "name": "Nama Tes 1", "result": "Hasil (Abnormal)" },
              { "name": "Nama Tes 2", "result": "Hasil (Normal)" },
              { "name": "Nama Tes 3", "result": "Hasil" }
           ]
        },
        "diagnosis": {
           "correct_answer": "NAMA PENYAKIT (DIAGNOSIS PASTI)", 
           "options": [
              "Diagnosis Benar",
              "Diagnosis Banding 1",
              "Diagnosis Banding 2",
              "Diagnosis Pengecoh"
           ]
        },
        "wiki": {
           "definition": "Definisi medis lengkap.",
           "pathophysiology": "Patofisiologi ilmiah.",
           "treatment": ["Langkah 1", "Langkah 2 (Obat)", "Langkah 3"]
        }
      }
    `;

    const completion = await openai.chat.completions.create({
      messages: [{ role: "system", content: systemPrompt }],
      model: "gpt-4o-mini", // Model cepat & pintar
      temperature: 0.85,    // Kreativitas tinggi agar variatif
      response_format: { type: "json_object" }
    });

    const content = completion.choices[0].message.content;
    if (!content) throw new Error("Gagal generate konten AI");
    
    const gameData = JSON.parse(content);

    // Simpan ke database Supabase
    // Kita simpan 'correct_answer' di kolom terpisah agar aman
    const { data, error } = await supabase
      .from('disease_cards')
      .insert([{
          title: gameData.meta.case_title, // Judul Aman (Misal: Kasus Bpk Budi)
          difficulty: activeDifficulty,
          correct_diagnosis: gameData.diagnosis.correct_answer, // Jawaban Asli
          scenario: gameData, // Simpan JSON lengkap
          content: gameData   // Backup
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