"""Webhook router handling live Vapi order tool calls and post-call summaries."""
import json
from fastapi import APIRouter, Request, BackgroundTasks

from app.config import EXTERNAL_BACKEND_URL
from app.services.order_validator import validate_order_confirmation
from app.services.order_parser import parse_and_format_order_details
from app.tasks.forwarders import forward_order_task, forward_summary_task

router = APIRouter(tags=["Webhooks"])


@router.post("/webhook/order")
async def handle_order(request: Request, background_tasks: BackgroundTasks):
    """Receives the LIVE ORDER tool call from Vapi with Hard Confirmation Gate enforcement"""
    body = await request.body()
    if not body:
        return {"status": "error", "message": "Empty request body"}

    data = await request.json()

    # For apiRequest tools, Vapi sends the arguments directly in the root or inside 'message'
    if "customer_name" in data:
        # This is a flat apiRequest tool call
        args = data
        business_id = "Dashboard Tool"
        assistant_id = "Unknown"

        # MULTI-GATE CONFIRMATION VALIDATION
        is_valid, rejection_reason = validate_order_confirmation(args)
        if not is_valid:
            print(f"[REJECTED] ORDER REJECTED for {business_id}: {rejection_reason}")
            print(f"   Args: customer_confirmed={args.get('customer_confirmed')}, "
                  f"confirmation_phrase='{args.get('confirmation_phrase')}', "
                  f"order_summary_read={args.get('order_summary_read')}, "
                  f"total_price={args.get('total_price')}")
            return {
                "status": "error",
                "result": f"ORDER REJECTED: {rejection_reason}. "
                          f"You MUST: (1) read the complete order summary to the customer, "
                          f"(2) ask 'Is that all correct?', "
                          f"(3) wait for the customer to say 'yes' or similar, "
                          f"(4) only THEN call save_order with customer_confirmed=true, "
                          f"confirmation_phrase set to the customer's exact words, "
                          f"and order_summary_read=true."
            }

        formatted_details = parse_and_format_order_details(args.get("order_items"), args.get("total_price"))
        print(f"\n--- [NEW ORDER RECEIVED] for {business_id} ---")
        print(f"Customer: {args.get('customer_name')}")
        print(f"Email: {args.get('customer_email')}")
        print(f"Customer Confirmed: {args.get('customer_confirmed')}")
        print(f"Confirmation Phrase: '{args.get('confirmation_phrase')}'")
        print(f"Order Summary Read: {args.get('order_summary_read')}")
        print(f"Items (Raw): {args.get('order_items')}")
        print(f"Items (Structured JSON): {json.dumps({'order_details': formatted_details}, indent=2)}")
        print(f"Total: £{args.get('total_price')}")
        print("-------------------------------------------\n")

        # Forward in background to avoid blocking Vapi
        background_tasks.add_task(forward_order_task, business_id, assistant_id, args)

        call_id = str(data.get("callId") or request.query_params.get("callId") or "call_confirmed")

        # Return explicit instructions and data object required by save_order contract
        return {
            "status": "success",
            "data": {
                "success": True,
                "callId": call_id,
                "message": "Order saved successfully."
            },
            "result": "Order saved successfully. The kitchen has received the order. Immediately inform the customer their order is confirmed and politely say goodbye to end the call."
        }


    else:
        # This is a Vapi Server tool call
        message = data.get("message", {})

        # Extract assistant ID from the server tool payload
        call_data = message.get("call", {})
        assistant_id = call_data.get("assistantId", "Unknown")

        # Vapi might send 'toolCalls' or 'toolWithToolCallList' depending on the API version
        tool_calls = message.get("toolCalls", [])
        if not tool_calls and "toolWithToolCallList" in message:
            for item in message.get("toolWithToolCallList", []):
                if "toolCall" in item:
                    tool_calls.append(item["toolCall"])

        results = []
        for tool_call in tool_calls:
            args = tool_call.get("function", {}).get("arguments", {})

            # OpenAI/Vapi often send arguments as a JSON string
            if isinstance(args, str):
                try:
                    args = json.loads(args)
                except Exception:
                    args = {}
            business_id = message.get("customer", {}).get("metadata", {}).get("business_id", "Unknown")

            # MULTI-GATE CONFIRMATION VALIDATION
            is_valid, rejection_reason = validate_order_confirmation(args)
            if not is_valid:
                print(f"[REJECTED] ORDER REJECTED for {business_id}: {rejection_reason}")
                print(f"   Args: customer_confirmed={args.get('customer_confirmed')}, "
                      f"confirmation_phrase='{args.get('confirmation_phrase')}', "
                      f"order_summary_read={args.get('order_summary_read')}, "
                      f"total_price={args.get('total_price')}")
                results.append({
                    "toolCallId": tool_call.get("id"),
                    "result": f"ERROR: Order rejected by backend. {rejection_reason}. "
                              f"You MUST: (1) read the complete order summary to the customer, "
                              f"(2) ask 'Is that all correct?', "
                              f"(3) wait for the customer to say 'yes' or similar, "
                              f"(4) only THEN call save_order with customer_confirmed=true, "
                              f"confirmation_phrase set to the customer's exact words, "
                              f"and order_summary_read=true."
                })
                continue

            formatted_details = parse_and_format_order_details(args.get("order_items"), args.get("total_price"))

            print(f"\n--- [NEW ORDER RECEIVED] for {business_id} ---")
            print(f"Assistant ID: {assistant_id}")
            print(f"Customer: {args.get('customer_name')}")
            print(f"Email: {args.get('customer_email')}")
            print(f"Customer Confirmed: {args.get('customer_confirmed')}")
            print(f"Confirmation Phrase: '{args.get('confirmation_phrase')}'")
            print(f"Order Summary Read: {args.get('order_summary_read')}")
            print(f"Items (Raw): {args.get('order_items')}")
            print(f"Items (Structured JSON): {json.dumps({'order_details': formatted_details}, indent=2)}")
            print(f"Total: £{args.get('total_price')}")
            print("-------------------------------------------\n")

            # Forward in background to avoid blocking Vapi
            background_tasks.add_task(forward_order_task, business_id, assistant_id, args)

            # Return explicit instructions to the LLM
            results.append({
                "toolCallId": tool_call.get("id"),
                "data": {
                    "success": True,
                    "callId": str(assistant_id or "call_confirmed"),
                    "message": "Order saved successfully."
                },
                "result": "Order saved successfully. The kitchen has received the order. Immediately inform the customer their order is confirmed and politely say goodbye to end the call."
            })


        return {"results": results}


@router.post("/webhook/summary")
async def handle_summary(request: Request, background_tasks: BackgroundTasks):
    """Receives the POST-CALL summary from Vapi"""
    data = await request.json()

    message = data.get("message", {})

    # Only process 'end-of-call-report' or 'status-update' that actually has a summary
    call_data = message.get("call", data.get("call", {}))
    analysis = call_data.get("analysis", {})
    summary = analysis.get("summary")

    if not summary:
        return {"status": "ignored", "reason": "no summary in this packet"}

    business_id = call_data.get("metadata", {}).get("business_id", "Unknown")
    structured_data = analysis.get("structuredData")
    assistant_id = call_data.get("assistantId", "Unknown")
    ended_reason = call_data.get("endedReason", "unknown")

    print(f"\n--- [CALL SUMMARY] for {business_id} ---")
    print(f"AI Summary: {summary}")
    if structured_data:
        print(f"Structured Data: {json.dumps(structured_data, indent=2)}")
    print(f"Ended Reason: {ended_reason}")
    print(f"Transcript Snippet: {call_data.get('transcript', '')[:100]}...")
    print("------------------------------------------\n")

    # Forward post-call summary to external backend
    if EXTERNAL_BACKEND_URL and structured_data:
        background_tasks.add_task(
            forward_summary_task, business_id, assistant_id,
            structured_data, summary, ended_reason
        )

    return {"status": "received"}


@router.post("/")
@router.post("/api/webhook/vapi")
async def vapi_tool_fallback(request: Request, background_tasks: BackgroundTasks):
    """Central Webhook Router for Vapi (Receives Tools, Summaries, and Status Updates)"""
    try:
        data = await request.json()
    except Exception:
        return {"status": "error", "message": "Invalid JSON"}

    message = data.get("message", {})
    msg_type = message.get("type", data.get("type", ""))

    if msg_type == "tool-calls" or "toolCalls" in message or "toolWithToolCallList" in message or "customer_name" in data:
        # Route to Order Logic
        return await handle_order(request, background_tasks)
    elif msg_type in ["end-of-call-report", "status-update", "hang-up"]:
        # Route to Summary Logic
        return await handle_summary(request, background_tasks)
    else:
        return {"status": "ignored", "reason": f"Unhandled message type: {msg_type}"}
