import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import keycloak from '../keycloak';

const ProtectedRoute = ({ role }) => {
  const hasRole = keycloak.tokenParsed?.realm_access?.roles.includes(role);
  return hasRole ? <Outlet /> : <Navigate to="/" />;
};

export default ProtectedRoute;
