import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import createSearchEngine from '../docs/engine.mjs';
const expected = JSON.parse(await readFile(process.argv[2], 'utf8'));
const docs = JSON.parse(await readFile(new URL('../docs/documents.json', import.meta.url), 'utf8'));
const wasm = await createSearchEngine();
const add = (title, content) => wasm.ccall('add_document', 'number', ['string', 'string'], [title, content]);
const search = (query) => JSON.parse(wasm.ccall('search_documents', 'string', ['string'], [query]));
const describe = () => JSON.parse(wasm.ccall('describe_collection', 'string', [], []));
for (const doc of docs) add(doc.title, doc.content);
assert.deepEqual(describe(), expected.collection);
function compare(actual, target, location = '') {
  if (typeof target === 'number') return assert.ok(Math.abs(actual - target) < 1e-12, location);
  if (Array.isArray(target)) {
    assert.equal(actual.length, target.length, location);
    return target.forEach((item, i) => compare(actual[i], item, location + '/' + i));
  }
  if (target && typeof target === 'object') {
    assert.deepEqual(Object.keys(actual).sort(), Object.keys(target).sort());
    return Object.entries(target).forEach(([key, value]) => compare(actual[key], value, location + '/' + key));
  }
  assert.equal(actual, target, location);
}
for (const [query, result] of Object.entries(expected.queries)) compare(search(query), result, query);
add('session/quoted.txt', '"binary"\n\\search\t<script> & café');
compare(search('binary search'), expected.imported, 'import');
wasm.ccall('reset_collection', null, [], []);
add('empty.txt', '');
assert.deepEqual(search('binary').results, []);
assert.equal(describe().documents[0].wordCount, 0);
console.log('PASS: unchanged C++ compiled to WebAssembly matches native output in every case.');
