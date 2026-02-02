from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .database import engine, Base
from .routers import documents, share, users

# Create database tables
Base.metadata.create_all(bind=engine)

app = FastAPI(title="Red Ink API", version="0.1.0")

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(documents.router, prefix="/api/documents", tags=["documents"])
app.include_router(share.router, prefix="/api/share", tags=["share"])
app.include_router(users.router, prefix="/api/users", tags=["users"])


@app.get("/api/health")
def health_check():
    return {"status": "ok"}
