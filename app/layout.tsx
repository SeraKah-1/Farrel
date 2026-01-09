import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css"; // Pastikan baris ini ada!
import { Toaster } from "sonner";
import { Navbar } from "@/components/ui/navbar"; // Import Navbar yang baru dibuat

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Medical Detective Game",
  description: "Simulasi diagnosa medis berbasis AI buatan Farrel",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id">
      <body className={`${inter.className} min-h-screen flex flex-col bg-slate-50 text-slate-900`}>
        
        {/* 1. Pasang Navbar di paling atas */}
        <Navbar />

        {/* 2. Konten Utama */}
        <main className="flex-1 flex flex-col">
          {children}
        </main>
        
        {/* 3. Notifikasi */}
        <Toaster richColors position="top-center" />

        {/* 4. Footer Copyright */}
        <footer className="py-6 border-t border-slate-200 bg-white mt-auto">
          <div className="container mx-auto px-4 text-center">
            <p className="text-sm text-slate-500">
              &copy; {new Date().getFullYear()} <span className="font-bold text-slate-800">Medical Detective</span>. 
              All rights reserved.
            </p>
            <p className="text-xs text-slate-400 mt-1">
              Created by <a href="https://github.com/SeraKah-1" target="_blank" className="text-blue-600 hover:underline font-bold">Farrel</a>
            </p>
          </div>
        </footer>

      </body>
    </html>
  );
}
