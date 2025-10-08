import {pdfToText} from 'pdf-ts';

export async function extractTextFromPdfBuffer(buffer: Buffer): Promise<string> {
  const text = await pdfToText(buffer);
  // basic normalization
  return text.replace(/\r\n/g, '\n').trim();
}
