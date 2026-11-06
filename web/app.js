const $ = (id) => document.getElementById(id);
const worker = new Worker(new URL('./worker.js', import.meta.url), { type: 'module' });
const pending = new Map();
let requestId = 0;
let searchRevision = 0;
let collection = { documents: [] };
let sampleFiles = [];
let sessionFiles = [];
let latest = { terms: [], results: [] };
let selectedId = null;
let currentTab = 'content';
let ready = false;
let activeQuery = '';
const MAX_FILES = 30;
const MAX_BYTES = 1024 * 1024;
const encoder = new TextEncoder();

worker.addEventListener('message', ({ data }) => {
  const request = pending.get(data.id);
  if (!request) return;
  clearTimeout(request.timer);
  pending.delete(data.id);
  if (data.error) request.reject(new Error(data.error));
  else request.resolve(data.value);
});
worker.addEventListener('error', (event) => {
  for (const request of pending.values()) {
    clearTimeout(request.timer);
    request.reject(new Error(event.message || 'Unable to start the C++ engine.'));
  }
  pending.clear();
  fail('The C++ engine could not start. Refresh this page to try again.');
});
function call(type, payload) {
  return new Promise((resolve, reject) => {
    const id = ++requestId;
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(new Error('The engine took too long to respond. Refresh to try again.'));
    }, 30000);
    pending.set(id, { resolve, reject, timer });
    worker.postMessage({ id, type, payload });
  });
}
function escape(text) {
  return String(text).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function icon(name) { return `<svg aria-hidden="true"><use href="#${name}"/></svg>`; }
function nameOf(title) { return title.split('/').at(-1); }
function score(value) { return value.toFixed(3); }
function highlighted(text) {
  const terms = new Set(latest.terms);
  // Presentation only: token boundaries mirror the C++ ASCII tokenizer.
  // All actual matching, snippets, term lists and ranking come from C++.
  return text.split(/([A-Za-z0-9]+)/).map((part) =>
    terms.has(part.toLowerCase()) ? `<mark>${escape(part)}</mark>` : escape(part)).join('');
}
function notice(message) {
  $('notice').textContent = message;
  $('notice').hidden = !message;
}
function setBusy(busy) {
  for (const el of [$('query'), $('search-button'), $('add-files'), $('reset'), ...document.querySelectorAll('[data-query]')])
    el.disabled = busy;
  $('search-form').setAttribute('aria-busy', String(busy));
}
function fail(message) {
  ready = false;
  setBusy(true);
  $('runtime-status').textContent = 'Engine unavailable';
  $('status-dot').classList.add('failed');
  $('results-heading').textContent = 'Engine unavailable';
  $('results').innerHTML = `<div class="empty-state">${icon('code')}<h3>Let’s reconnect the engine.</h3><p>${escape(message)}</p><button class="text-button" id="retry">Reload page ↗</button></div>`;
  $('retry').addEventListener('click', () => location.reload());
  notice(message);
}
function renderCollection() {
  $('side-count').textContent = collection.documents.length;
  $('doc-count').textContent = String(collection.documents.length).padStart(2, '0');
  $('term-count').textContent = String(collection.uniqueTerms).padStart(2, '0');
  $('file-list').innerHTML = collection.documents.map((doc) =>
    `<button class="file-button${doc.id === selectedId ? ' selected' : ''}" data-file-id="${doc.id}" title="${escape(doc.title)}" aria-label="Inspect ${escape(nameOf(doc.title))}" aria-pressed="${doc.id === selectedId}">${icon('file')}<span>${escape(nameOf(doc.title))}</span><small>${String(doc.id).padStart(2, '0')}</small></button>`).join('');
  $('reset').hidden = sessionFiles.length === 0;
}
function renderResults() {
  const count = latest.results.length;
  $('results-heading').textContent = latest.terms.length ? `${String(count).padStart(2, '0')} ranked ${count === 1 ? 'match' : 'matches'}` : 'Ready for a new search';
  $('search-time').textContent = latest.terms.length ? `${latest.elapsed < 0.1 ? '<0.1' : latest.elapsed.toFixed(1)} ms` : '';
  $('query-terms').innerHTML = latest.terms.length ? '<span>QUERY TOKENS</span>' + latest.terms.map((term) => `<code class="term-pill">${escape(term)}</code>`).join('') : '';
  if (!latest.terms.length) {
    $('results').innerHTML = `<div class="empty-state">${icon('search')}<h3>Start with a word or two.</h3><p>Try “binary search”, “graphs”, or a word from your own files.</p></div>`;
    return;
  }
  if (!count) {
    $('results').innerHTML = `<div class="empty-state">${icon('search')}<h3>No words in common. Yet.</h3><p>No documents match “${escape(activeQuery)}”.<br>Try another keyword or add a .txt file.</p><button class="text-button" data-query="binary search">Try binary search ↗</button></div>`;
    return;
  }
  $('results').innerHTML = latest.results.map((result, i) => {
    const doc = collection.documents.find((item) => item.id === result.id);
    const matched = result.breakdown.filter((term) => term.frequency > 0).length;
    return `<article class="result-card${result.id === selectedId ? ' active' : ''}"><button class="result-button" data-result-id="${result.id}" aria-pressed="${result.id === selectedId}" aria-label="Inspect ${escape(nameOf(doc.title))}, rank ${i + 1}, score ${score(result.score)}"><div class="result-title-row"><span class="rank-number">${String(i + 1).padStart(2, '0')}</span><h3>${escape(nameOf(doc.title))}</h3><span class="score-badge">${score(result.score)}</span></div><p class="result-path">${escape(doc.title)} · DOC ${String(doc.id).padStart(2, '0')}</p><p class="result-snippet">${highlighted(result.snippet)}</p><div class="result-meta"><span>${matched}/${latest.terms.length} terms matched · ${doc.wordCount} tokens</span>${icon('arrow')}</div></button></article>`;
  }).join('') + '<p class="column-note">Higher score, closer match. Select a result to explore it.</p>';
}
function renderInspector() {
  const doc = collection.documents.find((item) => item.id === selectedId);
  if (!doc) {
    $('inspector').innerHTML = `<div class="inspector-placeholder">${icon('file')}<h3>A closer look</h3><p>Select a result or a file to inspect its contents.</p></div>`;
    return;
  }
  const result = latest.results.find((item) => item.id === selectedId);
  const canScore = !!result;
  if (!canScore) currentTab = 'content';
  const content = doc.content ? doc.content.split('\n').map((line, index) => `<span class="content-line"><span class="line-number" aria-hidden="true">${index + 1}</span><span class="line-text">${highlighted(line) || ' '}</span></span>`).join('') : '<span class="line-text">This file is empty.</span>';
  const table = result ? `<div class="score-content"><p class="score-intro">Each distinct query term contributes its frequency × IDF. Rarer terms carry more weight.</p><table class="score-table"><thead><tr><th scope="col">Term</th><th scope="col" title="Term frequency">TF</th><th scope="col" title="Inverse document frequency">IDF</th><th scope="col">TF × IDF</th></tr></thead><tbody>${result.breakdown.map((term) => `<tr><td>${escape(term.term)}</td><td>${term.frequency}</td><td title="Appears in ${term.documentFrequency} of ${collection.documents.length} documents">${score(term.idf)}</td><td>${score(term.frequency * term.idf)}</td></tr>`).join('')}</tbody><tfoot><tr><td colspan="3">Total score</td><td>${score(result.score)}</td></tr></tfoot></table><p class="score-footnote">IDF = 1 + ln((${collection.documents.length} + 1) / (df + 1))<br>Scores display 3 decimals; ranking uses full precision.</p></div>` : '';
  $('inspector').innerHTML = `<div class="inspector-top">${icon('file')}<div><h3>${escape(nameOf(doc.title))}</h3><p>DOC ${String(doc.id).padStart(2, '0')} · ${doc.wordCount} tokens · ${encoder.encode(doc.content).length} bytes</p></div><span class="inspector-tag">READ ONLY</span></div><div class="tabs" role="tablist" aria-label="Document view"><button id="content-tab" data-tab="content" role="tab" aria-selected="${currentTab === 'content'}" aria-controls="content-panel" tabindex="${currentTab === 'content' ? 0 : -1}">Document preview</button><button id="score-tab" data-tab="score" role="tab" aria-selected="${currentTab === 'score'}" aria-controls="score-panel" tabindex="${currentTab === 'score' ? 0 : -1}" ${!canScore ? 'disabled title="Run a query matching this document to inspect its score"' : ''}>Score breakdown</button></div><div id="content-panel" role="tabpanel" aria-labelledby="content-tab" ${currentTab !== 'content' ? 'hidden' : ''}><pre class="document-content">${content}</pre><div class="inspector-foot"><span class="highlight-key">Matching query terms</span><span>UTF-8 · .txt</span></div></div><div id="score-panel" role="tabpanel" aria-labelledby="score-tab" ${currentTab !== 'score' ? 'hidden' : ''}>${table}</div>`;
}
function select(id) {
  selectedId = id;
  currentTab = 'content';
  renderCollection();
  renderResults();
  renderInspector();
}
async function search(query) {
  if (!ready) return;
  const revision = ++searchRevision;
  $('search-button').disabled = true;
  $('search-form').setAttribute('aria-busy', 'true');
  try {
    const response = await call('search', query);
    if (revision !== searchRevision) return;
    latest = response;
    activeQuery = query.trim();
    selectedId = latest.results[0]?.id ?? null;
    currentTab = 'content';
    renderCollection();
    renderResults();
    renderInspector();
  } catch (error) {
    notice(error.message);
  } finally {
    if (revision === searchRevision) {
      $('search-button').disabled = false;
      $('search-form').setAttribute('aria-busy', 'false');
    }
  }
}
async function loadFiles() {
  collection = await call('load', [...sampleFiles, ...sessionFiles]);
  renderCollection();
  await search($('query').value);
}
$('search-form').addEventListener('submit', (event) => {
  event.preventDefault();
  notice('');
  search($('query').value);
});
document.addEventListener('click', (event) => {
  const query = event.target.closest('[data-query]');
  if (query && !query.disabled && ready) {
    $('query').value = query.dataset.query;
    notice('');
    search(query.dataset.query);
  }
  const file = event.target.closest('[data-file-id]');
  const result = event.target.closest('[data-result-id]');
  if (file || result) select(Number(file?.dataset.fileId ?? result.dataset.resultId));
  const tab = event.target.closest('[data-tab]');
  if (tab && !tab.disabled) {
    currentTab = tab.dataset.tab;
    renderInspector();
    document.querySelector(`[data-tab="${currentTab}"]`).focus();
  }
});
document.addEventListener('keydown', (event) => {
  if (event.key === '/' && !['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName) && !$('about-dialog').open) {
    event.preventDefault();
    $('query').focus();
  }
  if (event.target.matches('[role="tab"]') && ['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) {
    event.preventDefault();
    const tabs = [...document.querySelectorAll('[role="tab"]')].filter((tab) => !tab.disabled);
    const index = tabs.indexOf(event.target);
    const next = event.key === 'Home' ? tabs[0] : event.key === 'End' ? tabs.at(-1) : tabs[(index + (event.key === 'ArrowLeft' ? -1 : 1) + tabs.length) % tabs.length];
    next.click();
  }
});
$('add-files').addEventListener('click', () => $('file-input').click());
$('file-input').addEventListener('change', async (event) => {
  const files = [...event.target.files];
  if (!files.length) return;
  setBusy(true);
  try {
    if (collection.documents.length + files.length > MAX_FILES) throw new Error(`Keep the collection to ${MAX_FILES} files or fewer for this demo.`);
    const names = new Set([...sampleFiles, ...sessionFiles].map((file) => nameOf(file.title)));
    for (const file of files) {
      if (!file.name.endsWith('.txt')) throw new Error(`${file.name}: please choose files with the lowercase .txt extension.`);
      if (names.has(file.name)) throw new Error(`${file.name} is already in the collection. Rename it before adding.`);
      if (file.size > MAX_BYTES) throw new Error(`${file.name} is too large. Use files up to 1 MB.`);
      names.add(file.name);
    }
    const bytes = [...sampleFiles, ...sessionFiles].reduce((total, file) => total + encoder.encode(file.content).length, 0) + files.reduce((total, file) => total + file.size, 0);
    if (bytes > 5 * MAX_BYTES) throw new Error('Keep the full collection below 5 MB for this browser demo.');
    const incoming = await Promise.all(files.map(async (file) => {
      const data = await file.arrayBuffer();
      let content;
      try { content = new TextDecoder('utf-8', { fatal: true }).decode(data); }
      catch { throw new Error(`${file.name}: please save this text file using UTF-8 encoding.`); }
      if (content.includes('\0')) throw new Error(`${file.name} contains binary data. Choose a plain text file.`);
      return { title: `session/${file.name}`, content };
    }));
    sessionFiles.push(...incoming);
    await loadFiles();
    notice(`${incoming.length} ${incoming.length === 1 ? 'file' : 'files'} added and indexed by C++. Your files stay in this session; they are not uploaded.`);
  } catch (error) {
    notice(error.message);
  } finally {
    event.target.value = '';
    setBusy(false);
  }
});
$('reset').addEventListener('click', async () => {
  setBusy(true);
  try {
    sessionFiles = [];
    await loadFiles();
    notice('Sample collection restored.');
  } catch (error) { notice(error.message); }
  finally { setBusy(false); }
});
for (const id of ['about-open', 'ranking-help']) $(id).addEventListener('click', () => $('about-dialog').showModal());
$('about-close').addEventListener('click', () => $('about-dialog').close());
$('about-dialog').addEventListener('click', (event) => { if (event.target === $('about-dialog')) {
  const rect = event.target.getBoundingClientRect();
  if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) event.target.close();
} });

async function boot() {
  try {
    const response = await fetch('./documents.json');
    if (!response.ok) throw new Error('Sample documents could not be loaded.');
    sampleFiles = await response.json();
    collection = await call('load', sampleFiles);
    ready = true;
    $('runtime-status').textContent = 'Engine ready';
    setBusy(false);
    renderCollection();
    await search($('query').value);
  } catch (error) { fail(error.message); }
}
boot();
