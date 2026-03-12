const { session } = require('electron')

function initSecurity() {
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [
          "default-src 'self'; " +
          "script-src 'self' 'unsafe-inline'; " +
          "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdn.jsdelivr.net; " +
          "font-src 'self' https://fonts.gstatic.com https://cdn.jsdelivr.net; " +
          "img-src 'self' data:; " +
          "connect-src 'self' https://cdn.jsdelivr.net;"
        ]
      }
    })
  })
}

module.exports = { initSecurity }
