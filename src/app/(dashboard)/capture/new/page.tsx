import { CaptureForm } from "@/components/capture/capture-form";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";

export default function NewCapturePage() {
  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <Link
          href="/dashboard"
          className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1"
        >
          <ChevronLeft className="h-4 w-4" />
          Back to Dashboard
        </Link>
      </div>

      <CaptureForm />
    </div>
  );
}
