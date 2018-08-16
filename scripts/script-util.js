/**
 * Log an error message and gracefully terminate the process
 * with the specified exit code
 * @param {string} errorMessage 
 * @param {number} exitCode 
 */
function terminate (errorMessage, exitCode) {
    console.error(errorMessage)
    process.exit(exitCode)
}

module.exports = { terminate }