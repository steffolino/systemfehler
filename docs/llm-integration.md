# LLM Integration

Systemfehler has a provider-neutral LLM adapter for guided search. The default
runtime remains conservative: if no provider is configured, answer generation
falls back to source-cited extractive answers and deterministic guards.

## Current Runtime Contract

Set `LLM_PROVIDER` to select the runtime provider:

| Provider | Required env | Notes |
|---|---|---|
| `none` | none | disables external LLM calls; deterministic fallbacks only |
| `workers-ai` | Cloudflare Pages `AI` binding | keeps the existing Workers AI path |
| `mistral` | `MISTRAL_API_KEY` | calls Mistral's chat completions API |
| `scaleway` | `LLM_BASE_URL`, optional `LLM_API_KEY` | OpenAI-compatible chat completions endpoint |
| `openai-compatible` | `LLM_BASE_URL`, optional `LLM_API_KEY` | generic compatible endpoint |
| `local` | `LLM_BASE_URL`, optional `LLM_API_KEY` | local/self-hosted compatible endpoint |

If `LLM_PROVIDER` is omitted, the runtime uses `workers-ai` only when the
Cloudflare `AI` binding is present; otherwise it behaves as `none`.

Shared model configuration uses:

```text
LLM_MODEL
```

Task-specific overrides are optional:

| Task | Environment variable | Used for |
|---|---|---|
| default | `LLM_MODEL` | shared fallback model |
| rewrite | `LLM_MODEL_REWRITE` | search-query rewrite |
| synthesize | `LLM_MODEL_SYNTHESIZE` | standard answer generation |
| plain_language | `LLM_MODEL_PLAIN_LANGUAGE` | Einfache-Sprache answer generation |
| chat_rewrite | `LLM_MODEL_CHAT_REWRITE` | turning chat history into a standalone query |
| enrich | `LLM_MODEL_ENRICH` | metadata enrichment endpoint placeholder |

Provider-specific model variables are still supported:

- Workers AI: `CF_AI_MODEL`, `CF_AI_MODEL_REWRITE`,
  `CF_AI_MODEL_SYNTHESIZE`, `CF_AI_MODEL_PLAIN_LANGUAGE`,
  `CF_AI_MODEL_CHAT_REWRITE`, `CF_AI_MODEL_ENRICH`
- Mistral: `MISTRAL_MODEL`, `MISTRAL_MODEL_REWRITE`,
  `MISTRAL_MODEL_SYNTHESIZE`, `MISTRAL_MODEL_PLAIN_LANGUAGE`,
  `MISTRAL_MODEL_CHAT_REWRITE`, `MISTRAL_MODEL_ENRICH`

For Mistral, the default model is `mistral-small-latest` unless overridden.
`MISTRAL_BASE_URL` can override the default `https://api.mistral.ai/v1`.

The `/api/ai/health` response exposes the resolved model configuration under
`provider.modelConfig`.

## Mistral Preview

Use this for a low-cost EU-provider preview:

```text
LLM_PROVIDER=mistral
MISTRAL_API_KEY=...
MISTRAL_MODEL_SYNTHESIZE=mistral-small-latest
MISTRAL_MODEL_PLAIN_LANGUAGE=mistral-small-latest
```

Keep `LLM_PROVIDER` unset or set to `none` in production until the preview evals
pass.

## Selection Criteria

Before activating a new model, evaluate it against:

- grounded answers with source citations,
- German social-service language,
- Einfache Sprache without childish tone,
- JSON/format stability where structured output is required,
- latency, provider cost, and quota behavior,
- regression cases in `tests/fixtures/answer_quality_cases.json`.

## Safe Rollout

1. Set `LLM_PROVIDER=mistral` only in preview.
2. Run `npm run eval:answers` against the preview endpoint.
3. Compare latency, citations, and `answer_quality`.
4. Promote the provider and model env vars to production only after the reviewed
   cases pass.

Do not enable a new model globally until the task-specific preview has passed.
