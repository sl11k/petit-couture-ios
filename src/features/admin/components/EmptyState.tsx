import { Inbox } from "lucide-react";
import type { ReactNode } from "react";

export function EmptyState({ message, action }: { message: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 p-12 text-center">
      <Inbox className="h-8 w-8 text-muted-foreground/50" />
      <p className="text-sm text-muted-foreground">{message}</p>
      {action}
    </div>
  );
}
