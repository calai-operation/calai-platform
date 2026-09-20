"""Multi-gate order confirmation validator."""


def is_customer_confirmed(val) -> bool:
    """Helper to check if customer_confirmed is explicitly true."""
    if val is True:
        return True
    if isinstance(val, str) and val.strip().lower() in ["true", "1", "yes"]:
        return True
    return False


def validate_order_confirmation(args: dict) -> tuple:
    """
    Multi-gate validation for order confirmation.
    Returns (is_valid: bool, rejection_reason: str).
    ALL gates must pass for the order to be accepted.
    Uses soft allowlist: rejects phrases with negative words, accepts everything else.
    """
    # Gate 1: customer_confirmed must be explicitly true
    if not is_customer_confirmed(args.get("customer_confirmed")):
        return False, "customer_confirmed is not true - customer has not confirmed the order"

    # Gate 2: confirmation_phrase must be present and not contain negative/cancellation words
    phrase = (args.get("confirmation_phrase") or "").strip().lower()
    if not phrase:
        return False, "confirmation_phrase is empty - no customer confirmation words provided. You must include the customer's exact spoken confirmation words."

    # Soft allowlist: reject if the phrase contains negative/cancellation indicators
    # (unless it also contains a positive like 'yes' - e.g. 'yes, no changes needed')
    negative_indicators = [
        "no", "cancel", "don't", "dont", "stop", "wait",
        "hold on", "not yet", "never mind", "nevermind",
        "forget it", "forget", "changed my mind", "hang up"
    ]
    positive_indicators = [
        "yes", "yeah", "yep", "yup", "correct", "right",
        "sure", "go ahead", "please", "fine", "okay", "ok"
    ]
    has_positive = any(pos in phrase for pos in positive_indicators)
    for neg in negative_indicators:
        if neg in phrase and not has_positive:
            return False, f"confirmation_phrase contains negative indicator '{neg}' without any positive confirmation - customer may not have confirmed"

    # Gate 3: order_summary_read must be true
    order_summary_read = args.get("order_summary_read")
    if order_summary_read is not True:
        if isinstance(order_summary_read, str) and order_summary_read.strip().lower() in ["true", "1", "yes"]:
            pass  # Accept string "true"
        else:
            return False, "order_summary_read is not true - the order summary must be read aloud to the customer before saving"

    # Gate 4: order_items must not be empty
    order_items = args.get("order_items")
    if not order_items or (isinstance(order_items, str) and not order_items.strip()):
        return False, "order_items is empty - there are no items in the order"

    # Gate 5: total_price must be > 0
    try:
        total = float(args.get("total_price", 0) or 0)
        if total <= 0:
            return False, f"total_price is {total} - a valid order must have a positive total"
    except (ValueError, TypeError):
        return False, "total_price is not a valid number"

    return True, "all gates passed"
