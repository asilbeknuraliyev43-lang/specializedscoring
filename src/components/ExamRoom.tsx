import React, { useState, useEffect, useRef } from 'react';
import {
  Clock,
  ShieldAlert,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Send,
  Maximize2,
  Minimize2,
  CheckCircle2,
  XCircle,
  HelpCircle,
  FileText,
  Eye,
  ZoomIn,
  AlertOctagon,
} from 'lucide-react';
import { Test, Question, StudentProfile, ExamSession, Submission } from '../types';
import { useAntiCheat } from '../utils/antiCheat';
import { ExamResultAnalysis } from './ExamResultAnalysis';
import {
  createExamSession,
  updateExamSession,
  submitExamResult,
} from '../services/dbService';

interface ExamRoomProps {
  test: Test;
  questions: Question[];
  student: StudentProfile;
  onExit: () => void;
}

export const ExamRoom: React.FC<ExamRoomProps> = ({
  test,
  questions: initialQuestions,
  student,
  onExit,
}) => {
  // Determine effective duration for student's specific grade (safeguarded against 0 or NaN)
  const effectiveDurationMinutes = Math.max(
    5,
    Number(
      (test.gradeDurations && test.gradeDurations[student.grade])
        ? test.gradeDurations[student.grade]
        : test.durationMinutes
    ) || 45
  );

  // Question list (shuffled if test.shuffleQuestions is true)
  const [questions] = useState<Question[]>(() => {
    if (test.shuffleQuestions) {
      return [...initialQuestions].sort(() => Math.random() - 0.5);
    }
    return initialQuestions;
  });

  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [secondsRemaining, setSecondsRemaining] = useState<number>(effectiveDurationMinutes * 60);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Anti-cheat modal states
  const [showWarningModal, setShowWarningModal] = useState(false);
  const [warningCount, setWarningCount] = useState(0);
  const [isDisqualified, setIsDisqualified] = useState(false);
  const [disqualifyReason, setDisqualifyReason] = useState('');

  // Submission state
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [submissionResult, setSubmissionResult] = useState<Submission | null>(null);

  // Zoom image
  const [zoomedImage, setZoomedImage] = useState<string | null>(null);

  // Session ID
  const sessionIdRef = useRef<string>(
    `sess_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`
  );
  const startTimeRef = useRef<number>(Date.now());

  // Init Exam Session in Firestore & fullscreen
  useEffect(() => {
    // Attempt fullscreen immediately
    try {
      if (document.documentElement.requestFullscreen && !document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(() => {});
      }
    } catch (e) {}

    const handleFsChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFsChange);

    const initSession: ExamSession = {
      id: sessionIdRef.current,
      testId: test.id,
      testTitle: test.title,
      studentName: student.fullName,
      grade: student.grade,
      group: student.group,
      status: 'in_progress',
      startTime: new Date().toISOString(),
      endTime: new Date(Date.now() + effectiveDurationMinutes * 60 * 1000).toISOString(),
      lastPing: new Date().toISOString(),
      currentQuestionIndex: 1,
      totalQuestions: questions.length,
      tabSwitchCount: 0,
      warnings: [],
      isDisqualified: false,
      answers: {},
    };
    createExamSession(initSession);

    return () => {
      document.removeEventListener('fullscreenchange', handleFsChange);
    };
  }, []);

  // Periodic heartbeat / sync to Firebase every 8 seconds
  useEffect(() => {
    if (isSubmitted || isDisqualified) return;

    const interval = setInterval(() => {
      updateExamSession(sessionIdRef.current, {
        lastPing: new Date().toISOString(),
        currentQuestionIndex: currentIndex + 1,
        answers,
      });
    }, 8000);

    return () => clearInterval(interval);
  }, [currentIndex, answers, isSubmitted, isDisqualified]);

  // Anti-cheat Hook with warning modal awareness
  useAntiCheat({
    isActive: !isSubmitted && !isDisqualified,
    isWarningModalOpen: showWarningModal,
    onWarning: (count) => {
      setWarningCount(count);
      setShowWarningModal(true);
      // Update session in Firestore
      updateExamSession(sessionIdRef.current, {
        tabSwitchCount: count,
        warnings: [
          {
            timestamp: new Date().toISOString(),
            reason: `1-marta boshqa oynaga/tabga o'tildi`,
          },
        ],
      });
    },
    onDisqualify: (reason) => {
      setIsDisqualified(true);
      setDisqualifyReason(reason);
      setWarningCount(2);

      // Create disqualified submission
      const spentSec = Math.round((Date.now() - startTimeRef.current) / 1000);
      const disqualifiedSubmission: Submission = {
        id: `sub_${sessionIdRef.current}`,
        sessionId: sessionIdRef.current,
        testId: test.id,
        testTitle: test.title,
        testType: test.type,
        subject: test.subject,
        studentName: student.fullName,
        grade: student.grade,
        group: student.group,
        score: 0,
        maxScore: test.totalPoints,
        percentage: 0,
        tabSwitchCount: 2,
        submittedAt: new Date().toISOString(),
        durationSpentSeconds: spentSec,
        status: 'disqualified',
        answers,
        disqualifyReason: reason,
      };

      submitExamResult(disqualifiedSubmission, sessionIdRef.current);
    },
  });

  // Timer countdown
  useEffect(() => {
    if (isSubmitted || isDisqualified) return;

    const timer = setInterval(() => {
      setSecondsRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          handleAutoSubmit('Vaqt tugadi!');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isSubmitted, isDisqualified]);

  // Fullscreen toggle
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  const handleSelectAnswer = (qId: string, ans: string) => {
    setAnswers((prev) => ({
      ...prev,
      [qId]: ans,
    }));
  };

  const handleAutoSubmit = (reason = '') => {
    handleSubmitExam(reason);
  };

  const handleSubmitExam = async (reason = '') => {
    if (isSubmitted) return;

    const spentSec = Math.round((Date.now() - startTimeRef.current) / 1000);

    // Calculate score
    let totalScore = 0;
    let maxScore = 0;

    questions.forEach((q) => {
      maxScore += q.points;
      const studentAns = (answers[q.id] || '').trim();

      if (q.type === 'multiple_choice') {
        if (
          studentAns &&
          q.correctAnswer &&
          studentAns.toUpperCase() === q.correctAnswer.toUpperCase()
        ) {
          totalScore += q.points;
        }
      } else if (q.type === 'true_false') {
        if (
          studentAns &&
          q.correctAnswer &&
          studentAns.toLowerCase() === q.correctAnswer.toLowerCase()
        ) {
          totalScore += q.points;
        }
      } else if (q.type === 'fill_blank') {
        if (
          studentAns &&
          q.correctAnswer &&
          (studentAns.toLowerCase() === q.correctAnswer.toLowerCase() ||
            studentAns.toLowerCase().includes(q.correctAnswer.toLowerCase()))
        ) {
          totalScore += q.points;
        }
      } else if (q.type === 'matching') {
        if (studentAns && q.matchingPairs) {
          try {
            const parsedMap = JSON.parse(studentAns);
            let correctPairs = 0;
            q.matchingPairs.forEach((pair) => {
              if (parsedMap[pair.id] === pair.right) {
                correctPairs += 1;
              }
            });
            const ratio = correctPairs / q.matchingPairs.length;
            totalScore += Math.round(q.points * ratio);
          } catch (e) {}
        }
      } else {
        // Written answer: award baseline for answered written question
        if (studentAns && studentAns.length >= 5) {
          totalScore += Math.round(q.points * 0.8);
        }
      }
    });

    const percentage = Math.round((totalScore / (maxScore || 1)) * 100);

    const submission: Submission = {
      id: `sub_${sessionIdRef.current}`,
      sessionId: sessionIdRef.current,
      testId: test.id,
      testTitle: test.title,
      testType: test.type,
      subject: test.subject,
      studentName: student.fullName,
      grade: student.grade,
      group: student.group,
      score: totalScore,
      maxScore: maxScore || test.totalPoints,
      percentage,
      tabSwitchCount: warningCount,
      submittedAt: new Date().toISOString(),
      durationSpentSeconds: spentSec,
      status: 'passed',
      answers,
      disqualifyReason: reason || undefined,
    };

    try {
      await submitExamResult(submission, sessionIdRef.current);
    } catch (e) {
      console.error('Error submitting exam:', e);
    }

    setSubmissionResult(submission);
    setIsSubmitted(true);
    setShowSubmitModal(false);
  };

  // Format time MM:SS
  const minutes = Math.floor(secondsRemaining / 60);
  const seconds = secondsRemaining % 60;
  const timeString = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  const isTimeCritical = minutes < 5;

  const currentQ = questions[currentIndex] || questions[0];
  const answeredCount = Object.keys(answers).filter((k) => (answers[k] || '').trim().length > 0).length;

  // If already submitted, show comprehensive results analysis view
  if (isSubmitted && submissionResult) {
    return (
      <ExamResultAnalysis
        submission={submissionResult}
        test={test}
        questions={questions}
        student={student}
        onExit={onExit}
      />
    );
  }

  // If Disqualified view
  if (isDisqualified) {
    return (
      <div className="min-h-screen bg-rose-50 flex items-center justify-center p-4">
        <div className="max-w-xl w-full bg-white rounded-3xl border border-rose-200 p-8 shadow-2xl text-center space-y-6">
          <div className="w-18 h-18 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mx-auto animate-bounce">
            <AlertOctagon className="w-10 h-10" />
          </div>

          <div>
            <span className="inline-block px-3 py-1 rounded-full bg-rose-100 text-rose-800 text-xs font-bold uppercase tracking-wider mb-2">
              Qoidabuzarlik Aniqlangan
            </span>
            <h2 className="text-2xl font-black text-slate-900 tracking-tight">
              Imtihon To'xtatildi va Siz Chetlashtirildingiz!
            </h2>
            <p className="text-xs text-rose-600 mt-2 font-medium">
              {disqualifyReason || "2-marta boshqa tabga yoki dasturga o'tilganligi sababli test bekor qilindi."}
            </p>
          </div>

          <div className="bg-rose-50/50 p-5 rounded-2xl border border-rose-100 text-left text-xs text-slate-700 space-y-2">
            <p>
              <strong>O'quvchi:</strong> {student.fullName} ({student.grade}-{student.group})
            </p>
            <p>
              <strong>Test:</strong> {test.title}
            </p>
            <p className="text-rose-700 font-semibold">
              Holat: Imtihon qoidalari buzildi (2 ta ogohlantirish). Barcha ma'lumotlar o'qituvchi va admin paneliga yuborildi.
            </p>
          </div>

          <button
            onClick={onExit}
            className="w-full py-3.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold uppercase tracking-wider cursor-pointer transition-all"
          >
            Chiqish
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col select-none">
      {/* Top Proctoring Header Bar */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          {/* Test Info */}
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 bg-blue-50 border border-blue-200 rounded-lg flex items-center justify-center text-blue-600 font-bold text-xs">
              {test.grade}
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900 leading-tight">
                {test.title}
              </h2>
              <p className="text-[11px] text-slate-500">
                O'quvchi: <strong className="text-slate-700">{student.fullName}</strong> ({student.grade}-{student.group})
              </p>
            </div>
          </div>

          {/* Right Status: Timer & Proctoring Indicators */}
          <div className="flex items-center space-x-3 sm:space-x-5">
            {/* Anti-cheat status pill */}
            <div className="hidden sm:flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
              <ShieldAlert className="w-3.5 h-3.5 text-emerald-600" />
              <span>Anti-Cheat Faol</span>
              {warningCount > 0 && (
                <span className="ml-1 bg-amber-500 text-white px-1.5 py-0.2 rounded-full text-[10px]">
                  {warningCount}/2 ogohlantirish
                </span>
              )}
            </div>

            {/* Countdown Timer */}
            <div
              className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-xl border font-mono font-bold text-sm tracking-wider ${
                isTimeCritical
                  ? 'bg-rose-50 border-rose-300 text-rose-600 animate-pulse'
                  : 'bg-slate-50 border-slate-200 text-slate-800'
              }`}
            >
              <Clock className={`w-4 h-4 ${isTimeCritical ? 'text-rose-600' : 'text-blue-600'}`} />
              <span>{timeString}</span>
            </div>

            {/* Fullscreen Button */}
            <button
              onClick={toggleFullscreen}
              title="To'liq ekran"
              className="p-2 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200 cursor-pointer"
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>

            {/* Finish/Submit button */}
            <button
              onClick={() => setShowSubmitModal(true)}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold uppercase tracking-wider rounded-xl shadow-sm flex items-center space-x-1.5 cursor-pointer transition-all"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Yakunlash</span>
            </button>
          </div>
        </div>
      </header>

      {/* Fullscreen Alert Banner if not in fullscreen */}
      {!isFullscreen && (
        <div className="bg-gradient-to-r from-amber-500 to-amber-600 text-white px-4 py-2.5 flex flex-wrap items-center justify-between text-xs font-medium shadow-xs">
          <div className="flex items-center space-x-2">
            <AlertTriangle className="w-4 h-4 text-amber-200 shrink-0" />
            <span>Xalqaro imtihon standartiga binoan test to'liq ekran (Fullscreen) rejimida topshirilishi talab etiladi.</span>
          </div>
          <button
            onClick={() => {
              try {
                if (document.documentElement.requestFullscreen) {
                  document.documentElement.requestFullscreen().catch(() => {});
                  setIsFullscreen(true);
                }
              } catch (e) {}
            }}
            className="mt-1 sm:mt-0 bg-white text-amber-900 font-bold px-3 py-1 rounded-lg hover:bg-amber-50 transition-all text-xs cursor-pointer shadow-xs flex items-center space-x-1"
          >
            <Maximize2 className="w-3.5 h-3.5" />
            <span>To'liq Ekranga O'tish</span>
          </button>
        </div>
      )}

      {/* Main Exam Content Area */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 flex-1 w-full grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Current Question */}
        <div className="lg:col-span-8 bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-xs">
          {currentQ ? (
            <div className="space-y-6">
              {/* Question Header */}
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <div className="flex items-center space-x-2">
                  <span className="px-3 py-1 rounded-lg bg-blue-50 text-blue-700 text-xs font-bold">
                    Savol {currentIndex + 1} / {questions.length}
                  </span>
                  <span className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-600 text-xs font-semibold">
                    {currentQ.type === 'multiple_choice' ? 'Variantli test' : 'Yozma savol'}
                  </span>
                </div>

                <span className="text-xs font-bold text-slate-500 bg-amber-50 text-amber-800 border border-amber-200 px-2.5 py-0.5 rounded-full">
                  {currentQ.points} ball
                </span>
              </div>

              {/* Question Text */}
              <div className="text-base sm:text-lg font-semibold text-slate-900 leading-relaxed whitespace-pre-wrap">
                {currentQ.text}
              </div>

              {/* Question Image (if any) */}
              {currentQ.imageUrl && (
                <div className="relative group max-w-md mx-auto my-4 border border-slate-200 rounded-xl overflow-hidden shadow-xs bg-slate-50">
                  <img
                    src={currentQ.imageUrl}
                    alt={`Savol ${currentIndex + 1} rasmi`}
                    className="w-full max-h-72 object-contain mx-auto"
                  />
                  <button
                    type="button"
                    onClick={() => setZoomedImage(currentQ.imageUrl || null)}
                    className="absolute bottom-2 right-2 p-2 bg-slate-900/80 text-white rounded-lg hover:bg-slate-900 transition-all text-xs flex items-center space-x-1"
                  >
                    <ZoomIn className="w-3.5 h-3.5" />
                    <span>Kattalashtirish</span>
                  </button>
                </div>
              )}

              {/* Answer Section */}
              <div className="pt-2">
                {/* 1. Multiple Choice */}
                {currentQ.type === 'multiple_choice' && (
                  <div className="space-y-3">
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-2">
                      Variantlardan birini tanlang:
                    </span>
                    {(currentQ.options || ['A) Variant 1', 'B) Variant 2', 'C) Variant 3', 'D) Variant 4']).map(
                      (opt, optIdx) => {
                        const optLetter = opt.substring(0, 1).toUpperCase();
                        const isSelected = answers[currentQ.id] === optLetter;

                        return (
                          <label
                            key={optIdx}
                            onClick={() => handleSelectAnswer(currentQ.id, optLetter)}
                            className={`flex items-center space-x-3.5 p-4 rounded-xl border cursor-pointer transition-all ${
                              isSelected
                                ? 'bg-blue-50/70 border-blue-500 shadow-xs'
                                : 'bg-white border-slate-200 hover:bg-slate-50'
                            }`}
                          >
                            <div
                              className={`w-6 h-6 rounded-full border-2 flex items-center justify-center font-bold text-xs shrink-0 transition-all ${
                                isSelected
                                  ? 'border-blue-600 bg-blue-600 text-white'
                                  : 'border-slate-300 text-slate-600'
                              }`}
                            >
                              {optLetter}
                            </div>
                            <span className="text-sm font-medium text-slate-800 leading-snug">
                              {opt.replace(/^[A-DА-Дa-dа-д][\.\)]\s*/, '')}
                            </span>
                          </label>
                        );
                      }
                    )}
                  </div>
                )}

                {/* 2. True / False */}
                {currentQ.type === 'true_false' && (
                  <div className="space-y-3">
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-2">
                      Tasdiqning to'g'riligini belgilang:
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <button
                        type="button"
                        onClick={() => handleSelectAnswer(currentQ.id, 'true')}
                        className={`p-5 rounded-2xl border-2 flex items-center justify-center space-x-3 cursor-pointer transition-all ${
                          answers[currentQ.id]?.toLowerCase() === 'true'
                            ? 'bg-emerald-50 border-emerald-500 text-emerald-800 shadow-sm'
                            : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <CheckCircle2
                          className={`w-6 h-6 ${
                            answers[currentQ.id]?.toLowerCase() === 'true'
                              ? 'text-emerald-600'
                              : 'text-slate-400'
                          }`}
                        />
                        <span className="text-base font-bold">TO'G'RI (HA)</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleSelectAnswer(currentQ.id, 'false')}
                        className={`p-5 rounded-2xl border-2 flex items-center justify-center space-x-3 cursor-pointer transition-all ${
                          answers[currentQ.id]?.toLowerCase() === 'false'
                            ? 'bg-rose-50 border-rose-500 text-rose-800 shadow-sm'
                            : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <XCircle
                          className={`w-6 h-6 ${
                            answers[currentQ.id]?.toLowerCase() === 'false'
                              ? 'text-rose-600'
                              : 'text-slate-400'
                          }`}
                        />
                        <span className="text-base font-bold">NOTO'G'RI (YO'Q)</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* 3. Fill in the Blank */}
                {currentQ.type === 'fill_blank' && (
                  <div className="space-y-3">
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">
                      Nuqtalar o'rniga mos keluvchi javob yoki formulani kiriting:
                    </span>

                    {/* Math & Science Quick Toolbar */}
                    <div className="flex flex-wrap gap-1 p-2 bg-slate-100 rounded-xl items-center">
                      <span className="text-[11px] font-bold text-slate-500 mr-1.5">Matematik belgilar:</span>
                      {['√', '²', '³', 'π', '±', '≤', '≥', '÷', '×', '°', 'α', 'β', 'Δ', '∑', '∫'].map((sym) => (
                        <button
                          key={sym}
                          type="button"
                          onClick={() => {
                            const cur = answers[currentQ.id] || '';
                            handleSelectAnswer(currentQ.id, cur + sym);
                          }}
                          className="w-7 h-7 bg-white hover:bg-blue-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-800 transition-all cursor-pointer"
                        >
                          {sym}
                        </button>
                      ))}
                    </div>

                    <div className="relative">
                      <input
                        type="text"
                        value={answers[currentQ.id] || ''}
                        onChange={(e) => handleSelectAnswer(currentQ.id, e.target.value)}
                        placeholder="Javobingizni bu yerga kiriting..."
                        className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white text-slate-900 font-semibold"
                      />
                    </div>
                  </div>
                )}

                {/* 4. Matching Pairs */}
                {currentQ.type === 'matching' && currentQ.matchingPairs && (
                  <div className="space-y-3">
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-2">
                      Chap tarafdagi elementlarga o'ng tarafdagi mos javobni tanlang:
                    </span>
                    <div className="space-y-3">
                      {currentQ.matchingPairs.map((pair, pIdx) => {
                        let currentMatches: Record<string, string> = {};
                        try {
                          currentMatches = JSON.parse(answers[currentQ.id] || '{}');
                        } catch (e) {}

                        return (
                          <div
                            key={pair.id || pIdx}
                            className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
                          >
                            <div className="flex items-center space-x-2">
                              <span className="w-6 h-6 rounded-md bg-blue-100 text-blue-800 font-bold text-xs flex items-center justify-center shrink-0">
                                {pIdx + 1}
                              </span>
                              <span className="text-xs font-bold text-slate-900">{pair.left}</span>
                            </div>

                            <div className="w-full sm:w-64">
                              <select
                                value={currentMatches[pair.id] || ''}
                                onChange={(e) => {
                                  const updated = { ...currentMatches, [pair.id]: e.target.value };
                                  handleSelectAnswer(currentQ.id, JSON.stringify(updated));
                                }}
                                className="w-full p-2 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-blue-500"
                              >
                                <option value="">-- Mos javobni tanlang --</option>
                                {currentQ.matchingPairs?.map((optPair, oIdx) => (
                                  <option key={oIdx} value={optPair.right}>
                                    {optPair.right}
                                  </option>
                                ))}
                              </select>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* 5. Written Question */}
                {currentQ.type === 'written' && (
                  <div className="space-y-3">
                    <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
                      Yozma javobingizni yoki yechimini kiriting:
                    </label>

                    {/* Math & Science Quick Toolbar */}
                    <div className="flex flex-wrap gap-1 p-2 bg-slate-100 rounded-xl items-center">
                      <span className="text-[11px] font-bold text-slate-500 mr-1.5">Matematik belgilar:</span>
                      {['√', '²', '³', 'π', '±', '≤', '≥', '÷', '×', '°', 'α', 'β', 'Δ', '∑', '∫'].map((sym) => (
                        <button
                          key={sym}
                          type="button"
                          onClick={() => {
                            const cur = answers[currentQ.id] || '';
                            handleSelectAnswer(currentQ.id, cur + sym);
                          }}
                          className="w-7 h-7 bg-white hover:bg-blue-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-800 transition-all cursor-pointer"
                        >
                          {sym}
                        </button>
                      ))}
                    </div>

                    <textarea
                      rows={5}
                      value={answers[currentQ.id] || ''}
                      onChange={(e) => handleSelectAnswer(currentQ.id, e.target.value)}
                      placeholder="Javobingizni va yechim bosqichlarini batafsil tushuntiring..."
                      className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white text-slate-800"
                    />
                    <div className="flex justify-between text-[11px] text-slate-400">
                      <span>Yozma savol o'qituvchi tomonidan qo'lda tekshiriladi</span>
                      <span>{(answers[currentQ.id] || '').length} belgi</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Prev / Next Navigation Buttons */}
              <div className="pt-6 border-t border-slate-100 flex items-center justify-between">
                <button
                  type="button"
                  disabled={currentIndex === 0}
                  onClick={() => setCurrentIndex((prev) => Math.max(0, prev - 1))}
                  className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center space-x-1.5 transition-all ${
                    currentIndex === 0
                      ? 'text-slate-300 cursor-not-allowed'
                      : 'text-slate-700 bg-slate-100 hover:bg-slate-200 cursor-pointer'
                  }`}
                >
                  <ChevronLeft className="w-4 h-4" />
                  <span>Oldingi savol</span>
                </button>

                {currentIndex < questions.length - 1 ? (
                  <button
                    type="button"
                    onClick={() => setCurrentIndex((prev) => Math.min(questions.length - 1, prev + 1))}
                    className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 flex items-center space-x-1.5 cursor-pointer shadow-xs transition-all"
                  >
                    <span>Keyingi savol</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setShowSubmitModal(true)}
                    className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 flex items-center space-x-1.5 cursor-pointer shadow-xs transition-all"
                  >
                    <span>Testni yakunlash</span>
                    <Send className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="text-center py-12 text-slate-500">Savollar mavjud emas</div>
          )}
        </div>

        {/* Right Column: Question Navigator & Statistics */}
        <div className="lg:col-span-4 space-y-5">
          {/* Question grid navigator */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                Savollar xaritasi
              </h3>
              <span className="text-xs font-semibold text-blue-600">
                {answeredCount} / {questions.length} belgilandi
              </span>
            </div>

            <div className="grid grid-cols-5 gap-2">
              {questions.map((q, idx) => {
                const isAns = (answers[q.id] || '').trim().length > 0;
                const isCurr = currentIndex === idx;

                return (
                  <button
                    key={q.id}
                    type="button"
                    onClick={() => setCurrentIndex(idx)}
                    className={`h-10 rounded-xl text-xs font-bold transition-all relative ${
                      isCurr
                        ? 'ring-2 ring-blue-600 bg-blue-600 text-white shadow-sm'
                        : isAns
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-300 hover:bg-emerald-100'
                        : 'bg-slate-50 text-slate-600 border border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {idx + 1}
                    {isAns && !isCurr && (
                      <span className="absolute top-1 right-1 w-1.5 h-1.5 bg-emerald-500 rounded-full"></span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Legend */}
            <div className="mt-5 pt-4 border-t border-slate-100 grid grid-cols-2 gap-2 text-[11px] text-slate-500">
              <div className="flex items-center space-x-2">
                <span className="w-3 h-3 rounded bg-blue-600"></span>
                <span>Joriy savol</span>
              </div>
              <div className="flex items-center space-x-2">
                <span className="w-3 h-3 rounded bg-emerald-100 border border-emerald-300"></span>
                <span>Javob berilgan</span>
              </div>
              <div className="flex items-center space-x-2">
                <span className="w-3 h-3 rounded bg-slate-100 border border-slate-200"></span>
                <span>Javobsiz</span>
              </div>
            </div>
          </div>

          {/* Anti-cheat guidelines card */}
          <div className="bg-amber-50/70 border border-amber-200/80 rounded-2xl p-5 text-amber-900 space-y-2">
            <div className="flex items-center space-x-2 text-xs font-bold text-amber-800">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>Qat'iy qoidalar:</span>
            </div>
            <ul className="text-[11px] text-amber-800/90 space-y-1 list-disc list-inside leading-relaxed">
              <li>Boshqa brauzer oynasiga yoki ilovaga o'tish taqiqlanadi.</li>
              <li>1-marta ogohlantirish beriladi, 2-marta imtihon to'xtatiladi.</li>
              <li>F12, nusxa olish va kontekst menyusi bloklangan.</li>
            </ul>
          </div>
        </div>
      </main>

      {/* 1st Tab Switch Warning Modal */}
      {showWarningModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-8 text-center space-y-5 shadow-2xl border-4 border-amber-400 animate-in fade-in zoom-in-95 duration-200">
            <div className="w-16 h-16 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mx-auto">
              <AlertTriangle className="w-9 h-9" />
            </div>

            <div>
              <span className="px-3 py-1 bg-amber-100 text-amber-800 text-xs font-bold uppercase tracking-wider rounded-full">
                1-OGOHLANTIRISH!
              </span>
              <h3 className="text-xl font-black text-slate-900 mt-2">
                Siz Boshqa Oynaga O'tdingiz!
              </h3>
              <p className="text-xs text-slate-600 mt-2 leading-relaxed">
                Diqqat! Imtihon paytida boshqa tab yoki dasturlarga o'tish qat'iyan taqiqlanadi!
                Ushbu qoidabuzarlik tizimga qayd etildi.
              </p>
              <div className="mt-3 p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 font-bold">
                ⚠️ Agarda yana bir marta boshqa oynaga o'tsangiz, imtihoningiz darhol to'xtatiladi va natijangiz bekor qilinadi!
              </div>
            </div>

            <button
              onClick={() => {
                setShowWarningModal(false);
                try {
                  if (document.documentElement.requestFullscreen && !document.fullscreenElement) {
                    document.documentElement.requestFullscreen().catch(() => {});
                  }
                } catch (e) {}
              }}
              className="w-full py-3 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold uppercase tracking-wider cursor-pointer shadow-md shadow-amber-500/20"
            >
              Tushundim, Imtihonga Qaytish
            </button>
          </div>
        </div>
      )}

      {/* Submit Confirmation Modal */}
      {showSubmitModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-8 text-center space-y-5 shadow-2xl border border-slate-200">
            <div className="w-14 h-14 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mx-auto">
              <Send className="w-7 h-7" />
            </div>

            <div>
              <h3 className="text-xl font-bold text-slate-900">
                Imtihonni Yakunlashni Tasdiqlaysizmi?
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Jami {questions.length} ta savoldan {answeredCount} tasiga javob berdingiz.
                {questions.length - answeredCount > 0 && (
                  <span className="text-amber-600 font-semibold block mt-1">
                    Diqqat: {questions.length - answeredCount} ta savol javobsiz qoldi!
                  </span>
                )}
              </p>
            </div>

            <div className="flex space-x-3 pt-2">
              <button
                type="button"
                onClick={() => setShowSubmitModal(false)}
                className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold uppercase tracking-wider cursor-pointer transition-all"
              >
                Ortga Qaytish
              </button>
              <button
                type="button"
                onClick={() => handleSubmitExam()}
                className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold uppercase tracking-wider shadow-md shadow-emerald-600/20 cursor-pointer transition-all"
              >
                Ha, Topshirish
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Image Zoom Modal */}
      {zoomedImage && (
        <div
          onClick={() => setZoomedImage(null)}
          className="fixed inset-0 z-50 bg-slate-900/90 backdrop-blur-sm flex items-center justify-center p-4 cursor-pointer"
        >
          <div className="max-w-4xl max-h-[90vh] p-2 bg-white rounded-2xl overflow-hidden shadow-2xl">
            <img src={zoomedImage} alt="Kattalashtirilgan rasm" className="max-w-full max-h-[85vh] object-contain" />
          </div>
        </div>
      )}
    </div>
  );
};
