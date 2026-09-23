import { useState } from "react";
import { Check, ChevronsUpDown, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CITIES } from "@/lib/cities";
import { cn } from "@/lib/utils";

export function CityCombobox({
  value,
  onSelect,
  placeholder = "Search cities…",
  label,
  disabledIds = [],
  customValue,
  onCreate,
  className,
}: {
  value: string | null;
  onSelect: (cityId: string) => void;
  placeholder?: string;
  label?: string;
  disabledIds?: string[];
  customValue?: string | undefined;
  onCreate?: (cityName: string) => void;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const selected = CITIES.find((c) => c.id === value);
  const customName = search.trim().replace(/\s+/g, " ");
  const hasExactMatch = CITIES.some(
    (city) => city.name.toLocaleLowerCase() === customName.toLocaleLowerCase(),
  );
  const canCreate = Boolean(onCreate && customName && !hasExactMatch);

  const close = () => {
    setOpen(false);
    setSearch("");
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-label={label ?? placeholder}
          className={cn("w-full justify-between font-medium", className)}
        >
          <span className={cn("truncate", !selected && !customValue && "text-muted-foreground")}>
            {selected?.name ?? customValue ?? placeholder}
          </span>
          <ChevronsUpDown className="size-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[min(20rem,90vw)] p-0" align="start">
        <Command>
          <CommandInput value={search} onValueChange={setSearch} placeholder={placeholder} />
          <CommandList>
            <CommandEmpty>{onCreate ? "Type a city name to add it." : "No city found."}</CommandEmpty>
            {canCreate && (
              <CommandGroup heading="Custom city" forceMount>
                <CommandItem
                  forceMount
                  value={`create-${customName}`}
                  onSelect={() => {
                    onCreate?.(customName);
                    close();
                  }}
                >
                  <Plus className="size-4 text-primary" />
                  <span className="truncate">Use “{customName}”</span>
                </CommandItem>
              </CommandGroup>
            )}
            <CommandGroup>
              {CITIES.map((city) => {
                const isDisabled = disabledIds.includes(city.id) && city.id !== value;
                return (
                  <CommandItem
                    key={city.id}
                    value={city.name}
                    disabled={isDisabled}
                    onSelect={() => {
                      onSelect(city.id);
                      close();
                    }}
                  >
                    <Check
                      className={cn("size-4", city.id === value ? "opacity-100" : "opacity-0")}
                    />
                    <span className="truncate">{city.name}</span>
                    {isDisabled && (
                      <span className="ml-auto text-xs text-muted-foreground">added</span>
                    )}
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
