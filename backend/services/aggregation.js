const lineRepository = require('../persistence/repositories/lineRepository');
const deviceRepository = require('../persistence/repositories/deviceRepository');
const eventRepository = require('../persistence/repositories/eventRepository');

/**
 * Gets a detailed overview of a single line.
 * @param {string} lineId The ID of the line.
 * @returns {Object} The aggregated overview object for the line.
 */
function getLineOverview(lineId) {
    const line = lineRepository.findById(lineId);
    if (!line) {
        throw new Error(`Line with ID ${lineId} not found`);
    }

    const devices = deviceRepository.findByLine(lineId);
    
    const startOfToday = new Date();
    startOfToday.setUTCHours(0, 0, 0, 0);
    const totalToday = eventRepository.countByLine(lineId, startOfToday.toISOString());

    const recentEvents = eventRepository.recentByLine(lineId, 60);
    
    let lastEventTime = null;
    if (recentEvents.length > 0) {
        lastEventTime = recentEvents[0].event_time;
    }

    let status = 'ok';
    if (devices.some(d => d.status === 'offline')) {
        status = 'critical';
    } else if (devices.some(d => d.status === 'stale')) {
        status = 'warning';
    }

    return {
        lineId: line.line_id,
        id: line.line_id,
        name: line.name || line.line_id,
        location: line.location,
        totalToday,
        total_count_today: totalToday,
        ratePerMinute: recentEvents.length,
        rate_per_min: recentEvents.length,
        lastEventTime,
        devices: devices.map(d => ({
            ...d,
            id: d.device_id,
            name: d.display_name || d.device_id
        })),
        status
    };
}

/**
 * Gets the overview for all lines.
 * @returns {Array<Object>} An array of aggregated overview objects for all lines.
 */
function getAllLinesOverview() {
    const lines = lineRepository.findAll();
    return lines.map(line => getLineOverview(line.line_id));
}

module.exports = {
    getLineOverview,
    getAllLinesOverview
};
