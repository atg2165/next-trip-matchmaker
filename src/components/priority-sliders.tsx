import { Clock, Martini, Mountain, UtensilsCrossed, Wallet } from "lucide-react";

import { Slider } from "@/components/ui/slider";
import { PRIORITY_LABELS, type Priorities } from "@/lib/trip";

const priorityIcons: Record<keyof Priorities, typeof Wallet> = {
  cost: Wallet,
  time: Clock,
  food: UtensilsCrossed,
  nightlife: Martini,
  nature: Mountain,
};

/** The five 1-10 priority sliders. */
export function PrioritySliders({
  priorities,
  onChange,
}: {
  priorities: Priorities;
  onChange: (next: Priorities) => void;
}) {
  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {(Object.keys(PRIORITY_LABELS) as (keyof Priorities)[]).map((key) => {
        const Icon = priorityIcons[key];
        return (
          <div key={key}>
            <div className="mb-3 flex items-center justify-between gap-2">
              <span className="flex items-center gap-2 text-sm font-medium">
                <Icon className="size-4 text-muted-foreground" />
                {PRIORITY_LABELS[key]}
              </span>
              <span className="rounded-full bg-secondary px-2.5 py-0.5 text-xs font-semibold text-secondary-foreground tabular-nums">
                {priorities[key]}
              </span>
            </div>
            <Slider
              min={1}
              max={10}
              step={1}
              value={[priorities[key]]}
              onValueChange={([v]) => onChange({ ...priorities, [key]: v as number })}
              aria-label={`${PRIORITY_LABELS[key]} importance`}
            />
          </div>
        );
      })}
    </div>
  );
}
