"""Agent management router for creating, configuring, and updating Vapi assistants."""
import os
import shutil
from typing import Optional, Union
from fastapi import APIRouter, UploadFile, Form, HTTPException, File
from pydantic import BaseModel

from app.services.document_service import extract_text
from app.services.prompt_service import extract_business_name, generate_uk_restaurant_prompt
from app.services.vapi_service import create_assistant
from app.storage.business_store import get_business_config, save_business_config, load_all_business_configs

router = APIRouter(prefix="/api/agents", tags=["Agents"])


class SpecialOffersUpdateRequest(BaseModel):
    enabled: bool
    special_offers_text: Optional[str] = None


@router.post("/create")
async def create_agent(
    business_id: str = Form(...),
    rules_file: UploadFile = File(...),
    menu_file: UploadFile = File(...),
    special_offers_text: str = Form(""),
    special_offers_file: Optional[Union[UploadFile, str]] = File(None),
    special_offers_enabled: bool = Form(True)
):
    """
    Creates or updates a Vapi assistant.
    Special offers are optional.
    The extracted rules/menu/offers are saved so they can be reused later when toggling offers on/off.
    """
    saved_paths = []

    try:
        os.makedirs("uploads", exist_ok=True)
        rules_path = f"uploads/{business_id}_rules_{rules_file.filename}"
        menu_path = f"uploads/{business_id}_menu_{menu_file.filename}"

        saved_paths.extend([rules_path, menu_path])

        with open(rules_path, "wb") as buffer:
            shutil.copyfileobj(rules_file.file, buffer)

        with open(menu_path, "wb") as buffer:
            shutil.copyfileobj(menu_file.file, buffer)

        rules_text = extract_text(rules_path)
        menu_text = extract_text(menu_path)

        offers_parts = []

        if special_offers_text and special_offers_text.strip():
            offers_parts.append(special_offers_text.strip())

        if special_offers_file and isinstance(special_offers_file, UploadFile) and special_offers_file.filename:
            offers_path = f"uploads/{business_id}_special_offers_{special_offers_file.filename}"
            saved_paths.append(offers_path)

            with open(offers_path, "wb") as buffer:
                shutil.copyfileobj(special_offers_file.file, buffer)

            extracted_offers = extract_text(offers_path).strip()

            if extracted_offers:
                offers_parts.append(extracted_offers)

        saved_special_offers_text = "\n".join(offers_parts).strip()

        active_special_offers_text = (
            saved_special_offers_text
            if special_offers_enabled and saved_special_offers_text
            else ""
        )

        business_name = extract_business_name(rules_text, business_id)

        system_prompt = generate_uk_restaurant_prompt(
            business_id,
            rules_text,
            menu_text,
            special_offers_text=active_special_offers_text,
            business_name=business_name
        )

        # Uses unified mother behavior baked directly into vapi_service
        vapi_response = create_assistant(business_id, system_prompt, business_name=business_name)

        save_business_config(
            business_id,
            {
                "business_id": business_id,
                "business_name": business_name,
                "rules_text": rules_text,
                "menu_text": menu_text,
                "special_offers_enabled": special_offers_enabled,
                "special_offers_text": saved_special_offers_text,
                "assistant_id": vapi_response.get("id")
            }
        )

        return {
            "status": "success",
            "business_id": business_id,
            "assistant_id": vapi_response.get("id"),
            "special_offers_enabled": special_offers_enabled,
            "special_offers_active_in_prompt": bool(active_special_offers_text),
            "message": "Agent created or updated successfully.",
            "vapi_response": vapi_response
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    finally:
        for path in saved_paths:
            try:
                if os.path.exists(path):
                    os.remove(path)
            except Exception:
                pass


@router.patch("/{business_id}/special-offers")
async def update_special_offers(
    business_id: str,
    request: SpecialOffersUpdateRequest
):
    """
    Turns special offers on or off.
    This regenerates the full system prompt and updates the existing Vapi assistant.
    """
    try:
        config = get_business_config(business_id)

        if not config:
            raise HTTPException(
                status_code=404,
                detail="Business config not found. Create the agent first using /api/agents/create."
            )

        current_saved_offers = config.get("special_offers_text", "").strip()

        # If special_offers_text is provided, update the saved offer text.
        # If it is not provided, keep the previous saved offer text.
        if request.special_offers_text is not None:
            saved_special_offers_text = request.special_offers_text.strip()
        else:
            saved_special_offers_text = current_saved_offers

        active_special_offers_text = (
            saved_special_offers_text
            if request.enabled and saved_special_offers_text
            else ""
        )

        business_name = extract_business_name(config["rules_text"], business_id)

        system_prompt = generate_uk_restaurant_prompt(
            business_id,
            config["rules_text"],
            config["menu_text"],
            special_offers_text=active_special_offers_text,
            business_name=business_name
        )

        vapi_response = create_assistant(business_id, system_prompt, business_name=business_name)

        config["special_offers_enabled"] = request.enabled
        config["special_offers_text"] = saved_special_offers_text
        config["assistant_id"] = vapi_response.get("id")

        save_business_config(business_id, config)

        return {
            "status": "success",
            "business_id": business_id,
            "assistant_id": vapi_response.get("id"),
            "special_offers_enabled": request.enabled,
            "special_offers_active_in_prompt": bool(active_special_offers_text),
            "message": (
                "Special offers are now enabled in the assistant prompt."
                if request.enabled
                else "Special offers are now removed from the assistant prompt."
            )
        }

    except HTTPException:
        raise


@router.post("/upload-special-offers")
async def upload_special_offers(
    assistant_id: str = Form(...),
    special_offers_file: UploadFile = File(...),
    special_offers_text: str = Form(""),
    special_offers_enabled: bool = Form(True)
):
    """
    Uploads a special offers file (.pdf, .docx, .doc, .txt, .xlsx, .csv) for an existing Vapi assistant using assistant_id.
    Extracts text, updates the stored business config, rebuilds the system prompt, and updates the live Vapi assistant.
    """
    saved_paths = []
    try:
        configs = load_all_business_configs()
        business_id = None
        config = None
        for b_id, c in configs.items():
            if c.get("assistant_id") == assistant_id or b_id == assistant_id:
                business_id = b_id
                config = c
                break

        if not config:
            raise HTTPException(
                status_code=404,
                detail=f"Business config not found for assistant_id or business_id '{assistant_id}'. Create the agent first using /api/agents/create."
            )

        offers_parts = []
        if special_offers_text and special_offers_text.strip():
            offers_parts.append(special_offers_text.strip())

        if special_offers_file and special_offers_file.filename:
            os.makedirs("uploads", exist_ok=True)
            offers_path = f"uploads/{business_id}_special_offers_{special_offers_file.filename}"
            saved_paths.append(offers_path)

            with open(offers_path, "wb") as buffer:
                shutil.copyfileobj(special_offers_file.file, buffer)

            extracted_offers = extract_text(offers_path).strip()
            if extracted_offers:
                offers_parts.append(extracted_offers)

        if not offers_parts:
            raise HTTPException(
                status_code=400,
                detail="The uploaded special offers file appears to be empty or could not be read."
            )

        saved_special_offers_text = "\n\n".join(offers_parts).strip()
        active_special_offers_text = (
            saved_special_offers_text if special_offers_enabled else ""
        )

        rules_text = config.get("rules_text", "")
        menu_text = config.get("menu_text", "")
        business_name = config.get("business_name") or extract_business_name(rules_text, business_id)

        system_prompt = generate_uk_restaurant_prompt(
            business_id,
            rules_text,
            menu_text,
            special_offers_text=active_special_offers_text,
            business_name=business_name
        )

        vapi_response = create_assistant(business_id, system_prompt, business_name=business_name)

        config["special_offers_enabled"] = special_offers_enabled
        config["special_offers_text"] = saved_special_offers_text
        config["assistant_id"] = vapi_response.get("id")

        save_business_config(business_id, config)

        return {
            "status": "success",
            "business_id": business_id,
            "assistant_id": vapi_response.get("id"),
            "special_offers_enabled": special_offers_enabled,
            "special_offers_text": saved_special_offers_text,
            "message": "Special offers file uploaded and Vapi assistant updated successfully.",
            "vapi_response": vapi_response
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        for path in saved_paths:
            try:
                if os.path.exists(path):
                    os.remove(path)
            except Exception:
                pass


@router.patch("/menu")
async def update_menu(
    assistant_id: str,
    menu_file: UploadFile = File(...)
):
    """
    Updates the menu for an existing Vapi assistant.

    Accepts a new menu file (.xlsx, .pdf, .docx, .txt, .csv), extracts its text,
    rebuilds the full system prompt using the stored rules and offers, then
    PATCHes the live Vapi assistant in-place. The stored business config is also
    updated with the new menu_text.

    Rules, special offers, and the enabled/disabled offers toggle are all preserved.
    """
    menu_path = None
    try:
        configs = load_all_business_configs()
        business_id = None
        config = None
        for b_id, c in configs.items():
            if c.get("assistant_id") == assistant_id:
                business_id = b_id
                config = c
                break

        if not config:
            raise HTTPException(
                status_code=404,
                detail=f"Business config not found for assistant_id '{assistant_id}'. Create the agent first using /api/agents/create."
            )

        os.makedirs("uploads", exist_ok=True)
        menu_path = f"uploads/{business_id}_menu_{menu_file.filename}"

        with open(menu_path, "wb") as buffer:
            shutil.copyfileobj(menu_file.file, buffer)

        new_menu_text = extract_text(menu_path)

        if not new_menu_text or not new_menu_text.strip():
            raise HTTPException(
                status_code=400,
                detail="The uploaded menu file appears to be empty or could not be read."
            )

        rules_text = config.get("rules_text", "")
        special_offers_enabled = config.get("special_offers_enabled", True)
        saved_special_offers_text = config.get("special_offers_text", "").strip()

        active_special_offers_text = (
            saved_special_offers_text
            if special_offers_enabled and saved_special_offers_text
            else ""
        )

        business_name = extract_business_name(rules_text, business_id)

        system_prompt = generate_uk_restaurant_prompt(
            business_id,
            rules_text,
            new_menu_text,
            special_offers_text=active_special_offers_text,
            business_name=business_name
        )

        vapi_response = create_assistant(business_id, system_prompt, business_name=business_name)

        config["menu_text"] = new_menu_text
        config["assistant_id"] = vapi_response.get("id")
        save_business_config(business_id, config)

        menu_preview = new_menu_text.strip()[:300]

        return {
            "status": "success",
            "business_id": business_id,
            "assistant_id": vapi_response.get("id"),
            "message": "Menu updated successfully. The assistant prompt has been refreshed with the new menu.",
            "menu_preview": menu_preview + ("..." if len(new_menu_text.strip()) > 300 else "")
        }

    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        try:
            if menu_path and os.path.exists(menu_path):
                os.remove(menu_path)
        except Exception:
            pass
