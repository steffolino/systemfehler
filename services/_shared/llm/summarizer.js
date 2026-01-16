/**
 * Systemfehler - Summarization Module
 * 
 * This module provides intelligent summarization of social benefits and services
 * using LLMs, tailored for different audiences and use cases.
 * 
 * ============================================================================
 * WHAT IS TEXT SUMMARIZATION?
 * ============================================================================
 * 
 * Summarization is the process of condensing text while preserving key information.
 * It helps users quickly understand content without reading everything.
 * 
 * TWO MAIN APPROACHES:
 * ====================
 * 
 * 1. EXTRACTIVE SUMMARIZATION:
 *    - Select important sentences from original text
 *    - Copy them verbatim into summary
 *    - Fast, factually accurate
 *    - Can be choppy, lacks coherence
 *    - Example: "Benefit costs €500/month. Available until 2025."
 * 
 * 2. ABSTRACTIVE SUMMARIZATION:
 *    - Generate new sentences that capture meaning
 *    - Rewrite and paraphrase
 *    - More natural, coherent
 *    - Risk of adding information not in source
 *    - Example: "Monthly benefit of €500 is provided through 2025."
 * 
 * LLMs excel at abstractive summarization because they understand context
 * and can generate natural, coherent text.
 * 
 * ============================================================================
 * WHY AUDIENCE-AWARE SUMMARIZATION?
 * ============================================================================
 * 
 * Different audiences need different information:
 * 
 * GENERAL PUBLIC:
 * - Simple language
 * - Focus on: "What can I get? How do I apply?"
 * - Practical, action-oriented
 * - Avoid jargon
 * 
 * EXPERTS (social workers, case managers):
 * - Technical details
 * - Focus on: Eligibility rules, edge cases, legal references
 * - Precise terminology
 * - Include nuances
 * 
 * POLICYMAKERS:
 * - High-level overview
 * - Focus on: Impact, costs, outcomes, coverage
 * - Statistics and trends
 * - Policy implications
 * 
 * ============================================================================
 * PROMPT ENGINEERING FOR SUMMARIZATION
 * ============================================================================
 * 
 * KEY TECHNIQUES:
 * 
 * 1. LENGTH CONTROL:
 *    Bad:  "Summarize this text"
 *    Good: "Summarize in exactly 2 sentences"
 *    Better: "Summarize in 50-70 words"
 *    
 * 2. AUDIENCE SPECIFICATION:
 *    Bad:  "Summarize this benefit"
 *    Good: "Summarize for someone with no benefits knowledge"
 *    
 * 3. INFORMATION PRESERVATION:
 *    Bad:  "Summarize the key points"
 *    Good: "Summarize, preserving all amounts, dates, and deadlines"
 *    
 * 4. STYLE GUIDANCE:
 *    Bad:  "Write a summary"
 *    Good: "Write a summary using bullet points for clarity"
 *    
 * 5. CONTEXT PROVISION:
 *    Bad:  Just the text
 *    Good: "This is a social benefit. Readers want to know eligibility and how to apply."
 * 
 * ============================================================================
 * CRITICAL INFORMATION PRESERVATION
 * ============================================================================
 * 
 * When summarizing legal/benefits content, NEVER lose:
 * - Monetary amounts (€500/month)
 * - Deadlines (apply by December 31)
 * - Eligibility requirements (must be under 25)
 * - Contact information
 * - Legal references
 * 
 * Strategy: Extract these first, ensure they're in summary.
 * 
 * LEARNING RESOURCES:
 * ===================
 * - Summarization techniques: https://arxiv.org/abs/1804.04589
 * - Audience awareness: https://www.nngroup.com/articles/audience-writing/
 * 
 * @see llm_client.js for making LLM requests
 * @see prompts.js for prompt templates
 */

import { createChatCompletion } from './llm_client.js';
import { trackCost } from './cost_tracker.js';
import { countTokens } from './token_utils.js';

/**
 * Summary length specifications
 * 
 * LEARNING NOTE: Concrete length targets help LLMs produce consistent output.
 * Word counts are more reliable than vague terms like "brief" or "detailed".
 */
const LENGTH_SPECS = {
  short: {
    name: 'Short',
    targetWords: '20-40',
    targetSentences: '1-2',
    description: 'Quick overview, one key point',
  },
  medium: {
    name: 'Medium',
    targetWords: '80-120',
    targetSentences: '4-6',
    description: 'Paragraph summary with main details',
  },
  long: {
    name: 'Long',
    targetWords: '200-300',
    targetSentences: '10-15',
    description: 'Comprehensive summary with all important information',
  },
};

/**
 * Audience specifications
 * 
 * LEARNING NOTE: Each audience profile includes:
 * - Knowledge level (what they already know)
 * - Information needs (what they want to learn)
 * - Language style (how to communicate)
 * - Key priorities (what matters most)
 */
const AUDIENCE_SPECS = {
  general: {
    name: 'General Public',
    knowledgeLevel: 'No prior benefits knowledge',
    languageStyle: 'Simple, clear, avoiding jargon',
    priorities: ['What can I get?', 'Am I eligible?', 'How do I apply?', 'What documents do I need?'],
    tone: 'Friendly, encouraging, empowering',
  },
  experts: {
    name: 'Experts (Social Workers)',
    knowledgeLevel: 'Professional knowledge of benefits system',
    languageStyle: 'Technical, precise terminology acceptable',
    priorities: ['Eligibility criteria', 'Edge cases', 'Legal basis', 'Documentation requirements', 'Process details'],
    tone: 'Professional, detailed, authoritative',
  },
  policymakers: {
    name: 'Policymakers',
    knowledgeLevel: 'High-level policy knowledge',
    languageStyle: 'Executive summary style',
    priorities: ['Impact', 'Coverage', 'Costs', 'Outcomes', 'Implementation challenges', 'Policy implications'],
    tone: 'Strategic, data-driven, objective',
  },
};

/**
 * Default options
 */
const DEFAULT_OPTIONS = {
  length: 'medium',
  audience: 'general',
  model: 'gpt-4o-mini',
  temperature: 0.3, // Slightly creative but consistent
  preserveCriticalInfo: true,
};

/**
 * Summarize a social benefits entry
 * 
 * MAIN SUMMARIZATION FUNCTION
 * ============================
 * 
 * LEARNING NOTE: CONTROLLING OUTPUT LENGTH
 * =========================================
 * 
 * Several techniques for length control (from most to least reliable):
 * 
 * 1. SPECIFIC WORD COUNT: "Write 50-70 words"
 *    - Most precise
 *    - LLMs count fairly accurately
 *    - May sacrifice quality for exact count
 * 
 * 2. SENTENCE COUNT: "Write 2-3 sentences"
 *    - Very reliable
 *    - Natural boundaries
 *    - Can result in very long sentences
 * 
 * 3. BOTH: "Write 50-70 words in 2-3 sentences"
 *    - Good balance
 *    - Constrains both metrics
 *    - RECOMMENDED APPROACH
 * 
 * 4. VAGUE: "Write a brief summary"
 *    - Inconsistent
 *    - Avoid for production use
 * 
 * 5. POST-PROCESSING: Generate long, then truncate
 *    - Wastes tokens
 *    - Can cut mid-thought
 *    - Last resort only
 * 
 * LEARNING NOTE: AUDIENCE-AWARE GENERATION
 * =========================================
 * 
 * Techniques to adapt content for audience:
 * 
 * 1. EXPLICIT ROLE: "You are explaining to a policymaker"
 * 2. KNOWLEDGE LEVEL: "Assume reader knows benefits system"
 * 3. PRIORITIES: "Focus on eligibility and application process"
 * 4. STYLE EXAMPLES: "Like this: [example]"
 * 5. TONE GUIDANCE: "Use encouraging, empowering tone"
 * 
 * @param {Object} entry - Social benefits entry to summarize
 * @param {Object} options - Summarization options
 * @param {string} options.length - Length: 'short', 'medium', 'long'
 * @param {string} options.audience - Audience: 'general', 'experts', 'policymakers'
 * @param {string} options.model - LLM model to use
 * @param {number} options.temperature - Generation temperature
 * @param {boolean} options.preserveCriticalInfo - Ensure amounts/dates preserved
 * @returns {Promise<Object>} Summary with metadata
 * 
 * @example
 * const entry = {
 *   title: { de: "Bürgergeld" },
 *   description: { de: "Finanzielle Unterstützung für Arbeitslose..." },
 *   benefitAmount: { de: "563€ pro Monat" },
 *   eligibilityCriteria: { de: "Arbeitslos und hilfebedürftig" }
 * };
 * 
 * const summary = await summarize(entry, {
 *   length: 'short',
 *   audience: 'general'
 * });
 * console.log(summary.text);
 */
export async function summarize(entry, options = {}) {
  if (!entry || typeof entry !== 'object') {
    throw new Error('Entry must be an object');
  }

  const config = { ...DEFAULT_OPTIONS, ...options };

  // Validate options
  if (!LENGTH_SPECS[config.length]) {
    throw new Error(`Invalid length: ${config.length}. Must be: ${Object.keys(LENGTH_SPECS).join(', ')}`);
  }
  if (!AUDIENCE_SPECS[config.audience]) {
    throw new Error(`Invalid audience: ${config.audience}. Must be: ${Object.keys(AUDIENCE_SPECS).join(', ')}`);
  }

  const lengthSpec = LENGTH_SPECS[config.length];
  const audienceSpec = AUDIENCE_SPECS[config.audience];

  // Extract and format entry content
  const entryText = formatEntryForSummarization(entry);

  // LEARNING NOTE: Critical information extraction
  // Extract these FIRST to ensure they're available for the summary
  const criticalInfo = config.preserveCriticalInfo ? extractCriticalInfo(entry) : null;

  // Build the prompt
  const systemPrompt = buildSummarizationSystemPrompt(audienceSpec, lengthSpec, criticalInfo);
  
  const userPrompt = `Fasse diese Sozialleistung zusammen:

${entryText}`;

  try {
    const startTime = Date.now();

    const response = await createChatCompletion([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ], {
      model: config.model,
      temperature: config.temperature,
      max_tokens: calculateMaxTokensForLength(config.length),
    });

    const summary = response.choices[0].message.content.trim();
    const duration = Date.now() - startTime;

    // Track cost
    await trackCost({
      feature: 'summarization',
      model: config.model,
      inputTokens: response.usage.prompt_tokens,
      outputTokens: response.usage.completion_tokens,
      metadata: {
        length: config.length,
        audience: config.audience,
      }
    });

    return {
      text: summary,
      metadata: {
        length: config.length,
        audience: config.audience,
        model: config.model,
        wordCount: summary.split(/\s+/).length,
        duration,
        tokens: {
          input: response.usage.prompt_tokens,
          output: response.usage.completion_tokens,
          total: response.usage.prompt_tokens + response.usage.completion_tokens,
        },
      },
    };

  } catch (error) {
    throw new Error(`Summarization failed: ${error.message}`);
  }
}

/**
 * Build system prompt for summarization
 * 
 * LEARNING NOTE: This function constructs a detailed, structured prompt
 * that gives the LLM clear instructions and context.
 */
function buildSummarizationSystemPrompt(audienceSpec, lengthSpec, criticalInfo) {
  let prompt = `Du bist ein Experte darin, Informationen über Sozialleistungen zusammenzufassen.

ZIELGRUPPE: ${audienceSpec.name}
- Wissensstand: ${audienceSpec.knowledgeLevel}
- Sprachstil: ${audienceSpec.languageStyle}
- Ton: ${audienceSpec.tone}

INFORMATIONSBEDÜRFNISSE:
${audienceSpec.priorities.map(p => `- ${p}`).join('\n')}

LÄNGE:
- Zielwörter: ${lengthSpec.targetWords} Wörter
- Zielsätze: ${lengthSpec.targetSentences} Sätze
- Format: ${lengthSpec.description}`;

  // Add critical information preservation if provided
  if (criticalInfo && Object.keys(criticalInfo).length > 0) {
    prompt += `\n\nKRITISCHE INFORMATIONEN (MÜSSEN ERHALTEN BLEIBEN):`;
    if (criticalInfo.amounts) {
      prompt += `\n- Beträge: ${criticalInfo.amounts.join(', ')}`;
    }
    if (criticalInfo.dates) {
      prompt += `\n- Daten/Fristen: ${criticalInfo.dates.join(', ')}`;
    }
    if (criticalInfo.requirements) {
      prompt += `\n- Voraussetzungen: ${criticalInfo.requirements.join(', ')}`;
    }
  }

  prompt += `\n\nREGELN:
- Sei präzise und faktisch korrekt
- Verwende klare, verständliche Sprache
- Konzentriere dich auf die wichtigsten Informationen für die Zielgruppe
- Bewahre alle kritischen Informationen (Beträge, Fristen, Anforderungen)
- Schreibe auf Deutsch`;

  return prompt;
}

/**
 * Format entry for summarization
 * 
 * LEARNING NOTE: Convert structured entry data into readable text.
 * We format it clearly so the LLM can identify different components.
 */
function formatEntryForSummarization(entry) {
  const parts = [];

  // Title
  if (entry.title) {
    const title = extractGermanText(entry.title);
    if (title) parts.push(`TITEL: ${title}`);
  }

  // Description
  if (entry.description) {
    const desc = extractGermanText(entry.description);
    if (desc) parts.push(`BESCHREIBUNG: ${desc}`);
  }

  // Benefit amount
  if (entry.benefitAmount) {
    const amount = extractGermanText(entry.benefitAmount);
    if (amount) parts.push(`BETRAG: ${amount}`);
  }

  // Duration
  if (entry.duration) {
    parts.push(`DAUER: ${entry.duration}`);
  }

  // Eligibility
  if (entry.eligibilityCriteria) {
    const eligibility = extractGermanText(entry.eligibilityCriteria);
    if (eligibility) parts.push(`VORAUSSETZUNGEN: ${eligibility}`);
  }

  // Application steps
  if (entry.applicationSteps && Array.isArray(entry.applicationSteps)) {
    const steps = entry.applicationSteps
      .map(s => extractGermanText(s))
      .filter(Boolean)
      .map((step, i) => `${i + 1}. ${step}`)
      .join('\n');
    if (steps) parts.push(`ANTRAGSPROZESS:\n${steps}`);
  }

  // Required documents
  if (entry.requiredDocuments && Array.isArray(entry.requiredDocuments)) {
    const docs = entry.requiredDocuments
      .map(d => extractGermanText(d))
      .filter(Boolean)
      .map(doc => `- ${doc}`)
      .join('\n');
    if (docs) parts.push(`BENÖTIGTE DOKUMENTE:\n${docs}`);
  }

  // Contact info
  if (entry.contactInfo) {
    const contact = [];
    if (entry.contactInfo.name) contact.push(`Name: ${entry.contactInfo.name}`);
    if (entry.contactInfo.phone) contact.push(`Telefon: ${entry.contactInfo.phone}`);
    if (entry.contactInfo.email) contact.push(`E-Mail: ${entry.contactInfo.email}`);
    if (contact.length > 0) {
      parts.push(`KONTAKT:\n${contact.join('\n')}`);
    }
  }

  return parts.join('\n\n');
}

/**
 * Extract German text from multilingual field
 * 
 * LEARNING NOTE: Handle both string and object formats
 */
function extractGermanText(field) {
  if (typeof field === 'string') return field;
  if (typeof field === 'object' && field.de) return field.de;
  return null;
}

/**
 * Extract critical information that must be preserved
 * 
 * LEARNING NOTE: Use regex to find important data patterns.
 * This ensures we don't lose key facts during summarization.
 * 
 * PATTERNS WE LOOK FOR:
 * - Amounts: €500, 1.000 €, 500-1000€
 * - Dates: 31.12.2024, Dezember 2024
 * - Ages: unter 25, 18-65 Jahre
 * - Percentages: 50%, 30 Prozent
 */
function extractCriticalInfo(entry) {
  const text = formatEntryForSummarization(entry);
  const critical = {};

  // Extract monetary amounts
  const amountRegex = /€\s*[\d.,]+|[\d.,]+\s*€|[\d.,]+\s*(Euro|EUR)/gi;
  const amounts = text.match(amountRegex);
  if (amounts && amounts.length > 0) {
    critical.amounts = [...new Set(amounts)]; // Remove duplicates
  }

  // Extract dates and deadlines
  const dateRegex = /\d{1,2}\.\d{1,2}\.\d{2,4}|(?:Januar|Februar|März|April|Mai|Juni|Juli|August|September|Oktober|November|Dezember)\s+\d{4}|bis\s+\d{4}/gi;
  const dates = text.match(dateRegex);
  if (dates && dates.length > 0) {
    critical.dates = [...new Set(dates)];
  }

  // Extract requirements (age, employment status)
  const requirementRegex = /(?:unter|über|ab|bis)\s+\d+\s*(?:Jahre?|Monate?)|arbeitslos|erwerbslos|hilfebedürftig|bedürftig/gi;
  const requirements = text.match(requirementRegex);
  if (requirements && requirements.length > 0) {
    critical.requirements = [...new Set(requirements)];
  }

  return critical;
}

/**
 * Calculate max tokens based on desired summary length
 * 
 * LEARNING NOTE: Token estimation for output control.
 * Rule of thumb: 1 word ≈ 1.3 tokens in German
 */
function calculateMaxTokensForLength(length) {
  const specs = {
    short: 80,    // ~50 words * 1.3 + buffer
    medium: 200,  // ~150 words * 1.3
    long: 500,    // ~350 words * 1.3
  };
  return specs[length] || 200;
}

/**
 * Generate FAQ format from entry
 * 
 * FAQ GENERATION
 * ==============
 * 
 * LEARNING NOTE: FAQ (Frequently Asked Questions) format is excellent for:
 * - Quick scanning
 * - Direct answers to common questions
 * - SEO (search engines love Q&A format)
 * - Accessibility (screen readers handle it well)
 * 
 * COMMON QUESTIONS FOR BENEFITS:
 * - "Was ist [benefit name]?"
 * - "Wer kann es bekommen?"
 * - "Wie viel bekomme ich?"
 * - "Wie beantrage ich es?"
 * - "Welche Dokumente brauche ich?"
 * - "Wie lange dauert es?"
 * 
 * PROMPT STRATEGY:
 * - Ask LLM to generate 5-8 most common questions
 * - Provide concise answers (2-3 sentences each)
 * - Ensure answers are self-contained
 * 
 * @param {Object} entry - Entry to generate FAQ for
 * @param {Object} options - Generation options
 * @returns {Promise<Object>} FAQ with questions and answers
 * 
 * @example
 * const faq = await generateFAQ(entry);
 * faq.items.forEach(item => {
 *   console.log(`Q: ${item.question}`);
 *   console.log(`A: ${item.answer}\n`);
 * });
 */
export async function generateFAQ(entry, options = {}) {
  if (!entry || typeof entry !== 'object') {
    throw new Error('Entry must be an object');
  }

  const config = {
    model: options.model || 'gpt-4o-mini',
    temperature: 0.3,
    numQuestions: options.numQuestions || 6,
  };

  const entryText = formatEntryForSummarization(entry);

  const systemPrompt = `Du bist ein Experte für Sozialleistungen und erstellst FAQ (häufig gestellte Fragen).

Erstelle ${config.numQuestions} häufige Fragen und präzise Antworten zu dieser Sozialleistung.

TYPISCHE FRAGEN:
- "Was ist [Leistungsname]?"
- "Wer hat Anspruch auf [Leistung]?"
- "Wie hoch ist die Leistung?"
- "Wie beantrage ich [Leistung]?"
- "Welche Unterlagen brauche ich?"
- "Wie lange dauert die Bearbeitung?"
- "Wo stelle ich den Antrag?"
- "Kann ich [Leistung] mit anderen Leistungen kombinieren?"

ANFORDERUNGEN AN ANTWORTEN:
- Kurz und präzise (2-3 Sätze)
- Faktisch korrekt
- Selbsterklärend (ohne vorherige Fragen zu kennen)
- Alle wichtigen Details enthalten (Beträge, Fristen)
- Einfache, klare Sprache

Antworte im JSON-Format:
{
  "items": [
    {"question": "Frage 1?", "answer": "Antwort 1"},
    {"question": "Frage 2?", "answer": "Antwort 2"}
  ]
}`;

  try {
    const response = await createChatCompletion([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: entryText }
    ], {
      model: config.model,
      temperature: config.temperature,
      max_tokens: 1500,
    });

    const content = response.choices[0].message.content;
    const cleaned = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const result = JSON.parse(cleaned);

    await trackCost({
      feature: 'faq_generation',
      model: config.model,
      inputTokens: response.usage.prompt_tokens,
      outputTokens: response.usage.completion_tokens,
    });

    return {
      items: result.items || [],
      metadata: {
        model: config.model,
        numQuestions: result.items?.length || 0,
        tokens: {
          input: response.usage.prompt_tokens,
          output: response.usage.completion_tokens,
        },
      },
    };

  } catch (error) {
    throw new Error(`FAQ generation failed: ${error.message}`);
  }
}

/**
 * Summarize and compare multiple entries
 * 
 * MULTI-DOCUMENT SUMMARIZATION
 * =============================
 * 
 * LEARNING NOTE: Comparing multiple documents is more complex than summarizing one.
 * 
 * CHALLENGES:
 * 1. TOKEN LIMITS: Multiple documents may exceed context window
 * 2. INFORMATION OVERLOAD: Too much to summarize coherently
 * 3. COMPARISON: Need to highlight similarities and differences
 * 4. FAIRNESS: Don't bias toward first/last document
 * 
 * STRATEGIES:
 * 
 * 1. MAP-REDUCE:
 *    - Summarize each document individually (MAP)
 *    - Combine summaries into final summary (REDUCE)
 *    - Good for: Many documents, long documents
 * 
 * 2. DIRECT COMPARISON:
 *    - Send all documents in one prompt
 *    - Ask for comparative analysis
 *    - Good for: Few documents (2-4), short documents
 * 
 * 3. STRUCTURED COMPARISON:
 *    - Extract key attributes from each
 *    - Build comparison table
 *    - Summarize differences
 *    - BEST for benefits comparison
 * 
 * This implementation uses strategy #3 (structured comparison).
 * 
 * @param {Array<Object>} entries - Multiple entries to compare
 * @param {Object} options - Comparison options
 * @returns {Promise<Object>} Comparative summary
 * 
 * @example
 * const entries = [bürgergeldEntry, wohngeldEntry];
 * const comparison = await summarizeMultiple(entries, {
 *   audience: 'general',
 *   focusOn: ['eligibility', 'amounts']
 * });
 * console.log(comparison.summary);
 * console.log(comparison.comparison); // Structured comparison
 */
export async function summarizeMultiple(entries, options = {}) {
  if (!Array.isArray(entries) || entries.length < 2) {
    throw new Error('Must provide at least 2 entries to compare');
  }

  if (entries.length > 5) {
    throw new Error('Maximum 5 entries supported for comparison');
  }

  const config = {
    model: options.model || 'gpt-4o',  // Use more capable model for complex task
    temperature: 0.3,
    audience: options.audience || 'general',
    focusOn: options.focusOn || ['eligibility', 'amounts', 'application'],
  };

  // Format each entry with a label
  const formattedEntries = entries.map((entry, index) => {
    const title = extractGermanText(entry.title) || `Leistung ${index + 1}`;
    const formatted = formatEntryForSummarization(entry);
    return `=== ${title} ===\n${formatted}`;
  }).join('\n\n---\n\n');

  const audienceSpec = AUDIENCE_SPECS[config.audience] || AUDIENCE_SPECS.general;

  const systemPrompt = `Du bist ein Experte für Sozialleistungen und vergleichst verschiedene Leistungen.

ZIELGRUPPE: ${audienceSpec.name}
- Wissensstand: ${audienceSpec.knowledgeLevel}
- Sprachstil: ${audienceSpec.languageStyle}

AUFGABE:
1. Vergleiche die Leistungen systematisch
2. Zeige Gemeinsamkeiten und Unterschiede
3. Konzentriere dich auf: ${config.focusOn.join(', ')}
4. Hilf dem Leser zu verstehen, welche Leistung für wen geeignet ist

STRUKTUR DEINER ANTWORT:
1. ÜBERBLICK: Kurze Einführung zu den Leistungen
2. VERGLEICH: Systematischer Vergleich nach Kategorien
3. EMPFEHLUNGEN: Wer sollte welche Leistung in Betracht ziehen?

Antworte im JSON-Format:
{
  "overview": "Überblick über alle Leistungen",
  "comparison": {
    "eligibility": "Vergleich der Voraussetzungen",
    "amounts": "Vergleich der Beträge",
    "application": "Vergleich der Antragsprozesse"
  },
  "recommendations": [
    "Empfehlung 1: Für X ist Y geeignet, weil...",
    "Empfehlung 2: ..."
  ]
}`;

  try {
    const response = await createChatCompletion([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: formattedEntries }
    ], {
      model: config.model,
      temperature: config.temperature,
      max_tokens: 2000,
    });

    const content = response.choices[0].message.content;
    const cleaned = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const result = JSON.parse(cleaned);

    await trackCost({
      feature: 'multi_document_summarization',
      model: config.model,
      inputTokens: response.usage.prompt_tokens,
      outputTokens: response.usage.completion_tokens,
      metadata: {
        numEntries: entries.length,
      }
    });

    return {
      overview: result.overview,
      comparison: result.comparison,
      recommendations: result.recommendations || [],
      metadata: {
        numEntries: entries.length,
        model: config.model,
        audience: config.audience,
        tokens: {
          input: response.usage.prompt_tokens,
          output: response.usage.completion_tokens,
        },
      },
    };

  } catch (error) {
    throw new Error(`Multi-document summarization failed: ${error.message}`);
  }
}

/**
 * Extract key facts from entry
 * 
 * KEY FACT EXTRACTION
 * ===================
 * 
 * LEARNING NOTE: This is extractive summarization - we pull out specific
 * facts rather than generating new text.
 * 
 * WHY EXTRACT FACTS SEPARATELY?
 * - Quick reference (don't need to read full summary)
 * - Data for structured displays (cards, tables)
 * - Input for other processes (notifications, alerts)
 * - Fact-checking and validation
 * 
 * EXTRACTION TECHNIQUES:
 * 
 * 1. RULE-BASED:
 *    - Regex patterns for amounts, dates
 *    - Fast, accurate for structured data
 *    - Brittle (breaks with format changes)
 * 
 * 2. NER (Named Entity Recognition):
 *    - ML models trained to identify entities
 *    - Good accuracy
 *    - Requires training data
 * 
 * 3. LLM-BASED:
 *    - Ask LLM to extract specific information
 *    - Flexible, handles variations
 *    - Can explain ambiguities
 *    - BEST for complex, varied documents
 * 
 * This implementation uses LLM-based extraction.
 * 
 * @param {Object} entry - Entry to extract facts from
 * @param {Object} options - Extraction options
 * @returns {Promise<Object>} Extracted key facts
 * 
 * @example
 * const facts = await extractKeyFacts(entry);
 * console.log('Amount:', facts.amount);
 * console.log('Eligibility:', facts.eligibility);
 * console.log('Deadline:', facts.deadline);
 */
export async function extractKeyFacts(entry, options = {}) {
  if (!entry || typeof entry !== 'object') {
    throw new Error('Entry must be an object');
  }

  const config = {
    model: options.model || 'gpt-4o-mini',
    temperature: 0, // Deterministic for fact extraction
  };

  const entryText = formatEntryForSummarization(entry);

  const systemPrompt = `Du bist ein Experte für Informationsextraktion aus Sozialleistungsbeschreibungen.

Extrahiere die wichtigsten Fakten aus dem Text.

ZU EXTRAHIERENDE INFORMATIONEN:
- name: Name der Leistung
- amount: Betrag (mit Einheit und Zeitraum)
- eligibility: Kurze Zusammenfassung der Voraussetzungen
- duration: Wie lange wird die Leistung gewährt?
- deadline: Wichtige Fristen oder Termine
- contact: Wo/bei wem beantragt man?
- applicationTime: Wie lange dauert die Bearbeitung?
- requiredDocs: Liste der wichtigsten benötigten Dokumente

WICHTIG:
- Extrahiere nur Fakten, die explizit im Text stehen
- Verwende null für fehlende Informationen
- Sei präzise und wörtlich
- Bewahre Zahlen, Daten und Beträge exakt

Antworte im JSON-Format:
{
  "name": "Name der Leistung",
  "amount": "Betrag oder null",
  "eligibility": "Voraussetzungen oder null",
  "duration": "Dauer oder null",
  "deadline": "Frist oder null",
  "contact": "Kontaktstelle oder null",
  "applicationTime": "Bearbeitungszeit oder null",
  "requiredDocs": ["Dok1", "Dok2"] oder []
}`;

  try {
    const response = await createChatCompletion([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: entryText }
    ], {
      model: config.model,
      temperature: config.temperature,
      max_tokens: 800,
    });

    const content = response.choices[0].message.content;
    const cleaned = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const facts = JSON.parse(cleaned);

    await trackCost({
      feature: 'key_fact_extraction',
      model: config.model,
      inputTokens: response.usage.prompt_tokens,
      outputTokens: response.usage.completion_tokens,
    });

    return {
      facts,
      metadata: {
        model: config.model,
        extractedFields: Object.keys(facts).filter(k => facts[k] !== null).length,
        tokens: {
          input: response.usage.prompt_tokens,
          output: response.usage.completion_tokens,
        },
      },
    };

  } catch (error) {
    throw new Error(`Key fact extraction failed: ${error.message}`);
  }
}

/**
 * USAGE EXAMPLES
 * ==============
 */

// Example 1: Basic summarization
async function example1() {
  const entry = {
    title: { de: "Bürgergeld" },
    description: { de: "Finanzielle Grundsicherung für Arbeitsuchende..." },
    benefitAmount: { de: "563€ pro Monat für Alleinstehende" },
    eligibilityCriteria: { de: "Arbeitslos und hilfebedürftig" },
  };

  const summary = await summarize(entry, {
    length: 'short',
    audience: 'general'
  });

  console.log(summary.text);
  console.log(`Words: ${summary.metadata.wordCount}`);
}

// Example 2: Different audiences
async function example2() {
  const entry = { /* ... */ };

  // For general public
  const publicSummary = await summarize(entry, {
    length: 'medium',
    audience: 'general'
  });

  // For social workers
  const expertSummary = await summarize(entry, {
    length: 'long',
    audience: 'experts'
  });

  console.log('For public:', publicSummary.text);
  console.log('\nFor experts:', expertSummary.text);
}

// Example 3: FAQ generation
async function example3() {
  const entry = { /* ... */ };

  const faq = await generateFAQ(entry);

  faq.items.forEach((item, i) => {
    console.log(`\n${i + 1}. ${item.question}`);
    console.log(`   ${item.answer}`);
  });
}

// Example 4: Comparison
async function example4() {
  const entries = [
    { title: { de: "Bürgergeld" }, /* ... */ },
    { title: { de: "Wohngeld" }, /* ... */ },
  ];

  const comparison = await summarizeMultiple(entries, {
    audience: 'general',
    focusOn: ['eligibility', 'amounts']
  });

  console.log('Overview:', comparison.overview);
  console.log('\nComparison:', comparison.comparison);
  console.log('\nRecommendations:', comparison.recommendations);
}

// Example 5: Key facts extraction
async function example5() {
  const entry = { /* ... */ };

  const extracted = await extractKeyFacts(entry);

  console.log('Name:', extracted.facts.name);
  console.log('Amount:', extracted.facts.amount);
  console.log('Eligibility:', extracted.facts.eligibility);
  console.log('Required docs:', extracted.facts.requiredDocs);
}

export default {
  summarize,
  generateFAQ,
  summarizeMultiple,
  extractKeyFacts,
};
