/** npm run resume:upload — copies local resume.md into your Supabase profile (you can also paste it in the web app). */
import { readFile } from "node:fs/promises";
import { SupabaseJobStore } from "./store.js";

const ownerId = process.env.JOBSCOUT_OWNER_ID;
if (!ownerId) throw new Error("JOBSCOUT_OWNER_ID must be set");
const md = (await readFile(process.argv[2] ?? "resume.md", "utf8")).trim();
if (!md) throw new Error("resume file is empty");
await SupabaseJobStore.fromEnv(process.env).uploadResume(ownerId, md);
console.log(`Uploaded resume (${md.length} characters) to your Supabase profile.`);
