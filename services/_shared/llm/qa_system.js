/**
 * Systemfehler - Question Answering System
 * 
 * This module implements an intelligent Q&A system for social benefits using
 * RAG (Retrieval-Augmented Generation).
 * 
 * ============================================================================
 * WHAT IS A Q&A SYSTEM?
 * ============================================================================
 * 
 * A Q&A (Question Answering) system takes natural language questions and
 * provides direct, accurate answers. Unlike search engines that return documents,
 * Q&A systems return specific answers.
 * 
 * EXAMPLE:
 * Question: "How much is Bürgergeld for a single person?"
 * Search engine: [List of documents about Bürgergeld]
 * Q&A system: "€563 per month for single persons (as of 2024)"
 * 
 * ============================================================================
 * Q&A ARCHITECTURE: RAG (RETRIEVAL-AUGMENTED GENERATION)
 * ============================================================================
 * 
 * RAG combines information retrieval with LLM generation:
 * 
 * TRADITIONAL Q&A:
 * Question → LLM → Answer
 * Problems: Hallucinations, outdated info, no source citations
 * 
 * RAG Q&A:
 * Question → [Retrieve relevant docs] → [LLM with context] → Answer + Sources
 * Benefits: Factual, current, traceable
 * 
 * PIPELINE STAGES:
 * 
 * 1. QUESTION PROCESSING:
 *    - Classify question type (eligibility, how-to, comparison)
 *    - Extract entities (benefit names, amounts)
 *    - Expand query (add synonyms)
 * 
 * 2. RETRIEVAL:
 *    - Search vector database for relevant documents
 *    - Rank by relevance
 *    - Retrieve top K documents
 * 
 * 3. CONTEXT BUILDING:
 *    - Format retrieved documents
 *    - Add metadata (source, date)
 *    - Truncate to fit context window
 * 
 * 4. ANSWER GENERATION:
 *    - Send question + context to LLM
 *    - Generate natural language answer
 *    - Extract source citations
 * 
 * ============================================================================
 * QUESTION TYPES
 * ============================================================================
 * 
 * Different questions require different handling:
 * 
 * 1. ELIGIBILITY QUESTIONS:
 *    "Am I eligible for X?"
 *    "Can I get Y if I'm Z?"
 *    Need: Criteria matching, conditional logic
 * 
 * 2. HOW-TO QUESTIONS:
 *    "How do I apply for X?"
 *    "What documents do I need?"
 *    Need: Step-by-step procedures, checklists
 * 
 * 3. FACTUAL QUESTIONS:
 *    "What is the amount of X?"
 *    "When does Y expire?"
 *    Need: Specific data extraction
 * 
 * 4. COMPARISON QUESTIONS:
 *    "What's the difference between X and Y?"
 *    "Should I apply for X or Y?"
 *    Need: Multi-document analysis
 * 
 * 5. EXPLORATORY QUESTIONS:
 *    "What benefits are available?"
 *    "What help can I get?"
 *    Need: Broad search, categorization
 * 
 * ============================================================================
 * CONVERSATIONAL Q&A
 * ============================================================================
 * 
 * Multi-turn conversations require maintaining state:
 * 
 * Turn 1: "What is Bürgergeld?"
 * Answer: "Bürgergeld is financial support for job seekers..."
 * 
 * Turn 2: "How do I apply?" [refers to Bürgergeld from Turn 1]
 * Answer: "To apply for Bürgergeld, contact your local Jobcenter..."
 * 
 * CHALLENGES:
 * - Coreference resolution ("it", "that", "this")
 * - Context accumulation (conversation gets longer)
 * - Topic tracking (detecting topic changes)
 * - Memory management (what to keep, what to discard)
 * 
 * ============================================================================
 * LEARNING RESOURCES
 * ============================================================================
 * - RAG overview: https://arxiv.org/abs/2005.11401
 * - Question classification: https://arxiv.org/abs/1909.00434
 * - Conversational AI: https://arxiv.org/abs/1809.08267
 * 
 * @see rag_pipeline.js for the RAG implementation
 * @see query_processor.js for question processing
 * @see answer_generator.js for answer generation
 */

import { createChatCompletion } from './llm_client.js';
import { trackCost } from './cost_tracker.js';
import { answerQuestion as ragAnswerQuestion } from '../rag/rag_pipeline.js';
import { processQuery } from '../rag/query_processor.js';
import { buildContext } from '../rag/context_builder.js';
import { generateAnswer } from '../rag/answer_generator.js';

/**
 * Question type classifications
 * 
 * LEARNING NOTE: Classifying questions helps us:
 * - Choose appropriate retrieval strategy
 * - Format prompts differently
 * - Set user expectations
 */
const QUESTION_TYPES = {
  eligibility: {
    name: 'Eligibility Check',
    keywords: ['kann ich', 'darf ich', 'habe ich anspruch', 'berechtigt', 'voraussetzung'],
    retrievalStrategy: 'focus_on_criteria',
    answerStyle: 'conditional',
  },
  howto: {
    name: 'How-To / Process',
    keywords: ['wie', 'wo', 'beantragen', 'antrag', 'welche dokumente', 'schritte'],
    retrievalStrategy: 'focus_on_procedures',
    answerStyle: 'step_by_step',
  },
  factual: {
    name: 'Factual Information',
    keywords: ['was ist', 'wie viel', 'wie hoch', 'wann', 'wer', 'betrag', 'höhe'],
    retrievalStrategy: 'focus_on_facts',
    answerStyle: 'direct',
  },
  comparison: {
    name: 'Comparison',
    keywords: ['unterschied', 'vergleich', 'besser', 'oder', 'versus', 'vs'],
    retrievalStrategy: 'multi_document',
    answerStyle: 'comparative',
  },
  exploratory: {
    name: 'Exploratory / Discovery',
    keywords: ['welche', 'alle', 'gibt es', 'übersicht', 'möglichkeiten'],
    retrievalStrategy: 'broad_search',
    answerStyle: 'list',
  },
};

/**
 * In-memory conversation storage
 * 
 * LEARNING NOTE: In production, use a database (Redis, PostgreSQL).
 * In-memory storage is fine for learning and development.
 * 
 * CONVERSATION STRUCTURE:
 * {
 *   conversationId: {
 *     messages: [{role, content, timestamp}],
 *     context: {extractedEntities, currentTopic},
 *     created: timestamp,
 *     lastActivity: timestamp
 *   }
 * }
 */
const conversations = new Map();

/**
 * Default options
 */
const DEFAULT_OPTIONS = {
  model: 'gpt-4o-mini',
  temperature: 0.2,  // Low for factual accuracy
  maxRetrievalDocs: 5,
  includeSourceCitations: true,
  conversationTTL: 30 * 60 * 1000, // 30 minutes
};

/**
 * Ask a question about social benefits
 * 
 * MAIN Q&A FUNCTION
 * =================
 * 
 * LEARNING NOTE: RAG Q&A FLOW
 * ============================
 * 
 * This function implements the complete RAG pipeline:
 * 
 * 1. QUESTION CLASSIFICATION
 *    Determine question type to guide retrieval and generation
 * 
 * 2. QUERY PROCESSING
 *    - Extract entities (benefit names, amounts)
 *    - Expand query (synonyms, related terms)
 *    - Generate embeddings for semantic search
 * 
 * 3. RETRIEVAL
 *    - Search vector database
 *    - Rank by relevance
 *    - Filter by metadata if needed
 * 
 * 4. CONTEXT BUILDING
 *    - Format retrieved documents
 *    - Add metadata and citations
 *    - Ensure fits in context window
 * 
 * 5. ANSWER GENERATION
 *    - Craft prompt with question + context
 *    - Generate answer using LLM
 *    - Extract source citations
 * 
 * 6. POST-PROCESSING
 *    - Format answer for display
 *    - Add confidence score
 *    - Return sources
 * 
 * LEARNING NOTE: ANSWER QUALITY FACTORS
 * ======================================
 * 
 * What makes a good Q&A answer?
 * 
 * 1. CORRECTNESS: Factually accurate
 * 2. COMPLETENESS: Answers the full question
 * 3. RELEVANCE: Directly addresses the question
 * 4. CLARITY: Easy to understand
 * 5. CONCISENESS: No unnecessary information
 * 6. CITATIONS: Shows where information came from
 * 7. ACTIONABLE: Tells user what to do next
 * 
 * LEARNING NOTE: HANDLING UNCERTAINTY
 * ===================================
 * 
 * When the system is uncertain:
 * - Say "I don't know" rather than guess
 * - Explain what information is missing
 * - Suggest how to get the answer
 * - Provide related information that might help
 * 
 * Example:
 * Q: "How much is Bürgergeld for someone with 3 cats?"
 * Bad: "€563 per month" [ignores the cats, may be wrong]
 * Good: "I don't have specific information about pet-related Bürgergeld
 *       adjustments. The base amount is €563/month for single persons.
 *       Contact your Jobcenter to ask about pet-related considerations."
 * 
 * @param {string} question - User's question
 * @param {Object} options - Q&A options
 * @param {string} options.model - LLM model to use
 * @param {number} options.temperature - Generation temperature
 * @param {number} options.maxRetrievalDocs - Number of docs to retrieve
 * @param {boolean} options.includeSourceCitations - Include sources in answer
 * @param {Object} options.context - Additional context (user profile, etc.)
 * @returns {Promise<Object>} Answer with metadata and sources
 * 
 * @example
 * const result = await askQuestion("Wie viel ist das Bürgergeld?");
 * console.log(result.answer);
 * console.log('Sources:', result.sources);
 * console.log('Confidence:', result.confidence);
 */
export async function askQuestion(question, options = {}) {
  if (!question || typeof question !== 'string') {
    throw new Error('Question must be a non-empty string');
  }

  const config = { ...DEFAULT_OPTIONS, ...options };

  try {
    const startTime = Date.now();

    // Step 1: Classify question type
    const questionType = await classifyQuestion(question);
    console.log(`Question type: ${questionType.type}`);

    // Step 2: Process query (expand, extract entities)
    // LEARNING NOTE: This uses the RAG pipeline's query processor
    const processedQuery = await processQuery(question, {
      questionType: questionType.type,
    });

    // Step 3: Retrieve relevant documents
    // LEARNING NOTE: This searches the vector database
    const retrievalResults = await retrieveRelevantDocs(processedQuery, {
      maxDocs: config.maxRetrievalDocs,
      strategy: questionType.retrievalStrategy,
    });

    if (retrievalResults.documents.length === 0) {
      return {
        answer: "Entschuldigung, ich konnte keine relevanten Informationen zu Ihrer Frage finden. Könnten Sie die Frage anders formulieren oder präzisieren?",
        confidence: 0.0,
        sources: [],
        questionType: questionType.type,
        metadata: {
          retrievedDocs: 0,
          duration: Date.now() - startTime,
        },
      };
    }

    // Step 4: Build context from retrieved documents
    const context = buildContext(retrievalResults.documents, {
      maxTokens: 3000, // Leave room for question and answer
      includeCitations: config.includeSourceCitations,
    });

    // Step 5: Generate answer using LLM
    const answerResult = await generateAnswer(question, context, {
      model: config.model,
      temperature: config.temperature,
      answerStyle: questionType.answerStyle,
      userContext: config.context,
    });

    // Step 6: Track cost
    await trackCost({
      feature: 'qa_system',
      model: config.model,
      inputTokens: answerResult.usage.input,
      outputTokens: answerResult.usage.output,
      metadata: {
        questionType: questionType.type,
        retrievedDocs: retrievalResults.documents.length,
      }
    });

    const duration = Date.now() - startTime;

    return {
      answer: answerResult.answer,
      confidence: answerResult.confidence,
      sources: retrievalResults.documents.map(doc => ({
        title: doc.title,
        url: doc.url,
        excerpt: doc.excerpt,
        relevance: doc.score,
      })),
      questionType: questionType.type,
      metadata: {
        retrievedDocs: retrievalResults.documents.length,
        duration,
        model: config.model,
        tokens: answerResult.usage,
      },
    };

  } catch (error) {
    throw new Error(`Q&A failed: ${error.message}`);
  }
}

/**
 * Classify question type
 * 
 * QUESTION CLASSIFICATION
 * =======================
 * 
 * LEARNING NOTE: Classification helps us tailor the response.
 * 
 * APPROACHES:
 * 
 * 1. RULE-BASED (simple, fast):
 *    - Keyword matching
 *    - Regex patterns
 *    - Good for: Clear patterns
 * 
 * 2. ML-BASED (accurate, requires training):
 *    - Train classifier on labeled questions
 *    - Good for: Production systems with lots of data
 * 
 * 3. LLM-BASED (flexible, no training needed):
 *    - Ask LLM to classify
 *    - Good for: Rapid development, complex taxonomies
 * 
 * This implementation uses a hybrid: keyword matching with LLM fallback.
 * 
 * @param {string} question - Question to classify
 * @returns {Promise<Object>} Classification result
 */
async function classifyQuestion(question) {
  const questionLower = question.toLowerCase();

  // Try keyword matching first (fast)
  for (const [type, spec] of Object.entries(QUESTION_TYPES)) {
    if (spec.keywords.some(keyword => questionLower.includes(keyword))) {
      return {
        type,
        name: spec.name,
        retrievalStrategy: spec.retrievalStrategy,
        answerStyle: spec.answerStyle,
        confidence: 0.8,
        method: 'keyword',
      };
    }
  }

  // Fallback to LLM classification (slower but more accurate)
  try {
    const systemPrompt = `Du bist ein Experte für Fragetyp-Klassifikation.

Klassifiziere die Frage in eine dieser Kategorien:
- eligibility: Fragen zu Berechtigung/Anspruch
- howto: Fragen zu Prozessen/Anträgen
- factual: Faktenfragen (Was, Wieviel, Wann)
- comparison: Vergleichsfragen
- exploratory: Entdeckungsfragen (Übersicht, Optionen)

Antworte NUR mit dem Kategorie-Namen.`;

    const response = await createChatCompletion([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: question }
    ], {
      model: 'gpt-4o-mini',
      temperature: 0,
      max_tokens: 20,
    });

    const type = response.choices[0].message.content.trim().toLowerCase();
    const spec = QUESTION_TYPES[type];

    if (spec) {
      return {
        type,
        name: spec.name,
        retrievalStrategy: spec.retrievalStrategy,
        answerStyle: spec.answerStyle,
        confidence: 0.9,
        method: 'llm',
      };
    }
  } catch (error) {
    console.warn('LLM classification failed:', error.message);
  }

  // Default to factual if classification fails
  return {
    type: 'factual',
    name: QUESTION_TYPES.factual.name,
    retrievalStrategy: QUESTION_TYPES.factual.retrievalStrategy,
    answerStyle: QUESTION_TYPES.factual.answerStyle,
    confidence: 0.5,
    method: 'default',
  };
}

/**
 * Retrieve relevant documents
 * 
 * LEARNING NOTE: This is a placeholder for the actual RAG retrieval.
 * In production, this would use the semantic search service.
 * 
 * RETRIEVAL STRATEGIES:
 * 
 * 1. SEMANTIC SEARCH:
 *    - Convert query to embedding
 *    - Find nearest neighbors in vector DB
 *    - Best for: General similarity
 * 
 * 2. KEYWORD SEARCH:
 *    - BM25 or TF-IDF
 *    - Exact term matching
 *    - Best for: Specific terms, names
 * 
 * 3. HYBRID SEARCH:
 *    - Combine semantic + keyword
 *    - Rerank results
 *    - BEST for production
 * 
 * 4. METADATA FILTERING:
 *    - Pre-filter by type, date, etc.
 *    - Then search within filtered set
 *    - Best for: Scoped searches
 */
async function retrieveRelevantDocs(processedQuery, options) {
  // LEARNING NOTE: In production, this would call the RAG pipeline's retrieval
  // For now, return a placeholder that indicates where the integration point is
  
  console.log(`[PLACEHOLDER] Would retrieve ${options.maxDocs} documents using ${options.strategy} strategy`);
  console.log(`[PLACEHOLDER] Processed query:`, processedQuery);

  // TODO: Integrate with actual RAG pipeline
  // const results = await semanticSearch.search(processedQuery.embedding, {
  //   limit: options.maxDocs,
  //   filter: { type: 'benefits' }
  // });

  // For now, return empty results to demonstrate the flow
  return {
    documents: [],
    totalFound: 0,
    query: processedQuery,
  };
}

/**
 * Start a conversation
 * 
 * CONVERSATION INITIALIZATION
 * ===========================
 * 
 * LEARNING NOTE: Why separate conversation initialization?
 * - Allocate resources (DB connections, caches)
 * - Set initial context (user info, preferences)
 * - Generate conversation ID
 * - Initialize tracking
 * 
 * @param {Object} options - Conversation options
 * @param {Object} options.userContext - User information (age, location, etc.)
 * @returns {Object} Conversation session
 * 
 * @example
 * const conversation = startConversation({
 *   userContext: {
 *     age: 28,
 *     location: 'Berlin',
 *     employmentStatus: 'unemployed'
 *   }
 * });
 * console.log('Conversation ID:', conversation.id);
 */
export function startConversation(options = {}) {
  const conversationId = generateConversationId();
  const now = Date.now();

  const conversation = {
    id: conversationId,
    messages: [],
    context: {
      userContext: options.userContext || {},
      extractedEntities: {},
      currentTopic: null,
    },
    created: now,
    lastActivity: now,
  };

  conversations.set(conversationId, conversation);

  // LEARNING NOTE: Auto-cleanup old conversations
  cleanupOldConversations();

  return {
    id: conversationId,
    created: now,
  };
}

/**
 * Continue a conversation with a follow-up question
 * 
 * CONVERSATIONAL Q&A
 * ==================
 * 
 * LEARNING NOTE: HANDLING CONTEXT IN CONVERSATIONS
 * =================================================
 * 
 * Challenges:
 * 
 * 1. COREFERENCE RESOLUTION:
 *    User: "How do I apply for Bürgergeld?"
 *    Answer: "Contact your Jobcenter..."
 *    User: "Where is it?" [What is "it"? → The Jobcenter]
 * 
 * 2. IMPLICIT CONTEXT:
 *    User: "What benefits are available?"
 *    Answer: "Bürgergeld, Wohngeld..."
 *    User: "Tell me more about the first one" [Which? → Bürgergeld]
 * 
 * 3. TOPIC TRACKING:
 *    User: "What is Bürgergeld?"
 *    Answer: "..."
 *    User: "What about Wohngeld?" [Topic changed!]
 * 
 * 4. CONTEXT ACCUMULATION:
 *    Each turn adds messages → context grows → hits token limit
 *    Solution: Summarize or prune old messages
 * 
 * STRATEGIES:
 * 
 * 1. FULL HISTORY:
 *    - Include all previous messages
 *    - Simple, preserves everything
 *    - Problem: Exceeds token limits
 * 
 * 2. SLIDING WINDOW:
 *    - Keep last N messages
 *    - Bounded memory
 *    - Problem: Loses distant context
 * 
 * 3. SUMMARIZATION:
 *    - Summarize old messages
 *    - Keep recent messages verbatim
 *    - BEST for long conversations
 * 
 * 4. ENTITY TRACKING:
 *    - Extract and track mentioned entities
 *    - Use entity references instead of full history
 *    - Good for task-oriented dialogs
 * 
 * This implementation uses strategy #2 (sliding window) with entity tracking.
 * 
 * @param {string} conversationId - Conversation ID
 * @param {string} question - Follow-up question
 * @param {Object} options - Q&A options
 * @returns {Promise<Object>} Answer with conversation context
 * 
 * @example
 * const conv = startConversation();
 * 
 * const answer1 = await continueConversation(
 *   conv.id,
 *   "Was ist Bürgergeld?"
 * );
 * 
 * const answer2 = await continueConversation(
 *   conv.id,
 *   "Wie beantrage ich das?" // "das" refers to Bürgergeld
 * );
 */
export async function continueConversation(conversationId, question, options = {}) {
  if (!conversationId || typeof conversationId !== 'string') {
    throw new Error('Conversation ID must be a non-empty string');
  }

  if (!question || typeof question !== 'string') {
    throw new Error('Question must be a non-empty string');
  }

  const conversation = conversations.get(conversationId);

  if (!conversation) {
    throw new Error(`Conversation not found: ${conversationId}. It may have expired.`);
  }

  try {
    // Update activity timestamp
    conversation.lastActivity = Date.now();

    // LEARNING NOTE: Resolve references using conversation context
    const resolvedQuestion = await resolveReferences(question, conversation);

    // Add user question to history
    conversation.messages.push({
      role: 'user',
      content: resolvedQuestion,
      originalContent: question,
      timestamp: Date.now(),
    });

    // Get answer using Q&A system with conversation context
    const result = await askQuestion(resolvedQuestion, {
      ...options,
      context: conversation.context.userContext,
      conversationHistory: getRecentMessages(conversation, 3), // Last 3 turns
    });

    // Add assistant answer to history
    conversation.messages.push({
      role: 'assistant',
      content: result.answer,
      timestamp: Date.now(),
      metadata: result.metadata,
    });

    // Update conversation context with new entities
    updateConversationContext(conversation, result);

    // Prune old messages if conversation is getting long
    if (conversation.messages.length > 20) {
      pruneConversation(conversation);
    }

    return {
      ...result,
      conversationId,
      turnNumber: Math.floor(conversation.messages.length / 2),
    };

  } catch (error) {
    throw new Error(`Conversation failed: ${error.message}`);
  }
}

/**
 * Resolve references in follow-up questions
 * 
 * COREFERENCE RESOLUTION
 * ======================
 * 
 * LEARNING NOTE: This is a simplified implementation.
 * Production systems use sophisticated NLP models.
 * 
 * SIMPLE STRATEGY:
 * - Track last mentioned entities
 * - Replace pronouns with entity names
 * - Use LLM to reformulate question with full context
 * 
 * @param {string} question - Question with potential references
 * @param {Object} conversation - Conversation state
 * @returns {Promise<string>} Question with resolved references
 */
async function resolveReferences(question, conversation) {
  const questionLower = question.toLowerCase();

  // Check if question has references that need resolution
  const hasReference = /\b(das|dies|es|er|sie|dort|dafür|damit)\b/i.test(question);

  if (!hasReference || conversation.messages.length === 0) {
    return question; // No resolution needed
  }

  // Use LLM to resolve references
  try {
    const recentMessages = getRecentMessages(conversation, 2);
    const contextStr = recentMessages.map(m => `${m.role}: ${m.content}`).join('\n');

    const systemPrompt = `Du bist ein Experte für Kontextverstehen in Gesprächen.

Deine Aufgabe: Formuliere die Folgefrage so um, dass sie ohne vorherigen Kontext verständlich ist.
Ersetze Pronomen und Verweise durch konkrete Begriffe aus dem Kontext.

Beispiel:
Kontext:
user: Was ist Bürgergeld?
assistant: Bürgergeld ist eine Sozialleistung...
Folgefrage: Wie beantrage ich das?
Umformuliert: Wie beantrage ich Bürgergeld?

Antworte NUR mit der umformulierten Frage, ohne Erklärungen.`;

    const userPrompt = `Kontext:
${contextStr}

Folgefrage: ${question}

Umformuliert:`;

    const response = await createChatCompletion([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ], {
      model: 'gpt-4o-mini',
      temperature: 0,
      max_tokens: 100,
    });

    return response.choices[0].message.content.trim();

  } catch (error) {
    console.warn('Reference resolution failed:', error.message);
    return question; // Fallback to original question
  }
}

/**
 * Get recent messages from conversation
 * 
 * LEARNING NOTE: We use a sliding window to keep context manageable.
 * Only include last N turns in the context.
 */
function getRecentMessages(conversation, numTurns = 3) {
  // Each turn = 1 user message + 1 assistant message = 2 messages
  const numMessages = numTurns * 2;
  return conversation.messages.slice(-numMessages);
}

/**
 * Update conversation context with new information
 * 
 * ENTITY TRACKING
 * ===============
 * 
 * LEARNING NOTE: We track mentioned entities to:
 * - Resolve future references
 * - Maintain topic awareness
 * - Personalize responses
 */
function updateConversationContext(conversation, result) {
  // Extract topic from question type
  if (result.questionType) {
    conversation.context.currentTopic = result.questionType;
  }

  // Extract benefit names from sources
  if (result.sources && result.sources.length > 0) {
    result.sources.forEach(source => {
      if (source.title) {
        if (!conversation.context.extractedEntities.benefits) {
          conversation.context.extractedEntities.benefits = [];
        }
        if (!conversation.context.extractedEntities.benefits.includes(source.title)) {
          conversation.context.extractedEntities.benefits.push(source.title);
        }
      }
    });
  }
}

/**
 * Prune old messages from conversation
 * 
 * LEARNING NOTE: Keep conversation size bounded.
 * Strategy: Keep first message (sets context) + recent N messages.
 */
function pruneConversation(conversation) {
  const KEEP_FIRST = 2;  // Keep first turn
  const KEEP_RECENT = 10; // Keep last 5 turns

  if (conversation.messages.length > KEEP_FIRST + KEEP_RECENT) {
    const firstMessages = conversation.messages.slice(0, KEEP_FIRST);
    const recentMessages = conversation.messages.slice(-KEEP_RECENT);
    conversation.messages = [...firstMessages, ...recentMessages];
  }
}

/**
 * Get conversation history
 * 
 * @param {string} conversationId - Conversation ID
 * @returns {Object|null} Conversation history or null if not found
 * 
 * @example
 * const history = getConversationHistory(conv.id);
 * console.log(`Turns: ${history.messages.length / 2}`);
 * history.messages.forEach(msg => {
 *   console.log(`${msg.role}: ${msg.content}`);
 * });
 */
export function getConversationHistory(conversationId) {
  const conversation = conversations.get(conversationId);
  
  if (!conversation) {
    return null;
  }

  return {
    id: conversation.id,
    created: conversation.created,
    lastActivity: conversation.lastActivity,
    messages: conversation.messages,
    context: conversation.context,
    turnCount: Math.floor(conversation.messages.length / 2),
  };
}

/**
 * Delete conversation
 * 
 * @param {string} conversationId - Conversation ID
 * @returns {boolean} True if deleted, false if not found
 */
export function deleteConversation(conversationId) {
  return conversations.delete(conversationId);
}

/**
 * Generate unique conversation ID
 * 
 * LEARNING NOTE: Simple ID generation for demo purposes.
 * Production systems should use UUIDs or database-generated IDs.
 */
function generateConversationId() {
  return `conv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Cleanup old conversations
 * 
 * LEARNING NOTE: Prevent memory leaks by removing expired conversations.
 * Run periodically or on new conversation creation.
 */
function cleanupOldConversations() {
  const now = Date.now();
  const TTL = DEFAULT_OPTIONS.conversationTTL;

  for (const [id, conv] of conversations.entries()) {
    if (now - conv.lastActivity > TTL) {
      conversations.delete(id);
      console.log(`Cleaned up expired conversation: ${id}`);
    }
  }
}

/**
 * USAGE EXAMPLES
 * ==============
 */

// Example 1: Single question
async function example1() {
  const result = await askQuestion("Wie viel ist das Bürgergeld für Alleinstehende?");
  
  console.log('Answer:', result.answer);
  console.log('Confidence:', result.confidence);
  console.log('Sources:');
  result.sources.forEach(source => {
    console.log(`  - ${source.title}: ${source.excerpt}`);
  });
}

// Example 2: Conversational Q&A
async function example2() {
  // Start conversation
  const conv = startConversation({
    userContext: {
      age: 30,
      location: 'Berlin',
      employmentStatus: 'unemployed'
    }
  });

  // Turn 1
  const answer1 = await continueConversation(
    conv.id,
    "Was ist Bürgergeld?"
  );
  console.log('Q1:', answer1.answer);

  // Turn 2 (with reference)
  const answer2 = await continueConversation(
    conv.id,
    "Wie beantrage ich das?" // "das" = Bürgergeld
  );
  console.log('Q2:', answer2.answer);

  // Turn 3
  const answer3 = await continueConversation(
    conv.id,
    "Welche Dokumente brauche ich dafür?"
  );
  console.log('Q3:', answer3.answer);

  // View history
  const history = getConversationHistory(conv.id);
  console.log(`Conversation had ${history.turnCount} turns`);
}

// Example 3: Different question types
async function example3() {
  // Eligibility
  const q1 = await askQuestion("Kann ich Bürgergeld bekommen wenn ich 25 Jahre alt bin?");
  console.log('Eligibility:', q1.answer);

  // How-to
  const q2 = await askQuestion("Wie beantrage ich Wohngeld?");
  console.log('How-to:', q2.answer);

  // Factual
  const q3 = await askQuestion("Wie hoch ist das Kindergeld?");
  console.log('Factual:', q3.answer);

  // Comparison
  const q4 = await askQuestion("Was ist der Unterschied zwischen Bürgergeld und Wohngeld?");
  console.log('Comparison:', q4.answer);
}

export default {
  askQuestion,
  startConversation,
  continueConversation,
  getConversationHistory,
  deleteConversation,
};
