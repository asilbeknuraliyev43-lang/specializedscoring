// @ts-ignore
import mammoth from 'mammoth';
import { Question } from '../types';

export interface ParsedQuestionResult {
  questions: Omit<Question, 'id' | 'testId'>[];
  totalExtracted: number;
  multipleChoiceCount: number;
  writtenCount: number;
  rawText?: string;
  images?: string[];
}

export async function parseDocxFile(file: File): Promise<ParsedQuestionResult> {
  const arrayBuffer = await file.arrayBuffer();

  const extractedImages: string[] = [];

  // Convert docx to HTML with base64 embedded images
  const options = {
    convertImage: mammoth.images.imgElement((image: any) => {
      return image.read('base64').then((imageBuffer: string) => {
        const src = `data:${image.contentType};base64,${imageBuffer}`;
        extractedImages.push(src);
        return { src };
      });
    }),
  };

  const result = await mammoth.convertToHtml({ arrayBuffer }, options);
  const html = result.value;

  // Also convert to raw text for structured text splitting
  const rawTextResult = await mammoth.extractRawText({ arrayBuffer });
  const rawText = rawTextResult.value;

  const parsed = parseFromHtmlAndText(html, rawText);
  return {
    ...parsed,
    rawText,
    images: extractedImages,
  };
}

export function parseFromHtmlAndText(html: string, rawText: string): ParsedQuestionResult {
  // Parse HTML DOM to extract images per section if present
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');

  // Extract all paragraphs and images
  const elements = Array.from(doc.body.childNodes);
  const textBlocks: Array<{ text: string; image?: string }> = [];

  let currentBlockText = '';
  let currentBlockImg: string | undefined = undefined;

  elements.forEach((node) => {
    if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as HTMLElement;
      const img = el.querySelector('img') || (el.tagName.toLowerCase() === 'img' ? (el as HTMLImageElement) : null);
      if (img && img.src) {
        currentBlockImg = img.src;
      }
      const t = el.textContent?.trim() || '';
      if (t) {
        textBlocks.push({ text: t, image: currentBlockImg });
        currentBlockImg = undefined; // reset after assigning
      }
    } else if (node.nodeType === Node.TEXT_NODE) {
      const t = node.textContent?.trim() || '';
      if (t) {
        textBlocks.push({ text: t, image: currentBlockImg });
        currentBlockImg = undefined;
      }
    }
  });

  // Split raw text into question chunks
  // Question start patterns: "1.", "1)", "1-savol", "Savol 1", "№ 1"
  const lines = rawText.split('\n').map((l) => l.trim()).filter((l) => l.length > 0);
  const questionChunks: Array<{ lines: string[]; image?: string }> = [];

  let currentChunk: string[] = [];
  const questionStartRegex = /^(\d+[\.\)]|\d+\-topshiriq|\d+\-savol|topshiriq\s*\d+|savol\s*\d+|№\s*\d+|task\s*\d+|question\s*\d+)/i;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const isNewQuestion = questionStartRegex.test(line);

    if (isNewQuestion && currentChunk.length > 0) {
      // Find if any image was associated with the question text
      const chunkText = currentChunk.join(' ');
      const matchedBlock = textBlocks.find(
        (b) => b.image && chunkText.toLowerCase().includes(b.text.slice(0, 20).toLowerCase())
      );
      questionChunks.push({ lines: [...currentChunk], image: matchedBlock?.image });
      currentChunk = [line];
    } else {
      currentChunk.push(line);
    }
  }

  if (currentChunk.length > 0) {
    const chunkText = currentChunk.join(' ');
    const matchedBlock = textBlocks.find(
      (b) => b.image && chunkText.toLowerCase().includes(b.text.slice(0, 20).toLowerCase())
    );
    questionChunks.push({ lines: [...currentChunk], image: matchedBlock?.image });
  }

  // If no numbered chunks were detected, try splitting by double line breaks or blocks
  if (questionChunks.length === 0 && lines.length > 0) {
    questionChunks.push({ lines, image: textBlocks.find((b) => b.image)?.image });
  }

  const parsedQuestions: Omit<Question, 'id' | 'testId'>[] = [];

  questionChunks.forEach((chunk, index) => {
    const chunkLines = chunk.lines;
    if (chunkLines.length === 0) return;

    // Header line: clean leading numbers/prefixes
    let questionText = chunkLines[0].replace(/^(\d+[\.\)]|\d+\-topshiriq:?|\d+\-savol:?|topshiriq\s*\d+:?|savol\s*\d+:?|№\s*\d+:?)\s*/i, '').trim();

    const options: string[] = [];
    let correctAnswer = 'A';
    let isWritten = false;
    let points = 5; // default for school BSB questions
    let explanation = '';

    // Check for inline bracketed points like [4 ball], (5 ball), 6 ball
    const inlinePointsMatch = chunk.lines.join(' ').match(/\[(\d+)\s*ball\]|\((\d+)\s*ball\)|(\d+)\s*ballik/i);
    if (inlinePointsMatch) {
      points = parseInt(inlinePointsMatch[1] || inlinePointsMatch[2] || inlinePointsMatch[3], 10) || points;
    }

    // Check if explicitly marked as written question
    if (/yozma\s*savol|ochiq\s*savol|yechimini\s*yozing|tushuntiring|izohlang|aniqlang|chizma|jadval|rasmdan\s*foydalanib/i.test(chunkLines.join(' '))) {
      isWritten = true;
    }

    const optionRegex = /^([A-DА-Дa-dа-д])[\.\)]\s*(.*)$/;
    const answerRegex = /^(to['’`]?g['’`]?ri\s*javob|javob|kalit|otvet):\s*([A-DА-Дa-dа-д]|to['’`]?g['’`]?ri|noto['’`]?g['’`]?ri|ha|yo['’`]?q)/i;
    const pointsRegex = /^ball:\s*(\d+)/i;

    let inQuestionBody = true;

    for (let j = 1; j < chunkLines.length; j++) {
      const line = chunkLines[j];

      // Check points
      const pointsMatch = line.match(pointsRegex);
      if (pointsMatch) {
        points = parseInt(pointsMatch[1], 10) || points;
        continue;
      }

      // Check Answer line
      const ansMatch = line.match(answerRegex);
      if (ansMatch) {
        correctAnswer = ansMatch[2].toUpperCase();
        continue;
      }

      // Check Option line A), B), C), D)
      const optMatch = line.match(optionRegex);
      if (optMatch) {
        inQuestionBody = false;
        const letter = optMatch[1].toUpperCase();
        const content = optMatch[2].trim();
        // Check if marked with + or *
        if (content.startsWith('+') || line.startsWith('+')) {
          correctAnswer = letter;
        }
        options.push(`${letter}) ${content.replace(/^\+\s*/, '')}`);
        continue;
      }

      // If still before options, append to question text
      if (inQuestionBody) {
        questionText += `\n${line}`;
      } else {
        // Maybe explanation or note
        explanation += `\n${line}`;
      }
    }

    // Determine question type:
    let type: Question['type'] = 'written';

    const fullQuestionStr = `${questionText} ${options.join(' ')}`;

    if (/moslashtiring|muvofiqlashtiring|juftlik/i.test(fullQuestionStr)) {
      type = 'matching';
    } else if (
      options.length === 2 &&
      options.some((o) => /to['’`]?g['’`]?ri|ha|true/i.test(o)) &&
      options.some((o) => /noto['’`]?g['’`]?ri|yo['’`]?q|false/i.test(o))
    ) {
      type = 'true_false';
    } else if (
      /chiziqlar\s*o['’`]?rniga|bo['’`]?sh\s*joy|to['’`]?ldiring/i.test(fullQuestionStr) ||
      fullQuestionStr.includes('_____') ||
      fullQuestionStr.includes('……') ||
      fullQuestionStr.includes('.....')
    ) {
      type = 'fill_blank';
    } else if (options.length >= 2 && !isWritten) {
      type = 'multiple_choice';
      if (points === 5) points = 2; // default 2 points for simple choice questions
    } else {
      type = 'written';
    }

    parsedQuestions.push({
      questionNumber: index + 1,
      text: questionText.trim() || `Savol ${index + 1}`,
      type,
      options: type === 'multiple_choice' ? options : undefined,
      correctAnswer:
        type === 'multiple_choice'
          ? correctAnswer
          : type === 'fill_blank'
          ? 'Namunaviy kalit / to\'ldirish'
          : 'Yozma baholash mezoni',
      points,
      imageUrl: chunk.image,
      explanation: explanation.trim() || undefined,
    });
  });

  const mcCount = parsedQuestions.filter((q) => q.type === 'multiple_choice').length;
  const writtenCount = parsedQuestions.filter((q) => q.type === 'written').length;

  return {
    questions: parsedQuestions,
    totalExtracted: parsedQuestions.length,
    multipleChoiceCount: mcCount,
    writtenCount,
  };
}
