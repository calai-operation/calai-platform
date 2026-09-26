"""Keep an assistant's configured call behaviour when refreshing business data."""
from copy import deepcopy
import re

_HEADING = re.compile(r"(?m)^(\d{1,2})\.[ \t]+([^\r\n]+)\r?\n={10,}[ \t]*\r?\n")
_GREETING = re.compile(r"^Hi, you're through to (.+?) and I'm their virtual assistant\. Would you like to place an order\?$")
_LEGACY_PRIORITY = re.compile(r"CALL OUTCOME ROUTING\s*[-–—]\s*takes precedence over earlier closing/transfer wording only\.")


def _section_span(prompt, number):
    headings = list(_HEADING.finditer(prompt))
    starts = [m for m in headings if int(m.group(1)) == number]
    ends = [m for m in headings if int(m.group(1)) == number + 1]
    if len(starts) != 1 or len(ends) != 1 or starts[0].start() >= ends[0].start():
        return None
    title = starts[0].group(2).upper()
    if number == 11 and "PAYMENT" not in title:
        return None
    if number == 15 and "COMPLETED ORDER CLOSING" not in title:
        return None
    if number == 15 and "MENU DATA" not in ends[0].group(2).upper():
        return None
    return starts[0].start(), ends[0].start()


def retain_payment_policy(generated_prompt, existing_prompt):
    """Copy only this assistant's bounded payment/closing sections, never its menu."""
    result = generated_prompt
    retained_closing = False
    for number in (11, 15):
        old = _section_span(existing_prompt, number)
        new = _section_span(result, number)
        if old is None or new is None:
            continue
        result = result[:new[0]] + existing_prompt[old[0]:old[1]] + result[new[1]:]
        retained_closing = retained_closing or number == 15
    if retained_closing:
        # The older generator appends a routing block with an overriding-priority
        # claim. Retained recovery/collection-card policy must remain authoritative.
        result = _LEGACY_PRIORITY.sub("LEGACY CALL OUTCOME EXAMPLES - Sections 11 and 15 take precedence over these examples.", result)
        result += "\n\nPAYMENT AND CLOSING PRIORITY\nThe retained Sections 11 and 15 are authoritative over any conflicting default or legacy payment, transfer, or closing instructions elsewhere in this prompt. Follow their card-payment routing and their exact failure/unknown-result recovery rules.\n"
    return result


def _rename_tool_announcements(model, old_name, new_name):
    if not old_name or old_name == new_name:
        return
    for tool in model.get("tools", []):
        for message in tool.get("messages", []):
            if isinstance(message.get("content"), str):
                message["content"] = message["content"].replace(old_name, new_name)
        for destination in tool.get("destinations", []):
            if isinstance(destination.get("message"), str):
                destination["message"] = destination["message"].replace(old_name, new_name)


def build_existing_assistant_update(existing, generated, business_id, business_name="", manager_number=""):
    """Return a narrow PATCH; omitted top-level settings remain untouched in Vapi."""
    if not existing.get("id") or not isinstance(existing.get("model"), dict):
        raise ValueError("Existing assistant configuration is unavailable")
    metadata = existing.get("metadata") or {}
    if existing.get("name") != business_id and metadata.get("business_id") != business_id:
        raise ValueError("Existing assistant does not match this business")
    model = deepcopy(existing["model"])
    messages = model.get("messages", [])
    systems = [m for m in messages if m.get("role") == "system"]
    if len(systems) > 1:
        raise ValueError("Existing assistant has ambiguous system prompts")
    generated_prompt = generated["model"]["messages"][0]["content"]
    old_prompt = systems[0].get("content", "") if systems else ""
    if not isinstance(old_prompt, str):
        raise ValueError("Existing assistant prompt format is unsupported")
    new_prompt = retain_payment_policy(generated_prompt, old_prompt)
    if systems:
        systems[0]["content"] = new_prompt
    else:
        messages = [{"role": "system", "content": new_prompt}, *messages]
    model["messages"] = messages

    explicit_manager = (manager_number or "").strip()
    if explicit_manager:
        transfers = [t for t in model.get("tools", []) if t.get("type") == "transferCall" and t.get("function", {}).get("name") == "transferToManager"]
        if len(transfers) != 1 or len(transfers[0].get("destinations", [])) != 1 or transfers[0]["destinations"][0].get("type") != "number":
            raise ValueError("Cannot identify the configured restaurant destination")
        transfers[0]["destinations"][0]["number"] = explicit_manager

    patch = {"model": model}
    if business_name:
        prior_name = metadata.get("business_name")
        greeting = existing.get("firstMessage", "")
        greeting = greeting if isinstance(greeting, str) else ""
        default_greeting = _GREETING.fullmatch(greeting) if isinstance(greeting, str) else None
        if not prior_name and default_greeting:
            prior_name = default_greeting.group(1)
        # Old assistants may lack display-name metadata and have a custom greeting.
        # Only a known prior display name provides evidence of a rename.
        if prior_name and prior_name != business_name:
            patch["firstMessage"] = greeting.replace(prior_name, business_name) if prior_name and prior_name in greeting else generated["firstMessage"]
            _rename_tool_announcements(model, prior_name, business_name)
        patch["metadata"] = {**deepcopy(metadata), "business_id": business_id, "business_name": business_name}
    return patch
