/**
 * Systemfehler - Embedding Service Module
 * 
 * This module generates vector embeddings for text using OpenAI's embedding models.
 * Embeddings are the foundation of semantic search and AI-powered content discovery.
 * 
 * ============================================================================
 * WHAT ARE EMBEDDINGS?
 * ============================================================================
 * 
 * Embeddings are VECTOR REPRESENTATIONS of text - they convert words, sentences,
 * or documents into arrays of numbers (vectors) that capture semantic meaning.
 * 
 * EXAMPLE:
 * - Input:  "The cat sat on the mat"
 * - Output: [0.032, -0.421, 0.156, ..., 0.891]  (1536 numbers for text-embedding-3-small)
 * 
 * KEY PROPERTIES:
 * ---------------
 * 1. SEMANTIC SIMILARITY: Similar meanings → similar vectors
 *    - "happy" and "joyful" have similar embeddings
 *    - "happy" and "sad" have very different embeddings
 * 
 * 2. LANGUAGE UNDERSTANDING: Captures context and relationships
 *    - "bank" (financial) vs "bank" (river) have different embeddings based on context
 * 
 * 3. MATHEMATICAL OPERATIONS: Can compute similarity using vector math
 *    - Cosine similarity, dot product, euclidean distance
 * 
 * ============================================================================
 * WHY EMBEDDINGS ENABLE SEMANTIC SEARCH?
 * ============================================================================
 * 
 * TRADITIONAL KEYWORD SEARCH:
 * ---------------------------
 * Query: "affordable housing assistance"
 * Matches: Documents containing exact words "affordable", "housing", "assistance"
 * Misses:  "low-cost apartment support", "cheap rental help"
 * 
 * SEMANTIC SEARCH WITH EMBEDDINGS:
 * --------------------------------
 * 1. Convert query to embedding vector
 * 2. Convert all documents to embedding vectors (done once, cached)
 * 3. Find documents with vectors closest to query vector
 * 4. Returns semantically similar content, even without exact keyword matches
 * 
 * Benefits:
 * - Finds synonyms automatically ("cheap" matches "affordable")
 * - Understands intent ("help with rent" matches "rental assistance programs")
 * - Works across languages (with multilingual models)
 * - Robust to typos and variations
 * 
 * ============================================================================
 * DIMENSIONALITY AND MODEL CHOICES
 * ============================================================================
 * 
 * DIMENSIONS = Number of values in the embedding vector
 * 
 * OpenAI Embedding Models:
 * ------------------------
 * 1. text-embedding-3-small:
 *    - Dimensions: 1536 (default)
 *    - Cost: $0.02 per 1M tokens (very cheap!)
 *    - Speed: Fast
 *    - Use for: Most applications, high-volume scenarios
 * 
 * 2. text-embedding-3-large:
 *    - Dimensions: 3072
 *    - Cost: $0.13 per 1M tokens (6.5x more expensive)
 *    - Quality: Better for nuanced distinctions
 *    - Use for: When accuracy is critical, low-volume scenarios
 * 
 * TRADE-OFFS:
 * -----------
 * More dimensions = More detail BUT:
 * - Higher storage costs (2x dimensions = 2x storage)
 * - Slower similarity calculations
 * - Diminishing returns (1536 is usually enough)
 * 
 * LEARNING TIP: Start with text-embedding-3-small. Only upgrade if you
 * measure a meaningful quality improvement for your specific use case.
 * 
 * ============================================================================
 * BATCH PROCESSING BENEFITS
 * ============================================================================
 * 
 * SINGLE REQUEST:
 * - 1 API call = 1 text → 1 embedding
 * - Network overhead per request (~50-200ms latency)
 * - Rate limit: X requests per minute
 * 
 * BATCH REQUEST:
 * - 1 API call = N texts → N embeddings (up to 2048 texts)
 * - Amortized network overhead
 * - Effective rate limit: X * N items per minute
 * - Lower total latency
 * 
 * EXAMPLE:
 * --------
 * Process 1000 documents:
 * - Single:  1000 requests × 100ms = 100 seconds + queueing
 * - Batch:   10 requests × 100ms = 1 second + processing
 * 
 * BEST PRACTICE: Always batch when processing multiple texts.
 * 
 * ============================================================================
 * CACHE STRATEGIES
 * ============================================================================
 * 
 * WHY CACHE EMBEDDINGS?
 * ---------------------
 * 1. COST SAVINGS: Embeddings cost money to generate
 * 2. SPEED: Loading from cache is 1000x faster than API calls
 * 3. CONSISTENCY: Same text always gets same embedding
 * 4. OFFLINE: Can work without internet once cached
 * 
 * CACHE KEY STRATEGY:
 * -------------------
 * We use content-based hashing (SHA-256):
 * - Input: "Hello world"
 * - Hash: "64ec88ca00b268e5ba1a35678a1b5316d212f4f366b2477232534a8aeca37f3c"
 * - Benefits:
 *   * Same content → same hash (cache hit)
 *   * Different content → different hash (cache miss)
 *   * No collision worries with cryptographic hash
 * 
 * CACHE INVALIDATION:
 * -------------------
 * "There are only two hard things in Computer Science: cache invalidation
 * and naming things." - Phil Karlton
 * 
 * When to invalidate:
 * - Model change (text-embedding-3-small → text-embedding-3-large)
 * - Corrupted data
 * - Storage constraints
 * 
 * We handle model changes by including model name in cache key.
 * 
 * STORAGE:
 * --------
 * Simple JSON file cache for learning/development:
 * - Easy to inspect and debug
 * - Human-readable
 * - No dependencies
 * 
 * Production alternatives:
 * - Redis: Fast, distributed, TTL support
 * - SQLite: Persistent, queryable, good for medium datasets
 * - LRU cache: Memory-based, good for hot data
 * 
 * @see llm_config.js for embedding configuration
 * @see token_utils.js for cost calculation
 * @see cost_tracker.js for tracking spending
 */

import OpenAI from 'openai';
import { llmConfig } from '../llm/llm_config.js';
import { countTokens, calculateCost } from '../llm/token_utils.js';
import { trackRequest } from '../llm/cost_tracker.js';
import { createHash } from 'crypto';
import { existsSync, mkdirSync } from 'fs';
import { readFile, writeFile } from 'fs/promises';
import { dirname } from 'path';

/**
 * EmbeddingService class
 * 
 * Provides methods for generating and caching text embeddings.
 * 
 * DESIGN PATTERNS USED:
 * ---------------------
 * 1. Singleton: One instance manages the cache
 * 2. Lazy initialization: Cache loaded only when needed
 * 3. Batch processing: Efficient handling of multiple texts
 * 4. Caching: Memoization pattern for expensive operations
 */
class EmbeddingService {
  constructor() {
    // Initialize OpenAI client
    // LEARNING NOTE: The OpenAI client handles:
    // - Authentication (via API key)
    // - Request formatting
    // - Response parsing
    // - Basic error handling
    this.client = new OpenAI({
      apiKey: llmConfig.openai.apiKey,
    });

    // Cache for storing embeddings
    // LEARNING NOTE: Map vs Object for caches:
    // - Map: Better for frequent additions/deletions, preserves insertion order
    // - Object: Simpler syntax, but keys are always strings
    // We use Map for better performance with many entries
    this.cache = new Map();

    // Cache loaded flag to avoid loading multiple times
    this.cacheLoaded = false;

    // Model configuration
    this.model = llmConfig.models.embedding;
    this.dimensions = llmConfig.embeddings.dimensions;

    // Statistics tracking
    // LEARNING NOTE: Track metrics to understand and optimize usage
    this.stats = {
      cacheHits: 0,      // How many times we used cached embeddings
      cacheMisses: 0,    // How many times we generated new embeddings
      totalRequests: 0,  // Total embedding requests
      totalTokens: 0,    // Total tokens processed
      totalCost: 0,      // Total cost incurred
    };
  }

  /**
   * Generate cache key for text
   * 
   * LEARNING NOTE: Hash functions convert variable-length input to fixed-length output:
   * - Input: Any text (1 char to 1M chars)
   * - Output: 64 character hex string
   * 
   * SHA-256 properties:
   * - Deterministic: Same input always produces same output
   * - One-way: Cannot recover original text from hash
   * - Collision-resistant: Practically impossible for two texts to have same hash
   * - Fast: Can hash megabytes per second
   * 
   * We include model name to handle model changes:
   * - "Hello" with text-embedding-3-small → hash1
   * - "Hello" with text-embedding-3-large → hash2
   * 
   * @param {string} text - Text to hash
   * @param {string} model - Model name
   * @returns {string} Cache key (hex hash)
   */
  getCacheKey(text, model = this.model) {
    // Create hash object using SHA-256 algorithm
    const hash = createHash('sha256');
    
    // Update hash with model and text
    // LEARNING NOTE: Include model in hash so same text with different models
    // gets different cache keys (they produce different embeddings)
    hash.update(model);
    hash.update(text);
    
    // Return hexadecimal representation
    return hash.digest('hex');
  }

  /**
   * Load cache from disk
   * 
   * LEARNING NOTE: Lazy loading pattern - only load when needed.
   * Benefits:
   * - Faster startup if embeddings not used
   * - Memory efficient
   * - Explicit control over when I/O happens
   * 
   * Cache file format (JSON):
   * {
   *   "cacheKey1": {
   *     "embedding": [0.1, 0.2, ...],
   *     "text": "original text",
   *     "model": "text-embedding-3-small",
   *     "timestamp": "2024-01-16T10:30:00.000Z"
   *   },
   *   ...
   * }
   */
  async loadCache() {
    // Only load once
    if (this.cacheLoaded) {
      return;
    }

    // Check if caching is enabled
    if (!llmConfig.embeddings.cacheEnabled) {
      this.cacheLoaded = true;
      return;
    }

    const cachePath = this.getCachePath();

    // Check if cache file exists
    if (!existsSync(cachePath)) {
      console.log('[EmbeddingService] No cache file found, starting fresh');
      this.cacheLoaded = true;
      return;
    }

    try {
      // Read and parse cache file
      const content = await readFile(cachePath, 'utf-8');
      const data = JSON.parse(content);

      // Load into Map
      // LEARNING NOTE: Object.entries() converts object to [key, value] pairs
      // Perfect for initializing a Map
      for (const [key, value] of Object.entries(data)) {
        this.cache.set(key, value);
      }

      console.log(`[EmbeddingService] Loaded ${this.cache.size} cached embeddings`);
    } catch (error) {
      // Don't fail if cache is corrupted, just start fresh
      console.warn('[EmbeddingService] Failed to load cache, starting fresh:', error.message);
    }

    this.cacheLoaded = true;
  }

  /**
   * Save cache to disk
   * 
   * LEARNING NOTE: Persistence ensures cache survives restarts.
   * Trade-off: I/O cost vs. cache durability
   * 
   * Strategies:
   * - Write-through: Save on every change (safe but slow)
   * - Write-back: Save periodically or on shutdown (fast but risk loss)
   * - We use write-through for simplicity in this learning project
   */
  async saveCache() {
    // Skip if caching disabled
    if (!llmConfig.embeddings.cacheEnabled) {
      return;
    }

    const cachePath = this.getCachePath();

    // Ensure directory exists
    // LEARNING NOTE: mkdir with recursive: true creates parent directories
    // Similar to `mkdir -p` in Unix
    const dir = dirname(cachePath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    try {
      // Convert Map to Object for JSON serialization
      // LEARNING NOTE: Object.fromEntries() is the inverse of Object.entries()
      // Map → Array of [key, value] → Object
      const data = Object.fromEntries(this.cache);

      // Write to disk
      // LEARNING NOTE: JSON.stringify() third parameter (2) is indentation
      // Makes file human-readable for debugging
      await writeFile(cachePath, JSON.stringify(data, null, 2), 'utf-8');

      if (llmConfig.logging.level === 'debug') {
        console.log(`[EmbeddingService] Saved ${this.cache.size} embeddings to cache`);
      }
    } catch (error) {
      console.error('[EmbeddingService] Failed to save cache:', error);
    }
  }

  /**
   * Get cache file path
   * 
   * @returns {string} Path to cache file
   */
  getCachePath() {
    // Use configured path or default
    return llmConfig.vectorStore?.path?.replace('vector_store.json', 'embedding_cache.json') 
      || 'data/_embeddings/embedding_cache.json';
  }

  /**
   * Generate embedding for a single text
   * 
   * This is the core function that calls OpenAI's API to generate embeddings.
   * 
   * LEARNING NOTE: The embedding API is simpler than chat completions:
   * - Input: Text string(s)
   * - Output: Vector(s)
   * - No sampling, temperature, or randomness
   * - Same input always produces same output (deterministic)
   * 
   * API REQUEST FORMAT:
   * {
   *   model: "text-embedding-3-small",
   *   input: "Your text here",
   *   encoding_format: "float"  // Array of floats (default)
   * }
   * 
   * API RESPONSE FORMAT:
   * {
   *   data: [
   *     {
   *       embedding: [0.1, 0.2, ..., 0.9],
   *       index: 0
   *     }
   *   ],
   *   model: "text-embedding-3-small",
   *   usage: { prompt_tokens: 8, total_tokens: 8 }
   * }
   * 
   * @param {string} text - Text to embed
   * @param {Object} options - Optional parameters
   * @param {string} options.model - Override default model
   * @returns {Promise<Array<number>>} Embedding vector
   */
  async generateEmbedding(text, options = {}) {
    // Validate input
    if (!text || typeof text !== 'string') {
      throw new Error('Text must be a non-empty string');
    }

    // Trim whitespace
    // LEARNING NOTE: Extra whitespace wastes tokens and can affect embeddings
    text = text.trim();

    if (text.length === 0) {
      throw new Error('Text cannot be empty after trimming');
    }

    // Use specified model or default
    const model = options.model || this.model;

    // Check cache first
    const cached = await this.getCachedEmbedding(text, model);
    if (cached) {
      return cached;
    }

    // Count tokens for cost tracking
    // LEARNING NOTE: Token counting before API call helps:
    // - Estimate costs
    // - Enforce limits
    // - Track usage patterns
    const tokens = countTokens(text, model);

    // Generate request ID for tracking
    // LEARNING NOTE: Unique IDs help correlate logs, debug issues, track costs
    const requestId = `emb-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    try {
      // Call OpenAI API
      const startTime = Date.now();
      
      const response = await this.client.embeddings.create({
        model,
        input: text,
        encoding_format: 'float', // Return as array of floats
      });

      const latency = Date.now() - startTime;

      // Extract embedding from response
      // LEARNING NOTE: Response.data is an array (even for single input)
      // because API supports batch requests
      const embedding = response.data[0].embedding;

      // Calculate cost
      // LEARNING NOTE: Embeddings only have input tokens (no output)
      const cost = calculateCost({ inputTokens: tokens, outputTokens: 0 }, model);

      // Track request for cost monitoring
      trackRequest({
        requestId,
        model,
        feature: 'embeddings',
        inputTokens: tokens,
        outputTokens: 0,
        cost,
        latencyMs: latency,
        status: 'success',
      });

      // Update statistics
      this.stats.cacheMisses++;
      this.stats.totalRequests++;
      this.stats.totalTokens += tokens;
      this.stats.totalCost += cost;

      // Cache the result
      await this.cacheEmbedding(text, embedding, model);

      return embedding;

    } catch (error) {
      // Log error and re-throw with context
      console.error('[EmbeddingService] Failed to generate embedding:', error);
      
      // Track failed request
      trackRequest({
        requestId,
        model,
        feature: 'embeddings',
        inputTokens: tokens,
        outputTokens: 0,
        cost: 0,
        latencyMs: 0,
        status: 'error',
        error: error.message,
      });

      throw new Error(`Failed to generate embedding: ${error.message}`);
    }
  }

  /**
   * Generate embeddings for multiple texts (batch processing)
   * 
   * LEARNING NOTE: Batch processing is crucial for efficiency:
   * 
   * COMPARISON:
   * -----------
   * Process 100 texts:
   * 
   * Sequential (using generateEmbedding in loop):
   * - 100 API calls
   * - ~10,000ms total time (100ms per call)
   * - 100 HTTP requests
   * 
   * Batch (using generateEmbeddings):
   * - 1 API call
   * - ~200ms total time
   * - 1 HTTP request
   * - 50x faster!
   * 
   * BATCH SIZE LIMITS:
   * ------------------
   * OpenAI limits: Up to 2048 input texts per request
   * We use 100 (configurable) for balance between:
   * - Efficiency: Larger batches = fewer API calls
   * - Reliability: Smaller batches = less likely to timeout
   * - Memory: Each batch held in memory
   * 
   * SMART CACHING:
   * --------------
   * We check cache before making API calls:
   * 1. Split texts into cached and uncached
   * 2. Only request embeddings for uncached texts
   * 3. Combine cached + new embeddings in original order
   * 4. Return complete results
   * 
   * @param {Array<string>} texts - Array of texts to embed
   * @param {Object} options - Optional parameters
   * @param {string} options.model - Override default model
   * @param {number} options.batchSize - Override batch size
   * @returns {Promise<Array<Array<number>>>} Array of embedding vectors
   */
  async generateEmbeddings(texts, options = {}) {
    // Validate input
    if (!Array.isArray(texts)) {
      throw new Error('Texts must be an array');
    }

    if (texts.length === 0) {
      return [];
    }

    // Use specified model or default
    const model = options.model || this.model;
    const batchSize = options.batchSize || llmConfig.embeddings.batchSize;

    // Ensure cache is loaded
    await this.loadCache();

    // Prepare results array (maintains order)
    // LEARNING NOTE: new Array(n) creates array of length n with undefined values
    // We'll fill it with embeddings as we get them
    const results = new Array(texts.length);

    // Track which texts need embeddings
    const uncachedIndices = [];
    const uncachedTexts = [];

    // Check cache for each text
    for (let i = 0; i < texts.length; i++) {
      const text = texts[i].trim();
      
      if (text.length === 0) {
        // Skip empty texts
        results[i] = null;
        continue;
      }

      // Try to get from cache
      const cached = await this.getCachedEmbedding(text, model);
      
      if (cached) {
        // Cache hit - use cached embedding
        results[i] = cached;
      } else {
        // Cache miss - need to generate
        uncachedIndices.push(i);
        uncachedTexts.push(text);
      }
    }

    // If everything was cached, we're done!
    if (uncachedTexts.length === 0) {
      return results;
    }

    console.log(
      `[EmbeddingService] Generating embeddings for ${uncachedTexts.length} texts ` +
      `(${texts.length - uncachedTexts.length} cached)`
    );

    // Process uncached texts in batches
    // LEARNING NOTE: Batch processing pattern:
    // 1. Split large array into chunks
    // 2. Process each chunk
    // 3. Combine results
    for (let i = 0; i < uncachedTexts.length; i += batchSize) {
      // Get batch slice
      // LEARNING NOTE: slice(start, end) returns elements from start to end-1
      // If end > length, it just goes to the end
      const batch = uncachedTexts.slice(i, i + batchSize);
      const batchIndices = uncachedIndices.slice(i, i + batchSize);

      // Generate request ID
      const requestId = `emb-batch-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      try {
        // Count tokens for entire batch
        const totalTokens = batch.reduce((sum, text) => sum + countTokens(text, model), 0);

        // Call API
        const startTime = Date.now();
        
        const response = await this.client.embeddings.create({
          model,
          input: batch, // API accepts array of strings
          encoding_format: 'float',
        });

        const latency = Date.now() - startTime;

        // Calculate cost for batch
        const cost = calculateCost({ inputTokens: totalTokens, outputTokens: 0 }, model);

        // Track batch request
        trackRequest({
          requestId,
          model,
          feature: 'embeddings-batch',
          inputTokens: totalTokens,
          outputTokens: 0,
          cost,
          latencyMs: latency,
          status: 'success',
        });

        // Update statistics
        this.stats.cacheMisses += batch.length;
        this.stats.totalRequests += batch.length;
        this.stats.totalTokens += totalTokens;
        this.stats.totalCost += cost;

        // Process results
        // LEARNING NOTE: response.data contains embeddings in same order as input
        for (let j = 0; j < response.data.length; j++) {
          const embedding = response.data[j].embedding;
          const originalIndex = batchIndices[j];
          const text = batch[j];

          // Store in results at original position
          results[originalIndex] = embedding;

          // Cache the embedding
          await this.cacheEmbedding(text, embedding, model);
        }

      } catch (error) {
        console.error('[EmbeddingService] Batch embedding failed:', error);
        
        // Track failed batch
        trackRequest({
          requestId,
          model,
          feature: 'embeddings-batch',
          inputTokens: 0,
          outputTokens: 0,
          cost: 0,
          latencyMs: 0,
          status: 'error',
          error: error.message,
        });

        throw new Error(`Failed to generate batch embeddings: ${error.message}`);
      }
    }

    return results;
  }

  /**
   * Get cached embedding if available
   * 
   * Cache-first strategy:
   * 1. Check if cache is loaded (load if not)
   * 2. Compute cache key
   * 3. Look up in cache
   * 4. Check if cache entry is still valid (TTL)
   * 5. Return embedding or null
   * 
   * @param {string} text - Text to look up
   * @param {string} model - Model name
   * @returns {Promise<Array<number>|null>} Cached embedding or null
   */
  async getCachedEmbedding(text, model = this.model) {
    // Skip if caching disabled
    if (!llmConfig.embeddings.cacheEnabled) {
      return null;
    }

    // Ensure cache is loaded
    await this.loadCache();

    // Get cache key
    const key = this.getCacheKey(text, model);

    // Look up in cache
    if (!this.cache.has(key)) {
      return null;
    }

    const cached = this.cache.get(key);

    // Check TTL (Time To Live)
    // LEARNING NOTE: TTL prevents using stale cache entries
    // Useful when:
    // - Embeddings model improves
    // - Need to refresh periodically
    // - Storage constraints (expire old entries)
    if (llmConfig.embeddings.cacheTTL > 0) {
      const age = Date.now() - new Date(cached.timestamp).getTime();
      const maxAge = llmConfig.embeddings.cacheTTL * 1000; // Convert seconds to ms

      if (age > maxAge) {
        // Cache entry expired
        this.cache.delete(key);
        return null;
      }
    }

    // Cache hit!
    this.stats.cacheHits++;
    this.stats.totalRequests++;

    return cached.embedding;
  }

  /**
   * Cache an embedding
   * 
   * Store embedding with metadata for future use.
   * 
   * METADATA STORED:
   * - embedding: The vector itself
   * - text: Original text (helps with debugging)
   * - model: Model used (important for cache validity)
   * - timestamp: When generated (for TTL)
   * 
   * @param {string} text - Original text
   * @param {Array<number>} embedding - Embedding vector
   * @param {string} model - Model name
   */
  async cacheEmbedding(text, embedding, model = this.model) {
    // Skip if caching disabled
    if (!llmConfig.embeddings.cacheEnabled) {
      return;
    }

    const key = this.getCacheKey(text, model);

    // Store in cache
    this.cache.set(key, {
      embedding,
      text: text.substring(0, 200), // Store first 200 chars for debugging
      model,
      timestamp: new Date().toISOString(),
    });

    // Persist to disk
    // LEARNING NOTE: We save after each new embedding (write-through)
    // In production, you might batch saves or use write-back for performance
    await this.saveCache();
  }

  /**
   * Clear cache
   * 
   * Useful for:
   * - Testing
   * - Switching models
   * - Clearing corrupted data
   * - Managing storage
   */
  async clearCache() {
    this.cache.clear();
    await this.saveCache();
    
    // Reset statistics
    this.stats = {
      cacheHits: 0,
      cacheMisses: 0,
      totalRequests: 0,
      totalTokens: 0,
      totalCost: 0,
    };

    console.log('[EmbeddingService] Cache cleared');
  }

  /**
   * Get statistics about embedding service usage
   * 
   * Useful for:
   * - Monitoring performance
   * - Understanding cache effectiveness
   * - Cost analysis
   * - Optimization decisions
   * 
   * @returns {Object} Statistics
   */
  getStats() {
    const cacheHitRate = this.stats.totalRequests > 0
      ? (this.stats.cacheHits / this.stats.totalRequests * 100).toFixed(1)
      : '0.0';

    return {
      ...this.stats,
      cacheHitRate: `${cacheHitRate}%`,
      cacheSize: this.cache.size,
      avgTokensPerRequest: this.stats.totalRequests > 0
        ? Math.round(this.stats.totalTokens / this.stats.totalRequests)
        : 0,
    };
  }

  /**
   * Get formatted statistics summary
   * 
   * @returns {string} Human-readable summary
   */
  getStatsSummary() {
    const stats = this.getStats();
    
    return [
      '=== Embedding Service Statistics ===',
      `Total Requests: ${stats.totalRequests}`,
      `Cache Hits: ${stats.cacheHits} (${stats.cacheHitRate})`,
      `Cache Misses: ${stats.cacheMisses}`,
      `Cache Size: ${stats.cacheSize} embeddings`,
      `Total Tokens: ${stats.totalTokens.toLocaleString()}`,
      `Avg Tokens/Request: ${stats.avgTokensPerRequest}`,
      `Total Cost: $${stats.totalCost.toFixed(4)}`,
    ].join('\n');
  }
}

// Create singleton instance
// LEARNING NOTE: Singleton pattern ensures:
// - Single cache shared across application
// - Consistent statistics
// - No duplicate API calls
const embeddingService = new EmbeddingService();

// Export singleton instance and class
export { embeddingService, EmbeddingService };

// Export convenience functions
export const generateEmbedding = (text, options) => 
  embeddingService.generateEmbedding(text, options);

export const generateEmbeddings = (texts, options) => 
  embeddingService.generateEmbeddings(texts, options);

export const getCachedEmbedding = (text, model) => 
  embeddingService.getCachedEmbedding(text, model);

export const clearCache = () => 
  embeddingService.clearCache();

export const getStats = () => 
  embeddingService.getStats();

export default embeddingService;

/**
 * ============================================================================
 * USAGE EXAMPLES
 * ============================================================================
 * 
 * 1. Generate single embedding:
 * ------------------------------
 * ```javascript
 * import { generateEmbedding } from './embedding_service.js';
 * 
 * const text = "Unterstützung bei der Wohnungssuche";
 * const embedding = await generateEmbedding(text);
 * console.log(`Generated ${embedding.length}-dimensional vector`);
 * // Output: Generated 1536-dimensional vector
 * ```
 * 
 * 2. Generate multiple embeddings (efficient):
 * ---------------------------------------------
 * ```javascript
 * import { generateEmbeddings } from './embedding_service.js';
 * 
 * const documents = [
 *   "Arbeitslosengeld II (Hartz IV)",
 *   "Wohngeld für einkommensschwache Haushalte",
 *   "Kindergeld und Kinderzuschlag"
 * ];
 * 
 * const embeddings = await generateEmbeddings(documents);
 * console.log(`Generated ${embeddings.length} embeddings`);
 * // All 3 generated in single API call (efficient!)
 * ```
 * 
 * 3. Check cache before generating:
 * ---------------------------------
 * ```javascript
 * import { getCachedEmbedding, generateEmbedding } from './embedding_service.js';
 * 
 * const text = "Bürgergeld";
 * 
 * // Try cache first
 * let embedding = await getCachedEmbedding(text);
 * 
 * if (!embedding) {
 *   console.log('Cache miss, generating...');
 *   embedding = await generateEmbedding(text);
 * } else {
 *   console.log('Cache hit! No API call needed.');
 * }
 * ```
 * 
 * 4. Monitor usage and costs:
 * ---------------------------
 * ```javascript
 * import { embeddingService } from './embedding_service.js';
 * 
 * // Generate some embeddings...
 * await embeddingService.generateEmbeddings(texts);
 * 
 * // Check statistics
 * console.log(embeddingService.getStatsSummary());
 * 
 * // Output:
 * // === Embedding Service Statistics ===
 * // Total Requests: 100
 * // Cache Hits: 45 (45.0%)
 * // Cache Misses: 55
 * // Cache Size: 55 embeddings
 * // Total Tokens: 8,932
 * // Avg Tokens/Request: 89
 * // Total Cost: $0.0002
 * ```
 * 
 * 5. Clear cache when needed:
 * ---------------------------
 * ```javascript
 * import { clearCache } from './embedding_service.js';
 * 
 * // Switch to a different model
 * await clearCache();
 * console.log('Cache cleared, ready for new model');
 * ```
 * 
 * 6. Custom model:
 * ----------------
 * ```javascript
 * import { generateEmbedding } from './embedding_service.js';
 * 
 * // Use larger model for better quality
 * const embedding = await generateEmbedding(text, {
 *   model: 'text-embedding-3-large'
 * });
 * ```
 * 
 * ============================================================================
 * LEARNING EXERCISE
 * ============================================================================
 * 
 * Try this experiment to understand semantic similarity:
 * 
 * ```javascript
 * import { generateEmbeddings } from './embedding_service.js';
 * 
 * const texts = [
 *   "I am very happy today",
 *   "I am feeling joyful",
 *   "I am extremely sad",
 *   "The cat sat on the mat"
 * ];
 * 
 * const embeddings = await generateEmbeddings(texts);
 * 
 * // Manually calculate cosine similarity between texts 0 and 1
 * // (similar meaning: "happy" and "joyful")
 * // You should see high similarity!
 * 
 * // Then compare texts 0 and 2 (opposite meaning: "happy" and "sad")
 * // You should see low similarity!
 * 
 * // See vector_store.js for cosine similarity implementation
 * ```
 */
