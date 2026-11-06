"""Compile the unchanged engine natively; verify ranking and emit parity cases."""
import ctypes
import json
import math
from pathlib import Path
import subprocess
import tempfile

root = Path(__file__).resolve().parents[1]
with tempfile.TemporaryDirectory() as temp:
    shared = str(Path(temp) / 'engine.so')
    subprocess.run(['g++', '-std=c++17', '-O2', '-Wall', '-Wextra', '-fPIC', '-shared', '-I.',
                    'web/bridge.cpp', 'Document.cpp', 'Tokenizer.cpp',
                    'InvertedIndex.cpp', 'SearchEngine.cpp', 'SnippetGenerator.cpp',
                    '-o', shared], cwd=root, check=True)
    api = ctypes.CDLL(shared)
    api.add_document.argtypes = [ctypes.c_char_p, ctypes.c_char_p]
    api.add_document.restype = ctypes.c_int
    api.describe_collection.restype = ctypes.c_char_p
    api.search_documents.argtypes = [ctypes.c_char_p]
    api.search_documents.restype = ctypes.c_char_p
    docs = json.loads((root / 'docs/documents.json').read_text())
    for doc in docs:
        api.add_document(doc['title'].encode(), doc['content'].encode())
    collection = json.loads(api.describe_collection())
    assert len(collection['documents']) == 3
    def search(query):
        return json.loads(api.search_documents(query.encode()))
    queries = ['binary search', 'BINARY SEARCH', 'binary binary search search',
               'graphs', 'dijkstra', 'missing binary', 'unfindable', '', '!!!', 'C++', 'binary-search']
    expected = {q: search(q) for q in queries}
    ranked = expected['binary search']['results']
    assert [r['id'] for r in ranked] == [3, 2], ranked
    assert math.isclose(ranked[0]['score'], 3 * (1 + math.log(4 / 3)), rel_tol=1e-12)
    assert math.isclose(ranked[1]['score'], 2 * (1 + math.log(4 / 3)), rel_tol=1e-12)
    assert expected['binary search'] == expected['BINARY SEARCH']
    assert expected['binary search'] == expected['binary binary search search']
    assert [r['id'] for r in expected['graphs']['results']] == [1, 2]
    assert len(expected['dijkstra']['results']) == 1
    for q in ['unfindable', '', '!!!']:
        assert expected[q]['results'] == []
    assert [r['id'] for r in expected['missing binary']['results']] == [3, 2]
    api.add_document(b'session/quoted.txt', '"binary"\n\\search\t<script> & café'.encode())
    imported = search('binary search')
    assert any(r['id'] == 4 for r in imported['results'])
    assert json.loads(api.describe_collection())['documents'][-1]['content'] == '"binary"\n\\search\t<script> & café'
    api.reset_collection()
    api.add_document(b'empty.txt', b'')
    assert search('binary')['results'] == []
    assert json.loads(api.describe_collection())['documents'][0]['wordCount'] == 0
    Path(temp, 'expected.json').write_text(json.dumps({'collection': collection, 'queries': expected, 'imported': imported}))
    subprocess.run(['node', 'scripts/verify-wasm.mjs', str(Path(temp, 'expected.json'))], cwd=root, check=True)
print('PASS: native ranking, WebAssembly parity, normalization, deduplication, OR matching, tie order, empty/missing queries, imports, and reset.')
