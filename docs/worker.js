import createSearchEngine from './engine.mjs';

let engine;
async function initialize() {
  engine = await createSearchEngine();
}
const ready = initialize();
self.addEventListener('message', async ({ data }) => {
  const { id, type, payload } = data;
  try {
    await ready;
    let value;
    if (type === 'load') {
      engine.ccall('reset_collection', null, [], []);
      for (const doc of payload)
        engine.ccall('add_document', 'number', ['string', 'string'], [doc.title, doc.content]);
      value = JSON.parse(engine.ccall('describe_collection', 'string', [], []));
    } else if (type === 'search') {
      const start = performance.now();
      value = JSON.parse(engine.ccall('search_documents', 'string', ['string'], [payload]));
      value.elapsed = performance.now() - start;
    } else throw new Error('Unknown engine operation');
    self.postMessage({ id, value });
  } catch (error) {
    self.postMessage({ id, error: error.message || 'The C++ engine could not complete this operation.' });
  }
});
