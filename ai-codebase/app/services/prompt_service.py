"""Mother system prompt compiler and business name extractor for UK restaurants."""
import os
import re
from pathlib import Path


def extract_business_name(rules_text: str, fallback_name: str = "") -> str:
    """
    Extracts the real business name from the uploaded business rules/scripts text.
    Looks for 'Business Name: X' first, then greeting patterns, then falls back.
    """
    if not rules_text:
        return fallback_name

    # Strategy 1: Look for "Business Name: <name>"
    match = re.search(r'Business Name:\s*(.+)', rules_text, re.IGNORECASE)
    if match:
        name = match.group(1).strip().rstrip('.')
        if name:
            return name

    # Strategy 2: Look for greeting patterns like "welcome to <name>"
    match = re.search(r'welcome to\s+(.+?)[\.,!?\n]', rules_text, re.IGNORECASE)
    if match:
        name = match.group(1).strip()
        if name and len(name) < 60:
            return name

    # Strategy 3: Look for "calling <name>" in greeting scripts
    match = re.search(r'calling\s+(.+?)[\.,!?\n]', rules_text, re.IGNORECASE)
    if match:
        name = match.group(1).strip()
        if name and len(name) < 60:
            return name

    # Fallback: use the provided fallback name (usually business_id)
    return fallback_name


def generate_uk_restaurant_prompt(
    business_id: str,
    business_rules: str,
    menu_text: str,
    special_offers_text: str = "",
    business_name: str = ""
) -> str:
    """
    Generates a UK restaurant system prompt.
    If special offers are empty, the assistant is told that no offers are active.
    Uses business_name (extracted from scripts) for customer-facing references.
    """
    # Project root is 2 directories up from app/services (services -> app -> root)
    root_dir = Path(__file__).resolve().parent.parent.parent
    prompt_path = root_dir / "uk_system_prompt.txt"

    if not prompt_path.exists():
        # Fallback check
        prompt_path = Path("uk_system_prompt.txt").resolve()

    with open(prompt_path, "r", encoding="utf-8") as f:
        prompt_template = f.read()

    cleaned_special_offers = (special_offers_text or "").strip()

    if not cleaned_special_offers:
        cleaned_special_offers = (
            "No active Special Offers are defined.\n\n"
            "Do not invent discounts, bundles, free items or deals."
        )

    resolved_name = business_name if business_name else business_id

    prompt = (
        prompt_template
        .replace("{business_name}", resolved_name)
        .replace("{menu_text}", menu_text.strip())
        .replace("{special_offers_text}", cleaned_special_offers.strip())
        .replace("{business_rules}", (business_rules or "").strip())
    )

    return prompt

