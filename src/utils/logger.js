export const logger = {
    info: (message, data = {}) => {
      const timestamp = new Date().toISOString()
      console.log(`[INFO] [${timestamp}] ${message}`, data)
    },
    error: (message, error) => {
      const timestamp = new Date().toISOString()
      console.error(`[ERROR] [${timestamp}] ${message}`, error)
      console.error(`Stack: ${error.stack || 'No stack trace available'}`)
    },
    warn: (message, data = {}) => {
      const timestamp = new Date().toISOString()
      console.warn(`[WARN] [${timestamp}] ${message}`, data)
    },
    debug: (message, data = {}) => {
      const timestamp = new Date().toISOString()
      console.debug(`[DEBUG] [${timestamp}] ${message}`, data)
    },
    ai: (prompt, response, timeTaken) => {
      const timestamp = new Date().toISOString()
      console.log(`[AI] [${timestamp}] Request completed in ${timeTaken}ms`)
      console.log(`[AI] Prompt: ${prompt.substring(0, 100)}${prompt.length > 100 ? '...' : ''}`)
      console.log(`[AI] Response: ${response.substring(0, 100)}${response.length > 100 ? '...' : ''}`)
    }
  }