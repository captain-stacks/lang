import OpenAI from 'openai';

const SYSTEM_PROMPT = `You are a friendly and encouraging Spanish language tutor. Your job is to help users practice Spanish by:

1. **Correcting mistakes**: If the user writes something incorrect or unnatural, gently point out the error and show the correct form.
2. **Explaining grammar**: Give brief, clear grammar explanations when relevant.
3. **Vocabulary hints**: Offer vocabulary suggestions, synonyms, or better word choices.
4. **Cultural notes**: Occasionally share relevant cultural context.
5. **Encouragement**: Always be positive and encouraging.

Format your responses clearly:
- Start by acknowledging what the user wrote
- Show corrections with ✏️ if needed (show: ❌ original → ✅ corrected)
- Give a 💡 tip for grammar or vocabulary hints
- Respond naturally to the content of their message in both Spanish and English
- End with a follow-up question or prompt to keep the conversation going

If the user writes in English, gently encourage them to try in Spanish and offer helpful phrases they could use.
Keep responses concise and focused — this is a chat, not a lecture.`;

export async function POST(req: Request) {
  const { messages, apiKey } = await req.json();

  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'API key required' }), { status: 400 });
  }

  const openai = new OpenAI({ apiKey });
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      try {
        const openaiStream = await openai.chat.completions.create({
          model: 'gpt-4o',
          max_tokens: 1024,
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            ...messages,
          ],
          stream: true,
        });

        for await (const chunk of openaiStream) {
          const text = chunk.choices[0]?.delta?.content ?? '';
          if (text) {
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ text })}\n\n`)
            );
          }
        }

        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Stream error';
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ error: message })}\n\n`)
        );
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
    },
  });
}
