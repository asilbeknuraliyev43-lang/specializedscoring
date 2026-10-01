import {
  collection,
  doc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  onSnapshot,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { Test, Question, ExamSession, Submission } from '../types';
import { INITIAL_TESTS, INITIAL_QUESTIONS } from '../data/initialData';

const TESTS_COL = 'tests';
const QUESTIONS_COL = 'questions';
const SESSIONS_COL = 'exam_sessions';
const SUBMISSIONS_COL = 'submissions';

// Local storage fallback cache keys
const LS_TESTS = 'bsb_cached_tests';
const LS_QUESTIONS = 'bsb_cached_questions';
const LS_SUBMISSIONS = 'bsb_cached_submissions';

export async function initializeDatabase() {
  try {
    const snap = await getDocs(collection(db, TESTS_COL));
    if (snap.empty) {
      // Seed initial tests
      for (const t of INITIAL_TESTS) {
        await setDoc(doc(db, TESTS_COL, t.id), t);
      }
      // Seed initial questions
      for (const q of INITIAL_QUESTIONS) {
        await setDoc(doc(db, QUESTIONS_COL, q.id), q);
      }
    }
  } catch (error) {
    console.warn('Initial Firestore seed check error (using fallback):', error);
    // Seed local cache if empty
    if (!localStorage.getItem(LS_TESTS)) {
      localStorage.setItem(LS_TESTS, JSON.stringify(INITIAL_TESTS));
    }
    if (!localStorage.getItem(LS_QUESTIONS)) {
      localStorage.setItem(LS_QUESTIONS, JSON.stringify(INITIAL_QUESTIONS));
    }
  }
}

export function subscribeTests(callback: (tests: Test[]) => void) {
  try {
    const unsub = onSnapshot(
      collection(db, TESTS_COL),
      (snapshot) => {
        const tests: Test[] = [];
        snapshot.forEach((doc) => {
          tests.push({ ...doc.data(), id: doc.id } as Test);
        });
        if (tests.length > 0) {
          localStorage.setItem(LS_TESTS, JSON.stringify(tests));
          callback(tests);
        } else {
          // If empty, return initial
          callback(INITIAL_TESTS);
        }
      },
      (err) => {
        console.warn('subscribeTests onSnapshot error:', err);
        const cached = localStorage.getItem(LS_TESTS);
        callback(cached ? JSON.parse(cached) : INITIAL_TESTS);
      }
    );
    return unsub;
  } catch (err) {
    const cached = localStorage.getItem(LS_TESTS);
    callback(cached ? JSON.parse(cached) : INITIAL_TESTS);
    return () => {};
  }
}

export async function saveTest(test: Test): Promise<void> {
  try {
    await setDoc(doc(db, TESTS_COL, test.id), test);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `${TESTS_COL}/${test.id}`);
  }
}

export async function deleteTest(testId: string): Promise<void> {
  try {
    await deleteDoc(doc(db, TESTS_COL, testId));
    // Also delete questions
    const qSnap = await getDocs(query(collection(db, QUESTIONS_COL), where('testId', '==', testId)));
    for (const d of qSnap.docs) {
      await deleteDoc(d.ref);
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `${TESTS_COL}/${testId}`);
  }
}

export async function getQuestionsForTest(testId: string): Promise<Question[]> {
  try {
    const qSnap = await getDocs(query(collection(db, QUESTIONS_COL), where('testId', '==', testId)));
    const questions: Question[] = [];
    qSnap.forEach((d) => {
      questions.push({ ...d.data(), id: d.id } as Question);
    });

    if (questions.length > 0) {
      return questions.sort((a, b) => a.questionNumber - b.questionNumber);
    }

    // Check initial questions fallback
    const initMatch = INITIAL_QUESTIONS.filter((q) => q.testId === testId);
    if (initMatch.length > 0) return initMatch;

    return [];
  } catch (error) {
    console.warn('getQuestionsForTest fallback:', error);
    const cached = localStorage.getItem(LS_QUESTIONS);
    if (cached) {
      const all: Question[] = JSON.parse(cached);
      return all.filter((q) => q.testId === testId).sort((a, b) => a.questionNumber - b.questionNumber);
    }
    return INITIAL_QUESTIONS.filter((q) => q.testId === testId);
  }
}

export async function saveQuestionsBatch(testId: string, questions: Question[]): Promise<void> {
  try {
    // Delete existing questions for this test first to prevent orphan IDs
    const existing = await getDocs(query(collection(db, QUESTIONS_COL), where('testId', '==', testId)));
    for (const d of existing.docs) {
      await deleteDoc(d.ref);
    }

    for (const q of questions) {
      await setDoc(doc(db, QUESTIONS_COL, q.id), q);
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, QUESTIONS_COL);
  }
}

// Real-time student exam sessions for live monitoring (Jonli Nazorat)
export function subscribeLiveSessions(callback: (sessions: ExamSession[]) => void) {
  try {
    const unsub = onSnapshot(
      collection(db, SESSIONS_COL),
      (snapshot) => {
        const sessions: ExamSession[] = [];
        snapshot.forEach((doc) => {
          sessions.push({ ...doc.data(), id: doc.id } as ExamSession);
        });
        callback(sessions);
      },
      (err) => {
        console.warn('subscribeLiveSessions error:', err);
        callback([]);
      }
    );
    return unsub;
  } catch (err) {
    callback([]);
    return () => {};
  }
}

export async function createExamSession(session: ExamSession): Promise<void> {
  try {
    await setDoc(doc(db, SESSIONS_COL, session.id), session);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `${SESSIONS_COL}/${session.id}`);
  }
}

export async function updateExamSession(sessionId: string, updates: Partial<ExamSession>): Promise<void> {
  try {
    await updateDoc(doc(db, SESSIONS_COL, sessionId), updates);
  } catch (error) {
    // Session might have been cleared or created locally
    console.warn('updateExamSession error:', error);
  }
}

// Submissions for analytics and Excel download
export function subscribeSubmissions(callback: (subs: Submission[]) => void) {
  try {
    const unsub = onSnapshot(
      collection(db, SUBMISSIONS_COL),
      (snapshot) => {
        const subs: Submission[] = [];
        snapshot.forEach((doc) => {
          subs.push({ ...doc.data(), id: doc.id } as Submission);
        });
        localStorage.setItem(LS_SUBMISSIONS, JSON.stringify(subs));
        callback(subs);
      },
      (err) => {
        console.warn('subscribeSubmissions error:', err);
        const cached = localStorage.getItem(LS_SUBMISSIONS);
        callback(cached ? JSON.parse(cached) : []);
      }
    );
    return unsub;
  } catch (err) {
    const cached = localStorage.getItem(LS_SUBMISSIONS);
    callback(cached ? JSON.parse(cached) : []);
    return () => {};
  }
}

export async function submitExamResult(submission: Submission, sessionId?: string): Promise<void> {
  try {
    await setDoc(doc(db, SUBMISSIONS_COL, submission.id), submission);
    if (sessionId) {
      await updateDoc(doc(db, SESSIONS_COL, sessionId), {
        status: submission.status === 'disqualified' ? 'disqualified' : 'submitted',
        score: submission.score,
        maxScore: submission.maxScore,
        percentage: submission.percentage,
        isDisqualified: submission.status === 'disqualified',
        disqualifyReason: submission.disqualifyReason,
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `${SUBMISSIONS_COL}/${submission.id}`);
  }
}
