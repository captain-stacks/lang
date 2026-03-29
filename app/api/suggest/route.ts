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
          'You are a Spanish word autocomplete assistant. The user will send Spanish text. If the last characters form an incomplete word (no trailing space), return 4 different completions of that partial word as full words. If the text ends with a space, return 4 natural next words. Return ONLY a JSON array of single words, no phrases, no explanation. Examples: "yo qui" → ["quiero","quien","quizás","quince"]; "yo quiero " → ["aprender","comer","ir","hablar"]',
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
