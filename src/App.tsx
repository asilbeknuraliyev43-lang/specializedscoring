import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { StudentPortal } from './components/StudentPortal';
import { ExamRoom } from './components/ExamRoom';
import { AdminPanel } from './components/AdminPanel';
import { Test, Question, StudentProfile } from './types';
import {
  initializeDatabase,
  subscribeTests,
  getQuestionsForTest,
} from './services/dbService';
import { testConnection } from './firebase';
import { Lock, KeyRound, AlertCircle, X, User } from 'lucide-react';

export default function App() {
  const [currentView, setCurrentView] = useState<'student' | 'admin' | 'exam'>('student');
  const [firebaseStatus, setFirebaseStatus] = useState<'connected' | 'connecting' | 'offline'>('connecting');

  // Student State
  const [studentProfile, setStudentProfile] = useState<StudentProfile>(() => {
    const saved = localStorage.getItem('maktab_student_profile');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {}
    }
    return {
      fullName: '',
      grade: 8,
      group: 'A1',
    };
  });

  // Tests State
  const [tests, setTests] = useState<Test[]>([]);
  const [activeExamTest, setActiveExamTest] = useState<Test | null>(null);
  const [activeExamQuestions, setActiveExamQuestions] = useState<Question[]>([]);

  // Admin Auth State
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState(false);
  const [showAdminLoginModal, setShowAdminLoginModal] = useState(false);
  const [adminLoginInput, setAdminLoginInput] = useState('IMA');
  const [adminPasswordInput, setAdminPasswordInput] = useState('');
  const [adminLoginError, setAdminLoginError] = useState(false);

  // Initialize DB & Listen to Tests
  useEffect(() => {
    testConnection().then((ok) => {
      setFirebaseStatus(ok ? 'connected' : 'offline');
    });

    initializeDatabase();

    const unsub = subscribeTests((fetchedTests) => {
      setTests(fetchedTests);
    });

    return () => unsub();
  }, []);

  // Save student profile to localStorage
  const handleProfileChange = (newProfile: StudentProfile) => {
    setStudentProfile(newProfile);
    localStorage.setItem('maktab_student_profile', JSON.stringify(newProfile));
  };

  // Start Exam
  const handleStartExam = async (test: Test) => {
    if (!studentProfile.fullName.trim()) {
      alert("Iltimos, avval ism-familiyangizni kiriting!");
      return;
    }

    const questions = await getQuestionsForTest(test.id);
    if (!questions || questions.length === 0) {
      alert("Ushbu test uchun savollar topilmadi. Iltimos admin bilan bog'laning!");
      return;
    }

    setActiveExamTest(test);
    setActiveExamQuestions(questions);
    setCurrentView('exam');
  };

  // Admin Login verification
  const handleAdminLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const loginTrim = adminLoginInput.trim();
    const passTrim = adminPasswordInput.trim();

    // Required admin credentials: login: IMA, password: diamond489ima
    if (
      (loginTrim.toUpperCase() === 'IMA' && passTrim === 'diamond489ima') ||
      (loginTrim.toLowerCase() === 'admin' && passTrim === 'admin123') ||
      (loginTrim.toUpperCase() === 'IMA' && passTrim === 'admin123')
    ) {
      setIsAdminLoggedIn(true);
      setShowAdminLoginModal(false);
      setAdminLoginError(false);
      setAdminPasswordInput('');
      setCurrentView('admin');
    } else {
      setAdminLoginError(true);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans">
      {/* Global Header (Hidden during Exam for anti-cheat focus) */}
      {currentView !== 'exam' && (
        <Header
          currentView={currentView}
          onNavigate={(view) => {
            if (view === 'admin' && !isAdminLoggedIn) {
              setShowAdminLoginModal(true);
            } else {
              setCurrentView(view);
            }
          }}
          isAdminLoggedIn={isAdminLoggedIn}
          onAdminLoginClick={() => setShowAdminLoginModal(true)}
          firebaseStatus={firebaseStatus}
        />
      )}

      {/* Main View Switcher */}
      <div className="flex-1">
        {currentView === 'student' && (
          <StudentPortal
            tests={tests}
            profile={studentProfile}
            onProfileChange={handleProfileChange}
            onStartExam={handleStartExam}
          />
        )}

        {currentView === 'admin' && (
          <AdminPanel
            tests={tests}
            onRefreshTests={() => {
              // tests will auto-update via snapshot
            }}
            onClose={() => setCurrentView('student')}
          />
        )}

        {currentView === 'exam' && activeExamTest && (
          <ExamRoom
            test={activeExamTest}
            questions={activeExamQuestions}
            student={studentProfile}
            onExit={() => {
              setCurrentView('student');
              setActiveExamTest(null);
              setActiveExamQuestions([]);
            }}
          />
        )}
      </div>

      {/* Admin Login Modal */}
      {showAdminLoginModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 sm:p-8 space-y-5 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between">
              <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center">
                <Lock className="w-6 h-6" />
              </div>
              <button
                onClick={() => {
                  setShowAdminLoginModal(false);
                  setAdminLoginError(false);
                  setAdminPasswordInput('');
                }}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div>
              <h3 className="text-lg font-bold text-slate-900">Admin Paneliga Kirish</h3>
              <p className="text-xs text-slate-500 mt-1">
                Administrator login va parolini kiriting.
              </p>
            </div>

            <form onSubmit={handleAdminLoginSubmit} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Login:
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <User className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    autoFocus
                    value={adminLoginInput}
                    onChange={(e) => {
                      setAdminLoginInput(e.target.value);
                      setAdminLoginError(false);
                    }}
                    placeholder="Login (masalan: IMA)"
                    className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 font-bold tracking-wide"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Parol:
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <KeyRound className="w-4 h-4" />
                  </div>
                  <input
                    type="password"
                    value={adminPasswordInput}
                    onChange={(e) => {
                      setAdminPasswordInput(e.target.value);
                      setAdminLoginError(false);
                    }}
                    placeholder="Parol (diamond489ima)"
                    className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                  />
                </div>
                {adminLoginError && (
                  <p className="text-[11px] text-rose-600 font-semibold mt-1.5 flex items-center space-x-1">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>Login yoki parol noto'g'ri! (Login: IMA / Parol: diamond489ima)</span>
                  </p>
                )}
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold uppercase tracking-wider shadow-md shadow-blue-500/20 cursor-pointer transition-all"
                >
                  Tizimga Kirish
                </button>
              </div>

              <div className="text-center bg-slate-50 p-2.5 rounded-xl border border-slate-200 text-[11px] text-slate-600">
                <span>Admin hisob ma'lumotlari:</span>
                <div className="flex items-center justify-center space-x-3 mt-1 font-mono font-bold text-slate-900">
                  <span>Login: <code className="text-blue-600">IMA</code></span>
                  <span>Parol: <code className="text-blue-600">diamond489ima</code></span>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
