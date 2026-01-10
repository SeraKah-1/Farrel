'use client';

import { useEffect, useState } from 'react';
// ✅ Sekarang ini akan jalan karena folder utils sudah dipindah ke root
import { createClient } from '@/utils/supabase/client'; 
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Plus, Play, Loader2, Sparkles, Target, X, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';

export default function LobbyPage() {
  const [cases, setCases] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  
  // State untuk Modal/Popup
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [customTopic, setCustomTopic] = useState("");
  const [selectedDifficulty, setSelectedDifficulty] = useState("random");

  const supabase = createClient();
  const router = useRouter();

  useEffect(() => {
    fetchCases();
  }, []);

  async function fetchCases() {
    const { data, error } = await supabase
      .from('disease_cards')
      .select('id, title, difficulty, created_at')
      .order('created_at', { ascending: false });

    if (!error) setCases(data || []);
    setLoading(false);
  }

  // Fungsi Generate dengan Request Topik
  const handleGenerate = async () => {
    setGenerating(true);
    setIsModalOpen(false); // Tutup modal saat loading mulai

    const toastId = toast.loading("Sedang meracik kasus medis...");

    try {
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
        toast.success("Kasus siap! Silakan mulai.");
        fetchCases();
        router.push(`/play/${data.id}`);
        // Reset form
        setCustomTopic("");
        setSelectedDifficulty("random");
      } else {
        throw new Error(data.error);
      }
    } catch (err) {
      toast.dismiss(toastId);
      toast.error("Gagal membuat kasus. Coba lagi.");
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8">
      <div className="max-w-5xl mx-auto space-y-8">
        
        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Lobby Praktek</h1>
            <p className="text-slate-500">Pilih pasien untuk memulai diagnosa.</p>
          </div>
          
          <Button onClick={() => setIsModalOpen(true)} size="lg" className="bg-blue-600 hover:bg-blue-700 shadow-md">
            <Plus className="mr-2 h-5 w-5" /> Terima Pasien Baru
          </Button>
        </div>

        {/* --- MODAL POPUP REQUEST KASUS --- */}
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
              
              <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                <h3 className="font-bold text-lg text-slate-800">Buat Skenario Pasien</h3>
                <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-red-500 transition-colors">
                  <X size={20} />
                </button>
              </div>

              <div className="p-6 space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">Topik / Penyakit (Opsional)</label>
                  <input 
                    type="text" 
                    placeholder="Contoh: Jantung, DBD (Kosongkan jika acak)"
                    className="w-full p-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                    value={customTopic}
                    onChange={(e) => setCustomTopic(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">Tingkat Kesulitan</label>
                  <div className="grid grid-cols-4 gap-2">
                    {['random', 'Easy', 'Medium', 'Hard'].map((diff) => (
                      <button
                        key={diff}
                        onClick={() => setSelectedDifficulty(diff)}
                        className={`text-sm py-2 px-1 rounded-md border transition-all ${
                          selectedDifficulty === diff 
                            ? 'bg-blue-100 border-blue-500 text-blue-700 font-bold' 
                            : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        {diff === 'random' ? 'Acak' : diff}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">
                <Button variant="ghost" onClick={() => setIsModalOpen(false)}>Batal</Button>
                <Button onClick={handleGenerate} disabled={generating} className="bg-slate-900 text-white hover:bg-slate-800">
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

        {/* --- LIST KASUS --- */}
        {loading ? (
          <div className="text-center py-20 text-slate-400">Loading data...</div>
        ) : cases.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-xl border border-dashed border-slate-300">
            <AlertCircle className="h-10 w-10 text-slate-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-slate-900">Belum ada kasus</h3>
            <p className="text-slate-500 mb-6">Klik tombol "Terima Pasien Baru" untuk mulai.</p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {cases.map((game) => (
              <Card key={game.id} className="hover:border-blue-400 hover:shadow-md transition-all cursor-pointer group" onClick={() => router.push(`/play/${game.id}`)}>
                <CardHeader>
                  <CardTitle className="line-clamp-1 group-hover:text-blue-600 transition-colors text-lg">
                    {game.title}
                  </CardTitle>
                  <CardDescription>
                    Level: <span className={`font-bold ${
                      game.difficulty === 'Hard' ? 'text-red-500' : 
                      game.difficulty === 'Medium' ? 'text-yellow-600' : 'text-green-600'
                    }`}>{game.difficulty}</span>
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