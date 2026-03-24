import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

export async function POST(req: NextRequest) {
  const { text, apiKey } = await req.json();
  if (!text?.trim() || !apiKey) return NextResponse.json({ suggestions: [] });

  const client = new OpenAI({ apiKey });

  const response = await client.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      {
        role: 'system',
        content:
          'You are a Spanish autocomplete assistant. Given partial Spanish text, suggest 4 different short natural continuations (next 1–3 words each). Return ONLY a JSON array of strings with no explanation. Example output: ["tengo que ir","quiero comer","me gusta mucho","voy a hacer"]',
      },
      { role: 'user', content: text },
    ],
    max_tokens: 80,
    temperature: 0.7,
  });

  const raw = response.choices[0]?.message?.content ?? '[]';
  try {
    const suggestions = JSON.parse(raw);
    return NextResponse.json({ suggestions: Array.isArray(suggestions) ? suggestions : [] });
  } catch {
    return NextResponse.json({ suggestions: [] });
  }
}
