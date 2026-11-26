// Bluff topics, shared by the app and the server.
export const BLUFF_TOPICS = [['trivia', 'Trivia'], ['thanksgiving', 'Thanksgiving'], ['music', 'Music'], ['sports', 'Sports'],
  ['oklahoma', 'Oklahoma history'], ['disney', 'Disney Channel'], ['bible', 'Bible'], ['words', 'Word meanings'], ['about', 'About us']];
export const isTopic = id => BLUFF_TOPICS.some(([t]) => t === id);
