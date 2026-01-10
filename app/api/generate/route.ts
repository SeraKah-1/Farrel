import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { createClient } from '@/utils/supabase/server'; 

// GUNAKAN EDGE RUNTIME BIAR TIDAK TIMEOUT DI VERCEL
export const runtime = 'edge'; 
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const { topic, difficulty } = await req.json();

    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    // 1. Prompt Engineering System
    const systemPrompt = `
      Kamu adalah Dokter Senior. Buat 1 kasus pasien fiktif realistis untuk mahasiswa kedokteran.
      
      Format output HARUS JSON valid:
      {
        "title": "Judul Kasus (Singkat)",
        "patient": {
          "name": "Nama",
          "age": 30,
          "gender": "Laki-laki/Perempuan",
          "history": "Narasi lengkap keluhan pasien dan riwayat penyakit (Ini akan jadi soal utama)."
        },
        "symptoms": ["Gejala 1", "Gejala 2"],
        "lab_results": ["Tensi: 120/80", "Leukosit: 10.000"],
        "correct_diagnosis": "Diagnosa Benar",
        "differential_diagnosis": ["Diagnosa Salah 1", "Diagnosa Salah 2"],
        "explanation": "Penjelasan medis singkat.",
        "difficulty": "${difficulty === 'random' ? 'Medium' : difficulty}"
      }
    `;

    const userPrompt = topic 
      ? `Kasus penyakit: ${topic}. Kesulitan: ${difficulty}.`
      : `Kasus penyakit umum di Indonesia. Kesulitan: ${difficulty}.`;

    const completion = await openai.chat.completions.create({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      model: "gpt-4o-mini",
      response_format: { type: "json_object" },
    });

    const contentStr = completion.choices[0].message.content;
    if (!contentStr) throw new Error("AI tidak memberikan respon");

    const gameData = JSON.parse(contentStr);

    // 2. Simpan ke Database
    const supabase = await createClient(); 
    
    const { data, error } = await supabase
      .from('disease_cards')
      .insert([
        {
          title: gameData.title,
          category: topic || "Umum",
          difficulty: gameData.difficulty,
          correct_diagnosis: gameData.correct_diagnosis,
          
          // --- PERBAIKAN DISINI ---
          // Kita isi kolom 'content' dengan narasi history pasien
          // Supaya Frontend tidak error saat mau menampilkan soal
          content: gameData.patient.history, 
          // ------------------------

          scenario: { 
            patient: gameData.patient,
            symptoms: gameData.symptoms,
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