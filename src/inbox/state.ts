import type { SupabaseClient } from "@supabase/supabase-js";

/** Returns the last processed UID for a mailbox, or null if never initialized. */
export async function getLastUid(supa: SupabaseClient, mailbox: string): Promise<number | null> {
  const { data, error } = await supa.from("email_poll_state").select("last_uid").eq("mailbox", mailbox).maybeSingle();
  if (error) throw error;
  return data ? Number(data.last_uid) : null;
}

export async function setLastUid(supa: SupabaseClient, mailbox: string, uid: number): Promise<void> {
  const { error } = await supa
    .from("email_poll_state")
    .upsert({ mailbox, last_uid: uid, updated_at: new Date().toISOString() });
  if (error) throw error;
}
