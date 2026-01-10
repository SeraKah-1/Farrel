import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { createClient } from '@/utils/supabase/server'; 

// --- KONFIGURASI EDGE RUNTIME (Wajib untuk Vercel Free Tier) ---
export const runtime = 'edge'; 
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const { topic, difficulty } = await req.json();

    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    // --- PROMPT BARU: ANTI SPOILER & DIALOGUE ORIENTED ---
    const systemPrompt = `
      Kamu adalah Dokter Senior. Buat 1 kasus pasien fiktif realistis untuk simulasi medis.
      
      Format output HARUS JSON valid dengan struktur ini:
      {
        "title": "Judul Kasus (Gunakan format klinis: '[Jenis Kelamin] [Usia] dengan [Keluhan Utama]'. CONTOH: 'Wanita 25 Tahun dengan Demam Naik Turun'. PENTING: JANGAN TULIS NAMA PENYAKIT DI JUDUL!)",
        "patient": {
          "name": "Nama Pasien",
          "age": 30,
          "gender": "Laki-laki/Perempuan",
          "history": "Narasi lengkap keluhan utama pasien (Storytelling awal)."
        },
        "dialogues": [
           { "question": "Dokter: Sejak kapan Anda merasa keluhan ini?", "answer": "Pasien: ...", "type": "history" },
           { "question": "Dokter: Apakah ada gejala lain yang dirasakan?", "answer": "Pasien: ...", "type": "symptom" },
           { "question": "Dokter: Apakah ada riwayat penyakit sebelumnya?", "answer": "Pasien: ...", "type": "history" }
           // Buat minimal 5-6 pertanyaan variatif (History, Symptom, Risk Factor)
        ],
        "physical_check": ["Tensi: ...", "Suhu: ...", "Temuan fisik spesifik..."],
        "lab_results": ["Hb: ...", "Leukosit: ...", "Hasil lab penunjang..."],
        "correct_diagnosis": "Diagnosa Benar (Nama Penyakit)",
        "differential_diagnosis": ["Diagnosa Salah 1", "Diagnosa Salah 2", "Diagnosa Salah 3"],
        "explanation": "Penjelasan medis singkat kenapa diagnosa ini benar.",
        "difficulty": "${difficulty === 'random' ? 'Medium' : difficulty}"
      }
    `;

    const userPrompt = topic 
      ? `Buat kasus spesifik tentang: ${topic}. Level kesulitan: ${difficulty}.`
      : `Buat kasus penyakit dalam umum di Indonesia. Level kesulitan: ${difficulty}.`;

    const completion = await openai.chat.completions.create({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      model: "gpt-4o-mini", // Model hemat & cepat
      response_format: { type: "json_object" },
    });

    const contentStr = completion.choices[0].message.content;
    if (!contentStr) throw new Error("AI tidak memberikan respon");

    const gameData = JSON.parse(contentStr);

    // Simpan ke Database
    const supabase = await createClient(); 
    
    const { data, error } = await supabase
      .from('disease_cards')
      .insert([
        {
          title: gameData.title, // Judul sudah aman (Anti-Spoiler)
          category: topic || "Umum",
          difficulty: gameData.difficulty,
          correct_diagnosis: gameData.correct_diagnosis,
          
          // Isi content dengan history agar list di frontend lama tidak error
          content: gameData.patient.history, 
          
          // Simpan data lengkap di kolom scenario (JSONB)
          scenario: { 
            patient: gameData.patient,
            dialogues: gameData.dialogues, 
            physical_check: gameData.physical_check,
            lab_results: gameData.lab_results,
            options: [gameData.correct_diagnosis, ...gameData.differential_diagnosis].sort(() => Math.random() - 0.5),
            explanation: gameData.explanation
          }
        }
      ])
      .select()
      .single();

    if (error) {
      console.error('Supabase Error:', error);
      throw new Error(`Gagal menyimpan: ${error.message}`);
    }

    return NextResponse.json({ success: true, id: data.id });

  } catch (error: any) {
    console.error('API Error:', error);
    return NextResponse.json(
      { success: false, error: error.message }, 
      { status: 500 }
    );
  }
}