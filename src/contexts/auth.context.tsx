"use client";

import React, { createContext, useContext, useEffect, useState, type ReactNode } from "react";


interface AuthUser {
  id: string;
  name: string | null;
  phone: string | null;
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
            name: data.name ?? null,
            phone: data.phone ?? null,
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

  const signOut = () => {
    // 必须用 navigate（GET）而不是 fetch，让浏览器跟着完整的重定向链：
    //   /api/auth/logout → Authing /oidc/session/end → /sign-in
    // 用 fetch + 然后跳 /sign-in 不行——Authing 那边 SSO session 没清，
    // /sign-in 会被立刻静默重定向回 callback 再登一次，看起来从来没退出。
    window.location.href = "/api/auth/logout";
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
