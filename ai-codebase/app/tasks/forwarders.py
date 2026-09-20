"""Background task workers for forwarding orders and call summaries to external backend."""
import requests
from app.config import EXTERNAL_BACKEND_URL
from app.services.order_parser import parse_and_format_order_details


def forward_order_task(business_id: str, assistant_id: str, args: dict):
    """Runs in the background to prevent Vapi tool timeouts"""
    if EXTERNAL_BACKEND_URL:
        try:
            # Parse and format the order items safely in the background
            order_details = parse_and_format_order_details(args.get("order_items"), args.get("total_price"))

            forward_payload = {
                "assistantId": assistant_id,
                "business_id": business_id,
                "customer_name": args.get("customer_name"),
                "customer_email": args.get("customer_email"),
                "customer_confirmed": True,
                "order_status": "confirmed",
                "order_items": args.get("order_items"),  # KEEP original key for backward compatibility
                "order_details": order_details,          # ADD new requested JSON format
                "items": order_details,                  # ADD items key matching user requested schema
                "total_price": args.get("total_price"),
                "payment_method": args.get("payment_method", "unknown"),
                "delivery_type": args.get("delivery_type", "unknown"),
                "delivery_address": args.get("delivery_address", ""),
                "customer_phone": args.get("customer_phone", ""),
                "source": "vapi_voice_agent"
            }
            requests.post(EXTERNAL_BACKEND_URL, json=forward_payload, timeout=5)
            print(f"[FORWARD SUCCESS] Order forwarded to {EXTERNAL_BACKEND_URL}")
        except Exception as e:
            print(f"[FORWARD ERROR] Failed to forward order: {str(e)}")


def forward_summary_task(business_id: str, assistant_id: str,
                         structured_data: dict, summary: str, ended_reason: str):
    """Forwards post-call structured data to the external backend"""
    if not EXTERNAL_BACKEND_URL:
        return
    try:
        # Determine order status from structured data
        order_status = structured_data.get("order_status", "abandoned")
        customer_confirmed = structured_data.get("customer_confirmed", False)
        save_order_was_called = structured_data.get("save_order_was_called", False)

        # Safety: if customer didn't confirm, force status to abandoned
        if not customer_confirmed and order_status == "completed":
            order_status = "abandoned"
            print(f"[SAFETY NET] for {business_id}: Post-call analysis says 'completed' but customer_confirmed=false. Forcing to 'abandoned'.")

        # Safety: if save_order was never called, force status to abandoned
        if not save_order_was_called and order_status == "completed":
            order_status = "abandoned"
            print(f"[SAFETY NET] for {business_id}: Post-call analysis says 'completed' but save_order was never called. Forcing to 'abandoned'.")

        # Safety: if total is 0/None and status is completed, mark as abandoned
        total_price = structured_data.get("total_price", 0)
        if (total_price is None or total_price == 0) and order_status == "completed":
            order_status = "abandoned"
            print(f"[SAFETY NET] for {business_id}: Post-call analysis says 'completed' but total_price is {total_price}. Forcing to 'abandoned'.")

        summary_payload = {
            "type": "call_summary",
            "assistantId": assistant_id,
            "business_id": business_id,
            "order_status": order_status,
            "customer_confirmed": customer_confirmed,
            "save_order_was_called": save_order_was_called,
            "customer_name": structured_data.get("customer_name", ""),
            "items": structured_data.get("items", []),
            "total_price": total_price,
            "payment_method": structured_data.get("payment_method", "unknown"),
            "delivery_type": structured_data.get("delivery_type", "unknown"),
            "delivery_address": structured_data.get("delivery_address", ""),
            "ai_summary": summary,
            "ended_reason": ended_reason,
            "source": "vapi_post_call_analysis"
        }

        requests.post(EXTERNAL_BACKEND_URL, json=summary_payload, timeout=5)
        print(f"[FORWARD SUCCESS] Call summary forwarded to {EXTERNAL_BACKEND_URL} (status: {order_status})")
    except Exception as e:
        print(f"[FORWARD ERROR] Failed to forward call summary: {str(e)}")
