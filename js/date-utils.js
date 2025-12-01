/**
 * DATE UTILITIES
 * 
 * Native JavaScript date parsing and formatting utilities.
 * Replaces date-fns dependency with lightweight custom functions.
 */

// ============================================================
// DATE PARSING
// ============================================================

/**
 * Parse a date string in various formats to a Date object
 * @param {string} dateString - Date string to parse
 * @returns {Date|null} - Parsed Date object or null if invalid
 */
function parseDate(dateString) {
    if (!dateString || typeof dateString !== 'string') {
        return null;
    }

    // Trim whitespace
    const trimmed = dateString.trim();
    
    // Try native Date parsing first (handles ISO, most common formats)
    const nativeDate = new Date(trimmed);
    if (!isNaN(nativeDate.getTime())) {
        return nativeDate;
    }

    // Try MM/DD/YYYY format
    const mmddyyyyMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (mmddyyyyMatch) {
        const [, month, day, year] = mmddyyyyMatch;
        return new Date(year, month - 1, day);
    }

    // Try DD-MMM-YYYY format (e.g., "15-Jan-2024")
    const ddmmmyyyyMatch = trimmed.match(/^(\d{1,2})-([a-zA-Z]{3})-(\d{4})$/);
    if (ddmmmyyyyMatch) {
        const [, day, monthName, year] = ddmmmyyyyMatch;
        const month = getMonthNumber(monthName);
        if (month !== null) {
            return new Date(year, month - 1, day);
        }
    }

    // Try Month DD, YYYY format (e.g., "January 15, 2024")
    const monthDDYYYYMatch = trimmed.match(/^([a-zA-Z]+)\s+(\d{1,2}),?\s+(\d{4})$/);
    if (monthDDYYYYMatch) {
        const [, monthName, day, year] = monthDDYYYYMatch;
        const month = getMonthNumber(monthName);
        if (month !== null) {
            return new Date(year, month - 1, day);
        }
    }

    // Try DD/MM/YYYY format (European)
    const ddmmyyyyMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (ddmmyyyyMatch) {
        const [, day, month, year] = ddmmyyyyMatch;
        // Ambiguous - could be MM/DD or DD/MM
        // Default to MM/DD (US format) unless day > 12
        if (parseInt(day) > 12) {
            return new Date(year, month - 1, day);
        }
    }

    return null;
}

/**
 * Get month number from month name (case-insensitive)
 * @param {string} monthName - Month name or abbreviation
 * @returns {number|null} - Month number (1-12) or null if invalid
 */
function getMonthNumber(monthName) {
    const months = {
        'jan': 1, 'january': 1,
        'feb': 2, 'february': 2,
        'mar': 3, 'march': 3,
        'apr': 4, 'april': 4,
        'may': 5,
        'jun': 6, 'june': 6,
        'jul': 7, 'july': 7,
        'aug': 8, 'august': 8,
        'sep': 9, 'sept': 9, 'september': 9,
        'oct': 10, 'october': 10,
        'nov': 11, 'november': 11,
        'dec': 12, 'december': 12
    };
    
    return months[monthName.toLowerCase()] || null;
}

// ============================================================
// DATE FORMATTING
// ============================================================

/**
 * Format a Date object to MM/DD/YYYY string
 * @param {Date} date - Date object to format
 * @returns {string} - Formatted date string (MM/DD/YYYY)
 */
function formatDate(date) {
    if (!(date instanceof Date) || isNaN(date.getTime())) {
        return '';
    }

    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const year = date.getFullYear();

    return `${month}/${day}/${year}`;
}

/**
 * Format a date string from any format to MM/DD/YYYY
 * @param {string} dateString - Date string in any supported format
 * @returns {string} - Formatted date string (MM/DD/YYYY) or original if invalid
 */
function normalizeDateFormat(dateString) {
    const parsed = parseDate(dateString);
    if (!parsed) {
        return dateString; // Return original if can't parse
    }
    return formatDate(parsed);
}

// ============================================================
// DATE VALIDATION
// ============================================================

/**
 * Check if a string is a valid date
 * @param {string} dateString - Date string to validate
 * @returns {boolean} - True if valid date
 */
function isValidDate(dateString) {
    const parsed = parseDate(dateString);
    return parsed !== null && !isNaN(parsed.getTime());
}

/**
 * Check if a date is in MM/DD/YYYY format
 * @param {string} dateString - Date string to check
 * @returns {boolean} - True if in MM/DD/YYYY format
 */
function isMMDDYYYYFormat(dateString) {
    return /^\d{2}\/\d{2}\/\d{4}$/.test(dateString);
}

/**
 * Validate that year is 4 digits (not 2-digit)
 * @param {string} dateString - Date string to check
 * @returns {boolean} - True if year is 4 digits
 */
function hasFourDigitYear(dateString) {
    // Check for 4-digit year in various formats
    return /\d{4}/.test(dateString);
}

// ============================================================
// DATE COMPARISON
// ============================================================

/**
 * Check if a date is in the past
 * @param {Date} date - Date to check
 * @returns {boolean} - True if date is in the past
 */
function isPastDate(date) {
    if (!(date instanceof Date) || isNaN(date.getTime())) {
        return false;
    }
    return date < new Date();
}

/**
 * Check if a date is in the future
 * @param {Date} date - Date to check
 * @returns {boolean} - True if date is in the future
 */
function isFutureDate(date) {
    if (!(date instanceof Date) || isNaN(date.getTime())) {
        return false;
    }
    return date > new Date();
}

/**
 * Get today's date at midnight
 * @returns {Date} - Today's date at 00:00:00
 */
function getToday() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return today;
}

// ============================================================
// EXPORT (for module usage)
// ============================================================

// If using as a module
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        parseDate,
        formatDate,
        normalizeDateFormat,
        isValidDate,
        isMMDDYYYYFormat,
        hasFourDigitYear,
        isPastDate,
        isFutureDate,
        getToday,
        getMonthNumber
    };
}

// If using in browser (global scope)
if (typeof window !== 'undefined') {
    window.DateUtils = {
        parseDate,
        formatDate,
        normalizeDateFormat,
        isValidDate,
        isMMDDYYYYFormat,
        hasFourDigitYear,
        isPastDate,
        isFutureDate,
        getToday,
        getMonthNumber
    };
}
