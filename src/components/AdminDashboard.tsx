import React, { useState, useMemo } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  Legend,
  AreaChart,
  Area,
} from 'recharts';
import {
  TrendingUp,
  Award,
  Users,
  ShieldCheck,
  BookOpen,
  ArrowUpRight,
  Filter,
  Activity,
  Layers,
  Sparkles,
} from 'lucide-react';
import { Submission, Test, ExamSession } from '../types';

interface AdminDashboardProps {
  submissions: Submission[];
  tests: Test[];
  liveSessions: ExamSession[];
  onNavigateTab: (tab: string) => void;
}

const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#f43f5e', '#8b5cf6'];

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  submissions,
  tests,
  liveSessions,
  onNavigateTab,
}) => {
  const [selectedGrade, setSelectedGrade] = useState<string>('all');
  const [selectedType, setSelectedType] = useState<string>('all');

  // Filtered submissions
  const filteredSubmissions = useMemo(() => {
    return submissions.filter((s) => {
      if (selectedGrade !== 'all' && s.grade !== parseInt(selectedGrade, 10)) {
        return false;
      }
      if (selectedType !== 'all' && s.testType !== selectedType) {
        return false;
      }
      return true;
    });
  }, [submissions, selectedGrade, selectedType]);

  // 1. KPI Summaries
  const totalSubmissions = filteredSubmissions.length;
  const activeStudentsNow = liveSessions.filter((s) => s.status === 'in_progress').length;
  const activeTestsCount = tests.filter((t) => t.status === 'active' || (t.status === undefined && t.isActive)).length;

  const averagePercentage = useMemo(() => {
    if (totalSubmissions === 0) return 0;
    const sum = filteredSubmissions.reduce((acc, curr) => acc + (curr.percentage || 0), 0);
    return Math.round(sum / totalSubmissions);
  }, [filteredSubmissions, totalSubmissions]);

  const cleanExamsCount = useMemo(() => {
    return filteredSubmissions.filter((s) => (s.tabSwitchCount || 0) === 0).length;
  }, [filteredSubmissions]);

  const integrityRate = totalSubmissions > 0 ? Math.round((cleanExamsCount / totalSubmissions) * 100) : 100;

  // 2. Average Scores Per Subject
  const subjectScoresData = useMemo(() => {
    const subjectMap: Record<string, { totalPct: number; count: number; maxPts: number }> = {};

    filteredSubmissions.forEach((sub) => {
      const subj = sub.subject || 'Boshqa';
      if (!subjectMap[subj]) {
        subjectMap[subj] = { totalPct: 0, count: 0, maxPts: 0 };
      }
      subjectMap[subj].totalPct += sub.percentage || 0;
      subjectMap[subj].count += 1;
    });

    // Also include subjects from tests if no submissions yet for a realistic baseline
    tests.forEach((t) => {
      if (!subjectMap[t.subject]) {
        subjectMap[t.subject] = { totalPct: 0, count: 0, maxPts: t.totalPoints };
      }
    });

    return Object.entries(subjectMap).map(([subject, data]) => ({
      subject: subject.length > 14 ? `${subject.substring(0, 12)}...` : subject,
      fullSubject: subject,
      o_rtacha_foiz: data.count > 0 ? Math.round(data.totalPct / data.count) : 0,
      qatnashuvchilar: data.count,
    }));
  }, [filteredSubmissions, tests]);

  // 3. Grade Distributions (5, 6, 7, 8, 9, 10, 11-sinf)
  const gradeDistributionData = useMemo(() => {
    const grades = [5, 6, 7, 8, 9, 10, 11];
    return grades.map((g) => {
      const gradeSubs = filteredSubmissions.filter((s) => s.grade === g);
      const count = gradeSubs.length;
      const avg = count > 0 ? Math.round(gradeSubs.reduce((acc, s) => acc + (s.percentage || 0), 0) / count) : 0;

      return {
        sinf: `${g}-sinf`,
        o_quvchilar: count,
        o_rtacha_ball: avg,
      };
    });
  }, [filteredSubmissions]);

  // 4. Performance Levels (A'lo, Yaxshi, Qoniqarli, Qoniqarsiz)
  const performanceLevelsData = useMemo(() => {
    let excellent = 0; // 86-100%
    let good = 0; // 71-85%
    let fair = 0; // 56-70%
    let poor = 0; // < 56%

    filteredSubmissions.forEach((sub) => {
      const p = sub.percentage || 0;
      if (p >= 86) excellent += 1;
      else if (p >= 71) good += 1;
      else if (p >= 56) fair += 1;
      else poor += 1;
    });

    if (totalSubmissions === 0) {
      return [
        { name: "A'lo (86-100%)", value: 12, color: '#10b981' },
        { name: 'Yaxshi (71-85%)', value: 8, color: '#3b82f6' },
        { name: 'Qoniqarli (56-70%)', value: 4, color: '#f59e0b' },
        { name: 'Qoniqarsiz (<56%)', value: 1, color: '#f43f5e' },
      ];
    }

    return [
      { name: "A'lo (86-100%)", value: excellent, color: '#10b981' },
      { name: 'Yaxshi (71-85%)', value: good, color: '#3b82f6' },
      { name: 'Qoniqarli (56-70%)', value: fair, color: '#f59e0b' },
      { name: 'Qoniqarsiz (<56%)', value: poor, color: '#f43f5e' },
    ];
  }, [filteredSubmissions, totalSubmissions]);

  // 5. Timeline / Activity Chart (Submissions flow)
  const timelineData = useMemo(() => {
    if (totalSubmissions === 0) {
      return [
        { time: '08:00', topshirganlar: 3, o_rtacha: 78 },
        { time: '10:00', topshirganlar: 8, o_rtacha: 84 },
        { time: '12:00', topshirganlar: 14, o_rtacha: 89 },
        { time: '14:00', topshirganlar: 9, o_rtacha: 81 },
        { time: '16:00', topshirganlar: 5, o_rtacha: 87 },
      ];
    }

    // Group by hour of day
    const hourMap: Record<string, { count: number; totalPct: number }> = {};
    filteredSubmissions.forEach((sub) => {
      const d = new Date(sub.submittedAt);
      const hourStr = `${String(d.getHours()).padStart(2, '0')}:00`;
      if (!hourMap[hourStr]) {
        hourMap[hourStr] = { count: 0, totalPct: 0 };
      }
      hourMap[hourStr].count += 1;
      hourMap[hourStr].totalPct += sub.percentage || 0;
    });

    const sortedHours = Object.keys(hourMap).sort();
    return sortedHours.map((h) => ({
      time: h,
      topshirganlar: hourMap[h].count,
      o_rtacha: Math.round(hourMap[h].totalPct / hourMap[h].count),
    }));
  }, [filteredSubmissions, totalSubmissions]);

  // 6. Top Students Leaderboard
  const topStudents = useMemo(() => {
    return [...filteredSubmissions]
      .sort((a, b) => (b.percentage || 0) - (a.percentage || 0))
      .slice(0, 5);
  }, [filteredSubmissions]);

  return (
    <div className="space-y-6">
      {/* Top Header & Interactive Filter Bar */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs">
        <div>
          <div className="flex items-center space-x-2">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-600"></span>
            <h3 className="text-xl font-black text-slate-900 tracking-tight">
              O'quvchilar Ko'rsatkichlari Analitikasi (Dashboard)
            </h3>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Recharts vizualizatsiyasi: fanlar kesimida o'rtacha ballar, sinflar taqsimoti va o'zlashtirish reytingi
          </p>
        </div>

        {/* Filters */}
        <div className="flex items-center space-x-2.5">
          <div className="flex items-center space-x-1.5 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl text-xs">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <span className="font-semibold text-slate-500">Sinf:</span>
            <select
              value={selectedGrade}
              onChange={(e) => setSelectedGrade(e.target.value)}
              className="bg-transparent font-bold text-slate-800 focus:outline-none cursor-pointer"
            >
              <option value="all">Barchasi</option>
              {[5, 6, 7, 8, 9, 10, 11].map((g) => (
                <option key={g} value={g}>{g}-sinf</option>
              ))}
            </select>
          </div>

          <div className="flex items-center space-x-1.5 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl text-xs">
            <span className="font-semibold text-slate-500">Turi:</span>
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="bg-transparent font-bold text-slate-800 focus:outline-none cursor-pointer"
            >
              <option value="all">BSB & ChSB</option>
              <option value="BSB">Faqat BSB</option>
              <option value="ChSB">Faqat ChSB</option>
            </select>
          </div>
        </div>
      </div>

      {/* KPI Cards Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Submissions */}
        <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs relative overflow-hidden group hover:border-blue-300 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Topshirganlar</span>
            <div className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <Users className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline space-x-2">
            <span className="text-3xl font-black text-slate-900 tracking-tight">{totalSubmissions}</span>
            <span className="text-xs text-slate-500 font-medium">ta o'quvchi</span>
          </div>
          <div className="mt-2 flex items-center text-[11px] text-emerald-600 font-bold">
            <TrendingUp className="w-3.5 h-3.5 mr-1" />
            <span>Bazaga qayd etilgan natijalar</span>
          </div>
        </div>

        {/* Average Performance */}
        <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs relative overflow-hidden group hover:border-emerald-300 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">O'rtacha Ko'rsatkich</span>
            <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Award className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline space-x-2">
            <span className="text-3xl font-black text-emerald-600 tracking-tight">{averagePercentage}%</span>
            <span className="text-xs text-slate-500 font-medium">o'zlashtirish</span>
          </div>
          <div className="mt-2 text-[11px] text-slate-500">
            Standart maqsad: <strong className="text-slate-700">70% dan yuqori</strong>
          </div>
        </div>

        {/* Live Active Students */}
        <div
          onClick={() => onNavigateTab('live')}
          className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs relative overflow-hidden group hover:border-amber-300 cursor-pointer transition-all"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Hozir Imtihonda</span>
            <div className="w-10 h-10 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <Activity className="w-5 h-5 animate-pulse" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline space-x-2">
            <span className="text-3xl font-black text-amber-600 tracking-tight">{activeStudentsNow}</span>
            <span className="text-xs text-slate-500 font-medium">jonli o'quvchi</span>
          </div>
          <div className="mt-2 flex items-center text-[11px] text-blue-600 font-bold group-hover:underline">
            <span>Jonli nazoratga o'tish</span>
            <ArrowUpRight className="w-3 h-3 ml-0.5" />
          </div>
        </div>

        {/* Integrity Rate */}
        <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs relative overflow-hidden group hover:border-purple-300 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Halollik Ko'rsatkichi</span>
            <div className="w-10 h-10 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center">
              <ShieldCheck className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline space-x-2">
            <span className="text-3xl font-black text-purple-600 tracking-tight">{integrityRate}%</span>
            <span className="text-xs text-slate-500 font-medium">toza topshirish</span>
          </div>
          <div className="mt-2 text-[11px] text-slate-500">
            {cleanExamsCount} ta qoidabuzarliksiz topshirilgan
          </div>
        </div>
      </div>

      {/* Main Charts Grid: 2 Columns */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Chart 1: Average Scores Per Subject (BarChart) */}
        <div className="lg:col-span-7 bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-base font-bold text-slate-900 flex items-center space-x-2">
                <BookOpen className="w-4 h-4 text-blue-600" />
                <span>Fanlar Bo'yicha O'rtacha Natijalar (Average Scores Per Subject)</span>
              </h4>
              <p className="text-xs text-slate-500 mt-0.5">
                Har bir fan bo'yicha o'quvchilarning foizli o'zlashtirish ko'rsatkichi
              </p>
            </div>
            <span className="px-2.5 py-1 bg-blue-50 text-blue-700 text-xs font-bold rounded-lg border border-blue-200">
              Foiz (%)
            </span>
          </div>

          <div className="h-72 w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={subjectScoresData} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="subject" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <Tooltip
                  formatter={(val: any, name: any, item: any) => [
                    `${val}% (${item.payload.qatnashuvchilar} ta o'quvchi)`,
                    item.payload.fullSubject,
                  ]}
                  contentStyle={{
                    backgroundColor: '#ffffff',
                    borderRadius: '16px',
                    border: '1px solid #e2e8f0',
                    fontSize: '12px',
                    boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)',
                  }}
                />
                <Bar dataKey="o_rtacha_foiz" fill="#3b82f6" radius={[8, 8, 0, 0]} barSize={36} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart 2: Performance Levels (PieChart) */}
        <div className="lg:col-span-5 bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-base font-bold text-slate-900 flex items-center space-x-2">
                <Sparkles className="w-4 h-4 text-emerald-600" />
                <span>O'zlashtirish Darajalari (Performance Ratios)</span>
              </h4>
              <p className="text-xs text-slate-500 mt-0.5">
                A'lo, yaxshi, qoniqarli va qoniqarsiz baholar taqsimoti
              </p>
            </div>
          </div>

          <div className="h-72 w-full flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={performanceLevelsData}
                  cx="50%"
                  cy="45%"
                  innerRadius={55}
                  outerRadius={85}
                  paddingAngle={4}
                  dataKey="value"
                >
                  {performanceLevelsData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(val: any, name: any) => [`${val} ta o'quvchi`, name]}
                  contentStyle={{
                    backgroundColor: '#ffffff',
                    borderRadius: '12px',
                    border: '1px solid #e2e8f0',
                    fontSize: '12px',
                  }}
                />
                <Legend
                  verticalAlign="bottom"
                  align="center"
                  wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Secondary Charts: Grade Distributions & Timeline */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Chart 3: Grade Distribution (BarChart) */}
        <div className="lg:col-span-6 bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-base font-bold text-slate-900 flex items-center space-x-2">
                <Layers className="w-4 h-4 text-purple-600" />
                <span>Sinflar Kesimida Taqsimot (Grade Distributions)</span>
              </h4>
              <p className="text-xs text-slate-500 mt-0.5">
                5-sinfdan 11-sinfgacha o'quvchilar soni va o'rtacha balli
              </p>
            </div>
            <span className="text-xs font-bold text-purple-700 bg-purple-50 px-2.5 py-1 rounded-lg border border-purple-200">
              5 - 11 sinflar
            </span>
          </div>

          <div className="h-64 w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={gradeDistributionData} margin={{ top: 10, right: 10, left: -20, bottom: 10 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="sinf" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <Tooltip
                  formatter={(val: any, name: any) => [
                    name === 'o_rtacha_ball' ? `${val}% o'rtacha` : `${val} ta o'quvchi`,
                    name === 'o_rtacha_ball' ? "O'rtacha natija" : "Topshirganlar soni",
                  ]}
                  contentStyle={{
                    backgroundColor: '#ffffff',
                    borderRadius: '12px',
                    border: '1px solid #e2e8f0',
                    fontSize: '12px',
                  }}
                />
                <Bar dataKey="o_quvchilar" fill="#8b5cf6" radius={[6, 6, 0, 0]} barSize={28} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart 4: Timeline / Activity Trend (AreaChart) */}
        <div className="lg:col-span-6 bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-base font-bold text-slate-900 flex items-center space-x-2">
                <Activity className="w-4 h-4 text-emerald-600" />
                <span>Imtihonlar Faollik Dinamikasi (Activity Timeline)</span>
              </h4>
              <p className="text-xs text-slate-500 mt-0.5">
                Kun davomida test topshirish intensivligi va o'rtacha natijalar
              </p>
            </div>
            <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200">
              Vaqt bo'yicha
            </span>
          </div>

          <div className="h-64 w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={timelineData} margin={{ top: 10, right: 10, left: -20, bottom: 10 }}>
                <defs>
                  <linearGradient id="colorTopshirdi" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.8} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="time" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <Tooltip
                  formatter={(val: any, name: any) => [
                    name === 'topshirganlar' ? `${val} ta o'quvchi` : `${val}%`,
                    name === 'topshirganlar' ? 'Topshirganlar soni' : "O'rtacha ko'rsatkich",
                  ]}
                  contentStyle={{
                    backgroundColor: '#ffffff',
                    borderRadius: '12px',
                    border: '1px solid #e2e8f0',
                    fontSize: '12px',
                  }}
                />
                <Area type="monotone" dataKey="topshirganlar" stroke="#10b981" fillOpacity={1} fill="url(#colorTopshirdi)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Bottom Section: Top Performing Students Leaderboard */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <h4 className="text-base font-bold text-slate-900 flex items-center space-x-2">
              <Award className="w-5 h-5 text-amber-500" />
              <span>Eng Yuqori Natija Ko'rsatgan O'quvchilar (Top Performers)</span>
            </h4>
            <p className="text-xs text-slate-500 mt-0.5">
              Eng yuqori ball to'plagan va imtihonni namunali topshirgan o'quvchilar reytingi
            </p>
          </div>
          <button
            onClick={() => onNavigateTab('analytics')}
            className="text-xs font-bold text-blue-600 hover:text-blue-700 flex items-center space-x-1 cursor-pointer"
          >
            <span>Barcha o'quvchilarni ko'rish</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {topStudents.length === 0 ? (
          <div className="text-center py-10 text-xs text-slate-400 border border-dashed rounded-2xl">
            Hozircha topshirilgan testlar yo'q. O'quvchilar test topshirgach ularning reytingi bu yerda avtomatik aks etadi.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3 pt-1">
            {topStudents.map((st, idx) => {
              const medals = ['🥇', '🥈', '🥉', '🏅', '🎖️'];
              return (
                <div
                  key={st.id || idx}
                  className="p-4 bg-slate-50 hover:bg-blue-50/50 rounded-2xl border border-slate-200/80 space-y-2 transition-all"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-lg">{medals[idx] || '🎖️'}</span>
                    <span className="text-xs font-black text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                      {st.percentage}%
                    </span>
                  </div>

                  <div>
                    <h5 className="text-xs font-bold text-slate-900 truncate" title={st.studentName}>
                      {st.studentName}
                    </h5>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      {st.grade}-{st.group} sinf
                    </p>
                  </div>

                  <div className="pt-2 border-t border-slate-200/80 flex items-center justify-between text-[11px]">
                    <span className="text-slate-500 font-medium">Ball:</span>
                    <span className="font-bold text-blue-700">
                      {st.score} / {st.maxScore}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
