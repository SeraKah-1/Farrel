import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { createClient } from '@/utils/supabase/server'; 

// --- PENTING: EDGE RUNTIME (Supaya Vercel tidak timeout) ---
export const runtime = 'edge'; 
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const { topic, difficulty } = await req.json();

    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    // --- PROMPT BARU: MEMAKSA AI MEMBUAT DIALOG ---
    const systemPrompt = `
      Kamu adalah Dokter Senior. Buat 1 kasus pasien fiktif realistis untuk simulasi medis.
      
      Format output HARUS JSON valid dengan struktur ini:
      {
        "title": "Judul Kasus (Singkat)",
        "patient": {
          "name": "Nama Pasien",
          "age": 30,
          "gender": "Laki-laki/Perempuan",
          "history": "Narasi lengkap keluhan utama pasien (Storytelling awal)."
        },
        "dialogues": [
           { "question": "Dokter: Sejak kapan Anda merasa demam?", "answer": "Pasien: Sudah 3 hari dok, naik turun.", "type": "history" },
           { "question": "Dokter: Apa ada keluhan nyeri di tempat lain?", "answer": "Pasien: Ada dok, nyeri sendi rasanya linu semua.", "type": "symptom" },
           { "question": "Dokter: Apakah Anda baru bepergian?", "answer": "Pasien: Tidak dok, saya di rumah saja.", "type": "risk" },
           { "question": "Dokter: Ada riwayat alergi obat?", "answer": "Pasien: Tidak ada dok.", "type": "history" }
           // Buat minimal 5-6 pertanyaan variatif
        ],
        "physical_check": ["Suhu: 38.5C", "Tensi: 110/70 mmHg", "Nadi: 98x/m", "Kulit: Bintik merah (Petechiae) di lengan"],
        "lab_results": ["Trombosit: 85.000 (Rendah)", "Leukosit: 3.200 (Rendah)", "Hematokrit: 45% (Meningkat)"],
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
      model: "gpt-4o-mini", // Model cepat & hemat
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
          title: gameData.title,
          category: topic || "Umum",
          difficulty: gameData.difficulty,
          correct_diagnosis: gameData.correct_diagnosis,
          // Isi content dengan history agar list di frontend tidak error
          content: gameData.patient.history, 
          // Simpan data lengkap di kolom scenario
          scenario: { 
            patient: gameData.patient,
            dialogues: gameData.dialogues, // <-- INI KUNCI INTERAKSI
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