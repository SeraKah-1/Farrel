'use client';

import { useEffect, useState } from 'react';
// ✅ Import yang sudah diperbaiki (Mundur 2 folder untuk cari utils di root)
import { createClient } from '@/utils/supabase/client';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Plus, Play, Loader2, Sparkles, Target, X, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';

export default function LobbyPage() {
  // --- STATE ---
  const [cases, setCases] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  
  // State untuk Popup (Modal) Request Kasus
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [customTopic, setCustomTopic] = useState("");
  const [selectedDifficulty, setSelectedDifficulty] = useState("random");

  const supabase = createClient();
  const router = useRouter();

  // --- EFFECT ---
  useEffect(() => {
    fetchCases();
  }, []);

  // --- FUNCTIONS ---
  async function fetchCases() {
    const { data, error } = await supabase
      .from('disease_cards')
      .select('id, title, difficulty, created_at')
      .order('created_at', { ascending: false });

    if (!error) setCases(data || []);
    setLoading(false);
  }

  const handleGenerate = async () => {
    setGenerating(true);
    setIsModalOpen(false); // Tutup modal biar rapi
    
    const toastId = toast.loading("Sedang menghubungi AI Dokter...");

    try {
      // Kirim request ke API dengan data Topik & Difficulty
      const res = await fetch('/api/generate', { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          topic: customTopic, 
          difficulty: selectedDifficulty 
        })
      });
      
      const data = await res.json();
      
      if (data.success) {
        toast.dismiss(toastId);
        toast.success("Pasien baru siap diperiksa!");
        
        // Refresh list kasus
        fetchCases();
        
        // Langsung arahkan user ke halaman main
        router.push(`/play/${data.id}`);
        
        // Reset form modal
        setCustomTopic("");
        setSelectedDifficulty("random");
      } else {
        throw new Error(data.error || "Gagal membuat kasus");
      }
    } catch (err) {
      console.error(err);
      toast.dismiss(toastId);
      toast.error("Gagal membuat kasus. Coba lagi nanti.");
    } finally {
      setGenerating(false);
    }
  };

  // --- RENDER ---
  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8">
      <div className="max-w-5xl mx-auto space-y-8">
        
        {/* HEADER */}
        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Lobby Praktek</h1>
            <p className="text-slate-500">Pilih pasien untuk memulai diagnosa hari ini.</p>
          </div>
          
          {/* Tombol Buka Modal */}
          <Button 
            onClick={() => setIsModalOpen(true)} 
            size="lg" 
            className="bg-blue-600 hover:bg-blue-700 shadow-md transition-all"
          >
            <Plus className="mr-2 h-5 w-5" /> Terima Pasien Baru
          </Button>
        </div>

        {/* --- MODAL POPUP (REQUEST KASUS) --- */}
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden transform transition-all scale-100">
              
              {/* Header Modal */}
              <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                <h3 className="font-bold text-lg text-slate-800">Buat Skenario Pasien</h3>
                <button 
                  onClick={() => setIsModalOpen(false)} 
                  className="text-slate-400 hover:text-red-500 transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Body Modal */}
              <div className="p-6 space-y-5">
                {/* Input Topik */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">Keluhan / Penyakit (Opsional)</label>
                  <input 
                    type="text" 
                    placeholder="Contoh: Demam Berdarah, Jantung..."
                    className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm transition-all"
                    value={customTopic}
                    onChange={(e) => setCustomTopic(e.target.value)}
                  />
                  <p className="text-xs text-slate-400">Biarkan kosong jika ingin penyakit acak.</p>
                </div>

                {/* Input Difficulty */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">Tingkat Kesulitan</label>
                  <div className="grid grid-cols-4 gap-2">
                    {['random', 'Easy', 'Medium', 'Hard'].map((diff) => (
                      <button
                        key={diff}
                        onClick={() => setSelectedDifficulty(diff)}
                        className={`text-sm py-2 px-1 rounded-lg border transition-all ${
                          selectedDifficulty === diff 
                            ? 'bg-blue-50 border-blue-500 text-blue-700 font-bold ring-1 ring-blue-500' 
                            : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-300'
                        }`}
                      >
                        {diff === 'random' ? 'Acak' : diff}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Footer Modal */}
              <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">
                <Button variant="ghost" onClick={() => setIsModalOpen(false)}>
                  Batal
                </Button>
                <Button 
                  onClick={handleGenerate} 
                  disabled={generating} 
                  className="bg-slate-900 text-white hover:bg-slate-800 min-w-[140px]"
                >
                  {generating ? (
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Meracik...</>
                  ) : customTopic ? (
                    <><Target className="mr-2 h-4 w-4" /> Request Spesifik</>
                  ) : (
                    <><Sparkles className="mr-2 h-4 w-4" /> Surprise Me</>
                  )}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* --- LIST KASUS YANG SUDAH ADA --- */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400 gap-4">
             <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
             <p>Mengambil berkas pasien...</p>
          </div>
        ) : cases.length === 0 ? (
          <div className="text-center py-24 bg-white rounded-xl border-2 border-dashed border-slate-200">
            <div className="bg-slate-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="h-8 w-8 text-slate-400" />
            </div>
            <h3 className="text-xl font-semibold text-slate-900">Belum ada kasus</h3>
            <p className="text-slate-500 mt-2 mb-6 max-w-sm mx-auto">
              Klinik sedang sepi. Klik tombol <strong>"Terima Pasien Baru"</strong> di pojok kanan atas untuk mulai bermain.
            </p>
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {cases.map((game) => (
              <Card 
                key={game.id} 
                className="hover:border-blue-400 hover:shadow-lg transition-all duration-300 cursor-pointer group relative overflow-hidden" 
                onClick={() => router.push(`/play/${game.id}`)}
              >
                <div className="absolute top-0 left-0 w-1 h-full bg-blue-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                
                <CardHeader className="pb-3">
                  <div className="flex justify-between items-start gap-2">
                    <CardTitle className="text-lg leading-snug group-hover:text-blue-700 transition-colors">
                      {game.title || "Kasus Tanpa Nama"}
                    </CardTitle>
                  </div>
                  <CardDescription className="flex items-center gap-2 mt-2">
                    <span className={`text-xs px-2 py-1 rounded-full font-medium border ${
                      game.difficulty === 'Hard' ? 'bg-red-50 text-red-600 border-red-200' : 
                      game.difficulty === 'Medium' ? 'bg-yellow-50 text-yellow-600 border-yellow-200' : 
                      'bg-green-50 text-green-600 border-green-200'
                    }`}>
                      {game.difficulty || "Normal"}
                    </span>
                    <span className="text-xs text-slate-400">• {new Date(game.created_at).toLocaleDateString('id-ID')}</span>
                  </CardDescription>
                </CardHeader>
                
                <CardFooter className="pt-0">
                  <Link href={`/play/${game.id}`} className="w-full">
                    <Button variant="secondary" className="w-full bg-slate-100 hover:bg-blue-600 hover:text-white transition-colors">
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