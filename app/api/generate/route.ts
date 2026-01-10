import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { createClient } from '@/utils/supabase/server';

export const maxDuration = 60; 
export const dynamic = 'force-dynamic';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(req: Request) {
  try {
    const supabase = createClient();
    
    // 1. TERIMA DATA REQUEST DARI FRONTEND
    const body = await req.json().catch(() => ({}));
    const { topic, difficulty } = body; 

    // 2. ATUR LOGIKA PROMPT
    let topicInstruction = "Pilih penyakit secara ACAK (Random) dari kategori umum atau langka.";
    
    if (topic && topic.trim() !== "") {
      topicInstruction = `PENTING: Kasus INI HARUS berkaitan dengan topik/penyakit: "${topic}".`;
    }

    let difficultyInstruction = "Pilih tingkat kesulitan secara ACAK (Easy/Medium/Hard).";
    if (difficulty && difficulty !== "random") {
      difficultyInstruction = `Tingkat kesulitan HARUS: "${difficulty}".`;
    }

    // 3. SUSUN PROMPT
    const prompt = `
      Bertindaklah sebagai Senior Dokter dosen kedokteran.
      Tugasmu: Buat 1 kasus medis untuk simulasi diagnosa.
      
      INSTRUKSI KHUSUS:
      - ${topicInstruction}
      - ${difficultyInstruction}

      ATURAN JUDUL (ANTI SPOILER):
      - Field "title" JANGAN PERNAH menulis nama penyakitnya!
      - "title" HARUS berupa Keluhan Utama yang dramatis. (Contoh: "Nyeri Dada Menusuk", bukan "Serangan Jantung").

      Respon HARUS dalam format JSON murni:
      {
        "title": "String (Keluhan Utama)",
        "description": "String (Deskripsi awal pasien)",
        "difficulty": "String (Easy/Medium/Hard)",
        "category": "String (Kategori Sistem Organ)",
        "diagnosis": "String (Nama Penyakit - Kunci Jawaban)",
        "explanation": "String (Penjelasan medis singkat)",
        "patient_profile": {
          "name": "String",
          "age": Number,
          "gender": "String",
          "occupation": "String"
        },
        "initial_chat": "String (Chat pertama pasien)"
      }
    `;

    // 4. PANGGIL AI
    const completion = await openai.chat.completions.create({
      messages: [{ role: "system", content: prompt }],
      model: "gpt-4o-mini",
      response_format: { type: "json_object" },
      temperature: 0.9, 
    });

    const content = completion.choices[0].message.content;
    if (!content) throw new Error("AI tidak menjawab");
    const gameData = JSON.parse(content);

    // 5. SIMPAN KE DATABASE
    const { data, error } = await supabase
      .from('disease_cards')
      .insert([{
        title: gameData.title,
        description: gameData.description,
        difficulty: gameData.difficulty,
        category: gameData.category,
        correct_diagnosis: gameData.diagnosis,
        explanation: gameData.explanation,
        patient_profile: gameData.patient_profile,
        initial_chat: gameData.initial_chat,
        is_ai_generated: true,
      }])
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, id: data.id });

  } catch (error: any) {
    console.error('Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
