from app.services.ai_service import (
    insights_system_prompt,
    normalize_insights_locale,
)


def test_normalize_insights_locale_defaults_and_accepts_known():
    assert normalize_insights_locale(None) == "en"
    assert normalize_insights_locale(" RU ") == "ru"
    assert normalize_insights_locale("uz") == "uz"
    assert normalize_insights_locale("fr") == "en"


def test_insights_prompt_locks_output_language():
    uz = insights_system_prompt("uz")
    assert "Uzbek" in uz
    assert "Keep JSON keys in English" in uz
    ru = insights_system_prompt("ru")
    assert "Russian" in ru
    en = insights_system_prompt("en")
    assert "English" in en
