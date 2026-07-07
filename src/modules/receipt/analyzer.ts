import OpenAI from 'openai';

const GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/openai/';
const GEMINI_MODEL = 'gemini-2.5-flash-lite';
const SUMOPOD_BASE_URL = 'https://ai.sumopod.com/v1';
const SUMOPOD_MODEL = 'gpt-4o-mini';

const geminiClient = new OpenAI({
  apiKey: process.env.GEMINI_API_KEY!,
  baseURL: GEMINI_BASE_URL,
});

const sumopodClient = new OpenAI({
  apiKey: process.env.SUMOPOD_API_KEY!,
  baseURL: SUMOPOD_BASE_URL,
});

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

async function analyzeWithGemini(imageBase64: string, mimeType: string, imageData: string): Promise<ExtractionResult> {
  const result = await geminiClient.chat.completions.create({
    model: GEMINI_MODEL,
    max_tokens: 4096,
    messages: [{
      role: 'user',
      content: [
        { type: 'text', text: PROMPT },
        { type: 'image_url', image_url: { url: `data:${mimeType};base64,${imageData}` } }
      ]
    }]
  });

  const text = result.choices[0]?.message.content?.trim() || '';
  const cleaned = text.replace(/^```json\s*/, '').replace(/\s*```$/, '');
  return parseResponse(cleaned);
}

async function analyzeWithSumopod(imageBase64: string, mimeType: string, imageData: string): Promise<ExtractionResult> {
  const result = await sumopodClient.chat.completions.create({
    model: SUMOPOD_MODEL,
    max_tokens: 4096,
    messages: [{
      role: 'user',
      content: [
        { type: 'text', text: PROMPT },
        { type: 'image_url', image_url: { url: `data:${mimeType};base64,${imageData}` } }
      ]
    }]
  });

  const text = result.choices[0]?.message.content?.trim() || '';
  const cleaned = text.replace(/^```json\s*/, '').replace(/\s*```$/, '');
  return parseResponse(cleaned);
}

function parseResponse(text: string): ExtractionResult {
  try {
    const parsed = JSON.parse(text);
    return {
      items: parsed.items || [],
      total: parsed.total || 0,
      rawText: parsed.raw_text || parsed.rawText,
    };
  } catch {
    throw new Error('Gagal membaca nota. Coba upload ulang atau input manual.');
  }
}

export async function analyzeReceipt(imageBase64: string): Promise<ExtractionResult> {
  const mimeMatch = imageBase64.match(/^data:image\/(\w+);base64,/);
  const mimeType = mimeMatch ? `image/${mimeMatch[1]}` : 'image/jpeg';
  const imageData = imageBase64.replace(/^data:image\/\w+;base64,/, '');

  try {
    return await analyzeWithGemini(imageBase64, mimeType, imageData);
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    console.error('Gemini error:', err.message);

    if (process.env.SUMOPOD_API_KEY) {
      try {
        console.log('Trying SumoPod fallback...');
        return await analyzeWithSumopod(imageBase64, mimeType, imageData);
      } catch (sumopodError) {
        const sumopodErr = sumopodError instanceof Error ? sumopodError : new Error(String(sumopodError));
        console.error('SumoPod fallback error:', sumopodErr.message);
        throw new Error('AI service unavailable. Coba lagi nanti.');
      }
    }

    if (err.message.includes('429') || err.message.includes('rate limit') || err.message.includes('503')) {
      throw new Error('Rate limit. Tunggu sebentar lalu coba lagi.');
    }
    throw new Error('Gagal membaca nota. Coba upload ulang atau input manual.');
  }
}
