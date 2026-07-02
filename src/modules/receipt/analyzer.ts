import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

const PROMPT = `Extract transaction details from this receipt/image.
Return JSON with:
- items: array of {name: string, price: number} - item names and prices in Rupiah (number, not string)
- total: number - the total amount (number, not string)
- raw_text: string - original text for debugging

Only respond with valid JSON. Items should have Indonesian names if possible.
Example response:
{"items":[{"name":"Nasi Goreng","price":25000},{"name":"Es Teh","price":8000}],"total":33000,"raw_text":"..."}`;

export interface ExtractionResult {
  items: Array<{ name: string; price: number }>;
  total: number;
  rawText?: string;
}

export async function analyzeReceipt(imageBase64: string): Promise<ExtractionResult> {
  const imageData = imageBase64.replace(/^data:image\/\w+;base64,/, '');
  const imageBuffer = Buffer.from(imageData, 'base64');

  const result = await model.generateContent([
    PROMPT,
    {
      inlineData: {
        mimeType: 'image/jpeg',
        data: imageBuffer.toString('base64'),
      },
    },
  ]);

  const response = result.response;
  const text = response.text().trim();

  let parsed: ExtractionResult;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('Gagal membaca nota. Coba upload ulang atau input manual.');
  }

  return {
    items: parsed.items || [],
    total: parsed.total || 0,
    rawText: parsed.rawText,
  };
}
