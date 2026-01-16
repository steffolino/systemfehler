/**
 * Systemfehler - Prompt Engineering Module
 * 
 * This module provides prompt templates and utilities for crafting effective
 * prompts for different LLM tasks.
 * 
 * WHAT IS PROMPT ENGINEERING?
 * ============================
 * Prompt engineering is the practice of designing inputs (prompts) that guide
 * LLMs to produce desired outputs. It's like giving clear instructions to a
 * very capable but literal assistant.
 * 
 * KEY PRINCIPLES:
 * ===============
 * 1. CLARITY: Be specific and unambiguous
 * 2. CONTEXT: Provide relevant background information
 * 3. EXAMPLES: Show what you want (few-shot learning)
 * 4. STRUCTURE: Use consistent formatting
 * 5. CONSTRAINTS: Specify what you don't want
 * 
 * PROMPT COMPONENTS:
 * ==================
 * - System Message: Sets overall behavior and context
 * - User Message: The actual request or question
 * - Examples: Demonstrates desired input/output pairs (few-shot)
 * - Context: Relevant information for answering (RAG)
 * 
 * LEARNING RESOURCES:
 * ===================
 * - OpenAI Prompt Engineering Guide: https://platform.openai.com/docs/guides/prompt-engineering
 * - Anthropic Prompt Library: https://docs.anthropic.com/claude/prompt-library
 * 
 * @see llm_client.js for using these prompts with the LLM
 * @see llm_config.js for default system prompt configuration
 */

import { llmConfig } from './llm_config.js';

/**
 * Base system prompt for Systemfehler
 * 
 * LEARNING NOTE: The system prompt is prepended to every conversation.
 * It establishes:
 * - The AI's role and expertise
 * - Domain context
 * - Behavioral guidelines
 * - Output format expectations
 */
export const SYSTEM_PROMPTS = {
  /**
   * Default system prompt for general queries
   */
  default: `You are a helpful AI assistant for Systemfehler, a platform providing information about social services in Germany.

Your role is to:
- Provide accurate, clear, and helpful information about social benefits and services
- Answer questions based on the provided context
- Cite your sources when making claims
- Admit when you don't know something rather than guessing
- Use appropriate language for the user's context (formal when needed, simple when appropriate)

Guidelines:
- Focus on factual information
- Be empathetic to users who may be in difficult situations
- Explain bureaucratic processes clearly
- Highlight important deadlines and requirements
- Provide actionable next steps when possible`,

  /**
   * System prompt for Easy German translation
   * 
   * LEARNING NOTE: Specialized prompts work better than generic ones.
   * This prompt includes specific requirements for accessibility.
   */
  easyGerman: `You are an expert at translating German text into Easy German (Leichte Sprache).

Easy German (Leichte Sprache) is a simplified form of German designed for accessibility:
- Short sentences (max 15 words)
- One idea per sentence
- Active voice instead of passive
- Common, everyday words
- No jargon, foreign words, or abbreviations (unless explained)
- Concrete examples instead of abstract concepts
- Clear structure with paragraphs and bullet points

Your task is to translate standard German text into Easy German while:
- Preserving all important information
- Maintaining accuracy of facts (amounts, dates, deadlines)
- Making complex processes understandable
- Being respectful (not condescending)

Follow these rules:
1. Break long sentences into shorter ones
2. Replace technical terms with simple explanations
3. Use present tense when possible
4. Explain abbreviations on first use
5. Add helpful examples for complex concepts`,

  /**
   * System prompt for summarization
   */
  summarizer: `You are an expert at creating clear, accurate summaries of social services information.

Your summaries should:
- Capture the most important information
- Preserve critical details (amounts, deadlines, eligibility)
- Use clear, concise language
- Maintain factual accuracy
- Be appropriate for the target audience

Focus on:
- What the benefit/service is
- Who is eligible
- How to apply
- Important deadlines
- Key amounts or conditions`,

  /**
   * System prompt for question answering
   */
  qa: `You are a knowledgeable assistant helping people understand social services in Germany.

When answering questions:
1. Base your answer ONLY on the provided context
2. If the context doesn't contain the answer, say so clearly
3. Cite the specific sources you use
4. Provide step-by-step guidance when appropriate
5. Highlight important requirements and deadlines
6. Suggest where to find more information

Always be:
- Accurate (never guess or assume)
- Clear (avoid bureaucratic jargon)
- Helpful (provide actionable information)
- Empathetic (users may be in difficult situations)`,

  /**
   * System prompt for quality assessment
   */
  qualityAssessor: `You are an expert evaluator assessing the quality and completeness of social services data entries.

Evaluate entries based on:
1. Completeness - Are all important fields filled?
2. Accuracy - Is the information factually correct?
3. Clarity - Is it written clearly and understandably?
4. Currentness - Does it appear up-to-date?
5. Consistency - Are different language versions consistent?

Provide:
- A score for each dimension (0-100)
- Specific issues found
- Recommendations for improvement
- An overall quality assessment

Be thorough but fair in your evaluation.`,
};

/**
 * Prompt Templates for Different Tasks
 * 
 * LEARNING NOTE: Templates make prompts consistent and reusable.
 * Variables ({{variable}}) are replaced with actual values.
 */
export const PROMPT_TEMPLATES = {
  /**
   * Easy German translation template
   * 
   * USAGE:
   * const prompt = buildPrompt(PROMPT_TEMPLATES.translateEasyGerman, {
   *   text: 'Komplizierter Gesetzestext...',
   *   targetAudience: 'Menschen mit Lernschwierigkeiten'
   * });
   */
  translateEasyGerman: {
    template: `Translate the following German text into Easy German (Leichte Sprache).

Target audience: {{targetAudience}}

Original text:
{{text}}

Translation instructions:
- Use short, simple sentences
- Explain technical terms
- Preserve all important facts and numbers
- Make it easy to understand but not patronizing

Easy German translation:`,
    variables: ['text', 'targetAudience'],
  },

  /**
   * Summarization template
   */
  summarize: {
    template: `Create a {{length}} summary of the following social service information.

{{#if audience}}
Target audience: {{audience}}
{{/if}}

Information to summarize:
Title: {{title}}
{{#if description}}
Description: {{description}}
{{/if}}
{{#if eligibility}}
Eligibility: {{eligibility}}
{{/if}}
{{#if amount}}
Amount: {{amount}}
{{/if}}
{{#if deadline}}
Deadline: {{deadline}}
{{/if}}

{{#if focusOn}}
Focus especially on: {{focusOn}}
{{/if}}

Summary:`,
    variables: ['length', 'title'],
    optional: ['audience', 'description', 'eligibility', 'amount', 'deadline', 'focusOn'],
  },

  /**
   * Question answering with RAG template
   * 
   * LEARNING NOTE: This is a classic RAG prompt structure:
   * 1. Instruction
   * 2. Context (retrieved documents)
   * 3. Question
   * 4. Answer format specification
   */
  answerQuestion: {
    template: `Answer the following question about social services in Germany based ONLY on the provided context.

Context:
{{context}}

Question: {{question}}

Instructions:
- Base your answer only on the information above
- If the context doesn't contain enough information, say so
- Cite the specific sources you use
- Provide clear, actionable information
- Highlight important requirements and deadlines

{{#if language}}
Answer in {{language}}.
{{/if}}

Answer:`,
    variables: ['context', 'question'],
    optional: ['language'],
  },

  /**
   * Comparison template
   */
  compare: {
    template: `Compare the following two social services/benefits:

Service A:
{{serviceA}}

Service B:
{{serviceB}}

Please compare them based on:
- Eligibility requirements
- Benefits/amounts provided
- Application process
- Duration/deadlines
- Advantages and disadvantages of each

Provide a clear comparison that helps someone decide which is more suitable for their situation.

Comparison:`,
    variables: ['serviceA', 'serviceB'],
  },

  /**
   * Quality assessment template
   */
  assessQuality: {
    template: `Assess the quality of the following social service data entry.

Entry Data:
{{entryData}}

Evaluate based on:
1. Completeness (0-100): Are all important fields filled?
2. Clarity (0-100): Is it written clearly?
3. Accuracy (0-100): Does it seem factually correct?
4. Currentness (0-100): Does it appear up-to-date?
5. Consistency (0-100): Are translations consistent?

For each dimension, provide:
- A score (0-100)
- Specific issues found (if any)
- Recommendations for improvement

Response format (JSON):
{
  "scores": {
    "completeness": <score>,
    "clarity": <score>,
    "accuracy": <score>,
    "currentness": <score>,
    "consistency": <score>
  },
  "issues": [
    "Issue description..."
  ],
  "recommendations": [
    "Recommendation description..."
  ],
  "overallQuality": <average score>
}

Assessment:`,
    variables: ['entryData'],
  },

  /**
   * Eligibility check template
   */
  checkEligibility: {
    template: `Based on the following user situation and benefit requirements, assess eligibility.

User Situation:
{{userSituation}}

Benefit Requirements:
{{requirements}}

Please provide:
1. Likely eligibility (Yes/Probably/Uncertain/Probably Not/No)
2. Reasoning for the assessment
3. What additional information is needed (if uncertain)
4. Next steps if eligible

Assessment:`,
    variables: ['userSituation', 'requirements'],
  },

  /**
   * Extract structured data template
   * 
   * LEARNING NOTE: JSON mode helps ensure structured output.
   * Specify the exact schema you want.
   */
  extractStructured: {
    template: `Extract structured information from the following text about a social service.

Text:
{{text}}

Extract the following fields (use null if not found):
{
  "title": "Service/benefit name",
  "description": "Brief description",
  "eligibility": "Who can apply",
  "amount": "Financial amount or value",
  "duration": "How long it lasts",
  "deadline": "Application deadline",
  "provider": "Which organization provides it",
  "applicationProcess": "How to apply",
  "requiredDocuments": ["doc1", "doc2"],
  "categories": ["category1", "category2"]
}

Extracted data (JSON):`,
    variables: ['text'],
  },
};

/**
 * Few-shot examples for different tasks
 * 
 * LEARNING NOTE: Few-shot learning means showing examples of desired behavior.
 * LLMs learn patterns from examples and apply them to new inputs.
 * 
 * WHEN TO USE FEW-SHOT:
 * - Complex or nuanced tasks
 * - Specific output formats
 * - Consistent style/tone
 * - Domain-specific knowledge
 * 
 * HOW MANY EXAMPLES?
 * - Zero-shot: No examples (just instructions)
 * - One-shot: 1 example
 * - Few-shot: 2-5 examples (more isn't always better)
 */
export const FEW_SHOT_EXAMPLES = {
  /**
   * Examples for Easy German translation
   */
  easyGerman: [
    {
      input: 'Leistungsberechtigte können einen Antrag auf Bewilligung von Bürgergeld gemäß § 19 Abs. 1 SGB II bei dem zuständigen Jobcenter stellen.',
      output: 'Sie können Bürgergeld beantragen.\nGehen Sie zu Ihrem Jobcenter.\nDas Jobcenter hilft Ihnen beim Antrag.',
      explanation: 'Break long bureaucratic sentence into short, simple steps',
    },
    {
      input: 'Die Regelbedarfsstufe 1 beträgt seit dem 1. Januar 2024 563 Euro monatlich für alleinstehende Erwachsene.',
      output: 'Seit 1. Januar 2024 bekommen Sie 563 Euro pro Monat.\nDas gilt für Erwachsene, die alleine leben.',
      explanation: 'Simplified while preserving exact numbers and dates',
    },
  ],

  /**
   * Examples for question answering
   */
  qa: [
    {
      question: 'Wer kann Bürgergeld beantragen?',
      context: 'Bürgergeld ist für erwerbsfähige Personen zwischen 15 und 67 Jahren, die ihren Lebensunterhalt nicht selbst sichern können...',
      answer: 'Bürgergeld können Sie beantragen, wenn Sie:\n- Zwischen 15 und 67 Jahre alt sind\n- Erwerbsfähig sind (mindestens 3 Stunden täglich arbeiten können)\n- Ihren Lebensunterhalt nicht selbst sichern können\n\nQuelle: Bürgergeld-Beschreibung',
      explanation: 'Clear structure, factual, cited source',
    },
  ],

  /**
   * Examples for summarization
   */
  summarization: [
    {
      input: 'Lange Beschreibung mit vielen Details über Wohngeld, Voraussetzungen, Berechnung, Antragsprozess...',
      shortSummary: 'Wohngeld ist ein Zuschuss zur Miete für Haushalte mit geringem Einkommen. Höhe abhängig von Einkommen, Miete und Haushaltsgröße.',
      longSummary: 'Wohngeld ist ein staatlicher Zuschuss zu den Wohnkosten für Haushalte mit geringem Einkommen. Die Höhe wird individuell berechnet basierend auf: Haushaltsgröße, Gesamteinkommen und Miethöhe. Antragstellung beim örtlichen Wohngeldamt. Auszahlung erfolgt monatlich für 12 Monate, danach erneute Antragstellung erforderlich.',
      explanation: 'Different lengths for different needs',
    },
  ],
};

/**
 * Build a prompt from a template
 * 
 * Replaces {{variables}} with actual values.
 * 
 * LEARNING NOTE: Template engines separate structure from content.
 * This makes prompts maintainable and testable.
 * 
 * @param {Object} template - Template object with template string and variables
 * @param {Object} variables - Variable values to substitute
 * @returns {string} Built prompt
 */
export function buildPrompt(template, variables) {
  let prompt = template.template;
  
  // Replace required variables
  for (const varName of template.variables || []) {
    if (!(varName in variables)) {
      throw new Error(`Missing required variable: ${varName}`);
    }
    
    const value = variables[varName];
    const regex = new RegExp(`{{${varName}}}`, 'g');
    prompt = prompt.replace(regex, value);
  }
  
  // Handle optional variables with {{#if}} blocks
  // Simple implementation - could be enhanced with a real template engine
  const ifBlockRegex = /{{#if (\w+)}}([\s\S]*?){{\/if}}/g;
  prompt = prompt.replace(ifBlockRegex, (match, varName, content) => {
    if (variables[varName]) {
      // Replace the variable in the content
      const regex = new RegExp(`{{${varName}}}`, 'g');
      return content.replace(regex, variables[varName]);
    }
    return ''; // Remove the block if variable not present
  });
  
  // Replace remaining optional variables
  for (const varName of template.optional || []) {
    if (varName in variables && variables[varName]) {
      const regex = new RegExp(`{{${varName}}}`, 'g');
      prompt = prompt.replace(regex, variables[varName]);
    }
  }
  
  // Clean up any remaining template markers
  prompt = prompt.replace(/{{#if \w+}}[\s\S]*?{{\/if}}/g, '');
  prompt = prompt.replace(/{{\w+}}/g, '');
  
  // Clean up extra whitespace
  prompt = prompt.replace(/\n{3,}/g, '\n\n');
  
  return prompt.trim();
}

/**
 * Build messages array for chat completion
 * 
 * LEARNING NOTE: Chat models use a structured message format:
 * - system: Sets overall behavior (optional, but recommended)
 * - user: User's input/question
 * - assistant: AI's responses (in conversation history)
 * 
 * @param {string} systemPrompt - System message content
 * @param {string} userPrompt - User message content
 * @param {Array} history - Optional conversation history
 * @returns {Array} Messages array
 */
export function buildMessages(systemPrompt, userPrompt, history = []) {
  const messages = [];
  
  // Add system message
  if (systemPrompt) {
    messages.push({
      role: 'system',
      content: systemPrompt,
    });
  }
  
  // Add conversation history
  if (history && history.length > 0) {
    messages.push(...history);
  }
  
  // Add user message
  messages.push({
    role: 'user',
    content: userPrompt,
  });
  
  return messages;
}

/**
 * Add few-shot examples to messages
 * 
 * LEARNING NOTE: Few-shot examples are added as user/assistant message pairs
 * before the actual user question. This teaches the model the pattern.
 * 
 * STRUCTURE:
 * 1. System prompt
 * 2. Example 1 user message
 * 3. Example 1 assistant response
 * 4. Example 2 user message
 * 5. Example 2 assistant response
 * ...
 * N. Actual user question
 * 
 * @param {Array} messages - Base messages array
 * @param {Array} examples - Example objects with input/output
 * @param {string} inputKey - Key for input in examples (default: 'input')
 * @param {string} outputKey - Key for output in examples (default: 'output')
 * @returns {Array} Messages with examples inserted
 */
export function addFewShotExamples(messages, examples, inputKey = 'input', outputKey = 'output') {
  if (!examples || examples.length === 0) {
    return messages;
  }
  
  // Find where to insert examples (after system message, before user messages)
  const systemMessageIndex = messages.findIndex(m => m.role === 'system');
  const insertIndex = systemMessageIndex >= 0 ? systemMessageIndex + 1 : 0;
  
  // Build example messages
  const exampleMessages = [];
  for (const example of examples) {
    exampleMessages.push({
      role: 'user',
      content: example[inputKey],
    });
    exampleMessages.push({
      role: 'assistant',
      content: example[outputKey],
    });
  }
  
  // Insert examples
  const result = [
    ...messages.slice(0, insertIndex),
    ...exampleMessages,
    ...messages.slice(insertIndex),
  ];
  
  return result;
}

/**
 * Format context for RAG prompts
 * 
 * LEARNING NOTE: RAG context needs clear structure so the LLM can:
 * - Identify different documents
 * - Cite sources accurately
 * - Understand document metadata
 * 
 * @param {Array} documents - Retrieved documents
 * @returns {string} Formatted context
 */
export function formatContext(documents) {
  if (!documents || documents.length === 0) {
    return '[No relevant context found]';
  }
  
  const formattedDocs = documents.map((doc, index) => {
    const parts = [];
    
    // Document header
    parts.push(`--- Document ${index + 1} ---`);
    
    // Metadata
    if (doc.title) {
      parts.push(`Title: ${doc.title}`);
    }
    if (doc.source) {
      parts.push(`Source: ${doc.source}`);
    }
    if (doc.date) {
      parts.push(`Date: ${doc.date}`);
    }
    if (doc.relevance) {
      parts.push(`Relevance: ${(doc.relevance * 100).toFixed(0)}%`);
    }
    
    // Content
    parts.push('');
    parts.push(doc.content || doc.text || '');
    
    return parts.join('\n');
  });
  
  return formattedDocs.join('\n\n');
}

/**
 * Chain of thought prompting
 * 
 * LEARNING NOTE: CoT prompting improves reasoning by asking the model to
 * "think step by step" before answering. This technique:
 * - Improves accuracy on complex problems
 * - Makes reasoning transparent
 * - Helps catch logical errors
 * 
 * WHEN TO USE:
 * - Multi-step reasoning
 * - Mathematical calculations
 * - Logical deduction
 * - Complex eligibility checks
 * 
 * @param {string} question - The question to answer
 * @param {string} context - Optional context
 * @returns {string} CoT prompt
 */
export function chainOfThoughtPrompt(question, context = '') {
  let prompt = '';
  
  if (context) {
    prompt += `Context:\n${context}\n\n`;
  }
  
  prompt += `Question: ${question}\n\n`;
  prompt += `Let's think step by step:\n`;
  prompt += `1. What information do we need to answer this?\n`;
  prompt += `2. What does the context tell us?\n`;
  prompt += `3. What logical steps lead to the answer?\n`;
  prompt += `4. What is the final answer?\n\n`;
  prompt += `Analysis:`;
  
  return prompt;
}

/**
 * Validate a prompt before sending to LLM
 * 
 * Checks for common issues that waste tokens or produce poor results.
 * 
 * @param {string|Array} prompt - Prompt string or messages array
 * @returns {{ valid: boolean, warnings: string[] }}
 */
export function validatePrompt(prompt) {
  const warnings = [];
  
  const text = typeof prompt === 'string' ? prompt : JSON.stringify(prompt);
  
  // Check length
  if (text.length < 10) {
    warnings.push('Prompt is very short. Consider adding more context or instruction.');
  }
  
  if (text.length > 100000) {
    warnings.push('Prompt is very long. Consider summarizing or splitting into multiple calls.');
  }
  
  // Check for common issues
  if (text.includes('undefined') || text.includes('null')) {
    warnings.push('Prompt contains "undefined" or "null". Check variable substitution.');
  }
  
  if (text.includes('{{')) {
    warnings.push('Prompt contains template markers ({{}}). Did you forget to build the prompt?');
  }
  
  // Check for empty messages
  if (Array.isArray(prompt)) {
    const emptyMessages = prompt.filter(m => !m.content || m.content.trim() === '');
    if (emptyMessages.length > 0) {
      warnings.push(`${emptyMessages.length} message(s) have empty content.`);
    }
  }
  
  return {
    valid: warnings.length === 0,
    warnings,
  };
}

/**
 * USAGE EXAMPLES:
 * ===============
 * 
 * Basic prompt building:
 * ```javascript
 * import { buildPrompt, PROMPT_TEMPLATES } from './prompts.js';
 * 
 * const prompt = buildPrompt(PROMPT_TEMPLATES.translateEasyGerman, {
 *   text: 'Komplexer deutscher Text...',
 *   targetAudience: 'Menschen mit Lernschwierigkeiten'
 * });
 * ```
 * 
 * Building messages for chat:
 * ```javascript
 * import { buildMessages, SYSTEM_PROMPTS } from './prompts.js';
 * 
 * const messages = buildMessages(
 *   SYSTEM_PROMPTS.qa,
 *   'Wie beantrage ich Bürgergeld?'
 * );
 * ```
 * 
 * Adding few-shot examples:
 * ```javascript
 * import { addFewShotExamples, FEW_SHOT_EXAMPLES } from './prompts.js';
 * 
 * const messages = buildMessages(...);
 * const withExamples = addFewShotExamples(
 *   messages,
 *   FEW_SHOT_EXAMPLES.easyGerman
 * );
 * ```
 * 
 * Formatting RAG context:
 * ```javascript
 * import { formatContext } from './prompts.js';
 * 
 * const context = formatContext(retrievedDocuments);
 * const prompt = buildPrompt(PROMPT_TEMPLATES.answerQuestion, {
 *   context,
 *   question: 'Wer ist berechtigt?'
 * });
 * ```
 */

export default {
  SYSTEM_PROMPTS,
  PROMPT_TEMPLATES,
  FEW_SHOT_EXAMPLES,
  buildPrompt,
  buildMessages,
  addFewShotExamples,
  formatContext,
  chainOfThoughtPrompt,
  validatePrompt,
};
