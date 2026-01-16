/**
 * Simple test script for llm_client.js
 * 
 * This demonstrates basic usage and verifies the module works.
 * Run with: node services/_shared/llm/test_llm_client.js
 */

import { 
  LLMClient,
  createChatCompletion,
  getStatus,
  LLMError,
  RateLimitError,
  AuthenticationError
} from './llm_client.js';
import { formatCost } from './token_utils.js';

console.log('🧪 Testing LLM Client Module\n');

async function testMockMode() {
  console.log('1️⃣  Testing Mock Mode');
  console.log('=' .repeat(50));
  
  try {
    // Create client in mock mode
    const client = new LLMClient();
    
    const messages = [
      { role: 'system', content: 'You are a helpful assistant.' },
      { role: 'user', content: 'What is 2+2?' }
    ];
    
    console.log('Sending request in mock mode...');
    const response = await client.createChatCompletion(messages, {
      model: 'gpt-4o-mini'
    });
    
    console.log('✅ Response received:');
    console.log(`   Content: ${response.content}`);
    console.log(`   Tokens: ${response.usage.totalTokens}`);
    console.log(`   Cost: ${formatCost(response.cost)}`);
    console.log(`   Duration: ${response.duration}ms`);
    console.log();
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

async function testErrorHandling() {
  console.log('2️⃣  Testing Error Classes');
  console.log('=' .repeat(50));
  
  // Test custom error types
  try {
    throw new RateLimitError('Test rate limit error', 60);
  } catch (error) {
    if (error instanceof RateLimitError) {
      console.log('✅ RateLimitError caught correctly');
      console.log(`   Message: ${error.message}`);
      console.log(`   Retry after: ${error.retryAfter}s`);
      console.log(`   Is retryable: ${error.isRetryable}`);
    }
  }
  
  try {
    throw new AuthenticationError('Test auth error');
  } catch (error) {
    if (error instanceof AuthenticationError) {
      console.log('✅ AuthenticationError caught correctly');
      console.log(`   Is retryable: ${error.isRetryable}`);
    }
  }
  
  console.log();
}

async function testStatusReporting() {
  console.log('3️⃣  Testing Status Reporting');
  console.log('=' .repeat(50));
  
  try {
    const status = await getStatus();
    
    console.log('✅ Status retrieved:');
    console.log(`   OpenAI configured: ${status.configured.openai}`);
    console.log(`   Mock mode: ${status.configured.mockMode}`);
    console.log(`   Default model: ${status.models.default}`);
    console.log(`   Rate limit - Available: ${status.rateLimit.minuteTokensAvailable} requests/min`);
    console.log(`   Rate limit - Concurrent: ${status.rateLimit.currentConcurrent}/${status.rateLimit.maxConcurrent}`);
    console.log(`   Daily cost: ${status.costs.daily}`);
    console.log(`   Monthly cost: ${status.costs.monthly}`);
    console.log();
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

async function testConvenienceFunctions() {
  console.log('4️⃣  Testing Convenience Functions');
  console.log('=' .repeat(50));
  
  try {
    const messages = [
      { role: 'system', content: 'You are a math tutor.' },
      { role: 'user', content: 'Explain addition in simple terms.' }
    ];
    
    console.log('Testing createChatCompletion()...');
    const response = await createChatCompletion(messages);
    
    console.log('✅ Convenience function works:');
    console.log(`   Content length: ${response.content.length} chars`);
    console.log(`   Cost: ${formatCost(response.cost)}`);
    console.log();
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

async function testMultipleCalls() {
  console.log('5️⃣  Testing Rate Limiting with Multiple Calls');
  console.log('=' .repeat(50));
  
  try {
    const client = new LLMClient();
    
    console.log('Making 3 rapid requests...');
    
    for (let i = 1; i <= 3; i++) {
      const messages = [
        { role: 'user', content: `Request ${i}` }
      ];
      
      const start = Date.now();
      const response = await client.createChatCompletion(messages);
      const duration = Date.now() - start;
      
      console.log(`   Request ${i}: ✅ (${duration}ms)`);
    }
    
    console.log('✅ All requests completed successfully');
    console.log();
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

// Run all tests
async function runTests() {
  try {
    await testMockMode();
    await testErrorHandling();
    await testStatusReporting();
    await testConvenienceFunctions();
    await testMultipleCalls();
    
    console.log('=' .repeat(50));
    console.log('✅ All tests completed!');
    console.log('\n💡 Tips:');
    console.log('   - Set USE_MOCK_LLM=false to test with real API');
    console.log('   - Set OPENAI_API_KEY in .env to use OpenAI');
    console.log('   - Check data/_quality/llm_costs.jsonl for cost tracking');
    
  } catch (error) {
    console.error('❌ Test suite failed:', error);
    process.exit(1);
  }
}

runTests();
