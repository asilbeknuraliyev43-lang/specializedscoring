export type TestType = 'BSB' | 'ChSB';

export type QuestionType =
  | 'multiple_choice'
  | 'written'
  | 'matching'
  | 'true_false'
  | 'fill_blank';

export type QuestionDifficulty = 'easy' | 'medium' | 'hard';

export interface MatchingPair {
  id: string;
  left: string;
  right: string;
}

export interface Question {
  id: string;
  testId: string;
  questionNumber: number;
  text: string;
  imageUrl?: string; // base64 or url
  type: QuestionType;
  difficulty?: QuestionDifficulty;
  options?: string[]; // for multiple_choice e.g. ["A) Variant 1", "B) Variant 2"]
  correctAnswer?: string; // "A" or "true"/"false" or keyword
  matchingPairs?: MatchingPair[]; // for matching questions
  points: number;
  explanation?: string;
  hint?: string;
  createdAt?: string;
}

export type TestStatus = 'waiting' | 'active' | 'finished';

export interface Test {
  id: string;
  title: string;
  subject: string;
  grade: number; // primary or default grade (5..11)
  allowedGrades?: number[]; // [5, 6, 7, 8, 9, 10, 11]
  gradeDurations?: Record<number, number>; // Grade-specific time limits e.g. { 7: 45, 8: 40, 9: 50 }
  group?: string; // "Barchasi" or "A1, A2, AT, T"
  type: TestType;
  description: string;
  durationMinutes: number; // fallback duration
  isActive: boolean; // backward compatibility: true if status === 'active'
  status?: TestStatus; // 'waiting' (Start berilmagan), 'active' (Start berilgan / jarayonda), 'finished' (Finish qilingan)
  startedAt?: string;
  finishedAt?: string;
  accessPassword?: string; // Optional access PIN / password
  totalPoints: number;
  questionsCount: number;
  multipleChoiceCount?: number;
  writtenCount?: number;
  shuffleQuestions?: boolean;
  passingPercentage?: number;
  allowBackNav?: boolean;
  showImmediateResults?: boolean;
  createdAt: string;
  updatedAt?: string;
  author?: string;
}

export interface StudentProfile {
  fullName: string;
  grade: number; // 5..11
  group: string; // "A1", "A2", "AT", "T"
}

export interface ExamSession {
  id: string;
  testId: string;
  testTitle: string;
  studentName: string;
  grade: number;
  group: string;
  status: 'in_progress' | 'submitted' | 'disqualified';
  startTime: string; // ISO
  endTime: string; // ISO expected end time
  lastPing: string;
  currentQuestionIndex: number;
  totalQuestions: number;
  tabSwitchCount: number; // 0, 1, 2
  warnings: Array<{
    timestamp: string;
    reason: string;
  }>;
  isDisqualified: boolean;
  disqualifyReason?: string;
  answers: Record<string, string>; // questionId -> answer string
  score?: number;
  maxScore?: number;
  percentage?: number;
}

export interface Submission {
  id: string;
  sessionId: string;
  testId: string;
  testTitle: string;
  testType: TestType;
  subject: string;
  studentName: string;
  grade: number;
  group: string;
  score: number;
  maxScore: number;
  percentage: number;
  tabSwitchCount: number;
  submittedAt: string;
  durationSpentSeconds: number;
  status: 'passed' | 'disqualified' | 'reviewed';
  answers: Record<string, string>;
  disqualifyReason?: string;
}
