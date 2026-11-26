// Pure game logic, kept separate so it can be tested without a phone.

// How far the screen faces the sky: 1 = flat face up, 0 = upright (on a forehead), -1 = face down.
export const facing = (beta, gamma) => Math.cos(beta * Math.PI / 180) * Math.cos(gamma * Math.PI / 180);

// One answer per tilt: the phone must come back upright before the next one counts.
export function tiltDetector({ trigger = 0.65, rest = 0.35 } = {}) {
  let armed = false;
  return (beta, gamma) => {
    if (beta == null || gamma == null) return null;
    const f = facing(beta, gamma);
    if (Math.abs(f) < rest) { armed = true; return null; }
    if (!armed || Math.abs(f) < trigger) return null;
    armed = false;
    return f < 0 ? 'got' : 'pass';
  };
}

export function shuffle(list, random = Math.random) {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
