import * as pdfjsLib from 'pdfjs-dist';
import { Question } from '../types';
import { parseFromHtmlAndText, ParsedQuestionResult } from './wordParser';

// Set worker source to CDN for browser execution without build issues
if (typeof window !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;
}

export async function parsePdfFile(file: File): Promise<ParsedQuestionResult> {
  const arrayBuffer = await file.arrayBuffer();
  const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) });
  const pdfDoc = await loadingTask.promise;

  const numPages = pdfDoc.numPages;
  const pageTexts: string[] = [];

  for (let i = 1; i <= numPages; i++) {
    const page = await pdfDoc.getPage(i);
    const textContent = await page.getTextContent();

    // Group items by line based on vertical position
    const items = textContent.items as Array<{ str: string; transform: number[] }>;
    if (!items || items.length === 0) continue;

    // Sort items top-to-bottom, left-to-right
    const sorted = [...items].sort((a, b) => {
      const yDiff = b.transform[5] - a.transform[5];
      if (Math.abs(yDiff) > 5) {
        return yDiff;
      }
      return a.transform[4] - b.transform[4];
    });

    let currentY = sorted[0]?.transform[5];
    let currentLine = '';
    const lines: string[] = [];

    for (const item of sorted) {
      if (Math.abs(item.transform[5] - currentY) > 5) {
        if (currentLine.trim()) {
          lines.push(currentLine.trim());
        }
        currentLine = item.str;
        currentY = item.transform[5];
      } else {
        currentLine += (currentLine ? ' ' : '') + item.str;
      }
    }
    if (currentLine.trim()) {
      lines.push(currentLine.trim());
    }

    pageTexts.push(lines.join('\n'));
  }

  const rawText = pageTexts.join('\n\n');
  const syntheticHtml = `<div>${pageTexts.map((p) => `<p>${p.replace(/\n/g, '<br/>')}</p>`).join('')}</div>`;

  const parsed = parseFromHtmlAndText(syntheticHtml, rawText);
  return {
    ...parsed,
    rawText,
  };
}
