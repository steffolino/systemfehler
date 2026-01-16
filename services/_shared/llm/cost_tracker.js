/**
 * Systemfehler - Cost Tracker Module
 * 
 * This module tracks LLM API usage and costs in real-time.
 * Essential for monitoring spending and optimizing LLM usage.
 * 
 * WHY TRACK COSTS?
 * ================
 * 1. BUDGET CONTROL: Avoid surprise bills
 * 2. OPTIMIZATION: Identify expensive operations
 * 3. REPORTING: Show ROI and value
 * 4. DEBUGGING: Find runaway processes
 * 5. PLANNING: Forecast future costs
 * 
 * WHAT WE TRACK:
 * ==============
 * - Every API request and response
 * - Token usage (input/output)
 * - Cost per request
 * - Cumulative costs (daily/monthly)
 * - Per-feature breakdown
 * - Model usage statistics
 * 
 * DATA STORAGE:
 * =============
 * Uses JSONL (JSON Lines) format - one JSON object per line.
 * Benefits:
 * - Easy to append new records
 * - Simple to parse and analyze
 * - Human-readable for debugging
 * - Standard format for log data
 * 
 * LEARNING RESOURCES:
 * ===================
 * - JSONL format: http://jsonlines.org/
 * - Cost optimization: https://platform.openai.com/docs/guides/production-best-practices
 * 
 * @see llm_config.js for budget limits configuration
 * @see token_utils.js for cost calculation functions
 */

import { writeFileSync, appendFileSync, readFileSync, existsSync, mkdirSync } from 'fs';
import { dirname } from 'path';
import { calculateCost, formatCost } from './token_utils.js';
import { llmConfig } from './llm_config.js';

/**
 * In-memory cost tracking
 * 
 * LEARNING NOTE: Keep recent data in memory for fast access.
 * Persist to disk for durability. This is a common pattern for logging.
 */
class CostTracker {
  constructor() {
    // Initialize tracking data
    this.reset();
    
    // Ensure cost tracking file exists
    this.ensureFileExists();
  }

  /**
   * Reset tracking data (useful for testing or daily rollover)
   */
  reset() {
    this.daily = {
      date: this.getCurrentDate(),
      totalCost: 0,
      totalInputTokens: 0,
      totalOutputTokens: 0,
      requestCount: 0,
      byModel: {},
      byFeature: {},
    };

    this.monthly = {
      month: this.getCurrentMonth(),
      totalCost: 0,
      totalInputTokens: 0,
      totalOutputTokens: 0,
      requestCount: 0,
      byModel: {},
      byFeature: {},
    };

    this.allTime = {
      totalCost: 0,
      requestCount: 0,
    };
  }

  /**
   * Get current date in YYYY-MM-DD format
   */
  getCurrentDate() {
    return new Date().toISOString().split('T')[0];
  }

  /**
   * Get current month in YYYY-MM format
   */
  getCurrentMonth() {
    return new Date().toISOString().slice(0, 7);
  }

  /**
   * Ensure the cost tracking file and directory exist
   */
  ensureFileExists() {
    const filePath = llmConfig.costs.trackingFile;
    const dir = dirname(filePath);

    // Create directory if it doesn't exist
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    // Create file if it doesn't exist
    if (!existsSync(filePath)) {
      writeFileSync(filePath, '', 'utf-8');
    }
  }

  /**
   * Track a completed API request
   * 
   * LEARNING NOTE: This is called after every successful LLM API call.
   * It records all relevant data for cost analysis and optimization.
   * 
   * @param {Object} request - Request details
   * @param {string} request.requestId - Unique request ID
   * @param {string} request.model - Model name
   * @param {string} request.feature - Feature/use-case name
   * @param {number} request.inputTokens - Input token count
   * @param {number} request.outputTokens - Output token count
   * @param {number} request.cost - Cost in USD
   * @param {number} request.latencyMs - Request latency
   * @param {string} request.status - 'success' or 'error'
   * @param {string} request.error - Error message if failed
   */
  trackRequest(request) {
    const {
      requestId,
      model,
      feature = 'unknown',
      inputTokens = 0,
      outputTokens = 0,
      cost = 0,
      latencyMs = 0,
      status = 'success',
      error = null,
    } = request;

    // Check for daily/monthly rollover
    this.checkRollover();

    // Update daily stats
    this.daily.totalCost += cost;
    this.daily.totalInputTokens += inputTokens;
    this.daily.totalOutputTokens += outputTokens;
    this.daily.requestCount += 1;

    // Update monthly stats
    this.monthly.totalCost += cost;
    this.monthly.totalInputTokens += inputTokens;
    this.monthly.totalOutputTokens += outputTokens;
    this.monthly.requestCount += 1;

    // Update all-time stats
    this.allTime.totalCost += cost;
    this.allTime.requestCount += 1;

    // Update per-model stats (daily)
    if (!this.daily.byModel[model]) {
      this.daily.byModel[model] = {
        cost: 0,
        inputTokens: 0,
        outputTokens: 0,
        requests: 0,
      };
    }
    this.daily.byModel[model].cost += cost;
    this.daily.byModel[model].inputTokens += inputTokens;
    this.daily.byModel[model].outputTokens += outputTokens;
    this.daily.byModel[model].requests += 1;

    // Update per-model stats (monthly)
    if (!this.monthly.byModel[model]) {
      this.monthly.byModel[model] = {
        cost: 0,
        inputTokens: 0,
        outputTokens: 0,
        requests: 0,
      };
    }
    this.monthly.byModel[model].cost += cost;
    this.monthly.byModel[model].inputTokens += inputTokens;
    this.monthly.byModel[model].outputTokens += outputTokens;
    this.monthly.byModel[model].requests += 1;

    // Update per-feature stats (daily)
    if (!this.daily.byFeature[feature]) {
      this.daily.byFeature[feature] = {
        cost: 0,
        inputTokens: 0,
        outputTokens: 0,
        requests: 0,
      };
    }
    this.daily.byFeature[feature].cost += cost;
    this.daily.byFeature[feature].inputTokens += inputTokens;
    this.daily.byFeature[feature].outputTokens += outputTokens;
    this.daily.byFeature[feature].requests += 1;

    // Update per-feature stats (monthly)
    if (!this.monthly.byFeature[feature]) {
      this.monthly.byFeature[feature] = {
        cost: 0,
        inputTokens: 0,
        outputTokens: 0,
        requests: 0,
      };
    }
    this.monthly.byFeature[feature].cost += cost;
    this.monthly.byFeature[feature].inputTokens += inputTokens;
    this.monthly.byFeature[feature].outputTokens += outputTokens;
    this.monthly.byFeature[feature].requests += 1;

    // Persist to file (JSONL format)
    const logEntry = {
      timestamp: new Date().toISOString(),
      requestId,
      model,
      feature,
      inputTokens,
      outputTokens,
      cost,
      latencyMs,
      status,
      error,
    };

    this.appendToFile(logEntry);

    // Check budget limits
    this.checkBudgetLimits();

    // Log if enabled
    if (llmConfig.logging.logCosts) {
      console.log(
        `[CostTracker] ${feature}/${model}: ` +
        `${inputTokens}+${outputTokens} tokens, ` +
        `${formatCost(cost)} ` +
        `(daily: ${formatCost(this.daily.totalCost)}, ` +
        `monthly: ${formatCost(this.monthly.totalCost)})`
      );
    }
  }

  /**
   * Check if we've rolled over to a new day or month
   * 
   * LEARNING NOTE: Reset counters at boundaries to track per-period costs.
   */
  checkRollover() {
    const currentDate = this.getCurrentDate();
    const currentMonth = this.getCurrentMonth();

    // Check daily rollover
    if (this.daily.date !== currentDate) {
      if (llmConfig.logging.level === 'debug') {
        console.log('[CostTracker] Daily rollover detected');
      }
      this.daily = {
        date: currentDate,
        totalCost: 0,
        totalInputTokens: 0,
        totalOutputTokens: 0,
        requestCount: 0,
        byModel: {},
        byFeature: {},
      };
    }

    // Check monthly rollover
    if (this.monthly.month !== currentMonth) {
      if (llmConfig.logging.level === 'debug') {
        console.log('[CostTracker] Monthly rollover detected');
      }
      this.monthly = {
        month: currentMonth,
        totalCost: 0,
        totalInputTokens: 0,
        totalOutputTokens: 0,
        requestCount: 0,
        byModel: {},
        byFeature: {},
      };
    }
  }

  /**
   * Check if we've exceeded budget limits
   * 
   * LEARNING NOTE: Budget limits prevent runaway costs.
   * - Warning: Alert but continue
   * - Error: Stop making requests
   */
  checkBudgetLimits() {
    const { maxDaily, maxMonthly, alertThreshold } = llmConfig.costs;

    // Check daily limit (hard stop)
    if (maxDaily > 0 && this.daily.totalCost > maxDaily) {
      throw new Error(
        `Daily cost limit exceeded! ` +
        `Spent ${formatCost(this.daily.totalCost)} of ${formatCost(maxDaily)} limit. ` +
        `No more requests will be processed today. ` +
        `To continue, increase MAX_DAILY_COST in your .env file.`
      );
    }

    // Check monthly limit (hard stop)
    if (maxMonthly > 0 && this.monthly.totalCost > maxMonthly) {
      throw new Error(
        `Monthly cost limit exceeded! ` +
        `Spent ${formatCost(this.monthly.totalCost)} of ${formatCost(maxMonthly)} limit. ` +
        `No more requests will be processed this month. ` +
        `To continue, increase MAX_MONTHLY_COST in your .env file.`
      );
    }

    // Check alert threshold (warning)
    if (alertThreshold > 0 && this.monthly.totalCost > alertThreshold) {
      // Only warn once when crossing threshold
      if (!this.alertShown && this.monthly.totalCost - this.monthly.byModel[Object.keys(this.monthly.byModel)[0]]?.cost < alertThreshold) {
        console.warn(
          `⚠️  Cost alert: Monthly spending (${formatCost(this.monthly.totalCost)}) ` +
          `has exceeded alert threshold (${formatCost(alertThreshold)}). ` +
          `Limit is ${formatCost(maxMonthly)}.`
        );
        this.alertShown = true;
      }
    }
  }

  /**
   * Append a log entry to the JSONL file
   * 
   * LEARNING NOTE: JSONL is newline-delimited JSON.
   * Each line is a complete, valid JSON object.
   * Benefits: append-only, streaming-friendly, easy to parse.
   */
  appendToFile(entry) {
    try {
      const line = JSON.stringify(entry) + '\n';
      appendFileSync(llmConfig.costs.trackingFile, line, 'utf-8');
    } catch (error) {
      console.error('[CostTracker] Failed to append to cost tracking file:', error);
    }
  }

  /**
   * Get current statistics
   * 
   * @returns {Object} Current cost and usage statistics
   */
  getStats() {
    return {
      daily: { ...this.daily },
      monthly: { ...this.monthly },
      allTime: { ...this.allTime },
      limits: {
        dailyLimit: llmConfig.costs.maxDaily,
        monthlyLimit: llmConfig.costs.maxMonthly,
        alertThreshold: llmConfig.costs.alertThreshold,
      },
    };
  }

  /**
   * Get formatted summary for display
   * 
   * @returns {string} Formatted summary
   */
  getSummary() {
    const stats = this.getStats();
    const lines = [];

    lines.push('=== LLM Cost Summary ===');
    lines.push('');
    lines.push(`Today (${stats.daily.date}):`);
    lines.push(`  Requests: ${stats.daily.requestCount}`);
    lines.push(`  Tokens: ${stats.daily.totalInputTokens.toLocaleString()} in, ${stats.daily.totalOutputTokens.toLocaleString()} out`);
    lines.push(`  Cost: ${formatCost(stats.daily.totalCost)} / ${formatCost(stats.limits.dailyLimit)} limit`);
    lines.push('');
    lines.push(`This Month (${stats.monthly.month}):`);
    lines.push(`  Requests: ${stats.monthly.requestCount}`);
    lines.push(`  Tokens: ${stats.monthly.totalInputTokens.toLocaleString()} in, ${stats.monthly.totalOutputTokens.toLocaleString()} out`);
    lines.push(`  Cost: ${formatCost(stats.monthly.totalCost)} / ${formatCost(stats.limits.monthlyLimit)} limit`);
    lines.push('');
    lines.push('Top Models (this month):');
    const modelEntries = Object.entries(stats.monthly.byModel)
      .sort((a, b) => b[1].cost - a[1].cost)
      .slice(0, 5);
    for (const [model, data] of modelEntries) {
      lines.push(`  ${model}: ${formatCost(data.cost)} (${data.requests} requests)`);
    }
    lines.push('');
    lines.push('Top Features (this month):');
    const featureEntries = Object.entries(stats.monthly.byFeature)
      .sort((a, b) => b[1].cost - a[1].cost)
      .slice(0, 5);
    for (const [feature, data] of featureEntries) {
      lines.push(`  ${feature}: ${formatCost(data.cost)} (${data.requests} requests)`);
    }

    return lines.join('\n');
  }

  /**
   * Load historical data from file
   * 
   * Useful for generating reports or analyzing trends.
   * 
   * @param {Object} options - Filter options
   * @param {string} options.startDate - Start date (YYYY-MM-DD)
   * @param {string} options.endDate - End date (YYYY-MM-DD)
   * @param {string} options.model - Filter by model
   * @param {string} options.feature - Filter by feature
   * @returns {Array} Array of log entries
   */
  loadHistory(options = {}) {
    const filePath = llmConfig.costs.trackingFile;

    if (!existsSync(filePath)) {
      return [];
    }

    try {
      const content = readFileSync(filePath, 'utf-8');
      const lines = content.trim().split('\n').filter(line => line);
      let entries = lines.map(line => JSON.parse(line));

      // Apply filters
      if (options.startDate) {
        entries = entries.filter(e => e.timestamp >= options.startDate);
      }
      if (options.endDate) {
        entries = entries.filter(e => e.timestamp <= options.endDate);
      }
      if (options.model) {
        entries = entries.filter(e => e.model === options.model);
      }
      if (options.feature) {
        entries = entries.filter(e => e.feature === options.feature);
      }

      return entries;
    } catch (error) {
      console.error('[CostTracker] Failed to load history:', error);
      return [];
    }
  }

  /**
   * Generate a detailed report
   * 
   * @param {string} period - 'daily', 'monthly', or 'all'
   * @returns {Object} Detailed report
   */
  generateReport(period = 'monthly') {
    const stats = period === 'daily' ? this.daily : period === 'monthly' ? this.monthly : this.allTime;

    const report = {
      period,
      date: period === 'daily' ? stats.date : period === 'monthly' ? stats.month : 'all-time',
      summary: {
        totalCost: stats.totalCost,
        totalRequests: stats.requestCount,
        totalInputTokens: stats.totalInputTokens,
        totalOutputTokens: stats.totalOutputTokens,
        totalTokens: stats.totalInputTokens + stats.totalOutputTokens,
        avgCostPerRequest: stats.requestCount > 0 ? stats.totalCost / stats.requestCount : 0,
        avgTokensPerRequest: stats.requestCount > 0 ? (stats.totalInputTokens + stats.totalOutputTokens) / stats.requestCount : 0,
      },
      byModel: [],
      byFeature: [],
      recommendations: [],
    };

    // Format model breakdown
    if (stats.byModel) {
      report.byModel = Object.entries(stats.byModel)
        .map(([model, data]) => ({
          model,
          cost: data.cost,
          requests: data.requests,
          inputTokens: data.inputTokens,
          outputTokens: data.outputTokens,
          avgCostPerRequest: data.requests > 0 ? data.cost / data.requests : 0,
        }))
        .sort((a, b) => b.cost - a.cost);
    }

    // Format feature breakdown
    if (stats.byFeature) {
      report.byFeature = Object.entries(stats.byFeature)
        .map(([feature, data]) => ({
          feature,
          cost: data.cost,
          requests: data.requests,
          inputTokens: data.inputTokens,
          outputTokens: data.outputTokens,
          avgCostPerRequest: data.requests > 0 ? data.cost / data.requests : 0,
        }))
        .sort((a, b) => b.cost - a.cost);
    }

    // Generate recommendations
    report.recommendations = this.generateRecommendations(report);

    return report;
  }

  /**
   * Generate cost optimization recommendations
   * 
   * LEARNING NOTE: Analyze usage patterns to suggest improvements.
   * This helps users optimize their LLM spending.
   */
  generateRecommendations(report) {
    const recommendations = [];

    // Check for expensive models
    for (const modelData of report.byModel) {
      if (modelData.model.includes('gpt-4o') && modelData.model !== 'gpt-4o-mini') {
        if (modelData.requests > 10 && modelData.avgCostPerRequest > 0.01) {
          recommendations.push({
            type: 'model-optimization',
            priority: 'high',
            message: `Consider using gpt-4o-mini instead of ${modelData.model} for simpler tasks. ` +
                    `Could save ~80% on ${modelData.requests} requests.`,
            potentialSavings: modelData.cost * 0.8,
          });
        }
      }
    }

    // Check for high token usage
    if (report.summary.avgTokensPerRequest > 10000) {
      recommendations.push({
        type: 'token-optimization',
        priority: 'medium',
        message: `Average ${report.summary.avgTokensPerRequest.toFixed(0)} tokens per request is high. ` +
                `Consider: (1) Shorter prompts, (2) Summarizing context, (3) Reducing max_tokens.`,
      });
    }

    // Check for caching opportunities
    for (const featureData of report.byFeature) {
      if (featureData.requests > 20 && featureData.avgCostPerRequest > 0.001) {
        recommendations.push({
          type: 'caching',
          priority: 'medium',
          message: `Feature "${featureData.feature}" has ${featureData.requests} requests. ` +
                  `Enable caching to avoid reprocessing similar requests.`,
          potentialSavings: featureData.cost * 0.5, // Assume 50% cache hit rate
        });
      }
    }

    return recommendations;
  }
}

// Create singleton instance
const costTracker = new CostTracker();

/**
 * Export singleton instance and class
 * 
 * LEARNING NOTE: Singleton pattern ensures only one cost tracker exists.
 * All parts of the app use the same tracker, maintaining consistent stats.
 */
export { costTracker, CostTracker };

/**
 * Export convenience functions
 */
export const trackRequest = (request) => costTracker.trackRequest(request);
export const getStats = () => costTracker.getStats();
export const getSummary = () => costTracker.getSummary();
export const generateReport = (period) => costTracker.generateReport(period);
export const loadHistory = (options) => costTracker.loadHistory(options);

/**
 * USAGE EXAMPLES:
 * ===============
 * 
 * Track a request (typically called from llm_client):
 * ```javascript
 * import { trackRequest } from './cost_tracker.js';
 * 
 * trackRequest({
 *   requestId: 'req-123',
 *   model: 'gpt-4o-mini',
 *   feature: 'qa-system',
 *   inputTokens: 450,
 *   outputTokens: 120,
 *   cost: 0.000234,
 *   latencyMs: 1250,
 *   status: 'success'
 * });
 * ```
 * 
 * Get current statistics:
 * ```javascript
 * import { getStats } from './cost_tracker.js';
 * 
 * const stats = getStats();
 * console.log(`Today's cost: $${stats.daily.totalCost.toFixed(4)}`);
 * console.log(`Monthly cost: $${stats.monthly.totalCost.toFixed(4)}`);
 * ```
 * 
 * Print summary:
 * ```javascript
 * import { getSummary } from './cost_tracker.js';
 * 
 * console.log(getSummary());
 * ```
 * 
 * Generate detailed report:
 * ```javascript
 * import { generateReport } from './cost_tracker.js';
 * 
 * const report = generateReport('monthly');
 * console.log('Top models:', report.byModel);
 * console.log('Recommendations:', report.recommendations);
 * ```
 */

export default costTracker;
