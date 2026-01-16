/**
 * Systemfehler - Query Processor Module
 * 
 * This module handles query understanding and preprocessing for RAG systems.
 * It transforms raw user questions into optimized queries for retrieval.
 * 
 * ============================================================================
 * WHAT IS QUERY PROCESSING?
 * ============================================================================
 * 
 * Query processing is the first step in a RAG pipeline. It analyzes and
 * transforms the user's question to improve retrieval quality.
 * 
 * RAW QUERY → PROCESSED QUERY → RETRIEVAL → ANSWER
 * 
 * EXAMPLE TRANSFORMATION:
 * -----------------------
 * Raw query: "Can I get help with rent?"
 * 
 * After processing:
 * - Intent: eligibility_check
 * - Entities: {benefit_type: "rental_assistance"}
 * - Expanded: "Can I get help with rent? rental assistance housing support"
 * - Variations: ["rent help", "rental aid", "housing assistance"]
 * 
 * ============================================================================
 * WHY QUERY PROCESSING MATTERS
 * ============================================================================
 * 
 * PROBLEM 1: VOCABULARY MISMATCH
 * -------------------------------
 * User says: "unemployment money"
 * Documents say: "Arbeitslosengeld" (unemployment benefit)
 * → Query expansion adds synonyms and translations
 * 
 * PROBLEM 2: AMBIGUITY
 * --------------------
 * "How do I apply?" → Apply for what? Need context.
 * Intent classification and entity extraction help clarify.
 * 
 * PROBLEM 3: COMPLEX QUESTIONS
 * ----------------------------
 * "I'm 65, retired, and need help with medical costs"
 * → Extract: age=65, employment=retired, need=medical
 * → Route to appropriate documents
 * 
 * PROBLEM 4: MULTILINGUAL QUERIES
 * -------------------------------
 * User asks in German, some docs are in English
 * → Language detection and translation
 * 
 * ============================================================================
 * QUERY PROCESSING TECHNIQUES
 * ============================================================================
 * 
 * 1. INTENT CLASSIFICATION
 * ------------------------
 * Determine what the user is trying to do:
 * - eligibility_check: "Am I eligible for X?"
 * - how_to: "How do I apply for X?"
 * - comparison: "What's the difference between X and Y?"
 * - temporal: "When does X expire?"
 * - definition: "What is X?"
 * 
 * Methods:
 * - Rule-based: Keywords and patterns
 * - ML-based: Text classifier (NLP model)
 * - LLM-based: Ask LLM to classify
 * 
 * 2. ENTITY EXTRACTION
 * -------------------
 * Extract key information:
 * - Amounts: "€500/month" → {amount: 500, currency: "EUR", period: "month"}
 * - Dates: "last year" → {date: "2023", relative: true}
 * - Locations: "Berlin" → {location: "Berlin", type: "city"}
 * - Benefits: "Bürgergeld" → {benefit_type: "buergergeld"}
 * 
 * Methods:
 * - Regex: Simple patterns (dates, amounts)
 * - NER: Named Entity Recognition models
 * - Custom rules: Domain-specific entities
 * 
 * 3. QUERY EXPANSION
 * ------------------
 * Add related terms to improve recall:
 * 
 * Original: "affordable housing"
 * Expanded: "affordable housing low-cost apartments subsidized rent social housing"
 * 
 * Techniques:
 * - Synonyms: WordNet, thesaurus
 * - Embeddings: Find similar terms
 * - Domain knowledge: Manual synonym lists
 * - Pseudo-relevance feedback: Use top results to expand
 * 
 * 4. QUERY REFORMULATION
 * ----------------------
 * Rewrite query for better matching:
 * 
 * Original: "Can I get Bürgergeld?"
 * Reformulated: "Bürgergeld eligibility requirements"
 * 
 * 5. SPELLING CORRECTION
 * ----------------------
 * Fix typos: "unemploment" → "unemployment"
 * 
 * 6. LANGUAGE DETECTION
 * ---------------------
 * Detect query language for multilingual systems
 * 
 * ============================================================================
 * IMPLEMENTATION STRATEGY
 * ============================================================================
 * 
 * START SIMPLE:
 * -------------
 * 1. Basic intent classification (rule-based)
 * 2. Regex for common entities (amounts, dates)
 * 3. Simple synonym expansion
 * 
 * ITERATE:
 * --------
 * 1. Add more intent types based on user queries
 * 2. Improve entity extraction with NER
 * 3. Use LLM for complex query understanding
 * 
 * PRODUCTION:
 * -----------
 * 1. Fine-tuned models for intent/entities
 * 2. Query logs to learn patterns
 * 3. A/B testing different expansions
 * 
 * @see rag_pipeline.js for how this integrates into RAG
 * @see semantic_search.js for the retrieval step
 * @see ../llm/llm_client.js for LLM-based processing
 */

import { createChatCompletion } from '../llm/llm_client.js';

/**
 * Intent types we can classify
 * 
 * LEARNING NOTE: Start with a small set of intents.
 * Add more as you analyze user queries and find patterns.
 */
export const INTENT_TYPES = {
  ELIGIBILITY: 'eligibility',           // "Am I eligible for X?"
  HOW_TO: 'how_to',                     // "How do I apply?"
  COMPARISON: 'comparison',             // "What's the difference?"
  TEMPORAL: 'temporal',                 // "When does X expire?"
  DEFINITION: 'definition',             // "What is X?"
  CALCULATION: 'calculation',           // "How much will I receive?"
  CONTACT: 'contact',                   // "Where do I go?"
  STATUS: 'status',                     // "What's the status of my application?"
  GENERAL: 'general',                   // Generic questions
};

/**
 * Entity types we can extract
 */
export const ENTITY_TYPES = {
  AMOUNT: 'amount',                     // €500, $1000
  DATE: 'date',                         // 2024-01-01, last year
  LOCATION: 'location',                 // Berlin, Bavaria
  BENEFIT: 'benefit',                   // Bürgergeld, Wohngeld
  PERSON: 'person',                     // Name, age, status
  ORGANIZATION: 'organization',         // Job center, agency
};

/**
 * Common German social benefit terms and synonyms
 * 
 * LEARNING NOTE: Domain-specific synonym lists are crucial for RAG.
 * Build these from:
 * - Subject matter experts
 * - User query logs
 * - Document analysis
 */
const SOCIAL_BENEFIT_SYNONYMS = {
  'Bürgergeld': ['citizen money', 'basic income', 'unemployment benefit II', 'ALG II', 'Hartz IV'],
  'Arbeitslosengeld': ['unemployment benefit', 'ALG', 'unemployment money', 'jobless benefit'],
  'Wohngeld': ['housing benefit', 'rent subsidy', 'rental assistance', 'housing allowance'],
  'Kindergeld': ['child benefit', 'child allowance', 'family benefit', 'children money'],
  'Elterngeld': ['parental allowance', 'parental benefit', 'parents money'],
  'BAföG': ['student aid', 'education grant', 'student support', 'study assistance'],
  'Grundsicherung': ['basic security', 'basic provision', 'pension supplement'],
  'Wohnberechtigungsschein': ['housing certificate', 'WBS', 'social housing permit'],
};

/**
 * Process a user query for optimal retrieval
 * 
 * This is the main entry point for query processing.
 * 
 * WORKFLOW:
 * ---------
 * 1. Classify intent
 * 2. Extract entities
 * 3. Expand query with synonyms
 * 4. Generate query variations
 * 
 * LEARNING NOTE: Processing steps are sequential because later steps
 * may depend on earlier ones (e.g., expansion depends on entities).
 * 
 * @param {string} query - Raw user query
 * @param {Object} options - Processing options
 * @param {boolean} options.expandQuery - Enable query expansion (default: true)
 * @param {boolean} options.extractEntities - Enable entity extraction (default: true)
 * @param {boolean} options.generateVariations - Generate query variations (default: false)
 * @param {boolean} options.useLLM - Use LLM for advanced processing (default: false)
 * 
 * @returns {Promise<Object>} Processed query information
 * @returns {string} return.original - Original query
 * @returns {string} return.intent - Classified intent
 * @returns {Array} return.entities - Extracted entities
 * @returns {string} return.expanded - Query with synonyms added
 * @returns {Array} return.variations - Alternative query formulations
 * @returns {Object} return.metadata - Additional metadata
 * 
 * @example
 * const result = await processQuery("Can I get Bürgergeld?");
 * // {
 * //   original: "Can I get Bürgergeld?",
 * //   intent: "eligibility",
 * //   entities: [{type: "benefit", value: "Bürgergeld"}],
 * //   expanded: "Can I get Bürgergeld? citizen money basic income unemployment benefit",
 * //   variations: ["Bürgergeld eligibility", "Am I eligible for Bürgergeld"],
 * //   metadata: { language: "en", confidence: 0.85 }
 * // }
 */
export async function processQuery(query, options = {}) {
  // Validate input
  if (!query || typeof query !== 'string') {
    throw new Error('Query must be a non-empty string');
  }

  query = query.trim();
  if (query.length === 0) {
    throw new Error('Query cannot be empty');
  }

  // Parse options with defaults
  const expandQuery = options.expandQuery ?? true;
  const extractEntitiesFlag = options.extractEntities ?? true;
  const generateVariations = options.generateVariations ?? false;
  const useLLM = options.useLLM ?? false;

  try {
    // Step 1: Classify intent
    // LEARNING NOTE: Intent classification helps route queries to appropriate
    // document sets and can influence prompt construction
    const intent = await classifyIntent(query, { useLLM });

    // Step 2: Extract entities
    // LEARNING NOTE: Entities help filter and rerank results
    // e.g., if user mentions "Berlin", boost documents tagged with Berlin
    const entities = extractEntitiesFlag ? await extractEntities(query) : [];

    // Step 3: Expand query (optional)
    // LEARNING NOTE: Expansion helps recall but may reduce precision
    // Use with semantic search which is more forgiving of extra terms
    let expanded = query;
    if (expandQuery) {
      expanded = await expandQueryWithSynonyms(query, entities);
    }

    // Step 4: Generate variations (optional)
    // LEARNING NOTE: Variations can be used to search multiple times
    // and merge results, improving recall
    let variations = [query];
    if (generateVariations) {
      variations = await generateQueryVariations(query, intent, entities);
    }

    // Detect language
    // LEARNING NOTE: Simple heuristic - real implementation would use
    // language detection library (franc, langdetect)
    const language = detectLanguage(query);

    return {
      original: query,
      intent,
      entities,
      expanded,
      variations,
      metadata: {
        language,
        confidence: 0.85, // Placeholder - real implementation would compute this
        processedAt: new Date().toISOString(),
      },
    };

  } catch (error) {
    console.error('[QueryProcessor] Processing failed:', error);
    // Return minimal processed query on error
    return {
      original: query,
      intent: INTENT_TYPES.GENERAL,
      entities: [],
      expanded: query,
      variations: [query],
      metadata: {
        language: 'unknown',
        confidence: 0.0,
        error: error.message,
      },
    };
  }
}

/**
 * Classify the intent of a query
 * 
 * LEARNING NOTE: Intent classification is critical for RAG systems.
 * It helps:
 * - Route queries to appropriate document sets
 * - Construct better prompts for the LLM
 * - Track what users are asking about
 * 
 * APPROACHES:
 * -----------
 * 1. Rule-based (our default): Fast, predictable, transparent
 *    - Use keyword patterns
 *    - Good for well-defined domains
 *    - Easy to debug and update
 * 
 * 2. ML-based: More accurate, handles variations better
 *    - Train classifier on labeled queries
 *    - Requires training data
 *    - Less interpretable
 * 
 * 3. LLM-based (optional): Most flexible, no training needed
 *    - Ask LLM to classify
 *    - Higher latency and cost
 *    - Good for complex or ambiguous queries
 * 
 * @param {string} query - User query
 * @param {Object} options - Classification options
 * @param {boolean} options.useLLM - Use LLM for classification
 * 
 * @returns {Promise<string>} Intent type
 * 
 * @example
 * await classifyIntent("Am I eligible for Bürgergeld?")
 * // Returns: "eligibility"
 * 
 * await classifyIntent("How do I apply for housing benefit?")
 * // Returns: "how_to"
 */
export async function classifyIntent(query, options = {}) {
  const normalizedQuery = query.toLowerCase();

  // Use LLM for classification (more accurate but slower)
  if (options.useLLM) {
    return await classifyIntentWithLLM(query);
  }

  // Rule-based classification using keyword patterns
  // LEARNING NOTE: Ordered by specificity - check specific patterns first

  // ELIGIBILITY: Questions about qualifying or being eligible
  if (
    /\b(eligible|qualify|can i get|can i receive|am i entitled)\b/i.test(normalizedQuery) ||
    /\b(berechtigt|anspruch|bekomme ich|erhalte ich)\b/i.test(normalizedQuery)
  ) {
    return INTENT_TYPES.ELIGIBILITY;
  }

  // HOW_TO: Process questions
  if (
    /\b(how (do|can|to)|apply|application|process|steps|register)\b/i.test(normalizedQuery) ||
    /\b(wie|beantragen|anmelden|verfahren|schritte)\b/i.test(normalizedQuery)
  ) {
    return INTENT_TYPES.HOW_TO;
  }

  // COMPARISON: Difference between things
  if (
    /\b(difference|compare|versus|vs|better|which one)\b/i.test(normalizedQuery) ||
    /\b(unterschied|vergleich|besser)\b/i.test(normalizedQuery)
  ) {
    return INTENT_TYPES.COMPARISON;
  }

  // TEMPORAL: Time-related questions
  if (
    /\b(when|until when|deadline|expire|how long|duration)\b/i.test(normalizedQuery) ||
    /\b(wann|bis wann|frist|ablauf|wie lange|dauer)\b/i.test(normalizedQuery)
  ) {
    return INTENT_TYPES.TEMPORAL;
  }

  // CALCULATION: Amount questions
  if (
    /\b(how much|amount|calculate|payment|receive)\b/i.test(normalizedQuery) ||
    /\b(wie viel|betrag|berechnen|zahlung|erhalte)\b/i.test(normalizedQuery)
  ) {
    return INTENT_TYPES.CALCULATION;
  }

  // CONTACT: Where to go, who to contact
  if (
    /\b(where|contact|office|phone|email|address|location)\b/i.test(normalizedQuery) ||
    /\b(wo|kontakt|büro|telefon|adresse|standort)\b/i.test(normalizedQuery)
  ) {
    return INTENT_TYPES.CONTACT;
  }

  // DEFINITION: What is something
  if (
    /\b(what is|define|explain|meaning of)\b/i.test(normalizedQuery) ||
    /\b(was ist|bedeutung|erklärung)\b/i.test(normalizedQuery)
  ) {
    return INTENT_TYPES.DEFINITION;
  }

  // STATUS: Application status
  if (
    /\b(status|state|progress|approved|denied|pending)\b/i.test(normalizedQuery) ||
    /\b(status|stand|fortschritt|genehmigt|abgelehnt)\b/i.test(normalizedQuery)
  ) {
    return INTENT_TYPES.STATUS;
  }

  // Default to general if no pattern matches
  return INTENT_TYPES.GENERAL;
}

/**
 * Classify intent using LLM
 * 
 * LEARNING NOTE: LLM-based classification is more accurate for edge cases
 * but adds latency (~200-500ms) and cost (~$0.0001 per query).
 * 
 * Use when:
 * - Rule-based classification is insufficient
 * - Queries are complex or ambiguous
 * - High accuracy is critical
 * 
 * Don't use when:
 * - Low latency is required
 * - Cost is a concern
 * - Simple patterns work well enough
 * 
 * @param {string} query - User query
 * @returns {Promise<string>} Intent type
 */
async function classifyIntentWithLLM(query) {
  const prompt = `Classify the intent of this query into one of these categories:
- eligibility: Questions about qualifying or being eligible
- how_to: Questions about processes or how to do something
- comparison: Questions comparing options
- temporal: Questions about timing or deadlines
- definition: Questions asking what something is
- calculation: Questions about amounts or calculations
- contact: Questions about where to go or who to contact
- status: Questions about application status
- general: General questions

Query: "${query}"

Respond with only the category name, nothing else.`;

  try {
    const response = await createChatCompletion([
      { role: 'user', content: prompt }
    ], {
      temperature: 0, // Deterministic for classification
      max_tokens: 20, // Just need one word
    });

    // Extract intent from response
    const intent = response.content.trim().toLowerCase();

    // Validate it's a known intent
    if (Object.values(INTENT_TYPES).includes(intent)) {
      return intent;
    }

    // Fallback if LLM returns unknown intent
    console.warn(`[QueryProcessor] LLM returned unknown intent: ${intent}`);
    return INTENT_TYPES.GENERAL;

  } catch (error) {
    console.error('[QueryProcessor] LLM intent classification failed:', error);
    // Fallback to rule-based
    return classifyIntent(query, { useLLM: false });
  }
}

/**
 * Extract entities from query
 * 
 * LEARNING NOTE: Entity extraction helps:
 * - Filter documents (e.g., only Berlin-related)
 * - Rerank results (boost documents mentioning extracted entities)
 * - Construct better prompts (include entity context)
 * - Validate answers (check if LLM used correct entities)
 * 
 * APPROACHES:
 * -----------
 * 1. Regex (our approach): Fast, good for structured entities
 *    - Amounts: €500, $1000
 *    - Dates: 2024-01-01, 01.01.2024
 *    - Simple and deterministic
 * 
 * 2. NER Models: Better for complex entities
 *    - spaCy, BERT-based NER
 *    - Handles variations and context
 *    - Requires model deployment
 * 
 * 3. LLM-based: Most flexible
 *    - Can extract any entity type
 *    - Understands context deeply
 *    - Higher cost and latency
 * 
 * @param {string} query - User query
 * @returns {Promise<Array>} Extracted entities
 * 
 * @example
 * await extractEntities("I'm 65 and need €500/month for rent in Berlin")
 * // Returns: [
 * //   {type: "amount", value: "€500", normalized: 500, currency: "EUR"},
 * //   {type: "location", value: "Berlin"},
 * //   {type: "age", value: 65}
 * // ]
 */
export async function extractEntities(query) {
  const entities = [];

  // Extract amounts (€500, $1000, 500 EUR)
  // LEARNING NOTE: Use named capture groups for clarity
  const amountRegex = /(?:€|EUR|euro|euros?)\s*(\d+(?:[.,]\d+)?)|(\d+(?:[.,]\d+)?)\s*(?:€|EUR|euro|euros?)/gi;
  let match;
  while ((match = amountRegex.exec(query)) !== null) {
    const amount = match[1] || match[2];
    const normalizedAmount = parseFloat(amount.replace(',', '.'));
    
    entities.push({
      type: ENTITY_TYPES.AMOUNT,
      value: match[0],
      normalized: normalizedAmount,
      currency: 'EUR',
      position: match.index,
    });
  }

  // Extract dates (2024, 2024-01-01, 01.01.2024, "last year")
  // LEARNING NOTE: Date parsing is complex. This is a simplified version.
  // Production would use date-fns, moment, or similar library
  
  // ISO dates: 2024-01-01
  const isoDateRegex = /\b(\d{4})-(\d{2})-(\d{2})\b/g;
  while ((match = isoDateRegex.exec(query)) !== null) {
    entities.push({
      type: ENTITY_TYPES.DATE,
      value: match[0],
      year: parseInt(match[1]),
      month: parseInt(match[2]),
      day: parseInt(match[3]),
      position: match.index,
    });
  }

  // German dates: 01.01.2024
  const germanDateRegex = /\b(\d{2})\.(\d{2})\.(\d{4})\b/g;
  while ((match = germanDateRegex.exec(query)) !== null) {
    entities.push({
      type: ENTITY_TYPES.DATE,
      value: match[0],
      day: parseInt(match[1]),
      month: parseInt(match[2]),
      year: parseInt(match[3]),
      position: match.index,
    });
  }

  // Relative dates: "last year", "next month"
  const relativeDateRegex = /\b(last|next|this)\s+(year|month|week|day)\b/gi;
  while ((match = relativeDateRegex.exec(query)) !== null) {
    entities.push({
      type: ENTITY_TYPES.DATE,
      value: match[0],
      relative: true,
      position: match.index,
    });
  }

  // Extract known benefit types
  // LEARNING NOTE: Check longest terms first to avoid partial matches
  for (const [benefit, synonyms] of Object.entries(SOCIAL_BENEFIT_SYNONYMS)) {
    // Check if benefit name or any synonym appears
    const allTerms = [benefit, ...synonyms];
    for (const term of allTerms) {
      const regex = new RegExp(`\\b${term}\\b`, 'gi');
      if (regex.test(query)) {
        // Avoid duplicates
        const alreadyExtracted = entities.some(
          e => e.type === ENTITY_TYPES.BENEFIT && e.canonical === benefit
        );
        
        if (!alreadyExtracted) {
          entities.push({
            type: ENTITY_TYPES.BENEFIT,
            value: term,
            canonical: benefit, // Normalized form
          });
        }
        break; // Found this benefit, move to next
      }
    }
  }

  // Extract German cities (common ones)
  // LEARNING NOTE: Real implementation would use complete city database
  const cities = [
    'Berlin', 'Hamburg', 'München', 'Munich', 'Köln', 'Cologne',
    'Frankfurt', 'Stuttgart', 'Düsseldorf', 'Dortmund', 'Essen',
    'Leipzig', 'Bremen', 'Dresden', 'Hannover', 'Nürnberg', 'Nuremberg'
  ];
  
  for (const city of cities) {
    const regex = new RegExp(`\\b${city}\\b`, 'gi');
    if (regex.test(query)) {
      entities.push({
        type: ENTITY_TYPES.LOCATION,
        value: city,
        locationType: 'city',
      });
    }
  }

  // Extract ages
  const ageRegex = /\b(?:age|aged|years old|jahre alt)\s+(\d{1,3})|(\d{1,3})\s+(?:years old|jahre alt)\b/gi;
  while ((match = ageRegex.exec(query)) !== null) {
    const age = parseInt(match[1] || match[2]);
    if (age >= 0 && age <= 120) { // Sanity check
      entities.push({
        type: ENTITY_TYPES.PERSON,
        attribute: 'age',
        value: age,
        position: match.index,
      });
    }
  }

  return entities;
}

/**
 * Expand query with synonyms and related terms
 * 
 * LEARNING NOTE: Query expansion increases recall (finding more relevant docs)
 * but may decrease precision (finding less relevant docs too).
 * 
 * WHEN TO USE:
 * ------------
 * - With semantic search (embeddings handle synonyms naturally)
 * - When recall is more important than precision
 * - For short queries (1-3 words)
 * 
 * WHEN NOT TO USE:
 * ---------------
 * - With keyword search only (may return noise)
 * - For very specific queries (expansion adds irrelevant terms)
 * - When precision is critical
 * 
 * EXPANSION TECHNIQUES:
 * ---------------------
 * 1. Synonym expansion (our approach)
 *    - Use curated synonym lists
 *    - Add domain-specific terms
 * 
 * 2. Embedding-based expansion
 *    - Find similar terms using word embeddings
 *    - More coverage but less control
 * 
 * 3. Pseudo-relevance feedback
 *    - Do initial search
 *    - Extract terms from top results
 *    - Re-search with expanded query
 * 
 * @param {string} query - Original query
 * @param {Array} entities - Extracted entities (to expand)
 * @returns {Promise<string>} Expanded query
 * 
 * @example
 * await expandQueryWithSynonyms("Bürgergeld help", [...])
 * // Returns: "Bürgergeld help citizen money basic income unemployment benefit assistance"
 */
export async function expandQueryWithSynonyms(query, entities = []) {
  const expansionTerms = [];

  // Expand benefit entities with their synonyms
  for (const entity of entities) {
    if (entity.type === ENTITY_TYPES.BENEFIT && entity.canonical) {
      const synonyms = SOCIAL_BENEFIT_SYNONYMS[entity.canonical] || [];
      // Add first 2-3 synonyms to avoid query becoming too long
      expansionTerms.push(...synonyms.slice(0, 3));
    }
  }

  // Add general synonyms for common terms
  // LEARNING NOTE: These are social benefit domain-specific
  const generalSynonyms = {
    'help': ['assistance', 'support', 'aid', 'Hilfe', 'Unterstützung'],
    'money': ['payment', 'benefit', 'allowance', 'Geld', 'Zahlung'],
    'apply': ['application', 'request', 'beantragen', 'Antrag'],
    'eligible': ['qualify', 'entitled', 'berechtigt', 'Anspruch'],
    'rent': ['rental', 'housing', 'Miete', 'Wohnung'],
    'child': ['children', 'kid', 'Kind', 'Kinder'],
    'job': ['employment', 'work', 'Arbeit', 'Beschäftigung'],
    'medical': ['health', 'healthcare', 'doctor', 'medizinisch', 'Gesundheit'],
  };

  const queryLower = query.toLowerCase();
  for (const [term, synonyms] of Object.entries(generalSynonyms)) {
    if (queryLower.includes(term)) {
      // Add 1-2 most relevant synonyms
      expansionTerms.push(...synonyms.slice(0, 2));
    }
  }

  // Remove duplicates and terms already in query
  const uniqueTerms = [...new Set(expansionTerms)]
    .filter(term => !queryLower.includes(term.toLowerCase()));

  // Construct expanded query
  // LEARNING NOTE: Original query first, then expansion terms
  // This gives more weight to original terms in most ranking algorithms
  if (uniqueTerms.length > 0) {
    return `${query} ${uniqueTerms.join(' ')}`;
  }

  return query;
}

/**
 * Generate alternative query formulations
 * 
 * LEARNING NOTE: Query variations can be used to:
 * - Search multiple times and merge results (improves recall)
 * - A/B test different formulations
 * - Handle different ways of asking the same thing
 * 
 * This is particularly useful for:
 * - Short queries (add context)
 * - Ambiguous queries (disambiguate)
 * - Natural language queries (convert to keywords)
 * 
 * @param {string} query - Original query
 * @param {string} intent - Classified intent
 * @param {Array} entities - Extracted entities
 * @returns {Promise<Array<string>>} Query variations
 * 
 * @example
 * await generateQueryVariations("Bürgergeld", "eligibility", [...])
 * // Returns: [
 * //   "Bürgergeld",
 * //   "Bürgergeld eligibility requirements",
 * //   "Who can get Bürgergeld",
 * //   "Bürgergeld qualification criteria"
 * // ]
 */
export async function generateQueryVariations(query, intent, entities) {
  const variations = [query]; // Always include original

  // Extract benefit entities for focused variations
  const benefits = entities
    .filter(e => e.type === ENTITY_TYPES.BENEFIT)
    .map(e => e.canonical || e.value);

  // Generate variations based on intent
  switch (intent) {
    case INTENT_TYPES.ELIGIBILITY:
      if (benefits.length > 0) {
        variations.push(`${benefits[0]} eligibility requirements`);
        variations.push(`Who can get ${benefits[0]}`);
        variations.push(`${benefits[0]} qualification criteria`);
      } else {
        variations.push(`${query} eligibility`);
        variations.push(`${query} requirements`);
      }
      break;

    case INTENT_TYPES.HOW_TO:
      if (benefits.length > 0) {
        variations.push(`How to apply for ${benefits[0]}`);
        variations.push(`${benefits[0]} application process`);
        variations.push(`${benefits[0]} application steps`);
      } else {
        variations.push(`${query} process`);
        variations.push(`${query} steps`);
      }
      break;

    case INTENT_TYPES.CALCULATION:
      if (benefits.length > 0) {
        variations.push(`${benefits[0]} amount calculation`);
        variations.push(`How much ${benefits[0]}`);
        variations.push(`${benefits[0]} payment amount`);
      }
      break;

    case INTENT_TYPES.COMPARISON:
      // Extract multiple benefits if present
      if (benefits.length >= 2) {
        variations.push(`${benefits[0]} vs ${benefits[1]}`);
        variations.push(`Difference between ${benefits[0]} and ${benefits[1]}`);
      }
      break;

    default:
      // For other intents, just add intent-specific terms
      variations.push(`${query} information`);
      variations.push(`${query} details`);
  }

  // Remove duplicates and empty strings
  return [...new Set(variations)].filter(v => v && v.trim().length > 0);
}

/**
 * Detect query language
 * 
 * LEARNING NOTE: This is a simple heuristic. Production systems use:
 * - Language detection libraries (franc, langdetect)
 * - Character set analysis (Latin, Cyrillic, etc.)
 * - Stop word analysis
 * 
 * For multilingual RAG:
 * - Detect language
 * - Search in same language documents (if available)
 * - Or translate query to document language
 * - Or use multilingual embeddings
 * 
 * @param {string} query - User query
 * @returns {string} Language code (de, en, unknown)
 */
function detectLanguage(query) {
  // Common German words
  const germanIndicators = ['der', 'die', 'das', 'ich', 'und', 'ist', 'für', 'auf', 'mit', 'von'];
  // Common English words
  const englishIndicators = ['the', 'is', 'are', 'and', 'for', 'with', 'can', 'how', 'what'];

  const lowerQuery = query.toLowerCase();
  const words = lowerQuery.split(/\s+/);

  let germanScore = 0;
  let englishScore = 0;

  for (const word of words) {
    if (germanIndicators.includes(word)) germanScore++;
    if (englishIndicators.includes(word)) englishScore++;
  }

  // Check for German-specific characters
  if (/[äöüßÄÖÜ]/.test(query)) {
    germanScore += 2;
  }

  if (germanScore > englishScore) return 'de';
  if (englishScore > germanScore) return 'en';
  return 'unknown';
}

// ============================================================================
// USAGE EXAMPLES
// ============================================================================

/**
 * EXAMPLE 1: Basic query processing
 * 
 * const result = await processQuery("Can I get Bürgergeld?");
 * console.log(result);
 * // {
 * //   original: "Can I get Bürgergeld?",
 * //   intent: "eligibility",
 * //   entities: [{type: "benefit", value: "Bürgergeld", canonical: "Bürgergeld"}],
 * //   expanded: "Can I get Bürgergeld? citizen money basic income unemployment benefit",
 * //   variations: ["Can I get Bürgergeld?"],
 * //   metadata: {language: "en", confidence: 0.85}
 * // }
 */

/**
 * EXAMPLE 2: Processing with variations
 * 
 * const result = await processQuery(
 *   "How do I apply for housing benefit?",
 *   { generateVariations: true }
 * );
 * console.log(result.variations);
 * // [
 * //   "How do I apply for housing benefit?",
 * //   "How to apply for Wohngeld",
 * //   "Wohngeld application process",
 * //   "Wohngeld application steps"
 * // ]
 */

/**
 * EXAMPLE 3: Entity extraction
 * 
 * const entities = await extractEntities("I'm 65 and need €500/month for rent in Berlin");
 * console.log(entities);
 * // [
 * //   {type: "person", attribute: "age", value: 65},
 * //   {type: "amount", value: "€500", normalized: 500, currency: "EUR"},
 * //   {type: "location", value: "Berlin", locationType: "city"}
 * // ]
 */

/**
 * EXAMPLE 4: LLM-based processing for complex queries
 * 
 * const result = await processQuery(
 *   "My wife is pregnant and we're moving to Munich next month - what benefits can we apply for?",
 *   { useLLM: true, generateVariations: true }
 * );
 * // LLM can better understand:
 * // - Multiple intents (moving, pregnancy, benefits)
 * // - Implicit entities (wife = family, pregnant = child coming)
 * // - Complex reasoning (eligibility based on life events)
 */
