"""Order parser service for transforming structured and unstructured order items."""
import json
import re
from app.config import OPENAI_API_KEY, LLM_MODEL


def parse_single_string_item(item_str: str) -> dict:
    item_str = item_str.strip()
    match = re.match(r"^(\d+)\s*x?\s*(.+)$", item_str, re.IGNORECASE)
    if match:
        quantity = match.group(1)
        product_name = match.group(2).strip()
        return {
            "product_name": product_name,
            "quantity": quantity,
            "unit_prize": "0.0"
        }
    return {
        "product_name": item_str,
        "quantity": "1",
        "unit_prize": "0.0"
    }


def normalize_list(items, total_price=None) -> list:
    normalized = []
    if not isinstance(items, list):
        items = [items]
    for item in items:
        if isinstance(item, dict):
            product_name = item.get("product_name") or item.get("name") or item.get("item") or "Unknown Product"
            quantity = item.get("quantity") or item.get("qty") or item.get("count") or "1"
            unit_prize = item.get("unit_prize") or item.get("unit_price") or item.get("price")

            if unit_prize is not None and str(unit_prize).strip().lower() not in ["", "unknown", "none", "null"]:
                unit_str = str(unit_prize).strip()
                # Clean currency symbol (e.g. £22.09 -> 22.09)
                cleaned_price = re.sub(r"[^\d\.]", "", unit_str)
                unit_prize = cleaned_price if cleaned_price else unit_str
            else:
                unit_prize = "0.0"

            normalized.append({
                "product_name": str(product_name),
                "quantity": str(quantity),
                "unit_prize": str(unit_prize)
            })
        elif isinstance(item, str):
            parsed_item = parse_single_string_item(item)
            if parsed_item:
                normalized.append(parsed_item)

    # Fallback price calculation: if unit_prize is 0.0 but total_price is provided, estimate unit_prize
    if total_price:
        try:
            tot = float(total_price)
            if tot > 0:
                zero_items = [i for i in normalized if float(i.get("unit_prize", 0) or 0) == 0]
                if zero_items:
                    total_qty = sum(float(i.get("quantity", 1) or 1) for i in normalized)
                    if total_qty > 0:
                        avg_unit = round(tot / total_qty, 2)
                        for item in zero_items:
                            item["unit_prize"] = str(avg_unit)
        except (ValueError, TypeError):
            pass

    return normalized


def parse_and_format_order_details(order_items, total_price) -> list:
    """
    Parses and formats order_items into the requested schema:
    [
        {
            "product_name": str,
            "quantity": str,
            "unit_prize": str
        }
    ]
    """
    if not order_items:
        return []

    # Case 1: If order_items is a string, try to parse it as JSON first
    if isinstance(order_items, str):
        cleaned = order_items.strip()
        if (cleaned.startswith("{") and cleaned.endswith("}")) or (cleaned.startswith("[") and cleaned.endswith("]")):
            try:
                parsed = json.loads(cleaned)
                if isinstance(parsed, dict) and "order_details" in parsed:
                    return normalize_list(parsed["order_details"], total_price)
                if isinstance(parsed, dict):
                    return normalize_list([parsed], total_price)
                if isinstance(parsed, list):
                    return normalize_list(parsed, total_price)
            except Exception:
                pass

    # Case 2: If it is already a dictionary
    if isinstance(order_items, dict):
        if "order_details" in order_items:
            return normalize_list(order_items["order_details"], total_price)
        return normalize_list([order_items], total_price)

    # Case 3: If it is already a list
    if isinstance(order_items, list):
        return normalize_list(order_items, total_price)

    # Case 4: Unstructured string fallback (e.g., "2x Cola, 2x pizza")
    parsed_items = []
    if isinstance(order_items, str):
        parts = [p.strip() for p in order_items.replace("\n", ",").split(",") if p.strip()]
        for part in parts:
            parsed_item = parse_single_string_item(part)
            if parsed_item:
                parsed_items.append(parsed_item)

    if OPENAI_API_KEY and parsed_items:
        try:
            import openai
            client = openai.OpenAI(api_key=OPENAI_API_KEY)
            prompt = f"""
            You are an expert order parser. Convert the following unstructured order items string and total price into a clean, structured JSON list of objects.
            
            Order items string: "{order_items}"
            Total Price of the entire order: {total_price}
            
            For each item, extract:
            - "product_name": Name of the item (e.g. "Cola", "Pepperoni Pizza").
            - "quantity": Number ordered as a string (e.g. "2").
            - "unit_prize": Price of ONE unit of this item as a string (e.g. "3.5"). If you cannot calculate it, guess a reasonable value based on the total price and items, but make sure the sum of (quantity * unit_prize) roughly equals the total price.
            
            Respond ONLY with a valid JSON array of objects, like this:
            [
                {{"product_name": "Cola", "quantity": "2", "unit_prize": "3.5"}},
                {{"product_name": "pizza", "quantity": "2", "unit_prize": "21.5"}}
            ]
            Do not include any markdown backticks, explanations, or comments.
            """

            response = client.chat.completions.create(
                model=LLM_MODEL,
                messages=[{"role": "user", "content": prompt}],
                temperature=0.0
            )
            content = response.choices[0].message.content.strip()

            if content.startswith("```"):
                content = content.split("```")[1]
                if content.startswith("json"):
                    content = content[4:]
                content = content.strip("` \n")

            parsed = json.loads(content)
            if isinstance(parsed, list):
                return normalize_list(parsed, total_price)
        except Exception as e:
            print(f" OpenAI parsing failed, using regex fallback: {str(e)}")

    return normalize_list(parsed_items, total_price)
