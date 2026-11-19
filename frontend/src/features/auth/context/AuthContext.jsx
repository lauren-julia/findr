import { createContext, useContext, useState } from "react";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      const saved =
        localStorage.getItem("findr-user") ||
        sessionStorage.getItem("findr-user");
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const login = (userData, remember = false) => {
    const serialized = JSON.stringify(userData);
    if (remember) {
      localStorage.setItem("findr-user", serialized);
      sessionStorage.removeItem("findr-user");
    } else {
      sessionStorage.setItem("findr-user", serialized);
      localStorage.removeItem("findr-user");
    }
    setUser(userData);
  };

  const logout = () => {
    localStorage.removeItem("findr-user");
    sessionStorage.removeItem("findr-user");
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, isLoggedIn: Boolean(user), login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
}