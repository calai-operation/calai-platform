"""Telephony management router for linking and unlinking Twilio phone numbers to Vapi assistants."""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from app.services.vapi_service import link_telephony, unlink_telephony
from app.storage.business_store import load_all_business_configs, save_business_config

router = APIRouter(prefix="/api/telephony", tags=["Telephony"])


class TelephonyLinkRequest(BaseModel):
    assistant_id: str
    twilio_number: str
    manager_number: str


@router.post("/link")
async def link_phone(request: TelephonyLinkRequest):
    """
    Links a Twilio phone number to a specific Vapi assistant.
    Also records the manager_number (can be used for call transfers later).
    """
    try:
        response = link_telephony(
            assistant_id=request.assistant_id,
            twilio_number=request.twilio_number,
            manager_number=request.manager_number
        )

        # Persist phone_number_id and fallback_number in business config
        phone_number_id = response.get("id") if isinstance(response, dict) else None
        if phone_number_id:
            configs = load_all_business_configs()
            for b_id, cfg in configs.items():
                if cfg.get("assistant_id") == request.assistant_id:
                    cfg["phone_number_id"] = phone_number_id
                    cfg["fallback_number"] = request.manager_number
                    if "agent_status" not in cfg:
                        cfg["agent_status"] = True
                    save_business_config(b_id, cfg)
                    break

        return {
            "status": "success",
            "message": "Telephony linked successfully.",
            "vapi_response": response
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/unlink/{phone_number_id}")
async def unlink_phone(phone_number_id: str):
    """
    Unlinks and deletes a Twilio phone number using its Vapi ID.
    """
    try:
        response = unlink_telephony(phone_number_id)
        return {
            "status": "success",
            "message": "Telephony unlinked successfully.",
            "vapi_response": response
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
