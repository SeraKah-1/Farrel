'use client';

import { useEffect, useState, use } from 'react';
import { createClient } from '@/utils/supabase/client'; 
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Activity, TestTube, MessageCircle, HeartPulse, 
  Stethoscope, BookOpen, AlertCircle, CheckCircle, User, 
  Thermometer, Eye, FileText
} from 'lucide-react';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import useSound from 'use-sound';

export default function GameRoom({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const id = resolvedParams.id;
  const router = useRouter();
  const supabase = createClient();

  // AUDIO
  const [playClick] = useSound('/sounds/click.mp3', { volume: 0.5 });
  const [playCorrect] = useSound('/sounds/correct.mp3', { volume: 0.5 });
  const [playWrong] = useSound('/sounds/wrong.mp3', { volume: 0.5 });
  const [playFlatline] = useSound('/sounds/flatline.mp3', { volume: 0.4 });

  const [gameData, setGameData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // GAME STATES
  const [energy, setEnergy] = useState(100); 
  const [logs, setLogs] = useState<{sender: string, text: string, type: 'info'|'chat'|'alert'|'success'}[]>([]);
  
  // TRACKING ACTIONS
  const [askedQuestions, setAskedQuestions] = useState<number[]>([]); 
  const [revealedPhysical, setRevealedPhysical] = useState(false);
  const [revealedLabs, setRevealedLabs] = useState(false);
  
  const [gameState, setGameState] = useState<'playing' | 'won' | 'lost'>('playing');

  // BIAYA ENERGI (BALANCING)
  const COST_ASK = 10;
  const COST_PHYSICAL = 15; // Lebih murah
  const COST_LABS = 40;     // Mahal (Kartu As)

  useEffect(() => {
    async function fetchGame() {
      await new Promise(r => setTimeout(r, 1000)); 
      const { data } = await supabase.from('disease_cards').select('*').eq('id', id).single();
      
      if (data) {
        // Handling Data Structure (Support Old & New Logic)
        const raw = data.scenario || (typeof data.content === 'string' ? JSON.parse(data.content) : data.content);
        
        // Normalisasi Data agar frontend tidak crash
        const normalized = {
          title: raw.title || data.title,
          patient: {
            name: raw.patient?.name || "Pasien Tanpa Nama",
            age: raw.patient?.age || "--",
            job: raw.patient?.job || "Tidak diketahui",
            history: raw.patient?.history_now || raw.patient?.history || raw.simulation?.chief_complaint
          },
          anamnesis: raw.anamnesis || raw.simulation?.interview_questions || [],
          // Pisahkan Fisik dan Lab
          physical: raw.examinations?.physical || { 
             vitals: raw.simulation?.vital_signs || {}, 
             observations: [] 
          },
          labs: raw.examinations?.labs || raw.simulation?.lab_abnormalities || [],
          
          diagnosis: {
            correct: raw.correct_diagnosis || raw.diagnosis?.correct_answer || data.correct_diagnosis,
            options: raw.diagnosis?.options || raw.simulation?.diagnosis_options || []
          },
          wiki: raw.wiki || { definition: "Data tidak tersedia", treatment: [] }
        };

        setGameData(normalized);
        
        // Log Awal
        setLogs([{ 
          sender: 'System', 
          text: `PASIEN BARU: ${normalized.patient.name} (${normalized.patient.age} th). \n"${normalized.patient.history}"`, 
          type: 'info' 
        }]);
      }
      setLoading(false);
    }
    fetchGame();
  }, [id]);

  // Auto Scroll Chat
  useEffect(() => {
    const el = document.getElementById('chat-container');
    if (el) el.scrollTop = el.scrollHeight;
  }, [logs]);

  const addLog = (sender: string, text: string, type: 'info'|'chat'|'alert'|'success') => {
    setLogs(prev => [...prev, { sender, text, type }]);
  };

  const consumeEnergy = (amount: number) => {
    if (energy - amount < 0) {
      if (playFlatline) playFlatline(); 
      toast.error("ENERGI HABIS!");
      setGameState('lost');
      addLog('System', 'Dokter pingsan kelelahan. Pasien dirujuk. (GAME OVER)', 'alert');
      setEnergy(0);
      return false;
    }
    setEnergy(prev => prev - amount);
    return true;
  };

  // -- ACTION HANDLERS --

  const handleAsk = (index: number, item: any) => {
    if (gameState !== 'playing') return;
    if (playClick) playClick();
    if (!consumeEnergy(COST_ASK)) return;

    setAskedQuestions(prev => [...prev, index]);
    addLog('Dokter', item.question, 'chat');
    setTimeout(() => { addLog(gameData.patient.name, item.answer, 'chat'); }, 800);
  };

  const handlePhysicalCheck = () => {
    if (gameState !== 'playing' || revealedPhysical) return;
    if (playClick) playClick();
    if (!consumeEnergy(COST_PHYSICAL)) return;

    setRevealedPhysical(true);
    addLog('System', 'Melakukan pemeriksaan fisik (Inspeksi, Palpasi, Auskultasi)...', 'info');
  };

  const handleLabCheck = () => {
    if (gameState !== 'playing' || revealedLabs) return;
    if (playClick) playClick();
    if (!consumeEnergy(COST_LABS)) return;

    setRevealedLabs(true);
    addLog('System', 'Sampel diambil untuk pemeriksaan Lab & Radiologi...', 'info');
  };

  const handleGuess = (option: string) => {
    if (gameState !== 'playing') return;
    
    const isCorrect = option === gameData.diagnosis.correct;

    if (isCorrect) {
      if (playCorrect) playCorrect();
      setGameState('won');
      addLog('System', `🏆 DIAGNOSIS TEPAT! Pasien ditangani sesuai protokol ${gameData.title}.`, 'success');
      toast.success("DIAGNOSIS TEPAT!");
    } else {
      if (playWrong) playWrong();
      const penalty = 50;
      toast.error("DIAGNOSIS SALAH!");
      addLog('System', `❌ SALAH! Bukan ${option}. Kondisi memburuk! (-${penalty} AP)`, 'alert');
      
      if (energy - penalty <= 0) {
        if (playFlatline) playFlatline();
        setEnergy(0);
        setGameState('lost');
      } else {
        setEnergy(prev => prev - penalty);
      }
    }
  };

  // -- RENDER --

  if (loading) {
    return (
      <div className="h-screen flex flex-col justify-center items-center gap-4 bg-slate-50">
        <Activity className="animate-spin text-blue-500" size={48} />
        <p className="text-slate-400 text-sm animate-pulse">Menyiapkan Rekam Medis...</p>
      </div>
    );
  }
  
  if (!gameData) return <div className="text-center p-10">Error memuat data.</div>;

  return (
    <div className="min-h-screen bg-slate-50 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px] font-sans text-slate-900 pb-20">
      
      {/* HEADER */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-20 px-4 py-3 flex justify-between items-center shadow-sm">
        <div className="flex items-center gap-2">
           <div className="bg-blue-600 text-white p-2 rounded-lg"><Activity size={20} /></div>
           <h1 className="font-bold text-slate-800">MED-SIM <span className="text-blue-600">PRO</span></h1>
        </div>
        <div className="flex items-center gap-2">
            <span className={`animate-pulse w-3 h-3 rounded-full ${gameState === 'playing' ? 'bg-green-500' : 'bg-red-500'}`}></span>
            <span className="text-sm font-bold text-slate-600">
              {gameState === 'playing' ? 'LIVE CASE' : gameState === 'won' ? 'CASE CLOSED' : 'PATIENT LOST'}
            </span>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-4 flex flex-col lg:flex-row gap-6 mt-2">
        
        {/* --- LEFT COLUMN: Vitals, Chat, Result --- */}
        <div className="flex-1 flex flex-col gap-6">
          
          {/* ENERGY BAR */}
          <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 relative overflow-hidden">
             <div className="flex justify-between items-end mb-2 relative z-10">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Stamina Dokter</p>
                <p className="text-2xl font-black text-slate-800">{energy} <span className="text-sm text-slate-400">AP</span></p>
             </div>
             <div className="h-4 w-full bg-slate-100 rounded-full overflow-hidden relative z-10">
                <div 
                  className={`h-full transition-all duration-500 ${energy < 30 ? 'bg-red-500' : 'bg-blue-500'}`} 
                  style={{ width: `${energy}%` }}
                />
             </div>
          </div>

          {/* CHAT LOG */}
          <div className="flex-1 bg-white rounded-2xl shadow-sm border border-slate-200 flex flex-col min-h-[400px] lg:h-[500px]">
            <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex items-center gap-3">
              <div className="h-10 w-10 bg-slate-200 rounded-full flex items-center justify-center">
                 <User size={20} className="text-slate-500"/>
              </div>
              <div>
                 <p className="text-sm font-bold text-slate-800">{gameData.patient.name}</p>
                 <p className="text-xs text-slate-500">{gameData.patient.age} tahun • {gameData.patient.job}</p>
              </div>
            </div>
            
            <div id="chat-container" className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/30">
               {logs.map((log, i) => (
                 <div key={i} className={`flex flex-col ${log.sender === 'Dokter' ? 'items-end' : 'items-start'} animate-in slide-in-from-bottom-2`}>
                    {log.sender !== 'System' && (
                      <span className="text-xs font-bold mb-1 px-1 text-slate-400">{log.sender}</span>
                    )}
                    <div className={`px-4 py-2 text-sm shadow-sm max-w-[85%] ${
                      log.sender === 'Dokter' ? 'bg-blue-600 text-white rounded-2xl rounded-tr-sm' : 
                      log.sender === 'System' ? 'w-full max-w-full text-center bg-slate-100 text-slate-500 text-xs py-1 rounded border' : 
                      log.type === 'alert' ? 'bg-red-50 text-red-800 border-red-200 border rounded-xl' :
                      log.type === 'success' ? 'bg-green-50 text-green-800 border-green-200 border rounded-xl font-bold text-center w-full' :
                      'bg-white text-slate-800 border border-slate-200 rounded-2xl rounded-tl-sm'
                    }`}>
                      {log.text}
                    </div>
                 </div>
               ))}
            </div>
          </div>

          {/* MEDICAL WIKI RESULT (SHOW ONLY WHEN FINISHED) */}
          {gameState !== 'playing' && (
             <div className="bg-white rounded-2xl shadow-xl border-t-4 border-t-blue-600 overflow-hidden animate-in zoom-in-95 p-6">
                <div className="mb-6 border-b border-slate-100 pb-4">
                  <h2 className="text-2xl font-black text-slate-800">{gameData.title}</h2>
                  <div className="flex gap-2 mt-2">
                     {gameState === 'won' 
                        ? <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded text-xs font-bold">DIAGNOSIS TEPAT</span> 
                        : <span className="bg-red-100 text-red-700 px-2 py-0.5 rounded text-xs font-bold">DIAGNOSIS MELESET</span>
                     }
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-6">
                   <div>
                      <h3 className="font-bold text-blue-600 flex items-center gap-2 mb-2"><BookOpen size={16}/> Definisi & Patofisiologi</h3>
                      <p className="text-sm text-slate-600 text-justify leading-relaxed">{gameData.wiki.definition}</p>
                      <p className="text-sm text-slate-600 text-justify leading-relaxed mt-2 italic">{gameData.wiki.pathophysiology}</p>
                   </div>
                   <div>
                      <h3 className="font-bold text-green-600 flex items-center gap-2 mb-2"><CheckCircle size={16}/> Tatalaksana Medis</h3>
                      <ul className="space-y-1">
                        {gameData.wiki.treatment?.map((t: string, i: number) => (
                           <li key={i} className="text-sm text-slate-700 flex gap-2">
                              <span className="font-bold text-green-500">•</span> {t}
                           </li>
                        ))}
                      </ul>
                   </div>
                </div>
                
                <Button className="w-full mt-6 bg-slate-900 hover:bg-slate-800" onClick={() => router.push('/')}>
                  Main Kasus Baru
                </Button>
             </div>
          )}

        </div>

        {/* --- RIGHT COLUMN: Actions --- */}
        <div className="w-full lg:w-[400px] flex flex-col gap-4 shrink-0">
           
           {/* 1. ANAMNESIS */}
           <Card className="border-none shadow-md overflow-hidden bg-white">
             <div className="bg-indigo-600 p-3 flex justify-between items-center text-white">
                <span className="font-bold flex gap-2 items-center"><MessageCircle size={18}/> Anamnesis</span>
                <span className="text-xs bg-white/20 px-2 py-1 rounded">-{COST_ASK} AP</span>
             </div>
             <div className="p-2 space-y-2 max-h-[300px] overflow-y-auto bg-slate-50">
                {gameData.anamnesis.map((q: any, i: number) => (
                  <button 
                    key={i} 
                    onClick={() => handleAsk(i, q)}
                    disabled={askedQuestions.includes(i) || gameState !== 'playing'}
                    className={`w-full text-left text-sm p-3 rounded-lg border transition-all ${
                      askedQuestions.includes(i) 
                      ? 'bg-slate-100 text-slate-400 border-slate-200' 
                      : 'bg-white border-slate-200 hover:border-indigo-400 hover:shadow-sm text-slate-700'
                    }`}
                  >
                    {q.question}
                  </button>
                ))}
             </div>
           </Card>

           {/* 2. PEMERIKSAAN FISIK (MURAH) */}
           <Card className="border-none shadow-md overflow-hidden bg-white">
             <div className="bg-orange-500 p-3 flex justify-between items-center text-white">
                <span className="font-bold flex gap-2 items-center"><Eye size={18}/> Fisik & Tanda Vital</span>
                <span className="text-xs bg-white/20 px-2 py-1 rounded">-{COST_PHYSICAL} AP</span>
             </div>
             
             {!revealedPhysical ? (
                <div className="p-6 text-center bg-slate-50">
                   <p className="text-xs text-slate-500 mb-3">Cek Tensi, Suhu, Nadi & Inspeksi Visual</p>
                   <Button onClick={handlePhysicalCheck} disabled={gameState !== 'playing'} className="w-full bg-orange-500 hover:bg-orange-600">
                     Lakukan Pemeriksaan
                   </Button>
                </div>
             ) : (
                <div className="p-4 bg-orange-50 space-y-4 animate-in fade-in">
                   {/* Grid Vital Signs */}
                   <div className="grid grid-cols-2 gap-2">
                      {Object.entries(gameData.physical.vitals).map(([key, val]: any) => (
                        <div key={key} className="bg-white p-2 rounded border border-orange-100 text-center">
                           <p className="text-[10px] uppercase text-slate-400 font-bold">{key}</p>
                           <p className="font-bold text-slate-800 text-sm">{val}</p>
                        </div>
                      ))}
                   </div>
                   {/* List Observasi */}
                   <div>
                     <p className="text-xs font-bold text-orange-700 mb-1">Catatan Observasi:</p>
                     <ul className="list-disc list-inside text-sm text-slate-700 space-y-1">
                        {gameData.physical.observations?.map((obs: string, i: number) => (
                           <li key={i}>{obs}</li>
                        ))}
                     </ul>
                   </div>
                </div>
             )}
           </Card>

           {/* 3. LAB & PENUNJANG (MAHAL) */}
           <Card className="border-none shadow-md overflow-hidden bg-white">
             <div className="bg-purple-600 p-3 flex justify-between items-center text-white">
                <span className="font-bold flex gap-2 items-center"><TestTube size={18}/> Lab & Radiologi</span>
                <span className="text-xs bg-white/20 px-2 py-1 rounded">-{COST_LABS} AP</span>
             </div>

             {!revealedLabs ? (
                <div className="p-6 text-center bg-slate-50">
                   <p className="text-xs text-slate-500 mb-3">Cek Darah, Rontgen, EKG (Akurat)</p>
                   <Button onClick={handleLabCheck} disabled={gameState !== 'playing'} className="w-full bg-purple-600 hover:bg-purple-700">
                     Order Laboratorium
                   </Button>
                </div>
             ) : (
                <div className="bg-purple-50 animate-in fade-in">
                   <table className="w-full text-sm text-left">
                      <thead className="text-xs text-purple-900 uppercase bg-purple-100">
                         <tr>
                            <th className="px-4 py-2">Pemeriksaan</th>
                            <th className="px-4 py-2 text-right">Hasil</th>
                         </tr>
                      </thead>
                      <tbody>
                         {gameData.labs.map((item: any, i: number) => (
                            <tr key={i} className="border-b border-purple-100 hover:bg-purple-100/50">
                               <td className="px-4 py-2 font-medium text-slate-700">{item.name}</td>
                               <td className="px-4 py-2 text-right text-slate-900 font-bold">{item.result}</td>
                            </tr>
                         ))}
                      </tbody>
                   </table>
                </div>
             )}
           </Card>

           {/* 4. DIAGNOSIS (FINAL) */}
           <Card className="border-none shadow-md overflow-hidden bg-slate-800 text-white mt-2">
              <div className="p-3 bg-slate-900 border-b border-slate-700 font-bold flex gap-2 items-center">
                 <Stethoscope size={18} className="text-green-400"/> Tegakkan Diagnosis
              </div>
              <div className="p-3 space-y-2">
                 {gameData.diagnosis.options.map((opt: string, i: number) => (
                    <button
                      key={i}
                      onClick={() => handleGuess(opt)}
                      disabled={gameState !== 'playing'}
                      className="w-full text-left text-sm font-medium p-3 rounded bg-slate-700 hover:bg-green-600 transition-colors border border-slate-600 hover:border-green-500"
                    >
                      {opt}
                    </button>
                 ))}
              </div>
           </Card>

        </div>
      </div>
      
      {/* WATERMARK */}
      <div className="fixed bottom-4 right-4 z-50">
         <div className="bg-white/90 backdrop-blur-md border border-slate-200 shadow-xl rounded-full px-3 py-1 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
            <span className="text-[10px] font-bold text-slate-500">
              HOSPITAL OS v2.0 • <span className="text-blue-600">Dev by Farrel</span>
            </span>
         </div>
      </div>

    </div>
  );
}