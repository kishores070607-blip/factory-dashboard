# Factory Dashboard & Data Platform (Batch B)

Industrial conveyor-belt part counting system — central dashboard, event processing, and data platform running on Raspberry Pi 4. Implements the complete **Batch B Handbook** specification for edge vision monitoring.

---

## 🚀 Features (B1 – B12 Complete)

* **B1: Authentication & Role-Based Access Control**: 6 roles (`operator`, `supervisor`, `quality_engineer`, `maintenance_engineer`, `administrator`, `auditor`) with session cookies and `bcrypt` password hashing.
* **B2: Live Line Overview**: Real-time counter, rolling throughput rate (last 60s), target progress, and last-crossing timestamps via WebSockets.
* **B3: Multi-Line Plant Overview**: Live status cards with visual/color-and-text indicators (`ok`, `warning`, `critical`) for all conveyor lines.
* **B4: Event Explorer**: Paginated inspection of raw detection events with filters for line, device, part class, status, and time range.
* **B5: Shift & Batch Reports**: Compare planned targets vs actual production, hourly throughput bar distribution, and AI confidence metric breakdown.
* **B6: Device Maintenance & Telemetry**: Dedicated diagnostic view for camera status, FPS, inference latency, CPU %, RAM %, and thermal temperature. Includes remote command dispatch.
* **B7: Configuration Versioning**: Immutable versioning for edge ROI, crossing directions, sensitivity thresholds, and AI models with supervisor/admin approval workflows.
* **B8: Audited Event Correction Workflow**: Allows supervisors and administrators to void/annotate false triggers with a mandatory audit reason while keeping raw event records immutable.
* **B9: Alert Centre**: Active, acknowledged, and cleared incident tracking for device offline, camera faults, and thermal warnings.
* **B10: Data Export**: One-click RFC-compliant CSV export with active filter metadata and UTC timestamps.
* **B11: Offline / Stale Watchdog**: Automated background job detecting stale (>30s) and offline (>120s) edge units, auto-raising and clearing alerts.
* **B12: Hardware Simulator**: Built-in edge simulator supporting normal streaming, `--duplicate` packet handling, `--delay` latency, `--burst` queues, and `--fault` injection.

---

## 🛠 Tech Stack

* **Backend**: Node.js + Express
* **Database**: SQLite via `better-sqlite3` (WAL mode enabled, zero background daemon overhead)
* **Realtime**: WebSockets (`ws`)
* **Frontend**: Pure HTML5, modern CSS3, vanilla JavaScript (no framework build step overhead, optimized for Pi 4)
* **Testing**: Node.js native test runner (`node:test`) + `supertest`

---

## 📋 Quick Start

### Prerequisites
* Node.js 18+ (tested on Node 18, 20, 22, 26)
* Git

### Installation
```bash
git clone https://github.com/kishores070607-blip/factory-dashboard.git
cd factory-dashboard

# Copy environment template
cp .env.example .env

# Install dependencies
npm install

# Run database migrations and seed default data
npm run migrate

# Start the server
npm start
```

Open your browser to `http://localhost:3000` (or `http://<pi-ip>:3000`).

---

## 👤 Default Accounts & Roles

| Role | Username | Password | Permitted Capabilities |
|---|---|---|---|
| **Administrator** | `admin` | `admin123` | Full access (user management, lines, devices, config approvals) |
| **Supervisor** | `supervisor` | `supervisor123` | Line oversight, reports, target updates, and audited event voiding |
| **Maintenance Engineer** | `maintenance` | `maint123` | Hardware telemetry, diagnostics, and remote command dispatch |
| **Quality Engineer** | `quality` | `quality123` | Suspected events, discrepancy reports, and export validation |
| **Auditor** | `auditor` | `auditor123` | Read-only compliance view across historical events and audit logs |
| **Operator** | `operator` | `operator123` | Real-time line monitoring and alert acknowledgment |

---

## 📡 Edge Ingestion API

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/v1/events/count` | Ingest count event idempotently (`201` new, `200` duplicate) |
| `POST` | `/api/v1/devices/health` | Ingest periodic device health & thermal telemetry |
| `GET` | `/api/v1/config/:device_id` | Edge device pulls active approved configuration |
| `GET` | `/api/v1/devices/:device_id/commands` | Edge device polls for pending execution commands |
| `POST` | `/api/v1/devices/:device_id/commands/:id/ack` | Edge device acknowledges command execution |
| `GET` | `/health/live` | Process liveness probe |
| `GET` | `/health/ready` | Database readiness probe |

---

## 🧪 Running Simulator & Tests

```bash
# Run automated test suite (24 tests across 7 suites)
npm test

# Run simulator in standard mode
npm run simulate

# Run simulator with duplicate injection (tests idempotency)
npm run simulate:duplicate

# Run simulator with artificial network delay
npm run simulate:delay

# Run simulator in high-volume burst mode
npm run simulate:burst

# Run simulator with camera disconnect & thermal fault injection
npm run simulate:fault
```

---

## 📄 License
ISC
