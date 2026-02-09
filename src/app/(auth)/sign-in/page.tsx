"use client";

import { useAuthActions } from "@convex-dev/auth/react";
import { useConvexAuth } from "convex/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function SignInPage() {
  const { signIn, signOut } = useAuthActions();
  const { isAuthenticated, isLoading } = useConvexAuth();
  const router = useRouter();
  const [isSigningIn, setIsSigningIn] = useState(false);

  useEffect(() => {
    // Only redirect if authenticated AND not in the middle of signing in
    if (isAuthenticated && !isSigningIn) {
      router.push("/dashboard");
    }
  }, [isAuthenticated, isSigningIn, router]);

  const handleSignIn = async () => {
    setIsSigningIn(true);
    console.log("Starting sign in with Google...");
    console.log("Current isAuthenticated:", isAuthenticated);
    try {
      const result = await signIn("google");
      console.log("signIn result:", result);
      // If we get here without a redirect, something is wrong
      if (result && !result.redirect) {
        console.error("No redirect returned from signIn!");
        alert("Sign in failed - no redirect to Google. Check console for details.");
      }
    } catch (error) {
      console.error("Sign in error:", error);
      alert("Sign in error: " + (error as Error).message);
      setIsSigningIn(false);
    }
  };

  const handleClearSession = async () => {
    // Clear any stale auth state
    await signOut();
    // Also clear localStorage
    if (typeof window !== "undefined") {
      const keysToRemove = Object.keys(localStorage).filter(
        (key) => key.startsWith("__convexAuth")
      );
      keysToRemove.forEach((key) => localStorage.removeItem(key));
    }
    window.location.reload();
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <Card className="w-[400px]">
      <CardHeader className="text-center">
        <CardTitle className="text-2xl">Polymarket Analytics</CardTitle>
        <CardDescription>
          Sign in to start capturing market data
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button
          className="w-full"
          onClick={handleSignIn}
          disabled={isSigningIn}
        >
          <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
            <path
              fill="currentColor"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="currentColor"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="currentColor"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
            />
            <path
              fill="currentColor"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
            />
          </svg>
          {isSigningIn ? "Redirecting to Google..." : "Sign in with Google"}
        </Button>

        {isAuthenticated && (
          <div className="text-center">
            <p className="text-sm text-muted-foreground mb-2">
              Already signed in. Redirecting...
            </p>
          </div>
        )}

        <Button
          variant="ghost"
          size="sm"
          className="w-full text-muted-foreground"
          onClick={handleClearSession}
        >
          Clear session & start fresh
        </Button>
      </CardContent>
    </Card>
  );
}
