// Pure comparison logic. No DOM, network, or storage access.
export const VERSION = '1.0.0';
export const LIMITS = Object.freeze({ question: 8000, answer: 40000, origin: 120, note: 2000, json: 600000 });
export const METRICS = Object.freeze(['usefulness', 'clarity', 'factualConfidence']);
export const LABELS = Object.freeze(['A', 'B']);
export const ALGORITHM = 'mulberry32-first-draw-v1';
export const CAVEATS = Object.freeze([
  'Ratings and verdict are human self-reports, not automated evaluations.',
  'Factual confidence is not verified factual accuracy.',
  'One comparison does not establish model superiority.',
  'Origins are user-supplied and are not authenticated.',
  'The UI hides source fields, not recognizable writing or identities in the answer text. Local data is inspectable.'
]);
const copy = value => structuredClone(value);
const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const requireThat = (condition, message) => { if (!condition) throw new Error(message); };
function text(value, max, name, required = false) {
  requireThat(typeof value === 'string', `${name} must be text.`);
  requireThat(value.length <= max, `${name} is too long (maximum ${max.toLocaleString('en-US')} characters).`);
  requireThat(!required || value.trim().length > 0, `${name} is required.`);
  return value;
}
function iso(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value) && Number.isFinite(Date.parse(value));
}
export function emptySession() {
  return { version: 1, phase: 'setup', remember: false, synthetic: false, question: '',
    inputs: [{ origin: '', text: '' }, { origin: '', text: '' }],
    randomization: null, ratings: { A: {}, B: {} }, verdict: null, note: '', lockedAt: null };
}
export function validateInputs(session) {
  requireThat(isObject(session), 'A comparison is required.');
  text(session.question, LIMITS.question, 'Your question', true);
  requireThat(Array.isArray(session.inputs) && session.inputs.length === 2, 'Two answers are required.');
  session.inputs.forEach((input, index) => {
    requireThat(isObject(input), 'Each answer must include text.');
    text(input.text, LIMITS.answer, `Answer ${index + 1}`, true);
    text(input.origin, LIMITS.origin, `Source ${index + 1}`);
  });
  return true;
}
export function orderingFromSeed(seed) {
  requireThat(Number.isInteger(seed) && seed >= 0 && seed <= 0xffffffff, 'Seed must be an unsigned 32-bit integer.');
  // One seeded, reproducible uniform draw; NOT cryptography or a blinding boundary.
  let t = (seed + 0x6D2B79F5) | 0;
  t = Math.imul(t ^ t >>> 15, t | 1);
  t ^= t + Math.imul(t ^ t >>> 7, t | 61);
  const draw = ((t ^ t >>> 14) >>> 0) / 4294967296;
  return draw < 0.5 ? [0, 1] : [1, 0];
}
export function beginBlind(session, { seed, now = new Date().toISOString() } = {}) {
  requireThat(session.phase === 'setup', 'Reset before starting another comparison.');
  validateInputs(session);
  requireThat(iso(now), 'A valid timestamp is required.');
  const order = orderingFromSeed(seed);
  return { ...copy(session), phase: 'blind',
    randomization: { algorithm: ALGORITHM, seed, order, assignedAt: now },
    ratings: { A: {}, B: {} }, verdict: null, note: '', lockedAt: null };
}
function validRating(metric, value) {
  return (Number.isInteger(value) && value >= 1 && value <= 5) || (metric === 'factualConfidence' && value === 'unsure');
}
export function setRating(session, label, metric, value) {
  requireThat(session.phase === 'blind', 'Ratings can only change before reveal.');
  requireThat(LABELS.includes(label) && METRICS.includes(metric) && validRating(metric, value), 'Choose a valid rating.');
  const next = copy(session); next.ratings[label][metric] = value; return next;
}
export function ratingsComplete(session) {
  return LABELS.every(label => METRICS.every(metric => validRating(metric, session.ratings?.[label]?.[metric])));
}
export function lockAndReveal(session, verdict, note = '', now = new Date().toISOString()) {
  requireThat(session.phase === 'blind', 'Only a blind comparison can be revealed.');
  requireThat(ratingsComplete(session), 'Rate all six items first. “Not sure” is valid for factual confidence.');
  requireThat(['A', 'B', 'tie', 'neither'].includes(verdict), 'Choose your verdict before revealing the sources.');
  text(note, LIMITS.note, 'Your note');
  requireThat(iso(now) && Date.parse(now) >= Date.parse(session.randomization.assignedAt), 'The lock time must not precede the comparison.');
  return { ...copy(session), phase: 'revealed', verdict, note, lockedAt: now };
}
// The only data projection used to render the blind UI: deliberately omits origins,
// input indexes, seed and mapping. Answer content itself is not anonymized.
export function comparisonView(session) {
  requireThat(session.phase === 'blind' || session.phase === 'revealed', 'Start a comparison first.');
  return { question: session.question, synthetic: session.synthetic, revealed: session.phase === 'revealed',
    answers: LABELS.map((label, index) => {
      const input = session.inputs[session.randomization.order[index]];
      const answer = { label, text: input.text, ratings: copy(session.ratings[label]) };
      if (session.phase === 'revealed') answer.origin = input.origin.trim() || 'Source not specified';
      return answer;
    }) };
}
export function validateSession(raw) {
  requireThat(isObject(raw) && raw.version === 1 && ['setup', 'blind', 'revealed'].includes(raw.phase), 'Unsupported comparison format.');
  requireThat(typeof raw.remember === 'boolean' && typeof raw.synthetic === 'boolean', 'Invalid local preferences.');
  text(raw.question, LIMITS.question, 'Your question');
  requireThat(Array.isArray(raw.inputs) && raw.inputs.length === 2, 'Invalid answer pair.');
  const next = emptySession();
  Object.assign(next, { phase: raw.phase, remember: raw.remember, synthetic: raw.synthetic, question: raw.question });
  next.inputs = raw.inputs.map(input => {
    requireThat(isObject(input), 'Invalid answer.');
    return { origin: text(input.origin, LIMITS.origin, 'Source'), text: text(input.text, LIMITS.answer, 'Answer') };
  });
  text(raw.note, LIMITS.note, 'Your note'); next.note = raw.note;
  requireThat(isObject(raw.ratings) && LABELS.every(label => isObject(raw.ratings[label])), 'Invalid ratings.');
  for (const label of LABELS) for (const [metric, value] of Object.entries(raw.ratings[label])) {
    requireThat(METRICS.includes(metric) && validRating(metric, value), 'Invalid saved rating.');
    next.ratings[label][metric] = value;
  }
  requireThat(raw.verdict === null || ['A', 'B', 'tie', 'neither'].includes(raw.verdict), 'Invalid verdict.');
  next.verdict = raw.verdict;
  if (raw.phase === 'setup') {
    requireThat(raw.randomization === null && raw.lockedAt === null && raw.verdict === null && raw.note === '' &&
      LABELS.every(label => Object.keys(raw.ratings[label]).length === 0), 'Invalid draft state.');
  } else {
    validateInputs(next);
    const r = raw.randomization;
    requireThat(isObject(r) && r.algorithm === ALGORITHM && iso(r.assignedAt), 'Invalid randomization record.');
    const expected = orderingFromSeed(r.seed);
    requireThat(Array.isArray(r.order) && r.order.length === 2 && r.order.every((value, i) => value === expected[i]), 'The recorded order does not match the seed.');
    next.randomization = { algorithm: ALGORITHM, seed: r.seed, order: expected, assignedAt: r.assignedAt };
    if (raw.phase === 'revealed') {
      requireThat(ratingsComplete(next) && next.verdict !== null && iso(raw.lockedAt) && Date.parse(raw.lockedAt) >= Date.parse(r.assignedAt), 'The result needs complete ratings and a locked verdict.');
      next.lockedAt = raw.lockedAt;
    } else requireThat(raw.lockedAt === null, 'A blind comparison cannot have a lock time.');
  }
  return next; // Canonical fields only: imported extra properties are never used.
}
export function resultObject(session) {
  const valid = validateSession(session);
  requireThat(valid.phase === 'revealed', 'Reveal only after your verdict; then export.');
  valid.remember = false; // Import never silently consents to persistence.
  return { schema: 'answer-lens-result/1', app: { name: 'Answer Lens', version: VERSION },
    assessment: 'human-self-report', caveats: [...CAVEATS], comparison: valid };
}
export const exportResult = session => JSON.stringify(resultObject(session), null, 2);
export function importResult(json) {
  requireThat(typeof json === 'string' && json.length <= LIMITS.json, 'Result file is too large.');
  let data; try { data = JSON.parse(json); } catch { throw new Error('This is not valid JSON.'); }
  requireThat(isObject(data) && data.schema === 'answer-lens-result/1' && data.assessment === 'human-self-report', 'This is not an Answer Lens result.');
  const session = validateSession(data.comparison);
  requireThat(session.phase === 'revealed', 'Only completed, revealed results can be opened.');
  session.remember = false;
  return session;
}
