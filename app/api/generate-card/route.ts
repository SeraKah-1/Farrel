import { openai } from '@ai-sdk/openai';
import { generateObject } from 'ai';
import { supabase } from '@/lib/supabase';
import { DiseaseCardContentSchema } from '@/lib/schemas';

// Allow this API to run for up to 60 seconds
export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    const { topic } = await req.json();

    if (!topic) {
      return new Response('Topic is required', { status: 400 });
    }

    console.log(`🤖 Generating card for: ${topic}...`);

    // 1. Panggil OpenAI
    const { object } = await generateObject({
      model: openai('gpt-4o-mini'), 
      schema: DiseaseCardContentSchema,
      prompt: `Buat materi medis lengkap dan logika simulasi game untuk penyakit: "${topic}".
      
      PENTING:
      - Gunakan Bahasa Indonesia untuk semua teks narasi.
      - Pastikan data medis akurat (range TTV dan Lab).
      - Untuk 'chief_complaint_pool', gunakan bahasa pasien awam yang natural (contoh: 'Dok, perut saya melilit').`,
    });

    console.log("✅ AI Generation Success!");

    // 2. Simpan hasil ke Supabase
    const { data, error } = await supabase
      .from('disease_cards')
      .insert({
        title: topic,
        category: 'Uncategorized',
        difficulty: 'Medium',
        status: 'published', // Langsung published biar bisa dimainkan
        content: object,
      })
      .select()
      .single();

    if (error) {
      console.error("DB Error:", error);
      throw new Error(error.message);
    }

    return Response.json({ success: true, cardId: data.id });

  } catch (error: any) {
    console.error("❌ API Error:", error);
    // Ini biar errornya kebaca di frontend sebagai JSON, bukan HTML
    return Response.json({ error: error.message }, { status: 500 });
  }
}