import "./ws-polyfill.js";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Config } from "./config.js";

export interface RunsRepo {
  create(employeeId: string, task: string, createdBy?: string): Promise<string>;
  appendOutput(id: string, chunk: string): Promise<void>;
  finish(id: string, status: "done" | "error", error?: string): Promise<void>;
}

export function makeRunsRepo(cfg: Config): RunsRepo {
  const supa: SupabaseClient = createClient(cfg.SUPABASE_URL, cfg.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });
  return {
    async create(employeeId, task, createdBy) {
      const { data, error } = await supa
        .from("marketing_runs")
        .insert({ employee_id: employeeId, task, created_by: createdBy ?? null })
        .select("id").single();
      if (error) throw error;
      return data.id as string;
    },
    async appendOutput(id, chunk) {
      // Read-modify-write append. This is safe for the single-operator runner: one
      // run has exactly one writer (its own agent loop), so there are no concurrent
      // writers to the same row. If multi-writer concurrency is ever introduced,
      // replace this with a Postgres `append_run_output(id, chunk)` SQL function
      // invoked via `supa.rpc(...)` to make the append atomic.
      const { data, error } = await supa.from("marketing_runs").select("output").eq("id", id).single();
      if (error) throw error;
      const next = (data.output ?? "") + chunk;
      const upd = await supa.from("marketing_runs").update({ output: next }).eq("id", id);
      if (upd.error) throw upd.error;
    },
    async finish(id, status, error) {
      const { error: e } = await supa.from("marketing_runs")
        .update({ status, error: error ?? null, finished_at: new Date().toISOString() })
        .eq("id", id);
      if (e) throw e;
    },
  };
}
