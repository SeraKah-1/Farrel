import { z } from 'zod';

// 1. Schema Materi Belajar (Wiki) - Tetap
export const EducationSchema = z.object({
  definition: z.string().describe("Definisi singkat penyakit"),
  etiology: z.string().describe("Penyebab utama"),
  clinical_signs: z.array(z.string()).describe("Daftar 3-5 tanda klinis utama"),
  pathophysiology_summary: z.string().describe("Ringkasan patofisiologi"),
  treatment_guideline: z.string().describe("Prinsip penatalaksanaan"),
});

// 2. Schema Game Logic (BARU: Mode Detektif)
export const SimulationSchema = z.object({
  chief_complaint: z.string().describe("Keluhan utama pasien saat datang (1 kalimat)"),
  
  // Dialog Pilihan Ganda
  interview_questions: z.array(z.object({
    question: z.string().describe("Pertanyaan yang bisa dipilih dokter"),
    answer: z.string().describe("Jawaban pasien"),
    is_relevant: z.boolean().describe("True jika pertanyaan ini mengarah ke diagnosa, False jika basa-basi/menjebak"),
  })).describe("Buat 6 pertanyaan: 3 sangat relevan (poin penting), 3 pengecoh (tidak relevan)"),

  // Data Fisik Pasti (Bukan Range lagi, biar gampang ditampilkan)
  vital_signs: z.object({
    systolic: z.number(),
    diastolic: z.number(),
    heart_rate: z.number(),
    temperature: z.number(),
    resp_rate: z.number(),
  }),

  // Hasil Lab (Hanya yang abnormal/kunci)
  lab_abnormalities: z.array(z.object({
    name: z.string().describe("Nama parameter (misal: Leukosit)"),
    value: z.string().describe("Nilai & Satuan (misal: 25.000 /uL)"),
    interpretation: z.string().describe("Interpretasi singkat (misal: Tinggi)"),
  })).describe("List 3-4 hasil lab yang TIDAK NORMAL saja"),

  diagnosis_answer: z.string().describe("Kunci jawaban diagnosa yang benar"),
  
  // Pilihan Ganda Diagnosa
  diagnosis_options: z.array(z.string()).describe("4 Pilihan Diagnosa (1 Benar, 3 Salah tapi mirip gejalanya)"),
});

export const DiseaseCardContentSchema = z.object({
  wiki: EducationSchema,
  simulation: SimulationSchema,
});