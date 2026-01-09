import { createClient } from '@supabase/supabase-js';
import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ArrowLeft, PlayCircle, Activity } from 'lucide-react';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export const revalidate = 0;

export default async function LevelSelectPage() {
  const { data: cards } = await supabase
    .from('disease_cards')
    .select('*')
    .eq('status', 'published')
    .order('created_at', { ascending: false });

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-5xl mx-auto space-y-8">
        
        {/* Header */}
        <div className="flex items-center gap-4">
          <Link href="/">
            <Button variant="ghost" size="icon"><ArrowLeft /></Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Daftar Kasus Masuk</h1>
            <p className="text-slate-500">Pilih pasien untuk memulai investigasi medis.</p>
          </div>
        </div>

        {/* Grid Level */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {cards?.length === 0 ? (
            <div className="col-span-3 text-center py-20 bg-white rounded-xl border border-dashed border-slate-300">
              <Activity className="mx-auto h-10 w-10 text-slate-400 mb-2" />
              <p className="text-slate-500">Belum ada pasien. Generate kasus baru di Admin.</p>
            </div>
          ) : (
            cards?.map((card) => (
              <Card key={card.id} className="hover:shadow-xl transition-all duration-300 border-slate-200 cursor-pointer group flex flex-col h-full">
                <CardHeader className="pb-3">
                  <div className="flex justify-between items-start mb-3">
                    <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 font-bold">
                      {card.difficulty || 'Hard'}
                    </Badge>
                    <Badge variant="secondary" className="bg-slate-100 text-slate-600">
                      {card.category || 'Kasus'}
                    </Badge>
                  </div>
                  <CardTitle className="text-xl group-hover:text-blue-600 transition-colors">
                    {card.title}
                  </CardTitle>
                </CardHeader>
                
                <CardContent className="flex-1">
                  <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                    <p className="text-xs text-slate-400 uppercase font-bold mb-1">Keluhan Utama:</p>
                    {/* PERBAIKAN DI SINI: Menggunakan .chief_complaint, bukan array [0] */}
                    <p className="text-sm text-slate-700 font-medium italic">
                      "{card.content.simulation.chief_complaint}"
                    </p>
                  </div>
                </CardContent>

                <CardFooter className="pt-0">
                  <Link href={`/play/${card.id}`} className="w-full">
                    <Button className="w-full gap-2 bg-slate-900 hover:bg-blue-600 transition-colors">
                      <PlayCircle size={16} /> Tangani Sekarang
                    </Button>
                  </Link>
                </CardFooter>
              </Card>
            ))
          )}
        </div>
      </div>
    </div>
  );
}