import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// DAFTAR TOPIK AGAR TIDAK MELULU JANTUNG
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
    let activeTopic = topic;
    const isRandomMode = !topic || topic.toLowerCase() === 'acak' || topic.toLowerCase() === 'random';

    if (isRandomMode) {
      const randomIndex = Math.floor(Math.random() * RANDOM_TOPICS.length);
      activeTopic = RANDOM_TOPICS[randomIndex];
    }
    
    const activeDifficulty = difficulty || 'Medium';

    const systemPrompt = `
      Anda adalah Senior Medical Educator. Tugas Anda membuat simulasi kasus klinis yang REALISTIS.
      
      KONTEKS:
      - Topik: ${activeTopic} ${isRandomMode ? '(JANGAN buat kasus Nyeri Dada/Jantung kecuali topik eksplisit Kardiologi)' : ''}
      - Kesulitan: ${activeDifficulty}
      
      OUTPUT HARUS JSON (Tanpa markdown) DENGAN STRUKTUR INI:
      {
        "title": "Nama Diagnosis Medis (Contoh: Demam Tifoid)",
        "patient": {
           "name": "Nama Indonesia (Contoh: Bpk. Budi / Ibu Siti)",
           "age": "Angka Usia",
           "job": "Pekerjaan (Relevan dengan penyakit/sosial)",
           "chief_complaint": "Keluhan Utama (Singkat)",
           "history_now": "Narasi RPS lengkap 2-3 kalimat."
        },
        "anamnesis": [
           // WAJIB ADA 6 PERTANYAAN:
           // 3 Pertanyaan Relevan (Kunci Diagnosis)
           // 2 Pertanyaan Noise/Sampah (Basa-basi/Tidak relevan)
           // 1 Pertanyaan Red Herring (Pengecoh/Menjebak ke diagnosis lain)
           { "question": "Pertanyaan...", "answer": "Jawaban pasien...", "type": "relevant" },
           { "question": "Pertanyaan...", "answer": "Jawaban pasien...", "type": "relevant" },
           { "question": "Pertanyaan...", "answer": "Jawaban pasien...", "type": "relevant" },
           { "question": "Pertanyaan...", "answer": "Jawaban pasien...", "type": "noise" },
           { "question": "Pertanyaan...", "answer": "Jawaban pasien...", "type": "noise" },
           { "question": "Pertanyaan...", "answer": "Jawaban pasien...", "type": "trap" }
        ],
        "examinations": {
           "physical": {
              "vitals": { 
                 "bp": "120/80 mmHg (sesuaikan)", 
                 "hr": "80 bpm (sesuaikan)", 
                 "temp": "36.5 C (sesuaikan)", 
                 "rr": "20 x/m", 
                 "spo2": "98%" 
              },
              "observations": [
                 "Array string temuan fisik (Inspeksi/Palpasi/Auskultasi).",
                 "Contoh: Konjungtiva anemis",
                 "Contoh: Ronkhi basah kasar di paru kanan"
              ]
           },
           "labs": [
              // Array object hasil penunjang (Lab Darah/Rontgen/EKG)
              // Campur antara yg Abnormal (Kunci) dan Normal (Pengecoh)
              { "name": "Hemoglobin", "result": "10 g/dL (Rendah)" },
              { "name": "Leukosit", "result": "15.000 /uL (Tinggi)" },
              { "name": "GDS", "result": "110 mg/dL (Normal)" }
           ]
        },
        "diagnosis": {
           "correct_answer": "Diagnosis Benar (Sama dengan title)",
           "options": [
              "Diagnosis Benar",
              "Diagnosis Banding 1 (Gejala mirip)",
              "Diagnosis Banding 2 (Gejala mirip)",
              "Diagnosis Pengecoh (Agak beda)"
           ]
        },
        "wiki": {
           "definition": "Penjelasan medis penyakit ini.",
           "pathophysiology": "Mekanisme penyakit secara ilmiah (Medical Textbook style).",
           "clinical_signs": ["Tanda khas 1", "Tanda khas 2"],
           "treatment": [
              "Tatalaksana 1 (Non-farmako)",
              "Tatalaksana 2 (Obat spesifik & Dosis)",
              "Tatalaksana 3 (Rujuk/Tindakan)"
           ]
        }
      }
    `;

    const completion = await openai.chat.completions.create({
      messages: [{ role: "system", content: systemPrompt }],
      model: "gpt-4o-mini",
      temperature: 0.85, // Kreativitas tinggi
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
          difficulty: activeDifficulty,
          correct_diagnosis: gameData.diagnosis.correct_answer,
          scenario: gameData, // Simpan JSON structure baru langsung ke scenario
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