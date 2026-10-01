import express from 'express';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

const app = express();
const port = 3000;

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Initialize Gemini Client
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

// AI Exam Parsing Endpoint (Supports both raw text and images/screenshots of exams)
app.post('/api/ai/parse-exam', async (req, res) => {
  try {
    const { text, image, mimeType = 'image/png', documentTitle } = req.body;

    if ((!text || typeof text !== 'string' || text.trim().length === 0) && !image) {
      return res.status(400).json({ error: "Matn yoki rasm taqdim etilmadi" });
    }

    const promptText = `Siz O'zbekiston ixtisoslashtirilgan maktablari (Prezident, ijod va ixtisoslashtirilgan maktablar) uchun BSB (Baholash sinovlari) va ChSB (Choraklik sinov baholash) bo'yicha bosh ekspert va metodistsiz.

Vazifangiz: Berilgan imtihon materialidan (matn yoki rasm/skrinshot) barcha savollarni, topshiriqlarni va mezonlarni o'qib, o'quvchilar kompyuterda topshirishi mumkin bo'lgan toza, aniq strukturalangan JSON formatiga o'tkazish.

${documentTitle ? `Hujjat nomi: ${documentTitle}\n` : ''}
${text ? `Hujjat matni:\n"""\n${text}\n"""\n` : ''}

Savol turlari (type):
- "multiple_choice": Test savoli (A, B, C, D variantlari mavjud bo'lsa)
- "fill_blank": Bo'sh o'rinlarni yoki chiziqlar o'rnini to'ldirish (masalan: "Iste’mol qilinadigan oziq-ovqat mahsulotlari _____ ni tashkil etadi")
- "true_false": To'g'ri yoki noto'g'ri (Tasdiq to'g'rimi yoki noto'g'ri?)
- "matching": Moslashtirish / muvofiqlashtirish savoli (masalan, 1-A, 2-B)
- "written": Ochiq yoki yozma savol, rasm tahlili, fikr bildirish, masala yechimi yoki jadval tahlili

Har bir savol uchun quyidagi JSON sxemasida massiv qaytaring:
[
  {
    "questionNumber": 1,
    "text": "Savol matni to'liq va tushunarli. Agar bir nechta qism bo'lsa (a, b, c), hammasini aniq yozing.",
    "type": "fill_blank" | "multiple_choice" | "true_false" | "matching" | "written",
    "points": 5,
    "options": ["A) Variant 1", "B) Variant 2", "C) Variant 3", "D) Variant 4"], // faqat multiple_choice uchun
    "correctAnswer": "To'g'ri javob yoki namunaviy kalit",
    "matchingPairs": [ // faqat matching turi uchun
      { "id": "p1", "left": "Birinchi element", "right": "Mos keluvchi javob" }
    ],
    "explanation": "Baholash mezoni yoki o'qituvchi uchun izoh",
    "difficulty": "easy" | "medium" | "hard"
  }
]

Qoidalar:
1. Agar materialda 5 ta savol bo'lsa, massivda aynan 5 ta element bo'lsin.
2. Savollarning ballari (points) hujjatda ko'rsatilgan ballarga muvofiq bo'lsin (odatda BSB jami 25 yoki 30 ball bo'ladi).
3. Faqat yaroqli toza JSON massiv qaytaring (hech qanday markdown kod bloklari yoki tushuntirishsiz).`;

    let contentsPayload: any;

    if (image) {
      // Base64 image provided
      const cleanBase64 = image.includes('base64,') ? image.split('base64,')[1] : image;
      contentsPayload = {
        parts: [
          {
            inlineData: {
              mimeType: mimeType || 'image/png',
              data: cleanBase64,
            },
          },
          {
            text: promptText,
          },
        ],
      };
    } else {
      contentsPayload = promptText;
    }

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: contentsPayload,
      config: {
        systemInstruction: "You are an expert curriculum examiner for Uzbek schools (BSB and ChSB specialist). Output exclusively valid JSON without markdown wrapping or conversational text.",
        responseMimeType: 'application/json',
      },
    });

    const outputText = response.text || '[]';
    let parsedQuestions = [];
    try {
      parsedQuestions = JSON.parse(outputText.trim());
    } catch (e) {
      console.error("JSON parse error from Gemini response:", e);
      const cleaned = outputText.replace(/```json\s*|```/g, '').trim();
      parsedQuestions = JSON.parse(cleaned);
    }

    return res.json({
      success: true,
      questions: parsedQuestions,
      total: Array.isArray(parsedQuestions) ? parsedQuestions.length : 0,
    });
  } catch (error: any) {
    console.error("Gemini parse error:", error);
    return res.status(500).json({
      error: "AI orqali tahlil qilishda xatolik yuz berdi: " + (error?.message || String(error)),
    });
  }
});

async function startServer() {
  if (process.env.NODE_ENV === 'production') {
    // Serve static files in production
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
  } else {
    // Mount Vite middlewares in development
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(port, '0.0.0.0', () => {
    console.log(`Server running at http://localhost:${port}`);
  });
}

startServer();
