import os
import json
from flask import Flask, request, Response, render_template, stream_with_context
import anthropic
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__)
client = anthropic.Anthropic()

SYSTEM_PROMPT = """You are a friendly and encouraging Spanish language tutor. Your job is to help users practice Spanish by:

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
Keep responses concise and focused — this is a chat, not a lecture."""


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/chat", methods=["POST"])
def chat():
    data = request.json
    messages = data.get("messages", [])

    def generate():
        with client.messages.stream(
            model="claude-opus-4-6",
            max_tokens=1024,
            system=SYSTEM_PROMPT,
            messages=messages,
        ) as stream:
            for text in stream.text_stream:
                yield f"data: {json.dumps({'text': text})}\n\n"
        yield "data: [DONE]\n\n"

    return Response(
        stream_with_context(generate()),
        mimetype="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )


if __name__ == "__main__":
    app.run(debug=True, port=5000)
