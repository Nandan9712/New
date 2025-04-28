// pages/Login.jsx
import React, { useEffect } from 'react';
import keycloak from '../keycloak';

const Login = () => {
  useEffect(() => {
    const roles = keycloak.tokenParsed?.realm_access?.roles;

    if (roles?.includes('student')) {
      window.location.href = '/student';
    } else if (roles?.includes('teacher')) {
      window.location.href = '/teacher';
    } else if (roles?.includes('examiner')) {
      window.location.href = '/examiner';
    } else if (roles?.includes('coordinator')) {
      window.location.href = '/coordinator';  // Redirect to coordinator dashboard
    }
  }, []);

  return <div>Redirecting to your dashboard...</div>;
};

export default Login;
