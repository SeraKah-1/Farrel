'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Trash2, Edit, Plus, PlayCircle } from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import Link from 'next/link'; // Import Link buat tombol Play

export default function AdminDashboard() {
  const [cards, setCards] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // State untuk Generate Baru
  const [topic, setTopic] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [openDialog, setOpenDialog] = useState(false);

  // 1. Ambil data saat halaman dibuka
  useEffect(() => {
    fetchCards();
  }, []);

  async function fetchCards() {
    setLoading(true);
    const { data, error } = await supabase
      .from('disease_cards')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) toast.error('Gagal ambil data');
    else setCards(data || []);
    setLoading(false);
  }

  // 2. Fungsi Hapus Kartu
  async function handleDelete(id: string) {
    if (!confirm('Yakin mau hapus kartu ini?')) return;
    
    const { error } = await supabase.from('disease_cards').delete().eq('id', id);
    if (error) {
      toast.error('Gagal menghapus');
    } else {
      toast.success('Kartu dihapus');
      fetchCards(); // Refresh list
    }
  }

  // 3. Fungsi Generate Baru
  async function handleGenerate() {
    if (!topic) return;
    setIsGenerating(true);
    toast.info("AI sedang bekerja...");

    try {
      const res = await fetch('/api/generate-card', {
        method: 'POST',
        body: JSON.stringify({ topic }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      toast.success("Kartu baru jadi!");
      setOpenDialog(false); // Tutup popup
      setTopic('');         // Reset input
      fetchCards();         // Refresh list otomatis
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setIsGenerating(false);
    }
  }

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-8">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Admin Dashboard</h1>
          <p className="text-slate-500">Kelola database penyakit dan skenario game.</p>
        </div>

        {/* Tombol + Popup Generate Baru */}
        <Dialog open={openDialog} onOpenChange={setOpenDialog}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus size={16} /> Generate Kasus Baru
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Minta AI Buat Kasus</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Topik / Nama Penyakit</label>
                <Input 
                  placeholder="Misal: Gagal Jantung Kongestif" 
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                />
              </div>
              <Button onClick={handleGenerate} disabled={isGenerating} className="w-full">
                {isGenerating ? 'Sedang Berpikir...' : 'Generate Sekarang'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Grid Daftar Kartu */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading ? (
          <p>Loading data...</p>
        ) : cards.length === 0 ? (
          <p className="text-slate-500 col-span-3 text-center py-10">Belum ada kartu. Klik Generate dulu!</p>
        ) : (
          cards.map((card) => (
            <Card key={card.id} className="group hover:border-slate-400 transition-all">
              <CardHeader className="pb-3">
                <div className="flex justify-between items-start">
                  <Badge variant={card.status === 'published' ? 'default' : 'secondary'}>
                    {card.status}
                  </Badge>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500" onClick={() => handleDelete(card.id)}>
                      <Trash2 size={14} />
                    </Button>
                  </div>
                </div>
                <CardTitle className="text-lg leading-tight mt-2">{card.title}</CardTitle>
                <CardDescription>{card.category} • {card.difficulty}</CardDescription>
              </CardHeader>
              
              <CardContent>
                <div className="text-xs text-slate-500 line-clamp-3 mb-4 bg-slate-50 p-2 rounded">
                  {card.content?.simulation?.chief_complaint_pool?.[0] || "No preview"}...
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" className="w-full text-xs" disabled>
                    <Edit size={12} className="mr-2" /> Edit (Soon)
                  </Button>
                  
                  {/* Tombol Play yang sudah diperbaiki */}
                  <Link href={`/play/${card.id}`}>
                    <Button size="icon" variant="secondary" className="shrink-0">
                      <PlayCircle size={16} />
                    </Button>
                  </Link>

                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}