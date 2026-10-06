import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { LoaderCircle } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ensureSession } from "@/hooks/use-session";
import { createGroup } from "@/lib/groups.functions";
import type { TripState } from "@/lib/share-state";

/** Turns the current comparison into a group: its destinations become the shared shortlist. */
export function StartGroupDialog({
  open,
  onOpenChange,
  tripState,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tripState: TripState;
}) {
  const navigate = useNavigate();
  const create = useServerFn(createGroup);
  const [groupName, setGroupName] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!displayName.trim() || busy) return;
    setBusy(true);
    try {
      await ensureSession();
      const { id } = await create({
        data: {
          name: groupName.trim() || "Our trip",
          displayName: displayName.trim(),
          destinations: tripState.destinations,
          priorities: tripState.priorities,
          homeCityId: tripState.homeCityId,
          homeCustomName: tripState.homeCustomName,
        },
      });
      onOpenChange(false);
      await navigate({ to: "/group/$groupId", params: { groupId: id } });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't create the group");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Plan this trip with friends</DialogTitle>
          <DialogDescription>
            Your destinations become the shared shortlist. Each friend sets their own priorities and
            home city, and you all see one combined ranking.
          </DialogDescription>
        </DialogHeader>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-muted-foreground">Group name</span>
          <Input
            value={groupName}
            maxLength={60}
            placeholder="e.g. Summer city hop"
            onChange={(e) => setGroupName(e.target.value)}
            aria-label="Group name"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-muted-foreground">Your name</span>
          <Input
            value={displayName}
            maxLength={40}
            autoFocus
            placeholder="How friends will see you"
            onChange={(e) => setDisplayName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
            aria-label="Your name"
          />
        </label>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={!displayName.trim() || busy}>
            {busy && <LoaderCircle className="size-4 animate-spin" />}
            Create group
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
