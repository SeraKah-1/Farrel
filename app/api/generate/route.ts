import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import OpenAI from 'openai'; 

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// --- DAFTAR TOPIK AGAR TIDAK MELULU JANTUNG ---
const MEDICAL_TOPICS = [
  "Neurology (Saraf - e.g., Stroke, Meningitis, Vertigo)",
  "Gastroenterology (Pencernaan - e.g., GERD, Hepatitis, Appendicitis)",
  "Dermatology (Kulit - e.g., Herpes Zoster, Psoriasis, Steven-Johnson)",
  "Respirology (Paru - e.g., Pneumonia, TB, Asthma, COPD)",
  "Infectious Disease (Infeksi Tropis - e.g., Dengue, Malaria, Typhoid)",
  "Endocrinology (Hormon - e.g., Diabetes Ketoacidosis, Thyroid Storm)",
  "Hematology (Darah - e.g., Anemia, Leukemia, DVT)",
  "Nephrology (Ginjal - e.g., Gagal Ginjal Akut, Batu Saluran Kemih)",
  "Rheumatology (Autoimun - e.g., Lupus, Gout, Arthritis)",
  "Emergency Trauma (Kecelakaan - e.g., Pneumothorax, Fraktur)",
  "Pediatrics (Anak - e.g., Kejang Demam, Campak)",
  "Psychiatry (Jiwa - e.g., Skizofrenia, Bipolar, Panic Attack)"
];

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { topic, difficulty } = await request.json(); 

    // LOGIKA RANDOMIZER:
    // Jika user tidak minta topik spesifik, kita pilih acak dari daftar di atas.
    const selectedTopic = topic && topic !== 'Random' 
      ? topic 
      : MEDICAL_TOPICS[Math.floor(Math.random() * MEDICAL_TOPICS.length)];

    const selectedDifficulty = difficulty || 'Medium';

    const systemPrompt = `
      Anda adalah Profesor Kedokteran Senior. Tugas Anda adalah membuat simulasi kasus klinis yang UNIK dan MENANTANG.
      
      TARGET GENERASI:
      - Topik Spesifik: ${selectedTopic}
      - Tingkat Kesulitan: ${selectedDifficulty}
      - HINDARI KLISE: Jangan membuat kasus "Nyeri Dada/Jantung" kecuali topiknya spesifik Cardiology. Cobalah variasi pasien (muda/tua/perempuan/laki-laki).

      OUTPUT JSON FORMAT (Strict JSON, No Markdown):
      {
        "title": "Diagnosis Medis (Nama Penyakit)",
        "difficulty": "${selectedDifficulty}",
        "scenario": {
          "patient": {
            "history": "Narasi keluhan utama (Chief Complaint) yang detail. Sertakan usia, gender, pekerjaan, dan onset gejala."
          },
          "symptoms": ["Gejala 1", "Gejala 2", "Gejala 3 (yang agak mengecoh)"],
          "physical_check": [
            "Tanda Vital: Tensi, Nadi, Suhu, RR (buat realistis sesuai penyakit)",
            "Kepala/Leher: ...",
            "Thorax/Abdomen: ...",
            "Ekstremitas: ..."
          ],
          "lab_results": [
             "Darah Lengkap: ...",
             "Kimia Darah/Urinalisa: ...",
             "Pemeriksaan Penunjang Kunci (Rontgen/CT/EKG): ..."
          ],
          "dialogues": [
            { "question": "Dokter: [Tanya Riwayat Penyakit Sekarang]", "answer": "Pasien: [Jawaban keluhan]" },
            { "question": "Dokter: [Tanya Faktor Risiko/Kebiasaan]", "answer": "Pasien: [Jawaban relevan]" },
            { "question": "Dokter: [Tanya Riwayat Keluarga/Alergi]", "answer": "Pasien: [Jawaban]" },
            { "question": "Dokter: [Pertanyaan Jebakan/Kurang Relevan]", "answer": "Pasien: [Jawaban tidak tahu/ragu]" }
          ],
          "explanation": "PENJELASAN MENDALAM (Patofisiologi): Jelaskan mekanisme penyakit ini dari tingkat selular/organ. Kenapa gejalanya muncul? Apa etiologinya? (Min. 3 kalimat panjang).",
          "treatment": [
            "Tatalaksana Awal (Stabilisasi/IGD)",
            "Farmakoterapi Spesifik (Nama Obat + Golongan)",
            "Tindakan Non-Farmakologis / Operatif",
            "Edukasi Pasien / Rencana Pulang"
          ],
          "options": ["Diagnosa Benar", "Diagnosa Banding 1", "Diagnosa Banding 2", "Diagnosa Salah"]
        },
        "correct_diagnosis": "Diagnosa Benar (Sama dengan title)"
      }
    `;

    const completion = await openai.chat.completions.create({
      messages: [{ role: "system", content: systemPrompt }],
      model: "gpt-4o-mini", // Model cepat & pintar
      temperature: 0.85, // AGAK TINGGI supaya hasilnya lebih kreatif/variatif
      response_format: { type: "json_object" }
    });

    const content = completion.choices[0].message.content;
    if (!content) throw new Error("Gagal generate konten AI");

    const gameData = JSON.parse(content);

    // Simpan ke Supabase
    const { data, error } = await supabase
      .from('disease_cards')
      .insert([
        {
          title: gameData.title,
          difficulty: gameData.difficulty,
          correct_diagnosis: gameData.correct_diagnosis,
          scenario: gameData.scenario,
          content: gameData 
        }
      ])
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, id: data.id });

  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}