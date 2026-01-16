/**
 * Systemfehler - Semantic Search Module
 * 
 * This module provides high-level semantic search functionality over entries.
 * It combines embedding generation with vector similarity search to enable
 * intelligent, meaning-based content discovery.
 * 
 * ============================================================================
 * WHAT IS SEMANTIC SEARCH?
 * ============================================================================
 * 
 * TRADITIONAL KEYWORD SEARCH:
 * ---------------------------
 * Matches exact words or word stems.
 * 
 * Query: "affordable housing help"
 * Matches:
 *   ✓ "affordable housing assistance program"
 *   ✓ "help with affordable housing"
 * Misses:
 *   ✗ "low-cost apartment support"        (different words, same meaning)
 *   ✗ "rental subsidy for low-income"     (synonyms not matched)
 *   ✗ "cheap accommodation aid"           (completely different terms)
 * 
 * SEMANTIC SEARCH:
 * ----------------
 * Matches meaning, not just words.
 * 
 * Query: "affordable housing help"
 * Matches ALL of the above because:
 *   - "affordable" ≈ "low-cost" ≈ "cheap"
 *   - "housing" ≈ "apartment" ≈ "accommodation"
 *   - "help" ≈ "assistance" ≈ "support" ≈ "aid"
 * 
 * HOW IT WORKS:
 * -------------
 * 1. Convert query to embedding vector
 * 2. Compare with pre-computed document embeddings
 * 3. Return documents with similar vectors
 * 4. Rank by similarity score
 * 
 * ============================================================================
 * SEMANTIC SEARCH VS KEYWORD SEARCH
 * ============================================================================
 * 
 * COMPARISON TABLE:
 * -----------------
 * 
 * Feature              | Keyword Search      | Semantic Search
 * ---------------------|--------------------|-----------------
 * Matching             | Exact words        | Meaning
 * Synonyms             | Manual thesaurus   | Automatic
 * Typo tolerance       | Limited            | Good
 * Multi-language       | Separate indexes   | Unified (with multilingual models)
 * Context understanding| No                 | Yes
 * Setup complexity     | Low                | Medium
 * Query speed          | Very fast          | Fast
 * Index size           | Small              | Large
 * 
 * WHEN TO USE WHICH:
 * ------------------
 * 
 * Use KEYWORD search when:
 * - Exact terms matter (product codes, IDs, names)
 * - Speed is critical (milliseconds matter)
 * - Dataset is small
 * - Users know exact terminology
 * 
 * Use SEMANTIC search when:
 * - Users search by description
 * - Synonyms are common
 * - Natural language queries
 * - Content in multiple languages
 * - Want to understand user intent
 * 
 * Use BOTH (hybrid search) when:
 * - You want best of both worlds
 * - Combine exact match bonuses with semantic relevance
 * - Professional systems (Elasticsearch + vector search)
 * 
 * ============================================================================
 * HYBRID SEARCH APPROACHES
 * ============================================================================
 * 
 * Hybrid search combines multiple search strategies for better results.
 * 
 * 1. KEYWORD + SEMANTIC (most common)
 * -----------------------------------
 * - Run both keyword and semantic search
 * - Combine results with weighted scores
 * - Boost exact matches while finding related content
 * 
 * Example weights:
 *   final_score = 0.3 × keyword_score + 0.7 × semantic_score
 * 
 * 2. RERANKING
 * ------------
 * - First pass: Fast keyword search (get 100 candidates)
 * - Second pass: Semantic reranking (reorder top 100)
 * - Fast but accurate
 * 
 * 3. METADATA FILTERING + SEMANTIC
 * --------------------------------
 * - Filter by structured fields (date, category, type)
 * - Then semantic search within filtered results
 * - Precise control with semantic relevance
 * 
 * 4. QUERY EXPANSION
 * ------------------
 * - Generate synonyms/related terms
 * - Search for all variations
 * - Combine results
 * 
 * IMPLEMENTATION STRATEGIES:
 * --------------------------
 * 
 * Simple (our implementation):
 * ```javascript
 * const keywordResults = keywordSearch(query);
 * const semanticResults = semanticSearch(query);
 * const combined = mergeAndRank(keywordResults, semanticResults);
 * ```
 * 
 * Production (Elasticsearch + vectors):
 * ```javascript
 * const results = await elasticsearch.search({
 *   query: {
 *     bool: {
 *       should: [
 *         { match: { content: query } },           // keyword
 *         { knn: { vector: queryEmbedding } }      // semantic
 *       ]
 *     }
 *   }
 * });
 * ```
 * 
 * ============================================================================
 * RELEVANCE SCORING
 * ============================================================================
 * 
 * How do we determine if a result is "relevant"?
 * 
 * FACTORS:
 * --------
 * 1. Vector similarity (primary)
 *    - Cosine similarity between query and document
 *    - Range: 0-1
 * 
 * 2. Recency
 *    - Newer content might be more relevant
 *    - Decay function: score × (1 - age_factor)
 * 
 * 3. Popularity
 *    - View count, rating, etc.
 *    - Boost: score × (1 + log(views))
 * 
 * 4. Exact match bonus
 *    - If query terms appear exactly
 *    - Boost: score × 1.2
 * 
 * 5. Field boosting
 *    - Title matches more important than body
 *    - title: 2.0, description: 1.5, body: 1.0
 * 
 * SCORING FORMULA EXAMPLE:
 * ------------------------
 * ```
 * final_score = 
 *   base_similarity × 
 *   (1 - recency_decay) × 
 *   (1 + log(popularity)) × 
 *   exact_match_multiplier × 
 *   field_weight
 * ```
 * 
 * LEARNING NOTE: Start simple (just cosine similarity).
 * Add complexity only when you measure need for it.
 * 
 * ============================================================================
 * CONTEXT RETRIEVAL STRATEGIES
 * ============================================================================
 * 
 * For RAG (Retrieval-Augmented Generation), how much context to retrieve?
 * 
 * STRATEGIES:
 * -----------
 * 
 * 1. TOP-K RETRIEVAL (our default)
 * --------------------------------
 * - Return top K most similar documents
 * - Simple, predictable
 * - K typically 3-10
 * 
 * Pros: Simple, fast
 * Cons: Fixed count regardless of relevance
 * 
 * 2. THRESHOLD-BASED
 * ------------------
 * - Return all above similarity threshold
 * - Variable result count
 * - Threshold typically 0.7-0.8
 * 
 * Pros: Only relevant results
 * Cons: Might return 0 or 100 results
 * 
 * 3. ADAPTIVE (TOP-K + THRESHOLD)
 * ------------------------------
 * - Return up to K results
 * - But only if above threshold
 * - Best of both worlds
 * 
 * Pros: Bounded count, quality guaranteed
 * Cons: Slightly more complex
 * 
 * 4. MMR (Maximal Marginal Relevance)
 * -----------------------------------
 * - Select diverse results
 * - Balance relevance vs. diversity
 * - Avoid redundant similar documents
 * 
 * Algorithm:
 * 1. Pick most relevant document
 * 2. For remaining, pick document that is:
 *    - Relevant to query
 *    - Different from already selected
 * 3. Repeat until K documents
 * 
 * Formula:
 * ```
 * MMR = λ × sim(doc, query) - (1-λ) × max(sim(doc, selected))
 * ```
 * 
 * 5. HIERARCHICAL
 * ---------------
 * - First find relevant sections
 * - Then get surrounding context
 * - Useful for long documents
 * 
 * CHOOSING A STRATEGY:
 * --------------------
 * - QA systems: Top-K (3-5 documents)
 * - Summarization: More context (10-20 documents)
 * - Citation: Threshold-based (only high-confidence)
 * - Diverse viewpoints: MMR
 * 
 * ============================================================================
 * CHUNKING STRATEGIES
 * ============================================================================
 * 
 * Long documents must be split into chunks for embedding.
 * 
 * WHY CHUNK?
 * ----------
 * - Embedding models have token limits (8192 for text-embedding-3-small)
 * - Smaller chunks = more precise matching
 * - "The cat sat on the mat" in a 10,000 word document
 *   → Better to find the specific paragraph with this text
 * 
 * STRATEGIES:
 * -----------
 * 
 * 1. FIXED SIZE (simple)
 * ----------------------
 * - Split every N characters/tokens
 * - Example: 500 tokens per chunk
 * 
 * Pros: Simple, predictable
 * Cons: May split sentences, lose context
 * 
 * 2. SENTENCE-BASED
 * -----------------
 * - Keep sentences together
 * - Combine until reaching target size
 * 
 * Pros: Semantic units preserved
 * Cons: Variable chunk size
 * 
 * 3. PARAGRAPH-BASED
 * ------------------
 * - Use natural document structure
 * - One or more paragraphs per chunk
 * 
 * Pros: Logical boundaries
 * Cons: Very variable sizes
 * 
 * 4. SLIDING WINDOW (best quality)
 * --------------------------------
 * - Overlapping chunks
 * - Example: 500 tokens, 100 token overlap
 * 
 * Chunk 1: tokens 0-500
 * Chunk 2: tokens 400-900
 * Chunk 3: tokens 800-1300
 * 
 * Pros: Context preserved across boundaries
 * Cons: More chunks (more storage, more cost)
 * 
 * 5. SEMANTIC CHUNKING (advanced)
 * -------------------------------
 * - Embed sentences
 * - Group similar sentences together
 * - Split where similarity drops
 * 
 * Pros: Semantically coherent chunks
 * Cons: Expensive to compute
 * 
 * RECOMMENDATIONS:
 * ----------------
 * - Start with: Fixed size with sentence boundaries
 * - Chunk size: 200-500 tokens (balance precision vs context)
 * - Overlap: 10-20% for important documents
 * - Store original document ID in chunk metadata
 * 
 * @see embedding_service.js for embedding generation
 * @see vector_store.js for similarity search
 * @see ../llm/llm_config.js for configuration
 */

import { generateEmbedding, generateEmbeddings } from './embedding_service.js';
import { VectorStore } from './vector_store.js';
import { llmConfig } from '../llm/llm_config.js';
import { countTokens } from '../llm/token_utils.js';

/**
 * SemanticSearch class
 * 
 * High-level interface for semantic search over entries.
 * 
 * ARCHITECTURE:
 * -------------
 * - Embedding Service: Converts text → vectors
 * - Vector Store: Stores and searches vectors
 * - This class: Orchestrates the workflow
 * 
 * WORKFLOW:
 * ---------
 * Indexing:
 *   Entry → Extract text → Generate embedding → Store in vector store
 * 
 * Searching:
 *   Query → Generate embedding → Search vector store → Rank results → Return
 */
class SemanticSearch {
  constructor(options = {}) {
    // Initialize vector store
    // LEARNING NOTE: We create a new VectorStore instance
    // Could also use singleton from vector_store.js
    this.vectorStore = options.vectorStore || new VectorStore({
      path: options.storePath || llmConfig.vectorStore.path,
    });

    // Track indexing progress
    this.indexingStats = {
      totalIndexed: 0,
      totalFailed: 0,
      lastIndexed: null,
    };

    // Load vector store from disk
    // LEARNING NOTE: Lazy loading - we'll load when first needed
    this.loaded = false;
  }

  /**
   * Ensure vector store is loaded
   */
  async ensureLoaded() {
    if (!this.loaded) {
      await this.vectorStore.load();
      this.loaded = true;
    }
  }

  /**
   * Index a single entry for semantic search
   * 
   * LEARNING NOTE: Indexing prepares content for search by:
   * 1. Extracting relevant text
   * 2. Generating embedding
   * 3. Storing in vector store with metadata
   * 
   * WHAT TO INDEX:
   * --------------
   * For best results, index the most descriptive text:
   * - Title + description (often best)
   * - Just description (if title is generic)
   * - Full content (if short)
   * - Summary (if very long)
   * 
   * METADATA:
   * ---------
   * Store useful information for:
   * - Filtering (type, category, date)
   * - Display (title, URL, snippet)
   * - Debugging (when indexed, chunk info)
   * 
   * @param {Object} entry - Entry to index
   * @param {string} entry.id - Unique identifier
   * @param {string} entry.title - Entry title
   * @param {string} entry.description - Entry description
   * @param {Object} entry.metadata - Additional metadata
   * @param {Object} options - Indexing options
   * @param {string} options.textField - Which field(s) to embed
   * @returns {Promise<boolean>} Success status
   */
  async indexEntry(entry, options = {}) {
    // Ensure store is loaded
    await this.ensureLoaded();

    // Validate entry
    if (!entry || !entry.id) {
      console.error('[SemanticSearch] Entry must have an id');
      this.indexingStats.totalFailed++;
      return false;
    }

    try {
      // Extract text to embed
      // LEARNING NOTE: Combine multiple fields for richer context
      // Format matters: "Title: X. Description: Y" vs "X Y"
      let textToEmbed;
      
      if (options.textField) {
        // Use specified field
        textToEmbed = entry[options.textField];
      } else {
        // Default: combine title and description
        // LEARNING NOTE: Including field labels helps model understand structure
        const parts = [];
        if (entry.title) {
          parts.push(`Title: ${entry.title}`);
        }
        if (entry.description) {
          parts.push(`Description: ${entry.description}`);
        }
        if (entry.content && (!entry.description || entry.description.length < 100)) {
          // Include content if no description or description is short
          parts.push(`Content: ${entry.content}`);
        }
        textToEmbed = parts.join('\n\n');
      }

      if (!textToEmbed || textToEmbed.trim().length === 0) {
        console.warn(`[SemanticSearch] Entry ${entry.id} has no text to index`);
        this.indexingStats.totalFailed++;
        return false;
      }

      // Check token count
      // LEARNING NOTE: Embedding models have limits (8192 tokens for text-embedding-3-small)
      const tokenCount = countTokens(textToEmbed);
      const maxTokens = 8000; // Leave some margin

      if (tokenCount > maxTokens) {
        console.warn(
          `[SemanticSearch] Entry ${entry.id} has ${tokenCount} tokens, ` +
          `truncating to ${maxTokens}`
        );
        // In production, implement proper chunking instead of truncation
        // See CHUNKING STRATEGIES in module documentation
        textToEmbed = textToEmbed.substring(0, Math.floor(textToEmbed.length * (maxTokens / tokenCount)));
      }

      // Generate embedding
      const embedding = await generateEmbedding(textToEmbed);

      // Prepare metadata
      // LEARNING NOTE: Store everything needed for display and filtering
      const metadata = {
        title: entry.title || 'Untitled',
        description: entry.description?.substring(0, 200) || '', // Store snippet
        type: entry.type || 'unknown',
        url: entry.url || null,
        indexedAt: new Date().toISOString(),
        tokenCount,
        // Include any custom metadata
        ...entry.metadata,
      };

      // Add to vector store
      this.vectorStore.addVector(entry.id, embedding, metadata);

      // Update statistics
      this.indexingStats.totalIndexed++;
      this.indexingStats.lastIndexed = new Date().toISOString();

      return true;

    } catch (error) {
      console.error(`[SemanticSearch] Failed to index entry ${entry.id}:`, error);
      this.indexingStats.totalFailed++;
      return false;
    }
  }

  /**
   * Index multiple entries efficiently
   * 
   * LEARNING NOTE: Batch indexing is much faster than individual indexing:
   * - Single API call for embeddings (batch processing)
   * - Amortized overhead
   * - Progress tracking
   * 
   * @param {Array<Object>} entries - Entries to index
   * @param {Object} options - Indexing options
   * @param {Function} options.onProgress - Progress callback
   * @returns {Promise<Object>} Result summary
   */
  async indexAllEntries(entries, options = {}) {
    // Ensure store is loaded
    await this.ensureLoaded();

    console.log(`[SemanticSearch] Indexing ${entries.length} entries...`);

    const startTime = Date.now();
    let successCount = 0;
    let failCount = 0;

    // Extract all texts first
    // LEARNING NOTE: Process in phases:
    // 1. Extract all texts (fast, no API calls)
    // 2. Generate all embeddings in batch (one API call)
    // 3. Store all vectors (fast, local operation)
    const textsToEmbed = [];
    const validEntries = [];

    for (const entry of entries) {
      // Validate and extract text (same logic as indexEntry)
      if (!entry || !entry.id) {
        failCount++;
        continue;
      }

      let textToEmbed;
      if (options.textField) {
        textToEmbed = entry[options.textField];
      } else {
        const parts = [];
        if (entry.title) parts.push(`Title: ${entry.title}`);
        if (entry.description) parts.push(`Description: ${entry.description}`);
        if (entry.content && (!entry.description || entry.description.length < 100)) {
          parts.push(`Content: ${entry.content}`);
        }
        textToEmbed = parts.join('\n\n');
      }

      if (!textToEmbed || textToEmbed.trim().length === 0) {
        failCount++;
        continue;
      }

      // Check and truncate if needed
      const tokenCount = countTokens(textToEmbed);
      if (tokenCount > 8000) {
        textToEmbed = textToEmbed.substring(0, Math.floor(textToEmbed.length * (8000 / tokenCount)));
      }

      textsToEmbed.push(textToEmbed);
      validEntries.push(entry);
    }

    // Generate embeddings in batch
    // LEARNING NOTE: This is where batch processing shines
    // 100 entries → 1 API call instead of 100
    try {
      const embeddings = await generateEmbeddings(textsToEmbed);

      // Store all vectors
      for (let i = 0; i < embeddings.length; i++) {
        const entry = validEntries[i];
        const embedding = embeddings[i];

        if (!embedding) {
          failCount++;
          continue;
        }

        const metadata = {
          title: entry.title || 'Untitled',
          description: entry.description?.substring(0, 200) || '',
          type: entry.type || 'unknown',
          url: entry.url || null,
          indexedAt: new Date().toISOString(),
          ...entry.metadata,
        };

        this.vectorStore.addVector(entry.id, embedding, metadata);
        successCount++;

        // Progress callback
        if (options.onProgress) {
          options.onProgress({
            current: successCount + failCount,
            total: entries.length,
            success: successCount,
            failed: failCount,
          });
        }
      }

      // Save vector store
      await this.vectorStore.save();

      // Update statistics
      this.indexingStats.totalIndexed += successCount;
      this.indexingStats.totalFailed += failCount;
      this.indexingStats.lastIndexed = new Date().toISOString();

      const duration = Date.now() - startTime;

      console.log(
        `[SemanticSearch] Indexed ${successCount} entries in ${duration}ms ` +
        `(${failCount} failed)`
      );

      return {
        success: successCount,
        failed: failCount,
        total: entries.length,
        durationMs: duration,
        entriesPerSecond: (successCount / (duration / 1000)).toFixed(2),
      };

    } catch (error) {
      console.error('[SemanticSearch] Batch indexing failed:', error);
      throw error;
    }
  }

  /**
   * Search entries semantically
   * 
   * This is the main search function users will call.
   * 
   * WORKFLOW:
   * ---------
   * 1. Generate embedding for query
   * 2. Search vector store
   * 3. Apply filters
   * 4. Rerank if needed
   * 5. Format results
   * 
   * OPTIONS:
   * --------
   * @param {string} query - Search query
   * @param {Object} options - Search options
   * @param {number} options.topK - Number of results (default: 10)
   * @param {number} options.minSimilarity - Minimum similarity threshold (default: 0.7)
   * @param {Object} options.filter - Metadata filter
   * @param {boolean} options.rerank - Apply reranking (default: false)
   * @param {boolean} options.includeScores - Include similarity scores (default: true)
   * 
   * @returns {Promise<Array>} Search results
   */
  async searchEntries(query, options = {}) {
    // Ensure store is loaded
    await this.ensureLoaded();

    // Validate query
    if (!query || typeof query !== 'string') {
      throw new Error('Query must be a non-empty string');
    }

    query = query.trim();
    if (query.length === 0) {
      throw new Error('Query cannot be empty');
    }

    // Parse options
    const topK = options.topK || llmConfig.vectorStore.maxResults || 10;
    const minSimilarity = options.minSimilarity ?? llmConfig.vectorStore.minSimilarity ?? 0.7;
    const filter = options.filter || null;
    const rerank = options.rerank || false;
    const includeScores = options.includeScores ?? true;

    try {
      // Step 1: Generate query embedding
      // LEARNING NOTE: Query embedding should use same model as indexed documents
      const startTime = Date.now();
      const queryEmbedding = await generateEmbedding(query);
      const embeddingTime = Date.now() - startTime;

      // Step 2: Search vector store
      const searchStartTime = Date.now();
      const results = this.vectorStore.search(
        queryEmbedding,
        rerank ? topK * 2 : topK, // Get more if reranking
        minSimilarity,
        filter
      );
      const searchTime = Date.now() - searchStartTime;

      // Step 3: Rerank if requested
      // LEARNING NOTE: Reranking can improve quality by considering factors
      // beyond just vector similarity
      let finalResults = results;
      if (rerank && results.length > 0) {
        finalResults = this.rerankResults(query, results, topK);
      }

      // Step 4: Format results
      const formattedResults = finalResults.map(result => {
        const formatted = {
          id: result.id,
          title: result.metadata.title,
          description: result.metadata.description,
          type: result.metadata.type,
          url: result.metadata.url,
        };

        // Include similarity score if requested
        if (includeScores) {
          formatted.similarity = result.similarity;
          formatted.similarityPercent = `${(result.similarity * 100).toFixed(1)}%`;
        }

        return formatted;
      });

      // Log search statistics
      if (llmConfig.logging.level === 'debug') {
        console.log(
          `[SemanticSearch] Query: "${query}" | ` +
          `Embedding: ${embeddingTime}ms | ` +
          `Search: ${searchTime}ms | ` +
          `Results: ${formattedResults.length}`
        );
      }

      return formattedResults;

    } catch (error) {
      console.error('[SemanticSearch] Search failed:', error);
      throw new Error(`Search failed: ${error.message}`);
    }
  }

  /**
   * Rerank search results
   * 
   * LEARNING NOTE: Reranking improves result quality by considering additional factors.
   * 
   * FACTORS CONSIDERED:
   * -------------------
   * 1. Exact match bonus: Query terms appear exactly
   * 2. Recency: Newer content scores higher
   * 3. Title match: Title matches more important than description
   * 4. Length: Penalize very short results
   * 
   * This is a simple implementation. Production systems use:
   * - ML-based rerankers (e.g., cross-encoders)
   * - User behavior signals (clicks, dwell time)
   * - Business rules (featured content, sponsored)
   * 
   * @param {string} query - Original query
   * @param {Array} results - Initial results
   * @param {number} topK - Number to return
   * @returns {Array} Reranked results
   */
  rerankResults(query, results, topK) {
    // Normalize query for comparison
    const queryLower = query.toLowerCase();
    const queryTerms = queryLower.split(/\s+/);

    // Calculate enhanced score for each result
    const scoredResults = results.map(result => {
      let score = result.similarity; // Start with vector similarity

      // Factor 1: Exact match bonus
      // LEARNING NOTE: Boost results that contain query terms
      const titleLower = (result.metadata.title || '').toLowerCase();
      const descLower = (result.metadata.description || '').toLowerCase();
      
      let exactMatches = 0;
      for (const term of queryTerms) {
        if (titleLower.includes(term)) exactMatches += 2; // Title worth more
        else if (descLower.includes(term)) exactMatches += 1;
      }
      
      if (exactMatches > 0) {
        score *= (1 + 0.1 * exactMatches); // 10% boost per match
      }

      // Factor 2: Recency bonus
      // LEARNING NOTE: Newer content might be more relevant
      if (result.metadata.indexedAt) {
        const age = Date.now() - new Date(result.metadata.indexedAt).getTime();
        const daysSinceIndexed = age / (1000 * 60 * 60 * 24);
        
        // Decay over 365 days
        if (daysSinceIndexed < 365) {
          const recencyBonus = 1 - (daysSinceIndexed / 365) * 0.1; // Up to 10% boost
          score *= recencyBonus;
        }
      }

      // Factor 3: Length penalty for very short results
      // LEARNING NOTE: Very short results might lack context
      const titleLength = (result.metadata.title || '').length;
      const descLength = (result.metadata.description || '').length;
      
      if (titleLength + descLength < 50) {
        score *= 0.9; // 10% penalty
      }

      return {
        ...result,
        rerankScore: score,
      };
    });

    // Sort by rerank score
    scoredResults.sort((a, b) => b.rerankScore - a.rerankScore);

    // Return top K
    return scoredResults.slice(0, topK);
  }

  /**
   * Find similar entries to a given entry
   * 
   * LEARNING NOTE: "More like this" functionality.
   * Useful for:
   * - Recommendations: "Users who viewed this also viewed..."
   * - Related content: "See also..."
   * - Duplicate detection: "Is this similar to existing entries?"
   * 
   * @param {string} entryId - ID of entry to find similar to
   * @param {number} topK - Number of results
   * @returns {Promise<Array>} Similar entries
   */
  async findSimilarEntries(entryId, topK = 5) {
    await this.ensureLoaded();

    // Get the entry's vector
    const entry = this.vectorStore.get(entryId);
    
    if (!entry) {
      throw new Error(`Entry ${entryId} not found in vector store`);
    }

    // Search using this vector
    const results = this.vectorStore.search(
      entry.vector,
      topK + 1, // +1 because original entry will match itself
      0.0 // No minimum similarity for "similar" search
    );

    // Remove the original entry from results
    const filtered = results.filter(r => r.id !== entryId);

    // Format results
    return filtered.slice(0, topK).map(result => ({
      id: result.id,
      title: result.metadata.title,
      similarity: result.similarity,
      similarityPercent: `${(result.similarity * 100).toFixed(1)}%`,
    }));
  }

  /**
   * Get search statistics
   * 
   * @returns {Object} Statistics about the search index
   */
  getSearchStats() {
    return {
      indexing: { ...this.indexingStats },
      vectorStore: this.vectorStore.getStats(),
      totalEntries: this.vectorStore.size(),
    };
  }

  /**
   * Get formatted statistics summary
   * 
   * @returns {string} Human-readable summary
   */
  getSearchStatsSummary() {
    const stats = this.getSearchStats();
    
    return [
      '=== Semantic Search Statistics ===',
      '',
      'Indexing:',
      `  Total Indexed: ${stats.indexing.totalIndexed}`,
      `  Total Failed: ${stats.indexing.totalFailed}`,
      `  Last Indexed: ${stats.indexing.lastIndexed || 'Never'}`,
      '',
      'Vector Store:',
      `  Total Entries: ${stats.totalEntries}`,
      `  Dimensions: ${stats.vectorStore.dimensions || 'N/A'}`,
      `  Total Searches: ${stats.vectorStore.totalSearches}`,
      `  Avg Search Time: ${stats.vectorStore.avgSearchTimeMs.toFixed(2)}ms`,
      `  Memory Usage: ${stats.vectorStore.sizeInMemory}`,
    ].join('\n');
  }

  /**
   * Clear the search index
   * 
   * Useful for:
   * - Reindexing from scratch
   * - Testing
   * - Switching embedding models
   */
  async clearIndex() {
    await this.ensureLoaded();
    this.vectorStore.clear();
    await this.vectorStore.save();
    
    this.indexingStats = {
      totalIndexed: 0,
      totalFailed: 0,
      lastIndexed: null,
    };

    console.log('[SemanticSearch] Index cleared');
  }

  /**
   * Save the search index to disk
   */
  async saveIndex() {
    await this.ensureLoaded();
    await this.vectorStore.save();
  }
}

// Export class
export { SemanticSearch };

// Export convenience instance
export const semanticSearch = new SemanticSearch();

export default semanticSearch;

/**
 * ============================================================================
 * USAGE EXAMPLES
 * ============================================================================
 * 
 * 1. Index entries for search:
 * ----------------------------
 * ```javascript
 * import { semanticSearch } from './semantic_search.js';
 * 
 * const entries = [
 *   {
 *     id: 'benefit-1',
 *     title: 'Arbeitslosengeld II (Bürgergeld)',
 *     description: 'Finanzielle Unterstützung für Arbeitsuchende',
 *     type: 'benefit',
 *     url: 'https://...'
 *   },
 *   {
 *     id: 'benefit-2',
 *     title: 'Wohngeld',
 *     description: 'Zuschuss zu Wohnkosten für einkommensschwache Haushalte',
 *     type: 'benefit',
 *     url: 'https://...'
 *   }
 * ];
 * 
 * // Index all entries (efficient batch processing)
 * const result = await semanticSearch.indexAllEntries(entries, {
 *   onProgress: (progress) => {
 *     console.log(`Progress: ${progress.current}/${progress.total}`);
 *   }
 * });
 * 
 * console.log(`Indexed ${result.success} entries in ${result.durationMs}ms`);
 * ```
 * 
 * 2. Search semantically:
 * -----------------------
 * ```javascript
 * import { semanticSearch } from './semantic_search.js';
 * 
 * // User's natural language query
 * const query = 'Hilfe bei der Miete für Menschen mit wenig Geld';
 * 
 * const results = await semanticSearch.searchEntries(query, {
 *   topK: 5,              // Return top 5 results
 *   minSimilarity: 0.7,   // Only results above 70% similarity
 * });
 * 
 * console.log('Search results:');
 * for (const result of results) {
 *   console.log(`${result.similarityPercent} - ${result.title}`);
 *   console.log(`  ${result.description}`);
 *   console.log(`  URL: ${result.url}\n`);
 * }
 * 
 * // Output:
 * // 92.3% - Wohngeld
 * //   Zuschuss zu Wohnkosten für einkommensschwache Haushalte
 * //   URL: https://...
 * //
 * // 85.1% - Arbeitslosengeld II (Bürgergeld)
 * //   Finanzielle Unterstützung für Arbeitsuchende
 * //   URL: https://...
 * ```
 * 
 * 3. Filter by metadata:
 * ----------------------
 * ```javascript
 * // Only search within benefits (not tools or organizations)
 * const results = await semanticSearch.searchEntries(query, {
 *   filter: { type: 'benefit' }
 * });
 * ```
 * 
 * 4. Find similar entries:
 * ------------------------
 * ```javascript
 * // Find entries similar to a specific one
 * const similar = await semanticSearch.findSimilarEntries('benefit-1', 5);
 * 
 * console.log('Similar to "Arbeitslosengeld II":');
 * for (const entry of similar) {
 *   console.log(`${entry.similarityPercent} - ${entry.title}`);
 * }
 * ```
 * 
 * 5. Rerank for better quality:
 * ------------------------------
 * ```javascript
 * // Use reranking to boost exact matches and recent content
 * const results = await semanticSearch.searchEntries(query, {
 *   topK: 10,
 *   rerank: true  // Apply reranking
 * });
 * ```
 * 
 * 6. Monitor performance:
 * -----------------------
 * ```javascript
 * console.log(semanticSearch.getSearchStatsSummary());
 * 
 * // Output:
 * // === Semantic Search Statistics ===
 * //
 * // Indexing:
 * //   Total Indexed: 1000
 * //   Total Failed: 5
 * //   Last Indexed: 2024-01-16T10:30:00.000Z
 * //
 * // Vector Store:
 * //   Total Entries: 1000
 * //   Dimensions: 1536
 * //   Total Searches: 150
 * //   Avg Search Time: 12.45ms
 * //   Memory Usage: 12.29 MB
 * ```
 * 
 * 7. Clear and reindex:
 * ---------------------
 * ```javascript
 * // Clear existing index
 * await semanticSearch.clearIndex();
 * 
 * // Reindex with new entries or different model
 * await semanticSearch.indexAllEntries(newEntries);
 * ```
 * 
 * ============================================================================
 * COMPLETE EXAMPLE: Building a Search UI
 * ============================================================================
 * 
 * ```javascript
 * import { semanticSearch } from './semantic_search.js';
 * import readline from 'readline';
 * 
 * // Setup
 * const rl = readline.createInterface({
 *   input: process.stdin,
 *   output: process.stdout
 * });
 * 
 * // Load existing index
 * await semanticSearch.vectorStore.load();
 * 
 * console.log('Semantic Search Ready!');
 * console.log(semanticSearch.getSearchStatsSummary());
 * console.log('\nEnter your search query (or "quit" to exit):\n');
 * 
 * // Search loop
 * rl.on('line', async (query) => {
 *   if (query.toLowerCase() === 'quit') {
 *     rl.close();
 *     return;
 *   }
 * 
 *   if (!query.trim()) {
 *     return;
 *   }
 * 
 *   try {
 *     // Search
 *     const startTime = Date.now();
 *     const results = await semanticSearch.searchEntries(query, {
 *       topK: 5,
 *       minSimilarity: 0.6,
 *       rerank: true
 *     });
 *     const duration = Date.now() - startTime;
 * 
 *     // Display results
 *     console.log(`\nFound ${results.length} results in ${duration}ms:\n`);
 * 
 *     if (results.length === 0) {
 *       console.log('No results found. Try a different query.');
 *     } else {
 *       for (let i = 0; i < results.length; i++) {
 *         const result = results[i];
 *         console.log(`${i + 1}. [${result.similarityPercent}] ${result.title}`);
 *         console.log(`   ${result.description}`);
 *         if (result.url) {
 *           console.log(`   🔗 ${result.url}`);
 *         }
 *         console.log();
 *       }
 *     }
 * 
 *   } catch (error) {
 *     console.error('Search error:', error.message);
 *   }
 * 
 *   console.log('\nEnter your search query (or "quit" to exit):\n');
 * });
 * ```
 * 
 * ============================================================================
 * LEARNING EXERCISES
 * ============================================================================
 * 
 * 1. Compare keyword vs semantic search:
 * --------------------------------------
 * ```javascript
 * const query = 'cheap apartment help';
 * 
 * // Keyword search (simple string matching)
 * const keywordResults = entries.filter(e => 
 *   e.title.toLowerCase().includes('cheap') ||
 *   e.title.toLowerCase().includes('apartment') ||
 *   e.title.toLowerCase().includes('help')
 * );
 * 
 * // Semantic search
 * const semanticResults = await semanticSearch.searchEntries(query);
 * 
 * // Compare results - semantic should find "Wohngeld" even though
 * // it doesn't contain the words "cheap", "apartment", or "help"
 * ```
 * 
 * 2. Test similarity threshold:
 * -----------------------------
 * ```javascript
 * // Try different thresholds to see effect on results
 * const query = 'housing support';
 * 
 * for (const threshold of [0.5, 0.6, 0.7, 0.8, 0.9]) {
 *   const results = await semanticSearch.searchEntries(query, {
 *     minSimilarity: threshold
 *   });
 *   console.log(`Threshold ${threshold}: ${results.length} results`);
 * }
 * 
 * // Observe: Higher threshold = fewer but more relevant results
 * ```
 * 
 * 3. Measure reranking impact:
 * ----------------------------
 * ```javascript
 * const query = 'Wohngeld';  // Exact term
 * 
 * // Without reranking
 * const basic = await semanticSearch.searchEntries(query, { rerank: false });
 * 
 * // With reranking
 * const reranked = await semanticSearch.searchEntries(query, { rerank: true });
 * 
 * // Compare top result - reranking should boost exact match
 * console.log('Basic top result:', basic[0].title);
 * console.log('Reranked top result:', reranked[0].title);
 * ```
 */
