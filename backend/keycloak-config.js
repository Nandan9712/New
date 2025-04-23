const session = require('express-session');
const Keycloak = require('keycloak-connect');

// In-memory session store for development
const memoryStore = new session.MemoryStore();

// Keycloak config
const keycloak = new Keycloak({ store: memoryStore }, {
  "realm": "drone-app",
  "auth-server-url": "http://localhost:8080/",
  "ssl-required": "external",
  "resource": "frontend-client",
  "credentials": {
    "secret": "9df3c06d1c1d553c934105cef7469f8cfb835236fc18a1b42e6349e992b7d5a3" // Use the actual client secret from Keycloak
  },
  "confidential-port": 0,
  "bearer-only": false,
  "public-client": false,
  "enable-cors": true
});

// Protect route with role
function protectRole(role) {
  return keycloak.protect(`realm:${role}`);
}

module.exports = {
  keycloak,
  memoryStore,
  protectRole
};
