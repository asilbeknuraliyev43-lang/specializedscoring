# Security Specification & Test Matrix

## 1. Data Invariants
- Tests (`/tests/{testId}`): Any student or visitor can read active tests to see available exams. Admin can create, update, and delete tests.
- Questions (`/questions/{questionId}`): Questions can be read by students taking tests. Admin can create, modify, and delete questions.
- Exam Sessions (`/exam_sessions/{sessionId}`): Created when a student begins an exam. Can be updated with ping, answers, and tabSwitchCount. Read by admins for real-time monitoring.
- Submissions (`/submissions/{submissionId}`): Created when exam is submitted or terminated. Can be read by admins for analytics and export.

## 2. Dirty Dozen Payloads
1. Attempting to create a test without title or subject.
2. Attempting to set an invalid test type (e.g. "UNKNOWN" instead of "BSB" or "ChSB").
3. Injecting a massive string (>5000 chars) into question text.
4. Setting a negative duration or point value for a question.
5. Attempting to tamper with existing submission scores without proper document structure.
6. Spoofing document IDs with special symbols or oversized keys (>128 chars).
7. Injecting unauthorized fields into exam sessions.
8. Trying to set tabSwitchCount as a string or negative value.
9. Modifying an already submitted session after completion.
10. Creating an exam session with invalid grade (< 5 or > 11).
11. Reading unallowed internal configuration.
12. Attempting to overwrite existing test documents without proper fields.

## 3. Test Runner
Verified via rule specifications and strict data type constraints.
