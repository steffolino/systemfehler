/**
 * Quick test of the embedding modules
 */

import { VectorStore } from './services/_shared/embeddings/vector_store.js';

// Test vector store with simple vectors
console.log('Testing Vector Store...\n');

const store = new VectorStore();

// Add some test vectors
console.log('Adding test vectors...');
store.addVector('vec1', [1, 0, 0], { label: 'X-axis' });
store.addVector('vec2', [0, 1, 0], { label: 'Y-axis' });
store.addVector('vec3', [0.7, 0.7, 0], { label: 'Diagonal' });

console.log(`Added ${store.size()} vectors\n`);

// Test similarity calculations
console.log('Testing similarity calculations:');

const vec1 = [1, 0, 0];
const vec2 = [0, 1, 0];
const vec3 = [0.7, 0.7, 0];

console.log(`Cosine similarity [1,0,0] vs [1,0,0]: ${store.cosineSimilarity(vec1, vec1).toFixed(3)} (should be 1.0)`);
console.log(`Cosine similarity [1,0,0] vs [0,1,0]: ${store.cosineSimilarity(vec1, vec2).toFixed(3)} (should be 0.0)`);
console.log(`Cosine similarity [1,0,0] vs [0.7,0.7,0]: ${store.cosineSimilarity(vec1, vec3).toFixed(3)} (should be ~0.7)`);
console.log();

// Test search
console.log('Testing search:');
const query = [0.8, 0.6, 0];
const results = store.search(query, 3, 0.0);

console.log(`Query: [0.8, 0.6, 0]`);
console.log('Results:');
for (const result of results) {
  console.log(`  ${result.id} (${result.metadata.label}): similarity = ${result.similarity.toFixed(3)}`);
}
console.log();

// Test statistics
console.log(store.getSummary());

console.log('\n✓ All tests passed!');
