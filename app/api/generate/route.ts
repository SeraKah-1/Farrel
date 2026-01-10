import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { createClient } from '@/utils/supabase/server'; 

// --- KONFIGURASI EDGE RUNTIME ---
// Penting: Gunakan 'edge' agar tidak timeout di akun Vercel gratis
export const runtime = 'edge'; 
export const dynamic = 'force-dynamic';
// --------------------------------

export async function POST(req: Request) {
  try {
    // Ambil input dari user
    const { topic, difficulty } = await req.json();

    // Inisialisasi OpenAI
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    // 1. Prompt Engineering System (Otak Dokter)
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

    // 2. Prompt User (Topik Spesifik)
    const userPrompt = topic 
      ? `Buat kasus spesifik tentang penyakit: ${topic}. Level kesulitan: ${difficulty}.`
      : `Buat kasus penyakit penyakit umum di Indonesia (misal: Tropis, Infeksi, Metabolik). Level kesulitan: ${difficulty}.`;

    // 3. Request ke OpenAI
    const completion = await openai.chat.completions.create({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      model: "gpt-4o-mini", // Model hemat & cepat
      response_format: { type: "json_object" }, // Memaksa output JSON rapi
    });

    const content = completion.choices[0].message.content;
    if (!content) throw new Error("AI tidak memberikan respon");

    // 4. Parsing Data JSON dari AI
    const gameData = JSON.parse(content);

    // 5. Simpan ke Database Supabase
    const supabase = await createClient(); 
    
    const { data, error } = await supabase
      .from('disease_cards')
      .insert([
        {
          title: gameData.title,
          
          // --- FIX ERROR DATABASE DI SINI ---
          // Kita isi category dengan input topic, atau default 'Umum' kalau kosong
          category: topic || "Umum", 
          // ----------------------------------

          difficulty: gameData.difficulty,
          correct_diagnosis: gameData.correct_diagnosis,
          
          // Data detail masuk ke kolom JSONB bernama 'scenario'
          scenario: { 
            patient: gameData.patient,
            symptoms: gameData.symptoms,
            lab_results: gameData.lab_results,
            // Acak urutan jawaban (Benar + Salah) biar tidak ketebak
            options: [gameData.correct_diagnosis, ...gameData.differential_diagnosis].sort(() => Math.random() - 0.5),
            explanation: gameData.explanation
          }
        }
      ])
      .select()
      .single();

    // Cek jika Supabase error
    if (error) {
      console.error('Supabase Error:', error);
      throw new Error(`Gagal menyimpan ke database: ${error.message}`);
    }

    // Sukses! Kembalikan ID kasus ke frontend
    return NextResponse.json({ success: true, id: data.id });

  } catch (error: any) {
    console.error('API Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || "Internal Server Error" }, 
      { status: 500 }
    );
  }
}