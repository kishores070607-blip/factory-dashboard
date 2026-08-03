from sqlalchemy import Column, Integer, String, Float, DateTime
from database import Base

class CountEventModel(Base):
    __tablename__ = "count_events"

    event_id = Column(String, primary_key=True, index=True)
    schema_version = Column(String)
    device_id = Column(String, index=True)
    line_id = Column(String, index=True)
    event_sequence = Column(Integer)
    event_time = Column(DateTime)
    part_class = Column(String)
    quantity = Column(Integer)
    confidence = Column(Float)
    track_id = Column(String)
    direction = Column(String)
    batch_id = Column(String, nullable=True)
    shift_id = Column(String, nullable=True)
    image_reference = Column(String, nullable=True)
    model_version = Column(String)
    processing_latency_ms = Column(Integer)
    status = Column(String)

class UserModel(Base):
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True)
    hashed_password = Column(String)
    role = Column(String)  # Operator, Supervisor, Administrator, etc.
