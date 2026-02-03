"""Prototype translation and Easy German generation utilities.

This is a minimal, configurable generator intended as a starting point:
- Rule-based simplifier for Easy German (`de-LEICHT`).
- Placeholder hooks for MT/LLM integrations (pluggable functions).

It intentionally avoids external API calls; integration points are provided
so real MT/LLM clients can be wired in later.
"""
from typing import Callable, Optional
import re
import datetime


class TranslationGenerator:
    def __init__(self, llm_call: Optional[Callable[[str, str], str]] = None,
                 mt_call: Optional[Callable[[str, str], str]] = None):
        """Initialize generator with optional external hooks.

        Args:
            llm_call: callable(text, instructions) -> str for LLM-based rewriting
            mt_call: callable(text, target_lang) -> str for machine translation
        """
        self.llm_call = llm_call
        self.mt_call = mt_call

    def generate_easy_german(self, text: str) -> str:
        """Apply simple, deterministic transformations to produce an Easy German draft.

        This is deliberately conservative: short sentences, simpler vocabulary,
        fewer subordinate clauses.
        """
        if not text:
            return ""

        # Normalize whitespace
        t = re.sub(r"\s+", " ", text).strip()

        # Split into sentences (very naive)
        sentences = re.split(r'(?<=[.!?])\s+', t)

        simple_sents = []
        for s in sentences:
            s = s.strip()
            if not s:
                continue
            # Reduce subordinate clauses by replacing common connectors with '.'
            s = re.sub(r"\b(obwohl|während|da|weil|damit|sodass|indem)\b", '.', s, flags=re.I)
            # Shorten long sentences by splitting on commas
            parts = [p.strip() for p in s.split(',') if p.strip()]
            if len(parts) > 2:
                s = '. '.join(parts)
            # Replace some complex words with simpler alternatives (example mapping)
            replacements = {
                'Voraussetzung': 'Bedingung',
                'beantragen': 'anfragen',
                'zuständig': 'verantwortlich',
                'einreichen': 'abgeben'
            }
            for k, v in replacements.items():
                s = re.sub(r'\b' + k + r'\b', v, s)

            # Ensure sentence ends with a period
            if not re.search(r'[.!?]$', s):
                s = s + '.'

            simple_sents.append(s)

        result = ' '.join(simple_sents)
        # Limit length for readability
        if len(result) > 2000:
            result = result[:2000].rsplit(' ', 1)[0] + '...'
        return result

    def translate(self, text: str, target_lang: str) -> dict:
        """Produce a translation object for a given target language.

        Uses `mt_call` when available for non-de-LEICHT languages, and `llm_call`
        as a fallback for `de-LEICHT` if provided.
        Returns a dict with content, method, generator and timestamp.
        """
        timestamp = datetime.datetime.utcnow().isoformat() + 'Z'
        if target_lang.lower() in ('de-leicht', 'de-leicht', 'de_leicht'):
            # Use rule-based simplifier first
            simple = self.generate_easy_german(text)
            method = 'rule'
            generator = 'rule-based-simplifier-v1'

            # If an llm_call is provided, allow it to post-edit or improve
            if self.llm_call:
                try:
                    improved = self.llm_call(simple, 'Simplify to Easy German, preserve facts')
                    if improved and isinstance(improved, str) and len(improved) > 0:
                        simple = improved
                        method = 'llm'
                        generator = 'llm-simplifier'
                except Exception:
                    pass

            return {
                'text': simple,
                'method': method,
                'generator': generator,
                'timestamp': timestamp
            }

        # Other languages: prefer MT if available
        if self.mt_call:
            try:
                translated = self.mt_call(text, target_lang)
                method = 'mt'
                generator = 'mt-service'
            except Exception:
                translated = ''
                method = 'mt-failed'
                generator = ''
        else:
            # No MT configured; return empty placeholder
            translated = ''
            method = 'none'
            generator = ''

        return {
            'text': translated,
            'method': method,
            'generator': generator,
            'timestamp': timestamp
        }


default_generator = TranslationGenerator()
