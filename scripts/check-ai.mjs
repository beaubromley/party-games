// Reports in the build log whether AI help works. Never fails the build.
import { suggest } from '../lib/hint.js';
try {
  const text = await suggest({ question: 'What is a group of owls called?', answer: 'A parliament' });
  console.log(text ? `AI help check: ok (${text})` : 'AI help check: empty reply');
} catch (err) { console.warn(`AI help check failed: ${err.message}`); }
