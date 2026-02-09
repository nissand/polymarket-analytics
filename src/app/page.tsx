"use client";

import { useConvexAuth, useQuery } from "convex/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { api } from "../../convex/_generated/api";

export default function Home() {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const router = useRouter();
  const [debugInfo, setDebugInfo] = useState<string[]>([]);

  // Try to fetch dashboard stats to verify auth works
  const stats = useQuery(api.dashboard.getStats);

  useEffect(() => {
    const info = [
      `isLoading: ${isLoading}`,
      `isAuthenticated: ${isAuthenticated}`,
      `stats: ${JSON.stringify(stats)}`,
      `cookies: ${document.cookie || "(none)"}`,
    ];
    setDebugInfo(info);
    console.log("Debug:", info);
  }, [isAuthenticated, isLoading, stats]);

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      console.log("Auth detected, redirecting to dashboard...");
      router.push("/dashboard");
    }
  }, [isAuthenticated, isLoading, router]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background">
      <main className="flex flex-col items-center gap-8 text-center px-4">
        {/* Debug Panel */}
        <div className="fixed top-4 right-4 p-4 bg-black/80 text-white text-xs rounded max-w-md text-left">
          <p className="font-bold mb-2">Debug Info:</p>
          {debugInfo.map((line, i) => (
            <p key={i} className="font-mono">{line}</p>
          ))}
        </div>

        <div className="space-y-4">
          <h1 className="text-4xl font-bold tracking-tight sm:text-6xl">
            Polymarket Analytics
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl">
            {isLoading ? "Loading auth state..." :
             isAuthenticated ? "Authenticated! Redirecting..." :
             "Not authenticated"}
          </p>
        </div>

        <div className="flex gap-4">
          {isAuthenticated ? (
            <Button asChild size="lg">
              <Link href="/dashboard">Go to Dashboard</Link>
            </Button>
          ) : (
            <Button asChild size="lg">
              <Link href="/sign-in">Get Started</Link>
            </Button>
          )}
        </div>
      </main>
    </div>
  );
}
