import os
from dotenv import load_dotenv, find_dotenv

# Explicitly find and load the .env file from the root directory
load_dotenv(find_dotenv(), override=True)

# Vapi API Settings
VAPI_API_KEY = os.getenv("VAPI_API_KEY", "your-vapi-api-key")
VAPI_BASE_URL = "https://api.vapi.ai"
VAPI_DEFAULT_TOOL_ID = os.getenv("VAPI_DEFAULT_TOOL_ID", "").strip()

def get_vapi_server_url() -> str:
    url = os.getenv("VAPI_SERVER_URL", "").strip()
    return url

VAPI_HEADERS = {
    "Authorization": f"Bearer {VAPI_API_KEY}",
    "Content-Type": "application/json"
}

# LLM & OpenAI Settings
LLM_MODEL = os.getenv("LLM_MODEL", "gpt-5.6-terra")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "").strip()

# External Backend
EXTERNAL_BACKEND_URL = os.getenv("EXTERNAL_BACKEND_URL", "").strip()

# Twilio Telephony Settings
TWILIO_ACCOUNT_SID = os.getenv("TWILIO_ACCOUNT_SID", "").strip()
TWILIO_AUTH_TOKEN = os.getenv("TWILIO_AUTH_TOKEN", "").strip()
