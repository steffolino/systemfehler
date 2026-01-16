/**
 * Systemfehler - Token Utilities Module
 * 
 * This module provides utilities for counting tokens and calculating costs.
 * Understanding tokens is crucial for working with LLMs.
 * 
 * WHAT ARE TOKENS?
 * ================
 * Tokens are the basic units that LLMs process. They're roughly:
 * - 1 token ≈ 4 characters in English
 * - 1 token ≈ ¾ of a word on average
 * - "Hello world" = 2 tokens
 * - "Künstliche Intelligenz" = 4-5 tokens (more for non-English)
 * 
 * WHY TOKENS MATTER:
 * ==================
 * 1. COST: You pay per token (both input and output)
 * 2. LIMITS: Models have maximum token limits (context windows)
 * 3. SPEED: More tokens = slower response
 * 4. QUALITY: Staying within limits is important
 * 
 * CONTEXT WINDOWS (as of 2024):
 * =============================
 * - GPT-4o: 128k tokens input, 4k tokens output
 * - GPT-4o-mini: 128k tokens input, 16k tokens output
 * - GPT-3.5-turbo: 16k tokens input, 4k tokens output
 * 
 * Input context includes:
 * - System prompt
 * - Conversation history
 * - Retrieved documents (for RAG)
 * - User's question
 * 
 * LEARNING RESOURCES:
 * ===================
 * - OpenAI Tokenizer: https://platform.openai.com/tokenizer
 * - Tiktoken library: https://github.com/openai/tiktoken
 * 
 * @see llm_config.js for cost pricing configuration
 */

import { encoding_for_model, get_encoding } from 'tiktoken';
import { llmConfig } from './llm_config.js';

/**
 * Token encoder cache
 * 
 * LEARNING NOTE: Creating encoders is expensive (loads large data files).
 * Cache them to avoid recreating on every call.
 * 
 * PATTERN: Lazy initialization - create only when needed, then reuse.
 */
const encoderCache = new Map();

/**
 * Get or create a token encoder for a specific model
 * 
 * LEARNING NOTE: Different models use different tokenization schemes:
 * - GPT-4, GPT-3.5: "cl100k_base" encoding
 * - GPT-2, earlier models: "gpt2" encoding
 * 
 * The encoding scheme affects how text is split into tokens.
 * 
 * @param {string} modelName - The model name (e.g., 'gpt-4o', 'gpt-3.5-turbo')
 * @returns {Encoder} A tiktoken encoder instance
 */
function getEncoder(modelName) {
  // Check cache first
  if (encoderCache.has(modelName)) {
    return encoderCache.get(modelName);
  }

  let encoder;
  
  try {
    // Try to get encoding for specific model
    encoder = encoding_for_model(modelName);
  } catch (error) {
    // Fallback to cl100k_base (used by GPT-4 and GPT-3.5-turbo)
    // LEARNING NOTE: When in doubt, cl100k_base is a safe default for modern models
    console.warn(`Could not get encoding for model ${modelName}, falling back to cl100k_base`);
    encoder = get_encoding('cl100k_base');
  }

  // Cache for reuse
  encoderCache.set(modelName, encoder);
  
  return encoder;
}

/**
 * Count the number of tokens in a text string
 * 
 * This is the core function for token counting. Use it to:
 * - Check if your prompt fits within model limits
 * - Estimate costs before making API calls
 * - Optimize prompts by identifying token-heavy sections
 * - Truncate text to fit within limits
 * 
 * USAGE EXAMPLES:
 * ```javascript
 * const count = countTokens('Hello, world!', 'gpt-4o');
 * console.log(count); // 4
 * 
 * const longText = 'A very long document...';
 * if (countTokens(longText) > 4000) {
 *   console.warn('Text too long!');
 * }
 * ```
 * 
 * @param {string} text - The text to count tokens for
 * @param {string} modelName - The model name (default: from config)
 * @returns {number} The number of tokens
 */
export function countTokens(text, modelName = llmConfig.models.default) {
  if (!text || typeof text !== 'string') {
    return 0;
  }

  try {
    const encoder = getEncoder(modelName);
    const tokens = encoder.encode(text);
    return tokens.length;
  } catch (error) {
    // Fallback: rough approximation if tiktoken fails
    // LEARNING NOTE: 1 token ≈ 4 characters is a rough rule of thumb
    // This is less accurate but better than nothing
    console.warn('Token counting failed, using approximation:', error.message);
    return Math.ceil(text.length / 4);
  }
}

/**
 * Count tokens in a message array (for chat completions)
 * 
 * Chat models use a message format:
 * [
 *   { role: 'system', content: 'You are a helpful assistant' },
 *   { role: 'user', content: 'Hello!' },
 *   { role: 'assistant', content: 'Hi there!' }
 * ]
 * 
 * Each message has overhead tokens for formatting.
 * 
 * LEARNING NOTE: The exact token count includes:
 * - The content of each message
 * - Role indicators (system/user/assistant)
 * - Formatting tokens (varies by model)
 * 
 * @param {Array<{role: string, content: string}>} messages - Array of chat messages
 * @param {string} modelName - The model name
 * @returns {number} Total token count
 */
export function countMessageTokens(messages, modelName = llmConfig.models.default) {
  if (!Array.isArray(messages) || messages.length === 0) {
    return 0;
  }

  try {
    const encoder = getEncoder(modelName);
    
    // Base tokens for message formatting
    // LEARNING NOTE: Different models have different overhead
    // GPT-3.5-turbo and GPT-4: approximately 3 tokens per message
    let totalTokens = 3; // Every message follows <|start|>{role/name}\n{content}<|end|>\n
    
    for (const message of messages) {
      // Count role/name tokens
      totalTokens += 1; // role
      
      // Count content tokens
      if (message.content) {
        const contentTokens = encoder.encode(message.content);
        totalTokens += contentTokens.length;
      }
      
      // Additional tokens per message
      totalTokens += 3; // formatting overhead
    }
    
    // Add final tokens for assistant response priming
    totalTokens += 3;
    
    return totalTokens;
  } catch (error) {
    console.warn('Message token counting failed, using approximation:', error.message);
    
    // Fallback approximation
    const totalText = messages
      .map(m => (m.content || '') + m.role)
      .join(' ');
    return Math.ceil(totalText.length / 4) + (messages.length * 4);
  }
}

/**
 * Calculate the cost of a request based on token usage
 * 
 * LEARNING NOTE: LLM APIs typically charge separately for:
 * - Input tokens (your prompt and context)
 * - Output tokens (the model's response)
 * 
 * Output tokens are usually more expensive because:
 * - Generation is computationally intensive
 * - It takes longer (multiple forward passes)
 * 
 * EXAMPLE COSTS (GPT-4o-mini):
 * - 1,000 input tokens: $0.00015
 * - 1,000 output tokens: $0.0006
 * 
 * @param {Object} usage - Token usage object
 * @param {number} usage.inputTokens - Number of input tokens
 * @param {number} usage.outputTokens - Number of output tokens
 * @param {string} modelName - The model name
 * @returns {number} Cost in USD
 */
export function calculateCost(usage, modelName = llmConfig.models.default) {
  const { inputTokens = 0, outputTokens = 0 } = usage;
  
  // Get pricing for this model
  const pricing = llmConfig.costs.pricing[modelName];
  
  if (!pricing) {
    console.warn(`No pricing information for model ${modelName}, cost calculation unavailable`);
    return 0;
  }
  
  // Calculate cost per million tokens, convert to actual cost
  // LEARNING NOTE: Pricing is per 1M tokens, so divide by 1,000,000
  const inputCost = (inputTokens / 1_000_000) * pricing.input;
  const outputCost = (outputTokens / 1_000_000) * pricing.output;
  const totalCost = inputCost + outputCost;
  
  return totalCost;
}

/**
 * Estimate cost before making an API call
 * 
 * Useful for:
 * - Budget checks before expensive operations
 * - User warnings when operations are costly
 * - Cost optimization (try different prompt strategies)
 * 
 * USAGE EXAMPLE:
 * ```javascript
 * const estimate = estimateCost(myPrompt, 500, 'gpt-4o');
 * if (estimate > 0.10) {
 *   console.warn(`This will cost approximately $${estimate.toFixed(4)}`);
 *   // Ask user for confirmation
 * }
 * ```
 * 
 * @param {string|Array} input - Text string or message array
 * @param {number} estimatedOutputTokens - Expected output length
 * @param {string} modelName - The model name
 * @returns {number} Estimated cost in USD
 */
export function estimateCost(input, estimatedOutputTokens = 500, modelName = llmConfig.models.default) {
  // Count input tokens
  let inputTokens;
  if (typeof input === 'string') {
    inputTokens = countTokens(input, modelName);
  } else if (Array.isArray(input)) {
    inputTokens = countMessageTokens(input, modelName);
  } else {
    console.warn('Invalid input type for cost estimation');
    return 0;
  }
  
  // Calculate estimated cost
  return calculateCost({
    inputTokens,
    outputTokens: estimatedOutputTokens,
  }, modelName);
}

/**
 * Format a cost value for display
 * 
 * LEARNING NOTE: LLM costs are typically very small (fractions of a cent).
 * Format appropriately to avoid confusion.
 * 
 * @param {number} cost - Cost in USD
 * @param {boolean} includeSymbol - Whether to include $ symbol
 * @returns {string} Formatted cost string
 */
export function formatCost(cost, includeSymbol = true) {
  const symbol = includeSymbol ? '$' : '';
  
  if (cost === 0) {
    return `${symbol}0.00`;
  }
  
  // For very small costs, show more decimal places
  if (cost < 0.01) {
    return `${symbol}${cost.toFixed(4)}`;
  }
  
  return `${symbol}${cost.toFixed(2)}`;
}

/**
 * Truncate text to fit within a token limit
 * 
 * Useful when you need to ensure text fits within model limits.
 * 
 * STRATEGIES:
 * 1. 'end' - Keep the start, truncate the end (default)
 * 2. 'start' - Truncate the start, keep the end
 * 3. 'middle' - Keep start and end, truncate middle
 * 
 * LEARNING NOTE: Choose strategy based on your use case:
 * - 'end': Good for documents where intro matters most
 * - 'start': Good for logs where recent events matter
 * - 'middle': Good when both beginning and end are important
 * 
 * @param {string} text - Text to truncate
 * @param {number} maxTokens - Maximum tokens allowed
 * @param {string} strategy - Truncation strategy
 * @param {string} modelName - The model name
 * @returns {string} Truncated text
 */
export function truncateToTokenLimit(
  text,
  maxTokens,
  strategy = 'end',
  modelName = llmConfig.models.default
) {
  const currentTokens = countTokens(text, modelName);
  
  // No truncation needed
  if (currentTokens <= maxTokens) {
    return text;
  }
  
  const encoder = getEncoder(modelName);
  const tokens = encoder.encode(text);
  
  let truncatedTokens;
  
  switch (strategy) {
    case 'start':
      // Keep the end
      truncatedTokens = tokens.slice(-maxTokens);
      break;
      
    case 'middle':
      // Keep start and end
      const keepPerSide = Math.floor(maxTokens / 2);
      const startTokens = tokens.slice(0, keepPerSide);
      const endTokens = tokens.slice(-keepPerSide);
      truncatedTokens = [...startTokens, ...endTokens];
      break;
      
    case 'end':
    default:
      // Keep the start (default)
      truncatedTokens = tokens.slice(0, maxTokens);
  }
  
  // Decode back to text
  const truncatedText = encoder.decode(truncatedTokens);
  
  return truncatedText;
}

/**
 * Calculate remaining tokens available in context window
 * 
 * Helps you determine how much space you have left for:
 * - Adding more context
 * - Generating longer responses
 * - Including examples
 * 
 * @param {number} usedTokens - Tokens already used
 * @param {string} modelName - The model name
 * @returns {Object} Available tokens info
 */
export function getRemainingTokens(usedTokens, modelName = llmConfig.models.default) {
  // Context window sizes for different models
  // LEARNING NOTE: These limits change as OpenAI releases new models
  // Always check official documentation for current limits
  const contextWindows = {
    'gpt-4o': 128000,
    'gpt-4o-mini': 128000,
    'gpt-4-turbo': 128000,
    'gpt-4': 8192,
    'gpt-3.5-turbo': 16385,
  };
  
  const maxContextTokens = contextWindows[modelName] || 4096;
  const remainingTokens = maxContextTokens - usedTokens;
  const percentageUsed = (usedTokens / maxContextTokens) * 100;
  
  return {
    remaining: remainingTokens,
    total: maxContextTokens,
    used: usedTokens,
    percentageUsed: percentageUsed.toFixed(1),
    canFit: remainingTokens > 0,
  };
}

/**
 * Get statistics about text in terms of tokens
 * 
 * Provides comprehensive token analysis for optimization.
 * 
 * @param {string} text - Text to analyze
 * @param {string} modelName - The model name
 * @returns {Object} Token statistics
 */
export function getTokenStats(text, modelName = llmConfig.models.default) {
  const tokenCount = countTokens(text, modelName);
  const charCount = text.length;
  const wordCount = text.split(/\s+/).length;
  
  // Calculate ratios
  const tokensPerWord = wordCount > 0 ? tokenCount / wordCount : 0;
  const charsPerToken = tokenCount > 0 ? charCount / tokenCount : 0;
  
  // Estimate costs
  const inputCost = calculateCost({ inputTokens: tokenCount, outputTokens: 0 }, modelName);
  const outputCost = calculateCost({ inputTokens: 0, outputTokens: tokenCount }, modelName);
  
  return {
    tokens: tokenCount,
    characters: charCount,
    words: wordCount,
    tokensPerWord: tokensPerWord.toFixed(2),
    charsPerToken: charsPerToken.toFixed(2),
    costIfInput: formatCost(inputCost),
    costIfOutput: formatCost(outputCost),
  };
}

/**
 * Clean up encoder resources
 * 
 * LEARNING NOTE: Encoders hold references to large data structures.
 * Call this when shutting down to free memory properly.
 */
export function cleanup() {
  for (const encoder of encoderCache.values()) {
    encoder.free();
  }
  encoderCache.clear();
}

/**
 * USAGE EXAMPLES:
 * ===============
 * 
 * Basic token counting:
 * ```javascript
 * import { countTokens } from './token_utils.js';
 * 
 * const text = 'Hello, world!';
 * const tokens = countTokens(text);
 * console.log(`"${text}" has ${tokens} tokens`);
 * ```
 * 
 * Cost estimation:
 * ```javascript
 * import { estimateCost, formatCost } from './token_utils.js';
 * 
 * const prompt = 'Explain quantum computing in simple terms';
 * const cost = estimateCost(prompt, 500, 'gpt-4o');
 * console.log(`This will cost approximately ${formatCost(cost)}`);
 * ```
 * 
 * Truncation:
 * ```javascript
 * import { truncateToTokenLimit } from './token_utils.js';
 * 
 * const longDocument = '...'; // Very long text
 * const truncated = truncateToTokenLimit(longDocument, 1000);
 * console.log('Truncated to fit 1000 tokens');
 * ```
 * 
 * Token statistics:
 * ```javascript
 * import { getTokenStats } from './token_utils.js';
 * 
 * const stats = getTokenStats('Your text here');
 * console.log('Token analysis:', stats);
 * // {
 * //   tokens: 3,
 * //   characters: 14,
 * //   words: 3,
 * //   tokensPerWord: '1.00',
 * //   charsPerToken: '4.67',
 * //   costIfInput: '$0.0000',
 * //   costIfOutput: '$0.0000'
 * // }
 * ```
 */
