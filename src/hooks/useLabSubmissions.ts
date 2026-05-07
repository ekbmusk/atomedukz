import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface LabSubmission {
  id: string;
  user_id: string;
  lab_id: string;
  topic_id: string;
  report_text: string | null;
  report_file_url: string | null;
  data: Record<string, unknown> | null;
  score: number | null;
  teacher_comment: string | null;
  reviewed_at: string | null;
  submitted_at: string;
}

/** Fetch the latest lab submission of the current user for a given lab. */
export function useLabSubmission(labId: string | undefined, userId: string | undefined) {
  return useQuery({
    queryKey: ["lab_submission", labId, userId],
    enabled: Boolean(labId && userId),
    queryFn: async (): Promise<LabSubmission | null> => {
      const { data, error } = await supabase
        .from("lab_submissions" as never)
        .select(
          "id, user_id, lab_id, topic_id, report_text, report_file_url, data, score, teacher_comment, reviewed_at, submitted_at",
        )
        .eq("lab_id", labId!)
        .eq("user_id", userId!)
        .order("submitted_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return (data ?? null) as LabSubmission | null;
    },
  });
}

interface SubmitInput {
  labId: string;
  topicId: string;
  userId: string;
  reportText: string;
  file: File | null;
  /** Captured measurements (e.g. interactive table cells). */
  data?: Record<string, unknown> | null;
}

const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB

export function useSubmitLab() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: SubmitInput) => {
      let reportFileUrl: string | null = null;

      if (input.file) {
        if (input.file.size > MAX_FILE_BYTES) {
          throw new Error("FILE_TOO_LARGE");
        }
        const ext = input.file.name.split(".").pop()?.toLowerCase() ?? "bin";
        const path = `${input.userId}/${input.labId}-${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from("lab-reports")
          .upload(path, input.file, { upsert: true, contentType: input.file.type });
        if (upErr) throw upErr;
        reportFileUrl = path;
      }

      const { error } = await supabase.from("lab_submissions" as never).insert({
        user_id: input.userId,
        lab_id: input.labId,
        topic_id: input.topicId,
        report_text: input.reportText,
        report_file_url: reportFileUrl,
        data: input.data ?? null,
      } as never);
      if (error) throw error;
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ["lab_submission", vars.labId, vars.userId] });
    },
  });
}

/** Build a signed URL to download a private lab report file. */
export async function getLabReportSignedUrl(path: string, ttlSeconds = 3600): Promise<string | null> {
  const { data, error } = await supabase.storage.from("lab-reports").createSignedUrl(path, ttlSeconds);
  if (error || !data) return null;
  return data.signedUrl;
}
