# LLM Client Module

This module provides a comprehensive, educational interface for working with Large Language Model APIs (OpenAI, etc.) in the Systemfehler project.

## 🎓 Learning Goals

This module is designed for hands-on learning. It includes:
- **Extensive comments** explaining every concept
- **Real-world error handling** with clear messages
- **Cost tracking** to understand API expenses
- **Rate limiting** to prevent budget overruns
- **Production-ready patterns** you can use in real projects

## 📁 Files

- **`llm_client.js`** - Core client implementation (1,700+ lines with extensive documentation)
- **`llm_config.js`** - Configuration management with environment variables
- **`token_utils.js`** - Token counting and cost calculation utilities
- **`test_llm_client.js`** - Test suite demonstrating usage

## 🚀 Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure API Keys

Create a `.env` file in the project root:

```bash
# Required: Get your API key from https://platform.openai.com/api-keys
OPENAI_API_KEY=sk-...

# Optional: For development without API costs
USE_MOCK_LLM=true
```

### 3. Basic Usage

```javascript
import { createChatCompletion } from './services/_shared/llm/llm_client.js';

const messages = [
  { 
    role: 'system', 
    content: 'You are a helpful assistant for German social services.' 
  },
  { 
    role: 'user', 
    content: 'What documents do I need to apply for Bürgergeld?' 
  }
];

const response = await createChatCompletion(messages);
console.log(response.content);
console.log(`Cost: $${response.cost.toFixed(4)}`);
```

## 📚 Key Concepts

### Token Counting

Tokens are the basic units LLMs process. Understanding tokens is crucial for:
- **Cost**: You pay per token (~$0.15 per 1M tokens for GPT-4o-mini)
- **Limits**: Models have maximum context windows (128k tokens for GPT-4o)
- **Speed**: More tokens = slower responses

```javascript
import { countTokens, countMessageTokens } from './token_utils.js';

const text = "Hello, world!";
console.log(countTokens(text)); // 4 tokens

const messages = [
  { role: 'system', content: 'You are helpful.' },
  { role: 'user', content: 'Hello!' }
];
console.log(countMessageTokens(messages)); // ~15 tokens (includes overhead)
```

### Rate Limiting

The client implements token bucket rate limiting to prevent:
- Exceeding API provider limits (429 errors)
- Unexpected cost overruns
- Overwhelming downstream systems

```javascript
// Configured in llm_config.js
MAX_REQUESTS_PER_MINUTE=50
MAX_REQUESTS_PER_DAY=10000
MAX_CONCURRENT_REQUESTS=5
```

### Cost Tracking

Every API call is automatically tracked to a JSONL file:

```javascript
// data/_quality/llm_costs.jsonl
{"timestamp":"2024-01-16T09:05:29.533Z","model":"gpt-4o-mini","inputTokens":27,"outputTokens":24,"cost":0.000018}
```

Check your spending:

```javascript
import { getStatus } from './llm_client.js';

const status = await getStatus();
console.log(`Daily: ${status.costs.daily}`);
console.log(`Monthly: ${status.costs.monthly}`);
```

### Error Handling

The module provides specific error types for different failures:

```javascript
import { 
  createChatCompletion,
  AuthenticationError,
  RateLimitError,
  ContextLengthError
} from './llm_client.js';

try {
  const response = await createChatCompletion(messages);
} catch (error) {
  if (error instanceof AuthenticationError) {
    // Fix: Check your API key in .env
    console.error('Invalid API key');
  } else if (error instanceof RateLimitError) {
    // Fix: Wait and retry (automatic with exponential backoff)
    console.error(`Rate limited. Retry after ${error.retryAfter}s`);
  } else if (error instanceof ContextLengthError) {
    // Fix: Reduce input size or use model with larger context
    console.error('Input too long for model');
  }
}
```

## 🔧 Advanced Features

### Streaming Responses

Stream tokens as they're generated for better UX:

```javascript
import { createStreamingCompletion } from './llm_client.js';

const stream = await createStreamingCompletion(messages);

for await (const chunk of stream) {
  if (chunk.content) {
    process.stdout.write(chunk.content); // Real-time output
  }
  
  if (chunk.isComplete) {
    console.log(`\nTokens: ${chunk.usage.outputTokens}`);
    console.log(`Cost: $${chunk.cost.toFixed(4)}`);
  }
}
```

### Mock Mode (Development)

Test without API costs:

```bash
USE_MOCK_LLM=true node your_script.js
```

Mock mode:
- ✅ No API costs
- ✅ No API key required
- ✅ Instant responses
- ✅ Works offline
- ❌ Not real AI (returns echoed input)

### Custom Client Configuration

Create a client with custom settings:

```javascript
import { LLMClient } from './llm_client.js';

const client = new LLMClient({
  ...llmConfig,
  parameters: {
    temperature: 0.1, // More deterministic
    maxTokens: 2000,  // Longer responses
  },
  rateLimit: {
    requestsPerMinute: 10, // Lower rate
    maxConcurrent: 2,
  }
});

const response = await client.createChatCompletion(messages);
```

## 📖 Complete Examples

### Example 1: Simple Q&A

```javascript
import { createChatCompletion } from './llm_client.js';

const messages = [
  { role: 'system', content: 'You are a helpful assistant.' },
  { role: 'user', content: 'What is 2+2?' }
];

const response = await createChatCompletion(messages);
console.log(response.content); // "2+2 equals 4."
```

### Example 2: Multi-turn Conversation

```javascript
import { createChatCompletion } from './llm_client.js';

const conversation = [
  { role: 'system', content: 'You are a German tutor.' }
];

// Turn 1
conversation.push({ 
  role: 'user', 
  content: 'How do I say "thank you" in German?' 
});

let response = await createChatCompletion(conversation);
conversation.push({ 
  role: 'assistant', 
  content: response.content 
});

// Turn 2 - context is maintained
conversation.push({ 
  role: 'user', 
  content: 'What about the informal version?' 
});

response = await createChatCompletion(conversation);
console.log(response.content); // Knows we're talking about "thank you"
```

### Example 3: With Cost Estimation

```javascript
import { estimateCost, formatCost } from './token_utils.js';
import { createChatCompletion } from './llm_client.js';

const messages = [...];

// Estimate before calling
const estimate = estimateCost(messages, 500, 'gpt-4o');
console.log(`Estimated cost: ${formatCost(estimate)}`);

if (estimate > 0.01) {
  console.warn('This is expensive! Consider gpt-4o-mini instead.');
}

const response = await createChatCompletion(messages, { 
  model: 'gpt-4o-mini' 
});
console.log(`Actual cost: ${formatCost(response.cost)}`);
```

### Example 4: Text Truncation

```javascript
import { truncateToTokenLimit, countTokens } from './token_utils.js';
import { createChatCompletion } from './llm_client.js';

let longDocument = '...'; // Very long text

console.log(`Original: ${countTokens(longDocument)} tokens`);

// Truncate to fit in context
longDocument = truncateToTokenLimit(longDocument, 1000, 'end');

console.log(`Truncated: ${countTokens(longDocument)} tokens`);

const messages = [
  { role: 'system', content: 'Summarize this document.' },
  { role: 'user', content: longDocument }
];

const response = await createChatCompletion(messages);
console.log(response.content);
```

## ⚙️ Configuration

All configuration is centralized in `llm_config.js` and loaded from environment variables.

Key settings in `.env`:

```bash
# API Keys
OPENAI_API_KEY=sk-...

# Model Selection
DEFAULT_LLM_MODEL=gpt-4o-mini
ADVANCED_LLM_MODEL=gpt-4o

# Cost Controls
MAX_MONTHLY_COST=50.0
MAX_DAILY_COST=10.0

# Rate Limits
MAX_REQUESTS_PER_MINUTE=50
MAX_REQUESTS_PER_DAY=10000

# Model Parameters
DEFAULT_TEMPERATURE=0.7
DEFAULT_MAX_TOKENS=1000

# Features
ENABLE_STREAMING=true
USE_MOCK_LLM=false

# Logging
LLM_LOG_LEVEL=info
LOG_PROMPTS=false
LOG_COMPLETIONS=false
LOG_TOKEN_USAGE=true
LOG_COSTS=true
```

See `.env.example` for all available options.

## 🧪 Testing

Run the test suite:

```bash
# With mock mode (no API costs)
USE_MOCK_LLM=true node services/_shared/llm/test_llm_client.js

# With real API (requires OPENAI_API_KEY)
USE_MOCK_LLM=false node services/_shared/llm/test_llm_client.js
```

## 💰 Cost Optimization Tips

1. **Choose the right model**
   - `gpt-4o-mini`: 10x cheaper, good for most tasks
   - `gpt-4o`: Use only for complex reasoning

2. **Optimize prompts**
   - Shorter prompts = lower cost
   - Be specific but concise
   - Remove unnecessary context

3. **Use caching** (future feature)
   - Cache identical requests
   - Saves money and improves speed

4. **Monitor spending**
   - Check `data/_quality/llm_costs.jsonl`
   - Set budget alerts in config
   - Analyze expensive operations

5. **Batch operations**
   - Process multiple items in one request when possible
   - Use lower temperature for deterministic tasks (0.1-0.3)

## 🐛 Troubleshooting

### "Invalid API key"

```bash
# Check your .env file
cat .env | grep OPENAI_API_KEY

# Get a new key from:
https://platform.openai.com/api-keys
```

### "Rate limit exceeded"

```bash
# Option 1: Wait and retry (automatic with exponential backoff)
# Option 2: Increase limits in .env
MAX_REQUESTS_PER_MINUTE=100

# Option 3: Upgrade your OpenAI plan
```

### "Context length exceeded"

```javascript
// Option 1: Truncate input
import { truncateToTokenLimit } from './token_utils.js';
text = truncateToTokenLimit(text, 4000);

// Option 2: Use model with larger context
const response = await createChatCompletion(messages, {
  model: 'gpt-4-turbo' // 128k context window
});

// Option 3: Summarize first
const summary = await createChatCompletion([
  { role: 'system', content: 'Summarize this briefly.' },
  { role: 'user', content: longText }
]);
```

### "Network error"

```bash
# Check internet connection
curl https://api.openai.com

# Check OpenAI status
https://status.openai.com

# Check firewall/proxy settings
```

## 📚 Additional Resources

### OpenAI Documentation
- [API Reference](https://platform.openai.com/docs/api-reference)
- [Best Practices](https://platform.openai.com/docs/guides/production-best-practices)
- [Prompt Engineering Guide](https://platform.openai.com/docs/guides/prompt-engineering)
- [Rate Limits](https://platform.openai.com/docs/guides/rate-limits)

### Tools
- [Token Counter](https://platform.openai.com/tokenizer) - Count tokens in your text
- [Model Comparison](https://platform.openai.com/docs/models) - Compare models
- [Pricing Calculator](https://openai.com/pricing) - Estimate costs

### This Project
- `llm_config.js` - Configuration documentation
- `token_utils.js` - Token utilities documentation
- `llm_client.js` - Implementation with 1,700+ lines of teaching comments

## 🤝 Contributing

This is a learning project. When adding features:

1. **Add extensive comments** explaining concepts
2. **Include usage examples** in comments
3. **Handle errors gracefully** with helpful messages
4. **Write tests** demonstrating the feature
5. **Update this README** with new examples

## 📝 License

See LICENSE file in project root.

## 🙏 Acknowledgments

This module is designed for hands-on learning and educational purposes. It demonstrates production-ready patterns while maintaining extensive documentation for learning.

Key patterns demonstrated:
- Facade pattern (unified interface)
- Singleton pattern (default client)
- Token bucket rate limiting
- Exponential backoff retry logic
- Structured error handling
- Cost tracking and monitoring
- Streaming responses with async iterators
- Mock mode for development

---

**Questions?** Read the extensive inline comments in `llm_client.js` - they explain every concept in detail!
