/**
 * Systemfehler - Quality Assessment Module
 * 
 * This module uses LLMs to assess data quality for social benefits entries,
 * helping calculate IQS (Information Quality Score) and AIS (Accessibility
 * and Inclusivity Score).
 * 
 * ============================================================================
 * WHAT IS DATA QUALITY ASSESSMENT?
 * ============================================================================
 * 
 * Data quality assessment evaluates how well data meets requirements for
 * its intended use. For Systemfehler, high-quality data is:
 * 
 * - COMPLETE: All required fields filled
 * - ACCURATE: Information is correct and current
 * - CLEAR: Easy to understand
 * - CONSISTENT: No contradictions, translations match
 * - ACCESSIBLE: Available in multiple languages/formats
 * - ACTIONABLE: Provides concrete next steps
 * 
 * ============================================================================
 * WHY USE LLMs FOR QUALITY ASSESSMENT?
 * ============================================================================
 * 
 * TRADITIONAL APPROACH: Rule-based validation
 * - Check if fields are filled
 * - Validate formats (email, phone)
 * - Count characters/words
 * - Limited to objective metrics
 * 
 * LLM APPROACH: Semantic understanding
 * ✓ Assess clarity and understandability
 * ✓ Check logical consistency
 * ✓ Evaluate completeness of information (not just fields)
 * ✓ Compare translations for accuracy
 * ✓ Identify missing context
 * ✓ Suggest specific improvements
 * 
 * HYBRID APPROACH (BEST):
 * Combine rule-based checks (fast, objective) with LLM assessment
 * (nuanced, semantic) for comprehensive evaluation.
 * 
 * ============================================================================
 * IQS AND AIS SCORES
 * ============================================================================
 * 
 * IQS (Information Quality Score): 0-100
 * Measures overall data quality based on:
 * - Completeness (40%): All necessary information present
 * - Accuracy (30%): Information is correct
 * - Clarity (20%): Easy to understand
 * - Timeliness (10%): Up-to-date information
 * 
 * AIS (Accessibility and Inclusivity Score): 0-100
 * Measures accessibility based on:
 * - Language coverage (30%): Multiple languages available
 * - Easy language (25%): Leichte Sprache provided
 * - Clarity (25%): Understandable for all audiences
 * - Cultural sensitivity (20%): Inclusive, respectful
 * 
 * ============================================================================
 * LLM-AS-A-JUDGE PATTERN
 * ============================================================================
 * 
 * Using LLMs to evaluate content is called "LLM-as-a-Judge".
 * 
 * BENEFITS:
 * - Understands context and semantics
 * - Can explain judgments
 * - Adapts to different domains
 * - Provides actionable feedback
 * 
 * CHALLENGES:
 * - Can be inconsistent (non-deterministic)
 * - May have biases
 * - Expensive (API costs)
 * - Slower than rule-based checks
 * 
 * BEST PRACTICES:
 * 
 * 1. CLEAR RUBRICS:
 *    Provide specific scoring criteria
 *    Example: "Score 0-10 for clarity where 0=incomprehensible, 10=crystal clear"
 * 
 * 2. STRUCTURED OUTPUT:
 *    Request JSON with scores + explanations
 *    Makes it easy to parse and act on
 * 
 * 3. LOW TEMPERATURE:
 *    Use temperature=0 or 0.1 for consistency
 * 
 * 4. CALIBRATION:
 *    Test on known examples
 *    Adjust prompts to align with human judgment
 * 
 * 5. MULTIPLE EVALUATIONS:
 *    Run multiple times and average (reduces variance)
 *    Or use multiple models and combine
 * 
 * 6. HUMAN VALIDATION:
 *    Spot-check LLM assessments
 *    Use feedback to improve prompts
 * 
 * ============================================================================
 * LEARNING RESOURCES
 * ============================================================================
 * - Data quality dimensions: https://en.wikipedia.org/wiki/Data_quality
 * - LLM evaluation: https://arxiv.org/abs/2310.17631
 * - Rubric design: https://www.cmu.edu/teaching/assessment/assesslearning/rubrics.html
 * 
 * @see llm_client.js for making LLM requests
 * @see prompts.js for assessment prompt templates
 */

import { createChatCompletion } from './llm_client.js';
import { trackCost } from './cost_tracker.js';

/**
 * Default options
 */
const DEFAULT_OPTIONS = {
  model: 'gpt-4o-mini',
  temperature: 0, // Deterministic for consistent assessment
  includeRecommendations: true,
};

/**
 * Quality dimensions and weights
 * 
 * LEARNING NOTE: These weights define how much each dimension contributes
 * to the overall score. Adjust based on your priorities.
 */
const IQS_WEIGHTS = {
  completeness: 0.40,  // 40% - Most important: is all info there?
  accuracy: 0.30,      // 30% - Is the information correct?
  clarity: 0.20,       // 20% - Is it understandable?
  timeliness: 0.10,    // 10% - Is it current?
};

const AIS_WEIGHTS = {
  languageCoverage: 0.30,    // 30% - Multiple languages available?
  easyLanguage: 0.25,        // 25% - Leichte Sprache provided?
  clarity: 0.25,             // 25% - Clear for all audiences?
  culturalSensitivity: 0.20, // 20% - Inclusive and respectful?
};

/**
 * Assess complete entry quality
 * 
 * COMPREHENSIVE ASSESSMENT
 * ========================
 * 
 * This is the main function that performs a complete quality assessment,
 * combining multiple checks into overall IQS and AIS scores.
 * 
 * LEARNING NOTE: ASSESSMENT PIPELINE
 * ===================================
 * 
 * 1. RULE-BASED CHECKS (fast, objective):
 *    - Field presence
 *    - Format validation
 *    - Length checks
 * 
 * 2. LLM ASSESSMENTS (slower, nuanced):
 *    - Completeness of information
 *    - Clarity of descriptions
 *    - Translation consistency
 * 
 * 3. SCORING:
 *    - Combine dimension scores using weights
 *    - Calculate IQS and AIS
 * 
 * 4. RECOMMENDATIONS:
 *    - Generate specific improvement suggestions
 *    - Prioritize by impact
 * 
 * LEARNING NOTE: WHY SEPARATE DIMENSIONS?
 * ========================================
 * 
 * Breaking assessment into dimensions:
 * - Makes scoring explainable
 * - Helps identify specific issues
 * - Allows targeted improvements
 * - Supports partial assessments (check one dimension)
 * 
 * Example:
 * Overall score: 65/100 (okay, but could be better)
 * - Completeness: 90/100 (great!)
 * - Clarity: 40/100 (needs work!)
 * → Focus efforts on improving clarity
 * 
 * @param {Object} entry - Entry to assess
 * @param {Object} options - Assessment options
 * @param {string} options.model - LLM model to use
 * @param {number} options.temperature - Generation temperature
 * @param {boolean} options.includeRecommendations - Generate improvement suggestions
 * @returns {Promise<Object>} Assessment results with scores and recommendations
 * 
 * @example
 * const entry = {
 *   title: { de: "Bürgergeld", en: "Citizen's Benefit" },
 *   description: { de: "Finanzielle Hilfe...", en: "Financial support..." },
 *   benefitAmount: { de: "563€" },
 *   eligibilityCriteria: { de: "Arbeitslos" }
 * };
 * 
 * const assessment = await assessEntry(entry);
 * console.log('IQS:', assessment.iqs);
 * console.log('AIS:', assessment.ais);
 * console.log('Top issue:', assessment.issues[0].description);
 * assessment.recommendations.forEach(rec => console.log('→', rec));
 */
export async function assessEntry(entry, options = {}) {
  if (!entry || typeof entry !== 'object') {
    throw new Error('Entry must be an object');
  }

  const config = { ...DEFAULT_OPTIONS, ...options };

  try {
    const startTime = Date.now();

    // Run all assessments in parallel for efficiency
    const [
      completenessResult,
      clarityResult,
      consistencyResult,
      accessibilityResult
    ] = await Promise.all([
      assessCompleteness(entry, config),
      assessClarity(entry, config),
      assessConsistency(entry, config),
      assessAccessibility(entry, config),
    ]);

    // Calculate IQS (Information Quality Score)
    const iqs = calculateIQS({
      completeness: completenessResult.score,
      clarity: clarityResult.score,
      accuracy: 100, // TODO: Implement accuracy check (requires ground truth)
      timeliness: 100, // TODO: Implement timeliness check (requires date tracking)
    });

    // Calculate AIS (Accessibility and Inclusivity Score)
    const ais = calculateAIS({
      languageCoverage: accessibilityResult.languageCoverage,
      easyLanguage: accessibilityResult.easyLanguage,
      clarity: clarityResult.score,
      culturalSensitivity: accessibilityResult.culturalSensitivity,
    });

    // Collect all issues
    const issues = [
      ...completenessResult.issues,
      ...clarityResult.issues,
      ...consistencyResult.issues,
      ...accessibilityResult.issues,
    ].sort((a, b) => {
      // Sort by severity: high > medium > low
      const severityOrder = { high: 0, medium: 1, low: 2 };
      return severityOrder[a.severity] - severityOrder[b.severity];
    });

    // Generate recommendations
    let recommendations = [];
    if (config.includeRecommendations) {
      const recommendationsResult = await generateRecommendations({
        entry,
        iqs,
        ais,
        issues,
        completenessResult,
        clarityResult,
        consistencyResult,
        accessibilityResult,
      }, config);
      recommendations = recommendationsResult.recommendations;
    }

    const duration = Date.now() - startTime;

    return {
      iqs: Math.round(iqs),
      ais: Math.round(ais),
      breakdown: {
        completeness: completenessResult.score,
        clarity: clarityResult.score,
        consistency: consistencyResult.score,
        accessibility: {
          languageCoverage: accessibilityResult.languageCoverage,
          easyLanguage: accessibilityResult.easyLanguage,
          culturalSensitivity: accessibilityResult.culturalSensitivity,
        },
      },
      issues,
      recommendations,
      metadata: {
        duration,
        model: config.model,
        timestamp: Date.now(),
      },
    };

  } catch (error) {
    throw new Error(`Entry assessment failed: ${error.message}`);
  }
}

/**
 * Calculate IQS from dimension scores
 * 
 * LEARNING NOTE: Weighted average calculation.
 * Each dimension contributes proportionally to its weight.
 */
function calculateIQS(scores) {
  return (
    scores.completeness * IQS_WEIGHTS.completeness +
    scores.accuracy * IQS_WEIGHTS.accuracy +
    scores.clarity * IQS_WEIGHTS.clarity +
    scores.timeliness * IQS_WEIGHTS.timeliness
  );
}

/**
 * Calculate AIS from dimension scores
 */
function calculateAIS(scores) {
  return (
    scores.languageCoverage * AIS_WEIGHTS.languageCoverage +
    scores.easyLanguage * AIS_WEIGHTS.easyLanguage +
    scores.clarity * AIS_WEIGHTS.clarity +
    scores.culturalSensitivity * AIS_WEIGHTS.culturalSensitivity
  );
}

/**
 * Assess completeness of information
 * 
 * COMPLETENESS ASSESSMENT
 * =======================
 * 
 * LEARNING NOTE: OBJECTIVE VS SUBJECTIVE COMPLETENESS
 * ====================================================
 * 
 * 1. OBJECTIVE COMPLETENESS:
 *    Are required fields filled?
 *    Fast, rule-based check
 *    Example: "description field is empty" → Incomplete
 * 
 * 2. SUBJECTIVE COMPLETENESS:
 *    Is there enough information to take action?
 *    Requires understanding and judgment
 *    Example: Description field filled but missing key details
 * 
 * We use BOTH:
 * - Quick rule-based check for field presence
 * - LLM check for information sufficiency
 * 
 * LEARNING NOTE: RUBRIC-BASED SCORING
 * ====================================
 * 
 * We provide the LLM with a clear rubric:
 * 
 * 100: All information present and detailed
 * 80:  Most information present, minor gaps
 * 60:  Key information present, some gaps
 * 40:  Significant information missing
 * 20:  Only basic information present
 * 0:   Minimal or no information
 * 
 * This makes scoring consistent and explainable.
 * 
 * @param {Object} entry - Entry to assess
 * @param {Object} config - Assessment configuration
 * @returns {Promise<Object>} Completeness assessment
 * 
 * @example
 * const result = await assessCompleteness(entry);
 * console.log('Completeness score:', result.score);
 * console.log('Missing fields:', result.missingFields);
 * console.log('Issues:', result.issues);
 */
export async function assessCompleteness(entry, config = DEFAULT_OPTIONS) {
  // Step 1: Rule-based check for required fields
  const requiredFields = [
    'title',
    'description',
    'eligibilityCriteria',
    'applicationSteps',
  ];

  const missingFields = [];
  const presentFields = [];

  for (const field of requiredFields) {
    if (!entry[field] || !hasGermanText(entry[field])) {
      missingFields.push(field);
    } else {
      presentFields.push(field);
    }
  }

  // Quick score based on field presence
  const fieldPresenceScore = (presentFields.length / requiredFields.length) * 100;

  // If many fields missing, return early (no need for expensive LLM call)
  if (fieldPresenceScore < 50) {
    return {
      score: fieldPresenceScore,
      missingFields,
      issues: missingFields.map(field => ({
        category: 'completeness',
        severity: 'high',
        description: `Required field missing: ${field}`,
        field,
      })),
    };
  }

  // Step 2: LLM assessment for information sufficiency
  const entryText = formatEntryForAssessment(entry);

  const systemPrompt = `Du bist ein Experte für die Bewertung von Informationsqualität bei Sozialleistungen.

Bewerte die VOLLSTÄNDIGKEIT der Informationen auf einer Skala von 0-100.

BEWERTUNGSKRITERIEN:
- 100: Alle notwendigen Informationen vollständig und detailliert vorhanden
- 80:  Meiste Informationen vorhanden, nur kleine Lücken
- 60:  Hauptinformationen vorhanden, einige wichtige Details fehlen
- 40:  Wesentliche Informationen fehlen
- 20:  Nur grundlegende Informationen vorhanden
- 0:   Minimale oder keine Informationen

ERFORDERLICHE INFORMATIONEN FÜR SOZIALLEISTUNGEN:
1. Was ist die Leistung? (Beschreibung)
2. Wer kann sie bekommen? (Voraussetzungen)
3. Wie viel gibt es? (Betrag)
4. Wie beantragt man sie? (Antragsprozess)
5. Welche Dokumente werden benötigt?
6. Wo beantragt man? (Kontakt/Zuständigkeit)
7. Wie lange dauert die Bearbeitung?
8. Wie lange wird die Leistung gewährt?

Antworte im JSON-Format:
{
  "score": 0-100,
  "analysis": "Detaillierte Analyse der Vollständigkeit",
  "missingInfo": ["Information 1 fehlt", "Information 2 fehlt"],
  "presentInfo": ["Information 1 vorhanden", "Information 2 vorhanden"]
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
    const llmResult = JSON.parse(cleaned);

    await trackCost({
      feature: 'quality_assessment_completeness',
      model: config.model,
      inputTokens: response.usage.prompt_tokens,
      outputTokens: response.usage.completion_tokens,
    });

    // Combine rule-based and LLM scores (weighted average)
    const combinedScore = (fieldPresenceScore * 0.3) + (llmResult.score * 0.7);

    // Generate issues from missing information
    const issues = [
      ...missingFields.map(field => ({
        category: 'completeness',
        severity: 'high',
        description: `Required field missing: ${field}`,
        field,
      })),
      ...(llmResult.missingInfo || []).map(info => ({
        category: 'completeness',
        severity: 'medium',
        description: info,
      })),
    ];

    return {
      score: Math.round(combinedScore),
      fieldPresenceScore: Math.round(fieldPresenceScore),
      informationSufficiencyScore: llmResult.score,
      missingFields,
      missingInfo: llmResult.missingInfo || [],
      presentInfo: llmResult.presentInfo || [],
      analysis: llmResult.analysis,
      issues,
    };

  } catch (error) {
    // Fallback to rule-based score if LLM fails
    console.warn('LLM completeness assessment failed:', error.message);
    return {
      score: Math.round(fieldPresenceScore),
      missingFields,
      issues: missingFields.map(field => ({
        category: 'completeness',
        severity: 'high',
        description: `Required field missing: ${field}`,
        field,
      })),
    };
  }
}

/**
 * Assess clarity of descriptions
 * 
 * CLARITY ASSESSMENT
 * ==================
 * 
 * LEARNING NOTE: WHAT MAKES TEXT CLEAR?
 * ======================================
 * 
 * 1. SIMPLE LANGUAGE: Common words, short sentences
 * 2. CONCRETE: Specific examples, not abstract
 * 3. ORGANIZED: Logical flow, good structure
 * 4. COMPLETE: No unexplained jargon
 * 5. ACTIONABLE: Clear next steps
 * 
 * LLMs are good at assessing clarity because they can:
 * - Identify confusing phrasing
 * - Detect unexplained jargon
 * - Recognize missing context
 * - Suggest improvements
 * 
 * @param {Object} entry - Entry to assess
 * @param {Object} config - Assessment configuration
 * @returns {Promise<Object>} Clarity assessment
 * 
 * @example
 * const result = await assessClarity(entry);
 * console.log('Clarity score:', result.score);
 * console.log('Issues found:', result.issues.length);
 */
export async function assessClarity(entry, config = DEFAULT_OPTIONS) {
  const entryText = formatEntryForAssessment(entry);

  const systemPrompt = `Du bist ein Experte für Textverständlichkeit und Klarheit.

Bewerte die KLARHEIT des Textes auf einer Skala von 0-100.

BEWERTUNGSKRITERIEN:
- 100: Kristallklar, jeder kann es sofort verstehen
- 80:  Sehr klar, nur minimale Unklarheiten
- 60:  Grundsätzlich verständlich, einige unklare Stellen
- 40:  Teilweise unklar, Verwirrung möglich
- 20:  Überwiegend unklar, schwer zu verstehen
- 0:   Unverständlich

PRÜFE:
1. Sind Sätze kurz und einfach?
2. Werden Fachbegriffe erklärt?
3. Ist die Sprache konkret (nicht abstrakt)?
4. Ist die Struktur logisch?
5. Gibt es klare Handlungsanweisungen?
6. Werden Beispiele verwendet?

Antworte im JSON-Format:
{
  "score": 0-100,
  "analysis": "Analyse der Klarheit",
  "strengths": ["Stärke 1", "Stärke 2"],
  "issues": [
    {"description": "Problem", "location": "Wo im Text", "severity": "high/medium/low"}
  ]
}`;

  try {
    const response = await createChatCompletion([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: entryText }
    ], {
      model: config.model,
      temperature: config.temperature,
      max_tokens: 1000,
    });

    const content = response.choices[0].message.content;
    const cleaned = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const result = JSON.parse(cleaned);

    await trackCost({
      feature: 'quality_assessment_clarity',
      model: config.model,
      inputTokens: response.usage.prompt_tokens,
      outputTokens: response.usage.completion_tokens,
    });

    return {
      score: result.score,
      analysis: result.analysis,
      strengths: result.strengths || [],
      issues: (result.issues || []).map(issue => ({
        category: 'clarity',
        severity: issue.severity || 'medium',
        description: issue.description,
        location: issue.location,
      })),
    };

  } catch (error) {
    throw new Error(`Clarity assessment failed: ${error.message}`);
  }
}

/**
 * Assess consistency across translations
 * 
 * CONSISTENCY ASSESSMENT
 * ======================
 * 
 * LEARNING NOTE: TRANSLATION CONSISTENCY
 * ======================================
 * 
 * Why consistency matters:
 * - Builds trust (users see coherent information)
 * - Prevents confusion (same concept, different words)
 * - Ensures accuracy (translations match original)
 * 
 * Common consistency issues:
 * - Different terminology across languages
 * - Missing information in translations
 * - Numbers/amounts don't match
 * - Dates translated incorrectly
 * 
 * LLMs excel at detecting these because they understand:
 * - Semantic equivalence
 * - Cultural context
 * - Domain terminology
 * 
 * @param {Object} entry - Entry to assess
 * @param {Object} config - Assessment configuration
 * @returns {Promise<Object>} Consistency assessment
 * 
 * @example
 * const result = await assessConsistency(entry);
 * console.log('Consistency score:', result.score);
 * console.log('Inconsistencies:', result.issues);
 */
export async function assessConsistency(entry, config = DEFAULT_OPTIONS) {
  // Extract multilingual fields
  const multilingualFields = extractMultilingualFields(entry);

  if (multilingualFields.length === 0) {
    return {
      score: 100,
      analysis: 'No multilingual fields to check',
      issues: [],
    };
  }

  // Format for comparison
  const comparisons = multilingualFields.map(field => {
    const langs = Object.keys(field.content);
    return `FELD: ${field.name}\n` +
      langs.map(lang => `  ${lang.toUpperCase()}: ${field.content[lang]}`).join('\n');
  }).join('\n\n');

  const systemPrompt = `Du bist ein Experte für Übersetzungsqualität und Konsistenz.

Bewerte die KONSISTENZ zwischen den Sprachversionen auf einer Skala von 0-100.

BEWERTUNGSKRITERIEN:
- 100: Perfekte Konsistenz, alle Übersetzungen äquivalent
- 80:  Sehr konsistent, nur minimale Abweichungen
- 60:  Grundsätzlich konsistent, einige Unterschiede
- 40:  Mehrere Inkonsistenzen
- 20:  Erhebliche Unterschiede zwischen Versionen
- 0:   Keine erkennbare Konsistenz

PRÜFE:
1. Sind alle Beträge gleich?
2. Sind alle Daten/Fristen gleich?
3. Ist der Inhalt semantisch äquivalent?
4. Werden gleiche Begriffe konsistent übersetzt?
5. Fehlen in einer Sprache Informationen?

Antworte im JSON-Format:
{
  "score": 0-100,
  "analysis": "Analyse der Konsistenz",
  "issues": [
    {
      "field": "Feldname",
      "description": "Art der Inkonsistenz",
      "severity": "high/medium/low"
    }
  ]
}`;

  try {
    const response = await createChatCompletion([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: comparisons }
    ], {
      model: config.model,
      temperature: config.temperature,
      max_tokens: 1000,
    });

    const content = response.choices[0].message.content;
    const cleaned = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const result = JSON.parse(cleaned);

    await trackCost({
      feature: 'quality_assessment_consistency',
      model: config.model,
      inputTokens: response.usage.prompt_tokens,
      outputTokens: response.usage.completion_tokens,
    });

    return {
      score: result.score,
      analysis: result.analysis,
      issues: (result.issues || []).map(issue => ({
        category: 'consistency',
        severity: issue.severity || 'medium',
        description: issue.description,
        field: issue.field,
      })),
    };

  } catch (error) {
    throw new Error(`Consistency assessment failed: ${error.message}`);
  }
}

/**
 * Assess accessibility and inclusivity
 * 
 * ACCESSIBILITY ASSESSMENT
 * ========================
 * 
 * LEARNING NOTE: DIGITAL ACCESSIBILITY
 * =====================================
 * 
 * Accessibility means making content usable by everyone, including people with:
 * - Visual impairments
 * - Cognitive disabilities
 * - Limited education
 * - Non-native language speakers
 * 
 * KEY ASPECTS:
 * 
 * 1. LANGUAGE COVERAGE:
 *    Are multiple languages provided?
 *    Target: German (de), English (en), Easy German (easy_de)
 * 
 * 2. EASY LANGUAGE:
 *    Is Leichte Sprache (Easy German) provided?
 *    Critical for cognitive accessibility
 * 
 * 3. CLARITY:
 *    Is language simple and clear?
 *    (Already assessed in clarity check)
 * 
 * 4. CULTURAL SENSITIVITY:
 *    Is content respectful and inclusive?
 *    Avoids stereotypes, uses inclusive language
 * 
 * @param {Object} entry - Entry to assess
 * @param {Object} config - Assessment configuration
 * @returns {Promise<Object>} Accessibility assessment
 */
async function assessAccessibility(entry, config = DEFAULT_OPTIONS) {
  // Check language coverage
  const languages = {
    de: hasGermanText(entry.description),
    en: hasEnglishText(entry.description),
    easy_de: hasEasyGermanText(entry.description),
  };

  const availableLanguages = Object.keys(languages).filter(lang => languages[lang]);
  const languageCoverageScore = (availableLanguages.length / 3) * 100;
  const easyLanguageScore = languages.easy_de ? 100 : 0;

  // LLM assessment for cultural sensitivity
  const entryText = formatEntryForAssessment(entry);

  const systemPrompt = `Du bist ein Experte für Barrierefreiheit und Inklusion.

Bewerte die KULTURELLE SENSIBILITÄT und INKLUSIVITÄT auf einer Skala von 0-100.

BEWERTUNGSKRITERIEN:
- 100: Perfekt inklusiv und respektvoll
- 80:  Sehr gut, kleine Verbesserungen möglich
- 60:  Grundsätzlich okay, einige Probleme
- 40:  Mehrere problematische Aspekte
- 20:  Erhebliche Probleme
- 0:   Nicht akzeptabel

PRÜFE:
1. Wird inklusive Sprache verwendet?
2. Werden Stereotypen vermieden?
3. Ist der Ton respektvoll und wertschätzend?
4. Werden verschiedene Lebensumstände berücksichtigt?
5. Ist die Sprache diskriminierungsfrei?

Antworte im JSON-Format:
{
  "score": 0-100,
  "analysis": "Analyse der kulturellen Sensibilität",
  "issues": [
    {"description": "Problem", "severity": "high/medium/low"}
  ],
  "strengths": ["Stärke 1"]
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
    const result = JSON.parse(cleaned);

    await trackCost({
      feature: 'quality_assessment_accessibility',
      model: config.model,
      inputTokens: response.usage.prompt_tokens,
      outputTokens: response.usage.completion_tokens,
    });

    const issues = [
      ...(!languages.de ? [{ severity: 'high', description: 'German translation missing' }] : []),
      ...(!languages.en ? [{ severity: 'medium', description: 'English translation missing' }] : []),
      ...(!languages.easy_de ? [{ severity: 'high', description: 'Easy German translation missing' }] : []),
      ...(result.issues || []),
    ];

    return {
      languageCoverage: Math.round(languageCoverageScore),
      easyLanguage: easyLanguageScore,
      culturalSensitivity: result.score,
      availableLanguages,
      analysis: result.analysis,
      strengths: result.strengths || [],
      issues: issues.map(issue => ({
        category: 'accessibility',
        severity: issue.severity || 'medium',
        description: issue.description,
      })),
    };

  } catch (error) {
    // Fallback to language coverage only if LLM fails
    console.warn('LLM accessibility assessment failed:', error.message);
    return {
      languageCoverage: Math.round(languageCoverageScore),
      easyLanguage: easyLanguageScore,
      culturalSensitivity: 80, // Assume okay if can't check
      availableLanguages,
      issues: [
        ...(!languages.de ? [{ category: 'accessibility', severity: 'high', description: 'German translation missing' }] : []),
        ...(!languages.en ? [{ category: 'accessibility', severity: 'medium', description: 'English translation missing' }] : []),
        ...(!languages.easy_de ? [{ category: 'accessibility', severity: 'high', description: 'Easy German translation missing' }] : []),
      ],
    };
  }
}

/**
 * Generate improvement recommendations
 * 
 * RECOMMENDATION GENERATION
 * =========================
 * 
 * LEARNING NOTE: ACTIONABLE FEEDBACK
 * ==================================
 * 
 * Good recommendations are:
 * - SPECIFIC: "Add eligibility criteria" not "Improve content"
 * - ACTIONABLE: Tell exactly what to do
 * - PRIORITIZED: Most important first
 * - CONTEXTUAL: Based on actual issues found
 * 
 * @param {Object} assessmentData - Combined assessment data
 * @param {Object} config - Configuration
 * @returns {Promise<Object>} Recommendations
 */
export async function generateRecommendations(assessmentData, config = DEFAULT_OPTIONS) {
  const { iqs, ais, issues, entry } = assessmentData;

  // Build context about the assessment
  const contextText = `
ENTRY TITLE: ${extractGermanText(entry.title) || 'Untitled'}

QUALITY SCORES:
- IQS (Information Quality Score): ${Math.round(iqs)}/100
- AIS (Accessibility Score): ${Math.round(ais)}/100

IDENTIFIED ISSUES (${issues.length} total):
${issues.slice(0, 10).map((issue, i) => `${i + 1}. [${issue.severity.toUpperCase()}] ${issue.description}`).join('\n')}

ASSESSMENT DETAILS:
- Completeness: ${assessmentData.completenessResult.score}/100
- Clarity: ${assessmentData.clarityResult.score}/100
- Consistency: ${assessmentData.consistencyResult.score}/100
`;

  const systemPrompt = `Du bist ein Experte für Datenqualität bei Sozialleistungen.

Basierend auf der Qualitätsbewertung, generiere konkrete, umsetzbare Empfehlungen zur Verbesserung.

ANFORDERUNGEN AN EMPFEHLUNGEN:
- Spezifisch und konkret
- Priorisiert nach Wichtigkeit
- Umsetzbar und klar
- Fokus auf größten Verbesserungspotenzial

KATEGORIEN:
1. Kritisch (sofort beheben)
2. Wichtig (bald beheben)
3. Verbesserung (wünschenswert)

Generiere maximal 8 Empfehlungen.

Antworte im JSON-Format:
{
  "recommendations": [
    {
      "priority": "critical/important/improvement",
      "category": "completeness/clarity/consistency/accessibility",
      "description": "Konkrete Empfehlung",
      "impact": "Erwartete Auswirkung auf Qualität"
    }
  ],
  "summary": "Zusammenfassung der wichtigsten Verbesserungen"
}`;

  try {
    const response = await createChatCompletion([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: contextText }
    ], {
      model: config.model,
      temperature: 0.3, // Slightly creative for recommendations
      max_tokens: 1200,
    });

    const content = response.choices[0].message.content;
    const cleaned = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const result = JSON.parse(cleaned);

    await trackCost({
      feature: 'quality_assessment_recommendations',
      model: config.model,
      inputTokens: response.usage.prompt_tokens,
      outputTokens: response.usage.completion_tokens,
    });

    return {
      recommendations: result.recommendations || [],
      summary: result.summary,
    };

  } catch (error) {
    throw new Error(`Recommendation generation failed: ${error.message}`);
  }
}

/**
 * Helper: Format entry for assessment
 */
function formatEntryForAssessment(entry) {
  const parts = [];

  if (entry.title) {
    parts.push(`TITEL: ${extractGermanText(entry.title) || 'N/A'}`);
  }
  if (entry.description) {
    parts.push(`BESCHREIBUNG: ${extractGermanText(entry.description) || 'N/A'}`);
  }
  if (entry.benefitAmount) {
    parts.push(`BETRAG: ${extractGermanText(entry.benefitAmount) || 'N/A'}`);
  }
  if (entry.eligibilityCriteria) {
    parts.push(`VORAUSSETZUNGEN: ${extractGermanText(entry.eligibilityCriteria) || 'N/A'}`);
  }
  if (entry.applicationSteps) {
    const steps = Array.isArray(entry.applicationSteps)
      ? entry.applicationSteps.map(s => extractGermanText(s)).filter(Boolean).join('; ')
      : extractGermanText(entry.applicationSteps);
    if (steps) parts.push(`ANTRAG: ${steps}`);
  }

  return parts.join('\n\n');
}

/**
 * Helper: Extract multilingual fields
 */
function extractMultilingualFields(entry) {
  const fields = [];

  for (const [key, value] of Object.entries(entry)) {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      // Check if it looks like a multilingual field (has language codes)
      if (value.de || value.en || value.easy_de) {
        fields.push({ name: key, content: value });
      }
    }
  }

  return fields;
}

/**
 * Helper: Check if German text exists
 */
function hasGermanText(field) {
  if (!field) return false;
  if (typeof field === 'string' && field.trim().length > 0) return true;
  if (typeof field === 'object' && field.de && field.de.trim().length > 0) return true;
  return false;
}

/**
 * Helper: Check if English text exists
 */
function hasEnglishText(field) {
  if (!field || typeof field !== 'object') return false;
  return field.en && field.en.trim().length > 0;
}

/**
 * Helper: Check if Easy German text exists
 */
function hasEasyGermanText(field) {
  if (!field || typeof field !== 'object') return false;
  return field.easy_de && field.easy_de.trim().length > 0;
}

/**
 * Helper: Extract German text
 */
function extractGermanText(field) {
  if (!field) return null;
  if (typeof field === 'string') return field;
  if (typeof field === 'object' && field.de) return field.de;
  return null;
}

/**
 * USAGE EXAMPLES
 * ==============
 */

// Example 1: Complete assessment
async function example1() {
  const entry = {
    title: { de: "Bürgergeld" },
    description: {
      de: "Finanzielle Unterstützung für Arbeitsuchende",
      en: "Financial support for job seekers"
    },
    benefitAmount: { de: "563€ pro Monat" },
    eligibilityCriteria: { de: "Arbeitslos und hilfebedürftig" },
  };

  const assessment = await assessEntry(entry);

  console.log('IQS:', assessment.iqs);
  console.log('AIS:', assessment.ais);
  console.log('\nBreakdown:');
  console.log('- Completeness:', assessment.breakdown.completeness);
  console.log('- Clarity:', assessment.breakdown.clarity);
  console.log('- Consistency:', assessment.breakdown.consistency);

  console.log('\nTop 3 Issues:');
  assessment.issues.slice(0, 3).forEach(issue => {
    console.log(`[${issue.severity}] ${issue.description}`);
  });

  console.log('\nTop 3 Recommendations:');
  assessment.recommendations.slice(0, 3).forEach(rec => {
    console.log(`[${rec.priority}] ${rec.description}`);
  });
}

// Example 2: Individual dimension assessment
async function example2() {
  const entry = { /* ... */ };

  // Just check completeness
  const completeness = await assessCompleteness(entry);
  console.log('Completeness:', completeness.score);
  console.log('Missing:', completeness.missingFields);

  // Just check clarity
  const clarity = await assessClarity(entry);
  console.log('Clarity:', clarity.score);
  console.log('Issues:', clarity.issues);
}

// Example 3: Batch assessment
async function example3() {
  const entries = [
    { id: 1, /* ... */ },
    { id: 2, /* ... */ },
    { id: 3, /* ... */ },
  ];

  const assessments = await Promise.all(
    entries.map(entry => assessEntry(entry))
  );

  // Find entries needing improvement
  const needsWork = assessments
    .filter(a => a.iqs < 70)
    .sort((a, b) => a.iqs - b.iqs);

  console.log(`${needsWork.length} entries need improvement`);
  needsWork.forEach(a => {
    console.log(`Entry IQS ${a.iqs}: ${a.recommendations[0].description}`);
  });
}

export default {
  assessEntry,
  assessCompleteness,
  assessClarity,
  assessConsistency,
  generateRecommendations,
};
