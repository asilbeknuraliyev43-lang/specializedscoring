import React, { useState } from 'react';
import {
  CheckCircle2,
  XCircle,
  Clock,
  Award,
  ShieldCheck,
  AlertTriangle,
  ArrowRight,
  Printer,
  ChevronDown,
  ChevronUp,
  BookOpen,
  Sparkles,
  HelpCircle,
  FileText,
  BarChart3,
  Check,
  X,
} from 'lucide-react';
import { Submission, Test, Question, StudentProfile } from '../types';

interface ExamResultAnalysisProps {
  submission: Submission;
  test: Test;
  questions: Question[];
  student: StudentProfile;
  onExit: () => void;
}

export const ExamResultAnalysis: React.FC<ExamResultAnalysisProps> = ({
  submission,
  test,
  questions,
  student,
  onExit,
}) => {
  const [filterType, setFilterType] = useState<'all' | 'correct' | 'incorrect'>('all');
  const [expandedQuestionId, setExpandedQuestionId] = useState<string | null>(null);

  const percentage = submission.percentage || 0;
  const isPassed = percentage >= (test.passingPercentage || 60);

  // Grade classification
  const gradeInfo = (() => {
    if (percentage >= 86) {
      return {
        letter: 'A+',
        title: "A'lo natija! (5 baho)",
        color: 'text-emerald-700',
        bg: 'bg-emerald-50 border-emerald-200',
        badgeBg: 'bg-emerald-500 text-white',
        description: "Siz mavzularni chuqur va a'lo darajada o'zlashtirganingizni namoyish etdingiz.",
      };
    } else if (percentage >= 71) {
      return {
        letter: 'B',
        title: "Yaxshi natija! (4 baho)",
        color: 'text-blue-700',
        bg: 'bg-blue-50 border-blue-200',
        badgeBg: 'bg-blue-600 text-white',
        description: "Mavzular yaxshi o'zlashtirilgan. Kichik xatoliklar ustida ishlash orqali a'lo natijaga erishish mumkin.",
      };
    } else if (percentage >= 56) {
      return {
        letter: 'C',
        title: "Qoniqarli natija (3 baho)",
        color: 'text-amber-700',
        bg: 'bg-amber-50 border-amber-200',
        badgeBg: 'bg-amber-500 text-white',
        description: "Asosiy tushunchalar mavjud, lekin nazariy va amaliy mavzularni qayta takrorlash talab etiladi.",
      };
    } else {
      return {
        letter: 'F',
        title: "Qoniqarsiz natija (2 baho)",
        color: 'text-rose-700',
        bg: 'bg-rose-50 border-rose-200',
        badgeBg: 'bg-rose-500 text-white',
        description: "Ushbu fan bo'yicha qo'shimcha darslar va ustoz bilan individual ishlash tavsiya etiladi.",
      };
    }
  })();

  // Time spent formatted
  const spentMinutes = Math.floor((submission.durationSpentSeconds || 0) / 60);
  const spentSeconds = (submission.durationSpentSeconds || 0) % 60;
  const timeFormatted = `${spentMinutes} daqiqa ${spentSeconds} soniya`;

  // Question evaluations
  const evaluatedQuestions = questions.map((q) => {
    const studentAns = (submission.answers[q.id] || '').trim();
    let isCorrect = false;
    let earnedPoints = 0;

    if (q.type === 'multiple_choice') {
      isCorrect = !!(
        studentAns &&
        q.correctAnswer &&
        studentAns.toUpperCase() === q.correctAnswer.toUpperCase()
      );
      earnedPoints = isCorrect ? q.points : 0;
    } else if (q.type === 'true_false') {
      isCorrect = !!(
        studentAns &&
        q.correctAnswer &&
        studentAns.toLowerCase() === q.correctAnswer.toLowerCase()
      );
      earnedPoints = isCorrect ? q.points : 0;
    } else if (q.type === 'fill_blank') {
      isCorrect = !!(
        studentAns &&
        q.correctAnswer &&
        (studentAns.toLowerCase() === q.correctAnswer.toLowerCase() ||
          studentAns.toLowerCase().includes(q.correctAnswer.toLowerCase()))
      );
      earnedPoints = isCorrect ? q.points : 0;
    } else if (q.type === 'matching') {
      if (studentAns && q.matchingPairs) {
        try {
          const parsed = JSON.parse(studentAns);
          let correctPairs = 0;
          q.matchingPairs.forEach((pair) => {
            if (parsed[pair.id] === pair.right) correctPairs++;
          });
          isCorrect = correctPairs === q.matchingPairs.length;
          earnedPoints = Math.round(q.points * (correctPairs / q.matchingPairs.length));
        } catch (e) {
          isCorrect = false;
        }
      }
    } else {
      // Written: if answered thoughtfully
      if (studentAns && studentAns.length >= 5) {
        isCorrect = true;
        earnedPoints = Math.round(q.points * 0.8);
      }
    }

    return {
      ...q,
      studentAns,
      isCorrect,
      earnedPoints,
    };
  });

  const correctQuestionsCount = evaluatedQuestions.filter((q) => q.isCorrect).length;
  const incorrectQuestionsCount = evaluatedQuestions.length - correctQuestionsCount;

  // Filtered view
  const displayQuestions = evaluatedQuestions.filter((q) => {
    if (filterType === 'correct') return q.isCorrect;
    if (filterType === 'incorrect') return !q.isCorrect;
    return true;
  });

  // Print function
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="min-h-screen bg-slate-50 py-8 px-4 sm:px-6 lg:px-8 print:p-0 print:bg-white">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Top Navigation Bar / Print Actions */}
        <div className="flex items-center justify-between bg-white p-4 rounded-2xl border border-slate-200 shadow-xs print:hidden">
          <div className="flex items-center space-x-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
            <span className="text-xs font-bold uppercase tracking-wider text-slate-600">
              Imtihon Natijalari Chuqur Tahlili
            </span>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={handlePrint}
              className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl flex items-center space-x-1.5 transition-all cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>Chop etish / PDF</span>
            </button>
            <button
              onClick={onExit}
              className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl flex items-center space-x-1.5 shadow-xs transition-all cursor-pointer"
            >
              <span>Bosh sahifaga qaytish</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Hero Score Card */}
        <div className={`p-6 sm:p-8 rounded-3xl border ${gradeInfo.bg} shadow-sm space-y-6 relative overflow-hidden`}>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
            <div className="space-y-2">
              <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-white/80 text-slate-800 text-xs font-bold border border-slate-200 shadow-2xs">
                <Award className="w-3.5 h-3.5 text-amber-500" />
                <span>{test.type}: {test.title}</span>
              </div>

              <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                {student.fullName}
              </h1>

              <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600 pt-0.5">
                <span className="font-bold text-slate-900 bg-white/60 px-2.5 py-1 rounded-lg border border-slate-200/60">
                  Sinf: {student.grade}-{student.group}
                </span>
                <span>Fan: <strong>{test.subject}</strong></span>
                <span>Sana: {new Date(submission.submittedAt).toLocaleDateString()}</span>
              </div>
            </div>

            {/* Big Grade Badge */}
            <div className="flex items-center space-x-4 shrink-0 bg-white/90 p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-xs">
              <div className={`w-16 h-16 rounded-2xl ${gradeInfo.badgeBg} flex flex-col items-center justify-center font-black shadow-md`}>
                <span className="text-2xl leading-none">{gradeInfo.letter}</span>
                <span className="text-[10px] uppercase font-bold tracking-widest mt-0.5">Daraja</span>
              </div>
              <div>
                <div className="text-3xl font-black text-slate-900 tracking-tight">
                  {submission.score} <span className="text-sm font-semibold text-slate-400">/ {submission.maxScore}</span>
                </div>
                <div className="text-xs font-bold text-emerald-600 flex items-center space-x-1">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>{percentage}% Natija</span>
                </div>
              </div>
            </div>
          </div>

          <div className="border-t border-slate-200/60 pt-4 flex flex-col sm:flex-row sm:items-center sm:justify-between text-xs gap-2">
            <p className={`font-semibold ${gradeInfo.color}`}>
              {gradeInfo.title} — {gradeInfo.description}
            </p>
            <span className="text-slate-500 font-medium">
              O'tish chegarasi: <strong className="text-slate-800">{test.passingPercentage || 60}%</strong>
            </span>
          </div>
        </div>

        {/* 4 Analytics KPI Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-1">
            <div className="flex items-center space-x-1.5 text-slate-500 text-xs font-bold uppercase">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>To'g'ri javoblar</span>
            </div>
            <p className="text-2xl font-black text-slate-900">
              {correctQuestionsCount} <span className="text-xs font-semibold text-slate-400">/ {questions.length}</span>
            </p>
            <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
              <div
                className="bg-emerald-500 h-full rounded-full"
                style={{ width: `${(correctQuestionsCount / (questions.length || 1)) * 100}%` }}
              ></div>
            </div>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-1">
            <div className="flex items-center space-x-1.5 text-slate-500 text-xs font-bold uppercase">
              <XCircle className="w-4 h-4 text-rose-600" />
              <span>Xatolar soni</span>
            </div>
            <p className="text-2xl font-black text-slate-900">
              {incorrectQuestionsCount} <span className="text-xs font-semibold text-slate-400">ta savol</span>
            </p>
            <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
              <div
                className="bg-rose-500 h-full rounded-full"
                style={{ width: `${(incorrectQuestionsCount / (questions.length || 1)) * 100}%` }}
              ></div>
            </div>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-1">
            <div className="flex items-center space-x-1.5 text-slate-500 text-xs font-bold uppercase">
              <Clock className="w-4 h-4 text-blue-600" />
              <span>Sarflangan vaqt</span>
            </div>
            <p className="text-lg font-black text-slate-900 truncate" title={timeFormatted}>
              {spentMinutes}m {spentSeconds}s
            </p>
            <span className="text-[11px] text-slate-400">
              Ajratilgan: {test.durationMinutes} daqiqa
            </span>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-1">
            <div className="flex items-center space-x-1.5 text-slate-500 text-xs font-bold uppercase">
              <ShieldCheck className="w-4 h-4 text-purple-600" />
              <span>Halollik ko'rsatkichi</span>
            </div>
            <p className="text-lg font-black text-slate-900">
              {submission.tabSwitchCount === 0 ? '100% Halol' : `${submission.tabSwitchCount} ta ogohlantirish`}
            </p>
            <span className={`text-[11px] font-bold ${submission.tabSwitchCount === 0 ? 'text-emerald-600' : 'text-amber-600'}`}>
              {submission.tabSwitchCount === 0 ? '🟢 Qoidabuzarliksiz' : '🟡 Tab switch aniqlangan'}
            </span>
          </div>
        </div>

        {/* Detailed Question Review Section */}
        <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-xs space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-100 pb-4">
            <div>
              <h3 className="text-lg font-bold text-slate-900 flex items-center space-x-2">
                <FileText className="w-5 h-5 text-blue-600" />
                <span>Har Bir Savolning To'liq Yechim Tahlili</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Sizning javobingiz, to'g'ri javob va to'liq tushuntirishlarni ko'rib chiqing
              </p>
            </div>

            {/* Filter buttons */}
            <div className="flex items-center space-x-1.5 bg-slate-100 p-1 rounded-xl text-xs font-bold">
              <button
                type="button"
                onClick={() => setFilterType('all')}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  filterType === 'all' ? 'bg-white text-blue-600 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Barchasi ({evaluatedQuestions.length})
              </button>
              <button
                type="button"
                onClick={() => setFilterType('correct')}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  filterType === 'correct' ? 'bg-white text-emerald-600 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                To'g'ri ({correctQuestionsCount})
              </button>
              <button
                type="button"
                onClick={() => setFilterType('incorrect')}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  filterType === 'incorrect' ? 'bg-white text-rose-600 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Xato ({incorrectQuestionsCount})
              </button>
            </div>
          </div>

          {/* Question List */}
          <div className="space-y-4">
            {displayQuestions.map((q, idx) => {
              const isExpanded = expandedQuestionId === q.id || filterType !== 'all';

              return (
                <div
                  key={q.id || idx}
                  className={`rounded-2xl border transition-all overflow-hidden ${
                    q.isCorrect
                      ? 'border-emerald-200/80 bg-emerald-50/20'
                      : 'border-rose-200/80 bg-rose-50/20'
                  }`}
                >
                  {/* Header Row */}
                  <div
                    onClick={() => setExpandedQuestionId(isExpanded ? null : q.id)}
                    className="p-4 sm:p-5 flex items-start justify-between gap-4 cursor-pointer hover:bg-slate-50/50 transition-all select-none"
                  >
                    <div className="flex items-start space-x-3">
                      <div
                        className={`w-7 h-7 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 mt-0.5 ${
                          q.isCorrect
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-rose-100 text-rose-800'
                        }`}
                      >
                        {q.questionNumber || idx + 1}
                      </div>

                      <div>
                        <div className="flex items-center space-x-2">
                          <span
                            className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider ${
                              q.isCorrect
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-rose-100 text-rose-800'
                            }`}
                          >
                            {q.isCorrect ? "To'g'ri" : "Noto'g'ri"}
                          </span>
                          <span className="text-[11px] font-semibold text-slate-500">
                            {q.type === 'multiple_choice' ? 'Variantli test' : 'Yozma savol'}
                          </span>
                        </div>
                        <h4 className="text-xs font-bold text-slate-900 mt-1 line-clamp-2">
                          {q.text}
                        </h4>
                      </div>
                    </div>

                    <div className="flex items-center space-x-3 shrink-0">
                      <span className="text-xs font-black text-slate-700 bg-white px-2.5 py-1 rounded-lg border border-slate-200">
                        {q.earnedPoints} / {q.points} ball
                      </span>
                      {isExpanded ? (
                        <ChevronUp className="w-4 h-4 text-slate-400" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-slate-400" />
                      )}
                    </div>
                  </div>

                  {/* Expanded Body */}
                  {isExpanded && (
                    <div className="px-5 pb-5 pt-1 space-y-4 border-t border-slate-200/60 bg-white">
                      {q.imageUrl && (
                        <div className="max-w-xs border rounded-xl overflow-hidden shadow-2xs my-2">
                          <img src={q.imageUrl} alt="Savol rasmi" className="max-h-44 object-contain mx-auto" />
                        </div>
                      )}

                      {/* Options if Multiple Choice */}
                      {q.type === 'multiple_choice' && q.options && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs pt-1">
                          {q.options.map((opt, oIdx) => {
                            const optLetter = opt.substring(0, 1).toUpperCase();
                            const isStudentChoice = (q.studentAns || '').toUpperCase() === optLetter;
                            const isCorrectAnswer = (q.correctAnswer || '').toUpperCase() === optLetter;

                            return (
                              <div
                                key={oIdx}
                                className={`p-2.5 rounded-xl border flex items-center justify-between text-xs ${
                                  isCorrectAnswer
                                    ? 'bg-emerald-50 border-emerald-300 text-emerald-900 font-bold'
                                    : isStudentChoice
                                    ? 'bg-rose-50 border-rose-300 text-rose-900 font-bold'
                                    : 'bg-slate-50/60 border-slate-200 text-slate-600'
                                }`}
                              >
                                <span>{opt}</span>
                                <div className="flex items-center space-x-1 shrink-0 ml-2">
                                  {isStudentChoice && (
                                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-200 text-slate-700 font-semibold">
                                      Sizning javob
                                    </span>
                                  )}
                                  {isCorrectAnswer && (
                                    <span className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center">
                                      <Check className="w-3 h-3" />
                                    </span>
                                  )}
                                  {isStudentChoice && !isCorrectAnswer && (
                                    <span className="w-5 h-5 rounded-full bg-rose-600 text-white flex items-center justify-center">
                                      <X className="w-3 h-3" />
                                    </span>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* Comparison Bar for other question types */}
                      {q.type !== 'multiple_choice' && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                            <span className="text-[10px] uppercase font-bold text-slate-400">
                              Sizning Javobingiz:
                            </span>
                            <p className="font-semibold text-slate-800 whitespace-pre-wrap">
                              {q.studentAns || "Javob berilmagan"}
                            </p>
                          </div>

                          <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 space-y-1">
                            <span className="text-[10px] uppercase font-bold text-emerald-700">
                              To'g'ri / Namunaviy Javob:
                            </span>
                            <p className="font-bold text-emerald-900 whitespace-pre-wrap">
                              {q.correctAnswer || "Standart mezon asosida"}
                            </p>
                          </div>
                        </div>
                      )}

                      {/* Explanation / Solution Walkthrough */}
                      {q.explanation && (
                        <div className="p-3.5 bg-blue-50/70 border border-blue-200 rounded-xl text-xs space-y-1">
                          <div className="flex items-center space-x-1.5 text-blue-900 font-bold">
                            <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                            <span>Yechim va O'qituvchi Izohi:</span>
                          </div>
                          <p className="text-slate-700 leading-relaxed">
                            {q.explanation}
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Personalized Recommendations & Pedagogical Advice */}
        <div className="p-6 bg-gradient-to-r from-blue-900 to-indigo-900 text-white rounded-3xl space-y-3 shadow-md">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-amber-300" />
            </div>
            <h4 className="text-base font-bold">
              Pedagogik Tavsiya va Xulosa
            </h4>
          </div>

          <p className="text-xs text-blue-100 leading-relaxed">
            {percentage >= 80
              ? "Ajoyib natija! Ushbu fanni chuqur o'rganishda davom eting. O'tkazilgan xatolar ustida mustaqil ishlab, olimpiada va chuqurlashtirilgan masalalarga e'tibor qarating."
              : percentage >= 60
              ? "Yaxshi natija qayd etildi. Xato qilingan savollar bo'yicha darslikdagi tegishli mavzularni qayta o'qib chiqish va qoidalarni mustahkamlash foydali bo'ladi."
              : "Imtihon natijangizni yaxshilash uchun ushbu chorak mavzularini o'qituvchi bilan birgalikda qayta ko'rib chiqish va testlar ustida ko'proq mashq qilish tavsiya etiladi."}
          </p>

          <div className="pt-2 flex justify-end">
            <button
              onClick={onExit}
              className="px-6 py-2.5 bg-white text-blue-900 hover:bg-blue-50 font-bold text-xs rounded-xl transition-all shadow-sm cursor-pointer"
            >
              Bosh Sahifaga Qaytish
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
