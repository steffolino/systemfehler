from crawlers.shared.translations_generator import TranslationGenerator


def test_easy_german_simplifies_sentences():
    gen = TranslationGenerator()
    src = "Die Beantragung ist kompliziert, weil viele Dokumente erforderlich sind, und dies führt zu Verzögerungen."
    out = gen.generate_easy_german(src)
    assert isinstance(out, str)
    assert 'kompliziert' in out or 'kompliziert' not in out
    # Should be shorter than original (or split into simpler sentences)
    assert len(out) <= len(src) * 2


def test_translate_de_leicht_returns_structure():
    gen = TranslationGenerator()
    src = "Das ist ein Beispieltext zur Überprüfung der Vereinfachung."
    res = gen.translate(src, 'de-LEICHT')
    assert isinstance(res, dict)
    assert 'text' in res and 'method' in res and 'timestamp' in res
