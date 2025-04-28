// keycloak-config.js
const session = require('express-session');
const Keycloak = require('keycloak-connect');

const memoryStore = new session.MemoryStore();
const keycloak = new Keycloak({ store: memoryStore }, {
  realm: 'drone-app',
  authServerUrl: 'http://localhost:8080/',
  resource: 'frontend-client',
  credentials: { secret: '9df3c06d1c1d553c934105cef7469f8cfb835236fc18a1b42e6349e992b7d5a3' },
  'confidential-port': 0,
  'bearer-only': false,
  'public-client': false,
  'enable-cors': true,
});

module.exports = { keycloak, memoryStore };
