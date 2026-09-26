"""Vapi service handling assistant management, telephony, and webhooks integration."""
import json
import os
import requests
from app.services.assistant_update import build_existing_assistant_update
from app.config import (
    VAPI_BASE_URL,
    VAPI_HEADERS,
    LLM_MODEL,
    TWILIO_ACCOUNT_SID,
    TWILIO_AUTH_TOKEN,
    get_vapi_server_url,
)

# Shared card-payment transfer tool ID from Testing Curry
CARD_PAYMENT_TOOL_ID = os.getenv("CARD_PAYMENT_TOOL_ID", "d16ed569-aa30-4005-a015-185ee9e1c778").strip()


def create_assistant(business_id: str, system_prompt: str, business_name: str = "", manager_number: str = "") -> dict:
    """
    Creates or updates an assistant on Vapi with Testing Curry mother behavior baked in.
    If an assistant with the name already exists, it updates it in-place using PATCH so changes are published instantly.
    Uses business_name for customer-facing messages (firstMessage, endCall).
    """
    existing_id = None
    existing_matches = []
    try:
        # Search for existing assistant with this name/business_id to prevent duplicates and auto-publish
        list_url = f"{VAPI_BASE_URL}/assistant"
        list_res = requests.get(list_url, headers=VAPI_HEADERS, timeout=20)
        if list_res.status_code != 200:
            raise RuntimeError("Assistant lookup failed")
        if list_res.status_code == 200:
            assistants = list_res.json()
            if not isinstance(assistants, list) or any(not isinstance(a, dict) for a in assistants):
                raise ValueError("Assistant lookup returned an unsupported response")
            for ast in assistants:
                if ast.get("name") == business_id or (ast.get("metadata") or {}).get("business_id") == business_id:
                    existing_matches.append(ast)
    except Exception as e:
        raise RuntimeError("Existing assistant lookup failed; request cancelled") from e

    if len(existing_matches) > 1:
        raise ValueError("Multiple assistants match this business; update cancelled")
    if existing_matches:
        existing_id = existing_matches[0].get("id")
        if not existing_id:
            raise RuntimeError("Existing assistant identity unavailable; update cancelled")

    vapi_server_url = get_vapi_server_url() or "https://api.calai.info/api/webhook/vapi"

    # Use business_name for customer-facing messages, fall back to business_id
    display_name = business_name if business_name else business_id
    target_manager_number = manager_number.strip() if manager_number and manager_number.strip() else "+447414500191"

    # Tools configured exactly as Testing Curry mother template
    tool_ids = []
    if CARD_PAYMENT_TOOL_ID:
        tool_ids.append(CARD_PAYMENT_TOOL_ID)

    # Inline tools: transferToManager, endCall, and save_order (apiRequest)
    tools = [
        {
            "type": "transferCall",
            "function": {
                "name": "transferToManager",
                "description": "Transfer immediately for staff, manager, restaurant, complaint or other human assistance. Never claims confirmation. For a saved confirmed card-payment order use transferForCardPayment instead."
            },
            "messages": [],
            "destinations": [
                {
                    "type": "number",
                    "number": target_manager_number,
                    "message": "Please hold while I transfer you to the restaurant."
                }
            ]
        },
        {
            "type": "endCall",
            "function": {
                "name": "endCall",
                "description": "End after a successfully saved confirmed collection or cash order. Never use for a card-payment transfer or a staff request."
            },
            "messages": [
                {
                    "type": "request-start",
                    "content": f"Your order's been confirmed, thank you for calling {display_name}.",
                    "blocking": True
                }
            ]
        },
        {
            "url": vapi_server_url,
            "type": "apiRequest",
            "method": "POST",
            "function": {
                "name": "save_order",
                "description": "Save a completed order only after the complete final summary has been read, the customer explicitly confirms it, and all details required by the existing order flow are complete. Send order_items as an array, with the real confirmation flags and exact phrase. For delivery, collect cash or card first. Never submit incomplete, cancelled or unconfirmed orders. Only treat save_order as saved when the returned JSON has data.success exactly true AND data.callId is a non-empty string. The outer success field, HTTP 200, \"Webhook processed\", or \"Ignored message type\" never prove that an order was saved. If data.success is false, data.callId is absent, or the request fails or times out, do not announce confirmation, invoke the order-confirmation endCall, or transfer for card payment. Explain that you could not confirm the save and offer staff assistance. Do not retry automatically because a timeout may occur after saving. A customer asking for staff may still be transferred without an order."
            },
            "messages": [],
            "parameters": [
                {
                    "key": "assistantId",
                    "value": "{{ assistant.id }}"
                },
                {
                    "key": "callId",
                    "value": "{{ call.id }}"
                }
            ],
            "backoffPlan": {
                "type": "fixed",
                "maxRetries": 0,
                "baseDelaySeconds": 1
            },
            "timeoutSeconds": 20,
            "body": {
                "type": "object",
                "required": [
                    "customer_confirmed",
                    "order_summary_read",
                    "confirmation_phrase",
                    "order_items",
                    "total_price",
                    "customer_name",
                    "customer_phone",
                    "delivery_type",
                    "delivery_address",
                    "payment_method"
                ],
                "properties": {
                    "order_items": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "required": [
                                "product_name",
                                "quantity",
                                "unit_prize",
                                "notes"
                            ],
                            "properties": {
                                "notes": {
                                    "type": "string",
                                    "description": "Item-specific requests; empty string if none."
                                },
                                "quantity": {
                                    "type": "string",
                                    "description": "Positive quantity ordered, for example 2."
                                },
                                "unit_prize": {
                                    "type": "string",
                                    "description": "Price of one item from the menu, for example 4.50."
                                },
                                "order_notes": {
                                    "type": "string",
                                    "description": "General order-wide requests, stored only on the first item. Separate from this item notes field; empty if none."
                                },
                                "product_name": {
                                    "type": "string",
                                    "description": "Exact menu item name."
                                }
                            },
                            "additionalProperties": False
                        },
                        "description": "The complete list of confirmed menu items. An array, not a JSON string or an object wrapper."
                    },
                    "total_price": {
                        "type": "number",
                        "description": "Accurately calculated total for all confirmed items and explicitly configured charges."
                    },
                    "customer_name": {
                        "type": "string",
                        "description": "Confirmed customer name for collection. For delivery, empty string if not supplied; do not ask solely to fill this field."
                    },
                    "delivery_type": {
                        "enum": [
                            "collection",
                            "delivery"
                        ],
                        "type": "string"
                    },
                    "customer_phone": {
                        "type": "string",
                        "description": "The confirmed callback number, following the existing caller-number confirmation flow."
                    },
                    "payment_method": {
                        "enum": [
                            "cash",
                            "card",
                            "not_required"
                        ],
                        "type": "string",
                        "description": "Cash or card when chosen by the customer; not_required when paying on collection without requesting a card-payment transfer."
                    },
                    "delivery_address": {
                        "type": "string",
                        "description": "Full confirmed delivery address. Empty string for collection."
                    },
                    "customer_confirmed": {
                        "type": "boolean",
                        "description": "True only after the customer explicitly confirms the final summary. Never manufacture confirmation."
                    },
                    "order_summary_read": {
                        "type": "boolean",
                        "description": "True only if the complete final order summary and total were actually read to the customer."
                    },
                    "confirmation_phrase": {
                        "type": "string",
                        "description": "Exact words the customer used to confirm the final summary."
                    }
                },
                "additionalProperties": False
            }
        }
    ]

    payload = {
        "name": business_id,
        "firstMessage": f"Hi, you're through to {display_name} and I'm their virtual assistant. Would you like to place an order?",
        "metadata": {
            "business_id": business_id
        },
        "backgroundSound": "off",
        "startSpeakingPlan": {
            "waitSeconds": 0.2,
            "transcriptionEndpointingPlan": {
                "onNoPunctuationSeconds": 0.3
            }
        },
        "stopSpeakingPlan": {
            "backoffSeconds": 0.5
        },
        "endCallPhrases": ["goodbye for now"],
        "compliancePlan": {
            "hipaaEnabled": False,
            "pciEnabled": False,
            "zdrEnabled": False
        },
        "model": {
            "provider": "openai",
            "model": LLM_MODEL if LLM_MODEL else "gpt-5.6-terra",
            "messages": [
                {
                    "role": "system",
                    "content": system_prompt
                }
            ],
            "toolIds": tool_ids,
            "tools": tools
        },
        "voice": {
            "provider": "vapi",
            "voiceId": "Clara",
            "version": "2",
            "language": "auto"
        },
        "transcriber": {
            "provider": "deepgram",
            "model": "nova-3",
            "language": "en-GB",
            "endpointing": 300,
            "keyterm": [
                "Biyrani, Peshwari",
                "Nan",
                "naan",
                "Jalfrazi"
            ],
            "fallbackPlan": {
                "autoFallback": {
                    "enabled": True
                }
            }
        },
        "server": {
            "url": vapi_server_url,
            "timeoutSeconds": 20
        },
        "analysisPlan": {
            "summaryPlan": {
                "enabled": True,
                "messages": [
                    {
                        "role": "system",
                        "content": "Provide a concise summary of the call. Include the customer's name, their mood, what they ordered, the total price of the order, payment method chosen, and if the order was successfully handled."
                    },
                    {
                        "role": "user",
                        "content": "Here is the transcript:\n\n{{transcript}}\n\n. Here is the ended reason of the call:\n\n{{endedReason}}\n\n"
                    }
                ]
            },
            "structuredDataPlan": {
                "enabled": True,
                "schema": {
                    "type": "object",
                    "required": [
                        "items",
                        "order_notes",
                        "total_price",
                        "order_status",
                        "customer_name",
                        "delivery_type",
                        "delivery_address",
                        "customer_confirmed",
                        "order_summary_read",
                        "save_order_was_called",
                        "calai_unconfirmed_order"
                    ],
                    "properties": {
                        "items": {
                            "type": "array",
                            "items": {
                                "type": "object",
                                "required": [
                                    "quantity",
                                    "unit_prize",
                                    "product_name"
                                ],
                                "properties": {
                                    "quantity": {
                                        "type": "string"
                                    },
                                    "unit_prize": {
                                        "type": "string"
                                    },
                                    "product_name": {
                                        "type": "string"
                                    }
                                }
                            }
                        },
                        "order_notes": {
                            "description": "General order comment not tied to a specific item, or an empty string.",
                            "type": "string"
                        },
                        "total_price": {
                            "type": "number"
                        },
                        "order_status": {
                            "type": "string",
                            "enum": [
                                "completed",
                                "abandoned",
                                "in_progress"
                            ]
                        },
                        "customer_name": {
                            "type": "string"
                        },
                        "delivery_type": {
                            "type": "string",
                            "enum": [
                                "pickup",
                                "delivery"
                            ]
                        },
                        "payment_method": {
                            "type": "string",
                            "enum": [
                                "cash",
                                "card",
                                "unknown"
                            ]
                        },
                        "delivery_address": {
                            "type": "string"
                        },
                        "customer_confirmed": {
                            "type": "boolean"
                        },
                        "order_summary_read": {
                            "description": "True only when the complete final order summary and total were actually read aloud before the call ended.",
                            "type": "boolean"
                        },
                        "save_order_was_called": {
                            "type": "boolean"
                        },
                        "calai_unconfirmed_order": {
                            "description": "Incomplete-order recovery for every ending before a successful confirmed save, when at least one item was captured.",
                            "type": "object",
                            "required": [
                                "items",
                                "reason",
                                "outcome",
                                "total_price",
                                "customer_name",
                                "delivery_type",
                                "general_notes",
                                "delivery_address",
                                "order_summary_read",
                                "explicit_cancellation"
                            ],
                            "properties": {
                                "items": {
                                    "type": "array",
                                    "items": {
                                        "type": "object",
                                        "required": [
                                            "notes",
                                            "quantity",
                                            "unit_prize",
                                            "product_name"
                                        ],
                                        "properties": {
                                            "notes": {
                                                "type": "string"
                                            },
                                            "quantity": {
                                                "type": "integer"
                                            },
                                            "unit_prize": {
                                                "description": "Known exact unit price or empty string when unknown.",
                                                "type": "string"
                                            },
                                            "product_name": {
                                                "type": "string"
                                            }
                                        }
                                    }
                                },
                                "reason": {
                                    "description": "One concise factual reason the order was not completed, using the transcript and endedReason.",
                                    "type": "string"
                                },
                                "outcome": {
                                    "type": "string",
                                    "enum": [
                                        "unconfirmed",
                                        "confirmed",
                                        "no_order"
                                    ]
                                },
                                "total_price": {
                                    "description": "Exact stated total, or -1 when unknown.",
                                    "type": "number"
                                },
                                "customer_name": {
                                    "type": "string"
                                },
                                "delivery_type": {
                                    "type": "string",
                                    "enum": [
                                        "pickup",
                                        "delivery",
                                        "unknown"
                                    ]
                                },
                                "general_notes": {
                                    "description": "General order comment not tied to a specific item, or an empty string.",
                                    "type": "string"
                                },
                                "delivery_address": {
                                    "type": "string"
                                },
                                "order_summary_read": {
                                    "description": "True only when the complete final order summary and total were actually read aloud before the call ended.",
                                    "type": "boolean"
                                },
                                "explicit_cancellation": {
                                    "type": "boolean"
                                }
                            }
                        }
                    }
                },
                "messages": [
                    {
                        "role": "system",
                        "content": "Extract the final order details for database logging.\n\n**ORDER STATUS RULES (CRITICAL)**:\n- Set order_status to 'completed' ONLY if ALL of the following are true: (1) the assistant read the full order summary aloud to the customer, (2) the assistant asked 'Is that all correct?' or similar, (3) the customer explicitly confirmed the order summary with 'yes', 'yeah', 'that\\'s correct' or similar affirmative response, (4) the assistant said 'your order has been confirmed' or similar confirmation phrase, AND (5) a total price was clearly stated by the assistant. If ANY of these conditions is missing, the order is NOT completed.\n- Set order_status to 'abandoned' if: the call was disconnected or hung up before the customer confirmed the summary, the endedReason indicates an unexpected end (e.g. 'customer-ended-call' without confirmation, 'assistant-error', 'silence-timed-out'), the customer cancelled the order, the customer said 'no' to the order summary and never re-confirmed, or save_order was never successfully called.\n- Set order_status to 'in_progress' only if the call ended mid-conversation while items were actively being discussed but no summary was attempted.\n- Set customer_confirmed to true ONLY if the customer explicitly verbally confirmed the final order summary in the transcript with a clear 'yes', 'yeah', 'correct', 'that\\'s right' or similar. Simply saying 'that\\'s it' (meaning done adding items) does NOT count as confirming the summary. If the call ended before this confirmation, set customer_confirmed to false.\n- Set save_order_was_called to true ONLY if the transcript shows save_order was successfully invoked and the assistant confirmed the order. If save_order was never called, or was rejected by the backend, set it to false.\n\n**TOTAL PRICE RULES**:\n- For total_price, output the final total price clearly stated by the assistant to the customer. If no total was stated or confirmed in the transcript, set total_price to 0.\n- Do NOT guess or calculate a total that was never spoken in the conversation.\n\n**ITEM EXTRACTION**:\n- For each item in 'items', extract 'product_name', 'quantity' (as a string), and 'unit_prize' (the price of ONE unit as a decimal string, e.g. '22.09', '24.10', '5.83').\n- For unit_prize, use this priority order:\n  1. FIRST: Look for individual item prices spoken in the transcript (e.g. 'at eight pounds fifty each', 'at ten pounds'). Convert spoken prices to decimal strings (e.g. 'eight pounds fifty' = '8.50').\n  2. FALLBACK: If a specific item price was NOT spoken but the total_price and all quantities are known, calculate unit prices that sum to the stated total. Use common UK restaurant pricing (whole numbers or .50/.95/.99 endings).\n  3. NEVER output 'unknown', '0.0', or '0' for unit_prize. You MUST always provide a realistic numeric decimal string.\n\nThe delivery_type MUST be exactly 'pickup' or 'delivery'. If delivery_type is 'delivery', extract the 'delivery_address' from the transcript. If it's 'pickup', set 'delivery_address' to 'N/A' or an empty string.\n\nJson Schema:\n{{schema}}\n\nOnly respond with the JSON."
                    },
                    {
                        "role": "user",
                        "content": "Here is the transcript:\n\n{{transcript}}\n\n. Here is the ended reason of the call:\n\n{{endedReason}}\n\n"
                    }
                ]
            },
            "successEvaluationPlan": {
                "enabled": True,
                "rubric": "PassFail"
            }
        }
    }

    if existing_id:
        current_res = requests.get(f"{VAPI_BASE_URL}/assistant/{existing_id}", headers=VAPI_HEADERS, timeout=20)
        if current_res.status_code != 200:
            raise RuntimeError("Existing assistant configuration could not be read; update cancelled")
        current = current_res.json()
        if current.get("id") != existing_id:
            raise RuntimeError("Existing assistant identity changed; update cancelled")
        payload = build_existing_assistant_update(
            current, payload, business_id, business_name=business_name, manager_number=manager_number
        )

    print("Vapi assistant payload prepared")

    if existing_id:
        print(f"[SYNC] Assistant '{business_id}' already exists (ID: {existing_id}). Updating in-place...")
        url = f"{VAPI_BASE_URL}/assistant/{existing_id}"
        response = requests.patch(url, headers=VAPI_HEADERS, json=payload)
    else:
        print(f"[NEW] Creating new assistant '{business_id}'...")
        url = f"{VAPI_BASE_URL}/assistant"
        response = requests.post(url, headers=VAPI_HEADERS, json=payload)

    if response.status_code >= 400:
        error_msg = response.text
        print(f"DEBUG VAPI ERROR: {error_msg}")
        raise RuntimeError(f"Vapi assistant request failed ({response.status_code})")

    result = response.json()
    return result


def link_telephony(assistant_id: str, twilio_number: str, manager_number: str) -> dict:
    """
    Links a Twilio phone number to the created Vapi assistant.
    If the phone number is already imported in Vapi, updates the assistant link via PATCH.
    Otherwise, imports it into Vapi via POST using Twilio credentials.
    Also ensures the transferToManager destination on the assistant points to the manager_number.
    """
    clean_twilio_number = twilio_number.strip().replace(" ", "").replace("-", "").replace("(", "").replace(")", "")
    if clean_twilio_number and not clean_twilio_number.startswith("+"):
        clean_twilio_number = "+" + clean_twilio_number

    clean_manager_number = manager_number.strip().replace(" ", "").replace("-", "").replace("(", "").replace(")", "")
    if clean_manager_number and not clean_manager_number.startswith("+"):
        clean_manager_number = "+" + clean_manager_number

    twilio_account_sid = TWILIO_ACCOUNT_SID
    twilio_auth_token = TWILIO_AUTH_TOKEN

    existing_phone_obj = None
    try:
        list_url = f"{VAPI_BASE_URL}/phone-number"
        list_res = requests.get(list_url, headers=VAPI_HEADERS)
        if list_res.status_code == 200:
            for item in list_res.json():
                item_num = (item.get("number") or "").strip().replace(" ", "").replace("-", "")
                if item_num == clean_twilio_number or item.get("number") == twilio_number:
                    existing_phone_obj = item
                    break
    except Exception as e:
        print(f"Warning: Failed to fetch existing Vapi phone numbers: {e}")

    if existing_phone_obj:
        phone_id = existing_phone_obj["id"]
        print(f"[LINK] Phone number '{clean_twilio_number}' already exists in Vapi (ID: {phone_id}). Updating assistantId...")
        url = f"{VAPI_BASE_URL}/phone-number/{phone_id}"
        patch_payload = {
            "assistantId": assistant_id
        }
        if twilio_account_sid and twilio_auth_token:
            patch_payload["twilioAccountSid"] = twilio_account_sid
            patch_payload["twilioAuthToken"] = twilio_auth_token

        response = requests.patch(url, headers=VAPI_HEADERS, json=patch_payload)
        if response.status_code >= 400:
            raise Exception(f"Vapi Error {response.status_code}: {response.text}")
        result_phone_data = response.json()
    else:
        print(f"[LINK] Importing new Twilio phone number '{clean_twilio_number}' to Vapi...")
        url = f"{VAPI_BASE_URL}/phone-number"
        payload = {
            "provider": "twilio",
            "number": clean_twilio_number,
            "assistantId": assistant_id,
            "twilioAccountSid": twilio_account_sid,
            "twilioAuthToken": twilio_auth_token,
            "name": f"Line for {assistant_id[:25]}"
        }
        response = requests.post(url, headers=VAPI_HEADERS, json=payload)
        if response.status_code >= 400:
            error_text = response.text
            if "Number Not Found on Twilio" in error_text:
                sid_hint = twilio_account_sid[:6] + "..." if len(twilio_account_sid) > 6 else twilio_account_sid
                raise Exception(
                    f"Number Not Found on Twilio: The phone number '{clean_twilio_number}' was not found in your active Twilio account console (SID: {sid_hint}). "
                    f"Please check that this number is purchased under your Twilio account, or verify TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN in .env."
                )
            raise Exception(f"Vapi Error {response.status_code}: {error_text}")
        result_phone_data = response.json()

    # Update assistant's inline transferToManager destination with the actual manager number
    if clean_manager_number:
        patch_assistant_url = f"{VAPI_BASE_URL}/assistant/{assistant_id}"
        get_res = requests.get(patch_assistant_url, headers=VAPI_HEADERS)
        if get_res.status_code == 200:
            assistant_data = get_res.json()
            model_data = assistant_data.get("model", {})
            tools_list = model_data.get("tools", [])

            # Update destination inside transferToManager tool
            updated_tools = False
            for t in tools_list:
                if t.get("type") == "transferCall" and t.get("function", {}).get("name") == "transferToManager":
                    t["destinations"] = [
                        {
                            "type": "number",
                            "number": clean_manager_number,
                            "message": "Please hold while I transfer you to the restaurant."
                        }
                    ]
                    updated_tools = True
                    break

            if updated_tools:
                patch_res = requests.patch(patch_assistant_url, headers=VAPI_HEADERS, json={"model": model_data})
                if patch_res.status_code < 400:
                    print(f"[LINK] Updated transferToManager destination to {clean_manager_number}")

    return result_phone_data


def unlink_telephony(phone_number_id: str) -> dict:
    """
    Unlinks and deletes a Twilio phone number from the Vapi account.
    """
    url = f"{VAPI_BASE_URL}/phone-number/{phone_number_id}"
    response = requests.delete(url, headers=VAPI_HEADERS)
    response.raise_for_status()
    return response.json()


def set_phone_ringing_hook(phone_number_id: str, fallback_number: str) -> dict:
    """
    Patches a Vapi phone number with a call.ringing hook to unconditionally
    transfer incoming calls to the human fallback number before the AI speaks.
    Used when agent status is set to OFF (false).
    """
    url = f"{VAPI_BASE_URL}/phone-number/{phone_number_id}"
    payload = {
        "hooks": [
            {
                "on": "call.ringing",
                "do": [
                    {
                        "type": "transfer",
                        "destination": {
                            "type": "number",
                            "number": fallback_number
                        }
                    }
                ]
            }
        ]
    }
    response = requests.patch(url, headers=VAPI_HEADERS, json=payload)
    if response.status_code >= 400:
        raise Exception(f"Vapi Hook Set Error ({response.status_code}): {response.text}")
    return response.json()


def clear_phone_ringing_hook(phone_number_id: str) -> dict:
    """
    Clears all hooks on a Vapi phone number, restoring normal AI agent call handling.
    Used when agent status is set to ON (true).
    """
    url = f"{VAPI_BASE_URL}/phone-number/{phone_number_id}"
    payload = {"hooks": []}
    response = requests.patch(url, headers=VAPI_HEADERS, json=payload)
    if response.status_code >= 400:
        raise Exception(f"Vapi Hook Clear Error ({response.status_code}): {response.text}")
    return response.json()


def get_phone_number_details(phone_number_id: str) -> dict:
    """Fetches Vapi phone number configuration for inspection."""
    url = f"{VAPI_BASE_URL}/phone-number/{phone_number_id}"
    response = requests.get(url, headers=VAPI_HEADERS)
    if response.status_code >= 400:
        raise Exception(f"Vapi Phone Fetch Error ({response.status_code}): {response.text}")
    return response.json()
