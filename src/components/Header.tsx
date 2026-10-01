import React from 'react';
import { BookOpen, ShieldCheck, UserCheck, Settings, School } from 'lucide-react';

interface HeaderProps {
  currentView: 'student' | 'admin' | 'exam';
  onNavigate: (view: 'student' | 'admin') => void;
  isAdminLoggedIn: boolean;
  onAdminLoginClick: () => void;
  firebaseStatus: 'connected' | 'connecting' | 'offline';
}

export const Header: React.FC<HeaderProps> = ({
  currentView,
  onNavigate,
  isAdminLoggedIn,
  onAdminLoginClick,
  firebaseStatus,
}) => {
  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-40 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-18 flex items-center justify-between">
        {/* Brand & Logo */}
        <div
          className="flex items-center space-x-3 cursor-pointer select-none"
          onClick={() => onNavigate('student')}
        >
          <div className="w-11 h-11 bg-blue-600 rounded-xl flex items-center justify-center text-white shadow-md shadow-blue-500/20">
            <School className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="font-bold text-slate-900 text-lg sm:text-xl tracking-tight leading-none">
                Maktab BSB & ChSB Testlari
              </h1>
              <span className="hidden sm:inline-block text-[11px] font-semibold uppercase tracking-wider bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full border border-blue-200">
                Ixtisoslashtirilgan Maktab
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1 font-normal">
              Oylik BSB va choraklik ChSB imtihonlarini mustaqil topshirish platformasi
            </p>
          </div>
        </div>

        {/* Right Info & Actions */}
        <div className="flex items-center space-x-3 sm:space-x-4">
          {/* Firebase Status Badge */}
          <div className="flex items-center space-x-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 px-3 py-1 rounded-full text-xs font-medium">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span>Firebase: Live</span>
          </div>

          {/* Admin Panel button */}
          {currentView !== 'exam' && (
            <button
              onClick={() => {
                if (isAdminLoggedIn || currentView === 'admin') {
                  onNavigate(currentView === 'admin' ? 'student' : 'admin');
                } else {
                  onAdminLoginClick();
                }
              }}
              className={`flex items-center space-x-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                currentView === 'admin'
                  ? 'bg-blue-600 text-white shadow-sm hover:bg-blue-700'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              <Settings className="w-3.5 h-3.5" />
              <span>{currentView === 'admin' ? "O'quvchi rejimi" : 'Admin panel'}</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
