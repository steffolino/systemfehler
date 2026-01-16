/**
 * Systemfehler - Context Builder Module
 * 
 * This module constructs optimized context for LLM prompts from retrieved documents.
 * It handles context window limits, reranking, and source attribution.
 * 
 * ============================================================================
 * WHAT IS CONTEXT BUILDING?
 * ============================================================================
 * 
 * Context building is the step between retrieval and generation in RAG:
 * 
 * QUERY → RETRIEVAL → CONTEXT BUILDING → LLM GENERATION → ANSWER
 *                     ^^^^^^^^^^^^^^^^
 *                     This module
 * 
 * WHAT IT DOES:
 * -------------
 * 1. Takes retrieved documents (10-100 results)
 * 2. Reranks them for relevance
 * 3. Formats them into a prompt
 * 4. Ensures they fit in context window
 * 5. Adds metadata for citations
 * 
 * INPUT: Array of retrieved documents with similarity scores
 * OUTPUT: Formatted string ready for LLM prompt
 * 
 * ============================================================================
 * WHY CONTEXT BUILDING MATTERS
 * ============================================================================
 * 
 * PROBLEM 1: CONTEXT WINDOW LIMITS
 * ---------------------------------
 * LLMs have finite context windows:
 * - GPT-4o: 128k tokens input
 * - GPT-4o-mini: 128k tokens input
 * - GPT-3.5-turbo: 16k tokens input
 * 
 * A context window includes:
 * - System prompt (~500-1000 tokens)
 * - Retrieved documents (~5000-10000 tokens)
 * - User query (~50-200 tokens)
 * - Conversation history (~0-5000 tokens)
 * 
 * If retrieved docs are too large, we must:
 * - Truncate (lose information)
 * - Summarize (expensive, lossy)
 * - Filter (keep only most relevant)
 * 
 * PROBLEM 2: RELEVANCE ORDERING
 * ------------------------------
 * Vector search returns results by similarity, but:
 * - Similarity ≠ perfect relevance
 * - Position matters (LLMs pay more attention to start/end)
 * - Recent studies show "lost in the middle" effect
 * 
 * Reranking improves quality by considering:
 * - Exact matches
 * - Recency
 * - Document quality signals
 * - Cross-encoder models
 * 
 * PROBLEM 3: INFORMATION DENSITY
 * -------------------------------
 * Not all documents are equally useful:
 * - Some are verbose (low information density)
 * - Some are duplicates (redundant information)
 * - Some are partial (incomplete information)
 * 
 * Goal: Maximize useful information per token
 * 
 * PROBLEM 4: CITATION & ATTRIBUTION
 * ----------------------------------
 * Users need to know:
 * - Where information came from
 * - How to verify it
 * - When it was published
 * 
 * Context must include metadata for citations
 * 
 * ============================================================================
 * CONTEXT BUILDING STRATEGIES
 * ============================================================================
 * 
 * STRATEGY 1: SIMPLE CONCATENATION (baseline)
 * --------------------------------------------
 * Take top K documents, concatenate with separators
 * 
 * ```
 * Document 1:
 * [Title: X]
 * [Content]
 * 
 * Document 2:
 * [Title: Y]
 * [Content]
 * ```
 * 
 * Pros: Simple, fast, transparent
 * Cons: No optimization, may exceed limits
 * 
 * STRATEGY 2: TRUNCATION (our baseline)
 * --------------------------------------
 * Add documents until hitting token limit
 * 
 * Pros: Respects limits, still simple
 * Cons: May cut off important information
 * 
 * STRATEGY 3: SUMMARIZATION
 * -------------------------
 * Summarize each document to fixed length
 * 
 * Pros: Can fit more documents
 * Cons: Expensive, lossy, latency
 * 
 * STRATEGY 4: RERANKING + TRUNCATION (our approach)
 * --------------------------------------------------
 * 1. Rerank by multiple signals
 * 2. Take top documents until limit
 * 
 * Pros: Better quality, respects limits
 * Cons: More complex
 * 
 * STRATEGY 5: HIERARCHICAL CONTEXT
 * --------------------------------
 * - Summaries of all docs (broad coverage)
 * - Full text of top docs (depth)
 * 
 * Pros: Balance breadth and depth
 * Cons: Complex to implement
 * 
 * STRATEGY 6: QUERY-FOCUSED EXTRACTION
 * -------------------------------------
 * Extract only query-relevant passages from each doc
 * 
 * Pros: Maximum relevance per token
 * Cons: May lose context
 * 
 * ============================================================================
 * RERANKING APPROACHES
 * ============================================================================
 * 
 * WHY RERANK?
 * -----------
 * Vector similarity is good but imperfect:
 * - Embeddings capture semantics but not all relevance signals
 * - Recent, authoritative, complete docs should rank higher
 * - Exact matches are strong signals
 * 
 * RERANKING METHODS:
 * ------------------
 * 
 * 1. FEATURE-BASED (our approach)
 * -------------------------------
 * Score = base_similarity × multipliers
 * 
 * Multipliers:
 * - Exact match: +20% if query terms appear
 * - Recency: boost recent documents
 * - Title match: +30% if title matches
 * - Completeness: +10% if document is complete
 * 
 * Pros: Fast, interpretable, tunable
 * Cons: Hand-tuned weights, may not be optimal
 * 
 * 2. LEARNED-TO-RANK
 * ------------------
 * Train ML model on (query, doc, relevance) tuples
 * 
 * Features:
 * - Vector similarity
 * - BM25 score
 * - Document length
 * - Recency
 * - Click-through rate
 * 
 * Pros: Optimal for your data
 * Cons: Requires training data, harder to debug
 * 
 * 3. CROSS-ENCODER RERANKING
 * --------------------------
 * Use BERT-like model to score (query, doc) pairs
 * 
 * Example: MS MARCO cross-encoder
 * - Input: [CLS] query [SEP] document [SEP]
 * - Output: Relevance score 0-1
 * 
 * Pros: Very accurate, considers interaction
 * Cons: Slow (must encode each pair), expensive
 * 
 * 4. LLM-BASED RERANKING
 * ----------------------
 * Ask LLM: "Rate relevance of this document for this query"
 * 
 * Pros: Most flexible, no training
 * Cons: Very expensive, high latency
 * 
 * WHEN TO USE WHICH:
 * ------------------
 * - Start: Feature-based (our approach)
 * - High volume: Learned-to-rank
 * - High quality needs: Cross-encoder top-k reranking
 * - Complex queries: LLM reranking
 * 
 * ============================================================================
 * TOKEN COUNTING & MANAGEMENT
 * ============================================================================
 * 
 * WHY ACCURATE TOKEN COUNTING MATTERS:
 * ------------------------------------
 * - Exceeding context window = API error
 * - Under-utilizing = wasted capacity
 * - Token count ≠ character count
 * 
 * APPROXIMATIONS:
 * ---------------
 * English: ~4 characters per token
 * Code: ~2-3 characters per token
 * German: ~5 characters per token (longer words)
 * 
 * EXACT COUNTING:
 * ---------------
 * Use tiktoken library (OpenAI's tokenizer)
 * - encoding_for_model("gpt-4o")
 * - encode(text) → list of token IDs
 * - len(encode(text)) → exact count
 * 
 * @see ../llm/token_utils.js for token utilities
 * @see ../llm/llm_config.js for model context limits
 * @see semantic_search.js for document retrieval
 */

import { countTokens } from '../llm/token_utils.js';
import { llmConfig } from '../llm/llm_config.js';

/**
 * Default maximum tokens for context
 * 
 * LEARNING NOTE: Leave headroom for:
 * - System prompt: ~500-1000 tokens
 * - User query: ~50-200 tokens  
 * - LLM response: ~500-2000 tokens
 * - Conversation history: ~0-2000 tokens
 * 
 * For GPT-4o (128k context):
 * - Reserve ~5k for overhead
 * - Use ~10k for retrieved context
 * - Leaves ~113k for conversation history
 */
const DEFAULT_MAX_CONTEXT_TOKENS = 10000;

/**
 * Maximum tokens per document
 * 
 * LEARNING NOTE: Prevents single document from dominating context
 */
const MAX_TOKENS_PER_DOCUMENT = 2000;

/**
 * Build context from retrieved documents
 * 
 * This is the main entry point for context building.
 * 
 * WORKFLOW:
 * ---------
 * 1. Rerank documents (if requested)
 * 2. Format each document with metadata
 * 3. Add documents until hitting token limit
 * 4. Return formatted context + metadata
 * 
 * LEARNING NOTE: This balances quality (reranking) with constraints (limits).
 * The result is a string that fits in LLM context and maximizes relevance.
 * 
 * @param {Array} retrievedDocs - Documents from semantic search
 * @param {Object} options - Building options
 * @param {number} options.maxTokens - Maximum total tokens (default: 10000)
 * @param {boolean} options.rerank - Enable reranking (default: true)
 * @param {string} options.query - Original query (for reranking)
 * @param {boolean} options.includeMetadata - Include doc metadata (default: true)
 * @param {string} options.format - Output format: 'text' or 'json' (default: 'text')
 * 
 * @returns {Object} Built context
 * @returns {string} return.context - Formatted context string
 * @returns {Array} return.sources - Source documents used
 * @returns {Object} return.stats - Statistics about context
 * 
 * @example
 * const retrieved = await semanticSearch.searchEntries("Bürgergeld eligibility");
 * const { context, sources } = await buildContext(retrieved, {
 *   maxTokens: 8000,
 *   rerank: true,
 *   query: "Bürgergeld eligibility"
 * });
 * 
 * // Use context in prompt:
 * const prompt = `Context:\n${context}\n\nQuestion: ${query}\nAnswer:`;
 */
export async function buildContext(retrievedDocs, options = {}) {
  // Validate input
  if (!Array.isArray(retrievedDocs)) {
    throw new Error('retrievedDocs must be an array');
  }

  if (retrievedDocs.length === 0) {
    return {
      context: 'No relevant information found.',
      sources: [],
      stats: {
        totalDocs: 0,
        includedDocs: 0,
        totalTokens: 0,
        truncated: false,
      },
    };
  }

  // Parse options
  const maxTokens = options.maxTokens || DEFAULT_MAX_CONTEXT_TOKENS;
  const shouldRerank = options.rerank ?? true;
  const query = options.query || '';
  const includeMetadata = options.includeMetadata ?? true;
  const format = options.format || 'text';

  try {
    // Step 1: Rerank documents if requested
    // LEARNING NOTE: Reranking improves quality by considering factors
    // beyond just vector similarity
    let rankedDocs = retrievedDocs;
    if (shouldRerank && query) {
      rankedDocs = rankDocuments(retrievedDocs, query);
    }

    // Step 2: Format and add documents until hitting token limit
    const { context, includedDocs, totalTokens } = await formatContext(
      rankedDocs,
      maxTokens,
      includeMetadata,
      format
    );

    // Step 3: Prepare source list for citations
    const sources = formatSources(includedDocs);

    // Step 4: Collect statistics
    const stats = {
      totalDocs: retrievedDocs.length,
      includedDocs: includedDocs.length,
      totalTokens,
      truncated: includedDocs.length < rankedDocs.length,
      averageSimilarity: includedDocs.length > 0
        ? includedDocs.reduce((sum, doc) => sum + (doc.similarity || 0), 0) / includedDocs.length
        : 0,
    };

    return {
      context,
      sources,
      stats,
    };

  } catch (error) {
    console.error('[ContextBuilder] Failed to build context:', error);
    throw new Error(`Context building failed: ${error.message}`);
  }
}

/**
 * Rank documents by relevance
 * 
 * LEARNING NOTE: This is feature-based reranking. We compute a score based on:
 * - Base similarity (from vector search)
 * - Exact match bonus (query terms in document)
 * - Title match bonus (query terms in title)
 * - Recency bonus (newer documents preferred)
 * - Completeness score (longer, more detailed docs preferred)
 * 
 * ALGORITHM:
 * ----------
 * score = similarity × exact_match_multiplier × title_multiplier × recency_multiplier
 * 
 * TUNING:
 * -------
 * These multipliers are hand-tuned. In production, you would:
 * 1. Collect relevance judgments (user clicks, thumbs up/down)
 * 2. Run experiments with different weights
 * 3. Use learning-to-rank algorithms
 * 
 * @param {Array} docs - Documents to rank
 * @param {string} query - User query
 * @returns {Array} Ranked documents
 * 
 * @example
 * const ranked = rankDocuments(searchResults, "Bürgergeld eligibility");
 * // Documents with "eligibility" in title get boosted
 * // Recent documents get boosted
 * // Exact matches get boosted
 */
export function rankDocuments(docs, query) {
  if (!query || docs.length === 0) {
    return docs;
  }

  const queryLower = query.toLowerCase();
  const queryTerms = queryLower.split(/\s+/).filter(t => t.length > 2);

  // Score each document
  const scoredDocs = docs.map(doc => {
    // Start with base similarity from vector search
    let score = doc.similarity || 0.5;

    // Extract text for matching
    const title = (doc.title || '').toLowerCase();
    const description = (doc.description || '').toLowerCase();
    const content = (doc.content || '').toLowerCase();
    const allText = `${title} ${description} ${content}`;

    // SIGNAL 1: Exact match bonus
    // LEARNING NOTE: If query terms appear exactly, it's a strong signal
    let exactMatchCount = 0;
    for (const term of queryTerms) {
      if (allText.includes(term)) {
        exactMatchCount++;
      }
    }
    
    const exactMatchRatio = queryTerms.length > 0 
      ? exactMatchCount / queryTerms.length 
      : 0;
    
    // Boost by up to 20% for exact matches
    const exactMatchMultiplier = 1.0 + (exactMatchRatio * 0.2);
    score *= exactMatchMultiplier;

    // SIGNAL 2: Title match bonus
    // LEARNING NOTE: Title matches are strong relevance signals
    let titleMatchCount = 0;
    for (const term of queryTerms) {
      if (title.includes(term)) {
        titleMatchCount++;
      }
    }
    
    const titleMatchRatio = queryTerms.length > 0
      ? titleMatchCount / queryTerms.length
      : 0;
    
    // Boost by up to 30% for title matches
    const titleMultiplier = 1.0 + (titleMatchRatio * 0.3);
    score *= titleMultiplier;

    // SIGNAL 3: Recency bonus
    // LEARNING NOTE: Recent information is often more valuable
    if (doc.indexedAt || doc.publishedAt || doc.updatedAt) {
      const dateStr = doc.indexedAt || doc.publishedAt || doc.updatedAt;
      try {
        const docDate = new Date(dateStr);
        const now = new Date();
        const ageInDays = (now - docDate) / (1000 * 60 * 60 * 24);
        
        // Decay function: documents lose 5% relevance per year
        // Recent docs (< 30 days): 0% decay
        // 1 year old: 5% decay
        // 2 years old: 10% decay
        const yearAge = ageInDays / 365;
        const recencyMultiplier = Math.max(0.5, 1.0 - (yearAge * 0.05));
        score *= recencyMultiplier;
      } catch (e) {
        // Invalid date, ignore recency signal
      }
    }

    // SIGNAL 4: Completeness score
    // LEARNING NOTE: Longer, more detailed documents often more useful
    const contentLength = allText.length;
    let completenessMultiplier = 1.0;
    
    if (contentLength > 500) {
      // Good length, small boost
      completenessMultiplier = 1.05;
    } else if (contentLength < 100) {
      // Very short, might be incomplete
      completenessMultiplier = 0.95;
    }
    
    score *= completenessMultiplier;

    // Store detailed scoring for debugging
    return {
      ...doc,
      _reranking: {
        originalScore: doc.similarity,
        finalScore: score,
        exactMatchMultiplier,
        titleMultiplier,
        completenessMultiplier,
      },
      similarity: score, // Update similarity with reranked score
    };
  });

  // Sort by final score (descending)
  scoredDocs.sort((a, b) => b.similarity - a.similarity);

  return scoredDocs;
}

/**
 * Format documents into context string
 * 
 * LEARNING NOTE: This converts array of documents into a single string
 * that fits within the token limit. Documents are added in order until
 * the limit is reached.
 * 
 * FORMATTING CHOICES:
 * -------------------
 * We use a structured format with clear separators:
 * 
 * ```
 * === Document 1 ===
 * Title: [title]
 * Source: [url]
 * 
 * [content]
 * 
 * === Document 2 ===
 * ...
 * ```
 * 
 * WHY THIS FORMAT?
 * ----------------
 * 1. Clear boundaries: LLM can distinguish documents
 * 2. Metadata first: Source information is prominent
 * 3. Human-readable: Easy to debug
 * 4. Citation-friendly: Sources are clearly marked
 * 
 * ALTERNATIVES:
 * -------------
 * - XML: <document><title>...</title><content>...</content></document>
 * - JSON: [{"title": "...", "content": "..."}]
 * - Markdown: # Title\n\ncontent\n\n---
 * 
 * @param {Array} docs - Ranked documents
 * @param {number} maxTokens - Maximum total tokens
 * @param {boolean} includeMetadata - Include source metadata
 * @param {string} format - Output format ('text' or 'json')
 * @returns {Promise<Object>} Formatted context and stats
 */
async function formatContext(docs, maxTokens, includeMetadata, format) {
  const includedDocs = [];
  let totalTokens = 0;
  
  if (format === 'json') {
    // JSON format for structured output
    return formatContextAsJSON(docs, maxTokens, includeMetadata);
  }

  // Text format (default)
  const contextParts = [];

  for (let i = 0; i < docs.length; i++) {
    const doc = docs[i];
    
    // Format this document
    let docText = formatDocument(doc, i + 1, includeMetadata);
    
    // Ensure single document doesn't exceed per-doc limit
    let docTokens = countTokens(docText);
    if (docTokens > MAX_TOKENS_PER_DOCUMENT) {
      // Truncate document content
      docText = truncateDocument(docText, MAX_TOKENS_PER_DOCUMENT);
      docTokens = countTokens(docText);
    }

    // Check if adding this document would exceed limit
    if (totalTokens + docTokens > maxTokens) {
      // Try to fit a truncated version
      const availableTokens = maxTokens - totalTokens;
      if (availableTokens > 200) {
        // Room for something useful
        docText = truncateDocument(docText, availableTokens);
        docTokens = countTokens(docText);
        contextParts.push(docText);
        includedDocs.push(doc);
        totalTokens += docTokens;
      }
      // Stop adding more documents
      break;
    }

    // Add document to context
    contextParts.push(docText);
    includedDocs.push(doc);
    totalTokens += docTokens;
  }

  const context = contextParts.join('\n\n');

  return {
    context,
    includedDocs,
    totalTokens,
  };
}

/**
 * Format context as JSON
 * 
 * LEARNING NOTE: JSON format is useful for:
 * - Structured output from LLM (JSON mode)
 * - Programmatic processing
 * - API responses
 * 
 * @param {Array} docs - Documents to format
 * @param {number} maxTokens - Maximum tokens
 * @param {boolean} includeMetadata - Include metadata
 * @returns {Promise<Object>} Formatted context
 */
async function formatContextAsJSON(docs, maxTokens, includeMetadata) {
  const includedDocs = [];
  let totalTokens = 0;

  const jsonDocs = [];

  for (const doc of docs) {
    const jsonDoc = {
      title: doc.title || 'Untitled',
      content: doc.description || doc.content || '',
    };

    if (includeMetadata) {
      jsonDoc.metadata = {
        source: doc.url || doc.id,
        type: doc.type,
        similarity: doc.similarity,
      };
    }

    const docText = JSON.stringify(jsonDoc, null, 2);
    const docTokens = countTokens(docText);

    if (totalTokens + docTokens > maxTokens) {
      break;
    }

    jsonDocs.push(jsonDoc);
    includedDocs.push(doc);
    totalTokens += docTokens;
  }

  const context = JSON.stringify(jsonDocs, null, 2);

  return {
    context,
    includedDocs,
    totalTokens,
  };
}

/**
 * Format a single document
 * 
 * @param {Object} doc - Document to format
 * @param {number} index - Document number (1-indexed)
 * @param {boolean} includeMetadata - Include metadata
 * @returns {string} Formatted document
 */
function formatDocument(doc, index, includeMetadata) {
  const parts = [];

  // Header
  parts.push(`=== Document ${index} ===`);

  // Title
  if (doc.title) {
    parts.push(`Title: ${doc.title}`);
  }

  // Metadata
  if (includeMetadata) {
    if (doc.url) {
      parts.push(`Source: ${doc.url}`);
    }
    if (doc.type) {
      parts.push(`Type: ${doc.type}`);
    }
    if (doc.similarity !== undefined) {
      parts.push(`Relevance: ${(doc.similarity * 100).toFixed(1)}%`);
    }
  }

  // Empty line before content
  parts.push('');

  // Content (prefer description, fallback to content)
  const content = doc.description || doc.content || '';
  if (content) {
    parts.push(content.trim());
  } else {
    parts.push('[No content available]');
  }

  return parts.join('\n');
}

/**
 * Truncate document to fit token limit
 * 
 * LEARNING NOTE: Truncation strategies:
 * 
 * 1. SIMPLE TRUNCATE (our approach): Cut at token limit
 *    Pros: Fast, simple
 *    Cons: May cut mid-sentence
 * 
 * 2. SENTENCE-AWARE: Cut at sentence boundary
 *    Pros: Clean breaks
 *    Cons: More complex
 * 
 * 3. EXTRACTIVE SUMMARY: Keep most relevant sentences
 *    Pros: Better quality
 *    Cons: Requires NLP
 * 
 * 4. ABSTRACTIVE SUMMARY: Generate summary with LLM
 *    Pros: Best quality
 *    Cons: Expensive, slow
 * 
 * @param {string} docText - Full document text
 * @param {number} maxTokens - Maximum tokens
 * @returns {string} Truncated text
 */
function truncateDocument(docText, maxTokens) {
  // LEARNING NOTE: We approximate tokens as characters / 4
  // This is faster than exact tokenization for truncation
  const estimatedMaxChars = maxTokens * 4;
  
  if (docText.length <= estimatedMaxChars) {
    return docText;
  }

  // Truncate with ellipsis
  const truncated = docText.substring(0, estimatedMaxChars);
  
  // Try to end at sentence boundary
  const lastPeriod = truncated.lastIndexOf('.');
  const lastQuestion = truncated.lastIndexOf('?');
  const lastExclamation = truncated.lastIndexOf('!');
  const lastSentenceEnd = Math.max(lastPeriod, lastQuestion, lastExclamation);
  
  if (lastSentenceEnd > estimatedMaxChars * 0.8) {
    // Found sentence end in last 20%, use it
    return truncated.substring(0, lastSentenceEnd + 1) + '\n\n[Content truncated...]';
  }

  // No good sentence boundary, hard truncate
  return truncated + '...\n\n[Content truncated...]';
}

/**
 * Truncate context to fit within token limit
 * 
 * This is a utility function for when you have already-formatted context
 * that needs to be shortened.
 * 
 * LEARNING NOTE: This is less sophisticated than truncation during building,
 * but useful for dynamic adjustments (e.g., user added conversation history).
 * 
 * @param {string} context - Full context string
 * @param {number} maxTokens - Maximum tokens
 * @returns {Promise<string>} Truncated context
 * 
 * @example
 * const context = await buildContext(docs);
 * // User added conversation history, need to shrink context
 * const truncated = await truncateContext(context.context, 5000);
 */
export async function truncateContext(context, maxTokens) {
  const currentTokens = countTokens(context);
  
  if (currentTokens <= maxTokens) {
    return context;
  }

  // Calculate approximate character position to truncate
  const ratio = maxTokens / currentTokens;
  const targetLength = Math.floor(context.length * ratio * 0.95); // 5% margin
  
  let truncated = context.substring(0, targetLength);
  
  // Try to end at document boundary
  const lastDocBoundary = truncated.lastIndexOf('=== Document');
  if (lastDocBoundary > targetLength * 0.7) {
    // Found document boundary in last 30%
    truncated = truncated.substring(0, lastDocBoundary);
  }
  
  return truncated + '\n\n[Context truncated due to length...]';
}

/**
 * Format sources for citations
 * 
 * LEARNING NOTE: Source formatting is critical for:
 * - User trust (can verify information)
 * - Transparency (know where info came from)
 * - Legal compliance (attribution requirements)
 * 
 * CITATION STYLES:
 * ----------------
 * 1. Numbered: [1], [2], [3]
 * 2. Author-date: (Smith, 2024)
 * 3. Footnotes: ¹, ², ³
 * 4. Hyperlinks: [title](url)
 * 
 * We use numbered style as it's simple and unambiguous.
 * 
 * @param {Array} docs - Documents used in context
 * @returns {Array} Formatted source list
 * 
 * @example
 * const sources = formatSources(includedDocs);
 * // [
 * //   {
 * //     id: 1,
 * //     title: "Bürgergeld Eligibility Guide",
 * //     url: "https://...",
 * //     citation: "[1] Bürgergeld Eligibility Guide - https://..."
 * //   }
 * // ]
 */
export function formatSources(docs) {
  return docs.map((doc, index) => {
    const sourceNum = index + 1;
    const title = doc.title || 'Untitled';
    const url = doc.url || doc.id || 'No URL';
    
    // Create citation string
    const citation = `[${sourceNum}] ${title} - ${url}`;
    
    return {
      id: sourceNum,
      title,
      url,
      type: doc.type,
      similarity: doc.similarity,
      citation,
    };
  });
}

/**
 * Calculate optimal context size
 * 
 * LEARNING NOTE: Context size affects:
 * - Quality: More context = more information = better answers
 * - Cost: More tokens = higher API cost
 * - Latency: More tokens = slower processing
 * - Coherence: Too much context = LLM gets confused
 * 
 * HEURISTICS:
 * -----------
 * - Short query (< 10 words): 5k-8k tokens context
 * - Medium query (10-30 words): 8k-12k tokens context
 * - Long query (> 30 words): 10k-15k tokens context
 * - Complex multi-part query: 12k-15k tokens context
 * 
 * @param {string} query - User query
 * @param {string} model - LLM model name
 * @returns {number} Recommended context tokens
 * 
 * @example
 * const optimalSize = calculateOptimalContextSize(
 *   "What are the eligibility requirements for Bürgergeld?",
 *   "gpt-4o"
 * );
 * // Returns: ~8000
 */
export function calculateOptimalContextSize(query, model = 'gpt-4o') {
  const queryTokens = countTokens(query);
  
  // Get model context limit
  const modelConfig = llmConfig.models[model] || llmConfig.models['gpt-4o-mini'];
  const maxContext = modelConfig.maxTokens || 128000;
  
  // Heuristic based on query length
  let recommendedSize;
  
  if (queryTokens < 20) {
    // Short query
    recommendedSize = 6000;
  } else if (queryTokens < 50) {
    // Medium query
    recommendedSize = 10000;
  } else {
    // Long query
    recommendedSize = 12000;
  }
  
  // Cap at 20% of model's context window
  const maxAllowed = Math.floor(maxContext * 0.2);
  recommendedSize = Math.min(recommendedSize, maxAllowed);
  
  return recommendedSize;
}

// ============================================================================
// USAGE EXAMPLES
// ============================================================================

/**
 * EXAMPLE 1: Basic context building
 * 
 * import { SemanticSearch } from '../embeddings/semantic_search.js';
 * import { buildContext } from './context_builder.js';
 * 
 * const search = new SemanticSearch();
 * const results = await search.searchEntries("Bürgergeld eligibility");
 * 
 * const { context, sources, stats } = await buildContext(results, {
 *   maxTokens: 8000,
 *   rerank: true,
 *   query: "Bürgergeld eligibility"
 * });
 * 
 * console.log(`Built context with ${stats.includedDocs} documents (${stats.totalTokens} tokens)`);
 * console.log('Sources:', sources.map(s => s.citation));
 */

/**
 * EXAMPLE 2: Dynamic context sizing
 * 
 * const query = "What benefits am I eligible for if I'm unemployed with children?";
 * const optimalSize = calculateOptimalContextSize(query, 'gpt-4o');
 * 
 * const { context } = await buildContext(results, {
 *   maxTokens: optimalSize,
 *   rerank: true,
 *   query
 * });
 */

/**
 * EXAMPLE 3: JSON format for structured outputs
 * 
 * const { context, sources } = await buildContext(results, {
 *   maxTokens: 5000,
 *   format: 'json'
 * });
 * 
 * // Use with JSON mode
 * const response = await generateCompletion({
 *   messages: [
 *     { role: 'system', content: 'You are a helpful assistant.' },
 *     { role: 'user', content: `Context: ${context}\n\nQuestion: ${query}` }
 *   ],
 *   response_format: { type: 'json_object' }
 * });
 */

/**
 * EXAMPLE 4: Manual reranking
 * 
 * const results = await search.searchEntries("housing benefit");
 * 
 * // Rerank to prioritize recent documents
 * const reranked = rankDocuments(results, "housing benefit");
 * 
 * // Build context from reranked results
 * const { context } = await buildContext(reranked, {
 *   maxTokens: 10000,
 *   rerank: false, // Already reranked
 * });
 */

/**
 * EXAMPLE 5: Context truncation for conversation
 * 
 * // Initial context
 * let { context } = await buildContext(results, { maxTokens: 12000 });
 * 
 * // User has long conversation history
 * const conversationTokens = countTokens(conversationHistory);
 * 
 * if (conversationTokens > 3000) {
 *   // Need to shrink context to make room
 *   context = await truncateContext(context, 8000);
 * }
 */
