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


def huggingface_mt_call_factory(model_name: Optional[str] = None):
    """Return an MT callable using Hugging Face Marian/AutoModel if available.

    If the `transformers` package or model is unavailable, returns None.
    """
    try:
        from transformers import AutoTokenizer, AutoModelForSeq2SeqLM
    except Exception:
        return None

    # Default to Helsinki-NLP Marian models for many language pairs when not provided.
    # Caller may set MODEL env var or pass model_name.
    model_name = model_name or os.environ.get('HF_MT_MODEL')
    if not model_name:
        # No default single model for de-LEICHT; use a generic en-de model if needed
        model_name = 'Helsinki-NLP/opus-mt-en-de'

    try:
        tokenizer = AutoTokenizer.from_pretrained(model_name)
        model = AutoModelForSeq2SeqLM.from_pretrained(model_name)
    except Exception:
        return None

    def mt_call(text: str, target_lang: str) -> str:
        # This naive wrapper ignores target_lang and uses the model as-is.
        inputs = tokenizer(text, return_tensors='pt', truncation=True)
        outputs = model.generate(**inputs, max_length=512)
        return tokenizer.decode(outputs[0], skip_special_tokens=True)

    return mt_call


def local_llm_call_factory(model_name: Optional[str] = None):
    """Return a simple local LLM text-generation callable using transformers pipeline.

    Uses small text2text models like `google/flan-t5-small` by default if available.
    Returns None if `transformers` isn't installed or model cannot be loaded.
    """
    try:
        from transformers import pipeline
    except Exception:
        return None

    model_name = model_name or os.environ.get('HF_LLM_MODEL') or 'google/flan-t5-small'
    try:
        gen = pipeline('text2text-generation', model=model_name)
    except Exception:
        return None

    def llm_call(text: str, instructions: str) -> str:
        prompt = f"{instructions}\n\n{text}"
        out = gen(prompt, max_length=512)
        if isinstance(out, list) and len(out) > 0 and 'generated_text' in out[0]:
            return out[0]['generated_text'].strip()
        # Fallback
        return str(out)

    return llm_call


def mt_call_factory(preferred='huggingface'):
    """Factory selector for MT callables. Tries huggingface then dummy fallback."""
    if preferred == 'huggingface':
        hf = huggingface_mt_call_factory()
        if hf:
            return hf
    # fall back to dummy
    return dummy_mt_call
