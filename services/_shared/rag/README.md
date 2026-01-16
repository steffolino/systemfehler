# RAG (Retrieval-Augmented Generation) Modules

This directory contains the complete RAG implementation for the Systemfehler project. RAG is a technique that enhances LLM responses by retrieving relevant information from a knowledge base and including it in the prompt.

## 📚 What is RAG?

**RAG = Retrieval-Augmented Generation**

Instead of relying solely on the LLM's training data, RAG:
1. **Retrieves** relevant documents from a knowledge base
2. **Augments** the prompt with this context
3. **Generates** an answer grounded in factual information

### Why RAG?

- ✅ **Reduces hallucinations**: LLM answers based on provided facts
- ✅ **Current information**: Update knowledge base without retraining
- ✅ **Source attribution**: Know where information came from
- ✅ **Domain expertise**: Add specialized knowledge easily
- ✅ **Cost effective**: No expensive fine-tuning needed

## 🎯 Pipeline Architecture

```
User Question
     ↓
┌────────────────────┐
│ Query Processing   │  → Understand intent, extract entities, expand query
└────────────────────┘
     ↓
┌────────────────────┐
│ Retrieval          │  → Semantic search for relevant documents
└────────────────────┘
     ↓
┌────────────────────┐
│ Context Building   │  → Rerank, format, and optimize context
└────────────────────┘
     ↓
┌────────────────────┐
│ Answer Generation  │  → LLM generates answer with citations
└────────────────────┘
     ↓
   Answer
```

## 📦 Modules

### 1. `rag_pipeline.js` - Main Orchestrator

The complete RAG pipeline that coordinates all stages.

**Main Function**: `answerQuestion(question, options)`

```javascript
import { answerQuestion } from './rag_pipeline.js';

const result = await answerQuestion("Am I eligible for Bürgergeld?");

console.log(result.answer);      // Generated answer with citations
console.log(result.confidence);  // Confidence level (high/medium/low)
console.log(result.sources);     // Sources used with citations
```

**Features**:
- Complete end-to-end pipeline
- Batch processing support
- Performance monitoring
- Cost estimation
- Error handling with graceful fallbacks

**When to use**: This is your main entry point for RAG functionality.

---

### 2. `query_processor.js` - Query Understanding

Processes and enhances user queries for better retrieval.

**Main Function**: `processQuery(query, options)`

```javascript
import { processQuery } from './query_processor.js';

const result = await processQuery("Can I get Bürgergeld?");

console.log(result.intent);      // "eligibility"
console.log(result.entities);    // [{type: "benefit", value: "Bürgergeld"}]
console.log(result.expanded);    // Query with synonyms added
```

**Features**:
- Intent classification (eligibility, how-to, comparison, etc.)
- Entity extraction (amounts, dates, locations, benefits)
- Query expansion with synonyms
- Multi-language support
- Query variations generation

**When to use**: Use directly when you need to analyze user queries independently of full RAG.

---

### 3. `context_builder.js` - Context Assembly

Formats retrieved documents into optimized LLM prompts.

**Main Function**: `buildContext(retrievedDocs, options)`

```javascript
import { buildContext } from './context_builder.js';

const { context, sources, stats } = await buildContext(documents, {
  maxTokens: 8000,
  rerank: true,
  query: "original query"
});

console.log(context);  // Formatted context string ready for LLM
console.log(sources);  // Source citations
console.log(stats);    // Token counts, documents used, etc.
```

**Features**:
- Reranking by multiple relevance signals
- Token-aware truncation
- Source citation formatting
- Metadata inclusion
- Optimal context size calculation

**When to use**: Use when you have retrieved documents and need to format them for an LLM prompt.

---

### 4. `answer_generator.js` - Answer Generation

Generates answers using LLMs with retrieved context.

**Main Function**: `generateAnswer(question, context, options)`

```javascript
import { generateAnswer } from './answer_generator.js';

const result = await generateAnswer(question, contextString, {
  sources: sourceList,
  audience: 'simple',  // or 'general' or 'technical'
  includeFollowUp: true
});

console.log(result.answer);             // Answer with citations
console.log(result.confidence);         // Confidence score
console.log(result.followUpQuestions);  // Suggested follow-ups
```

**Features**:
- Multiple audience levels (simple, general, technical)
- Citation injection and validation
- Structured JSON output support
- Quality validation
- Follow-up question generation

**When to use**: Use when you have formatted context and need to generate an answer.

---

## 🚀 Quick Start

### Basic Usage

```javascript
import { answerQuestion } from './services/_shared/rag/rag_pipeline.js';

// Simple question answering
const result = await answerQuestion("What is Bürgergeld?");

console.log(result.answer);
console.log('Sources:', result.sources.map(s => s.title));
console.log('Confidence:', result.confidence);
```

### Customized Pipeline

```javascript
const result = await answerQuestion(
  "How do I apply for Wohngeld?",
  {
    topK: 15,                    // Retrieve more documents
    audience: 'simple',          // Use simple language
    includeFollowUp: true,       // Generate follow-up questions
    model: 'gpt-4o',            // Use GPT-4o for quality
    temperature: 0.2,            // Very factual
  }
);
```

### Batch Processing

```javascript
import { answerQuestions } from './services/_shared/rag/rag_pipeline.js';

const questions = [
  "What is Bürgergeld?",
  "Who is eligible?",
  "How do I apply?"
];

const results = await answerQuestions(questions, {
  audience: 'simple'
});
```

---

## ⚙️ Configuration Options

### Query Processing Options
- `expandQuery` (boolean): Add synonyms for better recall
- `extractEntities` (boolean): Extract structured information
- `useLLM` (boolean): Use LLM for advanced query understanding

### Retrieval Options
- `topK` (number): Number of documents to retrieve (default: 10)
- `minSimilarity` (number): Minimum relevance threshold (default: 0.7)
- `rerank` (boolean): Rerank results for quality (default: true)

### Context Options
- `contextTokens` (number): Maximum context tokens (auto-calculated if null)
- `includeMetadata` (boolean): Include source metadata (default: true)

### Generation Options
- `temperature` (number): Randomness 0-1 (default: 0.3 for factual)
- `maxTokens` (number): Maximum response length (default: 1000)
- `model` (string): LLM model (default: 'gpt-4o-mini')
- `audience` (string): 'general', 'simple', or 'technical'
- `includeFollowUp` (boolean): Generate follow-up questions

---

## 📊 Performance Metrics

Typical performance (GPT-4o-mini):
- **Query Processing**: ~50-100ms
- **Retrieval**: ~100-300ms
- **Context Building**: ~50-100ms
- **Generation**: ~1-3 seconds
- **Total**: ~1.5-3.5 seconds

Cost per query (approximate):
- **GPT-4o-mini**: ~$0.0001-0.001
- **GPT-4o**: ~$0.001-0.01

---

## 🎓 Educational Notes

Each module includes extensive "LEARNING NOTE" comments explaining:
- **Why** design decisions were made
- **When** to use different approaches
- **How** techniques work under the hood
- **Trade-offs** between different strategies

These modules are designed for learning, so dive into the code to understand RAG deeply!

---

## 🔧 Advanced Usage

### Custom Search Client

```javascript
import { SemanticSearch } from '../embeddings/semantic_search.js';

const searchClient = new SemanticSearch({
  storePath: './custom-vectors.json'
});

const result = await answerQuestion(question, { searchClient });
```

### Structured Output

```javascript
import { generateStructuredAnswer } from './answer_generator.js';

const schema = {
  type: 'object',
  properties: {
    eligible: { type: 'boolean' },
    requirements: { type: 'array', items: { type: 'string' } },
    amount: { type: 'number' }
  }
};

const structured = await generateStructuredAnswer(question, context, schema);
// Returns: { eligible: true, requirements: [...], amount: 563 }
```

### Pipeline Monitoring

```javascript
import { getPipelineStats } from './rag_pipeline.js';

const results = await answerQuestions(testQuestions);
const stats = getPipelineStats(results);

console.log('Average latency:', stats.avgLatency, 'ms');
console.log('High confidence:', stats.confidenceDistribution.high);
console.log('Total cost:', stats.totalCost);
```

---

## 🐛 Error Handling

```javascript
const result = await answerQuestion(question);

// Check confidence
if (result.confidence === 'low') {
  console.warn('Low confidence - may need verification');
}

// Check validation
if (!result.validation.passed) {
  console.warn('Quality issues:', result.validation.warnings);
}

// Check for errors
if (result.metadata.error) {
  console.error('Pipeline error:', result.metadata.error);
}
```

---

## 🔗 Dependencies

These RAG modules integrate with:
- `../llm/llm_client.js` - LLM API interactions
- `../llm/prompts.js` - Prompt templates
- `../llm/token_utils.js` - Token counting
- `../embeddings/semantic_search.js` - Document retrieval
- `../embeddings/vector_store.js` - Vector storage

---

## 📚 Further Reading

**RAG Concepts**:
- [Retrieval-Augmented Generation Paper](https://arxiv.org/abs/2005.11401)
- [OpenAI RAG Guide](https://platform.openai.com/docs/guides/retrieval-augmented-generation)

**Prompt Engineering**:
- [OpenAI Prompt Engineering Guide](https://platform.openai.com/docs/guides/prompt-engineering)
- [Anthropic Prompt Library](https://docs.anthropic.com/claude/prompt-library)

**Vector Search**:
- [Understanding Embeddings](https://platform.openai.com/docs/guides/embeddings)
- [Semantic Search Best Practices](https://www.pinecone.io/learn/semantic-search/)

---

## 🎯 Use Cases

### 1. Customer Support Bot
```javascript
// Answer questions about products/services
const result = await answerQuestion(
  "How do I return a product?",
  { audience: 'simple', includeFollowUp: true }
);
```

### 2. Documentation Q&A
```javascript
// Help developers find information in docs
const result = await answerQuestion(
  "How do I configure authentication?",
  { audience: 'technical', contextTokens: 12000 }
);
```

### 3. FAQ Generation
```javascript
// Generate FAQ from common questions
const faqs = await answerQuestions(commonQuestions, {
  audience: 'simple',
  includeFollowUp: false
});
```

### 4. Research Assistant
```javascript
// Answer research questions with citations
const result = await answerQuestion(
  "What are the latest findings on climate change?",
  { topK: 20, contextTokens: 15000, model: 'gpt-4o' }
);
```

---

## 💡 Tips & Best Practices

1. **Start with defaults**: They're tuned for good balance of quality/speed/cost

2. **Adjust topK based on need**:
   - Simple questions: topK=5-7
   - Complex questions: topK=10-15
   - Research queries: topK=15-20

3. **Choose audience level**:
   - `simple`: General public, non-technical users
   - `general`: Balanced for most use cases
   - `technical`: Domain experts, detailed explanations

4. **Monitor confidence**:
   - High: Use answer as-is
   - Medium: May need review
   - Low: Escalate to human or ask user to rephrase

5. **Cost optimization**:
   - Use `gpt-4o-mini` for most queries
   - Use `gpt-4o` only when quality is critical
   - Reduce `contextTokens` if cost is a concern

6. **Quality optimization**:
   - Enable `rerank` for better results
   - Use `expandQuery` for better recall
   - Set low `temperature` (0.1-0.3) for factual queries

---

## 🤝 Contributing

When extending these modules:

1. **Keep educational comments**: This is a learning project
2. **Add usage examples**: Show how new features work
3. **Document trade-offs**: Explain why design choices were made
4. **Test thoroughly**: Ensure quality doesn't regress
5. **Measure performance**: Profile before and after changes

---

## 📄 License

Part of the Systemfehler project. See main LICENSE file for details.
