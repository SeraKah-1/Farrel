'use client';

import { useEffect, useState, use } from 'react';
import { createClient } from '@/utils/supabase/client'; 
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { 
  Activity, TestTube, MessageCircle, 
  Stethoscope, BookOpen, CheckCircle, Eye, User, AlertTriangle
} from 'lucide-react';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import useSound from 'use-sound';

// Tipe Data untuk TypeScript agar tidak error merah
interface GameData {
  displayTitle: string;
  patient: { name: string; age: string; job: string; history: string };
  anamnesis: { question: string; answer: string; type?: string }[];
  physical: { vitals: Record<string, string>; observations: string[] };
  labs: { name: string; result: string }[];
  diagnosis: { correct: string; options: string[] };
  wiki: { definition: string; pathophysiology: string; treatment: string[] };
}

export default function GameRoom({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const id = resolvedParams.id;
  const router = useRouter();
  const supabase = createClient();

  // --- AUDIO EFFECTS ---
  // Pastikan file audio ada di folder public/sounds/ atau hapus bagian ini jika belum ada
  const [playClick] = useSound('/sounds/click.mp3', { volume: 0.5 });
  const [playCorrect] = useSound('/sounds/correct.mp3', { volume: 0.5 });
  const [playWrong] = useSound('/sounds/wrong.mp3', { volume: 0.5 });
  const [playFlatline] = useSound('/sounds/flatline.mp3', { volume: 0.4 });

  // --- STATES ---
  const [gameData, setGameData] = useState<GameData | null>(null);
  const [loading, setLoading] = useState(true);
  const [energy, setEnergy] = useState(100); 
  const [logs, setLogs] = useState<{sender: string, text: string, type: 'info'|'chat'|'alert'|'success'}[]>([]);
  const [gameState, setGameState] = useState<'playing' | 'won' | 'lost'>('playing');

  // Tracking Tombol yang sudah diklik
  const [askedQuestions, setAskedQuestions] = useState<number[]>([]); 
  const [revealedPhysical, setRevealedPhysical] = useState(false);
  const [revealedLabs, setRevealedLabs] = useState(false);

  // Biaya AP (Action Points)
  const COSTS = { ASK: 10, PHYSICAL: 15, LABS: 40 };

  // --- FETCH DATA ---
  useEffect(() => {
    async function fetchGame() {
      // Delay sedikit biar transisi halus
      await new Promise(r => setTimeout(r, 500)); 
      
      const { data } = await supabase.from('disease_cards').select('*').eq('id', id).single();
      
      if (data) {
        // Parsing JSON dari database (Support format lama & baru)
        const raw = data.scenario || (typeof data.content === 'string' ? JSON.parse(data.content) : data.content);
        
        // Normalisasi Data (Mapping field agar frontend tidak crash)
        const normalized: GameData = {
          displayTitle: data.title, // Judul Aman (Misal: Kasus Bpk Budi)
          patient: {
            name: raw.patient?.name || "Pasien X",
            age: raw.patient?.age || "--",
            job: raw.patient?.job || "Tidak diketahui",
            history: raw.patient?.history_now || raw.patient?.history || "Tidak ada data riwayat."
          },
          anamnesis: raw.anamnesis || [],
          physical: raw.examinations?.physical || { vitals: {}, observations: [] },
          labs: raw.examinations?.labs || [],
          diagnosis: {
            correct: raw.diagnosis?.correct_answer || data.correct_diagnosis, // Jawaban Rahasia
            options: raw.diagnosis?.options || []
          },
          wiki: raw.wiki || { definition: "Data tidak tersedia", pathophysiology: "", treatment: [] }
        };

        setGameData(normalized);
        
        // Chat Log Pertama
        setLogs([{ 
          sender: 'System', 
          text: `PASIEN BARU: ${normalized.patient.name} (${normalized.patient.age}th) - ${normalized.patient.job}. \n"${normalized.patient.history}"`, 
          type: 'info' 
        }]);
      }
      setLoading(false);
    }
    fetchGame();
  }, [id]);

  // Auto Scroll Chat ke Bawah
  useEffect(() => {
    const el = document.getElementById('chat-container');
    if (el) el.scrollTop = el.scrollHeight;
  }, [logs]);

  // Helper untuk menambah log
  const addLog = (sender: string, text: string, type: 'info'|'chat'|'alert'|'success') => {
    setLogs(prev => [...prev, { sender, text, type }]);
  };

  // Helper mengurangi energi
  const consumeEnergy = (amount: number) => {
    if (energy - amount < 0) {
      if (playFlatline) playFlatline(); 
      toast.error("ENERGI HABIS!");
      setGameState('lost');
      addLog('System', 'Dokter kelelahan. Pasien dirujuk ke RS lain. (GAME OVER)', 'alert');
      setEnergy(0);
      return false;
    }
    setEnergy(prev => prev - amount);
    return true;
  };

  // --- HANDLERS ---

  const handleAsk = (index: number, item: any) => {
    if (gameState !== 'playing') return;
    if (playClick) playClick();
    if (!consumeEnergy(COSTS.ASK)) return;

    setAskedQuestions(prev => [...prev, index]);
    addLog('Dokter', item.question, 'chat');
    // Simulasi delay mengetik pasien
    setTimeout(() => { addLog(gameData!.patient.name, item.answer, 'chat'); }, 600);
  };

  const handlePhysicalCheck = () => {
    if (gameState !== 'playing' || revealedPhysical) return;
    if (playClick) playClick();
    if (!consumeEnergy(COSTS.PHYSICAL)) return;
    
    setRevealedPhysical(true);
    addLog('System', 'Melakukan pemeriksaan fisik (Inspeksi, Palpasi, Auskultasi)...', 'info');
  };

  const handleLabCheck = () => {
    if (gameState !== 'playing' || revealedLabs) return;
    if (playClick) playClick();
    if (!consumeEnergy(COSTS.LABS)) return;

    setRevealedLabs(true);
    addLog('System', 'Memesan pemeriksaan Laboratorium & Radiologi...', 'info');
  };

  const handleGuess = (option: string) => {
    if (gameState !== 'playing') return;
    
    // Cek Jawaban
    if (option === gameData!.diagnosis.correct) {
      if (playCorrect) playCorrect();
      setGameState('won');
      addLog('System', `🏆 DIAGNOSIS TEPAT! Pasien menderita ${gameData!.diagnosis.correct}.`, 'success');
      toast.success("DIAGNOSIS TEPAT!");
    } else {
      if (playWrong) playWrong();
      const penalty = 50;
      toast.error("DIAGNOSIS SALAH!");
      addLog('System', `❌ SALAH! Pasien bukan menderita ${option}. Kondisi memburuk (-${penalty} AP)`, 'alert');
      
      if (energy - penalty <= 0) {
        if (playFlatline) playFlatline();
        setEnergy(0);
        setGameState('lost');
      } else {
        setEnergy(prev => prev - penalty);
      }
    }
  };

  // --- RENDER UI ---

  if (loading) return <div className="h-screen flex items-center justify-center text-slate-400 animate-pulse">Memuat Rekam Medis...</div>;
  if (!gameData) return <div className="text-center p-10 text-red-500">Gagal memuat data kasus.</div>;

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900 pb-20">
      
      {/* HEADER: Judul Aman (Bukan Spoiler) */}
      <div className="bg-white border-b sticky top-0 z-20 px-4 py-3 flex justify-between items-center shadow-sm">
        <div className="flex items-center gap-3">
           <div className="bg-blue-600 text-white p-2 rounded-lg"><Activity size={20} /></div>
           <div>
             <h1 className="font-bold text-slate-800 text-sm md:text-base">{gameData.displayTitle}</h1>
             <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Medical Simulation</p>
           </div>
        </div>
        
        {/* Indikator Status */}
        <div className="flex items-center gap-2 bg-slate-100 px-3 py-1 rounded-full">
            <span className={`w-2 h-2 rounded-full animate-pulse ${gameState === 'playing' ? 'bg-green-500' : gameState==='won' ? 'bg-blue-500' : 'bg-red-500'}`}></span>
            <span className="text-xs font-bold text-slate-600">
                {gameState === 'playing' ? 'LIVE' : gameState === 'won' ? 'SOLVED' : 'FAILED'}
            </span>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-4 flex flex-col lg:flex-row gap-6 mt-2">
        
        {/* --- KOLOM KIRI: Chat, Energi, Hasil --- */}
        <div className="flex-1 flex flex-col gap-6">
          
          {/* Bar Energi */}
          <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
             <div className="flex justify-between items-end mb-2">
                <p className="text-xs font-bold text-slate-400 uppercase">Stamina Dokter</p>
                <p className={`text-xl font-black ${energy < 30 ? 'text-red-500' : 'text-slate-800'}`}>{energy} AP</p>
             </div>
             <div className="h-3 w-full bg-slate-100 rounded-full overflow-hidden">
                <div 
                    className={`h-full transition-all duration-500 ${energy<30?'bg-red-500':'bg-blue-500'}`} 
                    style={{width:`${energy}%`}}
                />
             </div>
          </div>

          {/* Area Chat Log */}
          <div className="flex-1 bg-white rounded-2xl shadow-sm border border-slate-200 flex flex-col min-h-[400px] lg:h-[500px]">
            {/* Info Pasien Mini */}
            <div className="p-4 border-b bg-slate-50/50 flex items-center gap-3">
               <div className="h-10 w-10 bg-slate-200 rounded-full flex items-center justify-center"><User size={20} className="text-slate-500"/></div>
               <div>
                  <p className="font-bold text-slate-800">{gameData.patient.name}</p>
                  <p className="text-xs text-slate-500">{gameData.patient.job}</p>
               </div>
            </div>
            
            {/* Pesan-pesan */}
            <div id="chat-container" className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/30">
               {logs.map((log, i) => (
                 <div key={i} className={`flex flex-col ${log.sender==='Dokter'?'items-end':'items-start'} animate-in slide-in-from-bottom-2`}>
                    {log.sender!=='System' && <span className="text-[10px] font-bold text-slate-400 mb-1 px-1">{log.sender}</span>}
                    <div className={`px-4 py-2 text-sm max-w-[85%] shadow-sm ${
                      log.sender==='Dokter' ? 'bg-blue-600 text-white rounded-2xl rounded-tr-sm' : 
                      log.type==='alert' ? 'bg-red-50 text-red-800 border border-red-200 rounded-xl w-full text-center' :
                      log.type==='success' ? 'bg-green-50 text-green-800 border border-green-200 rounded-xl w-full text-center font-bold' :
                      'bg-white text-slate-800 border border-slate-200 rounded-2xl rounded-tl-sm'
                    }`}>{log.text}</div>
                 </div>
               ))}
            </div>
          </div>

          {/* KARTU HASIL (Hanya Muncul Jika Game Selesai) */}
          {gameState !== 'playing' && (
             <div className="bg-white rounded-2xl shadow-xl border-t-4 border-t-blue-600 p-6 animate-in zoom-in-95">
                <div className="border-b border-slate-100 pb-4 mb-4">
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Diagnosis Akhir</p>
                  {/* DISINI BARU KITA TAMPILKAN JAWABANNYA */}
                  <h2 className="text-3xl font-black text-slate-800">{gameData.diagnosis.correct}</h2>
                </div>
                
                <div className="grid md:grid-cols-2 gap-6">
                   <div>
                      <h3 className="font-bold text-blue-600 mb-2 flex gap-2 items-center"><BookOpen size={16}/> Penjelasan Medis</h3>
                      <p className="text-sm text-slate-600 leading-relaxed text-justify">{gameData.wiki.definition}</p>
                      <p className="text-sm text-slate-500 mt-2 italic border-l-2 border-slate-300 pl-3">{gameData.wiki.pathophysiology}</p>
                   </div>
                   <div>
                      <h3 className="font-bold text-green-600 mb-2 flex gap-2 items-center"><CheckCircle size={16}/> Tatalaksana</h3>
                      <ul className="space-y-2">
                        {gameData.wiki.treatment?.map((t:string, i:number)=>(
                           <li key={i} className="text-sm text-slate-700 flex gap-2 items-start">
                               <span className="text-green-500 font-bold mt-0.5">•</span> {t}
                           </li>
                        ))}
                      </ul>
                   </div>
                </div>
                
                <Button className="w-full mt-6 bg-slate-900 hover:bg-slate-800 py-6 text-lg" onClick={() => router.push('/')}>
                    Main Kasus Baru
                </Button>
             </div>
          )}
        </div>

        {/* --- KOLOM KANAN: Panel Aksi --- */}
        <div className="w-full lg:w-[400px] flex flex-col gap-4 shrink-0">
           
           {/* 1. Panel Anamnesis */}
           <Card className="border-none shadow-md bg-white overflow-hidden">
             <div className="bg-indigo-600 p-3 text-white flex justify-between items-center">
                <span className="font-bold flex gap-2 items-center"><MessageCircle size={18}/> Anamnesis</span>
                <span className="text-xs bg-white/20 px-2 py-1 rounded">-{COSTS.ASK} AP</span>
             </div>
             <div className="p-2 space-y-2 max-h-[300px] overflow-y-auto bg-slate-50">
                {gameData.anamnesis.map((q: any, i: number) => (
                  <button key={i} onClick={() => handleAsk(i, q)} disabled={askedQuestions.includes(i) || gameState!=='playing'}
                    className={`w-full text-left text-sm p-3 rounded-lg border transition-all ${askedQuestions.includes(i)?'bg-slate-100 text-slate-400 border-slate-100':'bg-white border-slate-200 hover:border-indigo-400 text-slate-700 hover:shadow-sm'}`}>
                    {q.question}
                  </button>
                ))}
             </div>
           </Card>

           {/* 2. Panel Fisik (Murah) */}
           <Card className="border-none shadow-md bg-white overflow-hidden">
             <div className="bg-orange-500 p-3 text-white flex justify-between items-center">
                <span className="font-bold flex gap-2 items-center"><Eye size={18}/> Fisik & Vital</span>
                <span className="text-xs bg-white/20 px-2 py-1 rounded">-{COSTS.PHYSICAL} AP</span>
             </div>
             {!revealedPhysical ? (
                <div className="p-6 text-center bg-slate-50">
                   <p className="text-xs text-slate-500 mb-3">Cek Tanda Vital & Inspeksi Visual</p>
                   <Button onClick={handlePhysicalCheck} disabled={gameState!=='playing'} className="w-full bg-orange-500 hover:bg-orange-600">
                     Lakukan Pemeriksaan
                   </Button>
                </div>
             ) : (
                <div className="p-4 bg-orange-50 space-y-3 animate-in fade-in">
                   {/* Grid Vital Signs */}
                   <div className="grid grid-cols-2 gap-2">
                      {Object.entries(gameData.physical.vitals).map(([k,v]:any)=>(
                        <div key={k} className="bg-white p-2 rounded border border-orange-100 text-center">
                           <span className="text-[10px] uppercase text-slate-400 font-bold">{k}</span>
                           <p className="font-bold text-slate-800 text-sm">{v}</p>
                        </div>
                      ))}
                   </div>
                   {/* List Observasi */}
                   <div className="mt-2">
                       <p className="text-xs font-bold text-orange-800 mb-1">Catatan Observasi:</p>
                       <ul className="list-disc list-inside text-sm text-slate-700 space-y-1">
                           {gameData.physical.observations?.map((o:string,i:number)=><li key={i}>{o}</li>)}
                       </ul>
                   </div>
                </div>
             )}
           </Card>

           {/* 3. Panel Lab (Mahal) */}
           <Card className="border-none shadow-md bg-white overflow-hidden">
             <div className="bg-purple-600 p-3 text-white flex justify-between items-center">
                <span className="font-bold flex gap-2 items-center"><TestTube size={18}/> Lab & Radiologi</span>
                <span className="text-xs bg-white/20 px-2 py-1 rounded">-{COSTS.LABS} AP</span>
             </div>
             {!revealedLabs ? (
                <div className="p-6 text-center bg-slate-50">
                   <p className="text-xs text-slate-500 mb-3">Darah Lengkap, Rontgen, EKG (Akurat)</p>
                   <Button onClick={handleLabCheck} disabled={gameState!=='playing'} className="w-full bg-purple-600 hover:bg-purple-700">
                     Order Laboratorium
                   </Button>
                </div>
             ) : (
                <div className="bg-purple-50 animate-in fade-in">
                   <table className="w-full text-sm text-left">
                      <thead className="bg-purple-100 text-purple-900 text-xs uppercase">
                          <tr><th className="px-4 py-2">Test</th><th className="px-4 py-2 text-right">Hasil</th></tr>
                      </thead>
                      <tbody>
                         {gameData.labs.map((l:any, i:number)=>(
                            <tr key={i} className="border-b border-purple-100 hover:bg-purple-100/50">
                                <td className="px-4 py-2 font-medium text-slate-700">{l.name}</td>
                                <td className="px-4 py-2 text-right font-bold text-slate-900">{l.result}</td>
                            </tr>
                         ))}
                      </tbody>
                   </table>
                </div>
             )}
           </Card>

           {/* 4. Panel Diagnosis (Final) */}
           <Card className="border-none shadow-md bg-slate-800 text-white overflow-hidden mt-2">
              <div className="p-3 bg-slate-900 border-b border-slate-700 font-bold flex gap-2 items-center">
                  <Stethoscope size={18} className="text-green-400"/> Tegakkan Diagnosis
              </div>
              <div className="p-3 space-y-2">
                 {gameData.diagnosis.options.map((opt:string, i:number)=>(
                    <button key={i} onClick={()=>handleGuess(opt)} disabled={gameState!=='playing'}
                      className="w-full text-left text-sm p-3 rounded bg-slate-700 hover:bg-green-600 border border-slate-600 hover:border-green-500 transition-colors font-medium">
                      {opt}
                    </button>
                 ))}
              </div>
           </Card>

        </div>
      </div>
    </div>
  );
}