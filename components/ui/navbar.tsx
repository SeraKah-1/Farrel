'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Stethoscope, Home, LayoutGrid, Plus } from 'lucide-react';

export function Navbar() {
  const pathname = usePathname();

  return (
    <nav className="bg-white border-b border-slate-200 px-4 md:px-6 py-3 flex items-center justify-between sticky top-0 z-50 shadow-sm">
      {/* Logo Kiri */}
      <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition">
        <div className="bg-blue-600 text-white p-1.5 rounded-lg shadow-sm">
          <Stethoscope size={20} />
        </div>
        <span className="font-bold text-slate-800 text-lg hidden sm:block">Medical Detective</span>
      </Link>

      {/* Menu Kanan */}
      <div className="flex gap-2 md:gap-3">
        <Link href="/">
          <Button variant={pathname === "/" ? "secondary" : "ghost"} size="sm" className="gap-2">
            <Home className="w-4 h-4" />
            <span className="hidden sm:inline">Home</span>
          </Button>
        </Link>
        
        <Link href="/play">
          <Button variant={pathname.startsWith("/play") ? "default" : "ghost"} size="sm" className="gap-2">
            <LayoutGrid className="w-4 h-4" />
            <span className="hidden sm:inline">Lobby Kasus</span>
          </Button>
        </Link>
      </div>
    </nav>
  );
}
