import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { GoogleUserInfo, getUserInfo, saveUserInfo, clearGoogleAuth, isAuthenticated } from '@/lib/googleAuth';

interface AuthContextType {
  user: GoogleUserInfo | null;
  isAuthenticated: boolean;
  login: (userInfo: GoogleUserInfo) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<GoogleUserInfo | null>(null);

  useEffect(() => {
    const userInfo = getUserInfo();
    if (userInfo) {
      setUser(userInfo);
    }
  }, []);

  const login = (userInfo: GoogleUserInfo) => {
    saveUserInfo(userInfo);
    setUser(userInfo);
  };

  const logout = () => {
    clearGoogleAuth();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, isAuthenticated: isAuthenticated(), login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
