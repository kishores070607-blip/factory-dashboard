import time
import uuid
import random
import requests
from datetime import datetime, timezone

API_URL = "http://127.0.0.1:8000/api/v1/events/count"

PART_CLASSES = ["bearing_cap", "gear_pinion", "bolt_m8", "washer_heavy"]
DEVICES = ["EDGE-LINE-01", "EDGE-LINE-02"]

sequence_counter = 1

def generate_fake_event():
    global sequence_counter
    
    event = {
        "schema_version": "1.0",
        "event_id": str(uuid.uuid4()),
        "device_id": random.choice(DEVICES),
        "line_id": "LINE-A",
        "event_sequence": sequence_counter,
        "event_time": datetime.now(timezone.utc).isoformat(),
        "part_class": random.choice(PART_CLASSES),
        "quantity": 1,
        "confidence": round(random.uniform(0.85, 0.99), 2),
        "track_id": f"trk-{random.randint(1000, 9999)}",
        "direction": "forward",
        "batch_id": "BATCH-2026-08A",
        "shift_id": "SHIFT-1",
        "image_reference": None,
        "model_version": "parts-yolo-1.3.0",
        "processing_latency_ms": random.randint(45, 120),
        "status": "accepted"
    }
    
    sequence_counter += 1
    return event

def run_simulator():
    print("🚀 Edge Camera Simulator Started! Press Ctrl+C to stop.\n")
    while True:
        payload = generate_fake_event()
        try:
            response = requests.post(API_URL, json=payload)
            if response.status_code in [200, 201]:
                print(f"[SENT] Event #{payload['event_sequence']} | Part: {payload['part_class']} | ID: {payload['event_id'][:8]}...")
            else:
                print(f"[ERROR] Failed to send event: {response.status_code} - {response.text}")
        except Exception as e:
            print(f"[CONNECTION ERROR] Could not connect to API server: {e}")
            
        time.sleep(random.uniform(2.0, 4.0))

if __name__ == "__main__":
    run_simulator()

