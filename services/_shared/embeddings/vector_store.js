/**
 * Systemfehler - Vector Store Module
 * 
 * This module implements a simple in-memory vector store with JSON persistence.
 * It stores high-dimensional vectors and enables similarity search.
 * 
 * ============================================================================
 * WHAT IS A VECTOR STORE?
 * ============================================================================
 * 
 * A vector store (also called vector database) is a specialized database for:
 * - STORING: High-dimensional vectors (embeddings)
 * - SEARCHING: Finding similar vectors quickly
 * - METADATA: Attaching data to vectors (IDs, tags, content)
 * 
 * ANALOGY:
 * --------
 * Traditional Database: "Find all products where price < $50"
 * Vector Database: "Find all products similar to this one"
 * 
 * USE CASES:
 * ----------
 * - Semantic search: Find relevant documents
 * - Recommendation: Find similar items
 * - Duplicate detection: Find near-duplicates
 * - Clustering: Group similar items
 * - Anomaly detection: Find outliers
 * 
 * ============================================================================
 * VECTOR SIMILARITY METRICS
 * ============================================================================
 * 
 * How do we measure if two vectors are "similar"?
 * 
 * 1. COSINE SIMILARITY (most common for embeddings)
 * --------------------------------------------------
 * Measures the angle between vectors, ignoring magnitude.
 * 
 * Formula: cos(θ) = (A · B) / (|A| × |B|)
 * 
 * Range: -1 to 1
 * - 1.0 = Identical direction (very similar)
 * - 0.0 = Perpendicular (unrelated)
 * - -1.0 = Opposite direction (very different)
 * 
 * Visual:
 *   A →  θ = 0°   → cos = 1.0  (same direction)
 *   B ↗  θ = 45°  → cos = 0.71 (somewhat similar)
 *   C ↑  θ = 90°  → cos = 0.0  (perpendicular)
 *   D ↙  θ = 135° → cos = -0.71 (somewhat opposite)
 *   E ←  θ = 180° → cos = -1.0  (opposite)
 * 
 * WHY COSINE FOR EMBEDDINGS?
 * - Normalized: Vector length doesn't matter
 * - Captures semantic similarity well
 * - Fast to compute
 * - Standard in NLP and ML
 * 
 * 2. EUCLIDEAN DISTANCE (L2 distance)
 * -----------------------------------
 * Straight-line distance between points.
 * 
 * Formula: d = √Σ(Aᵢ - Bᵢ)²
 * 
 * Range: 0 to ∞
 * - 0 = Identical vectors
 * - Higher = More different
 * 
 * Visual (2D):
 *   A(0,0) → B(3,4) = √(9+16) = 5.0
 * 
 * WHEN TO USE:
 * - When vector magnitude matters
 * - Clustering algorithms (K-means)
 * - Physical distance problems
 * 
 * 3. DOT PRODUCT
 * --------------
 * Measures both angle and magnitude.
 * 
 * Formula: A · B = Σ(Aᵢ × Bᵢ)
 * 
 * Range: -∞ to ∞
 * - Higher = More similar (if vectors normalized)
 * 
 * RELATIONSHIP:
 * - Dot product of normalized vectors = Cosine similarity
 * - Embeddings are often normalized, making these equivalent
 * 
 * ============================================================================
 * WHY COSINE SIMILARITY IS COMMONLY USED
 * ============================================================================
 * 
 * For text embeddings specifically:
 * 
 * 1. SCALE INVARIANCE: Length of document doesn't matter
 *    - "cat" (3 chars) vs "The cat sat on the mat" (26 chars)
 *    - Both about cats, should be similar despite length difference
 * 
 * 2. DIRECTION CAPTURES MEANING: The direction in vector space encodes semantics
 *    - "happy" and "joyful" point in similar directions
 *    - Magnitude is less meaningful
 * 
 * 3. NORMALIZED EMBEDDINGS: Most embedding models produce unit vectors
 *    - OpenAI embeddings are normalized to length 1
 *    - Cosine similarity = dot product for normalized vectors
 *    - Computationally efficient
 * 
 * 4. INTERPRETABLE RANGE: -1 to 1 is easy to understand
 *    - Can set thresholds: "similarity > 0.8 = relevant"
 * 
 * ============================================================================
 * INDEXING FOR PERFORMANCE
 * ============================================================================
 * 
 * NAIVE SEARCH (what we implement for learning):
 * -----------------------------------------------
 * - Compare query against ALL vectors
 * - Time complexity: O(n × d) where n = vectors, d = dimensions
 * - 1000 vectors × 1536 dimensions = 1.5M operations
 * - Fast enough for small datasets (< 10,000 vectors)
 * 
 * INDEXED SEARCH (production systems):
 * ------------------------------------
 * Advanced indexing techniques for large datasets:
 * 
 * 1. HNSW (Hierarchical Navigable Small World)
 *    - Graph-based algorithm
 *    - Very fast: O(log n)
 *    - Used by: Weaviate, Qdrant, pgvector
 *    - Trade-off: ~95-99% accuracy
 * 
 * 2. IVF (Inverted File Index)
 *    - Cluster vectors, search only relevant clusters
 *    - Good for billion-scale datasets
 *    - Used by: Faiss (Facebook)
 * 
 * 3. LSH (Locality-Sensitive Hashing)
 *    - Hash similar vectors to same buckets
 *    - Probabilistic, very fast
 *    - Used by: Specialized applications
 * 
 * 4. FAISS (Facebook AI Similarity Search)
 *    - Multiple index types (IVF, PQ, HNSW)
 *    - GPU acceleration
 *    - Best for research and large-scale production
 * 
 * WHEN TO UPGRADE:
 * ----------------
 * - < 10,000 vectors: Naive search is fine
 * - 10,000 - 100,000: Consider HNSW
 * - > 100,000: Definitely use indexing
 * - > 1,000,000: Specialized vector database
 * 
 * ============================================================================
 * ACCURACY VS SPEED TRADE-OFFS
 * ============================================================================
 * 
 * EXACT SEARCH (100% accuracy):
 * - Naive linear scan
 * - Brute force comparison
 * - Slow but perfect results
 * - Our implementation
 * 
 * APPROXIMATE SEARCH (~95-99% accuracy):
 * - HNSW, IVF, LSH indexes
 * - 10-100x faster
 * - Might miss some relevant results
 * - Good enough for most applications
 * 
 * PARAMETERS TO TUNE:
 * -------------------
 * 1. Recall: What % of true results are found?
 *    - Higher recall = more complete results, slower
 *    - 95% recall is often good enough
 * 
 * 2. Latency: How fast is search?
 *    - P50: 50% of queries faster than X ms
 *    - P99: 99% of queries faster than X ms
 *    - Target: < 10ms for good UX
 * 
 * 3. Index build time: How long to build/update index?
 *    - HNSW: Slow to build, fast to search
 *    - IVF: Fast to build, medium search speed
 * 
 * ============================================================================
 * PRODUCTION ALTERNATIVES
 * ============================================================================
 * 
 * For real applications, use specialized vector databases:
 * 
 * 1. PINECONE (https://www.pinecone.io/)
 *    - Managed, cloud-native
 *    - Very easy to use
 *    - Cost: ~$70+/month
 *    - Best for: Quick deployment, no ops experience
 * 
 * 2. WEAVIATE (https://weaviate.io/)
 *    - Open-source, GraphQL API
 *    - Good documentation
 *    - Self-hosted or cloud
 *    - Best for: Full control, custom needs
 * 
 * 3. QDRANT (https://qdrant.tech/)
 *    - Rust-based, very fast
 *    - Good filtering support
 *    - Open-source or cloud
 *    - Best for: Performance-critical applications
 * 
 * 4. MILVUS (https://milvus.io/)
 *    - Open-source, battle-tested
 *    - Handles billions of vectors
 *    - GPU support
 *    - Best for: Large-scale deployments
 * 
 * 5. PGVECTOR (https://github.com/pgvector/pgvector)
 *    - PostgreSQL extension
 *    - Use existing Postgres infrastructure
 *    - HNSW support
 *    - Best for: If you already use Postgres
 * 
 * 6. CHROMA (https://www.trychroma.com/)
 *    - Simple, Python-focused
 *    - Good for prototyping
 *    - Easy local development
 *    - Best for: AI/ML developers, quick experiments
 * 
 * @see https://www.pinecone.io/learn/vector-database/
 * @see https://github.com/facebookresearch/faiss
 */

import { create, all } from 'mathjs';
import { existsSync, mkdirSync } from 'fs';
import { readFile, writeFile } from 'fs/promises';
import { dirname } from 'path';
import { llmConfig } from '../llm/llm_config.js';

// Initialize mathjs with all functions
// LEARNING NOTE: mathjs provides mathematical operations
// We use it for vector operations: dot product, norm, etc.
const math = create(all);

/**
 * VectorStore class
 * 
 * Simple in-memory vector store with persistence.
 * 
 * ARCHITECTURE:
 * -------------
 * - Storage: Map (in-memory, fast lookups)
 * - Persistence: JSON file (simple, human-readable)
 * - Search: Linear scan with cosine similarity (exact, slow)
 * 
 * DATA STRUCTURE:
 * ---------------
 * Map<id, {
 *   id: string,
 *   vector: Array<number>,
 *   metadata: Object
 * }>
 * 
 * DESIGN CHOICES:
 * ---------------
 * - Map instead of Array: O(1) lookups by ID
 * - JSON instead of binary: Easy to debug and inspect
 * - In-memory: Fast but limited by RAM
 * - No indexing: Simple but O(n) search
 * 
 * These trade-offs are perfect for learning and small datasets!
 */
class VectorStore {
  constructor(options = {}) {
    // Storage for vectors
    // LEARNING NOTE: Map maintains insertion order and has O(1) get/set/delete
    this.vectors = new Map();

    // Store path for persistence
    this.storePath = options.path || llmConfig.vectorStore.path;

    // Track if store has been loaded from disk
    this.loaded = false;

    // Statistics
    this.stats = {
      totalVectors: 0,
      totalSearches: 0,
      avgSearchTimeMs: 0,
      dimensions: null, // Set when first vector added
    };
  }

  /**
   * Add a vector to the store
   * 
   * LEARNING NOTE: Vectors must have consistent dimensions.
   * We validate this to catch errors early.
   * 
   * METADATA:
   * ---------
   * Attach any data to vectors:
   * - text: Original text that was embedded
   * - type: Document type (benefit, tool, etc.)
   * - url: Source URL
   * - timestamp: When added
   * - Any custom fields
   * 
   * @param {string} id - Unique identifier for this vector
   * @param {Array<number>} vector - Embedding vector
   * @param {Object} metadata - Associated metadata
   */
  addVector(id, vector, metadata = {}) {
    // Validate inputs
    if (!id || typeof id !== 'string') {
      throw new Error('ID must be a non-empty string');
    }

    if (!Array.isArray(vector)) {
      throw new Error('Vector must be an array');
    }

    if (vector.length === 0) {
      throw new Error('Vector cannot be empty');
    }

    // Check vector dimensions consistency
    // LEARNING NOTE: All vectors in a store must have same dimensions
    // Mixing dimensions makes similarity calculations invalid
    if (this.stats.dimensions === null) {
      // First vector sets the dimension
      this.stats.dimensions = vector.length;
    } else if (vector.length !== this.stats.dimensions) {
      throw new Error(
        `Vector dimension mismatch. Expected ${this.stats.dimensions}, got ${vector.length}`
      );
    }

    // Validate that vector contains valid numbers
    // LEARNING NOTE: NaN and Infinity can break similarity calculations
    for (let i = 0; i < vector.length; i++) {
      if (typeof vector[i] !== 'number' || !isFinite(vector[i])) {
        throw new Error(`Invalid vector value at index ${i}: ${vector[i]}`);
      }
    }

    // Store the vector with metadata
    this.vectors.set(id, {
      id,
      vector,
      metadata: {
        ...metadata,
        addedAt: new Date().toISOString(), // Track when added
      },
    });

    // Update statistics
    this.stats.totalVectors = this.vectors.size;
  }

  /**
   * Search for similar vectors
   * 
   * This is the core similarity search function.
   * 
   * ALGORITHM:
   * ----------
   * 1. Compute similarity between query and ALL stored vectors
   * 2. Sort by similarity (highest first)
   * 3. Filter by minimum similarity threshold
   * 4. Return top K results
   * 
   * PARAMETERS:
   * -----------
   * @param {Array<number>} queryVector - Vector to search for
   * @param {number} topK - Number of results to return (default: 10)
   * @param {number} minSimilarity - Minimum similarity threshold (default: 0.0)
   * @param {Object} filter - Optional metadata filter
   * 
   * @returns {Array<Object>} Array of results, each containing:
   *   - id: Vector ID
   *   - similarity: Similarity score (0-1)
   *   - metadata: Associated metadata
   *   - vector: The vector itself (optional)
   */
  search(queryVector, topK = 10, minSimilarity = 0.0, filter = null) {
    // Validate query vector
    if (!Array.isArray(queryVector)) {
      throw new Error('Query vector must be an array');
    }

    if (this.vectors.size === 0) {
      return [];
    }

    if (queryVector.length !== this.stats.dimensions) {
      throw new Error(
        `Query vector dimension mismatch. Expected ${this.stats.dimensions}, got ${queryVector.length}`
      );
    }

    // Start timing for statistics
    const startTime = Date.now();

    // Calculate similarity for all vectors
    // LEARNING NOTE: This is the "naive" approach - O(n) time complexity
    // We compare against every single vector in the store
    const results = [];

    for (const [id, entry] of this.vectors) {
      // Apply metadata filter if provided
      // LEARNING NOTE: Filtering lets you search within subsets
      // Example: Only search "benefit" type documents
      if (filter && !this.matchesFilter(entry.metadata, filter)) {
        continue;
      }

      // Calculate cosine similarity
      // LEARNING NOTE: Cosine similarity is expensive to compute
      // For production with millions of vectors, use indexed search
      const similarity = this.cosineSimilarity(queryVector, entry.vector);

      // Only include if above threshold
      // LEARNING NOTE: Thresholds filter out noise
      // Common values:
      // - 0.9+: Very similar (near-duplicates)
      // - 0.8-0.9: Highly relevant
      // - 0.7-0.8: Relevant
      // - 0.6-0.7: Somewhat relevant
      // - < 0.6: Probably not relevant
      if (similarity >= minSimilarity) {
        results.push({
          id,
          similarity,
          metadata: entry.metadata,
          // Optionally include vector (commented out to save memory)
          // vector: entry.vector,
        });
      }
    }

    // Sort by similarity (descending - highest first)
    // LEARNING NOTE: JavaScript sort() is in-place and uses Timsort (O(n log n))
    results.sort((a, b) => b.similarity - a.similarity);

    // Take top K results
    // LEARNING NOTE: slice(0, topK) creates a new array with first topK elements
    const topResults = results.slice(0, topK);

    // Update statistics
    const searchTime = Date.now() - startTime;
    this.stats.totalSearches++;
    
    // Calculate rolling average search time
    // LEARNING NOTE: Rolling average gives us performance insights over time
    this.stats.avgSearchTimeMs = 
      (this.stats.avgSearchTimeMs * (this.stats.totalSearches - 1) + searchTime) / 
      this.stats.totalSearches;

    return topResults;
  }

  /**
   * Calculate cosine similarity between two vectors
   * 
   * LEARNING NOTE: This is the heart of semantic search!
   * 
   * MATHEMATICAL BREAKDOWN:
   * -----------------------
   * Cosine similarity = cos(θ) = (A · B) / (|A| × |B|)
   * 
   * Where:
   * - A · B = Dot product = sum of element-wise multiplication
   * - |A| = Magnitude = sqrt(sum of squared elements)
   * - |B| = Magnitude = sqrt(sum of squared elements)
   * 
   * STEP-BY-STEP EXAMPLE:
   * ---------------------
   * A = [1, 2, 3]
   * B = [2, 3, 4]
   * 
   * Step 1: Dot product
   *   A · B = (1×2) + (2×3) + (3×4) = 2 + 6 + 12 = 20
   * 
   * Step 2: Magnitude of A
   *   |A| = √(1² + 2² + 3²) = √(1 + 4 + 9) = √14 ≈ 3.742
   * 
   * Step 3: Magnitude of B
   *   |B| = √(2² + 3² + 4²) = √(4 + 9 + 16) = √29 ≈ 5.385
   * 
   * Step 4: Cosine similarity
   *   cos(θ) = 20 / (3.742 × 5.385) = 20 / 20.15 ≈ 0.993
   * 
   * Result: 0.993 = Very similar! (almost identical direction)
   * 
   * OPTIMIZATION NOTE:
   * ------------------
   * For normalized vectors (length = 1), cosine similarity = dot product
   * OpenAI embeddings are normalized, so we could skip normalization
   * But we compute it properly for educational completeness
   * 
   * @param {Array<number>} vecA - First vector
   * @param {Array<number>} vecB - Second vector
   * @returns {number} Similarity score between -1 and 1
   */
  cosineSimilarity(vecA, vecB) {
    // Validate dimensions match
    if (vecA.length !== vecB.length) {
      throw new Error('Vectors must have same dimensions');
    }

    // Step 1: Calculate dot product
    // LEARNING NOTE: Dot product measures how much vectors point in same direction
    // Higher dot product = more aligned
    let dotProduct = 0;
    for (let i = 0; i < vecA.length; i++) {
      dotProduct += vecA[i] * vecB[i];
    }

    // Step 2: Calculate magnitudes (norms)
    // LEARNING NOTE: Magnitude = length of vector in space
    // sqrt(x₁² + x₂² + ... + xₙ²)
    let magnitudeA = 0;
    let magnitudeB = 0;
    
    for (let i = 0; i < vecA.length; i++) {
      magnitudeA += vecA[i] * vecA[i]; // Square each element
      magnitudeB += vecB[i] * vecB[i];
    }
    
    magnitudeA = Math.sqrt(magnitudeA); // Take square root
    magnitudeB = Math.sqrt(magnitudeB);

    // Step 3: Divide dot product by product of magnitudes
    // LEARNING NOTE: This normalization gives us the cosine of angle
    // Removes effect of vector length, focuses on direction
    
    // Handle edge case: zero vector
    if (magnitudeA === 0 || magnitudeB === 0) {
      return 0; // Undefined similarity for zero vectors
    }

    const similarity = dotProduct / (magnitudeA * magnitudeB);

    // Clamp to [-1, 1] to handle floating point errors
    // LEARNING NOTE: Sometimes floating point math gives us 1.0000000001
    // Clamp to valid range
    return Math.max(-1, Math.min(1, similarity));
  }

  /**
   * Calculate Euclidean distance between two vectors
   * 
   * LEARNING NOTE: Alternative similarity metric.
   * 
   * Euclidean distance = straight-line distance in n-dimensional space
   * Formula: d = √(Σ(Aᵢ - Bᵢ)²)
   * 
   * EXAMPLE:
   * --------
   * A = [1, 2]
   * B = [4, 6]
   * 
   * d = √((4-1)² + (6-2)²) = √(9 + 16) = √25 = 5
   * 
   * WHEN TO USE:
   * ------------
   * - Clustering (K-means uses Euclidean distance)
   * - When magnitude matters (unlike cosine)
   * - Physical distance problems
   * 
   * NOTE: Smaller distance = more similar (opposite of cosine)
   * 
   * @param {Array<number>} vecA - First vector
   * @param {Array<number>} vecB - Second vector
   * @returns {number} Distance (0 = identical, higher = more different)
   */
  euclideanDistance(vecA, vecB) {
    if (vecA.length !== vecB.length) {
      throw new Error('Vectors must have same dimensions');
    }

    // Sum of squared differences
    let sumSquaredDiff = 0;
    for (let i = 0; i < vecA.length; i++) {
      const diff = vecA[i] - vecB[i];
      sumSquaredDiff += diff * diff;
    }

    // Square root of sum
    return Math.sqrt(sumSquaredDiff);
  }

  /**
   * Calculate dot product between two vectors
   * 
   * LEARNING NOTE: Dot product = sum of element-wise multiplication
   * 
   * Formula: A · B = Σ(Aᵢ × Bᵢ)
   * 
   * EXAMPLE:
   * --------
   * A = [1, 2, 3]
   * B = [4, 5, 6]
   * 
   * A · B = (1×4) + (2×5) + (3×6) = 4 + 10 + 18 = 32
   * 
   * PROPERTIES:
   * -----------
   * - Commutative: A · B = B · A
   * - If vectors perpendicular: A · B = 0
   * - If vectors parallel: A · B = |A| × |B|
   * 
   * RELATIONSHIP TO COSINE:
   * -----------------------
   * For normalized vectors (length = 1):
   *   Dot product = Cosine similarity
   * 
   * This is why many systems use dot product directly!
   * 
   * @param {Array<number>} vecA - First vector
   * @param {Array<number>} vecB - Second vector
   * @returns {number} Dot product
   */
  dotProduct(vecA, vecB) {
    if (vecA.length !== vecB.length) {
      throw new Error('Vectors must have same dimensions');
    }

    let sum = 0;
    for (let i = 0; i < vecA.length; i++) {
      sum += vecA[i] * vecB[i];
    }

    return sum;
  }

  /**
   * Check if metadata matches filter
   * 
   * LEARNING NOTE: Simple filtering for metadata-based search
   * 
   * EXAMPLES:
   * ---------
   * Filter: { type: 'benefit' }
   * Matches: { type: 'benefit', ... }
   * Doesn't match: { type: 'tool', ... }
   * 
   * Filter: { type: 'benefit', category: 'housing' }
   * Matches: { type: 'benefit', category: 'housing', ... }
   * 
   * @param {Object} metadata - Metadata to check
   * @param {Object} filter - Filter criteria
   * @returns {boolean} True if matches
   */
  matchesFilter(metadata, filter) {
    // Check all filter properties
    for (const [key, value] of Object.entries(filter)) {
      if (metadata[key] !== value) {
        return false;
      }
    }
    return true;
  }

  /**
   * Get a vector by ID
   * 
   * @param {string} id - Vector ID
   * @returns {Object|null} Vector entry or null if not found
   */
  get(id) {
    return this.vectors.get(id) || null;
  }

  /**
   * Delete a vector by ID
   * 
   * @param {string} id - Vector ID
   * @returns {boolean} True if deleted, false if not found
   */
  delete(id) {
    const deleted = this.vectors.delete(id);
    if (deleted) {
      this.stats.totalVectors = this.vectors.size;
    }
    return deleted;
  }

  /**
   * Check if vector exists
   * 
   * @param {string} id - Vector ID
   * @returns {boolean} True if exists
   */
  has(id) {
    return this.vectors.has(id);
  }

  /**
   * Get all vector IDs
   * 
   * @returns {Array<string>} Array of IDs
   */
  getAllIds() {
    return Array.from(this.vectors.keys());
  }

  /**
   * Get count of vectors in store
   * 
   * @returns {number} Number of vectors
   */
  size() {
    return this.vectors.size;
  }

  /**
   * Clear all vectors from store
   * 
   * LEARNING NOTE: Useful for:
   * - Testing
   * - Resetting state
   * - Switching to different embeddings
   */
  clear() {
    this.vectors.clear();
    this.stats.totalVectors = 0;
    this.stats.dimensions = null;
  }

  /**
   * Save vector store to JSON file
   * 
   * LEARNING NOTE: JSON persistence is simple but has limitations:
   * 
   * PROS:
   * - Human-readable
   * - Easy to debug
   * - No dependencies
   * - Version control friendly
   * 
   * CONS:
   * - Slow for large datasets (> 100MB)
   * - Loads entire file into memory
   * - No incremental updates
   * - No compression
   * 
   * PRODUCTION ALTERNATIVES:
   * - SQLite: Good balance of simplicity and performance
   * - LevelDB: Fast key-value store
   * - Redis: In-memory with persistence
   * - Specialized vector DB: Best for large scale
   * 
   * FILE FORMAT:
   * ------------
   * {
   *   "version": "1.0",
   *   "stats": { ... },
   *   "vectors": {
   *     "id1": { id, vector, metadata },
   *     "id2": { id, vector, metadata },
   *     ...
   *   }
   * }
   */
  async save() {
    const storePath = this.storePath;

    // Ensure directory exists
    const dir = dirname(storePath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    try {
      // Convert Map to Object for JSON serialization
      const vectorsObj = Object.fromEntries(this.vectors);

      // Create save data
      const data = {
        version: '1.0',
        savedAt: new Date().toISOString(),
        stats: this.stats,
        vectors: vectorsObj,
      };

      // Write to file
      // LEARNING NOTE: JSON.stringify() with indentation makes file readable
      // Trade-off: Larger file size vs. easier debugging
      await writeFile(storePath, JSON.stringify(data, null, 2), 'utf-8');

      console.log(`[VectorStore] Saved ${this.vectors.size} vectors to ${storePath}`);
    } catch (error) {
      console.error('[VectorStore] Failed to save:', error);
      throw new Error(`Failed to save vector store: ${error.message}`);
    }
  }

  /**
   * Load vector store from JSON file
   * 
   * LEARNING NOTE: Loading validates data and handles errors gracefully
   */
  async load() {
    const storePath = this.storePath;

    // Check if file exists
    if (!existsSync(storePath)) {
      console.log('[VectorStore] No saved store found, starting fresh');
      this.loaded = true;
      return;
    }

    try {
      // Read file
      const content = await readFile(storePath, 'utf-8');
      const data = JSON.parse(content);

      // Validate version
      // LEARNING NOTE: Version checking handles format changes
      if (data.version !== '1.0') {
        throw new Error(`Unsupported version: ${data.version}`);
      }

      // Load vectors
      this.vectors.clear();
      for (const [id, entry] of Object.entries(data.vectors)) {
        this.vectors.set(id, entry);
      }

      // Restore statistics
      if (data.stats) {
        this.stats = {
          ...this.stats,
          ...data.stats,
        };
      }

      console.log(`[VectorStore] Loaded ${this.vectors.size} vectors from ${storePath}`);
      this.loaded = true;

    } catch (error) {
      console.error('[VectorStore] Failed to load:', error);
      throw new Error(`Failed to load vector store: ${error.message}`);
    }
  }

  /**
   * Get statistics about vector store
   * 
   * @returns {Object} Statistics
   */
  getStats() {
    return {
      ...this.stats,
      sizeInMemory: this.estimateMemoryUsage(),
    };
  }

  /**
   * Estimate memory usage
   * 
   * LEARNING NOTE: Rough estimation for monitoring
   * 
   * Each vector entry contains:
   * - id: ~50 bytes (average string)
   * - vector: dimensions × 8 bytes (float64)
   * - metadata: ~200 bytes (average)
   * 
   * @returns {string} Human-readable size
   */
  estimateMemoryUsage() {
    if (this.vectors.size === 0) {
      return '0 KB';
    }

    // Estimate bytes per vector
    const bytesPerVector = 50 + (this.stats.dimensions * 8) + 200;
    const totalBytes = this.vectors.size * bytesPerVector;

    // Convert to human-readable
    if (totalBytes < 1024) {
      return `${totalBytes} B`;
    } else if (totalBytes < 1024 * 1024) {
      return `${(totalBytes / 1024).toFixed(2)} KB`;
    } else {
      return `${(totalBytes / (1024 * 1024)).toFixed(2)} MB`;
    }
  }

  /**
   * Get formatted summary
   * 
   * @returns {string} Human-readable summary
   */
  getSummary() {
    const stats = this.getStats();
    
    return [
      '=== Vector Store Summary ===',
      `Total Vectors: ${stats.totalVectors}`,
      `Dimensions: ${stats.dimensions || 'N/A'}`,
      `Total Searches: ${stats.totalSearches}`,
      `Avg Search Time: ${stats.avgSearchTimeMs.toFixed(2)}ms`,
      `Estimated Memory: ${stats.sizeInMemory}`,
    ].join('\n');
  }
}

// Export class
export { VectorStore };

// Export convenience instance
// LEARNING NOTE: Pre-configured instance for common use
export const vectorStore = new VectorStore();

export default vectorStore;

/**
 * ============================================================================
 * USAGE EXAMPLES
 * ============================================================================
 * 
 * 1. Create and add vectors:
 * --------------------------
 * ```javascript
 * import { VectorStore } from './vector_store.js';
 * 
 * const store = new VectorStore();
 * 
 * // Add some embeddings
 * store.addVector('doc1', [0.1, 0.2, 0.3, ...], {
 *   text: 'Arbeitslosengeld II',
 *   type: 'benefit',
 *   category: 'financial'
 * });
 * 
 * store.addVector('doc2', [0.2, 0.3, 0.4, ...], {
 *   text: 'Wohngeld',
 *   type: 'benefit',
 *   category: 'housing'
 * });
 * ```
 * 
 * 2. Search for similar vectors:
 * ------------------------------
 * ```javascript
 * // Create query vector (in practice, this comes from embedding service)
 * const queryVector = [0.15, 0.25, 0.35, ...];
 * 
 * // Find top 5 most similar
 * const results = store.search(queryVector, 5);
 * 
 * console.log('Top matches:');
 * for (const result of results) {
 *   console.log(`${result.id}: ${result.similarity.toFixed(3)} - ${result.metadata.text}`);
 * }
 * 
 * // Output:
 * // doc1: 0.987 - Arbeitslosengeld II
 * // doc2: 0.823 - Wohngeld
 * ```
 * 
 * 3. Filter by metadata:
 * ----------------------
 * ```javascript
 * // Only search within housing benefits
 * const housingResults = store.search(
 *   queryVector,
 *   5,
 *   0.7, // minimum similarity
 *   { category: 'housing' } // filter
 * );
 * ```
 * 
 * 4. Persistence:
 * ---------------
 * ```javascript
 * // Save to disk
 * await store.save();
 * console.log('Vector store saved');
 * 
 * // Later, load from disk
 * const newStore = new VectorStore();
 * await newStore.load();
 * console.log(`Loaded ${newStore.size()} vectors`);
 * ```
 * 
 * 5. Statistics and monitoring:
 * -----------------------------
 * ```javascript
 * console.log(store.getSummary());
 * 
 * // Output:
 * // === Vector Store Summary ===
 * // Total Vectors: 1000
 * // Dimensions: 1536
 * // Total Searches: 45
 * // Avg Search Time: 12.34ms
 * // Estimated Memory: 12.29 MB
 * ```
 * 
 * 6. Compare similarity metrics:
 * ------------------------------
 * ```javascript
 * const vec1 = [1, 2, 3];
 * const vec2 = [2, 3, 4];
 * 
 * const cosine = store.cosineSimilarity(vec1, vec2);
 * const euclidean = store.euclideanDistance(vec1, vec2);
 * const dot = store.dotProduct(vec1, vec2);
 * 
 * console.log(`Cosine similarity: ${cosine.toFixed(3)}`);      // 0.993 (very similar)
 * console.log(`Euclidean distance: ${euclidean.toFixed(3)}`);  // 1.732
 * console.log(`Dot product: ${dot}`);                          // 20
 * ```
 * 
 * ============================================================================
 * LEARNING EXERCISES
 * ============================================================================
 * 
 * 1. Understanding Cosine Similarity:
 * -----------------------------------
 * Try these vector pairs and predict similarity before running:
 * 
 * ```javascript
 * const store = new VectorStore();
 * 
 * // Same direction, same magnitude
 * console.log(store.cosineSimilarity([1, 0], [1, 0]));
 * // Prediction: 1.0 ✓
 * 
 * // Same direction, different magnitude
 * console.log(store.cosineSimilarity([1, 0], [2, 0]));
 * // Prediction: 1.0 ✓ (cosine ignores magnitude!)
 * 
 * // Perpendicular (90 degrees)
 * console.log(store.cosineSimilarity([1, 0], [0, 1]));
 * // Prediction: 0.0 ✓
 * 
 * // Opposite direction
 * console.log(store.cosineSimilarity([1, 0], [-1, 0]));
 * // Prediction: -1.0 ✓
 * ```
 * 
 * 2. Performance Testing:
 * -----------------------
 * Test how search time scales with dataset size:
 * 
 * ```javascript
 * import { VectorStore } from './vector_store.js';
 * 
 * const dimensions = 1536;
 * const sizes = [100, 1000, 10000];
 * 
 * for (const size of sizes) {
 *   const store = new VectorStore();
 *   
 *   // Add random vectors
 *   for (let i = 0; i < size; i++) {
 *     const vec = Array(dimensions).fill(0).map(() => Math.random());
 *     store.addVector(`vec${i}`, vec);
 *   }
 *   
 *   // Search
 *   const query = Array(dimensions).fill(0).map(() => Math.random());
 *   const start = Date.now();
 *   store.search(query, 10);
 *   const time = Date.now() - start;
 *   
 *   console.log(`${size} vectors: ${time}ms`);
 * }
 * 
 * // Observe linear growth: 2x vectors ≈ 2x time
 * // This shows why indexing matters for large datasets!
 * ```
 */
