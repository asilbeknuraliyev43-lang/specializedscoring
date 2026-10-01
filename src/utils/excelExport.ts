// @ts-ignore
import * as XLSX from 'xlsx';
import { Submission } from '../types';

export function exportSubmissionsToExcel(submissions: Submission[], fileNamePrefix = 'BSB_ChSB_Natijalar') {
  if (!submissions || submissions.length === 0) {
    alert("Yuklab olish uchun natijalar mavjud emas!");
    return;
  }

  const data = submissions.map((sub, idx) => {
    const minutes = Math.floor((sub.durationSpentSeconds || 0) / 60);
    const seconds = (sub.durationSpentSeconds || 0) % 60;
    const timeSpent = `${minutes} daq ${seconds} son`;

    let statusText = "Muvaffaqiyatli topshirildi";
    if (sub.status === 'disqualified') {
      statusText = `Chetlashtirildi (${sub.disqualifyReason || "Boshqa oynaga o'tish"})`;
    }

    return {
      '№': idx + 1,
      "O'quvchi F.I.Sh": sub.studentName,
      'Sinf': `${sub.grade}-${sub.group}`,
      'Fan': sub.subject || "Umumiy",
      'Imtihon turi': sub.testType || 'BSB',
      'Test nomi': sub.testTitle,
      "To'plangan ball": sub.score,
      'Maksimal ball': sub.maxScore,
      'Natija (%)': `${sub.percentage}%`,
      'Qoidabuzarliklar (Tab almashtirish)': sub.tabSwitchCount || 0,
      'Sarflangan vaqt': timeSpent,
      'Holati': statusText,
      'Topshirilgan vaqt': sub.submittedAt ? new Date(sub.submittedAt).toLocaleString('uz-UZ') : '-',
    };
  });

  const worksheet = XLSX.utils.json_to_sheet(data);

  // Set column widths
  worksheet['!cols'] = [
    { wch: 5 },   // №
    { wch: 28 },  // Ism
    { wch: 10 },  // Sinf
    { wch: 18 },  // Fan
    { wch: 14 },  // Turi
    { wch: 30 },  // Test
    { wch: 14 },  // Ball
    { wch: 14 },  // Max ball
    { wch: 12 },  // Foiz
    { wch: 22 },  // Qoidabuzarlik
    { wch: 18 },  // Vaqt
    { wch: 28 },  // Holat
    { wch: 22 },  // Sana
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Imtihon Natijalari');

  const now = new Date();
  const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const fullFileName = `${fileNamePrefix}_${dateStr}.xlsx`;

  XLSX.writeFile(workbook, fullFileName);
}
