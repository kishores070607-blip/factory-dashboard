/**
 * Validates a count event body.
 * @param {Object} body The request body.
 * @returns {Object} { valid: boolean, errors: string[] }
 */
function validateCountEvent(body) {
    const errors = [];
    if (!body.event_id || typeof body.event_id !== 'string') {
        errors.push('event_id is required and must be a non-empty string');
    }
    if (!body.device_id || typeof body.device_id !== 'string') {
        errors.push('device_id is required and must be a string');
    }
    if (!body.event_time) {
        errors.push('event_time is required');
    } else if (isNaN(Date.parse(body.event_time))) {
        errors.push('event_time must be a valid date');
    }
    if (body.quantity !== undefined) {
        if (!Number.isInteger(body.quantity) || body.quantity <= 0) {
            errors.push('quantity must be a positive integer');
        }
    }
    if (body.confidence !== undefined) {
        if (typeof body.confidence !== 'number' || body.confidence < 0 || body.confidence > 1) {
            errors.push('confidence must be a number between 0 and 1');
        }
    }
    return { valid: errors.length === 0, errors };
}

/**
 * Validates a health sample body.
 * @param {Object} body The request body.
 * @returns {Object} { valid: boolean, errors: string[] }
 */
function validateHealthSample(body) {
    const errors = [];
    if (!body.device_id || typeof body.device_id !== 'string') {
        errors.push('device_id is required and must be a string');
    }
    if (!body.timestamp) {
        errors.push('timestamp is required');
    } else if (isNaN(Date.parse(body.timestamp))) {
        errors.push('timestamp must be a valid date');
    }
    return { valid: errors.length === 0, errors };
}

module.exports = {
    validateCountEvent,
    validateHealthSample
};
