import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface ProfilePatch {
  full_name?: string | null;
  group_name?: string | null;
  avatar_url?: string | null;
}

/**
 * Updates the calling user's profile row. RLS on `profiles` already
 * restricts writes to `auth.uid() = user_id`, so we don't need to pass
 * the user id from the client.
 */
export function useUpdateProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { userId: string; patch: ProfilePatch }) => {
      const payload: Record<string, unknown> = {
        ...input.patch,
        updated_at: new Date().toISOString(),
      };
      const { error } = await supabase
        .from("profiles" as never)
        .update(payload as never)
        .eq("user_id", input.userId);
      if (error) throw error;
    },
    onSuccess: () => {
      // useAuth re-reads the profile when session changes; force a refetch
      // of any consumer query that joins on profiles.
      qc.invalidateQueries({ queryKey: ["profile"] });
      qc.invalidateQueries({ queryKey: ["teacher", "students"] });
      qc.invalidateQueries({ queryKey: ["leaderboard"] });
    },
  });
}

const MAX_AVATAR_BYTES = 4 * 1024 * 1024; // 4 MB

/**
 * Uploads an image to the `avatars` bucket at `<uid>/avatar.<ext>` and
 * returns its public URL. Always overwrites the previous file (upsert),
 * so we don't accumulate orphan blobs.
 */
export async function uploadAvatar(userId: string, file: File): Promise<string> {
  if (file.size > MAX_AVATAR_BYTES) throw new Error("AVATAR_TOO_LARGE");
  const ext = (file.name.split(".").pop() ?? "png").toLowerCase();
  const path = `${userId}/avatar.${ext}`;
  const { error } = await supabase.storage
    .from("avatars")
    .upload(path, file, { upsert: true, contentType: file.type, cacheControl: "60" });
  if (error) throw error;
  const { data } = supabase.storage.from("avatars").getPublicUrl(path);
  // Bust caches when re-uploading the same path.
  return `${data.publicUrl}?v=${Date.now()}`;
}
