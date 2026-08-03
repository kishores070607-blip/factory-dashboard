from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.responses import HTMLResponse
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime, timezone
from enum import Enum
from sqlalchemy.orm import Session
from sqlalchemy import func
import jwt

import models
from database import engine, get_db, SessionLocal
import security

# 1. Initialize DB tables
models.Base.metadata.create_all(bind=engine)

# 2. Seed Default Accounts for ALL Roles Automatically
def seed_default_users():
    db = SessionLocal()
    try:
        demo_accounts = [
            ("operator", "op123", "Operator"),
            ("supervisor", "sup123", "Supervisor"),
            ("quality", "qual123", "Quality Engineer"),
            ("maint", "maint123", "Maintenance Engineer"),
            ("admin", "admin123", "Administrator"),
            ("auditor", "audit123", "Auditor")
        ]
        
        for username, plain_pwd, role in demo_accounts:
            existing = db.query(models.UserModel).filter(models.UserModel.username == username).first()
            if not existing:
                hashed_pwd = security.get_password_hash(plain_pwd)
                user_obj = models.UserModel(username=username, hashed_password=hashed_pwd, role=role)
                db.add(user_obj)
        db.commit()
        print("👥 All Demo Role Users Successfully Seeded!")
    finally:
        db.close()

seed_default_users()

app = FastAPI(title="Batch B Dashboard API")

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/token")

RESET_BASELINE = datetime(1970, 1, 1, tzinfo=timezone.utc)

class UserCreate(BaseModel):
    username: str
    password: str
    role: str

async def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    try:
        payload = jwt.decode(token, security.SECRET_KEY, algorithms=[security.ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise HTTPException(status_code=401, detail="Invalid authentication token")
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Invalid authentication token")
        
    user = db.query(models.UserModel).filter(models.UserModel.username == username).first()
    if user is None:
        raise HTTPException(status_code=401, detail="User not found")
    return user

@app.post("/api/v1/auth/token")
async def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(models.UserModel).filter(models.UserModel.username == form_data.username).first()
    if not user or not security.verify_password(form_data.password, user.hashed_password):
        raise HTTPException(status_code=400, detail="Incorrect username or password")
        
    access_token = security.create_access_token(data={"sub": user.username, "role": user.role})
    return {"access_token": access_token, "token_type": "bearer", "role": user.role, "username": user.username}

@app.get("/api/v1/users/me")
async def get_my_profile(current_user: models.UserModel = Depends(get_current_user)):
    return {"username": current_user.username, "role": current_user.role}

# ---------------- CONVEYOR COUNT EVENT ROUTES ----------------
class DirectionEnum(str, Enum):
    forward = "forward"
    reverse = "reverse"

class StatusEnum(str, Enum):
    accepted = "accepted"
    suspected = "suspected"
    manually_voided = "manually_voided"

class CountEvent(BaseModel):
    schema_version: str = Field(default="1.0")
    event_id: str = Field(...)
    device_id: str = Field(...)
    line_id: str = Field(...)
    event_sequence: int = Field(...)
    event_time: datetime = Field(...)
    part_class: str = Field(...)
    quantity: int = Field(default=1)
    confidence: float = Field(..., ge=0, le=1)
    track_id: str = Field(...)
    direction: DirectionEnum = Field(...)
    batch_id: Optional[str] = Field(None)
    shift_id: Optional[str] = Field(None)
    image_reference: Optional[str] = Field(None)
    model_version: str = Field(...)
    processing_latency_ms: int = Field(...)
    status: StatusEnum = Field(...)

@app.post("/api/v1/events/count", status_code=201)
async def receive_count_event(event: CountEvent, db: Session = Depends(get_db)):
    existing_event = db.query(models.CountEventModel).filter(models.CountEventModel.event_id == event.event_id).first()
    if existing_event:
        return {"status": "duplicate_ignored", "event_id": event.event_id}

    db_event = models.CountEventModel(
        event_id=event.event_id,
        schema_version=event.schema_version,
        device_id=event.device_id,
        line_id=event.line_id,
        event_sequence=event.event_sequence,
        event_time=event.event_time,
        part_class=event.part_class,
        quantity=event.quantity,
        confidence=event.confidence,
        track_id=event.track_id,
        direction=event.direction.value,
        batch_id=event.batch_id,
        shift_id=event.shift_id,
        image_reference=event.image_reference,
        model_version=event.model_version,
        processing_latency_ms=event.processing_latency_ms,
        status=event.status.value
    )
    db.add(db_event)
    db.commit()
    return {"status": "created", "event_id": event.event_id}

@app.post("/api/v1/metrics/reset")
async def reset_counter():
    global RESET_BASELINE
    RESET_BASELINE = datetime.now(timezone.utc)
    return {"message": "Counter reset successfully", "reset_time": RESET_BASELINE.isoformat()}

@app.get("/api/v1/metrics/summary")
async def get_production_summary(db: Session = Depends(get_db)):
    global RESET_BASELINE
    query = db.query(models.CountEventModel).filter(models.CountEventModel.event_time >= RESET_BASELINE)
    total_parts = query.count()
    
    part_counts = (
        db.query(models.CountEventModel.part_class, func.count(models.CountEventModel.event_id))
        .filter(models.CountEventModel.event_time >= RESET_BASELINE)
        .group_by(models.CountEventModel.part_class)
        .all()
    )
    breakdown = {part: count for part, count in part_counts}

    recent_events = (
        query.order_by(models.CountEventModel.event_time.desc())
        .limit(5)
        .all()
    )
    
    recent_list = [
        {
            "event_id": e.event_id[:8],
            "part": e.part_class,
            "device": e.device_id,
            "latency": e.processing_latency_ms,
            "confidence": e.confidence
        }
        for e in recent_events
    ]

    return {
        "total_parts_counted": total_parts,
        "line_id": "LINE-A",
        "status": "ONLINE",
        "last_reset": RESET_BASELINE.isoformat(),
        "part_breakdown": breakdown,
        "recent_events": recent_list
    }

@app.get("/", response_class=HTMLResponse)
async def get_dashboard():
    with open("index.html", "r") as f:
        return f.read()
