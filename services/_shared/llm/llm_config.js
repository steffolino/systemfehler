/**
 * Systemfehler - LLM Configuration Module
 * 
 * This module centralizes all LLM-related configuration, loading settings from
 * environment variables and providing sensible defaults.
 * 
 * LEARNING NOTE: Centralized configuration makes your code more maintainable:
 * - Single source of truth for all settings
 * - Easy to change behavior without editing code
 * - Clear documentation of all configurable options
 * - Type-safe access to configuration values
 * 
 * WHY ENVIRONMENT VARIABLES?
 * - Keep secrets out of source code (security)
 * - Different settings for dev/staging/production
 * - Easy to change without redeploying code
 * - Standard practice in 12-factor apps
 * 
 * @see https://12factor.net/config
 * @see ../.env.example for all available options
 */

import { config } from 'dotenv';

// Load environment variables from .env file
// LEARNING NOTE: dotenv reads your .env file and adds variables to process.env
// This lets you use environment variables in development just like in production
config();

/**
 * Helper function to parse boolean environment variables
 * 
 * LEARNING NOTE: Environment variables are always strings, so "true" and "false"
 * need to be converted to actual booleans. This helper handles common formats.
 * 
 * @param {string} value - The environment variable value
 * @param {boolean} defaultValue - Default if not set or invalid
 * @returns {boolean}
 */
function parseBoolean(value, defaultValue) {
  if (value === undefined || value === null || value === '') {
    return defaultValue;
  }
  return value.toLowerCase() === 'true' || value === '1';
}

/**
 * Helper function to parse numeric environment variables with validation
 * 
 * @param {string} value - The environment variable value
 * @param {number} defaultValue - Default if not set or invalid
 * @param {number} min - Minimum allowed value
 * @param {number} max - Maximum allowed value
 * @returns {number}
 */
function parseNumber(value, defaultValue, min = -Infinity, max = Infinity) {
  if (value === undefined || value === null || value === '') {
    return defaultValue;
  }
  const num = parseFloat(value);
  if (isNaN(num)) {
    return defaultValue;
  }
  return Math.max(min, Math.min(max, num));
}

/**
 * LLM Configuration Object
 * 
 * This object provides access to all LLM configuration settings.
 * It reads from environment variables and provides sensible defaults.
 * 
 * ORGANIZATION:
 * - API credentials and endpoints
 * - Model selection
 * - Cost controls and rate limits
 * - Model parameters (temperature, max_tokens, etc.)
 * - Feature flags
 * - Caching and performance
 * - Logging and monitoring
 */
const llmConfig = {
  // =========================================================================
  // API CREDENTIALS
  // =========================================================================
  // 
  // SECURITY: Never hardcode API keys! Always use environment variables.
  // These keys are tied to your billing account.
  //
  openai: {
    apiKey: process.env.OPENAI_API_KEY,
    organization: process.env.OPENAI_ORG_ID, // Optional: for organization accounts
  },

  anthropic: {
    apiKey: process.env.ANTHROPIC_API_KEY,
  },

  // =========================================================================
  // MODEL SELECTION
  // =========================================================================
  //
  // LEARNING NOTE: Different models have different strengths:
  // - Larger models: Better reasoning, higher cost, slower
  // - Smaller models: Faster, cheaper, good for simple tasks
  // - Choose based on your task's complexity and budget
  //
  models: {
    // Default model for general tasks
    default: process.env.DEFAULT_LLM_MODEL || 'gpt-4o-mini',
    
    // Advanced model for complex reasoning
    advanced: process.env.ADVANCED_LLM_MODEL || 'gpt-4o',
    
    // Simple model for high-volume, simple tasks
    simple: process.env.SIMPLE_LLM_MODEL || 'gpt-4o-mini',
    
    // Embedding model for semantic search
    embedding: process.env.EMBEDDING_MODEL || 'text-embedding-3-small',
    
    // Fallback model if primary fails
    fallback: process.env.FALLBACK_MODEL || 'gpt-3.5-turbo',
  },

  // =========================================================================
  // EMBEDDING CONFIGURATION
  // =========================================================================
  //
  // LEARNING NOTE: Embeddings are vector representations of text.
  // The dimension count must match your chosen embedding model:
  // - text-embedding-3-small: 1536 dimensions
  // - text-embedding-3-large: 3072 dimensions
  //
  embeddings: {
    dimensions: parseNumber(process.env.EMBEDDING_DIMENSIONS, 1536, 1, 10000),
    batchSize: 100, // Process this many texts at once for efficiency
    cacheEnabled: parseBoolean(process.env.ENABLE_EMBEDDING_CACHE, true),
    cacheTTL: parseNumber(process.env.EMBEDDING_CACHE_TTL_SECONDS, 86400, 0),
  },

  // =========================================================================
  // COST CONTROLS
  // =========================================================================
  //
  // LEARNING NOTE: LLM APIs charge per token (roughly per word).
  // Set budgets to avoid surprises. During learning, you'll typically
  // spend < $5/month with reasonable usage.
  //
  costs: {
    maxMonthly: parseNumber(process.env.MAX_MONTHLY_COST, 50.0, 0),
    maxDaily: parseNumber(process.env.MAX_DAILY_COST, 10.0, 0),
    alertThreshold: parseNumber(process.env.COST_ALERT_THRESHOLD, 40.0, 0),
    
    // Pricing per 1M tokens (update these as OpenAI changes pricing)
    pricing: {
      'gpt-4o-mini': {
        input: parseNumber(process.env.COST_PER_1M_INPUT_TOKENS_GPT4O_MINI, 0.15, 0),
        output: parseNumber(process.env.COST_PER_1M_OUTPUT_TOKENS_GPT4O_MINI, 0.60, 0),
      },
      'gpt-4o': {
        input: parseNumber(process.env.COST_PER_1M_INPUT_TOKENS_GPT4O, 2.50, 0),
        output: parseNumber(process.env.COST_PER_1M_OUTPUT_TOKENS_GPT4O, 10.00, 0),
      },
      'gpt-3.5-turbo': {
        input: 0.50,
        output: 1.50,
      },
      'text-embedding-3-small': {
        input: 0.02,
        output: 0, // Embeddings don't have output tokens
      },
      'text-embedding-3-large': {
        input: 0.13,
        output: 0,
      },
    },
    
    trackingFile: process.env.COST_TRACKING_FILE || 'data/_quality/llm_costs.jsonl',
  },

  // =========================================================================
  // RATE LIMITING
  // =========================================================================
  //
  // LEARNING NOTE: Rate limits prevent you from:
  // - Exceeding API provider limits (avoid HTTP 429 errors)
  // - Accidentally running up huge bills
  // - Overwhelming downstream systems
  //
  rateLimit: {
    requestsPerMinute: parseNumber(process.env.MAX_REQUESTS_PER_MINUTE, 50, 1, 10000),
    requestsPerDay: parseNumber(process.env.MAX_REQUESTS_PER_DAY, 10000, 1),
    maxConcurrent: parseNumber(process.env.MAX_CONCURRENT_REQUESTS, 5, 1, 100),
  },

  // =========================================================================
  // MODEL PARAMETERS
  // =========================================================================
  //
  // LEARNING NOTE: These parameters control how the LLM generates text.
  // They dramatically affect output quality, creativity, and consistency.
  //
  // TEMPERATURE: The most important parameter to understand
  // - 0.0: Deterministic, always picks most likely token
  // - 0.3: Focused, consistent, good for facts
  // - 0.7: Balanced (good default)
  // - 1.0: Creative, varied
  // - 2.0: Very random, experimental
  //
  // RULE OF THUMB:
  // - Factual tasks (extraction, classification): 0.0-0.3
  // - General tasks: 0.5-0.8
  // - Creative tasks: 0.8-1.2
  //
  parameters: {
    temperature: parseNumber(process.env.DEFAULT_TEMPERATURE, 0.7, 0, 2),
    maxTokens: parseNumber(process.env.DEFAULT_MAX_TOKENS, 1000, 1, 4096),
    topP: parseNumber(process.env.DEFAULT_TOP_P, 1.0, 0, 1),
    presencePenalty: parseNumber(process.env.DEFAULT_PRESENCE_PENALTY, 0.0, -2, 2),
    frequencyPenalty: parseNumber(process.env.DEFAULT_FREQUENCY_PENALTY, 0.0, -2, 2),
  },

  // =========================================================================
  // RETRY AND TIMEOUT CONFIGURATION
  // =========================================================================
  //
  // LEARNING NOTE: Networks are unreliable. APIs have rate limits.
  // Exponential backoff is the standard way to handle transient failures:
  // - Try immediately
  // - Wait 1s, try again
  // - Wait 2s, try again
  // - Wait 4s, try again
  // - Give up
  //
  retry: {
    maxRetries: parseNumber(process.env.MAX_RETRIES, 3, 0, 10),
    initialDelay: parseNumber(process.env.INITIAL_RETRY_DELAY_MS, 1000, 0),
    maxDelay: parseNumber(process.env.MAX_RETRY_DELAY_MS, 10000, 0),
    timeout: parseNumber(process.env.REQUEST_TIMEOUT_MS, 60000, 1000),
  },

  // =========================================================================
  // FEATURE FLAGS
  // =========================================================================
  //
  // LEARNING NOTE: Feature flags let you enable/disable features without
  // changing code. Useful for:
  // - Gradual rollout
  // - A/B testing
  // - Emergency disable
  // - Development vs production differences
  //
  features: {
    embeddings: parseBoolean(process.env.ENABLE_EMBEDDINGS, true),
    semanticSearch: parseBoolean(process.env.ENABLE_SEMANTIC_SEARCH, true),
    rag: parseBoolean(process.env.ENABLE_RAG, true),
    easyGerman: parseBoolean(process.env.ENABLE_EASY_GERMAN_GENERATION, true),
    summarization: parseBoolean(process.env.ENABLE_SUMMARIZATION, true),
    qaSystem: parseBoolean(process.env.ENABLE_QA_SYSTEM, true),
    qualityAssessment: parseBoolean(process.env.ENABLE_QUALITY_ASSESSMENT, true),
    streaming: parseBoolean(process.env.ENABLE_STREAMING, false),
    functionCalling: parseBoolean(process.env.ENABLE_FUNCTION_CALLING, false),
    modelFallback: parseBoolean(process.env.ENABLE_MODEL_FALLBACK, true),
  },

  // =========================================================================
  // CACHING CONFIGURATION
  // =========================================================================
  //
  // LEARNING NOTE: Caching saves money and improves speed:
  // - LLM calls are expensive ($) and slow (seconds)
  // - Same input → same output (mostly, with low temperature)
  // - Cache aggressively during development
  // - Be selective in production based on use case
  //
  // CACHE INVALIDATION: The two hard problems in CS are:
  // 1. Cache invalidation
  // 2. Naming things
  // 3. Off-by-one errors
  //
  cache: {
    enabled: parseBoolean(process.env.ENABLE_RESPONSE_CACHE, true),
    ttl: parseNumber(process.env.CACHE_TTL_SECONDS, 3600, 0),
    maxEntries: parseNumber(process.env.CACHE_MAX_ENTRIES, 1000, 0),
  },

  // =========================================================================
  // VECTOR STORE CONFIGURATION
  // =========================================================================
  //
  // LEARNING NOTE: For learning, we use a simple in-memory vector store
  // with JSON file persistence. It's easy to understand and debug.
  //
  // PRODUCTION: Use specialized vector databases like:
  // - Pinecone: Managed, easy, $70+/month
  // - Weaviate: Open-source, powerful, self-hosted
  // - Qdrant: Fast, Rust-based, good for high-throughput
  // - pgvector: PostgreSQL extension, if you already use Postgres
  //
  vectorStore: {
    path: process.env.VECTOR_STORE_PATH || 'data/_embeddings/vector_store.json',
    maxResults: parseNumber(process.env.MAX_SEARCH_RESULTS, 10, 1, 100),
    minSimilarity: parseNumber(process.env.MIN_SIMILARITY_SCORE, 0.7, 0, 1),
  },

  // =========================================================================
  // RAG (RETRIEVAL-AUGMENTED GENERATION) CONFIGURATION
  // =========================================================================
  //
  // LEARNING NOTE: RAG combines search with generation:
  // 1. Search for relevant documents (retrieval)
  // 2. Add them to LLM prompt (augmentation)
  // 3. Generate answer using retrieved context (generation)
  //
  // WHY RAG?
  // - LLMs have knowledge cutoffs (GPT-4 trained on data up to Apr 2023)
  // - Your data is specialized and current
  // - Reduces hallucinations (making up facts)
  // - Provides source attribution
  //
  rag: {
    topK: parseNumber(process.env.RAG_TOP_K, 5, 1, 20),
    maxContextTokens: parseNumber(process.env.RAG_MAX_CONTEXT_TOKENS, 4000, 100, 100000),
    includeCitations: parseBoolean(process.env.RAG_INCLUDE_CITATIONS, true),
    rerankingStrategy: process.env.RAG_RERANKING_STRATEGY || 'similarity',
  },

  // =========================================================================
  // PROMPT ENGINEERING CONFIGURATION
  // =========================================================================
  //
  // LEARNING NOTE: The system prompt sets the AI's behavior and personality.
  // It's prepended to every conversation. Make it:
  // - Clear and specific
  // - Relevant to your domain
  // - Include important constraints
  //
  prompts: {
    systemPrompt: process.env.SYSTEM_PROMPT || 
      'You are a helpful AI assistant for the Systemfehler platform, which provides information about social services in Germany. Provide accurate, clear, and helpful responses based on the provided context.',
    defaultLanguage: process.env.DEFAULT_LANGUAGE || 'de',
    useFewShot: parseBoolean(process.env.USE_FEW_SHOT_EXAMPLES, true),
    useChainOfThought: parseBoolean(process.env.USE_CHAIN_OF_THOUGHT, true),
  },

  // =========================================================================
  // LOGGING AND MONITORING
  // =========================================================================
  //
  // LEARNING NOTE: Logging is crucial for:
  // - Debugging: What went wrong?
  // - Monitoring: How is it being used?
  // - Optimization: Where are we spending money?
  // - Compliance: What data was processed?
  //
  logging: {
    level: process.env.LLM_LOG_LEVEL || 'info',
    logPrompts: parseBoolean(process.env.LOG_PROMPTS, false),
    logCompletions: parseBoolean(process.env.LOG_COMPLETIONS, false),
    logTokenUsage: parseBoolean(process.env.LOG_TOKEN_USAGE, true),
    logCosts: parseBoolean(process.env.LOG_COSTS, true),
  },

  // =========================================================================
  // DEVELOPMENT AND TESTING
  // =========================================================================
  //
  // LEARNING NOTE: Mock mode lets you test without API calls:
  // - No costs during development
  // - Faster tests
  // - Deterministic results
  // - Works offline
  //
  development: {
    useMock: parseBoolean(process.env.USE_MOCK_LLM, false),
    mockDelay: parseNumber(process.env.MOCK_RESPONSE_DELAY_MS, 500, 0),
    mockSeed: parseNumber(process.env.MOCK_RANDOM_SEED, 42, 0),
  },

  // =========================================================================
  // ADVANCED OPTIONS
  // =========================================================================
  advanced: {
    preferJsonMode: parseBoolean(process.env.PREFER_JSON_MODE, false),
  },
};

/**
 * Validates the configuration and checks for common issues
 * 
 * LEARNING NOTE: Fail fast! Validate configuration at startup rather than
 * discovering problems later when making API calls.
 * 
 * @returns {{ valid: boolean, errors: string[], warnings: string[] }}
 */
export function validateConfig() {
  const errors = [];
  const warnings = [];

  // Check for required API keys
  if (!llmConfig.openai.apiKey && !llmConfig.anthropic.apiKey && !llmConfig.development.useMock) {
    errors.push(
      'No LLM API key found. Please set OPENAI_API_KEY or ANTHROPIC_API_KEY in your .env file. ' +
      'Get keys from: https://platform.openai.com/api-keys or https://console.anthropic.com/'
    );
  }

  // Check API key format
  if (llmConfig.openai.apiKey && !llmConfig.openai.apiKey.startsWith('sk-')) {
    warnings.push('OpenAI API key should start with "sk-". Your key may be invalid.');
  }

  if (llmConfig.anthropic.apiKey && !llmConfig.anthropic.apiKey.startsWith('sk-ant-')) {
    warnings.push('Anthropic API key should start with "sk-ant-". Your key may be invalid.');
  }

  // Check budget configuration
  if (llmConfig.costs.maxDaily > llmConfig.costs.maxMonthly) {
    warnings.push('Daily cost limit exceeds monthly limit. This may not be intentional.');
  }

  // Check temperature range
  if (llmConfig.parameters.temperature > 1.5) {
    warnings.push('Temperature > 1.5 is very high. Outputs will be very random and unpredictable.');
  }

  // Check rate limits
  if (llmConfig.rateLimit.maxConcurrent > llmConfig.rateLimit.requestsPerMinute) {
    warnings.push('Max concurrent requests exceeds per-minute limit. Consider adjusting.');
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Get configuration for a specific model
 * 
 * @param {string} modelName - The model name (e.g., 'gpt-4o', 'gpt-4o-mini')
 * @returns {Object} Model-specific configuration
 */
export function getModelConfig(modelName) {
  // Determine which parameters to use based on model type
  let temperature = llmConfig.parameters.temperature;
  let maxTokens = llmConfig.parameters.maxTokens;

  // For classification/extraction tasks, use lower temperature
  if (modelName.includes('classification') || modelName.includes('extraction')) {
    temperature = 0.1;
  }

  // For embeddings, parameters don't apply
  if (modelName.includes('embedding')) {
    return {
      model: modelName,
      dimensions: llmConfig.embeddings.dimensions,
    };
  }

  return {
    model: modelName,
    temperature,
    max_tokens: maxTokens,
    top_p: llmConfig.parameters.topP,
    presence_penalty: llmConfig.parameters.presencePenalty,
    frequency_penalty: llmConfig.parameters.frequencyPenalty,
  };
}

/**
 * Export the configuration object
 * 
 * USAGE EXAMPLE:
 * ```javascript
 * import { llmConfig } from './llm_config.js';
 * 
 * console.log('Using model:', llmConfig.models.default);
 * console.log('Max monthly cost:', llmConfig.costs.maxMonthly);
 * ```
 */
export { llmConfig };

/**
 * Export configuration as default for convenience
 */
export default llmConfig;
