/**
 * Systemfehler - LLM Client Module
 * 
 * This is the core module for interacting with Large Language Model APIs.
 * It provides a unified interface for making LLM requests with proper error
 * handling, rate limiting, retry logic, cost tracking, and logging.
 * 
 * WHAT IS AN LLM?
 * ===============
 * Large Language Models (LLMs) are AI systems trained on vast amounts of text
 * to understand and generate human-like text. Examples: GPT-4, Claude, Llama.
 * 
 * HOW DO LLM APIs WORK?
 * =====================
 * 1. You send a REQUEST with:
 *    - Messages (conversation history)
 *    - Parameters (temperature, max tokens, etc.)
 *    - Model selection (gpt-4o, gpt-4o-mini, etc.)
 * 
 * 2. The API processes your request:
 *    - Tokenizes your input (splits into tokens)
 *    - Runs the neural network (generates probability distributions)
 *    - Samples tokens based on temperature
 *    - Decodes back to text
 * 
 * 3. You receive a RESPONSE with:
 *    - Generated text (the completion)
 *    - Token usage (input tokens + output tokens)
 *    - Model information
 *    - Finish reason (completed, length limit, etc.)
 * 
 * WHY THIS MODULE?
 * ================
 * Raw API clients are low-level. This module adds:
 * - Rate limiting: Prevent hitting API limits
 * - Retry logic: Handle transient failures automatically
 * - Cost tracking: Monitor spending in real-time
 * - Error handling: Clear, actionable error messages
 * - Logging: Debug and monitor API usage
 * - Streaming: Token-by-token responses for better UX
 * 
 * ARCHITECTURE PATTERN: Facade
 * ============================
 * This module acts as a facade, hiding complexity of:
 * - Multiple providers (OpenAI, Anthropic)
 * - Network issues and retries
 * - Rate limiting and queueing
 * - Cost calculation and tracking
 * - Error normalization
 * 
 * @see https://platform.openai.com/docs/api-reference
 * @see llm_config.js for configuration
 * @see token_utils.js for token counting and cost calculation
 */

import OpenAI from 'openai';
import { llmConfig, validateConfig } from './llm_config.js';
import {
  countTokens,
  countMessageTokens,
  calculateCost,
  estimateCost,
  formatCost,
  truncateToTokenLimit,
  getRemainingTokens,
} from './token_utils.js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

// ============================================================================
// CUSTOM ERROR CLASSES
// ============================================================================
//
// LEARNING NOTE: Custom error classes help you:
// - Distinguish between error types programmatically
// - Add context-specific information
// - Handle different errors differently
// - Provide better error messages for learning
//
// ERROR HIERARCHY:
// - LLMError (base class)
//   - RateLimitError (temporary, retry with backoff)
//   - AuthenticationError (permanent, fix API key)
//   - InvalidRequestError (permanent, fix your request)
//   - ContextLengthError (permanent, reduce input size)
//   - ModelError (temporary, try different model)
//   - NetworkError (temporary, retry)
//

/**
 * Base error class for all LLM-related errors
 */
export class LLMError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = 'LLMError';
    this.details = details;
    this.timestamp = new Date().toISOString();
  }
}

/**
 * Rate limit exceeded error
 * 
 * LEARNING NOTE: APIs have rate limits to prevent abuse and ensure fairness.
 * When you hit a limit, you get a 429 status code. Wait and retry.
 * 
 * OPENAI RATE LIMITS (as of 2024):
 * - Free tier: ~3 requests/minute
 * - Pay-as-you-go: ~60 requests/minute (varies by model)
 * - Tier-based: Up to 10,000 requests/minute for high-volume users
 */
export class RateLimitError extends LLMError {
  constructor(message, retryAfter = null, details = {}) {
    super(message, details);
    this.name = 'RateLimitError';
    this.retryAfter = retryAfter; // Seconds to wait before retrying
    this.isRetryable = true;
  }
}

/**
 * Authentication error (invalid API key)
 * 
 * LEARNING NOTE: This usually means:
 * - API key is missing
 * - API key is invalid or expired
 * - API key doesn't have required permissions
 * 
 * FIX: Check your .env file and verify your API key at:
 * https://platform.openai.com/api-keys
 */
export class AuthenticationError extends LLMError {
  constructor(message, details = {}) {
    super(message, details);
    this.name = 'AuthenticationError';
    this.isRetryable = false;
  }
}

/**
 * Invalid request error (malformed request)
 * 
 * LEARNING NOTE: Common causes:
 * - Invalid parameters (temperature > 2, negative max_tokens)
 * - Unsupported model name
 * - Malformed message format
 * - Missing required fields
 */
export class InvalidRequestError extends LLMError {
  constructor(message, details = {}) {
    super(message, details);
    this.name = 'InvalidRequestError';
    this.isRetryable = false;
  }
}

/**
 * Context length exceeded error
 * 
 * LEARNING NOTE: Your input + expected output exceeds the model's context window.
 * 
 * SOLUTIONS:
 * 1. Reduce input length (summarize, truncate)
 * 2. Use a model with larger context (gpt-4-turbo has 128k tokens)
 * 3. Split into multiple requests
 * 4. Remove unnecessary conversation history
 */
export class ContextLengthError extends LLMError {
  constructor(message, details = {}) {
    super(message, details);
    this.name = 'ContextLengthError';
    this.isRetryable = false;
  }
}

/**
 * Model error (model unavailable or failed)
 */
export class ModelError extends LLMError {
  constructor(message, details = {}) {
    super(message, details);
    this.name = 'ModelError';
    this.isRetryable = true;
  }
}

/**
 * Network error (connection issues)
 */
export class NetworkError extends LLMError {
  constructor(message, details = {}) {
    super(message, details);
    this.name = 'NetworkError';
    this.isRetryable = true;
  }
}

// ============================================================================
// RATE LIMITER
// ============================================================================
//
// LEARNING NOTE: Rate limiting prevents you from overwhelming APIs.
// 
// IMPLEMENTATION: Token Bucket Algorithm
// - You have a "bucket" that holds N tokens
// - Each request consumes 1 token
// - Tokens refill at a fixed rate
// - When bucket is empty, requests must wait
//
// WHY NOT JUST COUNT REQUESTS?
// Token bucket allows "bursts" - you can make several requests quickly
// if you haven't used the API recently, but still prevents sustained
// high rates.
//

class RateLimiter {
  constructor(requestsPerMinute, requestsPerDay, maxConcurrent) {
    // Per-minute limiting
    this.requestsPerMinute = requestsPerMinute;
    this.minuteTokens = requestsPerMinute;
    this.lastMinuteRefill = Date.now();
    
    // Per-day limiting
    this.requestsPerDay = requestsPerDay;
    this.dayTokens = requestsPerDay;
    this.lastDayRefill = Date.now();
    this.dailyRequestCount = 0;
    
    // Concurrent request limiting
    this.maxConcurrent = maxConcurrent;
    this.currentConcurrent = 0;
    this.queue = [];
    
    // Tracking
    this.totalRequests = 0;
  }

  /**
   * Refill tokens based on elapsed time
   * 
   * LEARNING NOTE: This implements the "token bucket" algorithm.
   * Tokens refill at a constant rate, allowing bursts but preventing
   * sustained high rates.
   */
  refillTokens() {
    const now = Date.now();
    
    // Refill per-minute tokens
    const minuteElapsed = (now - this.lastMinuteRefill) / 1000 / 60;
    if (minuteElapsed >= 1) {
      this.minuteTokens = this.requestsPerMinute;
      this.lastMinuteRefill = now;
    }
    
    // Refill per-day tokens
    const dayElapsed = (now - this.lastDayRefill) / 1000 / 60 / 60 / 24;
    if (dayElapsed >= 1) {
      this.dayTokens = this.requestsPerDay;
      this.lastDayRefill = now;
      this.dailyRequestCount = 0;
    }
  }

  /**
   * Wait until a request can be made
   * 
   * LEARNING NOTE: async/await makes this elegant:
   * - If rate limit hit, we wait (sleep) then retry
   * - Caller's code just uses "await" and doesn't know about waiting
   * - This is called "transparent async" - complexity is hidden
   * 
   * @returns {Promise<void>}
   */
  async acquireToken() {
    while (true) {
      this.refillTokens();
      
      // Check all limits
      if (this.minuteTokens > 0 && 
          this.dayTokens > 0 && 
          this.currentConcurrent < this.maxConcurrent) {
        
        // Consume tokens
        this.minuteTokens--;
        this.dayTokens--;
        this.currentConcurrent++;
        this.totalRequests++;
        this.dailyRequestCount++;
        
        return;
      }
      
      // Calculate wait time
      let waitMs = 1000; // Default: 1 second
      
      if (this.minuteTokens <= 0) {
        // Wait until next minute window
        const nextRefill = this.lastMinuteRefill + (60 * 1000);
        waitMs = Math.max(nextRefill - Date.now(), 1000);
      }
      
      if (this.dayTokens <= 0) {
        throw new RateLimitError(
          `Daily rate limit of ${this.requestsPerDay} requests exceeded`,
          86400, // Retry after 24 hours
          { dailyRequestCount: this.dailyRequestCount }
        );
      }
      
      // Wait and try again
      await sleep(waitMs);
    }
  }

  /**
   * Release a token (call when request completes)
   */
  releaseToken() {
    this.currentConcurrent = Math.max(0, this.currentConcurrent - 1);
  }

  /**
   * Get current rate limit status
   * 
   * Useful for monitoring and debugging.
   */
  getStatus() {
    this.refillTokens();
    return {
      minuteTokensAvailable: this.minuteTokens,
      dayTokensAvailable: this.dayTokens,
      currentConcurrent: this.currentConcurrent,
      maxConcurrent: this.maxConcurrent,
      totalRequests: this.totalRequests,
      dailyRequestCount: this.dailyRequestCount,
    };
  }
}

// ============================================================================
// COST TRACKER
// ============================================================================
//
// LEARNING NOTE: Cost tracking helps you:
// - Stay within budget
// - Optimize expensive operations
// - Understand usage patterns
// - Debug unexpected charges
//
// FORMAT: JSONL (JSON Lines)
// Each line is a complete JSON object. Why?
// - Easy to append (no need to parse entire file)
// - Easy to process (stream line by line)
// - No corruption if write fails mid-way
// - Standard format for logs and events
//

class CostTracker {
  constructor(trackingFile) {
    this.trackingFile = trackingFile;
    this.dailyCost = 0;
    this.monthlyCost = 0;
    this.lastUpdate = Date.now();
    this.initialized = false;
  }

  /**
   * Initialize cost tracker by reading existing data
   * 
   * LEARNING NOTE: Lazy initialization pattern:
   * - Don't load data until actually needed
   * - Reduces startup time
   * - Avoids errors if feature isn't used
   */
  async initialize() {
    if (this.initialized) return;

    try {
      // Ensure directory exists
      const dir = path.dirname(this.trackingFile);
      await fs.mkdir(dir, { recursive: true });

      // Try to read existing tracking file
      const content = await fs.readFile(this.trackingFile, 'utf-8');
      const lines = content.trim().split('\n').filter(line => line);
      
      // Calculate current month and day costs
      const now = new Date();
      const currentMonth = now.getMonth();
      const currentYear = now.getFullYear();
      const today = now.toISOString().split('T')[0];
      
      for (const line of lines) {
        const entry = JSON.parse(line);
        const entryDate = new Date(entry.timestamp);
        
        // Sum monthly costs
        if (entryDate.getMonth() === currentMonth && 
            entryDate.getFullYear() === currentYear) {
          this.monthlyCost += entry.cost;
        }
        
        // Sum daily costs
        const entryDay = entry.timestamp.split('T')[0];
        if (entryDay === today) {
          this.dailyCost += entry.cost;
        }
      }
      
      this.initialized = true;
    } catch (error) {
      if (error.code !== 'ENOENT') {
        console.warn('Failed to initialize cost tracker:', error.message);
      }
      // File doesn't exist yet - that's okay
      this.initialized = true;
    }
  }

  /**
   * Track a request's cost
   * 
   * PATTERN: Write-Ahead Logging
   * - Write to disk immediately (append-only)
   * - Update in-memory totals
   * - If crash happens, disk has the truth
   * 
   * @param {Object} data - Request data to track
   */
  async trackRequest(data) {
    await this.initialize();

    const entry = {
      timestamp: new Date().toISOString(),
      model: data.model,
      inputTokens: data.inputTokens,
      outputTokens: data.outputTokens,
      cost: data.cost,
      operation: data.operation,
      success: data.success,
      error: data.error || null,
    };

    // Update in-memory totals
    this.dailyCost += entry.cost;
    this.monthlyCost += entry.cost;

    // Append to file (JSONL format)
    try {
      const line = JSON.stringify(entry) + '\n';
      await fs.appendFile(this.trackingFile, line, 'utf-8');
    } catch (error) {
      console.error('Failed to write cost tracking data:', error.message);
    }

    // Check budget limits
    await this.checkBudget();
  }

  /**
   * Check if budget limits are exceeded
   * 
   * LEARNING NOTE: Fail fast on budget overruns.
   * Better to stop early than get a surprise bill.
   */
  async checkBudget() {
    const { maxDaily, maxMonthly, alertThreshold } = llmConfig.costs;

    if (this.dailyCost > maxDaily) {
      throw new LLMError(
        `Daily cost limit exceeded: ${formatCost(this.dailyCost)} > ${formatCost(maxDaily)}`,
        { dailyCost: this.dailyCost, limit: maxDaily }
      );
    }

    if (this.monthlyCost > maxMonthly) {
      throw new LLMError(
        `Monthly cost limit exceeded: ${formatCost(this.monthlyCost)} > ${formatCost(maxMonthly)}`,
        { monthlyCost: this.monthlyCost, limit: maxMonthly }
      );
    }

    // Warning threshold
    if (this.monthlyCost > alertThreshold && this.monthlyCost <= maxMonthly) {
      console.warn(
        `⚠️  Cost alert: Monthly spending at ${formatCost(this.monthlyCost)} ` +
        `(${((this.monthlyCost / maxMonthly) * 100).toFixed(1)}% of budget)`
      );
    }
  }

  /**
   * Get current cost statistics
   */
  async getStats() {
    await this.initialize();
    
    return {
      daily: formatCost(this.dailyCost),
      monthly: formatCost(this.monthlyCost),
      dailyLimit: formatCost(llmConfig.costs.maxDaily),
      monthlyLimit: formatCost(llmConfig.costs.maxMonthly),
      dailyPercentage: ((this.dailyCost / llmConfig.costs.maxDaily) * 100).toFixed(1),
      monthlyPercentage: ((this.monthlyCost / llmConfig.costs.maxMonthly) * 100).toFixed(1),
    };
  }
}

// ============================================================================
// LLM CLIENT CLASS
// ============================================================================
//
// LEARNING NOTE: Why a class?
// - Encapsulation: Keep state (clients, rate limiter, etc.) together
// - Single Responsibility: One class for LLM interactions
// - Testability: Easy to mock in tests
// - Lifecycle: Initialize once, use many times
//

export class LLMClient {
  constructor(config = llmConfig) {
    this.config = config;
    
    // Validate configuration
    const validation = validateConfig();
    if (!validation.valid) {
      throw new LLMError(
        'Invalid LLM configuration:\n' + validation.errors.join('\n'),
        { errors: validation.errors }
      );
    }
    
    // Show warnings
    if (validation.warnings.length > 0) {
      validation.warnings.forEach(warning => {
        console.warn('⚠️  Configuration warning:', warning);
      });
    }

    // Initialize API clients
    this.openaiClient = null;
    this.anthropicClient = null;
    
    if (config.openai.apiKey && !config.development.useMock) {
      this.openaiClient = new OpenAI({
        apiKey: config.openai.apiKey,
        organization: config.openai.organization,
        timeout: config.retry.timeout,
        maxRetries: 0, // We handle retries ourselves for better control
      });
    }
    
    // Note: Anthropic client would be initialized here
    // if (config.anthropic.apiKey && !config.development.useMock) {
    //   this.anthropicClient = new Anthropic({ apiKey: config.anthropic.apiKey });
    // }

    // Initialize rate limiter
    this.rateLimiter = new RateLimiter(
      config.rateLimit.requestsPerMinute,
      config.rateLimit.requestsPerDay,
      config.rateLimit.maxConcurrent
    );

    // Initialize cost tracker
    this.costTracker = new CostTracker(config.costs.trackingFile);

    // Request counter for logging
    this.requestId = 0;
  }

  /**
   * Generate a unique request ID
   * 
   * LEARNING NOTE: Request IDs help correlate logs across systems.
   * Format: timestamp + counter for uniqueness and sortability.
   */
  generateRequestId() {
    this.requestId++;
    return `req_${Date.now()}_${this.requestId}`;
  }

  /**
   * Log a message with consistent formatting
   * 
   * LEARNING NOTE: Structured logging > string concatenation
   * - Easy to parse
   * - Easy to search
   * - Easy to aggregate
   * - JSON format is standard
   * 
   * PRODUCTION: Use a proper logging library like Winston or Pino
   * 
   * @param {string} level - Log level (info, warn, error, debug)
   * @param {string} message - Log message
   * @param {Object} data - Additional structured data
   */
  log(level, message, data = {}) {
    const logLevels = { debug: 0, info: 1, warn: 2, error: 3 };
    const configuredLevel = logLevels[this.config.logging.level] || 1;
    
    if (logLevels[level] < configuredLevel) {
      return; // Skip logs below configured level
    }

    const logEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      ...data,
    };

    // In production, send to logging service (CloudWatch, Datadog, etc.)
    console[level === 'error' ? 'error' : 'log'](
      `[LLM] [${level.toUpperCase()}] ${message}`,
      Object.keys(data).length > 0 ? data : ''
    );
  }

  /**
   * Retry a function with exponential backoff
   * 
   * LEARNING NOTE: Exponential Backoff Algorithm
   * ============================================
   * 
   * When requests fail, don't retry immediately:
   * - You'll overwhelm an already-stressed system
   * - You'll waste rate limit tokens
   * - You might trigger additional rate limits
   * 
   * INSTEAD: Wait progressively longer between retries:
   * 
   * Attempt 1: Immediate
   * Attempt 2: Wait 1 second
   * Attempt 3: Wait 2 seconds  
   * Attempt 4: Wait 4 seconds
   * Attempt 5: Wait 8 seconds (or max delay)
   * 
   * JITTER: Add randomness to prevent "thundering herd"
   * - Multiple clients retrying at exact same time
   * - Random jitter spreads out the load
   * 
   * FORMULA: min(maxDelay, initialDelay * 2^attempt) * (1 + random jitter)
   * 
   * @param {Function} fn - Async function to retry
   * @param {number} maxRetries - Maximum retry attempts
   * @returns {Promise<*>} Result from successful attempt
   */
  async retryWithBackoff(fn, maxRetries = this.config.retry.maxRetries) {
    let lastError;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error;

        // Don't retry non-retryable errors
        if (error.isRetryable === false) {
          throw error;
        }

        // Don't retry on last attempt
        if (attempt === maxRetries) {
          break;
        }

        // Calculate delay with exponential backoff and jitter
        const baseDelay = this.config.retry.initialDelay * Math.pow(2, attempt);
        const maxDelay = this.config.retry.maxDelay;
        const jitter = Math.random() * 0.3; // 0-30% jitter
        const delay = Math.min(baseDelay * (1 + jitter), maxDelay);

        this.log('warn', `Request failed, retrying in ${(delay / 1000).toFixed(1)}s`, {
          attempt: attempt + 1,
          maxRetries,
          error: error.message,
          delay,
        });

        await sleep(delay);
      }
    }

    // All retries exhausted
    throw new LLMError(
      `Request failed after ${maxRetries + 1} attempts: ${lastError.message}`,
      { originalError: lastError, attempts: maxRetries + 1 }
    );
  }

  /**
   * Normalize API errors to our custom error types
   * 
   * LEARNING NOTE: Different APIs return errors in different formats.
   * This function translates them all to a consistent format.
   * 
   * OPENAI ERROR CODES:
   * - 401: Authentication error (invalid API key)
   * - 429: Rate limit exceeded
   * - 400: Invalid request
   * - 500: OpenAI server error
   * - 503: Service temporarily unavailable
   * 
   * @param {Error} error - Original error from API
   * @returns {LLMError} Normalized error
   */
  normalizeError(error) {
    // OpenAI SDK errors
    if (error.status) {
      const status = error.status;
      const message = error.message || 'Unknown error';
      const details = { originalError: error.message, status };

      switch (status) {
        case 401:
          return new AuthenticationError(
            'Invalid API key. Check your OPENAI_API_KEY in .env file.\n' +
            'Get your API key from: https://platform.openai.com/api-keys',
            details
          );

        case 429:
          // Extract retry-after header if available
          const retryAfter = error.headers?.['retry-after'] 
            ? parseInt(error.headers['retry-after']) 
            : 60;
          
          return new RateLimitError(
            'Rate limit exceeded. You\'re making requests too quickly.\n' +
            'SOLUTIONS:\n' +
            '1. Wait and retry (automatic with backoff)\n' +
            '2. Increase rate limits in config\n' +
            '3. Upgrade your OpenAI plan',
            retryAfter,
            details
          );

        case 400:
          // Check if it's a context length error
          if (message.includes('context_length_exceeded') || 
              message.includes('maximum context length')) {
            return new ContextLengthError(
              'Input is too long for the model\'s context window.\n' +
              'SOLUTIONS:\n' +
              '1. Reduce input length (use truncateToTokenLimit)\n' +
              '2. Use a model with larger context (gpt-4-turbo: 128k tokens)\n' +
              '3. Split into multiple requests\n' +
              '4. Summarize input first',
              details
            );
          }
          
          return new InvalidRequestError(
            `Invalid request: ${message}\n` +
            'CHECK:\n' +
            '- Message format is correct\n' +
            '- Parameters are within valid ranges\n' +
            '- Model name is spelled correctly',
            details
          );

        case 500:
        case 503:
          return new ModelError(
            'OpenAI service error. This is usually temporary.\n' +
            'Will retry automatically.',
            details
          );

        default:
          return new LLMError(message, details);
      }
    }

    // Network errors
    if (error.code === 'ECONNREFUSED' || 
        error.code === 'ENOTFOUND' ||
        error.code === 'ETIMEDOUT') {
      return new NetworkError(
        `Network error: ${error.message}\n` +
        'CHECK:\n' +
        '- Internet connection is working\n' +
        '- No firewall blocking OpenAI API\n' +
        '- OpenAI service status: https://status.openai.com',
        { originalError: error.message, code: error.code }
      );
    }

    // Unknown error - wrap it
    return new LLMError(
      `Unexpected error: ${error.message}`,
      { originalError: error.message }
    );
  }

  /**
   * Create a text completion
   * 
   * LEARNING NOTE: Text completions are the simplest LLM interaction.
   * You provide a prompt, the model continues it.
   * 
   * USE CASES:
   * - Text generation (stories, articles)
   * - Code completion
   * - Text transformation (rewriting, expanding)
   * 
   * WHEN TO USE:
   * - Simple, single-turn interactions
   * - No conversation context needed
   * - Legacy code (newer code should use chat completions)
   * 
   * NOTE: OpenAI has deprecated text completions in favor of chat completions.
   * This method wraps the chat API to maintain compatibility.
   * 
   * @param {string} prompt - The text prompt
   * @param {Object} options - Generation options
   * @returns {Promise<Object>} Completion result
   */
  async createCompletion(prompt, options = {}) {
    const requestId = this.generateRequestId();
    
    this.log('info', 'Creating text completion', {
      requestId,
      promptLength: prompt.length,
      model: options.model || this.config.models.default,
    });

    // Convert to chat format (text completions are deprecated)
    const messages = [
      { role: 'user', content: prompt }
    ];

    return await this.createChatCompletion(messages, {
      ...options,
      _isTextCompletion: true, // Internal flag
      _requestId: requestId,
    });
  }

  /**
   * Create a chat completion
   * 
   * LEARNING NOTE: Chat Completions - The Modern LLM Interface
   * ==========================================================
   * 
   * Chat completions use a conversation format with roles:
   * 
   * ROLES:
   * ------
   * - system: Instructions for the AI (sets behavior/personality)
   * - user: Messages from the user
   * - assistant: Previous responses from the AI
   * 
   * EXAMPLE CONVERSATION:
   * ```javascript
   * [
   *   { 
   *     role: 'system', 
   *     content: 'You are a helpful German tutor.' 
   *   },
   *   { 
   *     role: 'user', 
   *     content: 'How do I say "hello" in German?' 
   *   },
   *   { 
   *     role: 'assistant', 
   *     content: 'In German, "hello" is "Hallo" or "Guten Tag".' 
   *   },
   *   { 
   *     role: 'user', 
   *     content: 'What about "goodbye"?' 
   *   }
   * ]
   * ```
   * 
   * WHY CHAT FORMAT?
   * ----------------
   * - Maintains conversation context
   * - Separates instructions (system) from conversation (user/assistant)
   * - Models trained specifically for this format
   * - Supports multi-turn dialogues naturally
   * 
   * SYSTEM PROMPT:
   * --------------
   * The system message is crucial. It:
   * - Sets the AI's personality and expertise
   * - Defines constraints and rules
   * - Specifies output format
   * - Provides domain context
   * 
   * GOOD SYSTEM PROMPTS:
   * "You are an expert Python developer. Provide concise, runnable code."
   * "You are a German language tutor. Use B1-level German in explanations."
   * 
   * BAD SYSTEM PROMPTS:
   * "Be helpful." (too vague)
   * "You are GPT-4." (already knows that)
   * 
   * @param {Array<{role: string, content: string}>} messages - Conversation messages
   * @param {Object} options - Generation options
   * @returns {Promise<Object>} Chat completion result
   */
  async createChatCompletion(messages, options = {}) {
    const requestId = options._requestId || this.generateRequestId();
    const isTextCompletion = options._isTextCompletion || false;
    
    // Merge with defaults
    const model = options.model || this.config.models.default;
    const temperature = options.temperature ?? this.config.parameters.temperature;
    const maxTokens = options.max_tokens || this.config.parameters.maxTokens;
    
    // Count input tokens
    const inputTokens = countMessageTokens(messages, model);
    
    // Log request details
    this.log('info', 'Creating chat completion', {
      requestId,
      model,
      temperature,
      maxTokens,
      inputTokens,
      messageCount: messages.length,
    });

    // Check token limits
    const remaining = getRemainingTokens(inputTokens + maxTokens, model);
    if (!remaining.canFit) {
      throw new ContextLengthError(
        `Input (${inputTokens} tokens) + expected output (${maxTokens} tokens) ` +
        `exceeds model limit (${remaining.total} tokens).\n` +
        `Exceeded by: ${Math.abs(remaining.remaining)} tokens`,
        { inputTokens, maxTokens, limit: remaining.total }
      );
    }

    if (this.config.logging.logPrompts) {
      this.log('debug', 'Request messages', { requestId, messages });
    }

    // Estimate cost before making request
    const estimatedCost = estimateCost(messages, maxTokens, model);
    this.log('debug', 'Estimated cost', { 
      requestId, 
      cost: formatCost(estimatedCost) 
    });

    // Acquire rate limit token
    await this.rateLimiter.acquireToken();
    
    const startTime = Date.now();
    let response;
    let outputTokens = 0;
    let actualCost = 0;

    try {
      // Make the API call with retry logic
      response = await this.retryWithBackoff(async () => {
        if (this.config.development.useMock) {
          // Mock response for testing/development
          return this.createMockResponse(messages, options);
        }

        if (!this.openaiClient) {
          throw new AuthenticationError(
            'OpenAI client not initialized. Check your API key configuration.'
          );
        }

        // Call OpenAI API
        // LEARNING NOTE: This is where the magic happens!
        // - Request is sent over HTTPS to OpenAI's servers
        // - Their GPUs process your prompt through the neural network
        // - Response streams back with generated text
        return await this.openaiClient.chat.completions.create({
          model,
          messages,
          temperature,
          max_tokens: maxTokens,
          top_p: options.top_p ?? this.config.parameters.topP,
          presence_penalty: options.presence_penalty ?? this.config.parameters.presencePenalty,
          frequency_penalty: options.frequency_penalty ?? this.config.parameters.frequencyPenalty,
          n: options.n || 1, // Number of completions to generate
          stop: options.stop, // Stop sequences
          user: options.user, // User ID for tracking
        });
      });

      const duration = Date.now() - startTime;

      // Extract response data
      const choice = response.choices[0];
      const content = choice.message.content;
      const finishReason = choice.finish_reason;

      // Get actual token usage
      outputTokens = response.usage.completion_tokens;
      const totalTokens = response.usage.total_tokens;

      // Calculate actual cost
      actualCost = calculateCost({
        inputTokens: response.usage.prompt_tokens,
        outputTokens,
      }, model);

      // Log successful completion
      this.log('info', 'Chat completion successful', {
        requestId,
        model,
        duration: `${duration}ms`,
        inputTokens,
        outputTokens,
        totalTokens,
        cost: formatCost(actualCost),
        finishReason,
      });

      if (this.config.logging.logCompletions) {
        this.log('debug', 'Response content', { requestId, content });
      }

      // Track cost
      await this.costTracker.trackRequest({
        model,
        inputTokens,
        outputTokens,
        cost: actualCost,
        operation: isTextCompletion ? 'completion' : 'chat',
        success: true,
      });

      // Return structured response
      return {
        content,
        finishReason,
        usage: {
          inputTokens,
          outputTokens,
          totalTokens,
        },
        cost: actualCost,
        model,
        requestId,
        duration,
      };

    } catch (error) {
      const duration = Date.now() - startTime;
      const normalizedError = this.normalizeError(error);

      // Log error
      this.log('error', 'Chat completion failed', {
        requestId,
        model,
        duration: `${duration}ms`,
        error: normalizedError.message,
        errorType: normalizedError.name,
      });

      // Track failed request
      await this.costTracker.trackRequest({
        model,
        inputTokens,
        outputTokens: 0,
        cost: 0,
        operation: isTextCompletion ? 'completion' : 'chat',
        success: false,
        error: normalizedError.message,
      });

      throw normalizedError;
    } finally {
      // Always release rate limit token
      this.rateLimiter.releaseToken();
    }
  }

  /**
   * Create a streaming chat completion
   * 
   * LEARNING NOTE: Streaming Responses - Better User Experience
   * ===========================================================
   * 
   * WHAT IS STREAMING?
   * ------------------
   * Instead of waiting for the entire response, tokens are sent as they're
   * generated. Like watching text being typed out in real-time.
   * 
   * NON-STREAMING:
   * User waits → ... → ... → ... → Full response appears
   * (Can take 10-30 seconds for long responses)
   * 
   * STREAMING:
   * User waits → Token → Token → Token → Token → ...
   * (Feels immediate, responsive)
   * 
   * WHY STREAM?
   * -----------
   * - Better UX: Users see progress immediately
   * - Perceived speed: Feels faster even if total time is same
   * - Early exit: Can stop generation early if response is wrong
   * - Engagement: Users stay engaged watching the response form
   * 
   * WHEN NOT TO STREAM:
   * -------------------
   * - Batch processing (no user watching)
   * - Need complete response for processing (JSON parsing, etc.)
   * - Logging/archiving (easier with complete responses)
   * 
   * TECHNICAL: Server-Sent Events (SSE)
   * ------------------------------------
   * Streaming uses SSE protocol:
   * - Server keeps connection open
   * - Sends data chunks as events
   * - Client processes each chunk
   * - Connection closes when done
   * 
   * IMPLEMENTATION PATTERN: Async Iterators
   * ----------------------------------------
   * Modern JavaScript uses async iterators for streams:
   * 
   * ```javascript
   * const stream = await llm.createStreamingCompletion(...);
   * for await (const chunk of stream) {
   *   process.stdout.write(chunk.content);
   * }
   * ```
   * 
   * @param {Array<{role: string, content: string}>} messages - Conversation messages
   * @param {Object} options - Generation options
   * @returns {AsyncIterator} Stream of response chunks
   */
  async createStreamingCompletion(messages, options = {}) {
    const requestId = this.generateRequestId();
    
    // Check if streaming is enabled
    if (!this.config.features.streaming) {
      throw new LLMError(
        'Streaming is not enabled. Set ENABLE_STREAMING=true in your .env file.',
        { feature: 'streaming' }
      );
    }

    const model = options.model || this.config.models.default;
    const temperature = options.temperature ?? this.config.parameters.temperature;
    const maxTokens = options.max_tokens || this.config.parameters.maxTokens;
    
    const inputTokens = countMessageTokens(messages, model);
    
    this.log('info', 'Creating streaming completion', {
      requestId,
      model,
      temperature,
      maxTokens,
      inputTokens,
    });

    // Acquire rate limit token
    await this.rateLimiter.acquireToken();
    
    const startTime = Date.now();
    let outputTokens = 0;
    let fullContent = '';

    try {
      // Create streaming request
      const stream = await this.retryWithBackoff(async () => {
        if (this.config.development.useMock) {
          return this.createMockStream(messages, options);
        }

        if (!this.openaiClient) {
          throw new AuthenticationError(
            'OpenAI client not initialized. Check your API key configuration.'
          );
        }

        return await this.openaiClient.chat.completions.create({
          model,
          messages,
          temperature,
          max_tokens: maxTokens,
          top_p: options.top_p ?? this.config.parameters.topP,
          presence_penalty: options.presence_penalty ?? this.config.parameters.presencePenalty,
          frequency_penalty: options.frequency_penalty ?? this.config.parameters.frequencyPenalty,
          stream: true, // Enable streaming
        });
      });

      // Return async iterator that processes the stream
      // LEARNING NOTE: This is a generator function (notice the async function*)
      // It yields values one at a time, perfect for streaming data
      const self = this;
      return (async function* () {
        try {
          for await (const chunk of stream) {
            const delta = chunk.choices[0]?.delta;
            const finishReason = chunk.choices[0]?.finish_reason;

            if (delta?.content) {
              const content = delta.content;
              fullContent += content;
              outputTokens++; // Approximate - we'll get exact count at end

              // Yield chunk to caller
              yield {
                content,
                finishReason: null,
                isComplete: false,
                requestId,
              };
            }

            // Stream is complete
            if (finishReason) {
              const duration = Date.now() - startTime;
              
              // Get more accurate token count
              outputTokens = countTokens(fullContent, model);
              
              const actualCost = calculateCost({
                inputTokens,
                outputTokens,
              }, model);

              self.log('info', 'Streaming completion finished', {
                requestId,
                model,
                duration: `${duration}ms`,
                inputTokens,
                outputTokens,
                cost: formatCost(actualCost),
                finishReason,
              });

              // Track cost
              await self.costTracker.trackRequest({
                model,
                inputTokens,
                outputTokens,
                cost: actualCost,
                operation: 'chat_stream',
                success: true,
              });

              // Yield final chunk with complete info
              yield {
                content: '',
                finishReason,
                isComplete: true,
                fullContent,
                usage: {
                  inputTokens,
                  outputTokens,
                  totalTokens: inputTokens + outputTokens,
                },
                cost: actualCost,
                model,
                requestId,
                duration,
              };
            }
          }
        } catch (error) {
          const normalizedError = self.normalizeError(error);
          
          self.log('error', 'Streaming completion failed', {
            requestId,
            error: normalizedError.message,
          });

          await self.costTracker.trackRequest({
            model,
            inputTokens,
            outputTokens,
            cost: 0,
            operation: 'chat_stream',
            success: false,
            error: normalizedError.message,
          });

          throw normalizedError;
        } finally {
          self.rateLimiter.releaseToken();
        }
      })();

    } catch (error) {
      this.rateLimiter.releaseToken();
      throw this.normalizeError(error);
    }
  }

  /**
   * Create a mock response for testing
   * 
   * LEARNING NOTE: Mocking - Essential for Development
   * ===================================================
   * 
   * WHY MOCK?
   * ---------
   * - No API costs during development
   * - Faster iteration (no network latency)
   * - Works offline
   * - Deterministic testing
   * - Test edge cases (errors, rate limits, etc.)
   * 
   * WHEN TO USE REAL API:
   * ---------------------
   * - Integration testing
   * - Quality validation
   * - Before deployment
   * - Benchmarking performance
   * 
   * @private
   */
  createMockResponse(messages, options) {
    const model = options.model || this.config.models.default;
    const lastMessage = messages[messages.length - 1];
    
    // Simple mock: echo back with a prefix
    const mockContent = `[MOCK RESPONSE for ${model}] ` +
      `You said: "${lastMessage.content.substring(0, 50)}..."`;

    // Simulate delay
    const mockDelay = this.config.development.mockDelay;
    
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({
          choices: [
            {
              message: {
                role: 'assistant',
                content: mockContent,
              },
              finish_reason: 'stop',
            },
          ],
          usage: {
            prompt_tokens: countMessageTokens(messages, model),
            completion_tokens: countTokens(mockContent, model),
            total_tokens: countMessageTokens(messages, model) + countTokens(mockContent, model),
          },
        });
      }, mockDelay);
    });
  }

  /**
   * Create a mock stream for testing
   * @private
   */
  async* createMockStream(messages, options) {
    const model = options.model || this.config.models.default;
    const lastMessage = messages[messages.length - 1];
    
    const mockContent = `[MOCK STREAM for ${model}] You said: "${lastMessage.content}"`;
    const words = mockContent.split(' ');

    // Stream word by word
    for (let i = 0; i < words.length; i++) {
      await sleep(50); // Simulate streaming delay
      
      yield {
        choices: [
          {
            delta: {
              content: words[i] + (i < words.length - 1 ? ' ' : ''),
            },
            finish_reason: null,
          },
        ],
      };
    }

    // Final chunk
    yield {
      choices: [
        {
          delta: {},
          finish_reason: 'stop',
        },
      ],
    };
  }

  /**
   * Get client status and statistics
   * 
   * Useful for monitoring, debugging, and dashboards.
   */
  async getStatus() {
    const rateLimitStatus = this.rateLimiter.getStatus();
    const costStats = await this.costTracker.getStats();

    return {
      configured: {
        openai: !!this.openaiClient,
        anthropic: !!this.anthropicClient,
        mockMode: this.config.development.useMock,
      },
      rateLimit: rateLimitStatus,
      costs: costStats,
      models: {
        default: this.config.models.default,
        advanced: this.config.models.advanced,
        simple: this.config.models.simple,
      },
    };
  }
}

// ============================================================================
// CONVENIENCE FUNCTIONS
// ============================================================================
//
// LEARNING NOTE: Singleton Pattern
// ================================
// 
// We create one global client instance and export convenience functions.
// This is simpler for users: they just import and call functions.
// 
// ALTERNATIVE: Users could create their own instances
// ```javascript
// const client = new LLMClient();
// await client.createChatCompletion(...);
// ```
// 
// But this convenience API is cleaner:
// ```javascript
// import { createChatCompletion } from './llm_client.js';
// await createChatCompletion(...);
// ```
//

let defaultClient = null;

/**
 * Get or create the default LLM client instance
 */
function getDefaultClient() {
  if (!defaultClient) {
    defaultClient = new LLMClient();
  }
  return defaultClient;
}

/**
 * Create a text completion (convenience function)
 * 
 * @param {string} prompt - The text prompt
 * @param {Object} options - Generation options
 * @returns {Promise<Object>} Completion result
 */
export async function createCompletion(prompt, options = {}) {
  return getDefaultClient().createCompletion(prompt, options);
}

/**
 * Create a chat completion (convenience function)
 * 
 * @param {Array<{role: string, content: string}>} messages - Conversation messages
 * @param {Object} options - Generation options
 * @returns {Promise<Object>} Chat completion result
 */
export async function createChatCompletion(messages, options = {}) {
  return getDefaultClient().createChatCompletion(messages, options);
}

/**
 * Create a streaming chat completion (convenience function)
 * 
 * @param {Array<{role: string, content: string}>} messages - Conversation messages
 * @param {Object} options - Generation options
 * @returns {AsyncIterator} Stream of response chunks
 */
export async function createStreamingCompletion(messages, options = {}) {
  return getDefaultClient().createStreamingCompletion(messages, options);
}

/**
 * Get client status (convenience function)
 */
export async function getStatus() {
  return getDefaultClient().getStatus();
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Sleep for a specified duration
 * 
 * LEARNING NOTE: Promises and setTimeout
 * ======================================
 * 
 * JavaScript's setTimeout is callback-based (old style):
 * ```javascript
 * setTimeout(() => { console.log('done'); }, 1000);
 * ```
 * 
 * This wrapper makes it Promise-based (modern style):
 * ```javascript
 * await sleep(1000);
 * console.log('done');
 * ```
 * 
 * The async/await syntax is cleaner and easier to reason about.
 * 
 * @param {number} ms - Milliseconds to sleep
 * @returns {Promise<void>}
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ============================================================================
// USAGE EXAMPLES
// ============================================================================
//
// LEARNING NOTE: These examples show real-world usage patterns.
// Copy and adapt them for your own use cases.
//

/**
 * EXAMPLE 1: Simple Question Answering
 * =====================================
 * 
 * ```javascript
 * import { createChatCompletion } from './llm_client.js';
 * 
 * const messages = [
 *   { 
 *     role: 'system', 
 *     content: 'You are a helpful assistant for German social services.' 
 *   },
 *   { 
 *     role: 'user', 
 *     content: 'What documents do I need to apply for Bürgergeld?' 
 *   }
 * ];
 * 
 * const response = await createChatCompletion(messages);
 * console.log(response.content);
 * console.log(`Cost: ${formatCost(response.cost)}`);
 * ```
 */

/**
 * EXAMPLE 2: Multi-turn Conversation
 * ===================================
 * 
 * ```javascript
 * import { createChatCompletion } from './llm_client.js';
 * 
 * const conversation = [
 *   { role: 'system', content: 'You are a German language tutor.' }
 * ];
 * 
 * // Turn 1
 * conversation.push({ 
 *   role: 'user', 
 *   content: 'How do I say "thank you" in German?' 
 * });
 * 
 * let response = await createChatCompletion(conversation);
 * conversation.push({ 
 *   role: 'assistant', 
 *   content: response.content 
 * });
 * 
 * // Turn 2 - context is maintained
 * conversation.push({ 
 *   role: 'user', 
 *   content: 'What about the informal version?' 
 * });
 * 
 * response = await createChatCompletion(conversation);
 * console.log(response.content);
 * ```
 */

/**
 * EXAMPLE 3: Streaming Response
 * ==============================
 * 
 * ```javascript
 * import { createStreamingCompletion } from './llm_client.js';
 * 
 * const messages = [
 *   { role: 'system', content: 'You are a creative writer.' },
 *   { role: 'user', content: 'Write a short story about a robot.' }
 * ];
 * 
 * const stream = await createStreamingCompletion(messages);
 * 
 * let fullResponse = '';
 * for await (const chunk of stream) {
 *   if (chunk.content) {
 *     process.stdout.write(chunk.content); // Show in real-time
 *     fullResponse += chunk.content;
 *   }
 *   
 *   if (chunk.isComplete) {
 *     console.log('\n\nGeneration complete!');
 *     console.log(`Tokens: ${chunk.usage.outputTokens}`);
 *     console.log(`Cost: ${formatCost(chunk.cost)}`);
 *   }
 * }
 * ```
 */

/**
 * EXAMPLE 4: Error Handling
 * ==========================
 * 
 * ```javascript
 * import { 
 *   createChatCompletion, 
 *   AuthenticationError,
 *   RateLimitError,
 *   ContextLengthError 
 * } from './llm_client.js';
 * 
 * try {
 *   const response = await createChatCompletion(messages);
 *   console.log(response.content);
 * } catch (error) {
 *   if (error instanceof AuthenticationError) {
 *     console.error('Fix your API key!');
 *   } else if (error instanceof RateLimitError) {
 *     console.error(`Rate limited. Wait ${error.retryAfter} seconds.`);
 *   } else if (error instanceof ContextLengthError) {
 *     console.error('Input too long. Truncate it.');
 *   } else {
 *     console.error('Unknown error:', error.message);
 *   }
 * }
 * ```
 */

/**
 * EXAMPLE 5: Cost Estimation Before Calling
 * ==========================================
 * 
 * ```javascript
 * import { estimateCost, formatCost } from './token_utils.js';
 * import { createChatCompletion } from './llm_client.js';
 * 
 * const messages = [...]; // Your messages
 * 
 * // Estimate cost before calling
 * const estimate = estimateCost(messages, 500, 'gpt-4o');
 * console.log(`This will cost approximately ${formatCost(estimate)}`);
 * 
 * if (estimate > 0.10) {
 *   console.warn('Expensive operation! Consider using gpt-4o-mini instead.');
 * }
 * 
 * const response = await createChatCompletion(messages);
 * console.log(`Actual cost: ${formatCost(response.cost)}`);
 * ```
 */

/**
 * EXAMPLE 6: Monitoring Status
 * =============================
 * 
 * ```javascript
 * import { getStatus } from './llm_client.js';
 * 
 * const status = await getStatus();
 * 
 * console.log('LLM Client Status:');
 * console.log('- OpenAI configured:', status.configured.openai);
 * console.log('- Mock mode:', status.configured.mockMode);
 * console.log('- Rate limit:', status.rateLimit.minuteTokensAvailable, 'requests available');
 * console.log('- Daily cost:', status.costs.daily);
 * console.log('- Monthly cost:', status.costs.monthly);
 * console.log('- Default model:', status.models.default);
 * ```
 */

// ============================================================================
// BEST PRACTICES & OPTIMIZATION TIPS
// ============================================================================
//
// LEARNING NOTE: Professional LLM Usage
// ======================================
//
// 1. CHOOSE THE RIGHT MODEL
//    - gpt-4o-mini: Simple tasks, high volume (10x cheaper)
//    - gpt-4o: Complex reasoning, critical tasks
//    - Rule: Start with mini, upgrade only if quality insufficient
//
// 2. OPTIMIZE PROMPTS FOR TOKENS
//    - Shorter prompts = lower cost
//    - But: Too short = poor quality
//    - Find the sweet spot through testing
//
// 3. USE SYSTEM PROMPTS WISELY
//    - Put instructions in system message (not user message)
//    - Keep system prompt consistent across conversation
//    - Don't repeat instructions in every message
//
// 4. IMPLEMENT CACHING
//    - Cache identical requests (especially in development)
//    - Use content hashing to identify duplicates
//    - Saves money and improves speed
//
// 5. HANDLE ERRORS GRACEFULLY
//    - Always catch and handle errors
//    - Provide helpful messages to users
//    - Log errors for debugging
//    - Implement fallbacks (different model, cached response, etc.)
//
// 6. MONITOR COSTS
//    - Set budget alerts
//    - Track costs by feature/user
//    - Analyze expensive operations
//    - Optimize high-cost use cases
//
// 7. RATE LIMITING
//    - Implement rate limits even if API doesn't enforce them
//    - Protect against bugs causing infinite loops
//    - Prevent unexpected bills
//
// 8. LOGGING AND MONITORING
//    - Log all requests for debugging
//    - Monitor response times
//    - Track error rates
//    - Analyze usage patterns
//
// 9. TESTING
//    - Use mock mode during development
//    - Test with real API before deployment
//    - Validate error handling
//    - Benchmark performance
//
// 10. SECURITY
//     - Never commit API keys to git
//     - Use environment variables
//     - Rotate keys periodically
//     - Implement usage quotas per user
//
// ============================================================================

/**
 * ADDITIONAL RESOURCES
 * ====================
 * 
 * OpenAI Documentation:
 * - API Reference: https://platform.openai.com/docs/api-reference
 * - Best Practices: https://platform.openai.com/docs/guides/production-best-practices
 * - Prompt Engineering: https://platform.openai.com/docs/guides/prompt-engineering
 * - Rate Limits: https://platform.openai.com/docs/guides/rate-limits
 * 
 * Understanding LLMs:
 * - Token Counting: https://platform.openai.com/tokenizer
 * - Model Comparison: https://platform.openai.com/docs/models
 * - Pricing: https://openai.com/pricing
 * 
 * This Project:
 * - Configuration: ./llm_config.js
 * - Token Utils: ./token_utils.js
 * - Project README: ../../README.md
 */
