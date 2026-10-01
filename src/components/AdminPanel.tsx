import React, { useState, useEffect } from 'react';
import {
  Activity,
  FileSpreadsheet,
  Upload,
  BookOpen,
  Settings,
  Plus,
  Trash2,
  Edit,
  Clock,
  CheckCircle,
  AlertTriangle,
  XCircle,
  Search,
  Filter,
  ArrowUpDown,
  Download,
  Image as ImageIcon,
  Save,
  Check,
  ShieldAlert,
  UserX,
  FileText,
  Sparkles,
  HelpCircle,
  Lock,
} from 'lucide-react';
import { Test, Question, ExamSession, Submission, TestType, MatchingPair } from '../types';
import { parseDocxFile, parseFromHtmlAndText } from '../utils/wordParser';
import { parsePdfFile } from '../utils/pdfParser';
import { exportSubmissionsToExcel } from '../utils/excelExport';
import { ToastContainer, ConfirmModal, ToastMessage, ToastType } from './Toast';
import {
  saveTest,
  deleteTest,
  getQuestionsForTest,
  saveQuestionsBatch,
  updateExamSession,
  subscribeLiveSessions,
  subscribeSubmissions,
} from '../services/dbService';

interface AdminPanelProps {
  tests: Test[];
  onRefreshTests: () => void;
  onClose: () => void;
}

export const AdminPanel: React.FC<AdminPanelProps> = ({
  tests,
  onRefreshTests,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<
    'live' | 'docx' | 'questions' | 'tests' | 'analytics'
  >('live');

  // Real-time live sessions & submissions
  const [liveSessions, setLiveSessions] = useState<ExamSession[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);

  // Selected test for question editing
  const [selectedTestId, setSelectedTestId] = useState<string>(tests[0]?.id || '');
  const [testQuestions, setTestQuestions] = useState<Question[]>([]);
  const [isLoadingQuestions, setIsLoadingQuestions] = useState(false);

  // New/Edit Question Modal
  const [editingQuestion, setEditingQuestion] = useState<Partial<Question> | null>(null);

  // New/Edit Test Modal
  const [editingTest, setEditingTest] = useState<Partial<Test> | null>(null);

  // Word docx upload state
  const [isParsingDocx, setIsParsingDocx] = useState(false);
  const [parsedDocxQuestions, setParsedDocxQuestions] = useState<Omit<Question, 'id' | 'testId'>[]>([]);
  const [targetTestForDocx, setTargetTestForDocx] = useState<string>(tests[0]?.id || '');
  const [docxSuccessMsg, setDocxSuccessMsg] = useState('');

  // Analytics filter & sorting
  const [analyticsSearch, setAnalyticsSearch] = useState('');
  const [analyticsGradeFilter, setAnalyticsGradeFilter] = useState<string>('all');
  const [analyticsGroupFilter, setAnalyticsGroupFilter] = useState<string>('all');
  const [analyticsTypeFilter, setAnalyticsTypeFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'name' | 'grade' | 'score' | 'percentage' | 'warnings' | 'date'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [uploadMethod, setUploadMethod] = useState<'file' | 'text'>('file');

  // Modern In-App Toast & Confirmation System (replaces window.alert & window.confirm)
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const showToast = (type: ToastType, title: string, message?: string) => {
    const id = `toast_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    setToasts((prev) => [...prev, { id, type, title, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4500);
  };
  const dismissToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    confirmText?: string;
    isDestructive?: boolean;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
  });

  // Subscribe to live sessions & submissions
  useEffect(() => {
    const unsubLive = subscribeLiveSessions((sessions) => {
      setLiveSessions(sessions);
    });
    const unsubSubs = subscribeSubmissions((subs) => {
      setSubmissions(subs);
    });

    return () => {
      unsubLive();
      unsubSubs();
    };
  }, []);

  // Load questions when selectedTestId changes
  useEffect(() => {
    if (selectedTestId) {
      setIsLoadingQuestions(true);
      getQuestionsForTest(selectedTestId)
        .then((qs) => setTestQuestions(qs))
        .finally(() => setIsLoadingQuestions(false));
    }
  }, [selectedTestId]);

  // Document Upload Mode: 'ai' | 'standard'
  const [parseMode, setParseMode] = useState<'ai' | 'standard'>('ai');
  const [pastedExamText, setPastedExamText] = useState('');

  // Handle docx, pdf, and image file upload
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsParsingDocx(true);
    setDocxSuccessMsg('');
    try {
      // 1. Direct Image upload (Screenshots, scanned paper tests, diagrams)
      if (file.type.startsWith('image/')) {
        setDocxSuccessMsg("Gemini 3.8 Flash AI test rasm/skrinshotidagi barcha savollarni OCR va AI orqali o'qimoqda...");
        const reader = new FileReader();
        reader.onload = async () => {
          try {
            const base64 = reader.result as string;
            const res = await fetch('/api/ai/parse-exam', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                image: base64,
                mimeType: file.type,
                documentTitle: file.name,
              }),
            });
            const data = await res.json();
            if (data.success && Array.isArray(data.questions) && data.questions.length > 0) {
              setParsedDocxQuestions(data.questions);
              setDocxSuccessMsg(
                `✨ Gemini AI rasmdan ${data.questions.length} ta savolni (variantli, yozma va mezonlar) a'lo darajada o'qib oldi!`
              );
            } else {
              alert("Rasmdan savollarni o'qishda xatolik: " + (data.error || 'Qaytadan urinib ko\'ring'));
            }
          } catch (err: any) {
            alert("AI tahlilida xatolik: " + err.message);
          } finally {
            setIsParsingDocx(false);
          }
        };
        reader.readAsDataURL(file);
        return;
      }

      // 2. PDF or Word document
      let rawText = '';
      const isPdf = file.name.toLowerCase().endsWith('.pdf') || file.type === 'application/pdf';

      if (isPdf) {
        const res = await parsePdfFile(file);
        rawText = res.rawText || res.questions.map((q) => `${q.questionNumber}. ${q.text}\n${(q.options || []).join('\n')}\nJavob: ${q.correctAnswer}\nBall: ${q.points}`).join('\n\n');
        
        if (parseMode === 'standard') {
          setParsedDocxQuestions(res.questions);
          setDocxSuccessMsg(`PDF fayli muvaffaqiyatli tahlil qilindi! Jami ${res.totalExtracted} ta savol topildi.`);
          setIsParsingDocx(false);
          return;
        }
      } else {
        const res = await parseDocxFile(file);
        rawText = res.rawText || res.questions.map((q) => `${q.questionNumber}. ${q.text}\n${(q.options || []).join('\n')}\nJavob: ${q.correctAnswer}\nBall: ${q.points}`).join('\n\n');

        if (parseMode === 'standard') {
          setParsedDocxQuestions(res.questions);
          setDocxSuccessMsg(`Word fayli muvaffaqiyatli tahlil qilindi! Jami ${res.totalExtracted} ta savol topildi.`);
          setIsParsingDocx(false);
          return;
        }
      }

      // If AI mode is active: Send full extracted document text to Gemini 3.8 Flash
      setDocxSuccessMsg("Gemini 3.8 AI hujjatdagi murakkab savollar, jadvallar, bo'sh joylar va ballarni to'liq tahlil qilmoqda...");
      const aiResponse = await fetch('/api/ai/parse-exam', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: rawText,
          documentTitle: file.name,
        }),
      });

      const aiData = await aiResponse.json();
      if (aiData.success && Array.isArray(aiData.questions) && aiData.questions.length > 0) {
        setParsedDocxQuestions(aiData.questions);
        setDocxSuccessMsg(
          `✨ Gemini AI hujjatni a'lo darajada o'qidi! Jami ${aiData.questions.length} ta savol (jadvallar, bo'sh joylar, yozma va variantli) 100% aniqlikda tuzildi.`
        );
      } else {
        // Fallback to local parsed questions
        const fallbackRes = isPdf ? await parsePdfFile(file) : await parseDocxFile(file);
        setParsedDocxQuestions(fallbackRes.questions);
        setDocxSuccessMsg(`Hujjat tahlil qilindi! Jami ${fallbackRes.totalExtracted} ta savol topildi.`);
      }
    } catch (err: any) {
      console.error(err);
      alert("Hujjatni o'qishda xatolik yuz berdi: " + (err?.message || 'Formatni tekshiring'));
    } finally {
      setIsParsingDocx(false);
    }
  };

  // Direct Text AI Parse (when user pastes text)
  const handleDirectTextAIParse = async () => {
    if (!pastedExamText.trim()) {
      alert("Iltimos, avval savollar matnini kiriting yoki nusxalab joylashtiring!");
      return;
    }

    setIsParsingDocx(true);
    setDocxSuccessMsg("Gemini 3.8 Flash AI kiritilgan matnni chuqur tahlil qilmoqda...");
    try {
      const res = await fetch('/api/ai/parse-exam', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: pastedExamText,
          documentTitle: 'Kiritilgan test matni',
        }),
      });
      const data = await res.json();
      if (data.success && Array.isArray(data.questions) && data.questions.length > 0) {
        setParsedDocxQuestions(data.questions);
        setDocxSuccessMsg(`✨ Gemini AI matndan ${data.questions.length} ta savolni to'liq ajratib oldi!`);
      } else {
        alert("Savollarni ajratishda xatolik: " + (data.error || 'Matn formatini tekshiring'));
      }
    } catch (e: any) {
      alert("Xatolik: " + (e?.message || String(e)));
    } finally {
      setIsParsingDocx(false);
    }
  };

  // Load exact user-uploaded 6-sinf Tabiiy Fanlar 1-BSB sample (from attached PDF)
  const handleLoadExactUserBSB = () => {
    const userBSBQuestions: Omit<Question, 'id' | 'testId'>[] = [
      {
        questionNumber: 1,
        text: "Chiziqlar o'rniga mos so'zlarni yozib gapni to'ldiring.\nSo'zlar: immunitet, oziq moddalar, ratsion, vitamin, energiya, sabzavot, organizm, odamlar, oziq-ovqat.\n\n1) Iste'mol qilinadigan oziq-ovqat mahsulotlari _____ ni tashkil etadi.\n2) Turli mahsulotlar tarkibidagi _____ organizmning o'sishi va sog'lom bo'lishiga yordam beradi.\n3) Meva va _____ lar tarkibidagi _____ va minerallar _____ ni mustahkamlaydi.",
        type: 'fill_blank',
        points: 5,
        difficulty: 'medium',
        correctAnswer: "ratsion; oziq moddalar; sabzavot; vitamin; immunitet",
        explanation: "1-ratsion, 2-oziq moddalar, 3-sabzavot, vitamin, immunitet.",
      },
      {
        questionNumber: 2,
        text: "Jadvalda uch nafar o'quvchining ba'zi mahsulotlarni kun davomida iste'mol qilishi ko'rsatilgan:\n- Alisher: Meva-sabzavot (4 marta), Shirinlik (1 marta), Suv (7 stakan)\n- Lola: Meva-sabzavot (1 marta), Shirinlik (3 marta), Suv (7 stakan)\n- Ravshan: Meva-sabzavot (3 marta), Shirinlik (1 marta), Suv (5 stakan)\n\nJadval ma'lumotlaridan foydalanib, qaysi o'quvchining ovqatlanish tartibi muvozanatlashgan ratsionga mos kelishini aniqlang va javobingizni tushuntiring.",
        type: 'written',
        points: 5,
        difficulty: 'medium',
        correctAnswer: "Alisherning ovqatlanish tartibi muvozanatlashgan ratsionga eng mos keladi, chunki u meva-sabzavotlarni ko'proq (4 marta), shirinlikni kamroq (1 marta) va yetarli suv (7 stakan) ichgan.",
        explanation: "Muvozanatlashgan ratsion meva va sabzavotlar ko'pligi, shirinlik kamligi va yetarli suv ichilishini talab qiladi.",
      },
      {
        questionNumber: 3,
        text: "Sog'lom bo'lish uchun kamroq iste'mol qilinishi kerak bo'lgan 2 ta mahsulot nomini yozing va ushbu mahsulotlarni nima uchun kamroq iste'mol qilish kerakligini tushuntiring.",
        type: 'written',
        points: 5,
        difficulty: 'easy',
        correctAnswer: "1) Shirinliklar / gazli ichimliklar (1 ball)\n2) Fastfud / qovurilgan yog'li taomlar (1 ball)\nTushuntirish: Ular tarkibida shakar va zararli yog'lar ko'p bo'lib, semirish, tish kariesi va hazm buzilishiga sabab bo'ladi (3 ball).",
        explanation: "Shakar va ortiqcha yog'li mahsulotlar organizmga zarar yetkazadi.",
      },
      {
        questionNumber: 4,
        text: "Rasmga qarang (Odamning ovqat hazm qilish sistemasi).\na) 1 va 3-kataklarga ovqat hazm qilish sistemasi organlari nomini kiriting [4 ball].\nb) 3-organ hazm jarayonida qanday vazifani bajarishini yozing [2 ball].",
        type: 'written',
        points: 6,
        difficulty: 'hard',
        imageUrl: 'https://images.unsplash.com/photo-1532187863486-abf9dbad1b69?w=600&auto=format&fit=crop&q=80',
        correctAnswer: "a) 1 - Qizilo'ngach (2 ball), 3 - Me'da (oshqozon) (2 ball)\nb) Me'da ovqatni xlorid kislotasi va fermentlar yordamida parchalaydi va hazm qiladi (2 ball).",
        explanation: "1-qizilo'ngach, 3-me'da. Me'da ovqatni mexanik va kimyoviy qayta ishlaydi.",
      },
      {
        questionNumber: 5,
        text: "Rasmda baliqning ovqat hazm qilish sistemasi tasvirlangan. Rasmdan foydalanib savollarga javob bering:\na) Rasmdagi hayvonning ovqat hazm qilish sistemasida odamnikiga o'xshash ikkita organ nomini yozing (4 ball).\nb) Baliq va odamning ovqat hazm qilish sistemasidagi bitta farqni yozing (2 ball).\nc) Nima sababdan barcha umurtqali hayvonlarda ovqat hazm qilish sistemasining asosiy qismlari o'xshash, ayrim qismlari esa farq qiladi? (3 ball)",
        type: 'written',
        points: 9,
        difficulty: 'hard',
        imageUrl: 'https://images.unsplash.com/photo-1524704654690-b56c05c78a00?w=600&auto=format&fit=crop&q=80',
        correctAnswer: "a) Qizilo'ngach, me'da, ichak yoki jigar (har biri 2 ball).\nb) Baliqlarda so'lak bezlari yo'q, ichagi qisqaroq.\nc) Umumiy kelib chiqishi bir xil bo'lgani uchun asosiy qismlar o'xshash, biroq yashash muhiti va oziqlanish turiga (yirtqich, o'txo'r) moslashganligi sababli ayrim qismlari farq qiladi.",
        explanation: "Evolyutsiya va oziqlanish muhitiga moslashuv tushuntiriladi.",
      },
    ];

    setParsedDocxQuestions(userBSBQuestions);
    setDocxSuccessMsg("✨ Foydalanuvchi taqdim etgan 6-sinf Tabiiy fanlar 1-BSB materiali (30 ballik 5 ta to'liq savol) Gemini AI formatida yuklandi!");
  };

  // Save parsed questions to Firebase
  const handleSaveParsedQuestions = async () => {
    if (!targetTestForDocx) {
      alert("Iltimos, avval savollarni biriktirish uchun testni tanlang!");
      return;
    }

    const fullQuestions: Question[] = parsedDocxQuestions.map((q, idx) => ({
      ...q,
      id: `q_${targetTestForDocx}_${Date.now()}_${idx}`,
      testId: targetTestForDocx,
      questionNumber: idx + 1,
    }));

    await saveQuestionsBatch(targetTestForDocx, fullQuestions);

    // Update test question count & points
    const targetTest = tests.find((t) => t.id === targetTestForDocx);
    if (targetTest) {
      const totalPts = fullQuestions.reduce((acc, q) => acc + q.points, 0);
      const mc = fullQuestions.filter((q) => q.type === 'multiple_choice').length;
      const wr = fullQuestions.filter((q) => q.type === 'written').length;

      await saveTest({
        ...targetTest,
        questionsCount: fullQuestions.length,
        totalPoints: totalPts,
        multipleChoiceCount: mc,
        writtenCount: wr,
        updatedAt: new Date().toISOString(),
      });
      onRefreshTests();
    }

    alert("Savollar muvaffaqiyatli bazaga yuklandi!");
    setParsedDocxQuestions([]);
    setDocxSuccessMsg('');
    setActiveTab('questions');
    setSelectedTestId(targetTestForDocx);
  };

  // Live Proctoring Actions
  const handleAddExtraTime = async (session: ExamSession, extraMinutes = 5) => {
    const currentEnd = new Date(session.endTime).getTime();
    const newEnd = new Date(currentEnd + extraMinutes * 60 * 1000).toISOString();
    await updateExamSession(session.id, {
      endTime: newEnd,
    });
    alert(`${session.studentName}ga +${extraMinutes} daqiqa vaqt qo'shildi!`);
  };

  const handleDisqualifyStudent = async (session: ExamSession) => {
    if (!confirm(`${session.studentName}ni imtihondan chetlashtirishni tasdiqlaysizmi?`)) return;

    await updateExamSession(session.id, {
      status: 'disqualified',
      isDisqualified: true,
      disqualifyReason: "O'qituvchi tomonidan imtihondan chetlashtirildi",
      tabSwitchCount: Math.max(session.tabSwitchCount, 2),
    });
  };

  // Question save / update
  const handleSaveQuestion = async (q: Partial<Question>) => {
    if (!q.text || !selectedTestId) return;

    let updatedList = [...testQuestions];
    if (q.id) {
      // Edit
      updatedList = updatedList.map((item) => (item.id === q.id ? ({ ...item, ...q } as Question) : item));
    } else {
      // Add new
      const newQ: Question = {
        id: `q_${selectedTestId}_${Date.now()}`,
        testId: selectedTestId,
        questionNumber: testQuestions.length + 1,
        text: q.text,
        type: q.type || 'multiple_choice',
        options: q.options || ['A) Variant 1', 'B) Variant 2', 'C) Variant 3', 'D) Variant 4'],
        correctAnswer: q.correctAnswer || 'A',
        points: q.points || 2,
        imageUrl: q.imageUrl,
        explanation: q.explanation,
      };
      updatedList.push(newQ);
    }

    await saveQuestionsBatch(selectedTestId, updatedList);
    setTestQuestions(updatedList);
    setEditingQuestion(null);

    // Update test counter
    const currentTest = tests.find((t) => t.id === selectedTestId);
    if (currentTest) {
      await saveTest({
        ...currentTest,
        questionsCount: updatedList.length,
        totalPoints: updatedList.reduce((acc, i) => acc + i.points, 0),
        multipleChoiceCount: updatedList.filter((i) => i.type === 'multiple_choice').length,
        writtenCount: updatedList.filter((i) => i.type === 'written').length,
      });
      onRefreshTests();
    }
  };

  const handleDeleteQuestion = async (qId: string) => {
    if (!confirm("Ushbu savolni o'chirishni tasdiqlaysizmi?")) return;
    const filtered = testQuestions.filter((q) => q.id !== qId).map((q, idx) => ({ ...q, questionNumber: idx + 1 }));
    await saveQuestionsBatch(selectedTestId, filtered);
    setTestQuestions(filtered);

    const currentTest = tests.find((t) => t.id === selectedTestId);
    if (currentTest) {
      await saveTest({
        ...currentTest,
        questionsCount: filtered.length,
        totalPoints: filtered.reduce((acc, i) => acc + i.points, 0),
        multipleChoiceCount: filtered.filter((i) => i.type === 'multiple_choice').length,
        writtenCount: filtered.filter((i) => i.type === 'written').length,
      });
      onRefreshTests();
    }
  };

  // Test save / update
  const handleSaveTest = async (t: Partial<Test>) => {
    if (!t.title || !t.subject) return;

    const testId = t.id || `test_${Date.now()}`;
    const newTest: Test = {
      id: testId,
      title: t.title,
      subject: t.subject,
      grade: t.grade || 8,
      allowedGrades: t.allowedGrades || [t.grade || 8],
      gradeDurations: t.gradeDurations || {},
      group: t.group || 'Barchasi',
      type: t.type || 'BSB',
      description: t.description || '',
      durationMinutes: t.durationMinutes || 45,
      isActive: t.status ? t.status === 'active' : (t.isActive ?? true),
      status: t.status || (t.isActive ? 'active' : 'waiting'),
      startedAt: t.startedAt || (t.status === 'active' ? new Date().toISOString() : undefined),
      finishedAt: t.finishedAt || (t.status === 'finished' ? new Date().toISOString() : undefined),
      accessPassword: t.accessPassword?.trim() || undefined,
      totalPoints: t.totalPoints || 25,
      questionsCount: t.questionsCount || 0,
      shuffleQuestions: t.shuffleQuestions ?? false,
      passingPercentage: t.passingPercentage ?? 60,
      allowBackNav: t.allowBackNav ?? true,
      showImmediateResults: t.showImmediateResults ?? true,
      createdAt: t.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await saveTest(newTest);
    onRefreshTests();
    setEditingTest(null);
  };

  const handleDeleteTest = async (testId: string) => {
    if (!confirm("Testni va unga tegishli barcha savollarni o'chirishni tasdiqlaysizmi?")) return;
    await deleteTest(testId);
    onRefreshTests();
  };

  // Filter & Sort Submissions
  const filteredSubmissions = submissions
    .filter((sub) => {
      const matchSearch =
        sub.studentName.toLowerCase().includes(analyticsSearch.toLowerCase()) ||
        sub.testTitle.toLowerCase().includes(analyticsSearch.toLowerCase());
      if (!matchSearch) return false;

      if (analyticsGradeFilter !== 'all' && sub.grade !== parseInt(analyticsGradeFilter, 10)) {
        return false;
      }
      if (analyticsGroupFilter !== 'all') {
        const grp = (sub.group || '').toLowerCase();
        if (!grp.includes(analyticsGroupFilter.toLowerCase())) {
          return false;
        }
      }
      if (analyticsTypeFilter !== 'all' && sub.testType !== analyticsTypeFilter) {
        return false;
      }
      return true;
    })
    .sort((a, b) => {
      let comparison = 0;
      if (sortBy === 'name') {
        comparison = a.studentName.localeCompare(b.studentName);
      } else if (sortBy === 'grade') {
        comparison = a.grade - b.grade;
      } else if (sortBy === 'score') {
        comparison = a.score - b.score;
      } else if (sortBy === 'percentage') {
        comparison = a.percentage - b.percentage;
      } else if (sortBy === 'warnings') {
        comparison = (a.tabSwitchCount || 0) - (b.tabSwitchCount || 0);
      } else if (sortBy === 'date') {
        comparison = new Date(a.submittedAt).getTime() - new Date(b.submittedAt).getTime();
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });

  // Calculate Metrics
  const totalStudents = submissions.length;
  const avgScore = totalStudents > 0 ? Math.round(submissions.reduce((a, b) => a + b.score, 0) / totalStudents) : 0;
  const avgPercentage = totalStudents > 0 ? Math.round(submissions.reduce((a, b) => a + b.percentage, 0) / totalStudents) : 0;
  const disqualifiedCount = submissions.filter((s) => s.status === 'disqualified').length;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Top Header & Navigation */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-600"></span>
            <h2 className="text-xl font-black text-slate-900 tracking-tight">
              O'qituvchi va Admin Boshqaruv Markazi
            </h2>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            BSB va ChSB testlarini yuklash, real vaqtda o'quvchilarni nazorat qilish va Excel hisobotlarini olish
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex flex-wrap gap-1.5 bg-slate-100 p-1.5 rounded-2xl">
          <button
            onClick={() => setActiveTab('live')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center space-x-1.5 ${
              activeTab === 'live'
                ? 'bg-white text-blue-600 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            <span>Jonli Nazorat</span>
            {liveSessions.filter((s) => s.status === 'in_progress').length > 0 && (
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('docx')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center space-x-1.5 ${
              activeTab === 'docx'
                ? 'bg-white text-blue-600 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Word & PDF Yuklash</span>
          </button>

          <button
            onClick={() => setActiveTab('questions')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center space-x-1.5 ${
              activeTab === 'questions'
                ? 'bg-white text-blue-600 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Edit className="w-3.5 h-3.5" />
            <span>Savollar Tahriri</span>
          </button>

          <button
            onClick={() => setActiveTab('tests')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center space-x-1.5 ${
              activeTab === 'tests'
                ? 'bg-white text-blue-600 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Settings className="w-3.5 h-3.5" />
            <span>Testlar & Vaqt</span>
          </button>

          <button
            onClick={() => setActiveTab('analytics')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center space-x-1.5 ${
              activeTab === 'analytics'
                ? 'bg-white text-blue-600 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>Analitika & Excel</span>
          </button>
        </div>
      </div>

      {/* TAB 1: JONLI NAZORAT (REAL-TIME MONITORING) */}
      {activeTab === 'live' && (
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <h3 className="text-lg font-bold text-slate-900 flex items-center space-x-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  <span>Hozirda Imtihon Topshirayotgan O'quvchilar</span>
                </h3>
                <p className="text-xs text-slate-500">
                  O'quvchilarning real vaqtdagi faolligi, harakatlari va qoidabuzarliklarini onlayn kuzatish
                </p>
              </div>

              <div className="text-xs font-bold text-slate-600 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200">
                Aktiv o'quvchilar: {liveSessions.filter((s) => s.status === 'in_progress').length} ta
              </div>
            </div>

            {liveSessions.length === 0 ? (
              <div className="text-center py-12 border-2 border-dashed border-slate-200 rounded-2xl">
                <Activity className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                <p className="text-xs text-slate-500 font-medium">
                  Hozirda hech bir o'quvchi imtihon topshirmayapti. O'quvchi test boshlaganda bu yerda real vaqtda aks etadi.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-600 uppercase tracking-wider font-bold border-y border-slate-200">
                    <tr>
                      <th className="py-3 px-4">O'quvchi</th>
                      <th className="py-3 px-4">Sinf</th>
                      <th className="py-3 px-4">Test</th>
                      <th className="py-3 px-4">Jarayon</th>
                      <th className="py-3 px-4">Qoidabuzarlik</th>
                      <th className="py-3 px-4">Holat</th>
                      <th className="py-3 px-4 text-right">Tezkor Harakatlar</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {liveSessions.map((session) => {
                      const isDisq = session.status === 'disqualified' || session.isDisqualified;
                      const isFinished = session.status === 'submitted';

                      return (
                        <tr key={session.id} className="hover:bg-slate-50/80 transition-all">
                          <td className="py-3.5 px-4 font-bold text-slate-900">
                            {session.studentName}
                          </td>
                          <td className="py-3.5 px-4 font-semibold text-slate-600">
                            {session.grade}-{session.group}
                          </td>
                          <td className="py-3.5 px-4 text-slate-700 max-w-[200px] truncate">
                            {session.testTitle}
                          </td>
                          <td className="py-3.5 px-4">
                            <span className="font-semibold text-blue-600">
                              {session.currentQuestionIndex} / {session.totalQuestions} savol
                            </span>
                          </td>
                          <td className="py-3.5 px-4">
                            {session.tabSwitchCount === 0 ? (
                              <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                <span>🟢 0 (Toza)</span>
                              </span>
                            ) : session.tabSwitchCount === 1 ? (
                              <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200 animate-pulse">
                                <span>🟡 1-ogohlantirish</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                                <span>🔴 2 (Chetlashtirildi)</span>
                              </span>
                            )}
                          </td>
                          <td className="py-3.5 px-4">
                            {isDisq ? (
                              <span className="px-2 py-0.5 bg-rose-100 text-rose-800 rounded-md font-bold text-[11px]">
                                Chetlashtirilgan
                              </span>
                            ) : isFinished ? (
                              <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded-md font-bold text-[11px]">
                                Topshirdi
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-md font-bold text-[11px] inline-flex items-center space-x-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse"></span>
                                <span>Imtihonda</span>
                              </span>
                            )}
                          </td>
                          <td className="py-3.5 px-4 text-right space-x-2">
                            {!isDisq && !isFinished && (
                              <>
                                <button
                                  onClick={() => handleAddExtraTime(session, 5)}
                                  className="px-2.5 py-1 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg hover:bg-blue-100 text-[11px] font-bold transition-all"
                                >
                                  +5 daqiqa
                                </button>
                                <button
                                  onClick={() => handleDisqualifyStudent(session)}
                                  className="px-2.5 py-1 bg-rose-50 text-rose-700 border border-rose-200 rounded-lg hover:bg-rose-100 text-[11px] font-bold transition-all"
                                >
                                  Chetlashtirish
                                </button>
                              </>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: WORD & PDF FILE IMPORT WITH GEMINI AI */}
      {activeTab === 'docx' && (
        <div className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200 shadow-xs space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h3 className="text-lg font-bold text-slate-900 flex items-center space-x-2">
                <Upload className="w-5 h-5 text-blue-600" />
                <span>Word (.docx) va PDF (.pdf) Hujjatlarini AI orqali Tahlil Qilish</span>
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Gemini AI maktab BSB/ChSB hujjatlaridagi jadvallar, bo'sh joylar, rasmga bog'liq savollar va baholash mezonlarini 100% aniqlikda ajratib beradi.
              </p>
            </div>

            {/* AI Mode Selector */}
            <div className="flex items-center space-x-1.5 p-1 bg-slate-100 rounded-xl">
              <button
                type="button"
                onClick={() => setParseMode('ai')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center space-x-1 ${
                  parseMode === 'ai'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                <span>Gemini AI (Aqlli)</span>
              </button>
              <button
                type="button"
                onClick={() => setParseMode('standard')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  parseMode === 'standard'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <span>Standart (Tezkor)</span>
              </button>
            </div>
          </div>

          {/* Test Selector and Quick Preset Loaders */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-200">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Savollar biriktiriladigan test:
              </label>
              <select
                value={targetTestForDocx}
                onChange={(e) => setTargetTestForDocx(e.target.value)}
                className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-800"
              >
                {tests.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.grade}-sinf | {t.title} ({t.type})
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-wrap gap-2 justify-end">
              <button
                type="button"
                onClick={handleLoadExactUserBSB}
                className="py-2 px-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl text-xs font-bold flex items-center space-x-1.5 shadow-sm transition-all cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                <span>6-sinf Tabiiy Fanlar BSB (30 ball)</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setParsedDocxQuestions([
                    {
                      questionNumber: 1,
                      text: "Kvadrat ildiz ostida 144 sonining qiymatini toping va hisoblash usulini tushuntiring.",
                      type: 'multiple_choice',
                      points: 4,
                      options: ["A) 12", "B) 14", "C) 16", "D) 18"],
                      correctAnswer: "A",
                      explanation: "12 * 12 = 144, shuning uchun ildiz ostida 144 teng 12.",
                      difficulty: 'easy',
                    },
                    {
                      questionNumber: 2,
                      text: "Quyidagi ratsional tenglamani yeching: (2x - 4) / 3 = (x + 2) / 2. Yechim bosqichlarini to'liq yozing.",
                      type: 'written',
                      points: 6,
                      correctAnswer: "2*(2x - 4) = 3*(x + 2) => 4x - 8 = 3x + 6 => x = 14",
                      explanation: "Proporsiya usulidan foydalanib x = 14 ekanligi topiladi.",
                      difficulty: 'medium',
                    },
                    {
                      questionNumber: 3,
                      text: "Chiziqlar o'rniga mos so'zlarni qo'ying: Tenglama ildizi deb noma'lumning tenglamani _____ tenglikka aylantiruvchi qiymatiga aytiladi.",
                      type: 'fill_blank',
                      points: 5,
                      correctAnswer: "to'g'ri sonli",
                      explanation: "Tenglama ta'rifi.",
                      difficulty: 'easy',
                    },
                    {
                      questionNumber: 4,
                      text: "Matematik tushunchalarni ularning qoidalari bilan moslashtiring:",
                      type: 'matching',
                      points: 5,
                      matchingPairs: [
                        { id: 'm1', left: 'Gipotenuzaning kvadrati', right: 'Katetlar kvadratlari yig\'indisiga teng' },
                        { id: 'm2', left: 'Diskriminant D > 0', right: 'Tenglama 2 ta haqiqiy ildizga ega' },
                        { id: 'm3', left: 'Perimetr', right: 'Barcha tomonlar uzunliklari yig\'indisi' }
                      ],
                      difficulty: 'medium',
                    },
                    {
                      questionNumber: 5,
                      text: "To'g'ri to'rtburchakning bo'yi enidan 4 sm uzun, yuzi esa 96 sm kv. To'g'ri to'rtburchakning perimetrini toping. Yechimini batafsil yozing.",
                      type: 'written',
                      points: 5,
                      correctAnswer: "x*(x+4) = 96 => x^2 + 4x - 96 = 0 => x = 8. Bo'yi = 12 sm, Eni = 8 sm. P = 2*(12+8) = 40 sm.",
                      explanation: "Kvadrat tenglama tuziladi va perimetr 40 sm chiqadi.",
                      difficulty: 'hard',
                    }
                  ]);
                  setDocxSuccessMsg("✨ 8-sinf Matematika 1-BSB namunaviy savollari (25 ball) tayyorlandi!");
                }}
                className="py-2 px-3 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold transition-all cursor-pointer"
              >
                <span>8-sinf Matematika BSB (25 ball)</span>
              </button>
            </div>
          </div>

          {/* Sub-Tabs: File Upload vs Direct Text Paste */}
          <div className="flex border-b border-slate-200">
            <button
              type="button"
              onClick={() => setUploadMethod('file')}
              className={`pb-2.5 px-4 text-xs font-bold border-b-2 transition-all cursor-pointer ${
                uploadMethod === 'file'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              📁 Fayl yuklash (Word, PDF, Skrinshot/Rasm)
            </button>
            <button
              type="button"
              onClick={() => setUploadMethod('text')}
              className={`pb-2.5 px-4 text-xs font-bold border-b-2 transition-all cursor-pointer ${
                uploadMethod === 'text'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              ✍️ Matnni nusxalab joylashtirish (Direct Paste)
            </button>
          </div>

          {/* Method 1: File Upload (Docx, PDF, Images) */}
          {uploadMethod === 'file' && (
            <div className="border-2 border-dashed border-blue-300 hover:border-blue-500 rounded-2xl p-8 text-center bg-blue-50/30 transition-all">
              <input
                type="file"
                accept=".docx,.pdf,image/*"
                onChange={handleFileUpload}
                className="hidden"
                id="docx-file-input"
              />
              <label
                htmlFor="docx-file-input"
                className="cursor-pointer flex flex-col items-center justify-center space-y-3"
              >
                <div className="w-14 h-14 bg-blue-100 text-blue-600 rounded-2xl flex items-center justify-center shadow-xs">
                  <Upload className="w-7 h-7" />
                </div>
                <div>
                  <span className="text-sm font-bold text-blue-600 hover:underline">
                    Word (.docx), PDF (.pdf) yoki Test Rasmini tanlang
                  </span>
                  <span className="text-xs text-slate-500 block mt-0.5">
                    yoki faylni / skrinshotni shu yerga sudrab tashlang
                  </span>
                </div>
                <span className="text-[11px] text-slate-400 bg-white px-3 py-1 rounded-full border border-slate-200">
                  Word (.docx), PDF (.pdf), skrinshotlar (.png, .jpg), A, B, C, D variantlari va yozma topshiriqlar
                </span>
              </label>
            </div>
          )}

          {/* Method 2: Direct Text Paste */}
          {uploadMethod === 'text' && (
            <div className="space-y-3 p-4 bg-slate-50 border border-slate-200 rounded-2xl">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                Savollar matnini shu yerga joylashtiring:
              </label>
              <textarea
                rows={7}
                value={pastedExamText}
                onChange={(e) => setPastedExamText(e.target.value)}
                placeholder="Savollar matnini nusxalang (masalan: 1. Iste'mol qilinadigan oziq-ovqat mahsulotlari _____ ni tashkil etadi. A) vitamin B) ratsion...)"
                className="w-full p-3 bg-white border border-slate-200 rounded-xl text-xs font-mono leading-relaxed focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <div className="flex justify-end">
                <button
                  type="button"
                  disabled={isParsingDocx}
                  onClick={handleDirectTextAIParse}
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center space-x-2 shadow-sm transition-all cursor-pointer"
                >
                  <Sparkles className="w-4 h-4 text-amber-300" />
                  <span>Gemini 3.8 AI orqali tahlil qilish</span>
                </button>
              </div>
            </div>
          )}

          {isParsingDocx && (
            <div className="text-center py-6 text-xs text-blue-600 font-semibold animate-pulse">
              Hujjat (Word / PDF) tahlil qilinmoqda va savollar ajratib olinmoqda...
            </div>
          )}

          {docxSuccessMsg && (
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center space-x-3 text-emerald-800 text-xs">
              <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0" />
              <span>{docxSuccessMsg}</span>
            </div>
          )}

          {/* Parsed Questions Preview */}
          {parsedDocxQuestions.length > 0 && (
            <div className="space-y-4 pt-4 border-t border-slate-100">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-bold text-slate-900">
                  Tahlil qilingan savollar ({parsedDocxQuestions.length} ta)
                </h4>
                <button
                  type="button"
                  onClick={handleSaveParsedQuestions}
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center space-x-1.5 shadow-md shadow-blue-500/20 transition-all cursor-pointer"
                >
                  <Save className="w-4 h-4" />
                  <span>Bazaga Saqlash (Firebase)</span>
                </button>
              </div>

              <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
                {parsedDocxQuestions.map((q, idx) => (
                  <div key={idx} className="p-4 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-900">
                        {idx + 1}-savol: {q.type === 'multiple_choice' ? 'Variantli' : 'Yozma'}
                      </span>
                      <span className="bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full font-bold">
                        {q.points} ball
                      </span>
                    </div>

                    <p className="text-slate-800 font-medium">{q.text}</p>

                    {q.imageUrl && (
                      <div className="my-2 border rounded-lg overflow-hidden max-w-xs">
                        <img src={q.imageUrl} alt="Savol rasmi" className="max-h-36 object-contain" />
                      </div>
                    )}

                    {q.options && q.options.length > 0 && (
                      <div className="grid grid-cols-2 gap-2 pt-1 text-[11px] text-slate-600">
                        {q.options.map((opt, oIdx) => (
                          <div
                            key={oIdx}
                            className={`p-1.5 rounded-md border ${
                              opt.startsWith(q.correctAnswer || '')
                                ? 'bg-emerald-50 border-emerald-300 font-bold text-emerald-800'
                                : 'bg-white border-slate-200'
                            }`}
                          >
                            {opt}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: SAVOLLAR TAHRIRI (QUESTION EDITOR) */}
      {activeTab === 'questions' && (
        <div className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200 shadow-xs space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h3 className="text-lg font-bold text-slate-900">
                Savollarni Tahrirlash va Qo'shish
              </h3>
              <p className="text-xs text-slate-500">
                Istalgan test savolini tahrirlang, rasm yuklang, ballarni o'zgartiring yoki yangi savol qo'shing
              </p>
            </div>

            <div className="flex items-center space-x-3">
              <select
                value={selectedTestId}
                onChange={(e) => setSelectedTestId(e.target.value)}
                className="p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800"
              >
                {tests.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.grade}-sinf: {t.title}
                  </option>
                ))}
              </select>

              <button
                type="button"
                onClick={() =>
                  setEditingQuestion({
                    type: 'multiple_choice',
                    options: ['A) ', 'B) ', 'C) ', 'D) '],
                    correctAnswer: 'A',
                    points: 2,
                  })
                }
                className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center space-x-1.5 shadow-xs cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Yangi Savol</span>
              </button>
            </div>
          </div>

          {isLoadingQuestions ? (
            <div className="text-center py-8 text-xs text-slate-500">Savollar yuklanmoqda...</div>
          ) : testQuestions.length === 0 ? (
            <div className="text-center py-10 border-2 border-dashed border-slate-200 rounded-2xl text-xs text-slate-400">
              Ushbu testda hali savollar yo'q. "Yangi Savol" yoki "Word (.docx) Yuklash" orqali savol qo'shing.
            </div>
          ) : (
            <div className="space-y-4">
              {testQuestions.map((q, idx) => (
                <div
                  key={q.id}
                  className="p-5 bg-slate-50 rounded-2xl border border-slate-200 space-y-3 hover:border-slate-300 transition-all"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <span className="w-6 h-6 bg-blue-600 text-white rounded-md flex items-center justify-center font-bold text-xs">
                        {idx + 1}
                      </span>
                      <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-slate-200 text-slate-700">
                        {q.type === 'multiple_choice' ? 'Variantli test' : 'Yozma savol'}
                      </span>
                      <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-amber-100 text-amber-800">
                        {q.points} ball
                      </span>
                    </div>

                    <div className="flex items-center space-x-1">
                      <button
                        onClick={() => setEditingQuestion(q)}
                        className="p-1.5 text-slate-600 hover:text-blue-600 hover:bg-white rounded-lg transition-all"
                        title="Tahrirlash"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteQuestion(q.id)}
                        className="p-1.5 text-slate-600 hover:text-rose-600 hover:bg-white rounded-lg transition-all"
                        title="O'chirish"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <p className="text-xs font-semibold text-slate-900 leading-relaxed">{q.text}</p>

                  {q.imageUrl && (
                    <div className="max-w-xs border rounded-xl overflow-hidden shadow-2xs">
                      <img src={q.imageUrl} alt="Savol rasmi" className="max-h-40 object-contain mx-auto" />
                    </div>
                  )}

                  {q.type === 'multiple_choice' && q.options && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-700 pt-1">
                      {q.options.map((opt, oIdx) => {
                        const optLetter = opt.substring(0, 1).toUpperCase();
                        const isCorrect = q.correctAnswer?.toUpperCase() === optLetter;
                        return (
                          <div
                            key={oIdx}
                            className={`p-2 rounded-xl border flex items-center space-x-2 ${
                              isCorrect
                                ? 'bg-emerald-50 border-emerald-300 text-emerald-800 font-bold'
                                : 'bg-white border-slate-200'
                            }`}
                          >
                            <span>{opt}</span>
                            {isCorrect && <Check className="w-3.5 h-3.5 text-emerald-600 ml-auto" />}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Edit / Create Question Modal */}
          {editingQuestion && (
            <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
              <div className="bg-white rounded-3xl max-w-2xl w-full p-6 sm:p-8 space-y-5 shadow-2xl border border-slate-200 max-h-[90vh] overflow-y-auto">
                <div className="flex items-center justify-between border-b pb-3">
                  <h3 className="text-base font-bold text-slate-900">
                    {editingQuestion.id ? 'Savolni Tahrirlash' : 'Yangi Savol Qo\'shish'}
                  </h3>
                  <button
                    onClick={() => setEditingQuestion(null)}
                    className="text-slate-400 hover:text-slate-600"
                  >
                    <XCircle className="w-5 h-5" />
                  </button>
                </div>

                <div className="space-y-4 text-xs">
                  {/* Question Type, Difficulty & Points */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block font-bold text-slate-700 uppercase mb-1">Savol turi:</label>
                      <select
                        value={editingQuestion.type || 'multiple_choice'}
                        onChange={(e) =>
                          setEditingQuestion({
                            ...editingQuestion,
                            type: e.target.value as any,
                          })
                        }
                        className="w-full p-2 bg-slate-50 border rounded-xl"
                      >
                        <option value="multiple_choice">Variantli (A, B, C, D)</option>
                        <option value="true_false">To'g'ri / Noto'g'ri</option>
                        <option value="fill_blank">Bo'sh joyni to'ldirish</option>
                        <option value="matching">Moslashtirish (Juftliklar)</option>
                        <option value="written">Yozma (Ochiq javob)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block font-bold text-slate-700 uppercase mb-1">Qiyinlik darajasi:</label>
                      <select
                        value={editingQuestion.difficulty || 'medium'}
                        onChange={(e) =>
                          setEditingQuestion({
                            ...editingQuestion,
                            difficulty: e.target.value as any,
                          })
                        }
                        className="w-full p-2 bg-slate-50 border rounded-xl"
                      >
                        <option value="easy">Oson</option>
                        <option value="medium">O'rta</option>
                        <option value="hard">Murakkab</option>
                      </select>
                    </div>

                    <div>
                      <label className="block font-bold text-slate-700 uppercase mb-1">Ball:</label>
                      <input
                        type="number"
                        value={editingQuestion.points || 2}
                        onChange={(e) =>
                          setEditingQuestion({
                            ...editingQuestion,
                            points: parseInt(e.target.value, 10) || 2,
                          })
                        }
                        className="w-full p-2 bg-slate-50 border rounded-xl"
                      />
                    </div>
                  </div>

                  {/* Math Formula Toolbar */}
                  <div className="p-2 bg-slate-100 rounded-xl flex flex-wrap gap-1 items-center">
                    <span className="text-[11px] font-bold text-slate-500 mr-1.5">Matematik belgilar kiritish:</span>
                    {['√', '²', '³', 'π', '±', '≤', '≥', '÷', '×', '°', 'α', 'β', 'Δ', '∑', '∫'].map((sym) => (
                      <button
                        key={sym}
                        type="button"
                        onClick={() => {
                          setEditingQuestion({
                            ...editingQuestion,
                            text: (editingQuestion.text || '') + sym,
                          });
                        }}
                        className="w-6 h-6 bg-white hover:bg-blue-50 border rounded text-xs font-bold text-slate-800"
                      >
                        {sym}
                      </button>
                    ))}
                  </div>

                  {/* Question Text */}
                  <div>
                    <label className="block font-bold text-slate-700 uppercase mb-1">Savol matni:</label>
                    <textarea
                      rows={3}
                      value={editingQuestion.text || ''}
                      onChange={(e) =>
                        setEditingQuestion({
                          ...editingQuestion,
                          text: e.target.value,
                        })
                      }
                      placeholder="Savol matnini bu yerga yozing..."
                      className="w-full p-2.5 bg-slate-50 border rounded-xl"
                    />
                  </div>

                  {/* Question Image URL or File Upload */}
                  <div>
                    <label className="block font-bold text-slate-700 uppercase mb-1 flex items-center space-x-1">
                      <ImageIcon className="w-3.5 h-3.5" />
                      <span>Savol rasmi (URL yoki fayl yuklash):</span>
                    </label>
                    <div className="flex space-x-2">
                      <input
                        type="text"
                        value={editingQuestion.imageUrl || ''}
                        onChange={(e) =>
                          setEditingQuestion({
                            ...editingQuestion,
                            imageUrl: e.target.value,
                          })
                        }
                        placeholder="https://... yoki rasm yuklang"
                        className="flex-1 p-2 bg-slate-50 border rounded-xl text-xs"
                      />
                      <label className="px-3 py-2 bg-slate-100 hover:bg-slate-200 border rounded-xl cursor-pointer text-slate-700 font-semibold flex items-center space-x-1">
                        <Upload className="w-3 h-3" />
                        <span>Yuklash</span>
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (f) {
                              const reader = new FileReader();
                              reader.onload = () => {
                                setEditingQuestion({
                                  ...editingQuestion,
                                  imageUrl: reader.result as string,
                                });
                              };
                              reader.readAsDataURL(f);
                            }
                          }}
                        />
                      </label>
                    </div>
                    {editingQuestion.imageUrl && (
                      <div className="mt-2 relative max-w-xs border rounded-lg overflow-hidden">
                        <img src={editingQuestion.imageUrl} alt="Ko'rish" className="max-h-28 object-contain" />
                        <button
                          type="button"
                          onClick={() => setEditingQuestion({ ...editingQuestion, imageUrl: undefined })}
                          className="absolute top-1 right-1 p-1 bg-rose-600 text-white rounded-md text-[10px]"
                        >
                          O'chirish
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Multiple choice options editor */}
                  {editingQuestion.type === 'multiple_choice' && (
                    <div className="space-y-2 pt-2 border-t">
                      <label className="block font-bold text-slate-700 uppercase">
                        Variantlar va To'g'ri javob:
                      </label>
                      {['A', 'B', 'C', 'D'].map((letter, optIdx) => {
                        const existingOpt =
                          editingQuestion.options?.[optIdx] || `${letter}) Variant`;
                        const cleanVal = existingOpt.replace(/^[A-DА-Дa-dа-д][\.\)]\s*/, '');
                        const isCorrect = (editingQuestion.correctAnswer || 'A').toUpperCase() === letter;

                        return (
                          <div key={letter} className="flex items-center space-x-2">
                            <button
                              type="button"
                              onClick={() => setEditingQuestion({ ...editingQuestion, correctAnswer: letter })}
                              className={`w-7 h-7 rounded-lg border font-bold flex items-center justify-center transition-all ${
                                isCorrect
                                  ? 'bg-emerald-600 border-emerald-600 text-white'
                                  : 'bg-slate-100 border-slate-300 text-slate-600'
                              }`}
                              title="To'g'ri javob sifatida belgilash"
                            >
                              {letter}
                            </button>
                            <input
                              type="text"
                              value={cleanVal}
                              onChange={(e) => {
                                const newOpts = [...(editingQuestion.options || ['A) ', 'B) ', 'C) ', 'D) '])];
                                newOpts[optIdx] = `${letter}) ${e.target.value}`;
                                setEditingQuestion({
                                  ...editingQuestion,
                                  options: newOpts,
                                });
                              }}
                              placeholder={`${letter} varianti matni...`}
                              className="flex-1 p-2 bg-slate-50 border rounded-xl"
                            />
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* True / False Editor */}
                  {editingQuestion.type === 'true_false' && (
                    <div className="space-y-2 pt-2 border-t">
                      <label className="block font-bold text-slate-700 uppercase mb-1">
                        To'g'ri javobni belgilang:
                      </label>
                      <div className="flex space-x-4">
                        <button
                          type="button"
                          onClick={() => setEditingQuestion({ ...editingQuestion, correctAnswer: 'true' })}
                          className={`flex-1 py-3 px-4 rounded-xl border-2 font-bold text-xs flex items-center justify-center space-x-2 ${
                            (editingQuestion.correctAnswer || 'true').toLowerCase() === 'true'
                              ? 'bg-emerald-50 border-emerald-500 text-emerald-800'
                              : 'bg-white border-slate-200 text-slate-600'
                          }`}
                        >
                          <Check className="w-4 h-4 text-emerald-600" />
                          <span>TO'G'RI (HA)</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setEditingQuestion({ ...editingQuestion, correctAnswer: 'false' })}
                          className={`flex-1 py-3 px-4 rounded-xl border-2 font-bold text-xs flex items-center justify-center space-x-2 ${
                            editingQuestion.correctAnswer?.toLowerCase() === 'false'
                              ? 'bg-rose-50 border-rose-500 text-rose-800'
                              : 'bg-white border-slate-200 text-slate-600'
                          }`}
                        >
                          <XCircle className="w-4 h-4 text-rose-600" />
                          <span>NOTO'G'RI (YO'Q)</span>
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Fill in the blank editor */}
                  {editingQuestion.type === 'fill_blank' && (
                    <div className="space-y-2 pt-2 border-t">
                      <label className="block font-bold text-slate-700 uppercase mb-1">
                        Bo'sh joy o'rniga kutilayotgan to'g'ri javob / formula:
                      </label>
                      <input
                        type="text"
                        value={editingQuestion.correctAnswer || ''}
                        onChange={(e) => setEditingQuestion({ ...editingQuestion, correctAnswer: e.target.value })}
                        placeholder="Masalan: a*b yoki Nyuton"
                        className="w-full p-2.5 bg-slate-50 border rounded-xl text-xs font-semibold"
                      />
                    </div>
                  )}

                  {/* Matching Pairs Editor */}
                  {editingQuestion.type === 'matching' && (
                    <div className="space-y-3 pt-2 border-t">
                      <div className="flex items-center justify-between">
                        <label className="block font-bold text-slate-700 uppercase">
                          Moslashtirish juftliklari:
                        </label>
                        <button
                          type="button"
                          onClick={() => {
                            const cur = editingQuestion.matchingPairs || [];
                            setEditingQuestion({
                              ...editingQuestion,
                              matchingPairs: [
                                ...cur,
                                { id: `p_${Date.now()}`, left: `Element ${cur.length + 1}`, right: `Javob ${cur.length + 1}` },
                              ],
                            });
                          }}
                          className="px-2.5 py-1 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg text-xs font-bold"
                        >
                          + Juftlik qo'shish
                        </button>
                      </div>

                      {(editingQuestion.matchingPairs || [
                        { id: 'p1', left: 'Kvadrat', right: 'Barcha tomonlari teng' },
                        { id: 'p2', left: 'Aylana', right: 'Markazdan teng uzoqlik' },
                      ]).map((pair, pIdx) => (
                        <div key={pair.id || pIdx} className="flex items-center space-x-2">
                          <input
                            type="text"
                            value={pair.left}
                            onChange={(e) => {
                              const newPairs = [...(editingQuestion.matchingPairs || [])];
                              newPairs[pIdx] = { ...pair, left: e.target.value };
                              setEditingQuestion({ ...editingQuestion, matchingPairs: newPairs });
                            }}
                            placeholder="Chap qism..."
                            className="flex-1 p-2 bg-slate-50 border rounded-xl"
                          />
                          <span className="text-slate-400 font-bold">⇄</span>
                          <input
                            type="text"
                            value={pair.right}
                            onChange={(e) => {
                              const newPairs = [...(editingQuestion.matchingPairs || [])];
                              newPairs[pIdx] = { ...pair, right: e.target.value };
                              setEditingQuestion({ ...editingQuestion, matchingPairs: newPairs });
                            }}
                            placeholder="O'ng qism..."
                            className="flex-1 p-2 bg-slate-50 border rounded-xl"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              const filtered = (editingQuestion.matchingPairs || []).filter((_, i) => i !== pIdx);
                              setEditingQuestion({ ...editingQuestion, matchingPairs: filtered });
                            }}
                            className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Written sample answer / explanation */}
                  {editingQuestion.type === 'written' && (
                    <div>
                      <label className="block font-bold text-slate-700 uppercase mb-1">
                        Namunaviy to'g'ri javob / mezon:
                      </label>
                      <textarea
                        rows={2}
                        value={editingQuestion.correctAnswer || ''}
                        onChange={(e) =>
                          setEditingQuestion({
                            ...editingQuestion,
                            correctAnswer: e.target.value,
                          })
                        }
                        placeholder="O'qituvchi baholash uchun mezon..."
                        className="w-full p-2 bg-slate-50 border rounded-xl"
                      />
                    </div>
                  )}
                </div>

                <div className="flex justify-end space-x-3 pt-3 border-t">
                  <button
                    onClick={() => setEditingQuestion(null)}
                    className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl text-xs font-bold"
                  >
                    Bekor qilish
                  </button>
                  <button
                    onClick={() => handleSaveQuestion(editingQuestion)}
                    className="px-5 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold shadow-xs cursor-pointer"
                  >
                    Saqlash
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 4: TESTLAR SOZLAMALARI VA VAQT QO'SHISH */}
      {activeTab === 'tests' && (
        <div className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200 shadow-xs space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h3 className="text-lg font-bold text-slate-900">
                BSB va ChSB Testlari Sozlamalari
              </h3>
              <p className="text-xs text-slate-500">
                Imtihonlarga vaqt qo'shish, faollik holatini boshqarish va yangi fanlar yaratish
              </p>
            </div>

            <button
              onClick={() =>
                setEditingTest({
                  type: 'BSB',
                  grade: 8,
                  durationMinutes: 45,
                  isActive: true,
                  totalPoints: 25,
                })
              }
              className="px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold flex items-center space-x-1.5 shadow-xs cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Yangi Test Yaratish</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {tests.map((test) => {
              const isStarted = test.status === 'active' || (test.status === undefined && test.isActive);
              const isFinished = test.status === 'finished';
              const isWaiting = test.status === 'waiting' || (!test.isActive && !isFinished);

              return (
                <div
                  key={test.id}
                  className="p-5 rounded-2xl border border-slate-200 bg-slate-50/70 space-y-3.5 shadow-2xs"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-100 text-blue-800">
                        {test.grade}-SINF
                      </span>
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                          test.type === 'BSB'
                            ? 'bg-purple-100 text-purple-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {test.type}
                      </span>
                    </div>

                    {/* Status Pill */}
                    {isStarted ? (
                      <span className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                        <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse"></span>
                        <span>JARAYONDA (START)</span>
                      </span>
                    ) : isFinished ? (
                      <span className="inline-flex items-center space-x-1 px-3 py-1 rounded-full text-[11px] font-bold bg-rose-100 text-rose-800 border border-rose-300">
                        <Lock className="w-3 h-3" />
                        <span>FINISH (YOPILGAN)</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center space-x-1 px-3 py-1 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                        <Clock className="w-3 h-3 text-amber-600" />
                        <span>KUTILMOQDA</span>
                      </span>
                    )}
                  </div>

                  <div>
                    <h4 className="text-base font-bold text-slate-900">{test.title}</h4>
                    <p className="text-xs text-slate-500 line-clamp-2 mt-0.5">{test.description}</p>
                  </div>

                  {/* Password & Metrics row */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-200/80 text-xs">
                    <div className="flex items-center space-x-3 text-slate-600">
                      <span className="flex items-center space-x-1">
                        <Clock className="w-3.5 h-3.5 text-blue-500" />
                        <strong>{test.durationMinutes} daqiqa</strong>
                      </span>
                      <span>Savollar: {test.questionsCount} ta</span>
                      <span>Maksimal ball: {test.totalPoints}</span>
                    </div>

                    {test.accessPassword ? (
                      <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-900 border border-amber-300">
                        <Lock className="w-3 h-3 text-amber-600" />
                        <span>Parol: {test.accessPassword}</span>
                      </span>
                    ) : (
                      <span className="text-[11px] text-slate-400 font-medium">Parolsiz (Ochiq)</span>
                    )}
                  </div>

                  {/* Start / Finish Controls Bar */}
                  <div className="pt-2 flex flex-wrap items-center justify-between gap-2 border-t border-slate-200/80">
                    <div className="flex items-center space-x-1.5">
                      <button
                        type="button"
                        onClick={async () => {
                          await saveTest({
                            ...test,
                            status: 'active',
                            isActive: true,
                            startedAt: new Date().toISOString(),
                          });
                          onRefreshTests();
                        }}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center space-x-1 cursor-pointer transition-all ${
                          isStarted
                            ? 'bg-emerald-600 text-white shadow-xs ring-2 ring-emerald-400'
                            : 'bg-white hover:bg-emerald-50 text-emerald-700 border border-emerald-300'
                        }`}
                        title="O'quvchilarga testni boshlashga ruxsat berish (Start)"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Start berish</span>
                      </button>

                      <button
                        type="button"
                        onClick={async () => {
                          await saveTest({
                            ...test,
                            status: 'finished',
                            isActive: false,
                            finishedAt: new Date().toISOString(),
                          });
                          onRefreshTests();
                        }}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center space-x-1 cursor-pointer transition-all ${
                          isFinished
                            ? 'bg-rose-600 text-white shadow-xs ring-2 ring-rose-400'
                            : 'bg-white hover:bg-rose-50 text-rose-700 border border-rose-300'
                        }`}
                        title="Imtihonni to'xtatish va yakunlash (Finish)"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                        <span>Finish berish</span>
                      </button>

                      <button
                        type="button"
                        onClick={async () => {
                          await saveTest({
                            ...test,
                            status: 'waiting',
                            isActive: false,
                          });
                          onRefreshTests();
                        }}
                        className={`px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                          isWaiting
                            ? 'bg-amber-100 text-amber-800 border border-amber-300'
                            : 'bg-white hover:bg-slate-100 text-slate-600 border border-slate-300'
                        }`}
                        title="Start berilmagan kutish holatiga o'tkazish"
                      >
                        Kutish
                      </button>
                    </div>

                    <div className="flex items-center space-x-1">
                      <button
                        type="button"
                        onClick={async () => {
                          await saveTest({ ...test, durationMinutes: test.durationMinutes + 5 });
                          onRefreshTests();
                        }}
                        className="px-2 py-1 bg-white border border-slate-200 hover:bg-slate-100 rounded-lg text-[11px] font-bold text-blue-600 cursor-pointer"
                        title="5 daqiqa vaqt qo'shish"
                      >
                        +5 daq
                      </button>
                      <button
                        onClick={() => setEditingTest(test)}
                        className="p-2 text-slate-600 hover:text-blue-600 bg-white border border-slate-200 rounded-lg cursor-pointer"
                        title="Tahrirlash va sozlamalar"
                      >
                        <Edit className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDeleteTest(test.id)}
                        className="p-2 text-slate-600 hover:text-rose-600 bg-white border border-slate-200 rounded-lg cursor-pointer"
                        title="O'chirish"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* New / Edit Test Modal */}
          {editingTest && (
            <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
              <div className="bg-white rounded-3xl max-w-lg w-full p-6 space-y-4 shadow-2xl border">
                <h3 className="text-base font-bold text-slate-900">
                  {editingTest.id ? 'Testni Tahrirlash' : 'Yangi Test Yaratish'}
                </h3>

                <div className="space-y-3 text-xs">
                  <div>
                    <label className="block font-bold text-slate-700 uppercase mb-1">Test nomi:</label>
                    <input
                      type="text"
                      value={editingTest.title || ''}
                      onChange={(e) => setEditingTest({ ...editingTest, title: e.target.value })}
                      placeholder="Masalan: 8-sinf Matematika 1-BSB"
                      className="w-full p-2.5 bg-slate-50 border rounded-xl"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-bold text-slate-700 uppercase mb-1">Fan:</label>
                      <input
                        type="text"
                        value={editingTest.subject || ''}
                        onChange={(e) => setEditingTest({ ...editingTest, subject: e.target.value })}
                        placeholder="Matematika"
                        className="w-full p-2 bg-slate-50 border rounded-xl"
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-slate-700 uppercase mb-1">Sinf (5-11):</label>
                      <input
                        type="number"
                        min={5}
                        max={11}
                        value={editingTest.grade || 8}
                        onChange={(e) => setEditingTest({ ...editingTest, grade: parseInt(e.target.value, 10) || 8 })}
                        className="w-full p-2 bg-slate-50 border rounded-xl"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-bold text-slate-700 uppercase mb-1">Turi:</label>
                      <select
                        value={editingTest.type || 'BSB'}
                        onChange={(e) => setEditingTest({ ...editingTest, type: e.target.value as TestType })}
                        className="w-full p-2 bg-slate-50 border rounded-xl"
                      >
                        <option value="BSB">BSB (Oylik baholash)</option>
                        <option value="ChSB">ChSB (Choraklik baholash)</option>
                      </select>
                    </div>
                    <div>
                      <label className="block font-bold text-slate-700 uppercase mb-1">Standart Vaqt (Daqiqa):</label>
                      <input
                        type="number"
                        value={editingTest.durationMinutes || 45}
                        onChange={(e) =>
                          setEditingTest({ ...editingTest, durationMinutes: parseInt(e.target.value, 10) || 45 })
                        }
                        className="w-full p-2 bg-slate-50 border rounded-xl"
                      />
                    </div>
                  </div>

                  {/* Multi-Grade & Grade-Specific Durations */}
                  <div className="p-3 bg-blue-50/50 border border-blue-200 rounded-2xl space-y-3">
                    <div>
                      <label className="block font-bold text-blue-900 uppercase mb-1 text-[11px]">
                        Ruxsat etilgan sinflar (Ushbu testni qaysi sinflar topshira oladi):
                      </label>
                      <div className="flex flex-wrap gap-1.5">
                        {[5, 6, 7, 8, 9, 10, 11].map((g) => {
                          const currentAllowed = editingTest.allowedGrades || [editingTest.grade || 8];
                          const isSelected = currentAllowed.includes(g);
                          return (
                            <button
                              key={g}
                              type="button"
                              onClick={() => {
                                let nextAllowed = isSelected
                                  ? currentAllowed.filter((item) => item !== g)
                                  : [...currentAllowed, g];
                                if (nextAllowed.length === 0) nextAllowed = [g];
                                setEditingTest({
                                  ...editingTest,
                                  allowedGrades: nextAllowed,
                                });
                              }}
                              className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition-all ${
                                isSelected
                                  ? 'bg-blue-600 text-white border-blue-600 shadow-2xs'
                                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                              }`}
                            >
                              {g}-sinf
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Grade-Specific Duration Inputs */}
                    <div className="space-y-1.5 pt-1 border-t border-blue-100">
                      <label className="block font-bold text-blue-900 uppercase text-[11px]">
                        Sinflar bo'yicha vaqt taqsimoti (Daqiqa):
                      </label>
                      <p className="text-[10px] text-slate-500">
                        Har bir sinf o'quvchisi uchun alohida vaqt belgilashingiz mumkin (masalan, 7-sinfga 50 daqiqa, 9-sinfga 40 daqiqa).
                      </p>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1">
                        {(editingTest.allowedGrades || [editingTest.grade || 8]).map((g) => {
                          const currentDurations = editingTest.gradeDurations || {};
                          const durVal = currentDurations[g] ?? editingTest.durationMinutes ?? 45;
                          return (
                            <div key={g} className="bg-white p-2 rounded-xl border border-slate-200 flex items-center justify-between space-x-2">
                              <span className="font-bold text-slate-700 text-xs">{g}-sinf:</span>
                              <div className="flex items-center space-x-1">
                                <input
                                  type="number"
                                  min={5}
                                  max={180}
                                  value={durVal}
                                  onChange={(e) => {
                                    const val = parseInt(e.target.value, 10) || 45;
                                    setEditingTest({
                                      ...editingTest,
                                      gradeDurations: {
                                        ...currentDurations,
                                        [g]: val,
                                      },
                                    });
                                  }}
                                  className="w-14 p-1 text-center font-bold bg-slate-50 border border-slate-200 rounded text-xs"
                                />
                                <span className="text-[10px] text-slate-400">daq</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {/* Advanced Test Options */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 border-t">
                    <label className="flex items-center space-x-2 p-2 bg-slate-50 border rounded-xl cursor-pointer">
                      <input
                        type="checkbox"
                        checked={editingTest.shuffleQuestions ?? true}
                        onChange={(e) =>
                          setEditingTest({ ...editingTest, shuffleQuestions: e.target.checked })
                        }
                        className="rounded text-blue-600"
                      />
                      <span className="text-xs font-semibold text-slate-800">
                        Savollarni aralashtirib berish
                      </span>
                    </label>

                    <label className="flex items-center space-x-2 p-2 bg-slate-50 border rounded-xl cursor-pointer">
                      <input
                        type="checkbox"
                        checked={editingTest.showImmediateResults ?? true}
                        onChange={(e) =>
                          setEditingTest({ ...editingTest, showImmediateResults: e.target.checked })
                        }
                        className="rounded text-blue-600"
                      />
                      <span className="text-xs font-semibold text-slate-800">
                        Natijani darhol ko'rsatish
                      </span>
                    </label>
                  </div>

                  {/* Test Password & Access Protection */}
                  <div className="p-3 bg-amber-50/60 border border-amber-200 rounded-2xl space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="block font-bold text-amber-950 uppercase text-[11px] flex items-center space-x-1">
                        <Lock className="w-3.5 h-3.5 text-amber-700" />
                        <span>Testga kirish paroli (Ixtiyoriy):</span>
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          const randomCode = `${editingTest.type || 'BSB'}-${Math.floor(100 + Math.random() * 900)}`;
                          setEditingTest({ ...editingTest, accessPassword: randomCode });
                        }}
                        className="text-[11px] font-bold text-amber-800 hover:text-amber-900 bg-amber-100 hover:bg-amber-200 px-2 py-0.5 rounded-md cursor-pointer transition-all"
                      >
                        🎲 Tasodifiy parol
                      </button>
                    </div>
                    <div className="flex items-center space-x-2">
                      <input
                        type="text"
                        value={editingTest.accessPassword || ''}
                        onChange={(e) => setEditingTest({ ...editingTest, accessPassword: e.target.value })}
                        placeholder="Masalan: BSB-481 yoki bo'sh qoldiring (parolsiz)"
                        className="flex-1 p-2 bg-white border border-amber-300 rounded-xl font-mono text-xs font-bold text-amber-950 placeholder:font-sans placeholder:font-normal"
                      />
                      {editingTest.accessPassword && (
                        <button
                          type="button"
                          onClick={() => setEditingTest({ ...editingTest, accessPassword: undefined })}
                          className="px-2.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-xs font-semibold cursor-pointer"
                        >
                          O'chirish
                        </button>
                      )}
                    </div>
                    <p className="text-[10px] text-amber-800/80">
                      Agar parol kiritilsa, o'quvchi testni boshlashdan oldin o'qituvchi bergan parolni kiritishi shart bo'ladi.
                    </p>
                  </div>

                  {/* Status Selection */}
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl space-y-1.5">
                    <label className="block font-bold text-slate-700 uppercase text-[11px]">
                      Imtihon holati (Start / Finish):
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      <button
                        type="button"
                        onClick={() => setEditingTest({ ...editingTest, status: 'active', isActive: true })}
                        className={`py-2 px-1 text-center rounded-xl text-xs font-bold border transition-all ${
                          editingTest.status === 'active' || (editingTest.status === undefined && editingTest.isActive)
                            ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                            : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        🟢 Start (Faol)
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingTest({ ...editingTest, status: 'waiting', isActive: false })}
                        className={`py-2 px-1 text-center rounded-xl text-xs font-bold border transition-all ${
                          editingTest.status === 'waiting'
                            ? 'bg-amber-500 text-white border-amber-500 shadow-xs'
                            : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        🟡 Kutilmoqda
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingTest({ ...editingTest, status: 'finished', isActive: false })}
                        className={`py-2 px-1 text-center rounded-xl text-xs font-bold border transition-all ${
                          editingTest.status === 'finished'
                            ? 'bg-rose-600 text-white border-rose-600 shadow-xs'
                            : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        🔴 Finish (Yopiq)
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 uppercase mb-1">Tavsif:</label>
                    <textarea
                      rows={2}
                      value={editingTest.description || ''}
                      onChange={(e) => setEditingTest({ ...editingTest, description: e.target.value })}
                      placeholder="Imtihon qaysi mavzularni o'z ichiga oladi..."
                      className="w-full p-2 bg-slate-50 border rounded-xl"
                    />
                  </div>
                </div>

                <div className="flex justify-end space-x-2 pt-3 border-t">
                  <button
                    onClick={() => setEditingTest(null)}
                    className="px-4 py-2 bg-slate-100 rounded-xl text-xs font-bold"
                  >
                    Bekor qilish
                  </button>
                  <button
                    onClick={() => handleSaveTest(editingTest)}
                    className="px-5 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold cursor-pointer"
                  >
                    Saqlash
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 5: ANALITIKA, SORTING VA EXCEL EKSPORT */}
      {activeTab === 'analytics' && (
        <div className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200 shadow-xs space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h3 className="text-lg font-bold text-slate-900 flex items-center space-x-2">
                <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
                <span>O'quvchilar Analitikasi va Excel Hisobot</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Topshirilgan barcha BSB va ChSB imtihonlari natijalari, ballari va qoidabuzarliklar statistikasi
              </p>
            </div>

            <button
              onClick={() => exportSubmissionsToExcel(filteredSubmissions)}
              className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center space-x-2 shadow-md shadow-emerald-600/20 cursor-pointer transition-all"
            >
              <Download className="w-4 h-4" />
              <span>Excel Fayl Qilib Yuklab Olish (.xlsx)</span>
            </button>
          </div>

          {/* Quick Metrics Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl">
              <span className="text-[11px] text-slate-500 font-semibold uppercase">Jami topshirganlar</span>
              <p className="text-2xl font-black text-slate-900 mt-1">{totalStudents} ta</p>
            </div>
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-2xl">
              <span className="text-[11px] text-blue-700 font-semibold uppercase">O'rtacha ball</span>
              <p className="text-2xl font-black text-blue-800 mt-1">{avgScore} ball</p>
            </div>
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl">
              <span className="text-[11px] text-emerald-700 font-semibold uppercase">O'zlashtirish foizi</span>
              <p className="text-2xl font-black text-emerald-800 mt-1">{avgPercentage}%</p>
            </div>
            <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl">
              <span className="text-[11px] text-rose-700 font-semibold uppercase">Chetlashtirilganlar</span>
              <p className="text-2xl font-black text-rose-800 mt-1">{disqualifiedCount} ta</p>
            </div>
          </div>

          {/* Filters & Sorting Bar */}
          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 flex flex-col md:flex-row gap-3 items-center justify-between text-xs">
            <div className="relative w-full md:w-64">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3 pointer-events-none" />
              <input
                type="text"
                placeholder="O'quvchi ismi yoki test..."
                value={analyticsSearch}
                onChange={(e) => setAnalyticsSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-2 bg-white border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <div className="flex flex-wrap gap-2 w-full md:w-auto items-center">
              <select
                value={analyticsGradeFilter}
                onChange={(e) => setAnalyticsGradeFilter(e.target.value)}
                className="p-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold"
              >
                <option value="all">Barcha sinflar</option>
                {[5, 6, 7, 8, 9, 10, 11].map((g) => (
                  <option key={g} value={g}>{g}-sinf</option>
                ))}
              </select>

              <select
                value={analyticsTypeFilter}
                onChange={(e) => setAnalyticsTypeFilter(e.target.value)}
                className="p-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold"
              >
                <option value="all">Barcha turlar</option>
                <option value="BSB">Faqat BSB</option>
                <option value="ChSB">Faqat ChSB</option>
              </select>

              <select
                value={analyticsGroupFilter}
                onChange={(e) => setAnalyticsGroupFilter(e.target.value)}
                className="p-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-800"
              >
                <option value="all">Barcha sinflar (A1, A2, AT, T)</option>
                <option value="A1">A1 sinflari</option>
                <option value="A2">A2 sinflari</option>
                <option value="AT">AT sinflari</option>
                <option value="T">T sinflari</option>
              </select>

              <div className="flex items-center space-x-1 bg-white p-1 rounded-xl border border-slate-200">
                <span className="text-[11px] text-slate-400 px-1 font-medium">Saralash:</span>
                <button
                  onClick={() => {
                    if (sortBy === 'score') setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                    else { setSortBy('score'); setSortOrder('desc'); }
                  }}
                  className={`px-2 py-1 rounded-lg font-bold text-[11px] ${
                    sortBy === 'score' ? 'bg-blue-600 text-white' : 'text-slate-600'
                  }`}
                >
                  Ball {sortBy === 'score' ? (sortOrder === 'asc' ? '↑' : '↓') : ''}
                </button>
                <button
                  onClick={() => {
                    if (sortBy === 'name') setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                    else { setSortBy('name'); setSortOrder('asc'); }
                  }}
                  className={`px-2 py-1 rounded-lg font-bold text-[11px] ${
                    sortBy === 'name' ? 'bg-blue-600 text-white' : 'text-slate-600'
                  }`}
                >
                  Ism {sortBy === 'name' ? (sortOrder === 'asc' ? '↑' : '↓') : ''}
                </button>
                <button
                  onClick={() => {
                    if (sortBy === 'warnings') setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                    else { setSortBy('warnings'); setSortOrder('desc'); }
                  }}
                  className={`px-2 py-1 rounded-lg font-bold text-[11px] ${
                    sortBy === 'warnings' ? 'bg-blue-600 text-white' : 'text-slate-600'
                  }`}
                >
                  Qoidabuzarlik {sortBy === 'warnings' ? (sortOrder === 'asc' ? '↑' : '↓') : ''}
                </button>
              </div>
            </div>
          </div>

          {/* Submissions Table */}
          {filteredSubmissions.length === 0 ? (
            <div className="text-center py-12 border-2 border-dashed border-slate-200 rounded-2xl text-xs text-slate-400">
              Natijalar topilmadi. O'quvchilar test topshirgach ularning natijalari bu yerda avtomatik jamlanadi.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 uppercase tracking-wider font-bold border-y border-slate-200">
                  <tr>
                    <th className="py-3 px-3">№</th>
                    <th className="py-3 px-4">O'quvchi</th>
                    <th className="py-3 px-3">Sinf</th>
                    <th className="py-3 px-4">Test</th>
                    <th className="py-3 px-3">Ball</th>
                    <th className="py-3 px-3">Foiz</th>
                    <th className="py-3 px-3">Qoidabuzarlik</th>
                    <th className="py-3 px-3">Vaqt</th>
                    <th className="py-3 px-4">Holat</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredSubmissions.map((sub, idx) => {
                    const isDisq = sub.status === 'disqualified';
                    const minutes = Math.floor((sub.durationSpentSeconds || 0) / 60);

                    return (
                      <tr key={sub.id} className="hover:bg-slate-50/80 transition-all">
                        <td className="py-3 px-3 text-slate-400 font-mono">{idx + 1}</td>
                        <td className="py-3 px-4 font-bold text-slate-900">{sub.studentName}</td>
                        <td className="py-3 px-3 font-semibold text-slate-600">
                          {sub.grade}-{sub.group}
                        </td>
                        <td className="py-3 px-4 text-slate-700 max-w-[180px] truncate">
                          {sub.testTitle}
                        </td>
                        <td className="py-3 px-3 font-bold text-slate-900">
                          {sub.score} / {sub.maxScore}
                        </td>
                        <td className="py-3 px-3">
                          <span
                            className={`font-black ${
                              sub.percentage >= 70
                                ? 'text-emerald-600'
                                : sub.percentage >= 50
                                ? 'text-amber-600'
                                : 'text-rose-600'
                            }`}
                          >
                            {sub.percentage}%
                          </span>
                        </td>
                        <td className="py-3 px-3">
                          {sub.tabSwitchCount > 0 ? (
                            <span className="font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200">
                              {sub.tabSwitchCount} ta ogohlantirish
                            </span>
                          ) : (
                            <span className="text-emerald-600 font-semibold">0 ta</span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-slate-500">{minutes} daq</td>
                        <td className="py-3 px-4">
                          {isDisq ? (
                            <span className="px-2 py-0.5 bg-rose-100 text-rose-800 rounded-md font-bold text-[11px]">
                              Chetlashtirildi
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-md font-bold text-[11px]">
                              Muvaffaqiyatli
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
