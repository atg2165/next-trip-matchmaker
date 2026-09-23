import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type TripRow = {
  id: string;
  name: string;
  home_label: string;
  destination_count: number;
  state: string;
  created_at: string;
  updated_at: string;
};

export const listTrips = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("trips")
      .select(
        "id, name, home_label, destination_count, state, created_at, updated_at",
      )
      .order("updated_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data as TripRow[];
  });

export const createTrip = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: { name?: string; state?: string; homeLabel?: string; destinationCount?: number }) => {
    const name = (input.name ?? "").trim().slice(0, 80);
    if (!name) throw new Error("Trip name is required");
    const state = input.state ?? "";
    if (!state || state.length > 6000) throw new Error("Invalid trip data");
    return {
      name,
      state,
      homeLabel: (input.homeLabel ?? "").slice(0, 120),
      destinationCount: Math.min(5, Math.max(0, Math.round(input.destinationCount ?? 0))),
    };
  })
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("trips")
      .insert({
        user_id: context.userId,
        name: data.name,
        state: data.state,
        home_label: data.homeLabel,
        destination_count: data.destinationCount,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const renameTrip = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: { id?: string; name?: string }) => {
    const id = input.id ?? "";
    const name = (input.name ?? "").trim().slice(0, 80);
    if (!id || !name) throw new Error("Trip name is required");
    return { id, name };
  })
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("trips")
      .update({ name: data.name, updated_at: new Date().toISOString() })
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteTrip = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: { id?: string }) => {
    const id = input.id ?? "";
    if (!id) throw new Error("Missing trip id");
    return { id };
  })
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("trips")
      .delete()
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
