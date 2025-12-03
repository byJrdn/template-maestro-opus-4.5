/**
 * Date Utilities
 * Helper functions for date validation and formatting
 */

const DateUtils = (function () {
    'use strict';

    /**
     * Convert Excel date serial, ISO date, or any date format to MM/DD/YYYY with 4-digit year
     * Based on prototype's excelDateToJSDate function
     */
    function excelDateToJSDate(serial) {
        if (!serial) return "";

        // Ensure serial is a string for pattern matching
        const serialStr = String(serial);

        // Helper for padding
        const pad = (num) => String(num).padStart(2, '0');

        // 1. Check for standard MM/DD/YYYY or M/D/YYYY string inputs
        if (serialStr.match(/^\d{1,2}\/\d{1,2}\/\d{2,4}$/)) {
            const [m, d, y] = serialStr.split('/').map(Number);
            if (!isNaN(m) && !isNaN(d) && !isNaN(y)) {
                // Handle 2-digit years: 00-29 = 2000-2029, 30-99 = 1930-1999
                let fullYear = y;
                if (y < 100) {
                    fullYear = y < 30 ? 2000 + y : 1900 + y;
                }
                return `${pad(m)}/${pad(d)}/${fullYear}`;
            }
        }

        // 2. Handle ISO dates passed as string (e.g., YYYY-MM-DD from parser)
        if (serialStr.match(/^\d{4}-\d{2}-\d{2}/)) {
            const d = new Date(serialStr);
            if (!isNaN(d.getTime())) {
                return `${pad(d.getMonth() + 1)}/${pad(d.getDate())}/${d.getFullYear()}`;
            }
        }

        // 3. Handle Excel Serial Number (the numeric value)
        const num = Number(serial);
        // Only attempt conversion if it looks like a valid serial number (e.g., 30000-60000 range)
        if (!isNaN(num) && num > 30000 && num < 60000) {
            // Excel serial starts counting from 1/1/1900 (25569 days offset from Unix epoch)
            const utc_days = Math.floor(num - 25569);
            const utc_value = utc_days * 86400;
            const date_info = new Date(utc_value * 1000);

            return `${pad(date_info.getMonth() + 1)}/${pad(date_info.getDate())}/${date_info.getFullYear()}`;
        }

        return serialStr; // Return original if all else fails
    }

    /**
     * Check if a value is a valid date
     */
    function isValidDate(value) {
        if (!value) return false;

        // First normalize it
        const normalized = excelDateToJSDate(value);

        // Check if it matches MM/DD/YYYY format
        if (normalized.match(/^\d{2}\/\d{2}\/\d{4}$/)) {
            const date = new Date(normalized);
            return !isNaN(date.getTime());
        }

        return false;
    }

    /**
     * Format date to MM/DD/YYYY (just calls excelDateToJSDate now)
     */
    function formatDate(value) {
        return excelDateToJSDate(value);
    }

    return {
        isValidDate,
        formatDate,
        excelDateToJSDate
    };
})();

window.DateUtils = DateUtils;
