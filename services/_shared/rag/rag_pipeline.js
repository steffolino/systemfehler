/**
 * Systemfehler - RAG Pipeline Module
 * 
 * This is the main orchestrator for the complete RAG (Retrieval-Augmented Generation)
 * pipeline. It coordinates query processing, retrieval, context building, and
 * answer generation.
 * 
 * ============================================================================
 * WHAT IS RAG?
 * ============================================================================
 * 
 * RAG stands for Retrieval-Augmented Generation. It's a technique that improves
 * LLM responses by combining them with relevant information from a knowledge base.
 * 
 * TRADITIONAL LLM APPROACH:
 * -------------------------
 * User Question → LLM → Answer
 * 
 * Problem: LLM only knows what was in training data
 * - Can't answer about recent information
 * - Can't answer about private/proprietary data
 * - May hallucinate (make up plausible-sounding but wrong answers)
 * 
 * RAG APPROACH:
 * -------------
 * User Question → [Search Knowledge Base] → Retrieved Context → LLM → Answer
 * 
 * Benefits:
 * ✓ Access to current information
 * ✓ Access to private/proprietary data
 * ✓ Reduced hallucinations (grounded in facts)
 * ✓ Source attribution (know where info came from)
 * ✓ No retraining needed (update knowledge base instead)
 * 
 * ============================================================================
 * RAG PIPELINE STAGES
 * ============================================================================
 * 
 * STAGE 1: QUERY PROCESSING
 * --------------------------
 * Transform user question for better retrieval
 * 
 * Input: "Can I get Bürgergeld?"
 * Processing:
 * - Intent classification: "eligibility"
 * - Entity extraction: benefit_type="Bürgergeld"
 * - Query expansion: add synonyms "citizen money", "basic income"
 * Output: Enriched query for retrieval
 * 
 * STAGE 2: RETRIEVAL
 * -------------------
 * Find relevant documents from knowledge base
 * 
 * Methods:
 * - Semantic search: Vector similarity (main approach)
 * - Keyword search: BM25, full-text search (optional)
 * - Hybrid: Combine both methods (best results)
 * 
 * Input: Processed query
 * Output: Top-K relevant documents (typically 5-20)
 * 
 * STAGE 3: CONTEXT BUILDING
 * --------------------------
 * Format retrieved documents for LLM
 * 
 * Processing:
 * - Rerank by relevance
 * - Format with metadata
 * - Truncate to fit context window
 * - Prepare source citations
 * 
 * Input: Retrieved documents
 * Output: Formatted context string + source list
 * 
 * STAGE 4: GENERATION
 * -------------------
 * Generate answer using LLM with context
 * 
 * Processing:
 * - Construct prompt (system + context + question)
 * - Call LLM
 * - Parse response
 * - Validate and add citations
 * 
 * Input: Question + formatted context
 * Output: Answer with citations
 * 
 * ============================================================================
 * WHY RAG REDUCES HALLUCINATIONS
 * ============================================================================
 * 
 * HALLUCINATION: When LLM generates plausible but factually incorrect information
 * 
 * Example without RAG:
 * Q: "What's the Bürgergeld amount for single adults?"
 * A: "€450 per month" ← Wrong! (Actual: €563)
 * 
 * Why it happens:
 * - LLM trained on old data
 * - LLM "fills in gaps" with plausible guesses
 * - No way to verify claims
 * 
 * How RAG helps:
 * ---------------
 * 1. GROUNDING: LLM sees actual facts in context
 *    Context: "Bürgergeld provides €563/month for single adults"
 *    LLM repeats this fact instead of guessing
 * 
 * 2. EXPLICIT CONSTRAINTS: Prompt says "answer ONLY from context"
 *    If fact not in context → "I don't know" instead of guessing
 * 
 * 3. ATTRIBUTION: Citations let users verify
 *    Answer: "€563/month [1]"
 *    User can check source [1] to verify
 * 
 * 4. VALIDATION: Check answer against context
 *    If answer contradicts context → flag as low confidence
 * 
 * RAG DOESN'T ELIMINATE HALLUCINATIONS:
 * --------------------------------------
 * LLMs can still:
 * - Misinterpret context
 * - Combine facts incorrectly
 * - Miss nuances
 * 
 * But RAG significantly reduces hallucination rate:
 * - Without RAG: ~15-30% hallucination rate
 * - With RAG: ~5-10% hallucination rate
 * (Numbers approximate, vary by use case)
 * 
 * ============================================================================
 * RAG VS FINE-TUNING
 * ============================================================================
 * 
 * WHEN TO USE RAG:
 * ----------------
 * ✓ Frequently changing information (news, docs, policies)
 * ✓ Large knowledge base (can't fit in training)
 * ✓ Need source attribution
 * ✓ Multiple domains (easier to add new docs than retrain)
 * ✓ Quick to deploy (no training needed)
 * ✓ Lower cost (no GPU training time)
 * 
 * Example: Q&A over documentation, customer support, research assistance
 * 
 * WHEN TO USE FINE-TUNING:
 * ------------------------
 * ✓ Need specific style/tone/format
 * ✓ Domain-specific language (medical, legal, technical)
 * ✓ Task-specific behavior (classification, extraction)
 * ✓ Stable knowledge (doesn't change often)
 * ✓ No need for citations
 * 
 * Example: Medical diagnosis, legal document drafting, code generation
 * 
 * WHEN TO USE BOTH:
 * -----------------
 * ✓ Fine-tune for domain knowledge and style
 * ✓ RAG for current facts and citations
 * 
 * Example: Legal assistant (fine-tuned on legal reasoning + RAG for case law)
 * 
 * COMPARISON TABLE:
 * -----------------
 * 
 * Feature              | RAG                | Fine-tuning
 * ---------------------|--------------------|-----------------
 * Update speed         | Instant            | Hours to days
 * Knowledge capacity   | Unlimited          | Limited by context
 * Cost                 | Low (just API)     | High (GPU time)
 * Transparency         | High (see sources) | Low (black box)
 * Accuracy             | Good               | Can be better
 * Maintenance          | Easy               | Requires ML expertise
 * 
 * ============================================================================
 * IMPLEMENTATION NOTES
 * ============================================================================
 * 
 * PERFORMANCE:
 * ------------
 * - Query processing: ~50-100ms
 * - Retrieval: ~100-300ms
 * - Context building: ~50-100ms
 * - Generation: ~1-3 seconds (depends on length)
 * - Total: ~1.5-3.5 seconds
 * 
 * COSTS (approximate, GPT-4o-mini):
 * ----------------------------------
 * - Embedding query: $0.00001
 * - LLM generation: $0.0001-0.001 (depends on length)
 * - Total per query: ~$0.0001-0.001
 * 
 * SCALING:
 * --------
 * - Bottleneck: LLM generation (slowest step)
 * - Optimization: Cache common queries
 * - Optimization: Batch processing where possible
 * - Optimization: Stream responses for better UX
 * 
 * QUALITY:
 * --------
 * - Monitor: Answer relevance, citation coverage, confidence
 * - A/B test: Different retrieval strategies, reranking, prompts
 * - Iterate: Improve based on user feedback
 * 
 * @see query_processor.js for query understanding
 * @see ../embeddings/semantic_search.js for retrieval
 * @see context_builder.js for context formatting
 * @see answer_generator.js for answer generation
 */

import { processQuery } from './query_processor.js';
import { SemanticSearch } from '../embeddings/semantic_search.js';
import { buildContext, calculateOptimalContextSize } from './context_builder.js';
import { generateAnswer } from './answer_generator.js';

/**
 * Default RAG pipeline options
 * 
 * LEARNING NOTE: These are balanced defaults. Adjust based on your needs:
 * - topK: More = better recall, slower, more expensive
 * - contextTokens: More = more info, slower, more expensive
 * - temperature: Lower = more factual, less creative
 */
const DEFAULT_OPTIONS = {
  // Query processing
  expandQuery: true,              // Add synonyms for better recall
  extractEntities: true,          // Extract structured info from query
  
  // Retrieval
  topK: 10,                       // Number of documents to retrieve
  minSimilarity: 0.7,             // Minimum relevance threshold
  rerank: true,                   // Rerank results for quality
  
  // Context building
  contextTokens: null,            // Auto-calculate if null
  includeMetadata: true,          // Include source metadata
  
  // Generation
  temperature: 0.3,               // Low for factual accuracy
  maxTokens: 1000,                // Reasonable answer length
  model: 'gpt-4o-mini',           // Cost-effective default
  audience: 'general',            // Target audience
  includeFollowUp: false,         // Generate follow-up questions
  
  // Advanced
  useLLMProcessing: false,        // Use LLM for query processing
  streaming: false,               // Stream answer (not implemented yet)
  cacheResults: false,            // Cache query results (not implemented yet)
};

/**
 * Answer a question using RAG
 * 
 * This is the main entry point for the RAG pipeline.
 * It orchestrates all stages from query to answer.
 * 
 * WORKFLOW:
 * ---------
 * 1. Process query (understand intent, extract entities, expand)
 * 2. Retrieve relevant documents (semantic search)
 * 3. Build context (rerank, format, truncate)
 * 4. Generate answer (LLM with context)
 * 5. Validate and return result
 * 
 * LEARNING NOTE: This is the "magic" of RAG. Each stage is modular,
 * so you can:
 * - Swap retrieval methods (semantic, keyword, hybrid)
 * - Adjust context building (summarize vs truncate)
 * - Change LLM models (GPT-4o, Claude, Llama)
 * - Customize for your use case
 * 
 * @param {string} question - User question
 * @param {Object} options - Pipeline options (overrides defaults)
 * @param {SemanticSearch} options.searchClient - Custom search client
 * @param {boolean} options.expandQuery - Enable query expansion
 * @param {boolean} options.extractEntities - Enable entity extraction
 * @param {number} options.topK - Number of documents to retrieve
 * @param {number} options.minSimilarity - Minimum similarity threshold
 * @param {boolean} options.rerank - Enable reranking
 * @param {number} options.contextTokens - Max context tokens (auto if null)
 * @param {string} options.model - LLM model to use
 * @param {string} options.audience - Target audience (general/simple/technical)
 * @param {boolean} options.includeFollowUp - Generate follow-up questions
 * 
 * @returns {Promise<Object>} RAG result
 * @returns {string} return.answer - Generated answer with citations
 * @returns {Array} return.sources - Sources used with citations
 * @returns {string} return.confidence - Confidence level
 * @returns {Object} return.processedQuery - Query analysis results
 * @returns {Object} return.retrieval - Retrieval statistics
 * @returns {Object} return.metadata - Pipeline metadata
 * 
 * @example
 * const result = await answerQuestion("Am I eligible for Bürgergeld?");
 * 
 * console.log(result.answer);
 * // "Based on the provided information [1], you may be eligible for 
 * // Bürgergeld if you meet these requirements: ..."
 * 
 * console.log(result.sources);
 * // [
 * //   {id: 1, title: "Bürgergeld Eligibility", url: "...", citation: "[1] ..."},
 * //   {id: 2, title: "Application Process", url: "...", citation: "[2] ..."}
 * // ]
 * 
 * console.log(result.confidence);
 * // "high"
 * 
 * console.log(result.metadata);
 * // {
 * //   totalDurationMs: 2341,
 * //   stages: {query: 67ms, retrieval: 234ms, context: 89ms, generation: 1951ms},
 * //   tokensUsed: {input: 1234, output: 456},
 * //   cost: "$0.00034"
 * // }
 */
export async function answerQuestion(question, options = {}) {
  // Validate input
  if (!question || typeof question !== 'string') {
    throw new Error('Question must be a non-empty string');
  }

  question = question.trim();
  if (question.length === 0) {
    throw new Error('Question cannot be empty');
  }

  // Merge options with defaults
  const config = { ...DEFAULT_OPTIONS, ...options };

  // Initialize timing
  const startTime = Date.now();
  const stages = {};

  try {
    // ========================================================================
    // STAGE 1: QUERY PROCESSING
    // ========================================================================
    // Understand and enhance the query for better retrieval
    
    console.log('[RAG] Stage 1: Processing query...');
    const queryStartTime = Date.now();
    
    const processedQuery = await processQuery(question, {
      expandQuery: config.expandQuery,
      extractEntities: config.extractEntities,
      useLLM: config.useLLMProcessing,
    });
    
    stages.query = Date.now() - queryStartTime;
    console.log(`[RAG] Query processed in ${stages.query}ms`);
    console.log(`[RAG] Intent: ${processedQuery.intent}, Entities: ${processedQuery.entities.length}`);

    // ========================================================================
    // STAGE 2: RETRIEVAL
    // ========================================================================
    // Find relevant documents from knowledge base
    
    console.log('[RAG] Stage 2: Retrieving documents...');
    const retrievalStartTime = Date.now();
    
    // Get or create search client
    const searchClient = config.searchClient || new SemanticSearch();
    
    // Use expanded query for better recall
    const searchQuery = config.expandQuery ? processedQuery.expanded : processedQuery.original;
    
    // Perform semantic search
    const retrievedDocs = await searchClient.searchEntries(searchQuery, {
      topK: config.topK,
      minSimilarity: config.minSimilarity,
      includeScores: true,
    });
    
    stages.retrieval = Date.now() - retrievalStartTime;
    console.log(`[RAG] Retrieved ${retrievedDocs.length} documents in ${stages.retrieval}ms`);

    // Handle no results case
    if (retrievedDocs.length === 0) {
      return {
        answer: "I couldn't find any relevant information to answer your question. Please try rephrasing or asking something else.",
        sources: [],
        confidence: 'low',
        processedQuery,
        retrieval: {
          documentsFound: 0,
          searchQuery,
        },
        metadata: {
          totalDurationMs: Date.now() - startTime,
          stages,
          noResults: true,
        },
      };
    }

    // ========================================================================
    // STAGE 3: CONTEXT BUILDING
    // ========================================================================
    // Format retrieved documents for LLM prompt
    
    console.log('[RAG] Stage 3: Building context...');
    const contextStartTime = Date.now();
    
    // Calculate optimal context size if not specified
    const contextTokens = config.contextTokens || 
      calculateOptimalContextSize(question, config.model);
    
    // Build formatted context
    const { context, sources, stats } = await buildContext(retrievedDocs, {
      maxTokens: contextTokens,
      rerank: config.rerank,
      query: processedQuery.original,
      includeMetadata: config.includeMetadata,
    });
    
    stages.context = Date.now() - contextStartTime;
    console.log(`[RAG] Context built with ${stats.includedDocs} documents (${stats.totalTokens} tokens) in ${stages.context}ms`);

    // ========================================================================
    // STAGE 4: GENERATION
    // ========================================================================
    // Generate answer using LLM with context
    
    console.log('[RAG] Stage 4: Generating answer...');
    const generationStartTime = Date.now();
    
    const answerResult = await generateAnswer(question, context, {
      sources,
      temperature: config.temperature,
      maxTokens: config.maxTokens,
      model: config.model,
      audience: config.audience,
      includeFollowUp: config.includeFollowUp,
    });
    
    stages.generation = Date.now() - generationStartTime;
    console.log(`[RAG] Answer generated in ${stages.generation}ms`);

    // ========================================================================
    // STAGE 5: RESULT ASSEMBLY
    // ========================================================================
    // Combine all results and metadata
    
    const totalDuration = Date.now() - startTime;
    
    // Estimate cost (approximate)
    const estimatedCost = estimateCost(
      answerResult.metadata.tokensUsed,
      config.model
    );

    const result = {
      // Main results
      answer: answerResult.answer,
      sources,
      confidence: answerResult.confidence,
      
      // Additional info
      processedQuery,
      keyPoints: answerResult.keyPoints || [],
      followUpQuestions: answerResult.followUpQuestions || [],
      
      // Retrieval details
      retrieval: {
        documentsFound: retrievedDocs.length,
        documentsUsed: stats.includedDocs,
        searchQuery,
        averageSimilarity: stats.averageSimilarity,
      },
      
      // Quality metrics
      validation: answerResult.validation || {},
      
      // Performance metadata
      metadata: {
        totalDurationMs: totalDuration,
        stages,
        model: config.model,
        tokensUsed: {
          input: answerResult.metadata.tokensUsed.input + stats.totalTokens,
          output: answerResult.metadata.tokensUsed.output,
          total: answerResult.metadata.tokensUsed.input + answerResult.metadata.tokensUsed.output + stats.totalTokens,
        },
        estimatedCost,
        timestamp: new Date().toISOString(),
      },
    };

    // Log summary
    console.log('[RAG] Pipeline complete:', {
      duration: `${totalDuration}ms`,
      confidence: result.confidence,
      sources: result.sources.length,
      tokens: result.metadata.tokensUsed.total,
      cost: estimatedCost,
    });

    return result;

  } catch (error) {
    console.error('[RAG] Pipeline failed:', error);
    
    // Return error response
    return {
      answer: "I encountered an error while processing your question. Please try again or rephrase your question.",
      sources: [],
      confidence: 'low',
      processedQuery: { original: question },
      retrieval: { documentsFound: 0 },
      metadata: {
        totalDurationMs: Date.now() - startTime,
        stages,
        error: error.message,
      },
    };
  }
}

/**
 * Estimate API cost for a query
 * 
 * LEARNING NOTE: Cost estimation helps:
 * - Budget tracking
 * - Optimization decisions
 * - User quotas (in paid services)
 * 
 * Pricing (as of 2024, approximate):
 * - GPT-4o: $5/1M input tokens, $15/1M output tokens
 * - GPT-4o-mini: $0.15/1M input tokens, $0.60/1M output tokens
 * - Embeddings: $0.02/1M tokens
 * 
 * @param {Object} tokensUsed - Token usage
 * @param {string} model - Model used
 * @returns {string} Estimated cost
 */
function estimateCost(tokensUsed, model) {
  // Pricing per 1M tokens (approximate)
  const pricing = {
    'gpt-4o': { input: 5, output: 15 },
    'gpt-4o-mini': { input: 0.15, output: 0.60 },
    'gpt-3.5-turbo': { input: 0.50, output: 1.50 },
  };

  const modelPricing = pricing[model] || pricing['gpt-4o-mini'];
  
  const inputCost = (tokensUsed.input / 1000000) * modelPricing.input;
  const outputCost = (tokensUsed.output / 1000000) * modelPricing.output;
  const totalCost = inputCost + outputCost;
  
  return `$${totalCost.toFixed(6)}`;
}

/**
 * Answer multiple questions in batch
 * 
 * LEARNING NOTE: Batch processing is more efficient:
 * - Amortize overhead (loading models, etc.)
 * - Parallel processing where possible
 * - Better resource utilization
 * 
 * USE CASES:
 * ----------
 * - FAQ generation
 * - Document Q&A (ask multiple questions about a document)
 * - Evaluation (test set of questions)
 * 
 * @param {Array<string>} questions - Array of questions
 * @param {Object} options - Shared options for all questions
 * @param {boolean} options.parallel - Process in parallel (default: false)
 * @returns {Promise<Array>} Array of results
 * 
 * @example
 * const questions = [
 *   "What is Bürgergeld?",
 *   "Who is eligible?",
 *   "How do I apply?"
 * ];
 * 
 * const results = await answerQuestions(questions);
 * results.forEach((r, i) => {
 *   console.log(`Q${i+1}: ${questions[i]}`);
 *   console.log(`A${i+1}: ${r.answer}\n`);
 * });
 */
export async function answerQuestions(questions, options = {}) {
  if (!Array.isArray(questions) || questions.length === 0) {
    throw new Error('questions must be a non-empty array');
  }

  const parallel = options.parallel ?? false;

  if (parallel) {
    // Process all questions in parallel
    // LEARNING NOTE: Faster but uses more resources
    console.log(`[RAG] Processing ${questions.length} questions in parallel...`);
    return await Promise.all(
      questions.map(q => answerQuestion(q, options))
    );
  } else {
    // Process questions sequentially
    // LEARNING NOTE: Slower but more controlled, respects rate limits
    console.log(`[RAG] Processing ${questions.length} questions sequentially...`);
    const results = [];
    for (const question of questions) {
      const result = await answerQuestion(question, options);
      results.push(result);
    }
    return results;
  }
}

/**
 * Get RAG pipeline statistics
 * 
 * LEARNING NOTE: Monitoring is crucial for production systems.
 * Track these metrics:
 * - Average latency per stage
 * - Success rate
 * - Confidence distribution
 * - Cost per query
 * - User satisfaction (thumbs up/down)
 * 
 * Use for:
 * - Performance optimization
 * - Quality improvement
 * - Cost management
 * - A/B testing
 * 
 * @param {Array<Object>} results - Array of pipeline results
 * @returns {Object} Aggregated statistics
 * 
 * @example
 * const questions = [...];
 * const results = await answerQuestions(questions);
 * const stats = getPipelineStats(results);
 * 
 * console.log('Average latency:', stats.avgLatency, 'ms');
 * console.log('High confidence:', stats.confidenceDistribution.high, '%');
 * console.log('Total cost:', stats.totalCost);
 */
export function getPipelineStats(results) {
  if (!Array.isArray(results) || results.length === 0) {
    return null;
  }

  const stats = {
    totalQueries: results.length,
    avgLatency: 0,
    avgTokens: { input: 0, output: 0, total: 0 },
    totalCost: 0,
    confidenceDistribution: { high: 0, medium: 0, low: 0 },
    avgSourcesUsed: 0,
    stageLatencies: { query: 0, retrieval: 0, context: 0, generation: 0 },
  };

  for (const result of results) {
    // Latency
    stats.avgLatency += result.metadata.totalDurationMs;
    
    // Tokens
    stats.avgTokens.input += result.metadata.tokensUsed.input;
    stats.avgTokens.output += result.metadata.tokensUsed.output;
    stats.avgTokens.total += result.metadata.tokensUsed.total;
    
    // Cost (parse from string "$0.00034")
    const cost = parseFloat(result.metadata.estimatedCost.replace('$', ''));
    stats.totalCost += cost;
    
    // Confidence
    stats.confidenceDistribution[result.confidence]++;
    
    // Sources
    stats.avgSourcesUsed += result.sources.length;
    
    // Stage latencies
    if (result.metadata.stages) {
      for (const [stage, duration] of Object.entries(result.metadata.stages)) {
        stats.stageLatencies[stage] += duration;
      }
    }
  }

  // Calculate averages
  const n = results.length;
  stats.avgLatency = Math.round(stats.avgLatency / n);
  stats.avgTokens.input = Math.round(stats.avgTokens.input / n);
  stats.avgTokens.output = Math.round(stats.avgTokens.output / n);
  stats.avgTokens.total = Math.round(stats.avgTokens.total / n);
  stats.avgSourcesUsed = (stats.avgSourcesUsed / n).toFixed(1);
  stats.totalCost = `$${stats.totalCost.toFixed(4)}`;
  
  // Convert confidence to percentages
  stats.confidenceDistribution.high = ((stats.confidenceDistribution.high / n) * 100).toFixed(1) + '%';
  stats.confidenceDistribution.medium = ((stats.confidenceDistribution.medium / n) * 100).toFixed(1) + '%';
  stats.confidenceDistribution.low = ((stats.confidenceDistribution.low / n) * 100).toFixed(1) + '%';
  
  // Average stage latencies
  for (const stage in stats.stageLatencies) {
    stats.stageLatencies[stage] = Math.round(stats.stageLatencies[stage] / n);
  }

  return stats;
}

// ============================================================================
// USAGE EXAMPLES
// ============================================================================

/**
 * EXAMPLE 1: Basic usage
 * 
 * import { answerQuestion } from './rag_pipeline.js';
 * 
 * const result = await answerQuestion("Am I eligible for Bürgergeld?");
 * 
 * console.log('Question:', result.processedQuery.original);
 * console.log('Answer:', result.answer);
 * console.log('Confidence:', result.confidence);
 * console.log('Sources:', result.sources.map(s => s.title).join(', '));
 */

/**
 * EXAMPLE 2: Customized pipeline
 * 
 * const result = await answerQuestion(
 *   "How do I apply for Wohngeld?",
 *   {
 *     topK: 15,                  // Retrieve more documents
 *     audience: 'simple',        // Simple language
 *     includeFollowUp: true,     // Get follow-up questions
 *     model: 'gpt-4o',          // Use GPT-4o for better quality
 *   }
 * );
 * 
 * console.log('Answer:', result.answer);
 * console.log('Follow-up questions:', result.followUpQuestions);
 */

/**
 * EXAMPLE 3: Technical audience
 * 
 * const result = await answerQuestion(
 *   "What are the specific income thresholds for Bürgergeld eligibility?",
 *   {
 *     audience: 'technical',
 *     contextTokens: 12000,      // More context for detail
 *     temperature: 0.1,          // Very deterministic
 *   }
 * );
 * 
 * // Gets detailed, precise answer with specific numbers and regulations
 */

/**
 * EXAMPLE 4: Batch processing for FAQ
 * 
 * const faqQuestions = [
 *   "What is Bürgergeld?",
 *   "Who is eligible for Bürgergeld?",
 *   "How much is Bürgergeld?",
 *   "How do I apply for Bürgergeld?",
 *   "What documents do I need?",
 * ];
 * 
 * const results = await answerQuestions(faqQuestions, {
 *   audience: 'simple',
 *   includeFollowUp: false,
 * });
 * 
 * // Generate FAQ page
 * results.forEach((result, i) => {
 *   console.log(`## ${faqQuestions[i]}\n`);
 *   console.log(`${result.answer}\n`);
 *   console.log(`Sources: ${result.sources.map(s => s.citation).join('; ')}\n`);
 * });
 */

/**
 * EXAMPLE 5: Monitoring and optimization
 * 
 * const testQuestions = [...]; // 100 test questions
 * const results = await answerQuestions(testQuestions);
 * const stats = getPipelineStats(results);
 * 
 * console.log('Performance Report:');
 * console.log('==================');
 * console.log(`Average latency: ${stats.avgLatency}ms`);
 * console.log(`Stage breakdown:`);
 * console.log(`  Query: ${stats.stageLatencies.query}ms`);
 * console.log(`  Retrieval: ${stats.stageLatencies.retrieval}ms`);
 * console.log(`  Context: ${stats.stageLatencies.context}ms`);
 * console.log(`  Generation: ${stats.stageLatencies.generation}ms`);
 * console.log(`\nQuality:`);
 * console.log(`  High confidence: ${stats.confidenceDistribution.high}`);
 * console.log(`  Medium confidence: ${stats.confidenceDistribution.medium}`);
 * console.log(`  Low confidence: ${stats.confidenceDistribution.low}`);
 * console.log(`\nCost:`);
 * console.log(`  Total: ${stats.totalCost}`);
 * console.log(`  Per query: $${(parseFloat(stats.totalCost.replace('$', '')) / stats.totalQueries).toFixed(6)}`);
 * 
 * // Use stats to optimize:
 * // - If generation is slow → use gpt-4o-mini
 * // - If confidence is low → improve retrieval or context
 * // - If cost is high → reduce topK or contextTokens
 */

/**
 * EXAMPLE 6: Using custom search client
 * 
 * import { SemanticSearch } from '../embeddings/semantic_search.js';
 * 
 * // Initialize with custom settings
 * const searchClient = new SemanticSearch({
 *   storePath: './custom-vectors.json',
 *   defaultTopK: 15,
 * });
 * 
 * // Use in pipeline
 * const result = await answerQuestion(
 *   "What benefits am I eligible for?",
 *   { searchClient }
 * );
 */

/**
 * EXAMPLE 7: Error handling
 * 
 * try {
 *   const result = await answerQuestion("What is Bürgergeld?");
 *   
 *   if (result.confidence === 'low') {
 *     console.warn('Low confidence answer - may need human review');
 *   }
 *   
 *   if (!result.validation.passed) {
 *     console.warn('Quality issues:', result.validation.warnings);
 *   }
 *   
 *   if (result.metadata.error) {
 *     console.error('Pipeline had errors:', result.metadata.error);
 *   }
 *   
 * } catch (error) {
 *   console.error('Fatal error:', error);
 * }
 */
