// Asks Claude Haiku for a believable fake answer. The key stays on the server.
const SYSTEM = 'You help a family party game (ages 10 and up) where players invent believable fake answers to fool each other. '
  + 'Reply with only one fake answer: under 8 words, no quotes, no explanation, clean and kind. It must be wrong, not a rewording of the real answer.';

const FUNNY = 'You help a family party game (ages 10 and up) where players write the funniest answer to a silly prompt. '
  + 'Reply with only one funny answer: under 8 words, no quotes, no explanation, clean and kind.';

export async function suggest({ question, answer, funny }, key = process.env.ANTHROPIC_API_KEY) {
  if (!key) throw new Error('ANTHROPIC_API_KEY is missing');
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': key, 'anthropic-version': '2026-10-21', 'content-type': 'application/json' },
    body: JSON.stringify({
      model: 'claude-haiku-5-5', max_tokens: 1024, system: funny ? FUNNY : SYSTEM,
      messages: [{ role: 'user', content: `${funny ? 'Prompt' : 'Question'}: ${question}${answer ? `\nReal answer (do not use): ${answer}` : ''}` }],
    }),
    signal: AbortSignal.timeout(8000),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Claude API ${res.status}: ${data.error?.message}`);
  const text = data.content?.find(block => block.type === 'text')?.text ?? '';
  return text.split('\n')[0].replace(/^["'\s]+|["'.\s]+$/g, '').slice(0, 60);
}
