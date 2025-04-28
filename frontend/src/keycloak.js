import Keycloak from 'keycloak-js';

const keycloak = new Keycloak({
  url: import.meta.env.VITE_KEYCLOAK_URL,  // Keycloak URL from environment variables
  realm: import.meta.env.VITE_KEYCLOAK_REALM,  // Keycloak realm
  clientId: import.meta.env.VITE_KEYCLOAK_CLIENT_ID,  // Client ID from environment variables
});

// Initialize Keycloak and handle authentication
export const initializeKeycloak = () => {
  return new Promise((resolve, reject) => {
    keycloak.init({ onLoad: 'login-required' })  // 'login-required' will force login if not authenticated
      .then(authenticated => {
        resolve(authenticated);
      })
      .catch(error => {
        reject(error);
      });
  });
};

export default keycloak;  // Still export the default Keycloak instance
