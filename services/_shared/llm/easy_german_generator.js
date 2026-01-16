/**
 * Systemfehler - Easy German Translation Module
 * 
 * This module implements LANG-03 (Issue #17) - Translation of standard German
 * to Easy German (Leichte Sprache) using LLMs.
 * 
 * ============================================================================
 * WHAT IS EASY GERMAN (LEICHTE SPRACHE)?
 * ============================================================================
 * 
 * Easy German is a simplified version of German designed to make content
 * accessible to people with:
 * - Cognitive disabilities
 * - Learning difficulties
 * - Non-native speakers learning German
 * - People with low literacy
 * 
 * OFFICIAL STANDARDS:
 * ===================
 * Easy German follows strict rules defined by:
 * - Netzwerk Leichte Sprache: https://www.leichte-sprache.org/
 * - Inclusion Europe: https://www.inclusion-europe.eu/easy-to-read/
 * - German law (BGG §11): Requires easy language for important public info
 * 
 * KEY RULES:
 * ==========
 * 1. SHORT SENTENCES: Max 1-2 clauses per sentence
 * 2. SIMPLE WORDS: Use common, everyday vocabulary
 * 3. AVOID METAPHORS: Be literal and concrete
 * 4. EXPLAIN DIFFICULT WORDS: Define technical terms
 * 5. ACTIVE VOICE: Use active instead of passive voice
 * 6. PRESENT TENSE: Prefer present over past/future
 * 7. POSITIVE STATEMENTS: Avoid double negatives
 * 8. CLEAR STRUCTURE: Use lists, headings, spacing
 * 9. VISUAL SUPPORT: Include images where helpful
 * 10. VERIFICATION: Get feedback from target users
 * 
 * CEFR LEVELS:
 * ============
 * We support multiple complexity levels following the Common European
 * Framework of Reference for Languages (CEFR):
 * 
 * - A1 (Beginner): Very basic, present tense only, 500-word vocabulary
 * - A2 (Elementary): Simple sentences, past tense, 1000-word vocabulary
 * - B1 (Intermediate): More complex but still accessible, 2500-word vocabulary
 * 
 * ============================================================================
 * WHY USE LLMS FOR TRANSLATION?
 * ============================================================================
 * 
 * TRADITIONAL APPROACH: Rule-based simplification
 * - Fixed rules for sentence splitting
 * - Dictionary-based word replacement
 * - Limited context understanding
 * - Misses nuanced simplifications
 * 
 * LLM APPROACH: Context-aware simplification
 * ✓ Understands meaning and context
 * ✓ Preserves important information
 * ✓ Natural simplification (not robotic)
 * ✓ Adapts to different domains
 * ✓ Explains technical terms appropriately
 * 
 * LEARNING RESOURCES:
 * ===================
 * - Easy Language Guidelines: https://www.inclusion-europe.eu/easy-to-read/
 * - BGG Law (German): https://www.gesetze-im-internet.de/bgg/__11.html
 * - CEFR Levels: https://www.coe.int/en/web/common-european-framework-reference-languages
 * 
 * @see llm_client.js for making LLM requests
 * @see prompts.js for translation prompt templates
 * @see token_utils.js for cost estimation
 */

import { createChatCompletion } from './llm_client.js';
import { trackCost } from './cost_tracker.js';
import { countTokens } from './token_utils.js';

/**
 * Translation options and defaults
 * 
 * LEARNING NOTE: Provide sensible defaults so users can call with minimal config,
 * but allow overrides for advanced use cases.
 */
const DEFAULT_OPTIONS = {
  level: 'A2',              // Target CEFR level
  model: 'gpt-4o-mini',     // Cost-effective model for translation
  temperature: 0.3,         // Low temperature for consistent, focused output
  preserveFormatting: true, // Keep lists, headings, etc.
  explainTerms: true,       // Add explanations for technical terms
  maxLength: 2000,          // Max length of input text (in characters)
};

/**
 * CEFR level specifications
 * 
 * LEARNING NOTE: These constraints guide the LLM to produce appropriate
 * simplification for each level. They're based on official CEFR descriptors.
 */
const CEFR_SPECIFICATIONS = {
  A1: {
    name: 'A1 (Beginner)',
    maxWordsPerSentence: 8,
    vocabularyLevel: 'very basic everyday words only',
    grammarRules: 'present tense only, active voice, no subordinate clauses',
    additionalGuidance: 'Use very short sentences. Explain every non-basic word.',
  },
  A2: {
    name: 'A2 (Elementary)',
    maxWordsPerSentence: 12,
    vocabularyLevel: 'basic everyday vocabulary',
    grammarRules: 'present and simple past, active voice preferred, minimal subordinate clauses',
    additionalGuidance: 'Keep sentences simple. Explain technical terms.',
  },
  B1: {
    name: 'B1 (Intermediate)',
    maxWordsPerSentence: 15,
    vocabularyLevel: 'common vocabulary with some less frequent words',
    grammarRules: 'various tenses allowed, some complex structures acceptable',
    additionalGuidance: 'Accessible but can be somewhat more complex.',
  },
};

/**
 * Translate standard German to Easy German
 * 
 * MAIN TRANSLATION FUNCTION
 * =========================
 * This is the primary function for converting standard German text to
 * Easy German (Leichte Sprache) using LLMs.
 * 
 * LEARNING NOTE: PROMPT ENGINEERING FOR TRANSLATION
 * ==================================================
 * The prompt design is crucial for quality translation. Key techniques:
 * 
 * 1. ROLE ASSIGNMENT: Tell the LLM it's an expert in Easy German
 *    Why: Sets context and expertise level
 * 
 * 2. SPECIFIC RULES: List exact rules to follow (sentence length, vocabulary)
 *    Why: LLMs follow explicit instructions better than implicit expectations
 * 
 * 3. EXAMPLES: Provide before/after examples (few-shot learning)
 *    Why: Shows the LLM exactly what output format you want
 * 
 * 4. STRUCTURED OUTPUT: Request specific format (JSON, sections)
 *    Why: Makes parsing and validation easier
 * 
 * 5. CONSTRAINTS: Specify what NOT to do (avoid metaphors, passive voice)
 *    Why: Prevents common mistakes
 * 
 * 6. CONTEXT: Provide domain information (social benefits)
 *    Why: Helps LLM use appropriate terminology and examples
 * 
 * @param {string} text - Standard German text to translate
 * @param {Object} options - Translation options
 * @param {string} options.level - Target CEFR level (A1, A2, B1)
 * @param {string} options.model - LLM model to use
 * @param {number} options.temperature - Generation temperature (0-1)
 * @param {boolean} options.preserveFormatting - Keep original formatting
 * @param {boolean} options.explainTerms - Add explanations for technical terms
 * @returns {Promise<Object>} Translation result with metadata
 * 
 * @example
 * const result = await translateToEasyGerman(
 *   "Das Bürgergeld beantragen Sie beim Jobcenter. Sie müssen verschiedene Nachweise einreichen.",
 *   { level: 'A2' }
 * );
 * console.log(result.translation);
 * // "Sie wollen Bürger-Geld? Gehen Sie zum Job-Center. 
 * //  Das Job-Center ist ein Amt. Dort bekommen Sie Hilfe beim Geld.
 * //  Sie brauchen Papiere für den Antrag."
 */
export async function translateToEasyGerman(text, options = {}) {
  // LEARNING NOTE: Input validation prevents errors and provides clear feedback
  if (!text || typeof text !== 'string') {
    throw new Error('Text must be a non-empty string');
  }

  if (text.length > DEFAULT_OPTIONS.maxLength) {
    throw new Error(`Text too long (${text.length} chars). Maximum: ${DEFAULT_OPTIONS.maxLength}. Use batchTranslate() for longer texts.`);
  }

  // Merge with defaults
  const config = { ...DEFAULT_OPTIONS, ...options };

  // Validate level
  if (!CEFR_SPECIFICATIONS[config.level]) {
    throw new Error(`Invalid CEFR level: ${config.level}. Must be one of: ${Object.keys(CEFR_SPECIFICATIONS).join(', ')}`);
  }

  const levelSpec = CEFR_SPECIFICATIONS[config.level];

  // Build the prompt
  // LEARNING NOTE: We construct the prompt programmatically to ensure
  // consistency and make it easy to modify rules across all calls.
  const systemPrompt = `Du bist ein Experte für Leichte Sprache (Easy German).
Deine Aufgabe ist es, deutschen Text in Leichte Sprache zu übersetzen.

WICHTIGE REGELN:
- Maximale Satzlänge: ${levelSpec.maxWordsPerSentence} Wörter
- Wortschatz: ${levelSpec.vocabularyLevel}
- Grammatik: ${levelSpec.grammarRules}
- ${levelSpec.additionalGuidance}

ZUSÄTZLICHE RICHTLINIEN:
- Verwende aktive Sprache statt passiver
- Vermeide Metaphern und Redewendungen
- Trenne zusammengesetzte Wörter mit Bindestrichen (z.B. "Antrags-Formular")
- Erkläre Fachbegriffe in einfachen Worten
${config.explainTerms ? '- Füge Erklärungen für schwierige Wörter hinzu' : ''}
${config.preserveFormatting ? '- Behalte Listen, Überschriften und Struktur bei' : ''}

DOMAIN-KONTEXT:
Der Text handelt von sozialen Leistungen und Hilfsangeboten in Deutschland.
Zielgruppe: Menschen mit Lernschwierigkeiten, Nicht-Muttersprachler, Menschen mit kognitiven Einschränkungen.

Antworte im JSON-Format:
{
  "translation": "übersetzter Text in Leichter Sprache",
  "explanations": [{"term": "Fachwort", "explanation": "einfache Erklärung"}],
  "notes": "optionale Anmerkungen zur Übersetzung"
}`;

  const userPrompt = `Übersetze diesen Text in Leichte Sprache (Level ${config.level}):

${text}`;

  try {
    // LEARNING NOTE: We track costs for every API call to monitor spending
    const startTime = Date.now();

    // Make the LLM request
    const response = await createChatCompletion([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ], {
      model: config.model,
      temperature: config.temperature,
      max_tokens: 2000, // Allow enough space for translation + explanations
    });

    const content = response.choices[0].message.content;

    // LEARNING NOTE: Parse JSON response with error handling
    // LLMs sometimes include markdown code blocks around JSON
    let parsed;
    try {
      // Remove markdown code blocks if present
      const cleaned = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      parsed = JSON.parse(cleaned);
    } catch (parseError) {
      // Fallback: treat entire response as translation if JSON parsing fails
      console.warn('Failed to parse JSON response, using raw content');
      parsed = {
        translation: content,
        explanations: [],
        notes: 'JSON parsing failed, using raw response'
      };
    }

    // Calculate metrics
    const duration = Date.now() - startTime;
    const inputTokens = response.usage.prompt_tokens;
    const outputTokens = response.usage.completion_tokens;

    // Track cost
    await trackCost({
      feature: 'easy_german_translation',
      model: config.model,
      inputTokens,
      outputTokens,
      metadata: {
        level: config.level,
        inputLength: text.length,
        outputLength: parsed.translation.length,
      }
    });

    // Return comprehensive result
    return {
      translation: parsed.translation,
      explanations: parsed.explanations || [],
      notes: parsed.notes || null,
      metadata: {
        sourceLength: text.length,
        translationLength: parsed.translation.length,
        level: config.level,
        model: config.model,
        duration,
        tokens: {
          input: inputTokens,
          output: outputTokens,
          total: inputTokens + outputTokens,
        },
      },
    };

  } catch (error) {
    // LEARNING NOTE: Wrap errors with context to aid debugging
    throw new Error(`Easy German translation failed: ${error.message}`);
  }
}

/**
 * Validate if text meets Easy German standards
 * 
 * VALIDATION APPROACH
 * ===================
 * Uses an LLM to assess whether text follows Easy German rules.
 * 
 * LEARNING NOTE: LLM-AS-A-JUDGE
 * ==============================
 * This is a powerful pattern where we use LLMs to evaluate content.
 * Benefits:
 * - Understands nuanced rules
 * - Provides explanatory feedback
 * - Can detect issues humans might miss
 * - Adapts to context
 * 
 * Limitations:
 * - Not 100% accurate (like any ML system)
 * - Can be inconsistent
 * - Should be combined with rule-based checks
 * 
 * BEST PRACTICES:
 * - Use structured output (scores + reasons)
 * - Set temperature=0 for consistency
 * - Provide clear rubric in prompt
 * - Validate with human spot-checks
 * 
 * @param {string} text - Text to validate
 * @param {string} expectedLevel - Expected CEFR level (A1, A2, B1)
 * @param {Object} options - Validation options
 * @returns {Promise<Object>} Validation results
 * 
 * @example
 * const validation = await validateEasyGerman(
 *   "Sie wollen Hilfe? Gehen Sie zum Amt.",
 *   'A2'
 * );
 * console.log(validation.isValid); // true/false
 * console.log(validation.issues); // Array of problems found
 */
export async function validateEasyGerman(text, expectedLevel = 'A2', options = {}) {
  if (!text || typeof text !== 'string') {
    throw new Error('Text must be a non-empty string');
  }

  if (!CEFR_SPECIFICATIONS[expectedLevel]) {
    throw new Error(`Invalid CEFR level: ${expectedLevel}`);
  }

  const config = {
    model: options.model || 'gpt-4o-mini',
    temperature: 0, // Deterministic for validation
  };

  const levelSpec = CEFR_SPECIFICATIONS[expectedLevel];

  const systemPrompt = `Du bist ein Experte für Leichte Sprache und validierst Texte nach den offiziellen Regeln.

BEWERTUNGSKRITERIEN FÜR ${levelSpec.name}:
1. Satzlänge: Maximal ${levelSpec.maxWordsPerSentence} Wörter pro Satz
2. Wortschatz: ${levelSpec.vocabularyLevel}
3. Grammatik: ${levelSpec.grammarRules}
4. Struktur: Klare Gliederung, kurze Absätze
5. Verständlichkeit: Keine Metaphern, konkrete Sprache

PRÜFE:
- Sind die Sätze kurz genug?
- Ist der Wortschatz angemessen?
- Wird aktive Sprache verwendet?
- Sind Fachbegriffe erklärt?
- Ist die Struktur klar?

Antworte im JSON-Format:
{
  "isValid": true/false,
  "score": 0-100,
  "issues": [{"category": "Kategorie", "severity": "high/medium/low", "description": "Problem", "example": "Textbeispiel"}],
  "suggestions": ["Verbesserungsvorschlag 1", "Vorschlag 2"],
  "strengths": ["Was gut gemacht ist"]
}`;

  const userPrompt = `Validiere diesen Text für Leichte Sprache Level ${expectedLevel}:

${text}`;

  try {
    const response = await createChatCompletion([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ], {
      model: config.model,
      temperature: config.temperature,
      max_tokens: 1500,
    });

    const content = response.choices[0].message.content;
    const cleaned = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const result = JSON.parse(cleaned);

    // Track cost
    await trackCost({
      feature: 'easy_german_validation',
      model: config.model,
      inputTokens: response.usage.prompt_tokens,
      outputTokens: response.usage.completion_tokens,
    });

    return {
      isValid: result.isValid,
      score: result.score,
      issues: result.issues || [],
      suggestions: result.suggestions || [],
      strengths: result.strengths || [],
      level: expectedLevel,
    };

  } catch (error) {
    throw new Error(`Easy German validation failed: ${error.message}`);
  }
}

/**
 * Assess readability of text
 * 
 * READABILITY ASSESSMENT
 * ======================
 * Combines rule-based metrics with LLM evaluation.
 * 
 * LEARNING NOTE: HYBRID APPROACH
 * ===============================
 * We use BOTH traditional metrics AND LLM assessment because:
 * 
 * 1. TRADITIONAL METRICS (objective, fast, consistent):
 *    - Word count
 *    - Sentence count
 *    - Average sentence length
 *    - Average word length
 *    - Reading level estimates (Flesch-Kincaid, etc.)
 * 
 * 2. LLM ASSESSMENT (nuanced, context-aware):
 *    - Semantic complexity
 *    - Cultural accessibility
 *    - Domain-specific clarity
 *    - Practical understandability
 * 
 * BEST PRACTICE: Use metrics as quick check, LLM for deeper analysis.
 * 
 * GERMAN READABILITY FORMULAS:
 * ============================
 * - Flesch Reading Ease (adapted for German)
 * - Wiener Sachtextformel
 * - LIX (Läsbarhetsindex)
 * 
 * @param {string} text - Text to assess
 * @param {Object} options - Assessment options
 * @returns {Promise<Object>} Readability scores and analysis
 * 
 * @example
 * const readability = await assessReadability(
 *   "Das ist ein Test. Er ist sehr kurz."
 * );
 * console.log(readability.score); // 0-100
 * console.log(readability.cefrLevel); // Estimated level
 */
export async function assessReadability(text, options = {}) {
  if (!text || typeof text !== 'string') {
    throw new Error('Text must be a non-empty string');
  }

  // LEARNING NOTE: Calculate basic metrics first (fast, no API call needed)
  const metrics = calculateTextMetrics(text);

  // Only use LLM for detailed assessment if requested
  if (options.detailed !== false) {
    const config = {
      model: options.model || 'gpt-4o-mini',
      temperature: 0,
    };

    const systemPrompt = `Du bist ein Experte für Textverständlichkeit und Leichte Sprache.
Bewerte die Lesbarkeit des Textes auf einer Skala von 0-100.

BEWERTUNGSSKALA:
- 0-20: Sehr schwer (akademisch, Fachsprache)
- 21-40: Schwer (komplexe Standardsprache)
- 41-60: Mittel (normale Standardsprache)
- 61-80: Leicht (vereinfachte Sprache, B1)
- 81-100: Sehr leicht (Leichte Sprache, A1-A2)

BEWERTE:
- Satzlänge und -komplexität
- Wortschatzlevel
- Grammatische Komplexität
- Logische Struktur
- Verständlichkeit für Zielgruppe

Antworte im JSON-Format:
{
  "score": 0-100,
  "estimatedCEFR": "A1/A2/B1/B2/C1",
  "complexity": "very_easy/easy/medium/hard/very_hard",
  "analysis": "Detaillierte Analyse",
  "targetAudience": "Für wen ist der Text geeignet?"
}`;

    try {
      const response = await createChatCompletion([
        { role: 'system', content: systemPrompt },
        { role: 'user', content: text }
      ], {
        model: config.model,
        temperature: config.temperature,
        max_tokens: 800,
      });

      const content = response.choices[0].message.content;
      const cleaned = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      const llmAssessment = JSON.parse(cleaned);

      await trackCost({
        feature: 'readability_assessment',
        model: config.model,
        inputTokens: response.usage.prompt_tokens,
        outputTokens: response.usage.completion_tokens,
      });

      return {
        score: llmAssessment.score,
        cefrLevel: llmAssessment.estimatedCEFR,
        complexity: llmAssessment.complexity,
        analysis: llmAssessment.analysis,
        targetAudience: llmAssessment.targetAudience,
        metrics,
      };

    } catch (error) {
      // Fallback to metrics-only if LLM fails
      console.warn('LLM assessment failed, returning metrics only:', error.message);
      return {
        score: estimateScoreFromMetrics(metrics),
        cefrLevel: estimateCEFRFromMetrics(metrics),
        complexity: estimateComplexityFromMetrics(metrics),
        metrics,
      };
    }
  } else {
    // Return metrics-only assessment (fast, no API call)
    return {
      score: estimateScoreFromMetrics(metrics),
      cefrLevel: estimateCEFRFromMetrics(metrics),
      complexity: estimateComplexityFromMetrics(metrics),
      metrics,
    };
  }
}

/**
 * Calculate basic text metrics
 * 
 * LEARNING NOTE: These are simple, fast calculations that don't require AI.
 * Always compute these first before deciding if you need expensive LLM calls.
 */
function calculateTextMetrics(text) {
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
  const words = text.split(/\s+/).filter(w => w.length > 0);
  const characters = text.replace(/\s/g, '').length;

  return {
    characterCount: characters,
    wordCount: words.length,
    sentenceCount: sentences.length,
    avgWordsPerSentence: words.length / sentences.length,
    avgCharsPerWord: characters / words.length,
    longestSentence: Math.max(...sentences.map(s => s.split(/\s+/).length)),
  };
}

/**
 * Estimate readability score from metrics
 * 
 * LEARNING NOTE: Simple heuristic based on sentence length.
 * Very rough estimate - LLM assessment is much better.
 */
function estimateScoreFromMetrics(metrics) {
  // Simple heuristic: shorter sentences = higher score
  const avgLength = metrics.avgWordsPerSentence;
  if (avgLength <= 8) return 85;
  if (avgLength <= 12) return 70;
  if (avgLength <= 15) return 55;
  if (avgLength <= 20) return 40;
  return 25;
}

/**
 * Estimate CEFR level from metrics
 */
function estimateCEFRFromMetrics(metrics) {
  const avgLength = metrics.avgWordsPerSentence;
  if (avgLength <= 8) return 'A1';
  if (avgLength <= 12) return 'A2';
  if (avgLength <= 15) return 'B1';
  if (avgLength <= 20) return 'B2';
  return 'C1';
}

/**
 * Estimate complexity from metrics
 */
function estimateComplexityFromMetrics(metrics) {
  const score = estimateScoreFromMetrics(metrics);
  if (score >= 80) return 'very_easy';
  if (score >= 60) return 'easy';
  if (score >= 40) return 'medium';
  if (score >= 20) return 'hard';
  return 'very_hard';
}

/**
 * Batch translate multiple entries
 * 
 * BATCH PROCESSING
 * ================
 * Process multiple translations efficiently.
 * 
 * LEARNING NOTE: BATCH PROCESSING STRATEGIES
 * ===========================================
 * 
 * 1. PARALLEL PROCESSING:
 *    - Send multiple requests simultaneously
 *    - Faster overall (requests happen concurrently)
 *    - Risk: May hit rate limits
 *    - Good for: Small batches (< 10 items)
 * 
 * 2. SEQUENTIAL PROCESSING:
 *    - One request at a time
 *    - Slower but safer
 *    - Won't hit rate limits
 *    - Good for: Large batches, rate-limited APIs
 * 
 * 3. BATCHED SEQUENTIAL:
 *    - Process in chunks (e.g., 5 at a time)
 *    - Balance between speed and safety
 *    - BEST APPROACH for most cases
 * 
 * 4. MULTIPLE TEXTS IN ONE REQUEST:
 *    - Pack multiple short texts into one API call
 *    - Most cost-effective
 *    - Risk: One failure affects all
 *    - Good for: Very short texts
 * 
 * This implementation uses strategy #3 (batched sequential).
 * 
 * @param {Array<Object>} entries - Array of entries with German text
 * @param {Object} options - Translation options
 * @param {number} options.batchSize - Number of concurrent translations
 * @param {Function} options.onProgress - Progress callback
 * @returns {Promise<Array<Object>>} Array of translation results
 * 
 * @example
 * const entries = [
 *   { id: 1, description: { de: "Text 1" } },
 *   { id: 2, description: { de: "Text 2" } },
 * ];
 * 
 * const results = await batchTranslate(entries, {
 *   level: 'A2',
 *   batchSize: 3,
 *   onProgress: (current, total) => console.log(`${current}/${total}`)
 * });
 */
export async function batchTranslate(entries, options = {}) {
  if (!Array.isArray(entries) || entries.length === 0) {
    throw new Error('Entries must be a non-empty array');
  }

  const config = {
    level: options.level || 'A2',
    batchSize: options.batchSize || 3, // Process 3 at a time
    onProgress: options.onProgress || (() => {}),
    ...options,
  };

  const results = [];
  const errors = [];

  // LEARNING NOTE: Process in batches to avoid rate limits
  for (let i = 0; i < entries.length; i += config.batchSize) {
    const batch = entries.slice(i, i + config.batchSize);

    // Process batch in parallel
    const batchPromises = batch.map(async (entry) => {
      try {
        // Extract German text from entry
        const germanText = extractGermanText(entry);
        
        if (!germanText) {
          return {
            entryId: entry.id,
            success: false,
            error: 'No German text found',
          };
        }

        // Translate
        const result = await translateToEasyGerman(germanText, {
          level: config.level,
          model: config.model,
          temperature: config.temperature,
        });

        return {
          entryId: entry.id,
          success: true,
          translation: result.translation,
          explanations: result.explanations,
          metadata: result.metadata,
        };

      } catch (error) {
        return {
          entryId: entry.id,
          success: false,
          error: error.message,
        };
      }
    });

    // Wait for batch to complete
    const batchResults = await Promise.all(batchPromises);
    results.push(...batchResults);

    // Report progress
    config.onProgress(results.length, entries.length);

    // LEARNING NOTE: Small delay between batches to be nice to the API
    if (i + config.batchSize < entries.length) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

  // Separate successes and failures
  const successes = results.filter(r => r.success);
  const failures = results.filter(r => !r.success);

  return {
    total: entries.length,
    successful: successes.length,
    failed: failures.length,
    results: successes,
    errors: failures,
  };
}

/**
 * Extract German text from entry
 * 
 * LEARNING NOTE: Handles different entry structures.
 * Systemfehler entries use multilingual fields like:
 * { description: { de: "German", en: "English" } }
 */
function extractGermanText(entry) {
  // Try common field names
  const fields = ['description', 'title', 'content', 'text'];
  
  for (const field of fields) {
    if (entry[field]) {
      // Multilingual object
      if (typeof entry[field] === 'object' && entry[field].de) {
        return entry[field].de;
      }
      // Direct string
      if (typeof entry[field] === 'string') {
        return entry[field];
      }
    }
  }

  return null;
}

/**
 * USAGE EXAMPLES
 * ==============
 */

// Example 1: Basic translation
async function example1() {
  const text = "Das Bürgergeld beantragen Sie beim zuständigen Jobcenter. Sie müssen verschiedene Nachweise über Ihr Einkommen und Vermögen einreichen.";
  
  const result = await translateToEasyGerman(text, { level: 'A2' });
  
  console.log('Original:', text);
  console.log('Translation:', result.translation);
  console.log('Explanations:', result.explanations);
  console.log('Tokens used:', result.metadata.tokens.total);
}

// Example 2: Validation workflow
async function example2() {
  const easyGermanText = "Sie wollen Geld vom Amt? Gehen Sie zum Job-Center. Bringen Sie Ihre Papiere mit.";
  
  const validation = await validateEasyGerman(easyGermanText, 'A2');
  
  if (validation.isValid) {
    console.log('✓ Text meets Easy German standards');
    console.log('Score:', validation.score);
  } else {
    console.log('✗ Issues found:');
    validation.issues.forEach(issue => {
      console.log(`- ${issue.category}: ${issue.description}`);
    });
  }
}

// Example 3: Readability assessment
async function example3() {
  const text = "Das ist ein Test.";
  
  const readability = await assessReadability(text);
  
  console.log('Readability score:', readability.score);
  console.log('CEFR level:', readability.cefrLevel);
  console.log('Metrics:', readability.metrics);
}

// Example 4: Batch processing
async function example4() {
  const entries = [
    { id: 1, description: { de: "Text eins" } },
    { id: 2, description: { de: "Text zwei" } },
    { id: 3, description: { de: "Text drei" } },
  ];
  
  const results = await batchTranslate(entries, {
    level: 'A2',
    onProgress: (current, total) => {
      console.log(`Progress: ${current}/${total}`);
    }
  });
  
  console.log(`Translated ${results.successful} of ${results.total} entries`);
}

export default {
  translateToEasyGerman,
  validateEasyGerman,
  assessReadability,
  batchTranslate,
};
