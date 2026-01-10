import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner"; // Pastikan path ini benar, atau hapus baris ini jika merah

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Medical Detective",
  description: "Uji kemampuan medismu dalam simulasi kasus penyakit nyata.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={inter.className}>
        {children}
        <Toaster />
      </body>
    </html>
  );
}