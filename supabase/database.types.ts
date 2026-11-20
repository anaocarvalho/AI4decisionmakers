// Generated from the live Supabase schema (supabase gen types), trimmed to what the app uses.
// Regenerate after changing migrations.
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type JobStatus = "new" | "interested" | "materials_drafted" | "applied" | "interview" | "offer" | "rejected";

export type Database = {
  __InternalSupabase: { PostgrestVersion: "14.18" };
  public: {
    Tables: {
      drafts: {
        Row: {
          cover_letter_md: string | null;
          created_at: string;
          error: string | null;
          id: string;
          job_id: string;
          model: string | null;
          owner_id: string;
          resume_bullets_md: string | null;
          state: string;
          updated_at: string;
        };
        Insert: {
          cover_letter_md?: string | null;
          created_at?: string;
          error?: string | null;
          id?: string;
          job_id: string;
          model?: string | null;
          owner_id: string;
          resume_bullets_md?: string | null;
          state?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["drafts"]["Insert"]>;
        Relationships: [
          { foreignKeyName: "drafts_job_id_fkey"; columns: ["job_id"]; isOneToOne: false; referencedRelation: "jobs"; referencedColumns: ["id"] },
        ];
      };
      fetch_runs: {
        Row: { errors: Json; finished_at: string | null; id: string; owner_id: string; started_at: string; stats: Json };
        Insert: { errors?: Json; finished_at?: string | null; id?: string; owner_id: string; started_at?: string; stats?: Json };
        Update: Partial<Database["public"]["Tables"]["fetch_runs"]["Insert"]>;
        Relationships: [];
      };
      jobs: {
        Row: {
          company: string;
          dedupe_key: string;
          description: string;
          everify: boolean;
          first_seen_at: string;
          fit_rationale: string | null;
          fit_score: number | null;
          id: string;
          interested: boolean;
          is_remote: boolean;
          last_seen_at: string;
          location: string;
          min_years_experience: number | null;
          notes: string;
          owner_id: string;
          posted_at: string | null;
          rank_score: number | null;
          score_model: string | null;
          scored_at: string | null;
          source: string;
          source_id: string | null;
          sources: string[];
          sponsorship_reasons: string[];
          sponsorship_status: string;
          status: JobStatus;
          status_updated_at: string | null;
          title: string;
          updated_at: string;
          url: string;
        };
        Insert: Partial<Database["public"]["Tables"]["jobs"]["Row"]> & { company: string; dedupe_key: string; owner_id: string; source: string; title: string; url: string };
        Update: Partial<Database["public"]["Tables"]["jobs"]["Row"]>;
        Relationships: [];
      };
      profiles: {
        Row: { resume_md: string; updated_at: string; user_id: string };
        Insert: { resume_md?: string; updated_at?: string; user_id: string };
        Update: { resume_md?: string; updated_at?: string; user_id?: string };
        Relationships: [];
      };
    };
    Views: { [_ in never]: never };
    Functions: { [_ in never]: never };
    Enums: { job_status: JobStatus };
    CompositeTypes: { [_ in never]: never };
  };
};

export type Tables<T extends keyof Database["public"]["Tables"]> = Database["public"]["Tables"][T]["Row"];

export const JOB_STATUSES: readonly JobStatus[] = ["new", "interested", "materials_drafted", "applied", "interview", "offer", "rejected"];
