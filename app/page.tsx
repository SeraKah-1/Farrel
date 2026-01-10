'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Plus, Play, Loader2, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';

export default function LobbyPage() {
  const [cases, setCases] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const supabase = createClient();
  const router = useRouter();

  // 1. Ambil daftar kasus yang sudah ada di Database
  useEffect(() => {
    fetchCases();
  }, []);

  async function fetchCases() {
    const { data, error } = await supabase
      .from('disease_cards')
      .select('id, title, difficulty, created_at')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching cases:', error);
    } else {
      setCases(data || []);
    }
    setLoading(false);
  }

  // 2. Fungsi untuk Generate Kasus Baru pakai AI
  const handleGenerate = async () => {
    setGenerating(true);
    toast.info("Sedang menghubungi AI Dokter... (Bisa memakan waktu 10-20 detik)");

    try {
      const res = await fetch('/api/generate', { method: 'POST' });
      
      if (!res.ok) throw new Error('Gagal generate');

      const data = await res.json();
      
      if (data.success) {
        toast.success("Kasus baru berhasil dibuat!");
        // Refresh daftar kasus
        fetchCases();
        // Opsional: Langsung masuk ke gamenya
        router.push(`/play/${data.id}`);
      } else {
        throw new Error(data.error || "Gagal membuat kasus");
      }
    } catch (err) {
      console.error(err);
      toast.error("Gagal membuat kasus. Pastikan API Key & Koneksi aman.");
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 p-8">
      <div className="max-w-4xl mx-auto space-y-8">
        
        {/* Header Lobby */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Daftar Kasus Pasien</h1>
            <p className="text-slate-500">Pilih pasien untuk memulai diagnosa atau terima pasien baru.</p>
          </div>
          
          {/* --- INI TOMBOL GENERATE YANG KAMU CARI --- */}
          <Button 
            onClick={handleGenerate} 
            disabled={generating} 
            size="lg" 
            className="shadow-lg hover:shadow-xl transition-all"
          >
            {generating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Sedang Membuat...
              </>
            ) : (
              <>
                <Plus className="mr-2 h-5 w-5" /> Terima Pasien Baru (AI)
              </>
            )}
          </Button>
        </div>

        {/* List Kasus */}
        {loading ? (
          <div className="text-center py-20 text-slate-400">Loading data...</div>
        ) : cases.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-xl border border-dashed border-slate-300">
            <AlertCircle className="h-10 w-10 text-slate-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-slate-900">Belum ada kasus</h3>
            <p className="text-slate-500 mb-6">Klik tombol "Terima Pasien Baru" di pojok kanan atas.</p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {cases.map((game) => (
              <Card key={game.id} className="hover:border-blue-400 hover:shadow-md transition-all cursor-pointer group" onClick={() => router.push(`/play/${game.id}`)}>
                <CardHeader>
                  <CardTitle className="line-clamp-1 group-hover:text-blue-600 transition-colors">
                    {game.title || "Kasus Misterius"}
                  </CardTitle>
                  <CardDescription>
                    Tingkat Kesulitan: <span className="font-medium text-slate-700">{game.difficulty || "Normal"}</span>
                  </CardDescription>
                </CardHeader>
                <CardFooter>
                  <Link href={`/play/${game.id}`} className="w-full">
                    <Button variant="secondary" className="w-full group-hover:bg-blue-50 group-hover:text-blue-600">
                      <Play className="mr-2 h-4 w-4" /> Mulai Diagnosa
                    </Button>
                  </Link>
                </CardFooter>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
