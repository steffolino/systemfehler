# LLM Integration Preparation

Systemfehler can use Cloudflare Workers AI through the Pages `AI` binding. The
model has not been selected as a product decision yet. The runtime is prepared
so different tasks can use different models once the model choice is approved.

## Current Runtime Contract

If no task-specific model is configured, all Workers AI calls use:

```text
CF_AI_MODEL
```

If `CF_AI_MODEL` is not set, the code falls back to the existing default model.

Task-specific overrides are optional:

| Task | Environment variable | Used for |
|---|---|---|
| default | `CF_AI_MODEL` | shared fallback model |
| rewrite | `CF_AI_MODEL_REWRITE` | search-query rewrite |
| synthesize | `CF_AI_MODEL_SYNTHESIZE` | standard answer generation |
| plain_language | `CF_AI_MODEL_PLAIN_LANGUAGE` | Einfache-Sprache answer generation |
| chat_rewrite | `CF_AI_MODEL_CHAT_REWRITE` | turning chat history into a standalone query |
| enrich | `CF_AI_MODEL_ENRICH` | metadata enrichment endpoint placeholder |

The `/api/ai/health` response exposes the resolved model configuration under
`provider.modelConfig`.

## Selection Criteria

Before activating a new model, evaluate it against:

- grounded answers with source citations,
- German social-service language,
- Einfache Sprache without childish tone,
- JSON/format stability where structured output is required,
- latency and quota behavior on Cloudflare,
- regression cases in `tests/fixtures/answer_quality_cases.json`.

## Safe Rollout

1. Set only one task-specific env var in preview, for example
   `CF_AI_MODEL_PLAIN_LANGUAGE`.
2. Run `npm run eval:answers` against the preview endpoint.
3. Compare latency, citations, and `answer_quality`.
4. Promote the env var to production only after the reviewed cases pass.

Do not enable a new model globally until the task-specific preview has passed.
