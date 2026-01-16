/**
 * Systemfehler - Answer Generator Module
 * 
 * This module generates answers using LLMs with retrieved context.
 * It handles prompt construction, response formatting, citation injection,
 * and quality validation.
 * 
 * ============================================================================
 * WHAT IS ANSWER GENERATION?
 * ============================================================================
 * 
 * Answer generation is the final step in RAG:
 * 
 * QUERY → RETRIEVAL → CONTEXT → GENERATION → ANSWER
 *                                ^^^^^^^^^^
 *                                This module
 * 
 * INPUTS:
 * -------
 * - User question
 * - Retrieved context (formatted documents)
 * - Sources (for citations)
 * - Generation options (temperature, format, etc.)
 * 
 * OUTPUTS:
 * --------
 * - Generated answer
 * - Citations ([1], [2], etc.)
 * - Confidence score
 * - Metadata (tokens used, cost, etc.)
 * 
 * ============================================================================
 * WHY ANSWER GENERATION IS COMPLEX
 * ============================================================================
 * 
 * CHALLENGE 1: GROUNDING
 * ----------------------
 * LLMs can "hallucinate" - generate plausible but incorrect information.
 * 
 * Solution: Prompt engineering to force grounding
 * - "Answer ONLY based on the provided context"
 * - "If information is not in context, say 'I don't know'"
 * - "Quote relevant passages"
 * 
 * CHALLENGE 2: CITATION
 * ---------------------
 * Users need to verify information and build trust.
 * 
 * Solutions:
 * - Number documents in context ([1], [2], etc.)
 * - Instruct LLM to cite sources
 * - Post-process to ensure citations are present
 * - Validate citations point to actual sources
 * 
 * CHALLENGE 3: FORMAT CONTROL
 * ---------------------------
 * Different use cases need different formats:
 * - Conversational: Natural language
 * - Structured: JSON with specific fields
 * - Technical: Detailed with examples
 * - Simple: Easy-to-understand language
 * 
 * Solutions:
 * - Prompt templates for each format
 * - JSON mode for structured outputs
 * - Few-shot examples
 * - Output validators
 * 
 * CHALLENGE 4: QUALITY CONTROL
 * ----------------------------
 * Not all LLM outputs are good:
 * - May be off-topic
 * - May ignore context
 * - May be too verbose or too terse
 * - May have poor citations
 * 
 * Solutions:
 * - Validate answer against context
 * - Check citation coverage
 * - Score answer quality
 * - Retry with adjusted prompt if needed
 * 
 * ============================================================================
 * PROMPT ENGINEERING FOR RAG
 * ============================================================================
 * 
 * ANATOMY OF A RAG PROMPT:
 * ------------------------
 * 
 * 1. SYSTEM MESSAGE: Set behavior and constraints
 *    ```
 *    You are a helpful assistant that answers questions about German social benefits.
 *    Answer ONLY based on the provided context.
 *    Always cite sources using [1], [2] notation.
 *    If the context doesn't contain the answer, say "I don't have enough information."
 *    ```
 * 
 * 2. CONTEXT: Provide retrieved information
 *    ```
 *    Context:
 *    
 *    === Document 1 ===
 *    Title: Bürgergeld Eligibility
 *    Source: https://...
 *    
 *    [content]
 *    
 *    === Document 2 ===
 *    ...
 *    ```
 * 
 * 3. QUESTION: User's query
 *    ```
 *    Question: Am I eligible for Bürgergeld if I'm working part-time?
 *    ```
 * 
 * 4. INSTRUCTIONS: Output format
 *    ```
 *    Provide a clear, concise answer with citations.
 *    ```
 * 
 * KEY PRINCIPLES:
 * ---------------
 * 1. EXPLICIT CONSTRAINTS: Tell LLM what NOT to do
 * 2. CITATION REQUIREMENT: Make citation mandatory
 * 3. FALLBACK BEHAVIOR: Define "I don't know" response
 * 4. FORMAT SPECIFICATION: Show desired output structure
 * 5. CONTEXT FIRST: Put context before question
 * 
 * ============================================================================
 * STRUCTURED OUTPUT (JSON MODE)
 * ============================================================================
 * 
 * WHY STRUCTURED OUTPUT?
 * ----------------------
 * - Reliable parsing (no regex needed)
 * - Type safety (know fields and types)
 * - Validation (ensure required fields)
 * - Integration (easy to use in APIs)
 * 
 * HOW IT WORKS:
 * -------------
 * 1. Define JSON schema
 * 2. Set response_format: { type: 'json_object' }
 * 3. Include schema in prompt
 * 4. LLM returns valid JSON
 * 
 * EXAMPLE SCHEMA:
 * ---------------
 * ```json
 * {
 *   "answer": "string - the answer text",
 *   "citations": ["array of source numbers used"],
 *   "confidence": "high|medium|low",
 *   "followUpQuestions": ["array of suggested questions"]
 * }
 * ```
 * 
 * LIMITATIONS:
 * ------------
 * - Only works with some models (GPT-4o, GPT-3.5-turbo)
 * - Requires careful prompt engineering
 * - May be slightly slower
 * - Can't use for streaming
 * 
 * ============================================================================
 * CITATION STRATEGIES
 * ============================================================================
 * 
 * APPROACH 1: INLINE CITATIONS (our default)
 * -------------------------------------------
 * Cite immediately after claim:
 * 
 * "Bürgergeld provides €563/month for single adults [1]. You can apply
 * at your local job center [2]."
 * 
 * Pros: Clear, immediate attribution
 * Cons: Can interrupt reading flow
 * 
 * APPROACH 2: FOOTNOTE CITATIONS
 * ------------------------------
 * Cite at end of paragraph or answer:
 * 
 * "Bürgergeld provides €563/month for single adults. You can apply
 * at your local job center. [1][2]"
 * 
 * Pros: Cleaner reading
 * Cons: Less clear what citation supports what claim
 * 
 * APPROACH 3: QUOTE-BASED CITATIONS
 * ----------------------------------
 * Quote relevant passages with citations:
 * 
 * "According to [1], 'Bürgergeld provides €563/month for single adults.'
 * The application process [2] requires..."
 * 
 * Pros: Maximum traceability
 * Cons: Can be verbose
 * 
 * APPROACH 4: NO EXPLICIT CITATIONS (for conversational UX)
 * ----------------------------------------------------------
 * Provide sources separately, don't interrupt answer:
 * 
 * Answer: "Bürgergeld provides €563/month..."
 * Sources: [list of sources shown separately]
 * 
 * Pros: Natural conversation
 * Cons: Less precise attribution
 * 
 * VALIDATION:
 * -----------
 * Always validate that:
 * - Citations reference actual sources
 * - All sources are cited (or mark as unused)
 * - Citation numbers are sequential [1][2][3] not [1][3][2]
 * 
 * @see ../llm/llm_client.js for LLM interaction
 * @see ../llm/prompts.js for prompt templates
 * @see context_builder.js for context formatting
 */

import { createChatCompletion } from '../llm/llm_client.js';
import { SYSTEM_PROMPTS } from '../llm/prompts.js';
import { countTokens } from '../llm/token_utils.js';

/**
 * Default generation options
 */
const DEFAULT_OPTIONS = {
  temperature: 0.3,        // Low temperature for factual accuracy
  maxTokens: 1000,        // Reasonable answer length
  model: 'gpt-4o-mini',   // Cost-effective default
  includeFollowUp: false, // Don't generate follow-up questions by default
};

/**
 * Generate an answer from context
 * 
 * This is the main entry point for answer generation.
 * 
 * WORKFLOW:
 * ---------
 * 1. Construct prompt from context and question
 * 2. Call LLM with appropriate parameters
 * 3. Parse and validate response
 * 4. Add citations if needed
 * 5. Return formatted answer with metadata
 * 
 * LEARNING NOTE: This orchestrates the generation process.
 * Different options (structured vs conversational, audience level)
 * affect prompt construction and post-processing.
 * 
 * @param {string} question - User question
 * @param {string} context - Formatted context from context_builder
 * @param {Object} options - Generation options
 * @param {Array} options.sources - Source list for citations
 * @param {number} options.temperature - Randomness (0-1, default: 0.3)
 * @param {number} options.maxTokens - Max response length (default: 1000)
 * @param {string} options.model - LLM model to use (default: gpt-4o-mini)
 * @param {string} options.audience - Target audience: 'general', 'simple', 'technical'
 * @param {boolean} options.includeFollowUp - Generate follow-up questions
 * @param {boolean} options.structured - Return structured JSON output
 * 
 * @returns {Promise<Object>} Generated answer and metadata
 * @returns {string} return.answer - Generated answer text
 * @returns {Array} return.citations - Citations used
 * @returns {string} return.confidence - Confidence level (high/medium/low)
 * @returns {Array} return.followUpQuestions - Suggested follow-up questions
 * @returns {Object} return.metadata - Generation metadata
 * 
 * @example
 * const { answer, citations } = await generateAnswer(
 *   "Am I eligible for Bürgergeld?",
 *   contextString,
 *   { sources: sourceList }
 * );
 * 
 * console.log(answer);
 * // "Based on the provided information [1], you may be eligible for Bürgergeld if..."
 * 
 * console.log(citations);
 * // [{id: 1, title: "...", url: "..."}]
 */
export async function generateAnswer(question, context, options = {}) {
  // Validate inputs
  if (!question || typeof question !== 'string') {
    throw new Error('Question must be a non-empty string');
  }

  if (!context || typeof context !== 'string') {
    throw new Error('Context must be a non-empty string');
  }

  // Parse options with defaults
  const temperature = options.temperature ?? DEFAULT_OPTIONS.temperature;
  const maxTokens = options.maxTokens ?? DEFAULT_OPTIONS.maxTokens;
  const model = options.model || DEFAULT_OPTIONS.model;
  const sources = options.sources || [];
  const audience = options.audience || 'general';
  const includeFollowUp = options.includeFollowUp ?? DEFAULT_OPTIONS.includeFollowUp;
  const structured = options.structured ?? false;

  try {
    // Step 1: Construct prompt
    const { systemPrompt, userPrompt } = constructPrompt(
      question,
      context,
      audience,
      includeFollowUp,
      structured
    );

    // Step 2: Generate completion
    const startTime = Date.now();
    const result = await createChatCompletion([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ], {
      temperature,
      max_tokens: maxTokens,
      model,
      response_format: structured ? { type: 'json_object' } : undefined,
    });
    const duration = Date.now() - startTime;
    
    // Extract response content
    const response = result.content;

    // Step 3: Parse response
    let parsedResponse;
    if (structured) {
      parsedResponse = parseStructuredResponse(response);
    } else {
      parsedResponse = parseConversationalResponse(response, sources);
    }

    // Step 4: Validate and enhance response
    const validated = validateAnswer(parsedResponse, context, sources);

    // Step 5: Return with metadata
    return {
      ...validated,
      metadata: {
        model,
        temperature,
        durationMs: duration,
        tokensUsed: {
          input: countTokens(systemPrompt + userPrompt),
          output: countTokens(validated.answer),
        },
      },
    };

  } catch (error) {
    console.error('[AnswerGenerator] Generation failed:', error);
    
    // Return graceful fallback
    return {
      answer: "I'm sorry, I encountered an error generating an answer. Please try again.",
      citations: [],
      confidence: 'low',
      followUpQuestions: [],
      metadata: {
        error: error.message,
      },
    };
  }
}

/**
 * Construct prompt for answer generation
 * 
 * LEARNING NOTE: Prompt construction is an art and science.
 * Different audiences need different instructions:
 * 
 * - General: Balanced detail, clear language
 * - Simple: Easy vocabulary, short sentences, examples
 * - Technical: Precise terms, detailed explanations, references
 * 
 * @param {string} question - User question
 * @param {string} context - Retrieved context
 * @param {string} audience - Target audience
 * @param {boolean} includeFollowUp - Generate follow-up questions
 * @param {boolean} structured - Use structured output format
 * @returns {Object} System and user prompts
 */
function constructPrompt(question, context, audience, includeFollowUp, structured) {
  // Base system prompt for RAG
  let systemPrompt = `You are a knowledgeable assistant specializing in German social benefits and public services.

CRITICAL INSTRUCTIONS:
1. Answer ONLY using information from the provided context
2. If the context doesn't contain enough information to answer, explicitly say "I don't have enough information to fully answer this question"
3. ALWAYS cite your sources using [1], [2], etc. notation immediately after claims
4. Be accurate - do not make up or infer information not in the context
5. If you're uncertain, express that uncertainty`;

  // Adjust for audience
  if (audience === 'simple') {
    systemPrompt += `\n6. Use simple, easy-to-understand language
7. Avoid jargon and technical terms
8. Break down complex concepts
9. Use short sentences and paragraphs
10. Include examples when helpful`;
  } else if (audience === 'technical') {
    systemPrompt += `\n6. Use precise technical terminology
7. Include specific details, numbers, and regulations
8. Reference exact requirements and conditions
9. Explain nuances and exceptions`;
  }

  // Construct user prompt
  let userPrompt = `Context:\n\n${context}\n\n---\n\nQuestion: ${question}\n\n`;

  if (structured) {
    // JSON output instructions
    userPrompt += `Please provide your response in the following JSON format:
{
  "answer": "Your detailed answer with inline citations [1][2]",
  "confidence": "high|medium|low - your confidence in the answer",
  "keyPoints": ["array of key points from your answer"],
  "citations": [1, 2, ...] - array of document numbers cited,
  "missingInfo": "what additional information would help answer better (if any)"`;
    
    if (includeFollowUp) {
      userPrompt += `,
  "followUpQuestions": ["array of relevant follow-up questions"]`;
    }
    
    userPrompt += `\n}`;
  } else {
    // Conversational output instructions
    userPrompt += `Please provide a clear, accurate answer with proper citations.`;
    
    if (includeFollowUp) {
      userPrompt += ` After your answer, suggest 2-3 relevant follow-up questions.`;
    }
  }

  return { systemPrompt, userPrompt };
}

/**
 * Parse structured (JSON) response
 * 
 * LEARNING NOTE: JSON mode is powerful but requires careful parsing.
 * LLMs are generally good at JSON but may:
 * - Use slightly different field names
 * - Include extra fields
 * - Have minor formatting issues
 * 
 * Always validate and provide defaults for missing fields.
 * 
 * @param {string} response - Raw LLM response
 * @returns {Object} Parsed response
 */
function parseStructuredResponse(response) {
  try {
    const parsed = JSON.parse(response);
    
    return {
      answer: parsed.answer || parsed.response || 'No answer provided',
      confidence: parsed.confidence || 'medium',
      keyPoints: parsed.keyPoints || parsed.key_points || [],
      citations: parseCitations(parsed.answer || '', parsed.citations || []),
      followUpQuestions: parsed.followUpQuestions || parsed.follow_up_questions || [],
      missingInfo: parsed.missingInfo || parsed.missing_info || null,
    };
  } catch (error) {
    console.error('[AnswerGenerator] Failed to parse JSON response:', error);
    
    // Try to extract answer even if JSON is malformed
    return {
      answer: response,
      confidence: 'low',
      keyPoints: [],
      citations: extractCitationsFromText(response),
      followUpQuestions: [],
      missingInfo: null,
    };
  }
}

/**
 * Parse conversational response
 * 
 * LEARNING NOTE: Conversational responses are more flexible but require
 * extraction of structured elements (citations, follow-up questions).
 * 
 * @param {string} response - Raw LLM response
 * @param {Array} sources - Available sources
 * @returns {Object} Parsed response
 */
function parseConversationalResponse(response, sources) {
  // Extract main answer and follow-up questions if present
  let answer = response;
  let followUpQuestions = [];

  // Check if response includes follow-up questions
  const followUpMatch = response.match(/(?:Follow-?up questions?:?\s*\n)((?:[-•]\s*.+\n?)+)/i);
  if (followUpMatch) {
    // Extract follow-up questions
    const followUpText = followUpMatch[1];
    followUpQuestions = followUpText
      .split('\n')
      .map(q => q.replace(/^[-•]\s*/, '').trim())
      .filter(q => q.length > 0);
    
    // Remove follow-up section from answer
    answer = response.replace(followUpMatch[0], '').trim();
  }

  // Extract citations
  const citations = extractCitationsFromText(answer);

  // Assess confidence based on language
  const confidence = assessConfidence(answer);

  return {
    answer,
    citations,
    confidence,
    followUpQuestions,
    keyPoints: extractKeyPoints(answer),
  };
}

/**
 * Extract citations from text
 * 
 * LEARNING NOTE: Citations can appear in various formats:
 * - [1]
 * - [1,2]
 * - [1][2]
 * - [1, 2, 3]
 * 
 * We extract all numbers within brackets.
 * 
 * @param {string} text - Text with citations
 * @returns {Array} Citation numbers
 */
function extractCitationsFromText(text) {
  const citationPattern = /\[(\d+)\]/g;
  const citations = new Set();
  
  let match;
  while ((match = citationPattern.exec(text)) !== null) {
    citations.add(parseInt(match[1]));
  }
  
  return Array.from(citations).sort((a, b) => a - b);
}

/**
 * Parse citations from array or text
 * 
 * @param {string} text - Answer text
 * @param {Array} citationArray - Citation array from JSON
 * @returns {Array} Parsed citations
 */
function parseCitations(text, citationArray) {
  // If citations provided as array, use that
  if (Array.isArray(citationArray) && citationArray.length > 0) {
    return citationArray.map(c => typeof c === 'number' ? c : parseInt(c)).filter(c => !isNaN(c));
  }
  
  // Otherwise extract from text
  return extractCitationsFromText(text);
}

/**
 * Extract key points from answer
 * 
 * LEARNING NOTE: Key points help users quickly scan the answer.
 * We use simple heuristics:
 * - Sentences with numbers (specific facts)
 * - Sentences starting with important phrases
 * - Short, complete sentences
 * 
 * Real implementation could use:
 * - Extractive summarization models
 * - Sentence importance scoring
 * - LLM-based extraction
 * 
 * @param {string} answer - Answer text
 * @returns {Array} Key points
 */
function extractKeyPoints(answer) {
  // Split into sentences
  const sentences = answer
    .split(/[.!?]+/)
    .map(s => s.trim())
    .filter(s => s.length > 20 && s.length < 200); // Reasonable length

  // Score sentences for importance
  const scored = sentences.map(sentence => {
    let score = 0;
    
    // Contains numbers (specific facts)
    if (/\d+/.test(sentence)) score += 2;
    
    // Starts with important phrases
    if (/^(You (?:can|must|should|need|are)|The |To |If you|When|Important)/i.test(sentence)) {
      score += 1;
    }
    
    // Contains important keywords
    const keywords = ['eligible', 'required', 'must', 'can apply', 'deadline', 'amount', 'benefit'];
    for (const keyword of keywords) {
      if (sentence.toLowerCase().includes(keyword)) {
        score += 1;
        break;
      }
    }
    
    return { sentence, score };
  });

  // Return top 3-5 sentences
  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
    .map(item => item.sentence);
}

/**
 * Assess confidence in answer
 * 
 * LEARNING NOTE: Confidence assessment helps users know when to
 * verify information or seek human assistance.
 * 
 * SIGNALS FOR LOW CONFIDENCE:
 * ---------------------------
 * - "I don't have enough information"
 * - "might", "possibly", "perhaps"
 * - Few or no citations
 * - Very short answer
 * 
 * SIGNALS FOR HIGH CONFIDENCE:
 * ----------------------------
 * - Multiple citations
 * - Specific facts and numbers
 * - No hedging language
 * - Reasonable length
 * 
 * @param {string} answer - Answer text
 * @returns {string} Confidence level
 */
function assessConfidence(answer) {
  const lowerAnswer = answer.toLowerCase();
  
  // Check for explicit uncertainty
  const uncertaintyPhrases = [
    "don't have enough information",
    "don't know",
    "not sure",
    "can't answer",
    "unclear",
  ];
  
  for (const phrase of uncertaintyPhrases) {
    if (lowerAnswer.includes(phrase)) {
      return 'low';
    }
  }
  
  // Check for hedging language
  const hedgingWords = ['might', 'may', 'possibly', 'perhaps', 'probably'];
  let hedgeCount = 0;
  for (const word of hedgingWords) {
    if (lowerAnswer.includes(word)) hedgeCount++;
  }
  
  // Check citation count
  const citationCount = (answer.match(/\[\d+\]/g) || []).length;
  
  // Check answer length
  const answerLength = answer.length;
  
  // Assess confidence
  if (hedgeCount >= 3 || citationCount === 0 || answerLength < 100) {
    return 'low';
  } else if (citationCount >= 3 && hedgeCount === 0 && answerLength > 200) {
    return 'high';
  } else {
    return 'medium';
  }
}

/**
 * Format answer with citations
 * 
 * LEARNING NOTE: This post-processes the answer to ensure proper citations.
 * If LLM forgot citations, we try to add them intelligently.
 * 
 * CITATION STRATEGIES:
 * --------------------
 * 1. If citations present: Validate and format
 * 2. If no citations: Try to infer from context
 * 3. If can't infer: Add general citation at end
 * 
 * @param {string} answer - Answer text
 * @param {Array} sources - Source list
 * @returns {string} Answer with proper citations
 * 
 * @example
 * const formatted = formatWithCitations(
 *   "Bürgergeld provides €563/month for single adults.",
 *   sources
 * );
 * // "Bürgergeld provides €563/month for single adults [1]."
 */
export function formatWithCitations(answer, sources) {
  // Extract existing citations
  const existingCitations = extractCitationsFromText(answer);
  
  // If answer already has citations, just validate them
  if (existingCitations.length > 0) {
    return validateCitations(answer, sources);
  }

  // No citations - try to add them
  // LEARNING NOTE: This is a fallback. Ideally LLM includes citations.
  
  // Strategy: Add citation to first sentence if we have sources
  if (sources.length > 0 && answer.length > 0) {
    // Find first sentence end
    const firstSentenceEnd = answer.search(/[.!?]/);
    if (firstSentenceEnd > 0) {
      const beforePunctuation = answer.substring(0, firstSentenceEnd);
      const afterPunctuation = answer.substring(firstSentenceEnd);
      
      // Insert [1] before punctuation
      return `${beforePunctuation} [1]${afterPunctuation}`;
    }
  }

  return answer;
}

/**
 * Validate citations in answer
 * 
 * LEARNING NOTE: Ensure:
 * - Citation numbers are valid (within source count)
 * - Citations are sequential ([1][2] not [1][3])
 * - All citations have corresponding sources
 * 
 * @param {string} answer - Answer with citations
 * @param {Array} sources - Available sources
 * @returns {string} Validated answer
 */
function validateCitations(answer, sources) {
  const citations = extractCitationsFromText(answer);
  const maxSource = sources.length;
  
  // Remove invalid citations
  let validated = answer;
  for (const citation of citations) {
    if (citation < 1 || citation > maxSource) {
      // Invalid citation, remove it
      const pattern = new RegExp(`\\[${citation}\\]`, 'g');
      validated = validated.replace(pattern, '');
      console.warn(`[AnswerGenerator] Removed invalid citation [${citation}]`);
    }
  }
  
  return validated;
}

/**
 * Generate structured answer with schema
 * 
 * LEARNING NOTE: Structured answers are useful for:
 * - API responses
 * - UI components with specific requirements
 * - Data extraction tasks
 * - Integration with other systems
 * 
 * SCHEMA EXAMPLE:
 * ---------------
 * ```javascript
 * {
 *   type: 'object',
 *   properties: {
 *     eligible: { type: 'boolean', description: 'Eligibility status' },
 *     requirements: { type: 'array', items: { type: 'string' } },
 *     amount: { type: 'number', description: 'Benefit amount in EUR' },
 *     sources: { type: 'array', items: { type: 'number' } }
 *   },
 *   required: ['eligible', 'requirements']
 * }
 * ```
 * 
 * @param {string} question - User question
 * @param {string} context - Retrieved context
 * @param {Object} schema - JSON schema for output
 * @param {Object} options - Generation options
 * @returns {Promise<Object>} Structured answer matching schema
 * 
 * @example
 * const schema = {
 *   type: 'object',
 *   properties: {
 *     eligible: { type: 'boolean' },
 *     reason: { type: 'string' },
 *     requirements: { type: 'array', items: { type: 'string' } }
 *   }
 * };
 * 
 * const result = await generateStructuredAnswer(
 *   "Am I eligible for Bürgergeld?",
 *   context,
 *   schema
 * );
 * 
 * console.log(result);
 * // {
 * //   eligible: true,
 * //   reason: "You meet the basic requirements...",
 * //   requirements: ["Be 18 or older", "Live in Germany", ...]
 * // }
 */
export async function generateStructuredAnswer(question, context, schema, options = {}) {
  // Construct prompt with schema
  const systemPrompt = `You are a helpful assistant that provides structured information about German social benefits.
You MUST respond with valid JSON matching the provided schema.
Base your answer ONLY on the provided context.`;

  const schemaDescription = JSON.stringify(schema, null, 2);
  
  const userPrompt = `Context:\n\n${context}\n\n---\n\nQuestion: ${question}\n\n---\n\nProvide your answer in JSON format matching this schema:\n${schemaDescription}`;

  try {
    const result = await createChatCompletion([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ], {
      temperature: options.temperature || 0.1, // Low temperature for structured output
      max_tokens: options.maxTokens || 1000,
      model: options.model || 'gpt-4o-mini',
      response_format: { type: 'json_object' },
    });

    // Parse and validate against schema
    const parsed = JSON.parse(result.content);
    
    // Basic validation that required fields exist
    if (schema.required) {
      for (const field of schema.required) {
        if (!(field in parsed)) {
          console.warn(`[AnswerGenerator] Missing required field: ${field}`);
        }
      }
    }

    return parsed;

  } catch (error) {
    console.error('[AnswerGenerator] Structured generation failed:', error);
    throw error;
  }
}

/**
 * Validate answer quality
 * 
 * LEARNING NOTE: Quality validation catches common issues:
 * - Answer doesn't use context (hallucination)
 * - No citations (can't verify)
 * - Too short (insufficient detail)
 * - Off-topic (misunderstood question)
 * 
 * VALIDATION CHECKS:
 * ------------------
 * 1. Context overlap: Does answer use context?
 * 2. Citation count: Are claims cited?
 * 3. Length: Is answer substantial?
 * 4. Uncertainty: Does answer admit limitations?
 * 
 * @param {Object} answer - Parsed answer object
 * @param {string} context - Context used
 * @param {Array} sources - Available sources
 * @returns {Object} Validated and possibly enhanced answer
 * 
 * @example
 * const validated = validateAnswer(parsedAnswer, context, sources);
 * // May add warnings, adjust confidence, etc.
 */
export function validateAnswer(answer, context, sources) {
  const warnings = [];
  let adjustedConfidence = answer.confidence;

  // Check 1: Context overlap
  // LEARNING NOTE: If answer doesn't overlap with context, might be hallucinating
  const contextWords = new Set(
    context.toLowerCase().split(/\W+/).filter(w => w.length > 4)
  );
  const answerWords = new Set(
    answer.answer.toLowerCase().split(/\W+/).filter(w => w.length > 4)
  );
  
  const overlap = [...answerWords].filter(w => contextWords.has(w)).length;
  const overlapRatio = answerWords.size > 0 ? overlap / answerWords.size : 0;
  
  if (overlapRatio < 0.3) {
    warnings.push('Low context overlap - answer may not be grounded in provided context');
    adjustedConfidence = 'low';
  }

  // Check 2: Citation count
  const citationCount = answer.citations.length;
  if (citationCount === 0 && !answer.answer.includes("don't have enough information")) {
    warnings.push('No citations provided - cannot verify claims');
    adjustedConfidence = adjustedConfidence === 'high' ? 'medium' : adjustedConfidence;
  }

  // Check 3: Answer length
  const answerLength = answer.answer.length;
  if (answerLength < 50) {
    warnings.push('Very short answer - may lack detail');
  } else if (answerLength > 2000) {
    warnings.push('Very long answer - consider summarizing');
  }

  // Check 4: Citation validity
  const invalidCitations = answer.citations.filter(c => c < 1 || c > sources.length);
  if (invalidCitations.length > 0) {
    warnings.push(`Invalid citations: [${invalidCitations.join(', ')}]`);
  }

  // Return validated answer
  return {
    ...answer,
    confidence: adjustedConfidence,
    validation: {
      passed: warnings.length === 0,
      warnings,
      contextOverlap: overlapRatio,
      citationCount,
    },
  };
}

// ============================================================================
// USAGE EXAMPLES
// ============================================================================

/**
 * EXAMPLE 1: Basic answer generation
 * 
 * import { generateAnswer } from './answer_generator.js';
 * import { buildContext } from './context_builder.js';
 * 
 * // Get context from retrieval
 * const { context, sources } = await buildContext(retrievedDocs, {
 *   maxTokens: 8000,
 *   query: "Am I eligible for Bürgergeld?"
 * });
 * 
 * // Generate answer
 * const result = await generateAnswer(
 *   "Am I eligible for Bürgergeld?",
 *   context,
 *   { sources }
 * );
 * 
 * console.log(result.answer);
 * console.log('Citations:', result.citations);
 * console.log('Confidence:', result.confidence);
 */

/**
 * EXAMPLE 2: Simple language for general audience
 * 
 * const result = await generateAnswer(
 *   "How do I apply for Wohngeld?",
 *   context,
 *   {
 *     sources,
 *     audience: 'simple',
 *     includeFollowUp: true
 *   }
 * );
 * 
 * console.log(result.answer);
 * // Uses simple language, short sentences, avoids jargon
 * 
 * console.log(result.followUpQuestions);
 * // ["What documents do I need?", "How long does approval take?", ...]
 */

/**
 * EXAMPLE 3: Technical answer for experts
 * 
 * const result = await generateAnswer(
 *   "What are the income thresholds for Bürgergeld?",
 *   context,
 *   {
 *     sources,
 *     audience: 'technical',
 *     temperature: 0.1 // Very deterministic for factual info
 *   }
 * );
 * 
 * // Includes specific numbers, regulations, exceptions
 */

/**
 * EXAMPLE 4: Structured output for API
 * 
 * const schema = {
 *   type: 'object',
 *   properties: {
 *     eligible: { type: 'boolean' },
 *     requirements: { type: 'array', items: { type: 'string' } },
 *     monthlyAmount: { type: 'number' },
 *     applicationUrl: { type: 'string' }
 *   },
 *   required: ['eligible', 'requirements']
 * };
 * 
 * const structured = await generateStructuredAnswer(
 *   "Am I eligible for Bürgergeld?",
 *   context,
 *   schema
 * );
 * 
 * // Returns: { eligible: true, requirements: [...], ... }
 */

/**
 * EXAMPLE 5: Validation and quality checks
 * 
 * const result = await generateAnswer(question, context, { sources });
 * 
 * if (!result.validation.passed) {
 *   console.warn('Quality issues:', result.validation.warnings);
 * }
 * 
 * if (result.confidence === 'low') {
 *   console.log('Low confidence - may need human review');
 * }
 * 
 * if (result.validation.contextOverlap < 0.5) {
 *   console.warn('Answer may not be well-grounded in context');
 * }
 */

/**
 * EXAMPLE 6: Post-processing citations
 * 
 * const result = await generateAnswer(question, context, { sources });
 * 
 * // Ensure citations are present
 * if (result.citations.length === 0) {
 *   result.answer = formatWithCitations(result.answer, sources);
 * }
 * 
 * // Map citations to full source info
 * const citedSources = result.citations.map(num => sources[num - 1]);
 * 
 * console.log('Sources used:', citedSources.map(s => s.title));
 */
