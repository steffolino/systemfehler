#!/usr/bin/env node

import { localEvaluateEntries } from './cloudflare-pages/functions/api/_lib/ai.js';
import fs from 'fs';

const entries = [];
['benefits', 'aid', 'contacts', 'tools'].forEach(domain => {
  const raw = JSON.parse(fs.readFileSync(`data/${domain}/entries.json`, 'utf8'));
  const list = Array.isArray(raw) ? raw : raw.entries || [];
  list.forEach(e => entries.push({...e, domain, status: e.status || 'active'}));
});

const scenarios = JSON.parse(fs.readFileSync('data/_topics/life_events.json', 'utf8')).scenarios;
const suggested = JSON.parse(fs.readFileSync('frontend/src/data/life_event_suggested_questions.json', 'utf8'));

// Test first 3 questions per scenario
const scenarioOrder = Object.keys(suggested);

for (const scenarioId of scenarioOrder) {
  const questions = suggested[scenarioId];
  if (!Array.isArray(questions)) continue;
  
  console.log(`\n${'='.repeat(70)}`);
  console.log(`\nSCENARIO: ${scenarioId}\n`);
  
  questions.slice(0, 3).forEach((query, idx) => {
    const result = localEvaluateEntries(entries, query, {
      lifeEventScenarios: scenarios
    });
    
    // Production uses confidenceFromScore: score>=4 → 0.72, score>=6 → 0.79, etc.
    // weak_evidence in production = !evidence.some(item => item.confidence >= 0.7)
    // i.e., weak_evidence when ALL entries have score < 4
    function confidenceFromScore(score) {
      if (score >= 12) return 0.92;
      if (score >= 9) return 0.86;
      if (score >= 6) return 0.79;
      if (score >= 4) return 0.72;
      return 0.55;
    }
    const strongCount = result.results.filter(r => confidenceFromScore(r.score || 0) >= 0.7).length;
    const wouldShowWeakWarning = strongCount === 0;
    console.log(`Q${idx + 1}: "${query}"`);
    console.log(`Detected life event: ${result.stages.join(', ')}`);
    console.log(`Strong evidence (>=0.7 conf): ${strongCount} entries  ${wouldShowWeakWarning ? '⚠ WEAK_EVIDENCE=true' : '✓ OK'}`);
    console.log(`Top results:`);
    result.results.slice(0, 5).forEach((r, i) => {
      const conf = (confidenceFromScore(r.score || 0) * 100).toFixed(0);
      console.log(`  ${i+1}. [${r.domain.padEnd(10)}] [${conf}%] score=${r.score} ${r.title}`);
    });
  });
}
