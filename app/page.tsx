'use client';

import { useState, useRef, useEffect, useCallback } from 'react';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  translation?: string;
}

function renderMarkdown(text: string): string {
  return text
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/✏️([^\n]+)/g, '<div class="correction">✏️$1</div>')
    .replace(/💡([^\n]+)/g, '<div class="tip">💡$1</div>')
    .replace(/\n\n/g, '</p><p>')
    .replace(/\n/g, '<br>')
    .replace(/^/, '<p>').replace(/$/, '</p>');
}

async function fetchTranslation(text: string, apiKey: string): Promise<string> {
  const res = await fetch('/api/translate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, apiKey }),
  });
  const { translation } = await res.json();
  return translation ?? '';
}

const STARTERS = [
  { label: "¡Hola! I'm a student", text: 'Hola! Yo soy estudiante y quiero aprender español.' },
  { label: 'Yesterday I went to the store', text: 'Ayer yo fue al supermercado.' },
  { label: 'I love Mexican food', text: 'Me gusta mucho la comida mexicano.' },
  { label: 'How can I improve?', text: '¿Cómo puedo mejorar mi español?' },
];

const QUICK_PHRASES = [
  { label: '👋 Introductions', text: 'Hola, me llamo...' },
  { label: '📖 Ser vs Estar', text: '¿Puedes explicarme la diferencia entre ser y estar?' },
  { label: '⏳ Past tense', text: 'Quiero practicar el pretérito indefinido.' },
  { label: '🔤 Translations', text: "¿Cómo se dice 'I am learning' en español?" },
];

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [keyInput, setKeyInput] = useState('');
  const [editingKey, setEditingKey] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const chatRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const keyInputRef = useRef<HTMLInputElement>(null);
  const suggestTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem('openai_api_key');
    if (saved) setApiKey(saved);
    else setEditingKey(true);
  }, []);

  useEffect(() => {
    if (editingKey) keyInputRef.current?.focus();
  }, [editingKey]);

  useEffect(() => {
    if (chatRef.current) {
      chatRef.current.scrollTop = chatRef.current.scrollHeight;
    }
  }, [messages]);

  const saveKey = () => {
    const k = keyInput.trim();
    if (!k) return;
    setApiKey(k);
    localStorage.setItem('openai_api_key', k);
    setKeyInput('');
    setEditingKey(false);
    textareaRef.current?.focus();
  };

  const fetchSuggestions = async (text: string, key: string) => {
    if (!text.trim() || !key) { setSuggestions([]); return; }
    try {
      const res = await fetch('/api/suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, apiKey: key }),
      });
      const data = await res.json();
      setSuggestions(Array.isArray(data.suggestions) ? data.suggestions : []);
    } catch {
      setSuggestions([]);
    }
  };

  const partialWord = input.endsWith(' ') ? '' : (input.trimEnd().split(/\s+/).pop() ?? '');

  const ghostText = (() => {
    if (!suggestions.length || isStreaming) return '';
    const top = suggestions[0];
    if (partialWord && top.toLowerCase().startsWith(partialWord.toLowerCase())) {
      return top.slice(partialWord.length);
    }
    if (!partialWord) return top;
    return '';
  })();

  const applyWord = (word: string) => {
    const base = partialWord
      ? input.slice(0, input.length - partialWord.length)
      : input.endsWith(' ') ? input : input + ' ';
    const newInput = base + word + ' ';
    setInput(newInput);
    setSuggestions([]);
    const el = textareaRef.current;
    if (el) { el.style.height = 'auto'; el.style.height = Math.min(el.scrollHeight, 140) + 'px'; }
    textareaRef.current?.focus();
    if (suggestTimer.current) clearTimeout(suggestTimer.current);
    suggestTimer.current = setTimeout(() => fetchSuggestions(newInput, apiKey), 700);
  };

  const sendMessage = useCallback(async (overrideText?: string) => {
    const content = overrideText ?? input.trim();
    if (!content || isStreaming || !apiKey) return;

    setSuggestions([]);
    if (suggestTimer.current) clearTimeout(suggestTimer.current);
    setInput('');
    setIsStreaming(true);

    const userIndex = messages.length;
    const newMessages: Message[] = [...messages, { role: 'user', content }];
    setMessages([...newMessages, { role: 'assistant', content: '' }]);

    // Translate user input concurrently with streaming
    fetchTranslation(content, apiKey).then(translation => {
      setMessages(prev => {
        const updated = [...prev];
        if (updated[userIndex]?.role === 'user') {
          updated[userIndex] = { ...updated[userIndex], translation };
        }
        return updated;
      });
    });

    let fullText = '';
    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: newMessages, apiKey }),
      });

      if (!response.ok || !response.body) throw new Error('Network error');

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const data = line.slice(6);
          if (data === '[DONE]') break;
          try {
            const parsed = JSON.parse(data);
            if (typeof parsed.text === 'string') {
              fullText += parsed.text;
              setMessages(prev => [
                ...prev.slice(0, -1),
                { role: 'assistant', content: fullText },
              ]);
            }
          } catch { /* ignore parse errors */ }
        }
      }

      // Translate assistant response after streaming completes
      fetchTranslation(fullText, apiKey).then(translation => {
        setMessages(prev => {
          const updated = [...prev];
          const last = updated.length - 1;
          if (updated[last]?.role === 'assistant') {
            updated[last] = { ...updated[last], translation };
          }
          return updated;
        });
      });
    } catch {
      setMessages(prev => [
        ...prev.slice(0, -1),
        { role: 'assistant', content: 'Lo siento — something went wrong. Please try again.' },
      ]);
    }

    setIsStreaming(false);
    textareaRef.current?.focus();
  }, [input, isStreaming, messages, apiKey]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Tab' && ghostText) {
      e.preventDefault();
      const newInput = input + ghostText + ' ';
      setInput(newInput);
      setSuggestions([]);
      const el = textareaRef.current;
      if (el) { el.style.height = 'auto'; el.style.height = Math.min(el.scrollHeight, 140) + 'px'; }
      if (suggestTimer.current) clearTimeout(suggestTimer.current);
      suggestTimer.current = setTimeout(() => fetchSuggestions(newInput, apiKey), 700);
      return;
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setInput(value);
    const el = e.target;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 140) + 'px';

    if (suggestTimer.current) clearTimeout(suggestTimer.current);
    if (value.trim()) {
      suggestTimer.current = setTimeout(() => fetchSuggestions(value, apiKey), 700);
    } else {
      setSuggestions([]);
    }
  };

  return (
    <>
      {editingKey && (
        <div className="key-panel">
          <span className="key-label">🔑 OpenAI API key:</span>
          <input
            ref={keyInputRef}
            className="key-input"
            type="password"
            value={keyInput}
            onChange={e => setKeyInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && saveKey()}
            placeholder="sk-..."
          />
          <button className="key-btn" onClick={saveKey}>Save</button>
          {apiKey && (
            <button className="key-btn key-btn-cancel" onClick={() => setEditingKey(false)}>
              Cancel
            </button>
          )}
        </div>
      )}

      <div className="hint-bar">
        <strong>Quick phrases:</strong>
        {QUICK_PHRASES.map(({ label, text }) => (
          <button key={label} onClick={() => sendMessage(text)} disabled={!apiKey}>{label}</button>
        ))}
      </div>

      <div className="chat" ref={chatRef}>
        {messages.length === 0 && (
          <div className="welcome">
            <div className="emoji">🌟</div>
            <h2>¡Bienvenido! Welcome!</h2>
            {apiKey ? (
              <>
                <p>Type anything in Spanish below. I&apos;ll correct mistakes, explain grammar, and help you improve.</p>
                <div className="starter-chips">
                  {STARTERS.map(({ label, text }) => (
                    <button key={label} className="chip" onClick={() => sendMessage(text)}>
                      {label}
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <p>Enter your OpenAI API key above to get started.</p>
            )}
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`message ${msg.role}`}>
            <div className="avatar">{msg.role === 'user' ? '👤' : '🤖'}</div>
            <div className="bubble-wrap">
              {msg.role === 'user' ? (
                <div className="bubble">{msg.content}</div>
              ) : msg.content === '' ? (
                <div className="bubble">
                  <div className="typing-indicator"><span /><span /><span /></div>
                </div>
              ) : (
                <div
                  className="bubble"
                  dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.content) }}
                />
              )}
              {msg.translation && (
                <div className={`translation ${msg.role}`}>
                  🌐 {msg.translation}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      <footer>
        {suggestions.length > 0 && !isStreaming && (
          <div className="suggestions">
            {ghostText && <span className="ghost-hint">Tab ↹</span>}
            {suggestions.slice(ghostText ? 1 : 0).map((s, i) => (
              <button key={i} className="suggestion-chip" onClick={() => applyWord(s)}>
                {s}
              </button>
            ))}
          </div>
        )}
        <div className="input-row">
          <div className="input-wrapper">
            {ghostText && (
              <div className="ghost-overlay" aria-hidden="true">
                <span style={{ color: 'transparent' }}>{input}</span>
                <span className="ghost-text">{ghostText}</span>
              </div>
            )}
            <textarea
              ref={textareaRef}
              value={input}
              onChange={handleInput}
              onKeyDown={handleKeyDown}
              placeholder={apiKey ? 'Escribe en español aquí... (Write in Spanish here...)' : 'Enter your API key above to start chatting'}
              rows={1}
              disabled={!apiKey || isStreaming}
            />
          </div>
          <button className="send-btn" onClick={() => sendMessage()} disabled={!apiKey || isStreaming}>
            Enviar →
          </button>
        </div>
        <div className="input-hint">
          <button className="change-key-btn" onClick={() => { setKeyInput(''); setEditingKey(true); }}>
            🔑 {apiKey ? 'Change key' : 'Set API key'}
          </button>
          <span>Enter to send · Shift+Enter for new line · Tab to autocomplete</span>
        </div>
      </footer>
    </>
  );
}
