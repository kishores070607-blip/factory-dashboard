# Deployment Guide

Comprehensive deployment guide for running the Dashboard Platform on a Raspberry Pi 4.

## Prerequisites
- **Hardware**: Raspberry Pi 4 (8GB recommended)
- **OS**: Raspberry Pi OS (64-bit Bookworm)
- **Software**: Node.js 18+ (install via NodeSource or nvm)

## Quick Start
1. Clone the repository:
   ```bash
   git clone <repo>
   cd dashboard-platform
   ```
2. Setup environment variables:
   ```bash
   cp .env.example .env
   ```
3. Install dependencies and start:
   ```bash
   npm install
   npm run migrate
   npm start
   ```

## Running the Simulator
The simulator generates fake events and health data for testing. It runs standalone without external dependencies.

**Basic Usage:**
```bash
node simulator/simulate.js
```

**Custom URL and Device Count:**
```bash
node simulator/simulate.js --url http://192.168.1.100:3000 --devices 5
```

**Duplicate Mode:**
Tests idempotent event ingestion by resending duplicate `event_id`s every 10 events.
```bash
node simulator/simulate.js --duplicate
```

**Delay Mode:**
Tests out-of-order and delayed event processing by holding back events periodically.
```bash
node simulator/simulate.js --delay
```

## Accessing the Dashboard
- Open a web browser to `http://<pi-ip>:3000`
- **Default Login**: `admin` / `admin123`
- **IMPORTANT**: Change the default password immediately after logging in!

## Production Hardening (Later Sprints)
For a robust production environment, consider these steps:
- **Process Management**: Use `PM2` or set up a `systemd` service to ensure the app restarts on crash/reboot.
- **Firewall**: Configure Pi firewall (`ufw`) to restrict access.
- **Security**: Set a strong, randomly generated `SESSION_SECRET` in `.env`.
- **Backups**: Schedule regular database backups via cron:
  ```bash
  cp data/dashboard.db data/backup-$(date +%Y%m%d).db
  ```

## Architecture
```
[ Edge Devices ] ---> ( HTTP POST /api/v1/events ) ---> [ Express Server ]
                                                             |
                                                        [ SQLite ]
                                                             |
[ Browser UI ] <--- ( HTTP GET /api/events ) <--------- [ Express Server ]
```

## Troubleshooting
- **Port 3000 in use**: Ensure no other service is running on port 3000. Change the `PORT` in `.env` if necessary.
- **Database lock errors**: SQLite is a file-based DB. High concurrency might lock it. Ensure the backend implements retry mechanisms for DB writes.
- **App crashing on start**: Verify Node.js version is 18+ (`node -v`) and run `npm run migrate` before starting.
