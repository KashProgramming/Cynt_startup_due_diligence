"""
LLM client initialisation and JSON extraction helpers.
"""
import json
import os
import re
from dotenv import load_dotenv
from langchain_groq import ChatGroq

load_dotenv()

_MODEL = "llama-3.3-70b-versatile"


def get_llm(temperature: float = 0.0) -> ChatGroq:
    """Return a ChatGroq LLM instance.

    Args:
        temperature: Sampling temperature (default 0 for deterministic output).

    Returns:
        ChatGroq: Configured LLM client.
    """
    return ChatGroq(
        model=_MODEL,
        temperature=temperature,
        api_key=os.getenv("GROQ_API_KEY"),
    )


def extract_json(text: str) -> dict:
    """Extract the first JSON object from an LLM response string.

    Args:
        text: Raw LLM response text.

    Returns:
        dict: Parsed JSON object.

    Raises:
        ValueError: If no valid JSON found.
    """
    # Try direct parse first
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass

    # Strip markdown fences
    clean = re.sub(r"```(?:json)?", "", text).strip().rstrip("`").strip()
    try:
        return json.loads(clean)
    except json.JSONDecodeError:
        pass

    # Extract first {...} block
    match = re.search(r"\{.*\}", text, re.DOTALL)
    if match:
        return json.loads(match.group())

    raise ValueError(f"No valid JSON found in LLM response:\n{text[:500]}")
