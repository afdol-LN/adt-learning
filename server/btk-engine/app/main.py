from fastapi import FastAPI

from core.logging_config import setup_logging
from routers import kt

setup_logging()

app = FastAPI(
    title="KT-IDEM Knowledge Tracing Microservice",
    description=(
        "Bayesian Knowledge Tracing with per-item difficulty parameters "
        "(Knowledge Tracing - Item Difficulty Effect Model)."
    ),
    version="1.0.0",
)
 
app.include_router(kt.router, tags=["knowledge-tracing"])
 
 
@app.get("/health", tags=["ops"])
def health():
    return {"status": "ok"}