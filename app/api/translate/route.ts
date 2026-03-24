import OpenAI from 'openai';

export async function POST(req: Request) {
  const { text, apiKey } = await req.json();
  if (!apiKey || !text) return new Response('', { status: 400 });

  const openai = new OpenAI({ apiKey });

  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    max_tokens: 512,
    messages: [
      {
        role: 'system',
        content: 'Translate the following text to English. Return only the translation, nothing else.',
      },
      { role: 'user', content: text },
    ],
  });

  const translation = response.choices[0]?.message?.content ?? '';
  return Response.json({ translation });
}
