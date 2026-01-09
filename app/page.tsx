import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Stethoscope, ShieldPlus } from 'lucide-react';

export default function Home() {
  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-center p-4">
      
      {/* Logo / Judul */}
      <div className="space-y-4 mb-10 animate-in fade-in slide-in-from-bottom-4 duration-1000">
        <div className="bg-blue-600 w-20 h-20 rounded-2xl flex items-center justify-center mx-auto shadow-2xl shadow-blue-900">
          <Stethoscope className="text-white w-10 h-10" />
        </div>
        <h1 className="text-4xl md:text-6xl font-extrabold text-white tracking-tight">
          MEDS <span className="text-blue-500">GAME</span>
        </h1>
        <p className="text-slate-400 text-lg max-w-md mx-auto">
          Simulasi diagnosa medis bertenaga AI.
          Jadilah dokter virtual dan selamatkan nyawa pasien.
        </p>
      </div>

      {/* Menu Tombol */}
      <div className="flex flex-col sm:flex-row gap-4 w-full max-w-sm">
        <Link href="/play" className="w-full">
          <Button size="lg" className="w-full h-14 text-lg font-bold bg-blue-600 hover:bg-blue-500 shadow-lg shadow-blue-900/20">
            Mulai Praktek
          </Button>
        </Link>
        
        <Link href="/admin" className="w-full">
          <Button size="lg" variant="outline" className="w-full h-14 text-lg border-slate-700 text-slate-200 hover:bg-slate-800 hover:text-white">
            <ShieldPlus className="mr-2 w-5 h-5" /> Mode Admin
          </Button>
        </Link>
      </div>

      <p className="fixed bottom-8 text-slate-600 text-sm">
        Dibuat dengan Next.js + AI + Supabase
      </p>
    </div>
  );
}