import React, { useState } from 'react';
import {
  User,
  GraduationCap,
  HelpCircle,
  FileText,
  Clock,
  CheckCircle2,
  AlertCircle,
  Play,
  Lock,
  Search,
  Filter,
  Sparkles,
} from 'lucide-react';
import { Test, StudentProfile } from '../types';

interface StudentPortalProps {
  tests: Test[];
  profile: StudentProfile;
  onProfileChange: (profile: StudentProfile) => void;
  onStartExam: (test: Test) => void;
}

export const StudentPortal: React.FC<StudentPortalProps> = ({
  tests,
  profile,
  onProfileChange,
  onStartExam,
}) => {
  const [filterType, setFilterType] = useState<'all' | 'my_grade' | 'BSB' | 'ChSB'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const grades = [5, 6, 7, 8, 9, 10, 11];
  const groups = ['A1', 'A2', 'AT', 'T'];

  // Test password state
  const [passwordModalTest, setPasswordModalTest] = useState<Test | null>(null);
  const [inputTestPassword, setInputTestPassword] = useState('');
  const [testPasswordError, setTestPasswordError] = useState('');

  const isProfileComplete =
    profile.fullName.trim().length >= 3 && profile.grade >= 5 && profile.group.length > 0;

  const handleTestStartClick = (test: Test) => {
    if (test.accessPassword && test.accessPassword.trim().length > 0) {
      setPasswordModalTest(test);
      setInputTestPassword('');
      setTestPasswordError('');
    } else {
      // Trigger fullscreen right inside user click gesture
      if (document.documentElement.requestFullscreen) {
        document.documentElement.requestFullscreen().catch(() => {});
      }
      onStartExam(test);
    }
  };

  const handleConfirmPasswordAndStart = (e: React.FormEvent) => {
    e.preventDefault();
    if (!passwordModalTest) return;

    if (inputTestPassword.trim() === passwordModalTest.accessPassword?.trim()) {
      if (document.documentElement.requestFullscreen) {
        document.documentElement.requestFullscreen().catch(() => {});
      }
      const target = passwordModalTest;
      setPasswordModalTest(null);
      onStartExam(target);
    } else {
      setTestPasswordError("Kiritilgan test paroli noto'g'ri. O'qituvchidan parolni so'rang.");
    }
  };

  // Filter tests
  const filteredTests = tests.filter((t) => {
    // Search query
    const matchSearch =
      t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.description.toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchSearch) return false;

    if (filterType === 'my_grade') {
      return t.grade === profile.grade || (t.allowedGrades && t.allowedGrades.includes(profile.grade));
    }
    if (filterType === 'BSB') {
      return t.type === 'BSB';
    }
    if (filterType === 'ChSB') {
      return t.type === 'ChSB';
    }
    return true;
  });

  const activeTestsCount = tests.filter((t) => t.isActive).length;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Student Registration (matching reference screenshot) */}
        <div className="lg:col-span-4 bg-white rounded-2xl border border-slate-200 p-6 shadow-sm sticky top-24">
          <div className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-semibold mb-4">
            <User className="w-3.5 h-3.5" />
            <span>O'quvchi ma'lumotlari</span>
          </div>

          <h2 className="text-xl font-bold text-slate-900 tracking-tight">
            O'quvchini ro'yxatga olish
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Iltimos, ism-familiyangiz va sinfingizni tanlang.
          </p>

          <div className="mt-6 space-y-5">
            {/* Full Name */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                Ism va Familiyangiz:
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <User className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  value={profile.fullName}
                  onChange={(e) => onProfileChange({ ...profile, fullName: e.target.value })}
                  placeholder="Masalan: Azizbek Karimov"
                  className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all text-slate-800 font-medium"
                />
              </div>
            </div>

            {/* Grade Selection */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                Sinfingiz:
              </label>

              {/* 1. Grade Number (5..11) */}
              <div className="space-y-1.5">
                <span className="text-[11px] text-slate-500 font-medium">
                  1. Sinf raqami (5 dan 11 gacha):
                </span>
                <div className="grid grid-cols-7 gap-1.5">
                  {grades.map((g) => (
                    <button
                      key={g}
                      type="button"
                      onClick={() => onProfileChange({ ...profile, grade: g })}
                      className={`py-2 text-xs font-bold rounded-lg border transition-all ${
                        profile.grade === g
                          ? 'bg-blue-600 border-blue-600 text-white shadow-sm'
                          : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      {g}
                    </button>
                  ))}
                </div>
              </div>

              {/* 2. Group Letter (A1, A2, AT, T sinflari) */}
              <div className="mt-3 space-y-1.5">
                <span className="text-[11px] text-slate-500 font-medium">
                  2. Sinf harfi (A1, A2, AT, T sinflari):
                </span>
                <div className="grid grid-cols-4 gap-2">
                  {groups.map((grp) => (
                    <button
                      key={grp}
                      type="button"
                      onClick={() => onProfileChange({ ...profile, group: grp })}
                      className={`py-2 px-1 text-xs font-bold rounded-lg border transition-all text-center ${
                        profile.group === grp || profile.group.startsWith(grp)
                          ? 'bg-blue-600 border-blue-600 text-white shadow-sm'
                          : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      {grp}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Validation Banner (exact match to screenshot) */}
            {!isProfileComplete ? (
              <div className="p-4 bg-amber-50 border border-amber-200/80 rounded-xl flex items-start space-x-3 text-amber-800">
                <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-xs font-bold">Ism va sinfni to'liq kiriting</h4>
                  <p className="text-[11px] text-amber-700 mt-0.5 leading-relaxed">
                    Ism-familiyangizni yozing va sinfingizni (5-A dan 11-V gacha) tanlang. Shunda testlarni topshirish imkoniyati ochiladi.
                  </p>
                </div>
              </div>
            ) : (
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-start space-x-3 text-emerald-800">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-xs font-bold">Ma'lumotlar saqlandi!</h4>
                  <p className="text-[11px] text-emerald-700 mt-0.5 leading-relaxed">
                    <span className="font-semibold">{profile.fullName}</span> ({profile.grade}-
                    {profile.group.replace(' guruhi', '')}). Endi o'ng tarafdan tegishli testni
                    tanlang va "Boshlash" tugmasini bosing.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Available Tests list (matching screenshot) */}
        <div className="lg:col-span-8 space-y-6">
          {/* Header Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <div className="flex items-center space-x-2">
                <FileText className="w-5 h-5 text-blue-600" />
                <h2 className="text-xl font-bold text-slate-900 tracking-tight">
                  Mavjud BSB va ChSB Testlari
                </h2>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                O'z sinfingizga mos fanni tanlang va mustaqil bilimingizni sinab ko'ring
              </p>
            </div>

            <div className="flex items-center space-x-2">
              <span className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                <span>{activeTestsCount} ta test faol (Start)</span>
              </span>
            </div>
          </div>

          {/* Search & Filter pills */}
          <div className="bg-white p-3 rounded-2xl border border-slate-200 flex flex-col sm:flex-row gap-3 items-center justify-between shadow-xs">
            <div className="relative w-full sm:w-72">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3 pointer-events-none" />
              <input
                type="text"
                placeholder="Test yoki fanni qidirish..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="flex flex-wrap gap-1.5 w-full sm:w-auto">
              <button
                type="button"
                onClick={() => setFilterType('all')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                  filterType === 'all'
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                Barchasi
              </button>
              {profile.grade > 0 && (
                <button
                  type="button"
                  onClick={() => setFilterType('my_grade')}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                    filterType === 'my_grade'
                      ? 'bg-blue-600 text-white'
                      : 'bg-blue-50 text-blue-700 hover:bg-blue-100'
                  }`}
                >
                  {profile.grade}-sinf testlari
                </button>
              )}
              <button
                type="button"
                onClick={() => setFilterType('BSB')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                  filterType === 'BSB'
                    ? 'bg-purple-600 text-white'
                    : 'bg-purple-50 text-purple-700 hover:bg-purple-100'
                }`}
              >
                Faqat BSB
              </button>
              <button
                type="button"
                onClick={() => setFilterType('ChSB')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                  filterType === 'ChSB'
                    ? 'bg-amber-600 text-white'
                    : 'bg-amber-50 text-amber-700 hover:bg-amber-100'
                }`}
              >
                Faqat ChSB
              </button>
            </div>
          </div>

          {/* Test Cards List */}
          <div className="space-y-4">
            {filteredTests.length === 0 ? (
              <div className="text-center py-12 bg-white rounded-2xl border border-slate-200 p-8">
                <AlertCircle className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <h3 className="text-sm font-bold text-slate-700">Hech qanday test topilmadi</h3>
                <p className="text-xs text-slate-500 mt-1">
                  Qidiruv so'zini o'zgartirib ko'ring yoki admin panel orqali yangi BSB/ChSB testi qo'shing.
                </p>
              </div>
            ) : (
              filteredTests.map((test) => {
                const customDuration =
                  profile.grade && test.gradeDurations && test.gradeDurations[profile.grade]
                    ? test.gradeDurations[profile.grade]
                    : test.durationMinutes;

                const isGradeAllowed =
                  !test.allowedGrades || test.allowedGrades.length === 0 || test.allowedGrades.includes(profile.grade);

                const isStarted = test.status === 'active' || (test.status === undefined && test.isActive);
                const isWaiting = test.status === 'waiting';
                const isFinished = test.status === 'finished' || (!test.isActive && !isWaiting);

                const canStart = isProfileComplete && isStarted && isGradeAllowed;

                return (
                  <div
                    key={test.id}
                    className={`bg-white rounded-2xl border p-6 transition-all duration-200 ${
                      isStarted
                        ? 'border-slate-200 hover:border-blue-400 hover:shadow-md'
                        : 'border-slate-200/60 bg-slate-50/50 opacity-90'
                    }`}
                  >
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-5">
                      {/* Left: Test Details */}
                      <div className="space-y-3 flex-1">
                        {/* Tags / Pills */}
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider bg-blue-100 text-blue-800">
                            {test.allowedGrades && test.allowedGrades.length > 1
                              ? `${test.allowedGrades.join(', ')}-SINFLAR`
                              : `${test.grade}-SINF`}
                          </span>
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider ${
                              test.type === 'BSB'
                                ? 'bg-purple-100 text-purple-800'
                                : 'bg-amber-100 text-amber-800'
                            }`}
                          >
                            {test.type} IMTIHONI
                          </span>
                          <span className="text-xs text-slate-500 font-medium">
                            Fan: <strong className="text-slate-700">{test.subject}</strong>
                          </span>

                          {/* Status Pill */}
                          {isStarted ? (
                            <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse"></span>
                              <span>JARAYONDA (START)</span>
                            </span>
                          ) : isFinished ? (
                            <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-100 text-rose-800 border border-rose-300">
                              <Lock className="w-3 h-3" />
                              <span>YAKUNLANGAN (FINISH)</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-300">
                              <Clock className="w-3 h-3 text-amber-600" />
                              <span>KUTILMOQDA (START BERILMAGAN)</span>
                            </span>
                          )}

                          {test.accessPassword && (
                            <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-50 text-amber-900 border border-amber-300">
                              <Lock className="w-3 h-3 text-amber-700" />
                              <span>Parolli</span>
                            </span>
                          )}
                        </div>

                        {/* Title */}
                        <h3 className="text-lg font-bold text-slate-900 capitalize tracking-tight">
                          {test.title}
                        </h3>

                        {/* Description */}
                        <p className="text-xs text-slate-600 leading-relaxed max-w-2xl">
                          {test.description}
                        </p>

                        {/* Badges / Metrics */}
                        <div className="flex flex-wrap items-center gap-3 pt-1">
                          <span className="inline-flex items-center space-x-1 text-xs text-slate-600 bg-slate-100 px-2.5 py-1 rounded-lg font-medium">
                            <HelpCircle className="w-3.5 h-3.5 text-blue-500" />
                            <span>{test.multipleChoiceCount ?? (test.questionsCount - (test.writtenCount || 0))} ta variantli baza</span>
                          </span>

                          <span className="inline-flex items-center space-x-1 text-xs text-slate-600 bg-slate-100 px-2.5 py-1 rounded-lg font-medium">
                            <FileText className="w-3.5 h-3.5 text-purple-500" />
                            <span>{test.writtenCount ?? 2} ta yozma baza</span>
                          </span>

                          <span className="inline-flex items-center space-x-1 text-xs text-blue-700 bg-blue-50 px-2.5 py-1 rounded-lg font-bold border border-blue-200">
                            <Clock className="w-3.5 h-3.5 text-blue-600" />
                            <span>
                              {customDuration} daqiqa
                              {test.gradeDurations && profile.grade && test.gradeDurations[profile.grade]
                                ? ` (${profile.grade}-sinf uchun)`
                                : ''}
                            </span>
                          </span>

                          <span className="inline-flex items-center space-x-1 text-xs text-slate-600 bg-slate-100 px-2.5 py-1 rounded-lg font-medium">
                            <Sparkles className="w-3.5 h-3.5 text-emerald-500" />
                            <span>{test.totalPoints} ball</span>
                          </span>
                        </div>
                      </div>

                      {/* Right: Action Button */}
                      <div className="shrink-0 flex flex-col items-end justify-center">
                        {isStarted ? (
                          <button
                            type="button"
                            disabled={!canStart}
                            onClick={() => handleTestStartClick(test)}
                            className={`w-full sm:w-auto px-5 py-3 rounded-xl font-bold text-xs uppercase tracking-wider flex items-center justify-center space-x-2 transition-all ${
                              canStart
                                ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-500/20 active:scale-98 cursor-pointer'
                                : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                            }`}
                          >
                            <Play className="w-4 h-4 fill-current" />
                            <span>
                              {!isProfileComplete
                                ? "Ism va sinf kiritilmagan"
                                : !isGradeAllowed
                                ? `${profile.grade}-sinf uchun emas`
                                : test.accessPassword
                                ? "Parolli Testni Boshlash"
                                : "Testni Boshlash (Start)"}
                            </span>
                          </button>
                        ) : isWaiting ? (
                          <button
                            type="button"
                            disabled
                            className="w-full sm:w-auto px-5 py-3 rounded-xl font-bold text-xs bg-amber-50 text-amber-700 border border-amber-200 flex items-center justify-center space-x-2 cursor-not-allowed"
                          >
                            <Clock className="w-4 h-4" />
                            <span>Admin start berishi kutilmoqda</span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            disabled
                            className="w-full sm:w-auto px-5 py-3 rounded-xl font-bold text-xs bg-slate-100 text-slate-400 border border-slate-200 flex items-center justify-center space-x-2 cursor-not-allowed"
                          >
                            <Lock className="w-4 h-4" />
                            <span>Test yakunlangan (Finish)</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Test Password Prompt Modal */}
      {passwordModalTest && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 sm:p-7 space-y-4 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-200">
            <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mx-auto">
              <Lock className="w-6 h-6" />
            </div>

            <div className="text-center">
              <h3 className="text-base font-bold text-slate-900">
                Testga Kirish Paroli
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                "{passwordModalTest.title}" testini boshlash uchun o'qituvchi bergan parolni kiriting.
              </p>
            </div>

            <form onSubmit={handleConfirmPasswordAndStart} className="space-y-3">
              <div>
                <input
                  type="password"
                  autoFocus
                  value={inputTestPassword}
                  onChange={(e) => {
                    setInputTestPassword(e.target.value);
                    setTestPasswordError('');
                  }}
                  placeholder="Test paroli yoki PIN..."
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-center tracking-widest focus:ring-2 focus:ring-blue-500 focus:bg-white text-slate-900 font-bold"
                />
                {testPasswordError && (
                  <p className="text-[11px] text-rose-600 font-semibold mt-1 text-center">
                    {testPasswordError}
                  </p>
                )}
              </div>

              <div className="flex space-x-2 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setPasswordModalTest(null);
                    setTestPasswordError('');
                  }}
                  className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold"
                >
                  Bekor qilish
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-500/20"
                >
                  Tasdiqlash
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
