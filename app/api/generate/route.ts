import { NextResponse } from 'next/server';
import OpenAI from 'openai';
// ✅ Import Correct: Mundur 3 langkah ke root utils
import { createClient } from '@/utils/supabase/server'; 

// Konfigurasi durasi timeout (Penting untuk Vercel supaya tidak putus saat AI mikir)
export const maxDuration = 60; 
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const { topic, difficulty } = await req.json();

    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    // Prompt Engineering untuk Dokter AI
    const systemPrompt = `
      Kamu adalah Dokter Senior yang ahli membuat studi kasus medis untuk mahasiswa kedokteran.
      Tugasmu adalah membuat 1 kasus pasien fiktif yang realistis.
      
      Format output HARUS JSON valid dengan struktur persis seperti ini:
      {
        "title": "Judul Kasus (Singkat & Menarik)",
        "patient": {
          "name": "Nama Pasien",
          "age": 30,
          "gender": "Laki-laki/Perempuan",
          "history": "Riwayat penyakit singkat (1-2 kalimat)"
        },
        "symptoms": ["Gejala 1", "Gejala 2", "Gejala 3"],
        "lab_results": ["Tensi: 120/80", "Suhu: 38C", "Leukosit: Tinggi"],
        "correct_diagnosis": "Nama Penyakit (Diagnosa Benar)",
        "differential_diagnosis": ["Penyakit Salah 1", "Penyakit Salah 2", "Penyakit Salah 3"],
        "explanation": "Penjelasan medis singkat kenapa diagnosa ini benar.",
        "difficulty": "${difficulty === 'random' ? 'Medium' : difficulty}"
      }
    `;

    const userPrompt = topic 
      ? `Buat kasus spesifik tentang penyakit: ${topic}. Level kesulitan: ${difficulty}.`
      : `Buat kasus penyakit penyakit umum di Indonesia (misal: Tropis, Infeksi, Metabolik). Level kesulitan: ${difficulty}.`;

    const completion = await openai.chat.completions.create({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      model: "gpt-4o-mini", // Model hemat & cepat
      response_format: { type: "json_object" },
    });

    const content = completion.choices[0].message.content;
    if (!content) throw new Error("AI tidak memberikan respon");

    const gameData = JSON.parse(content);

    // Simpan ke Database Supabase
    // 👇 PENTING: Gunakan await untuk Next.js versi terbaru
    const supabase = await createClient(); 
    
    const { data, error } = await supabase
      .from('disease_cards')
      .insert([
        {
          title: gameData.title,
          difficulty: gameData.difficulty,
          correct_diagnosis: gameData.correct_diagnosis,
          scenario: { // Simpan sisa data sebagai JSONB
            patient: gameData.patient,
            symptoms: gameData.symptoms,
            lab_results: gameData.lab_results,
            // Gabungkan opsi benar + salah, lalu acak
            options: [gameData.correct_diagnosis, ...gameData.differential_diagnosis].sort(() => Math.random() - 0.5),
            explanation: gameData.explanation
          }
        }
      ])
      .select()
      .single();

    if (error) {
      console.error('Supabase Error:', error);
      throw new Error("Gagal menyimpan ke database");
    }

    return NextResponse.json({ success: true, id: data.id });

  } catch (error: any) {
    console.error('API Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || "Internal Server Error" }, 
      { status: 500 }
    );
  }
}