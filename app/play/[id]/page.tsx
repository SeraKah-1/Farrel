'use client';

import { useEffect, useState, use } from 'react';
// Pastikan path import ini sesuai struktur folder kamu
import { createClient } from '@/utils/supabase/client'; 
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Activity, Thermometer, TestTube, MessageCircle, HeartPulse, Stethoscope, BookOpen, AlertCircle, CheckCircle, Volume2 } from 'lucide-react';
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
      // Simulasi delay sedikit biar Skeleton kelihatan
      await new Promise(r => setTimeout(r, 1000)); 
      
      const { data } = await supabase.from('disease_cards').select('*').eq('id', id).single();
      
      if (data) {
        // --- ⚡ FITUR ADAPTER: UBAH DATA BARU JADI FORMAT LAMA ⚡ ---
        let normalizedContent;

        if (data.scenario) {
          // KASUS BARU (Data ada di kolom 'scenario')
          normalizedContent = {
            simulation: {
              // Gunakan history pasien sebagai keluhan utama
              chief_complaint: data.scenario.patient.history,
              diagnosis_answer: data.correct_diagnosis,
              
              // Konversi Gejala menjadi "Wawancara"
              interview_questions: data.scenario.symptoms?.map((s: string, idx: number) => ({
                question: `Tanya gejala klinis #${idx + 1}`,
                answer: s,
                is_relevant: true
              })) || [],

              // Konversi Lab Results agar masuk ke slot Lab (karena AI baru menggabung vitals & lab)
              lab_abnormalities: data.scenario.lab_results?.map((res: string) => ({
                name: "Hasil Pemeriksaan",
                value: res
              })) || [],

              // Dummy Vitals (Karena AI baru sering menggabungnya di Lab)
              // Kita set default agar tidak crash
              vital_signs: {
                systolic: 120, diastolic: 80, heart_rate: 80, temperature: 36.5, resp_rate: 18
              },

              diagnosis_options: data.scenario.options
            },
            wiki: {
              definition: data.scenario.explanation,
              clinical_signs: data.scenario.symptoms,
              treatment_guideline: "Lakukan penanganan sesuai prosedur medis standar."
            }
          };
        } else {
          // KASUS LAMA (Data ada di kolom 'content' lama)
          // Cek apakah content string atau object
          normalizedContent = typeof data.content === 'string' 
            ? JSON.parse(data.content) 
            : data.content;
        }

        const gameData = { ...data, content: normalizedContent };
        setCard(gameData);
        
        setLogs([{ 
          sender: 'System', 
          text: `PASIEN BARU MASUK. Riwayat: "${gameData.content.simulation.chief_complaint}"`, 
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
      playFlatline?.(); 
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
    playClick?.();
    if (!consumeEnergy(COSTS.ASK)) return;

    setAskedQuestions(prev => [...prev, index]);
    addLog('Dokter', q.question, 'chat');
    
    setTimeout(() => {
      if (q.is_relevant) {
        addLog('Pasien', q.answer, 'chat');
      } else {
        addLog('Pasien', `${q.answer} (Pasien tampak bingung)`, 'chat');
        toast.warning("Pertanyaan kurang relevan.");
      }
    }, 600);
  };

  const revealData = (type: 'vitals' | 'labs') => {
    if (gameState !== 'playing') return;
    playClick?.();
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
      playCorrect?.();
      setGameState('won');
      addLog('System', `🏆 DIAGNOSA TEPAT! (${correctAnswer}). Pasien selamat.`, 'success');
      toast.success("SEMPURNA! Pasien Selamat.");
    } else {
      playWrong?.();
      const penalty = 50;
      toast.error("DIAGNOSA SALAH!");
      addLog('System', `❌ SALAH! Bukan ${option}. Kondisi pasien kritis! (-${penalty} Energi)`, 'alert');
      
      if (energy - penalty <= 0) {
        playFlatline?.();
        setEnergy(0);
        setGameState('lost');
        addLog('System', 'Pasien meninggal karena salah penanganan.', 'alert');
      } else {
        setEnergy(prev => prev - penalty);
      }
    }
  };

  // --- TAMPILAN SKELETON (LOADING) ---
  if (loading) {
    return (
      <div className="max-w-6xl mx-auto p-4 font-sans h-[calc(100vh-2rem)] flex flex-col md:flex-row gap-4">
        <div className="flex-1 flex flex-col gap-4 h-full">
          <Skeleton className="h-24 w-full rounded-xl" />
          <Skeleton className="flex-1 w-full rounded-xl" />
        </div>
        <div className="w-full md:w-[400px] flex flex-col gap-3">
          <Skeleton className="h-40 w-full rounded-xl" />
          <Skeleton className="h-32 w-full rounded-xl" />
          <Skeleton className="h-32 w-full rounded-xl" />
          <Skeleton className="h-48 w-full rounded-xl mt-auto" />
        </div>
      </div>
    );
  }
  
  if (!card) return <div className="text-center p-10">Data Kasus Tidak Ditemukan</div>;

  const sim = card.content.simulation;
  const wiki = card.content.wiki;

  return (
    <div className="max-w-6xl mx-auto p-4 font-sans min-h-[calc(100vh-2rem)] flex flex-col md:flex-row gap-4">
      
      {/* --- PANEL KIRI (Log & Edukasi) --- */}
      <div className="flex-1 flex flex-col gap-4 h-full">
        {/* Energy Bar */}
        <Card className="bg-slate-900 text-white border-none shadow-xl shrink-0">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-full ${energy < 30 ? 'bg-red-600 animate-pulse' : 'bg-blue-600'}`}>
                <HeartPulse size={24} className="text-white" />
              </div>
              <div>
                <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Stamina Dokter</p>
                <div className="w-full md:w-64 h-3 bg-slate-800 rounded-full mt-1 overflow-hidden">
                  <div 
                    className={`h-full transition-all duration-700 ease-out ${energy < 30 ? 'bg-red-500' : energy < 60 ? 'bg-amber-400' : 'bg-green-500'}`} 
                    style={{ width: `${energy}%` }}
                  />
                </div>
              </div>
            </div>
            <div className="text-right">
              <span className="text-3xl font-black">{energy}</span>
              <span className="text-sm text-slate-500">/100 AP</span>
            </div>
          </CardContent>
        </Card>

        {/* LOG GAMEPLAY */}
        <Card className={`bg-slate-50 border-slate-200 overflow-hidden flex flex-col shadow-inner transition-all duration-500 ${gameState !== 'playing' ? 'h-[300px]' : 'flex-1'}`}>
          <CardHeader className="py-3 px-4 bg-white border-b flex flex-row items-center gap-2">
            <Activity size={16} className="text-slate-400"/> 
            <span className="text-sm font-bold text-slate-600">Rekam Medis & Observasi</span>
          </CardHeader>
          <div id="chat-container" className="flex-1 overflow-y-auto p-4 space-y-3 scroll-smooth">
            {logs.map((log, i) => (
              <div key={i} className={`flex flex-col max-w-[90%] ${log.sender === 'Dokter' ? 'ml-auto items-end' : 'items-start'}`}>
                {log.sender !== 'System' && (
                  <span className="text-[10px] font-bold text-slate-400 mb-1 px-1">{log.sender}</span>
                )}
                <div className={`px-4 py-2 rounded-2xl text-sm shadow-sm ${
                  log.sender === 'Dokter' ? 'bg-blue-600 text-white rounded-tr-none' : 
                  log.sender === 'System' ? 'w-full max-w-full text-center bg-slate-200 text-slate-600 rounded-lg text-xs font-mono py-1' :
                  log.type === 'alert' ? 'bg-red-100 text-red-800 border border-red-200' :
                  log.type === 'success' ? 'bg-green-100 text-green-800 border border-green-200 font-bold' :
                  'bg-white text-slate-800 border border-slate-100 rounded-tl-none'
                }`}>
                  {log.text}
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* 🔥 FITUR EDUKASI (Hanya Muncul Saat Game Selesai) */}
        {gameState !== 'playing' && (
          <Card className="border-blue-200 shadow-xl border-t-4 border-t-blue-500 animate-in slide-in-from-bottom-10 fade-in duration-700">
            <CardHeader className="pb-2 bg-blue-50/50">
               <CardTitle className="flex items-center gap-2 text-blue-900">
                 <BookOpen className="w-5 h-5"/> Laporan Medis & Pembahasan
               </CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              <div className="flex items-start gap-4">
                <div className="bg-slate-100 p-3 rounded-lg min-w-[120px] text-center">
                   <p className="text-xs text-slate-500 uppercase font-bold">Diagnosa Benar</p>
                   <p className="text-lg font-black text-blue-600 leading-tight mt-1">{sim.diagnosis_answer}</p>
                </div>
                <div>
                   <p className="text-sm text-slate-700 font-medium leading-relaxed">
                     <span className="font-bold text-slate-900">Penjelasan:</span> {wiki.definition}
                   </p>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                   <h4 className="text-xs font-bold text-slate-400 uppercase flex items-center gap-1"><AlertCircle size={12}/> Gejala Klinis</h4>
                   <ul className="text-sm text-slate-700 list-disc list-inside bg-slate-50 p-2 rounded">
                     {wiki.clinical_signs?.map((s: string, i: number) => <li key={i}>{s}</li>)}
                   </ul>
                </div>
                <div className="space-y-1">
                   <h4 className="text-xs font-bold text-slate-400 uppercase flex items-center gap-1"><CheckCircle size={12}/> Penanganan</h4>
                   <p className="text-sm text-slate-700 bg-green-50 p-2 rounded border border-green-100">
                     {wiki.treatment_guideline}
                   </p>
                </div>
              </div>
            </CardContent>
            <CardFooter className="bg-slate-50 pt-4">
               <Button className="w-full h-12 text-lg font-bold" onClick={() => router.push('/')}>
                 Kembali ke Lobby 👉
               </Button>
            </CardFooter>
          </Card>
        )}
      </div>

      {/* --- PANEL KANAN (Actions) --- */}
      <div className="w-full md:w-[400px] flex flex-col gap-3 h-full overflow-y-auto pr-1">
        
        {/* WAWANCARA */}
        <Card className={`border-l-4 border-l-blue-500 transition-all duration-500 ${gameState !== 'playing' ? 'opacity-40 pointer-events-none grayscale' : ''}`}>
          <CardHeader className="py-2 px-4 bg-blue-50/50">
            <CardTitle className="text-sm text-blue-800 flex justify-between items-center">
              <span className="flex items-center gap-2"><MessageCircle size={16}/> Wawancara</span>
              <span className="text-xs bg-blue-200 px-2 py-0.5 rounded text-blue-800">-{COSTS.ASK} AP</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3 space-y-2">
            {sim.interview_questions?.map((q: any, i: number) => (
              <Button 
                key={i} 
                variant="outline" 
                size="sm"
                className={`w-full justify-start h-auto py-2 text-xs text-left whitespace-normal ${askedQuestions.includes(i) ? 'bg-slate-100 text-slate-400 line-through' : 'hover:border-blue-500 hover:bg-blue-50'}`}
                onClick={() => handleAsk(i, q)}
                disabled={askedQuestions.includes(i)}
              >
                {q.question}
              </Button>
            ))}
          </CardContent>
        </Card>

        {/* PERIKSA FISIK */}
        <Card className={`border-l-4 border-l-amber-500 transition-all duration-500 ${gameState !== 'playing' ? 'opacity-40 pointer-events-none grayscale' : ''}`}>
          <CardHeader className="py-2 px-4 bg-amber-50/50">
            <CardTitle className="text-sm text-amber-800 flex justify-between items-center">
              <span className="flex items-center gap-2"><Thermometer size={16}/> Tanda Vital</span>
              <span className="text-xs bg-amber-200 px-2 py-0.5 rounded text-amber-800">-{COSTS.VITALS} AP</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3">
            {!dataRevealed.vitals ? (
              <Button className="w-full bg-amber-600 hover:bg-amber-700 text-white" onClick={() => revealData('vitals')}>
                Lakukan Pemeriksaan
              </Button>
            ) : (
              <div className="grid grid-cols-2 gap-2 text-sm bg-amber-50 p-2 rounded border border-amber-200">
                <div><span className="text-slate-500 text-xs">Tensi</span><br/><b>{sim.vital_signs.systolic}/{sim.vital_signs.diastolic}</b></div>
                <div><span className="text-slate-500 text-xs">Nadi</span><br/><b>{sim.vital_signs.heart_rate} bpm</b></div>
                <div><span className="text-slate-500 text-xs">Suhu</span><br/><b>{sim.vital_signs.temperature}°C</b></div>
                <div><span className="text-slate-500 text-xs">Napas</span><br/><b>{sim.vital_signs.resp_rate} x/m</b></div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* LAB */}
        <Card className={`border-l-4 border-l-purple-500 transition-all duration-500 ${gameState !== 'playing' ? 'opacity-40 pointer-events-none grayscale' : ''}`}>
          <CardHeader className="py-2 px-4 bg-purple-50/50">
            <CardTitle className="text-sm text-purple-800 flex justify-between items-center">
              <span className="flex items-center gap-2"><TestTube size={16}/> Laboratorium</span>
              <span className="text-xs bg-purple-200 px-2 py-0.5 rounded text-purple-800">-{COSTS.LABS} AP</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3">
            {!dataRevealed.labs ? (
              <Button className="w-full bg-purple-600 hover:bg-purple-700 text-white" onClick={() => revealData('labs')}>
                Ambil Sampel Darah
              </Button>
            ) : (
              <div className="bg-purple-50 p-2 rounded border border-purple-200 text-xs space-y-2">
                <p className="font-bold text-purple-900 border-b border-purple-200 pb-1">HASIL PEMERIKSAAN:</p>
                {sim.lab_abnormalities?.length > 0 ? sim.lab_abnormalities.map((lab: any, i: number) => (
                  <div key={i} className="flex justify-between items-center">
                    <span>{lab.name}</span>
                    <span className="font-bold text-red-600 bg-red-50 px-1 rounded">{lab.value}</span>
                  </div>
                )) : <p className="text-slate-500 italic">Tidak ditemukan kelainan spesifik.</p>}
              </div>
            )}
          </CardContent>
        </Card>

        {/* DIAGNOSA */}
        <Card className={`border-l-4 border-l-slate-800 bg-slate-50 shadow-md mt-auto transition-all duration-500 ${gameState !== 'playing' ? 'opacity-40 pointer-events-none grayscale' : ''}`}>
          <CardHeader className="py-2 px-4 bg-slate-800 text-white">
            <CardTitle className="text-sm flex items-center gap-2">
              <Stethoscope size={16}/> Tentukan Diagnosa
            </CardTitle>
          </CardHeader>
          <CardContent className="p-2 space-y-2">
             {sim.diagnosis_options?.map((option: string, i: number) => (
              <Button 
                key={i} 
                variant="secondary" 
                className="w-full justify-start text-xs h-auto py-3 whitespace-normal bg-white border border-slate-200 hover:bg-slate-800 hover:text-white transition-colors"
                onClick={() => handleGuess(option)}
              >
                {option}
              </Button>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}