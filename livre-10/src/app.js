import { VERSION, LIMITS, METRICS, LABELS, emptySession, beginBlind, comparisonView, setRating, lockAndReveal, exportResult, importResult } from './core.js';
import { STORAGE_KEY, loadLocal, saveLocal, clearLocal } from './storage.js';
import { demoSession } from './demo.js';

const $ = selector => document.querySelector(selector);
// All dynamic content is rendered as text nodes or input values, never HTML.
function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (key.startsWith('on')) node.addEventListener(key.slice(2), value);
    else if (key === 'class') node.className = value;
    else if (key in node && !key.startsWith('aria-') && key !== 'role') node[key] = value;
    else node.setAttribute(key, String(value));
  }
  for (const child of children.flat(Infinity)) if (child !== null && child !== undefined) {
    node.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return node;
}
const loaded = loadLocal();
let session = loaded.session || emptySession();
let imported = false;
let downloadUrl = null;
const say = message => { $('#status').textContent = message; };
function fail(message) { $('#error').hidden = false; $('#error').textContent = message; $('#error').focus(); }
function clearError() { $('#error').hidden = true; $('#error').textContent = ''; }
function persist() {
  if (!session.remember) return;
  const result = saveLocal(session);
  if (!result.ok) say(result.message);
}
function saveChoice() {
  return el('label', { class: 'save-choice' },
    el('input', { id: 'remember', type: 'checkbox', checked: session.remember, onchange: event => {
      session.remember = event.target.checked;
      const result = session.remember ? saveLocal(session) : clearLocal();
      say(result.ok ? (session.remember ? 'Saved on this device. Nothing is uploaded.' : 'Device saving is off. This comparison stays in this tab only.') : result.message);
    }}),
    el('span', {}, 'Save this comparison on this device', el('small', {}, 'Optional. Stored as plain text in this browser; not encrypted.')));
}
function privacyNote() {
  return el('details', { class: 'privacy' }, el('summary', {}, 'What is hidden, and what stays on my device?'),
    el('p', {}, 'Source fields disappear during comparison. You may still recognize an answer you pasted, or a model may name itself in the text. This is a small bias-reduction aid, not a secure blind experiment. For less familiarity, ask someone else to paste the answers.'),
    el('p', {}, 'No answer is sent anywhere by this app. Saving is optional and keeps one comparison in local browser storage. Browser tools, extensions, or another person using this browser may read it. Use a private device for sensitive text. Reset clears this app’s comparison only; downloaded files and the offline app cache remain.'),
    el('p', {}, 'The app does not call a model, verify sources, or calculate factual accuracy. Origins are whatever you enter. There is no leaderboard.'));
}
function steps(phase) {
  const current = ['setup', 'blind', 'revealed'].indexOf(phase);
  return el('ol', { class: 'steps', 'aria-label': 'Comparison progress' }, ['Prepare', 'Compare blind', 'Reveal'].map((name, index) =>
    el('li', { class: index <= current ? 'active' : '', ...(index === current ? { 'aria-current': 'step' } : {}) },
      el('span', { 'aria-hidden': 'true' }, index < current ? '✓' : String(index + 1).padStart(2, '0')), name)));
}
function demoNotice() {
  return session.synthetic ? el('div', { class: 'notice demo-notice' }, el('strong', {}, 'Synthetic demo'), ' · These are written examples, not measured outputs from real models. Your ratings are your own.') : null;
}
function textInput(id, label, value, max, onChange, { area = false, placeholder = '', rows = 5 } = {}) {
  const count = el('span', { id: `${id}-count`, class: 'char-count' }, `${value.length.toLocaleString('en-US')} / ${max.toLocaleString('en-US')}`);
  const field = el(area ? 'textarea' : 'input', { id, name: id, value, maxLength: max, placeholder,
    ...(area ? { rows } : { type: 'text' }), autocomplete: 'off', spellcheck: false,
    required: id === 'question' || /^answer-/.test(id), 'aria-describedby': `${id}-count`, oninput: event => { onChange(event.target.value); count.textContent = `${event.target.value.length.toLocaleString('en-US')} / ${max.toLocaleString('en-US')}`; persist(); } });
  return el('div', { class: 'field' }, el('div', { class: 'label-line' }, el('label', { htmlFor: id }, label), count), field);
}
function renderSetup() {
  const hero = el('section', { class: 'hero' }, el('div', {}, el('p', { class: 'eyebrow' }, 'A clearer way to compare AI'),
    el('h1', { tabindex: -1 }, 'Judge the answer.', el('br'), el('span', { class: 'serif' }, 'Not the name.')),
    el('p', { class: 'intro' }, 'Paste two answers to the same question. Read with the names hidden, decide what helps you, then see who wrote what.')),
    el('aside', { class: 'hero-note' }, el('span', { class: 'note-index' }, 'A / B'), el('p', {}, 'Your judgment,', el('br'), 'before the reveal.'), el('small', {}, 'A small experiment.', el('br'), 'Not a model ranking.')));
  const demoButton = el('button', { type: 'button', id: 'demo-button', class: 'button secondary', onclick: () => {
    const apply = () => { session = demoSession(session.remember); imported = false; persist(); render(true); say('Synthetic demo loaded. Read the question, then hide the names to begin.'); };
    if (session.question || session.inputs.some(input => input.text || input.origin)) confirmAction('Replace this draft?', 'The synthetic demo will replace the question and both answers in this draft.', 'Load demo', apply);
    else apply();
  } }, 'Try the synthetic demo', el('span', { 'aria-hidden': 'true' }, ' ↗'));
  const form = el('form', { id: 'setup-form', noValidate: true, onsubmit: event => {
    event.preventDefault(); clearError();
    try {
      if (!globalThis.crypto?.getRandomValues) throw new Error('Secure randomization is unavailable in this browser. Use a current browser on localhost or HTTPS.');
      const seed = crypto.getRandomValues(new Uint32Array(1))[0];
      session = beginBlind(session, { seed }); imported = false; persist(); render(true); say('Sources hidden. Rate both answers before choosing your verdict.');
    } catch (error) { fail(error.message); }
  } },
    el('section', { class: 'editor-section' },
      el('div', { class: 'section-heading' }, el('div', {}, el('h2', {}, 'Start with a real question.'), el('p', {}, 'Use the same question for both answers. All three text boxes are required.')), demoButton),
      demoNotice(),
      textInput('question', 'Your question', session.question, LIMITS.question, value => { session.question = value; }, { area: true, rows: 2, placeholder: 'For example: How can I tidy my downloads folder in 15 minutes?' }),
      el('div', { class: 'answer-grid input-grid' }, session.inputs.map((input, index) => el('section', { class: 'input-card' },
        el('div', { class: 'card-top' }, el('h3', {}, index === 0 ? 'First answer' : 'Second answer'), el('span', { class: 'micro' }, 'Shuffled in the next step')),
        textInput(`origin-${index}`, 'Source name (optional)', input.origin, LIMITS.origin, value => { session.inputs[index].origin = value; }, { placeholder: 'Model, app, or a name you choose' }),
        textInput(`answer-${index}`, 'Answer text', input.text, LIMITS.answer, value => { session.inputs[index].text = value; }, { area: true, rows: 9, placeholder: 'Paste the full answer here. Plain text works best.' })
      ))),
      el('div', { class: 'start-row' }, saveChoice(), el('button', { type: 'submit', id: 'begin-button', class: 'button primary' }, 'Hide names & compare', el('span', { 'aria-hidden': 'true' }, ' →'))),
      el('p', { class: 'subtle small' }, 'Remove self-identifying phrases first when practical. You may still recognize answers you pasted.')),
    privacyNote());
  const importer = el('div', { class: 'import-row' }, el('label', { htmlFor: 'import-file', class: 'import-label' }, 'Already have a result? Open a saved JSON'),
    el('input', { type: 'file', id: 'import-file', accept: '.json,application/json', onchange: openResult }), el('span', { class: 'small subtle' }, 'Opens locally. Nothing is uploaded.'));
  return [hero, steps(session.phase), form, importer];
}
async function openResult(event) {
  const file = event.target.files?.[0]; if (!file) return;
  clearError();
  try {
    if (file.size > LIMITS.json) throw new Error('Result file is too large (maximum 600 KB).');
    const restored = importResult(await file.text());
    const apply = () => {
      const cleared = clearLocal(); session = restored; imported = true; render(true);
      say(cleared.ok ? 'Opened a previously revealed result. This is a local record, not a new blind trial.' : cleared.message);
    };
    if (session.question || session.inputs.some(input => input.text || input.origin)) confirmAction('Open this result instead?', 'This will replace the current draft. The result already contains revealed origins.', 'Open result', apply);
    else apply();
  } catch (error) { fail(error.message); event.target.value = ''; }
}

const metricNames = { usefulness: 'Usefulness', clarity: 'Clarity', factualConfidence: 'Factual confidence' };
const metricHints = { usefulness: 'Does it help you do what you asked?', clarity: 'Is it easy to follow?', factualConfidence: 'Your confidence, not a fact-check.' };
function ratingGroup(label, metric, value) {
  const name = `${label}-${metric}`;
  const options = [1, 2, 3, 4, 5, ...(metric === 'factualConfidence' ? ['unsure'] : [])];
  return el('fieldset', { class: 'rating-group' }, el('legend', {}, metricNames[metric]),
    el('p', { id: `${name}-hint`, class: 'rating-hint' }, metricHints[metric]),
    el('div', { class: 'rating-options' }, options.map(option => el('label', { class: `rating-option${option === 'unsure' ? ' unsure' : ''}` },
      el('input', { type: 'radio', name, value: String(option), checked: value === option, 'aria-describedby': `${name}-hint`,
        'aria-label': option === 'unsure' ? 'Not sure' : `${option}${option === 1 ? ' — low' : option === 5 ? ' — high' : ''}`,
        onchange: () => { session = setRating(session, label, metric, option); persist(); updateProgress(); } }),
      el('span', {}, option === 'unsure' ? 'Not sure' : option)))),
    el('div', { class: 'scale-ends', 'aria-hidden': 'true' }, el('span', {}, '1 · Low'), el('span', {}, '5 · High')));
}
function answerCard(answer, revealed) {
  return el('article', { class: 'answer-card', 'aria-labelledby': `title-${answer.label}`, 'data-label': answer.label },
    el('header', { class: 'answer-heading' }, el('div', { class: 'answer-heading-title' }, el('span', { class: 'letter', 'aria-hidden': 'true' }, answer.label),
      el('div', {}, el('h2', { id: `title-${answer.label}` }, `Answer ${answer.label}`),
        el('p', { class: revealed ? 'origin' : 'hidden-origin' }, revealed ? answer.origin : 'Source hidden'))),
      el('span', { class: 'answer-tag' }, revealed ? 'Revealed' : 'Read first')),
    el('div', { class: 'answer-text', dir: 'auto' }, answer.text),
    el('div', { class: 'rating-area' }, revealed
      ? el('dl', { class: 'rating-results' }, METRICS.map(metric => el('div', {}, el('dt', {}, metricNames[metric]), el('dd', {}, answer.ratings[metric] === 'unsure' ? 'Not sure' : `${answer.ratings[metric]} / 5`))))
      : METRICS.map(metric => ratingGroup(answer.label, metric, answer.ratings[metric]))));
}
const verdictText = verdict => ({ A: 'You preferred Answer A.', B: 'You preferred Answer B.', tie: 'You called it a tie.', neither: 'Neither answer met your needs.' }[verdict]);
function updateProgress() {
  const count = LABELS.reduce((total, label) => total + Object.keys(session.ratings[label]).length, 0);
  if ($('#rating-progress')) $('#rating-progress').textContent = `${count} of 6 ratings complete`;
}
function verdictForm() {
  const form = el('form', { id: 'verdict-form', class: 'verdict-panel', noValidate: true, onsubmit: event => {
    event.preventDefault(); clearError();
    try { session = lockAndReveal(session, session.verdict, session.note); persist(); render(true); say('Your verdict is locked. Sources are now revealed.'); }
    catch (error) { fail(error.message); }
  } },
    el('div', { class: 'section-heading' }, el('div', {}, el('p', { class: 'eyebrow' }, 'Your call'), el('h2', {}, 'Which would you rather use?')), el('span', { id: 'rating-progress', class: 'progress-text', role: 'status' }, '0 of 6 ratings complete')),
    el('fieldset', { class: 'verdict-group' }, el('legend', { class: 'sr-only' }, 'Your verdict'),
      el('div', { class: 'verdict-options' }, [['A', 'Answer A'], ['B', 'Answer B'], ['tie', 'A tie'], ['neither', 'Neither']].map(([value, label]) =>
        el('label', { class: 'verdict-option' }, el('input', { type: 'radio', name: 'verdict', value, checked: session.verdict === value,
          onchange: () => { session.verdict = value; persist(); } }), el('span', {}, label))))),
    textInput('note', 'What tipped the balance? (optional)', session.note, LIMITS.note, value => { session.note = value; }, { area: true, rows: 2, placeholder: 'A specific detail, a missing step, or a reason to check a claim…' }),
    el('div', { class: 'start-row' }, el('p', { class: 'small subtle' }, 'Finish all six ratings and choose a verdict.', el('br'), 'Your choices lock before the names appear.'),
      el('button', { id: 'reveal-button', class: 'button primary', type: 'submit' }, 'Lock verdict & reveal', el('span', { 'aria-hidden': 'true' }, ' →'))));
  return form;
}
function revealSummary(view) {
  const preference = view.answers.find(answer => answer.label === session.verdict);
  const audit = session.randomization;
  return el('section', { class: 'reveal-summary', 'aria-label': 'Your locked result' },
    el('div', { class: 'reveal-top' }, el('div', {}, el('p', { class: 'eyebrow' }, imported ? 'Opened result · already revealed' : 'Verdict locked · sources revealed'),
      el('h2', {}, verdictText(session.verdict)), preference ? el('p', { class: 'chosen-origin' }, preference.origin) : null),
      el('button', { type: 'button', id: 'export-button', class: 'button primary', onclick: downloadResult }, 'Export result JSON', el('span', { 'aria-hidden': 'true' }, ' ↓'))),
    session.note ? el('div', { class: 'result-note' }, el('strong', {}, 'Your note'), el('p', {}, session.note)) : null,
    el('p', { class: 'result-caveat' }, 'This is your preference on one question, not proof that a model is better. Factual confidence is your judgment, not verified accuracy. Source names are supplied by you.'),
    el('details', { class: 'audit-details' }, el('summary', {}, 'See the recorded shuffle'),
      el('p', {}, `Algorithm: ${audit.algorithm}. Seed: ${audit.seed}.`),
      el('p', {}, `Answer A came from input ${audit.order[0] + 1}; Answer B came from input ${audit.order[1] + 1}.`),
      el('p', {}, `Assigned: ${audit.assignedAt}. Verdict locked: ${session.lockedAt}.`),
      el('p', {}, 'The export includes the full question, both answers, user-supplied origins, all ratings, your verdict and note, this mapping, and the limitations. A local JSON file is editable; it is not a signed audit record.')));
}
function renderComparison() {
  const view = comparisonView(session);
  return [el('section', { class: 'compact-hero' }, el('p', { class: 'eyebrow' }, view.revealed ? 'Look past the label' : 'Names out. Judgment in.'),
    el('h1', { tabindex: -1 }, view.revealed ? 'Your verdict came first.' : 'Which answer works for you?'),
    el('p', { class: 'intro' }, view.revealed ? 'Keep the result as a snapshot of what helped you with this question.' : 'Read each answer, rate it yourself, and choose a verdict before the reveal.')),
    steps(session.phase), demoNotice(),
    el('section', { class: 'question-card', 'aria-labelledby': 'shared-question' }, el('p', { id: 'shared-question', class: 'eyebrow' }, 'The same question'), el('p', { class: 'question-text', dir: 'auto' }, view.question)),
    view.revealed ? revealSummary(view) : el('p', { class: 'comparison-tip' }, 'There is no correct preference. Use “Not sure” when you cannot judge a claim.'),
    el('div', { class: 'answer-grid comparison-grid' }, view.answers.map(answer => answerCard(answer, view.revealed))),
    view.revealed ? null : verdictForm(),
    el('div', { class: 'comparison-save' }, saveChoice()), privacyNote()];
}
function downloadResult() {
  try {
    const json = exportResult(session);
    if (downloadUrl) URL.revokeObjectURL(downloadUrl);
    downloadUrl = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
    const link = el('a', { href: downloadUrl, download: `answer-lens-${session.lockedAt.slice(0, 10)}.json` });
    document.body.append(link); link.click(); link.remove();
    const url = downloadUrl; setTimeout(() => { URL.revokeObjectURL(url); if (downloadUrl === url) downloadUrl = null; }, 1000);
    say('Result download requested. The JSON includes both full answers and source names; share it carefully.');
  } catch (error) { fail(error.message); }
}
function render(focus = false) {
  clearError();
  const children = session.phase === 'setup' ? renderSetup() : renderComparison();
  // replaceChildren stringifies null/undefined; omitted sections must stay absent.
  $('#app').replaceChildren(...children.filter(child => child !== null && child !== undefined));
  document.documentElement.dataset.phase = session.phase;
  document.title = `Answer Lens — ${session.phase === 'setup' ? 'judge the answer, not the name' : session.phase === 'blind' ? 'compare blind' : 'your result'}`;
  if (session.phase === 'blind') updateProgress();
  if (focus) { window.scrollTo(0, 0); $('#app h1').focus({ preventScroll: true }); }
}
let pendingAction = null;
function confirmAction(title, description, button, action) {
  $('#reset-heading').textContent = title; $('#reset-description').textContent = description;
  $('#confirm-reset').textContent = button; pendingAction = action; $('#reset-dialog').showModal();
}
function reset() {
  const cleared = clearLocal(); session = emptySession(); imported = false;
  if (downloadUrl) { URL.revokeObjectURL(downloadUrl); downloadUrl = null; }
  render(true); say(cleared.ok ? 'Comparison cleared. Previous answers and ratings were removed from this app.' : cleared.message);
}
$('#reset-button').addEventListener('click', () => confirmAction('Clear this comparison?', 'This removes the question, answers, ratings, and saved comparison from this app. Downloaded result files and the offline app cache stay on your device.', 'Clear comparison', reset));
$('#cancel-reset').addEventListener('click', () => { pendingAction = null; $('#reset-dialog').close(); });
$('#confirm-reset').addEventListener('click', () => { const action = pendingAction; pendingAction = null; $('#reset-dialog').close(); action?.(); });
$('#reset-dialog').addEventListener('cancel', () => { pendingAction = null; });
window.addEventListener('storage', event => {
  if ((event.key === STORAGE_KEY || event.key === null) && session.remember) {
    const latest = loadLocal(); session = latest.session || emptySession(); imported = false; render(true);
    say(latest.ok ? 'This comparison was updated or cleared in another tab.' : latest.message);
  }
});
render();
if (loaded.message) say(loaded.message);
else if (loaded.session) say('Restored the comparison you chose to save on this device.');
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js').then(async () => {
    await navigator.serviceWorker.ready;
    $('#offline-status').textContent = `Offline app ready · v${VERSION}`;
  }).catch(() => { $('#offline-status').textContent = 'Offline cache unavailable · keep this tab open'; });
} else $('#offline-status').textContent = 'Offline cache unsupported · keep this tab open';
