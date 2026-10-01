const crypto = require('crypto');

const args = process.argv.slice(2);
const options = {
    url: 'http://localhost:3000',
    devices: 3,
    interval: 2000,
    healthInterval: 10000,
    duplicate: false,
    delay: false,
    burst: false,
    fault: false
};

for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
        case '--url': options.url = args[++i]; break;
        case '--devices': options.devices = parseInt(args[++i], 10); break;
        case '--interval': options.interval = parseInt(args[++i], 10); break;
        case '--healthInterval': options.healthInterval = parseInt(args[++i], 10); break;
        case '--duplicate': options.duplicate = true; break;
        case '--delay': options.delay = true; break;
        case '--burst': options.burst = true; break;
        case '--fault': options.fault = true; break;
    }
}

const devices = Array.from({ length: options.devices }, (_, i) => ({
    id: `dev-${String(i + 1).padStart(3, '0')}`,
    line: i < 2 ? 'line-1' : 'line-2',
    sequence: 1,
    lastEventId: null,
    healthCount: 0
}));

const partClasses = ['widget-A', 'widget-B', 'gasket-C', 'bearing-D'];
const stats = { sent: 0, duplicates: 0, errors: 0, commandsExecuted: 0 };

const colors = {
    reset: '\x1b[0m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    red: '\x1b[31m',
    cyan: '\x1b[36m',
    magenta: '\x1b[35m'
};

console.log(`${colors.cyan}--- Simulator Configuration ---${colors.reset}`);
console.log(`URL: ${options.url}`);
console.log(`Devices: ${options.devices}`);
console.log(`Event Interval: ${options.interval}ms`);
console.log(`Health Interval: ${options.healthInterval}ms`);
console.log(`Duplicate Mode: ${options.duplicate ? 'ON' : 'OFF'}`);
console.log(`Delay Mode: ${options.delay ? 'ON' : 'OFF'}`);
console.log(`Burst Mode: ${options.burst ? 'ON' : 'OFF'}`);
console.log(`Fault Injection Mode: ${options.fault ? 'ON' : 'OFF'}`);
console.log(`-------------------------------\n`);

async function sendRequest(path, payload = null, method = 'POST') {
    try {
        const fetchOpts = {
            method,
            headers: { 'Content-Type': 'application/json' }
        };
        if (payload && method !== 'GET') {
            fetchOpts.body = JSON.stringify(payload);
        }
        const response = await fetch(`${options.url}${path}`, fetchOpts);
        return { status: response.status, data: await response.json().catch(() => ({})) };
    } catch (err) {
        return { status: 500, error: err.message };
    }
}

async function sendEvent(device, isDuplicate = false, isDelayed = false) {
    const eventId = isDuplicate && device.lastEventId ? device.lastEventId : crypto.randomUUID();
    if (!isDuplicate) device.lastEventId = eventId;
    
    const payload = {
        event_id: eventId,
        device_id: device.id,
        line_id: device.line,
        batch_id: device.line === 'line-1' ? 'BATCH-260730-A' : 'BATCH-260730-B',
        shift_id: 'SHIFT-1',
        event_time: new Date().toISOString(),
        event_sequence: device.sequence++,
        part_class: partClasses[Math.floor(Math.random() * partClasses.length)],
        quantity: 1,
        confidence: Number((Math.random() * (0.99 - 0.85) + 0.85).toFixed(3)),
        direction: 'forward',
        model_version: 'parts-yolo-1.3.0',
        processing_latency_ms: Math.floor(Math.random() * 30 + 15)
    };

    if (isDelayed) {
        console.log(`${colors.yellow}Delaying event ${eventId.substring(0, 8)} for 5s...${colors.reset}`);
        await new Promise(resolve => setTimeout(resolve, 5000));
    }

    const { status, error } = await sendRequest('/api/v1/events/count', payload);
    
    stats.sent++;
    
    if (status === 201) {
        console.log(`${colors.green}[201] Event sent: ${device.id} | ${eventId.substring(0, 8)}${colors.reset}`);
    } else if (status === 200) {
        stats.duplicates++;
        console.log(`${colors.yellow}[200] Duplicate sent: ${device.id} | ${eventId.substring(0, 8)}${colors.reset}`);
    } else {
        stats.errors++;
        console.log(`${colors.red}[${status}] Error sending event: ${error || 'Unknown Error'}${colors.reset}`);
    }
}

async function sendHealth(device) {
    device.healthCount++;
    let camStatus = 'connected';
    let tempC = Number((Math.random() * 15 + 45).toFixed(1));

    // Fault injection: simulate fault every 3rd health sample if enabled
    if (options.fault && device.healthCount % 3 === 0) {
        camStatus = 'disconnected';
        tempC = 84.5; // High thermal warning
        console.log(`${colors.red}[FAULT INJECTED] ${device.id}: camera disconnected, thermal spike (${tempC}C)${colors.reset}`);
    }

    const payload = {
        device_id: device.id,
        timestamp: new Date().toISOString(),
        fps: Number((Math.random() * 5 + 25).toFixed(1)),
        inference_latency_ms: Math.floor(Math.random() * 30 + 15),
        cpu_percent: Number((Math.random() * 30 + 20).toFixed(1)),
        memory_percent: Number((Math.random() * 20 + 40).toFixed(1)),
        temperature_c: tempC,
        queue_depth: Math.floor(Math.random() * 3),
        service_status: 'running',
        camera_status: camStatus,
        model_version: 'parts-yolo-1.3.0',
        app_version: '1.0.0'
    };

    const { status, error } = await sendRequest('/api/v1/devices/health', payload);
    if (status !== 201 && status !== 200) {
        console.log(`${colors.red}[${status}] Health error for ${device.id}: ${error || 'Unknown Error'}${colors.reset}`);
    }

    // Check for pending remote commands and acknowledge them
    const { data: commands } = await sendRequest(`/api/v1/devices/${device.id}/commands`, null, 'GET');
    if (Array.isArray(commands) && commands.length > 0) {
        for (const cmd of commands) {
            console.log(`${colors.magenta}[COMMAND RECEIVED] ${device.id} executing: ${cmd.command_type} (#${cmd.command_id})${colors.reset}`);
            await sendRequest(`/api/v1/devices/${device.id}/commands/${cmd.command_id}/ack`, {}, 'POST');
            stats.commandsExecuted++;
            console.log(`${colors.magenta}[COMMAND ACKNOWLEDGED] #${cmd.command_id}${colors.reset}`);
        }
    }
}

const intervals = [];

devices.forEach(device => {
    let eventCount = 0;
    intervals.push(setInterval(() => {
        eventCount++;
        
        let isDuplicate = false;
        let isDelayed = false;

        if (options.duplicate && eventCount % 10 === 0) isDuplicate = true;
        if (options.delay && eventCount % 15 === 0) isDelayed = true;
        
        if (isDelayed) {
            sendEvent(device, isDuplicate, true);
        } else {
            sendEvent(device, isDuplicate);
        }

        // Burst mode: rapidly emit 15 events
        if (options.burst && eventCount % 20 === 0) {
            console.log(`${colors.cyan}[BURST] Device ${device.id} emitting 15 rapid events...${colors.reset}`);
            for (let b = 0; b < 15; b++) {
                sendEvent(device, false);
            }
        }
    }, options.interval));

    intervals.push(setInterval(() => {
        sendHealth(device);
    }, options.healthInterval));
});

process.on('SIGINT', () => {
    intervals.forEach(clearInterval);
    console.log(`\n${colors.cyan}--- Simulator Stopped ---${colors.reset}`);
    console.log(`Total Events Sent: ${stats.sent}`);
    console.log(`Duplicates Sent: ${stats.duplicates}`);
    console.log(`Commands Executed: ${stats.commandsExecuted}`);
    console.log(`Errors: ${stats.errors}`);
    console.log(`-------------------------`);
    process.exit(0);
});
