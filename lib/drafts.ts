import { SupabaseClient } from "@supabase/supabase-js";

/** JSON-serialisable form values (plain strings and repeater row arrays). */
export type DraftFormData = Record<string, unknown>;

/**
 * Save a form draft.
 *
 * - If `draftId` is null, a new row is inserted and its id is returned.
 * - If `draftId` is provided, the existing row is updated (upsert by id).
 *
 * Returns the draft id (new or existing).
 */
export async function saveDraft({
  supabase,
  userId,
  templateId,
  formData,
  draftId,
}: {
  supabase: SupabaseClient;
  userId: string;
  templateId: string;
  formData: DraftFormData;
  draftId: string | null;
}): Promise<string> {
  if (draftId) {
    const { error } = await supabase
      .from("saved_form_drafts")
      .update({ form_data: formData })
      .eq("id", draftId)
      .eq("user_id", userId); // safety: only own rows

    if (error) throw new Error(error.message);
    return draftId;
  }

  const { data, error } = await supabase
    .from("saved_form_drafts")
    .insert({ user_id: userId, template_id: templateId, form_data: formData })
    .select("id")
    .single();

  if (error) throw new Error(error.message);
  return data.id as string;
}

/**
 * Load a single saved draft's form_data by id.
 * Returns null if the draft does not exist or is not owned by the user.
 */
export async function loadDraft(
  supabase: SupabaseClient,
  draftId: string
): Promise<DraftFormData | null> {
  const { data, error } = await supabase
    .from("saved_form_drafts")
    .select("form_data")
    .eq("id", draftId)
    .single();

  if (error) return null;
  return data.form_data as DraftFormData;
}
