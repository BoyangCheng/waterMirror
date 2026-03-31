"use client";

import React, { createContext, useContext, useEffect, useState, type ReactNode } from "react";


interface AuthUser {
  id: string;
  emailAddresses: Array<{ emailAddress: string }>;
}

interface AuthOrganization {
  id: string;
  name: string;
  imageUrl: string;
}

interface AuthContextProps {
  user: AuthUser | null;
  organization: AuthOrganization | null;
  isLoaded: boolean;
  signOut: () => void;
}

const AuthContext = createContext<AuthContextProps>({
  user: null,
  organization: null,
  isLoaded: false,
  signOut: () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [organization, setOrganization] = useState<AuthOrganization | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    fetch("/api/auth/session")
      .then((res) => res.json())
      .then((data) => {
        if (data.userId) {
          setUser({
            id: data.userId,
            emailAddresses: [{ emailAddress: data.email ?? "" }],
          });
        }
        if (data.orgId) {
          setOrganization({
            id: data.orgId,
            name: data.orgName ?? "",
            imageUrl: data.orgImage ?? "",
          });
        }
        setIsLoaded(true);
      })
      .catch(() => setIsLoaded(true));
  }, []);

  const signOut = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/sign-in";
  };

  return (
    <AuthContext.Provider value={{ user, organization, isLoaded, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

// 替代 Clerk 的 useClerk()
export function useAuth() {
  const { user, isLoaded, signOut } = useContext(AuthContext);
  return { user, isLoaded, signOut };
}

// 替代 Clerk 的 useOrganization()
export function useOrg() {
  const { organization } = useContext(AuthContext);
  return { organization };
}
