import { Trash2 } from "lucide-react";

import { CityCombobox } from "@/components/city-combobox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { clamp, type Destination } from "@/lib/trip";

export function Field({
  label,
  value,
  onChange,
  step = 1,
  min,
  max,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  step?: number;
  min?: number;
  max?: number;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-muted-foreground">{label}</span>
      <Input
        type="number"
        inputMode="decimal"
        value={value}
        step={step}
        min={min}
        max={max}
        onChange={(e) => {
          const v = Number(e.target.value);
          if (!Number.isNaN(v)) onChange(v);
        }}
      />
    </label>
  );
}

/** Editable card for one destination: city picker, display name and metrics. */
export function DestinationEditorCard({
  destination: d,
  disabledIds,
  onUpdate,
  onSwapCity,
  onCustomCity,
  onRemove,
  perMemberTravel = false,
}: {
  destination: Destination;
  /** City ids that can't be picked (home city and the other destinations). */
  disabledIds: string[];
  onUpdate: (patch: Partial<Destination>) => void;
  onSwapCity: (cityId: string) => void;
  onCustomCity: (cityName: string) => void;
  onRemove: () => void;
  /**
   * Group mode: airfare and flight time for dataset cities are estimated from
   * each member's own home city, so those two fields only apply to custom cities.
   */
  perMemberTravel?: boolean;
}) {
  const showTravelFields = !(perMemberTravel && d.cityId);
  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
      <div className="flex items-center gap-2">
        <CityCombobox
          value={d.cityId}
          onSelect={onSwapCity}
          onCreate={onCustomCity}
          customValue={d.cityId ? undefined : d.name}
          label="Swap city"
          placeholder="Search or enter a city"
          disabledIds={disabledIds}
        />
        <Button variant="ghost" size="icon" aria-label={`Remove ${d.name}`} onClick={onRemove}>
          <Trash2 className="size-4" />
        </Button>
      </div>
      <label className="mt-3 block">
        <span className="mb-1 block text-xs font-medium text-muted-foreground">Display name</span>
        <Input
          value={d.name}
          onChange={(e) => onUpdate({ name: e.target.value })}
          aria-label="Destination name"
        />
      </label>
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {showTravelFields && (
          <>
            <Field
              label="Cost ($)"
              value={d.cost}
              step={10}
              min={0}
              onChange={(v) => onUpdate({ cost: Math.max(0, v) })}
            />
            <Field
              label="Flight (hrs)"
              value={d.time}
              step={0.5}
              min={0}
              onChange={(v) => onUpdate({ time: Math.max(0, v) })}
            />
          </>
        )}
        <Field
          label="Food (1-10)"
          value={d.food}
          min={1}
          max={10}
          onChange={(v) => onUpdate({ food: clamp(v, 1, 10) })}
        />
        <Field
          label="Nightlife (1-10)"
          value={d.nightlife}
          min={1}
          max={10}
          onChange={(v) => onUpdate({ nightlife: clamp(v, 1, 10) })}
        />
        <Field
          label="Nature (1-10)"
          value={d.nature}
          min={1}
          max={10}
          onChange={(v) => onUpdate({ nature: clamp(v, 1, 10) })}
        />
      </div>
      {!showTravelFields && (
        <p className="mt-3 text-xs text-muted-foreground">
          Airfare and flight time are estimated from each member's home city.
        </p>
      )}
    </div>
  );
}
