'use client';

import { useEffect, useState, use } from 'react';
import { createClient } from '@/utils/supabase/client'; 
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Activity, TestTube, MessageCircle, HeartPulse, 
  Stethoscope, BookOpen, AlertCircle, CheckCircle, User 
} from 'lucide-react';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import useSound from 'use-sound';

export default function GameRoom({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const id = resolvedParams.id;
  const router = useRouter();
  const supabase = createClient();

  // --- AUDIO HOOKS ---
  const [playClick] = useSound('/sounds/click.mp3', { volume: 0.5 });
  const [playCorrect] = useSound('/sounds/correct.mp3', { volume: 0.5 });
  const [playWrong] = useSound('/sounds/wrong.mp3', { volume: 0.5 });
  const [playFlatline] = useSound('/sounds/flatline.mp3', { volume: 0.4 });

  const [card, setCard] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // --- GAME STATE ---
  const [energy, setEnergy] = useState(100); 
  const [logs, setLogs] = useState<{sender: string, text: string, type: 'info'|'chat'|'alert'|'success'}[]>([]);
  const [askedQuestions, setAskedQuestions] = useState<number[]>([]); 
  const [dataRevealed, setDataRevealed] = useState({ vitals: false, labs: false });
  const [gameState, setGameState] = useState<'playing' | 'won' | 'lost'>('playing');

  const COSTS = { ASK: 10, VITALS: 25, LABS: 40 };

  useEffect(() => {
    async function fetchGame() {
      await new Promise(r => setTimeout(r, 1000)); 
      const { data } = await supabase.from('disease_cards').select('*').eq('id', id).single();
      
      if (data) {
        let normalizedContent;
        if (data.scenario) {
          normalizedContent = {
            simulation: {
              chief_complaint: data.scenario.patient.history,
              diagnosis_answer: data.correct_diagnosis,
              interview_questions: data.scenario.dialogues 
                ? data.scenario.dialogues.map((d: any) => ({
                    question: d.question.replace(/^(Dokter|Doctor):\s*/i, ''), 
                    answer: d.answer.replace(/^(Pasien|Patient):\s*/i, ''),
                    is_relevant: true
                  }))
                : (data.scenario.symptoms || []).map((s: string, idx: number) => ({
                    question: `Tanya gejala spesifik #${idx + 1}`,
                    answer: s,
                    is_relevant: true
                  })),
              lab_abnormalities: [
                ...(data.scenario.physical_check || []).map((v: string) => ({ name: "Fisik", value: v })),
                ...(data.scenario.lab_results || []).map((l: string) => ({ name: "Lab", value: l }))
              ],
              vital_signs: {
                systolic: 120, diastolic: 80, heart_rate: 80, temperature: 37, resp_rate: 18
              },
              diagnosis_options: data.scenario.options
            },
            wiki: {
              definition: data.scenario.explanation,
              clinical_signs: data.scenario.physical_check || [],
              treatment_guideline: "Lakukan tatalaksana medis sesuai standar diagnosa."
            }
          };
        } else {
          normalizedContent = typeof data.content === 'string' ? JSON.parse(data.content) : data.content;
        }

        const gameData = { ...data, content: normalizedContent };
        setCard(gameData);
        setLogs([{ 
          sender: 'System', 
          text: `PASIEN BARU MASUK: ${gameData.title}. \nKeluhan: "${gameData.content.simulation.chief_complaint}"`, 
          type: 'info' 
        }]);
      }
      setLoading(false);
    }
    fetchGame();
  }, [id]);

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
      addLog('System', 'Dokter kelelahan. Pasien dirujuk ke RS lain (GAME OVER).', 'alert');
      setEnergy(0);
      return false;
    }
    setEnergy(prev => prev - amount);
    return true;
  };

  const handleAsk = (index: number, q: any) => {
    if (gameState !== 'playing') return;
    if (playClick) playClick();
    if (!consumeEnergy(COSTS.ASK)) return;
    setAskedQuestions(prev => [...prev, index]);
    addLog('Dokter', q.question, 'chat');
    setTimeout(() => { addLog('Pasien', q.answer, 'chat'); }, 600);
  };

  const revealData = (type: 'vitals' | 'labs') => {
    if (gameState !== 'playing') return;
    if (playClick) playClick();
    const cost = type === 'vitals' ? COSTS.VITALS : COSTS.LABS;
    if (!dataRevealed[type]) {
      if (!consumeEnergy(cost)) return;
      setDataRevealed(prev => ({ ...prev, [type]: true }));
      addLog('System', type === 'vitals' ? "Perawat memeriksa tanda vital..." : "Sampel darah dikirim ke lab...", 'info');
    }
  };

  const handleGuess = (option: string) => {
    if (gameState !== 'playing') return;
    const correctAnswer = card.content.simulation.diagnosis_answer;
    if (option === correctAnswer) {
      if (playCorrect) playCorrect();
      setGameState('won');
      addLog('System', `🏆 DIAGNOSA TEPAT! (${correctAnswer}). Pasien selamat.`, 'success');
      toast.success("SEMPURNA! Pasien Selamat.");
    } else {
      if (playWrong) playWrong();
      const penalty = 50;
      toast.error("DIAGNOSA SALAH!");
      addLog('System', `❌ SALAH! Bukan ${option}. Kondisi pasien kritis! (-${penalty} Energi)`, 'alert');
      if (energy - penalty <= 0) {
        if (playFlatline) playFlatline();
        setEnergy(0);
        setGameState('lost');
        addLog('System', 'Pasien meninggal karena salah penanganan.', 'alert');
      } else {
        setEnergy(prev => prev - penalty);
      }
    }
  };

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto p-4 h-screen flex flex-col justify-center items-center gap-4 bg-slate-50">
        <Activity className="animate-spin text-blue-500 mb-4" size={48} />
        <Skeleton className="h-12 w-64 rounded-full" />
        <p className="text-slate-400 text-sm animate-pulse">Menyiapkan Ruang Rawat...</p>
      </div>
    );
  }
  
  if (!card) return <div className="text-center p-10 font-bold text-red-500">Data Kasus Tidak Ditemukan</div>;

  const sim = card.content.simulation;
  const wiki = card.content.wiki;

  return (
    <div className="min-h-screen bg-slate-50 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px] font-sans text-slate-900 pb-20">
      
      {/* HEADER */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-20 px-4 md:px-6 py-3 flex justify-between items-center shadow-sm">
        <div className="flex items-center gap-2">
           <div className="bg-blue-600 text-white p-2 rounded-lg">
             <Activity size={20} />
           </div>
           <div>
             <h1 className="text-sm md:text-base font-bold text-slate-800 leading-none">MED-SIM <span className="text-blue-600">PRO</span></h1>
           </div>
        </div>
        <div className="flex items-center gap-2">
            <span className="relative flex h-3 w-3">
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${gameState === 'playing' ? 'bg-green-400' : 'bg-red-400'}`}></span>
              <span className={`relative inline-flex rounded-full h-3 w-3 ${gameState === 'playing' ? 'bg-green-500' : 'bg-red-500'}`}></span>
            </span>
            <span className="text-xs md:text-sm font-bold text-slate-600 uppercase">
              {gameState === 'playing' ? 'LIVE' : gameState === 'won' ? 'CLOSED' : 'CRITICAL'}
            </span>
        </div>
      </div>

      {/* LAYOUT FIX: 
         - Menggunakan 'lg:flex-row' bukan 'md:flex-row'. 
         - Tablet (md) sekarang akan tetap 'flex-col' (atas-bawah) agar tidak sempit.
         - Laptop (lg) baru berubah jadi kiri-kanan.
      */}
      <div className="max-w-7xl mx-auto p-4 flex flex-col lg:flex-row gap-6 mt-2">
        
        {/* --- AREA UTAMA (Energi & Chat) --- */}
        <div className="flex-1 flex flex-col gap-4 md:gap-6">
          
          {/* ENERGY BAR */}
          <div className="bg-white p-4 md:p-5 rounded-2xl shadow-sm border border-slate-200 flex items-center gap-4 relative overflow-hidden">
             <div className={`absolute left-0 top-0 bottom-0 bg-blue-50 transition-all duration-700`} style={{ width: `${energy}%`, opacity: 0.3 }} />
             
             <div className={`relative z-10 p-3 rounded-xl shadow-lg transition-colors duration-500 ${energy < 30 ? 'bg-red-500 shadow-red-200' : 'bg-blue-600 shadow-blue-200'}`}>
                <HeartPulse size={24} className="text-white animate-pulse" />
             </div>
             <div className="flex-1 relative z-10">
                <div className="flex justify-between items-end mb-2">
                   <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Stamina</p>
                   <p className="text-xl md:text-2xl font-black text-slate-800">{energy}<span className="text-sm font-medium text-slate-400 ml-1">AP</span></p>
                </div>
                <div className="h-3 w-full bg-slate-100 rounded-full overflow-hidden">
                   <div 
                     className={`h-full rounded-full transition-all duration-700 ease-out ${energy < 30 ? 'bg-red-500' : energy < 60 ? 'bg-amber-400' : 'bg-blue-500'}`} 
                     style={{ width: `${energy}%` }}
                   />
                </div>
             </div>
          </div>

          {/* CHAT AREA - Height disesuaikan agar di tablet tetap tinggi */}
          <div className="flex-1 bg-white rounded-2xl shadow-sm border border-slate-200 flex flex-col overflow-hidden min-h-[500px] lg:h-auto">
            <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex items-center gap-2">
              <User size={18} className="text-slate-400"/>
              <span className="text-sm md:text-base font-bold text-slate-700">Pasien: <span className="text-blue-600">{card.title}</span></span>
            </div>
            
            <div id="chat-container" className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4 bg-slate-50/30">
               {logs.map((log, i) => (
                 <div key={i} className={`flex flex-col ${log.sender === 'Dokter' ? 'items-end' : 'items-start'} animate-in slide-in-from-bottom-2 fade-in duration-300`}>
                    
                    {log.sender !== 'System' && (
                      <span className={`text-xs font-bold mb-1 px-2 ${log.sender === 'Dokter' ? 'text-blue-500' : 'text-slate-400'}`}>
                        {log.sender === 'Dokter' ? 'Dr. Kamu' : log.sender}
                      </span>
                    )}

                    <div className={`px-4 md:px-5 py-3 text-sm md:text-base shadow-sm max-w-[90%] md:max-w-[85%] leading-relaxed ${
                      log.sender === 'Dokter' 
                        ? 'bg-blue-600 text-white rounded-2xl rounded-tr-sm' 
                        : log.sender === 'System' 
                          ? 'w-full max-w-full text-center bg-slate-200/50 text-slate-600 rounded-lg text-xs font-mono py-2 border border-slate-200 mx-auto' 
                          : log.type === 'alert'
                            ? 'bg-red-50 text-red-800 border border-red-200 rounded-xl'
                            : log.type === 'success'
                              ? 'bg-green-50 text-green-800 border border-green-200 rounded-xl font-bold text-center w-full'
                              : 'bg-white text-slate-800 border border-slate-200 rounded-2xl rounded-tl-sm'
                    }`}>
                      {log.text}
                    </div>
                 </div>
               ))}
            </div>
          </div>

          {/* HASIL / RESULT CARD */}
          {gameState !== 'playing' && (
            <div className="bg-white rounded-2xl shadow-xl border-t-4 border-t-blue-500 overflow-hidden animate-in zoom-in-95 duration-500 mb-6">
               <div className="p-6 bg-blue-50/30 border-b border-slate-100">
                  <h2 className="flex items-center gap-2 text-xl font-bold text-slate-800">
                    <BookOpen className="text-blue-600" /> Analisis Kasus
                  </h2>
               </div>
               <div className="p-6 grid md:grid-cols-2 gap-8">
                  <div>
                    <p className="text-xs font-bold text-slate-400 uppercase mb-2">Diagnosa Akhir</p>
                    <p className="text-2xl font-black text-blue-600 mb-4">{sim.diagnosis_answer}</p>
                    <p className="text-sm md:text-base text-slate-600 leading-relaxed bg-slate-50 p-3 rounded-lg border border-slate-100">
                      {wiki.definition}
                    </p>
                  </div>
                  <div className="space-y-4">
                     <div>
                        <p className="text-xs font-bold text-slate-400 uppercase mb-2">Gejala Kunci</p>
                        <ul className="text-sm md:text-base text-slate-700 space-y-1">
                          {wiki.clinical_signs?.map((s: string, i: number) => (
                            <li key={i} className="flex items-start gap-2">
                              <span className="mt-2 h-1.5 w-1.5 rounded-full bg-blue-400 shrink-0"></span>
                              {s}
                            </li>
                          ))}
                        </ul>
                     </div>
                  </div>
               </div>
               <div className="p-4 bg-slate-50 flex justify-center">
                  <Button size="lg" className="w-full md:w-auto px-8 font-bold shadow-lg shadow-blue-200 py-6 text-lg" onClick={() => router.push('/')}>
                    Simulasi Berikutnya 👉
                  </Button>
               </div>
            </div>
          )}

        </div>

        {/* --- AREA KANAN (Actions) --- */}
        {/* Di Tablet (md), width akan 100% (full). Baru di Laptop (lg) jadi sidebar 380px */}
        <div className="w-full lg:w-[380px] flex flex-col gap-4 shrink-0 pb-10">
           
           {/* WAWANCARA */}
           <Card className={`border-none shadow-md overflow-hidden flex flex-col transition-all duration-300 ${gameState !== 'playing' && 'opacity-50 grayscale pointer-events-none'}`}>
             <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-3 md:p-4 flex justify-between items-center text-white">
                <div className="flex items-center gap-2 font-bold text-sm md:text-base"><MessageCircle size={18}/> Anamnesis</div>
                <span className="text-xs bg-white/20 px-2 py-1 rounded-full backdrop-blur-sm">-{COSTS.ASK} AP</span>
             </div>
             <div className="p-3 bg-white flex-1 space-y-2 lg:max-h-[300px] overflow-y-auto">
                {sim.interview_questions?.map((q: any, i: number) => (
                  <button 
                    key={i} 
                    onClick={() => handleAsk(i, q)}
                    disabled={askedQuestions.includes(i)}
                    className={`w-full text-left text-sm md:text-base p-3 md:p-4 rounded-xl border transition-all duration-200 ${
                      askedQuestions.includes(i) 
                      ? 'bg-slate-50 text-slate-400 border-slate-100 decoration-slate-300 line-through' 
                      : 'bg-white border-slate-200 hover:border-blue-400 hover:shadow-md hover:bg-blue-50/50 text-slate-700'
                    }`}
                  >
                    {q.question}
                  </button>
                ))}
             </div>
           </Card>

           {/* PEMERIKSAAN */}
           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-1 gap-4">
             {/* Tombol Lab/Fisik */}
             <Card className={`border-none shadow-md overflow-hidden transition-all duration-300 ${gameState !== 'playing' && 'opacity-50 grayscale pointer-events-none'}`}>
               <div className="bg-gradient-to-r from-purple-600 to-fuchsia-600 p-3 md:p-4 flex justify-between items-center text-white">
                  <div className="flex items-center gap-2 font-bold text-sm md:text-base"><TestTube size={18}/> Lab & Fisik</div>
                  <span className="text-xs bg-white/20 px-2 py-1 rounded-full backdrop-blur-sm">-{COSTS.LABS} AP</span>
               </div>
               <div className="p-4 bg-white min-h-[120px] flex items-center justify-center">
                 {!dataRevealed.labs ? (
                   <div className="text-center w-full">
                     <Button onClick={() => revealData('labs')} className="w-full bg-purple-600 hover:bg-purple-700 shadow-lg shadow-purple-200 py-6 text-sm md:text-base">
                       Order Lab & Fisik
                     </Button>
                   </div>
                 ) : (
                   <div className="w-full space-y-2 animate-in fade-in">
                      {sim.lab_abnormalities?.length > 0 ? sim.lab_abnormalities.map((lab: any, i: number) => (
                        <div key={i} className="flex justify-between items-center text-sm md:text-base p-2 border-b border-slate-100">
                           <span className="font-bold text-slate-500">{lab.name}</span>
                           <span className="font-bold text-slate-800 text-right">{lab.value}</span>
                        </div>
                      )) : <p className="text-sm text-slate-400 italic text-center">Tidak ada kelainan signifikan.</p>}
                   </div>
                 )}
               </div>
             </Card>

             {/* DIAGNOSA */}
             <Card className={`border-none shadow-md flex flex-col overflow-hidden bg-slate-800 text-white transition-all duration-300 ${gameState !== 'playing' && 'opacity-50 grayscale pointer-events-none'}`}>
                <div className="p-3 md:p-4 bg-slate-900 border-b border-slate-700 font-bold text-sm md:text-base flex items-center gap-2">
                   <Stethoscope size={18} className="text-green-400"/> Diagnosis Akhir
                </div>
                <div className="p-3 space-y-2 max-h-[300px] overflow-y-auto">
                  {sim.diagnosis_options?.map((option: string, i: number) => (
                    <button 
                      key={i} 
                      onClick={() => handleGuess(option)}
                      className="w-full text-left text-sm md:text-base font-medium p-3 md:p-4 rounded-lg bg-slate-700 hover:bg-green-600 hover:text-white transition-all duration-200 border border-slate-600 hover:border-green-500"
                    >
                      {option}
                    </button>
                  ))}
                </div>
             </Card>
           </div>
        </div>
      </div>

      {/* WATERMARK FIXED */}
      <div className="fixed bottom-4 right-4 z-50 animate-in fade-in slide-in-from-bottom-4 duration-1000">
         <div className="bg-white/90 backdrop-blur-md border border-slate-200 shadow-xl rounded-full px-4 py-2 flex items-center gap-2 transition-transform hover:scale-105 cursor-default">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
            <span className="text-[10px] md:text-xs font-bold text-slate-500 tracking-wide">
              HOSPITAL OS v1.0 • <span className="text-blue-600">Dev by Farrel</span>
            </span>
         </div>
      </div>

    </div>
  );
}