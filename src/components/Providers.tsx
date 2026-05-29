"use client";
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut as fbSignOut,
  updateProfile,
  type User,
} from "firebase/auth";
import { auth, googleProvider } from "@/lib/firebase/client";

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  signInEmail: (email: string, password: string) => Promise<void>;
  signUpEmail: (email: string, password: string, name?: string) => Promise<void>;
  signInGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

// Exchanges a Firebase user for our server-side session cookie.
// We force-refresh the ID token (getIdToken(true)) because Firebase's
// createSessionCookie rejects tokens issued more than 5 minutes ago — on a
// page reload the cached token can be older than that.
async function establishSession(user: User) {
  const idToken = await user.getIdToken(true);
  await fetch("/api/auth/session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idToken }),
  });
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Single source of truth for auth state. Fires on sign-in, sign-out, reload.
  // Whenever a (persisted) user appears we re-mint the server cookie so the
  // client SDK and our httpOnly cookie never drift apart.
  useEffect(() => {
    return onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) await establishSession(u).catch(() => {});
      setLoading(false);
    });
  }, []);

  const signInEmail = useCallback(async (email: string, password: string) => {
    const cred = await signInWithEmailAndPassword(auth, email, password);
    await establishSession(cred.user);
  }, []);

  const signUpEmail = useCallback(async (email: string, password: string, name?: string) => {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    if (name) await updateProfile(cred.user, { displayName: name });
    await establishSession(cred.user);
  }, []);

  const signInGoogle = useCallback(async () => {
    const cred = await signInWithPopup(auth, googleProvider);
    await establishSession(cred.user);
  }, []);

  const signOut = useCallback(async () => {
    await fbSignOut(auth);
    await fetch("/api/auth/session", { method: "DELETE" });
  }, []);

  return (
    <AuthContext.Provider
      value={{ user, loading, signInEmail, signUpEmail, signInGoogle, signOut }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within <Providers>");
  return ctx;
}
