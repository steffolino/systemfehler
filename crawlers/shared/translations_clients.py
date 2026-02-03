"""Pluggable adapters for LLM and MT services.

This module provides lightweight wrappers that TranslationGenerator can use.
Implementations are optional and will fail gracefully if required libraries
or credentials are not present.
"""
import os
from typing import Optional


def openai_llm_call_factory():
    """Return a callable(text, instructions) -> str using OpenAI if available.

    Requires environment variable `OPENAI_API_KEY` and the `openai` package.
    If unavailable, returns None.
    """
    try:
        import openai
    except Exception:
        return None

    api_key = os.environ.get('OPENAI_API_KEY')
    if not api_key:
        return None
    openai.api_key = api_key

    def llm_call(text: str, instructions: str) -> str:
        prompt = f"{instructions}\n\nText:\n{text}"
        resp = openai.ChatCompletion.create(
            model=os.environ.get('OPENAI_MODEL', 'gpt-4o-mini'),
            messages=[{"role": "user", "content": prompt}],
            max_tokens=800,
            temperature=0.0,
        )
        return resp['choices'][0]['message']['content'].strip()

    return llm_call


def dummy_mt_call(text: str, target_lang: str) -> str:
    """Placeholder MT call that returns the input with a language tag.

    This lets the pipeline run without real MT credentials during tests.
    """
    return f"[{target_lang}] {text}"


def mt_call_factory(preferred='dummy'):
    if preferred == 'openai' or preferred == 'google':
        # real MT hooks would be added here; not implemented by default
        return None
    return dummy_mt_call
