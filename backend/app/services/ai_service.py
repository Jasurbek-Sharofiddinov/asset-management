import json
import logging
import re
import httpx
from app.config import settings

logger = logging.getLogger(__name__)

CATEGORIES = ["IT", "OFFICE", "SECURITY", "NETWORKING", "PRINTING", "SERVER", "MOBILE", "FURNITURE", "OTHER"]


def _get_api_config() -> tuple[str, str, str]:
    """Return (api_url, api_key, model) — prefer Groq if configured, else Grok."""
    if settings.GROQ_API_KEY:
        return settings.GROQ_API_URL, settings.GROQ_API_KEY, settings.GROQ_MODEL
    if settings.GROK_API_KEY and settings.GROK_API_KEY != "your-grok-api-key-here":
        return settings.GROK_API_URL, settings.GROK_API_KEY, settings.GROK_MODEL
    raise ValueError("No AI API key configured. Set GROQ_API_KEY or GROK_API_KEY in .env")


def _clean_json(text: str) -> str:
    """Strip markdown code fences and extract JSON."""
    text = text.strip()
    # Remove ```json ... ``` or ``` ... ```
    m = re.search(r"```(?:json)?\s*\n?(.*?)```", text, re.DOTALL)
    if m:
        return m.group(1).strip()
    return text


async def call_llm(system_prompt: str, user_prompt: str, max_tokens: int = 1024) -> str:
    """Call the configured LLM API (Groq or Grok)."""
    api_url, api_key, model = _get_api_config()

    async with httpx.AsyncClient(timeout=60.0) as client:
        response = await client.post(
            api_url,
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            },
            json={
                "model": model,
                "messages": [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt},
                ],
                "max_tokens": max_tokens,
                "temperature": 0.3,
            },
        )
        response.raise_for_status()
        data = response.json()
        return data["choices"][0]["message"]["content"]


async def recommend_category(name: str, brand: str = "", model: str = "", asset_type: str = "", description: str = "") -> dict:
    system_prompt = f"""You are an asset management expert for a banking institution.
Given asset information, recommend the most appropriate category from this list: {', '.join(CATEGORIES)}.

Respond with ONLY a JSON object:
{{"category": "CATEGORY_NAME", "confidence": 0.95, "reason": "Brief reason"}}"""

    user_prompt = f"Asset: {name}"
    if brand: user_prompt += f", Brand: {brand}"
    if model: user_prompt += f", Model: {model}"
    if asset_type: user_prompt += f", Type: {asset_type}"
    if description: user_prompt += f", Description: {description}"

    try:
        result = await call_llm(system_prompt, user_prompt, max_tokens=150)
        return json.loads(_clean_json(result))
    except Exception as e:
        logger.exception("AI category recommendation failed: %s", e)
        return {"category": "OTHER", "confidence": 0.0, "reason": "AI unavailable"}


INSIGHT_LOCALES = frozenset({"en", "ru", "uz"})
INSIGHT_LANGUAGE_NAMES = {
    "en": "English",
    "ru": "Russian",
    "uz": "Uzbek",
}
_INSIGHT_UNAVAILABLE = {
    "en": {
        "summary": "AI insights unavailable",
        "error": "AI service unavailable",
    },
    "ru": {
        "summary": "AI-аналитика недоступна",
        "error": "Сервис ИИ недоступен",
    },
    "uz": {
        "summary": "AI tahlili mavjud emas",
        "error": "AI xizmati mavjud emas",
    },
}


def normalize_insights_locale(locale: str | None) -> str:
    value = (locale or "en").strip().lower()
    return value if value in INSIGHT_LOCALES else "en"


def insights_system_prompt(locale: str = "en") -> str:
    language = INSIGHT_LANGUAGE_NAMES[normalize_insights_locale(locale)]
    return f"""You are a senior asset management analyst at a bank. Analyze the provided asset data and generate actionable insights.

Respond with ONLY a JSON object:
{{
  "summary": "One paragraph overview of the asset portfolio health",
  "highlights": ["highlight 1", "highlight 2", "highlight 3"],
  "risks": ["risk 1", "risk 2"],
  "recommendations": ["action 1", "action 2", "action 3"]
}}

Write every human-readable string (summary, highlights, risks, recommendations) in {language}.
Keep JSON keys in English. Write numbers as digits.
Be specific with numbers. Keep each item to 1-2 sentences. Focus on actionable intelligence."""


async def generate_insights(analytics_data: dict, locale: str = "en") -> dict:
    locale = normalize_insights_locale(locale)
    system_prompt = insights_system_prompt(locale)
    user_prompt = f"Asset Portfolio Data:\n{json.dumps(analytics_data, indent=2, default=str)}"

    try:
        result = await call_llm(system_prompt, user_prompt, max_tokens=800)
        return json.loads(_clean_json(result))
    except Exception as e:
        logger.exception("AI insights generation failed: %s", e)
        fallback = _INSIGHT_UNAVAILABLE[locale]
        return {
            "summary": fallback["summary"],
            "highlights": [],
            "risks": [],
            "recommendations": [],
            "error": fallback["error"],
        }


async def predict_needs(analytics_data: dict) -> dict:
    system_prompt = """You are a predictive analytics expert for bank asset management. Based on the current asset data, predict what will be needed in the next 3-6 months.

Respond with ONLY a JSON object:
{
  "predicted_purchases": [
    {"category": "IT", "quantity": 5, "reason": "Why this is needed", "urgency": "high", "estimated_budget": 25000}
  ],
  "maintenance_forecast": [
    {"description": "What maintenance to expect", "timeline": "When", "affected_count": 10}
  ],
  "staffing_impact": "Brief note on how asset changes may affect staffing needs",
  "budget_outlook": "Brief budget forecast paragraph with specific numbers"
}

Be specific with numbers and categories. Base predictions on the actual data provided."""

    user_prompt = f"Current Asset Portfolio Data:\n{json.dumps(analytics_data, indent=2, default=str)}"

    try:
        result = await call_llm(system_prompt, user_prompt, max_tokens=1000)
        return json.loads(_clean_json(result))
    except Exception as e:
        logger.exception("AI predictions failed: %s", e)
        return {
            "predicted_purchases": [],
            "maintenance_forecast": [],
            "staffing_impact": "AI predictions unavailable",
            "budget_outlook": "Unable to generate forecast",
            "error": "AI service unavailable",
        }
