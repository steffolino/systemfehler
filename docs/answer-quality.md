# Answer Quality Workflow

This workflow checks whether generated answers are grounded, specific to the
question, and backed by useful sources. It complements the life-event retrieval
suite: retrieval can pass while the final answer is still too generic.

## Run the Local Baseline

```bash
npm run eval:answers
```

The default suite uses `tests/fixtures/answer_quality_cases.json` and the local
extractive synthesis fallback. It checks:

- expected terms that must appear in the answer,
- forbidden misleading claims,
- required source families,
- cited source count,
- unsupported answer claims,
- whether the answer is too generic for the question,
- whether the answer shape matches the question intent.

The Pages synthesis path now applies the same intent idea at runtime. If a
generated standard answer misses the expected shape for questions such as
`Wo kann ich ... beantragen?`, the API replaces it with a source-cited
extractive fallback and returns the failed guard result as `answer_guard`.

The command does not fail the build by default. Use this for CI once the
baseline is intentionally green:

```bash
node scripts/eval_answer_quality_local.mjs --fail-on-regression
```

To test a running Pages dev server instead of the local extractive fallback:

```bash
node scripts/eval_answer_quality_local.mjs --endpoint http://127.0.0.1:8788
```

## Current Baseline Finding

As of 2026-06-18, the local baseline passes the Bürgergeld, sanction, and debt
cases. It still exposes two useful gaps:

- `answer-education-voucher-001`: the top evidence does not surface a direct
  Bildungsgutschein/Umschulung source strongly enough.
- `answer-family-benefits-001`: family evidence exists, but the answer misses
  the direct application path for Elterngeld/Kindergeld.

These should be treated as source and ranking issues first, not prompt-layout
issues.

## Source Priorities

For each life event, keep a small pack of high-quality sources:

- 3 to 5 official pages for eligibility, application, deadlines, and forms.
- 2 to 4 practical help pages from trusted NGOs or public-service portals.
- 2 to 3 contact or finder routes for local support.
- 1 plain-language or FAQ source when available.

Priority additions from the current answer failures:

- `upskilling`: official Bundesagentur pages for Bildungsgutschein,
  Weiterbildung fördern, Kurssuche/KURSNET, and Beratung before application.
- `family_children`: Familienportal pages for Kindergeld, Elterngeld,
  ElterngeldDigital, Kinderzuschlag, and local Elterngeldstellen.

After adding or improving sources, rerun both:

```bash
npm run eval:answers
npm run test:life-event-suggested
```

The first command checks answer usefulness. The second makes sure source changes
did not regress scenario routing.
