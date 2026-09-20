"""Main entry point for the CALAI Vapi AI Microservice."""
import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.agents import router as agents_router
from app.api.telephony import router as telephony_router
from app.api.agent_status import router as agent_status_router
from app.api.webhooks import router as webhooks_router

app = FastAPI(title="Vapi AI Microservice")

# Enable CORS for frontend clients
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

os.makedirs("uploads", exist_ok=True)


@app.get("/health")
async def health_check():
    return {"status": "ok", "service": "ai-service"}


# Mount API routers
app.include_router(agents_router)
app.include_router(telephony_router)
app.include_router(agent_status_router)
app.include_router(webhooks_router)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
