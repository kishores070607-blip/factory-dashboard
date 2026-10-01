const deviceRepository = require('../persistence/repositories/deviceRepository');
const alertRepository = require('../persistence/repositories/alertRepository');
const { broadcast } = require('../realtime/websocket');

/**
 * Starts the staleness checker service interval.
 * @returns {NodeJS.Timeout} The interval ID.
 */
function startStalenessChecker() {
    const STALE_THRESHOLD_S = parseInt(process.env.STALE_THRESHOLD_S || '30', 10);
    const OFFLINE_THRESHOLD_S = parseInt(process.env.OFFLINE_THRESHOLD_S || '120', 10);
    const STALENESS_CHECK_INTERVAL_MS = parseInt(process.env.STALENESS_CHECK_INTERVAL_MS || '10000', 10);

    const intervalId = setInterval(() => {
        try {
            const devices = deviceRepository.findAll();
            const now = new Date();

            for (const device of devices) {
                if (!device.last_seen) continue;

                const diffS = (now - new Date(device.last_seen)) / 1000;

                if (diffS > OFFLINE_THRESHOLD_S) {
                    if (device.status !== 'offline') {
                        deviceRepository.updateStatus(device.device_id, 'offline', device.last_seen);
                        
                        const activeAlert = alertRepository.findActiveByDeviceAndRule(device.device_id, 'device_offline');
                        if (!activeAlert) {
                            alertRepository.insert({
                                severity: 'critical',
                                rule: 'device_offline',
                                source_device_id: device.device_id,
                                raised_at: now.toISOString()
                            });
                            broadcast('alert_raised', {
                                rule: 'device_offline',
                                device: device.device_id,
                                severity: 'critical'
                            });
                        }
                        broadcast('device_status', { device_id: device.device_id, status: 'offline' });
                        broadcast('device_status_change', { device_id: device.device_id, status: 'offline' });
                    }
                } else if (diffS > STALE_THRESHOLD_S) {
                    if (device.status !== 'stale') {
                        deviceRepository.updateStatus(device.device_id, 'stale', device.last_seen);
                        
                        const activeAlert = alertRepository.findActiveByDeviceAndRule(device.device_id, 'device_stale');
                        if (!activeAlert) {
                            alertRepository.insert({
                                severity: 'warning',
                                rule: 'device_stale',
                                source_device_id: device.device_id,
                                raised_at: now.toISOString()
                            });
                            broadcast('alert_raised', {
                                rule: 'device_stale',
                                device: device.device_id,
                                severity: 'warning'
                            });
                        }
                        broadcast('device_status', { device_id: device.device_id, status: 'stale' });
                        broadcast('device_status_change', { device_id: device.device_id, status: 'stale' });
                    }
                } else {
                    if (device.status === 'stale' || device.status === 'offline') {
                        deviceRepository.updateStatus(device.device_id, 'online', device.last_seen);
                        
                        const activeStale = alertRepository.findActiveByDeviceAndRule(device.device_id, 'device_stale');
                        if (activeStale) {
                            alertRepository.clear(activeStale.alert_id);
                        }
                        
                        const activeOffline = alertRepository.findActiveByDeviceAndRule(device.device_id, 'device_offline');
                        if (activeOffline) {
                            alertRepository.clear(activeOffline.alert_id);
                        }
                        
                        broadcast('device_status', { device_id: device.device_id, status: 'online' });
                        broadcast('device_status_change', { device_id: device.device_id, status: 'online' });
                    }
                }
            }
        } catch (error) {
            console.error('Error in staleness checker interval:', error);
        }
    }, STALENESS_CHECK_INTERVAL_MS);

    return intervalId;
}

module.exports = { startStalenessChecker };
