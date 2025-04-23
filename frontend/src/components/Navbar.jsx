import React from 'react';

const Navbar = ({ user, handleLogout }) => {
  return (
    <nav className="navbar">
      <span>Welcome, {user.name}</span>
      <button onClick={handleLogout}>Logout</button>
    </nav>
  );
};

export default Navbar;