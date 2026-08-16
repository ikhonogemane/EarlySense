import { createContext, useContext, useState, useEffect } from 'react';
import { getCurrentUser, logout } from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);

  useEffect(() => {
    const stored = getCurrentUser();
    if (stored) setUser(stored);
  }, []);

  const refreshUser = () => {
    const stored = getCurrentUser();
    if (stored) setUser(stored);
  };

  return (
    <AuthContext.Provider value={{ user, refreshUser, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

// Role helpers
export const ROLES = {
  EDUCATOR:     'Educator',
  SCHOOL_ADMIN: 'School_Admin',
  SYSTEM_ADMIN: 'System_Admin',
  LST_MEMBER:   'LST_Member',
};

export function canAccess(userRole, allowedRoles) {
  return allowedRoles.includes(userRole);
}