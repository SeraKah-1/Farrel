'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Stethoscope, ShieldAlert, BrainCircuit, Play } from 'lucide-react';
import { useEffect } from 'react';

export default function Home() {
  
  // --- FITUR RAHASIA: CONSOLE LOG WARNING ---
  useEffect(() => {
    console.clear();
    console.log(
      "%c🛑 STOP! JANGAN DICURI! 🛑", 
      "color: red; font-size: 30px; font-weight: bold; text-shadow: 2px 2px black;"
    );
    console.log(
      "%cWebsite ini dikembangkan oleh FARREL.\nHak cipta dilindungi undang-undang coding sedunia.\nJika ingin belajar, silakan kontak developernya.", 
      "color: blue; font-size: 16px; font-family: monospace;"
    );
    console.log(
      "%cGitHub: https://github.com/SeraKah-1", 
      "color: black; font-size: 14px; font-weight: bold; text-decoration: underline;"
    );
  }, []);
  // ------------------------------------------

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white flex items-center justify-center p-4">
      <div className="max-w-3xl w-full text-center space-y-8 animate-in fade-in zoom-in duration-700">
        
        {/* Hero Section */}
        <div className="space-y-4">
          <div className="bg-blue-100 p-4 rounded-full w-20 h-20 mx-auto flex items-center justify-center mb-6 shadow-lg">
            <Stethoscope size={40} className="text-blue-600" />
          </div>
          <h1 className="text-5xl font-black text-slate-900 tracking-tight">
            Medical <span className="text-blue-600">Detective</span>
          </h1>
          <p className="text-xl text-slate-600 max-w-lg mx-auto leading-relaxed">
            Uji kemampuan medismu. Analisis gejala, periksa lab, dan selamatkan nyawa pasien sebelum waktu habis.
          </p>
        </div>

        {/* Feature Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-left">
          <Card className="border-blue-100 shadow-sm hover:shadow-md transition-all bg-white/50 backdrop-blur">
            <CardHeader className="pb-2">
              <BrainCircuit className="text-purple-500 mb-2" />
              <CardTitle className="text-base">AI Generated</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>Kasus penyakit tanpa batas dibuat otomatis oleh AI.</CardDescription>
            </CardContent>
          </Card>
          
          <Card className="border-blue-100 shadow-sm hover:shadow-md transition-all bg-white/50 backdrop-blur">
            <CardHeader className="pb-2">
              <ShieldAlert className="text-red-500 mb-2" />
              <CardTitle className="text-base">Critical Mode</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>Salah diagnosa? Nyawa pasien taruhannya.</CardDescription>
            </CardContent>
          </Card>

          <Card className="border-blue-100 shadow-sm hover:shadow-md transition-all bg-white/50 backdrop-blur">
            <CardHeader className="pb-2">
              <Stethoscope className="text-green-500 mb-2" />
              <CardTitle className="text-base">Real Simulation</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>Cek tanda vital dan lab layaknya dokter sungguhan.</CardDescription>
            </CardContent>
          </Card>
        </div>

        {/* Call to Action */}
        <div className="pt-8">
          <Link href="/play">
            <Button size="lg" className="h-14 px-8 text-lg font-bold shadow-xl shadow-blue-200 hover:shadow-blue-300 transition-all hover:-translate-y-1">
              <Play className="mr-2 fill-current" /> MULAI PRAKTEK
            </Button>
          </Link>
          <p className="text-xs text-slate-400 mt-4">v1.0.0 (Detective Update) • Created by Farrel</p>
        </div>

      </div>
    </div>
  );
}
