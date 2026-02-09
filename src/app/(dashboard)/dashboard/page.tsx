import { StatsCards } from "@/components/dashboard/stats-cards";
import { CaptureRequestList } from "@/components/dashboard/capture-request-list";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";
import { Plus } from "lucide-react";

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <Button asChild>
          <Link href="/capture/new">
            <Plus className="mr-2 h-4 w-4" />
            New Capture
          </Link>
        </Button>
      </div>

      <StatsCards />

      <Card>
        <CardHeader>
          <CardTitle>Capture Requests</CardTitle>
        </CardHeader>
        <CardContent>
          <CaptureRequestList />
        </CardContent>
      </Card>
    </div>
  );
}
