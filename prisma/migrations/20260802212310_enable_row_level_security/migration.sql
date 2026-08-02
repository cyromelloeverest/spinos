-- Enable Row Level Security on every table in the public schema.
-- The app connects via the Supabase "postgres" role (BYPASSRLS), so this does not
-- affect Prisma/server-side queries. It only matters as defense-in-depth: if a table
-- were ever exposed through Supabase's Data API to the anon/authenticated roles,
-- RLS with no policies denies all access by default instead of leaking rows.
ALTER TABLE "organizations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "memberships" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "icps" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "companies" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "signals" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "opportunity_scores" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "opportunity_score_signals" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "feedbacks" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "chat_conversations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "chat_messages" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "crm_exports" ENABLE ROW LEVEL SECURITY;
