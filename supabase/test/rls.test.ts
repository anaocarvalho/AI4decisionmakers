import { readFileSync, readdirSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";

// Minimal stand-in for what Supabase provides: roles, auth.users, auth.uid(), default grants.
const SUPABASE_STUB = `
  create role anon nologin;
  create role authenticated nologin;
  create role service_role nologin bypassrls;
  create schema auth;
  create table auth.users (id uuid primary key, email text);
  create function auth.uid() returns uuid language sql stable as
    $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  grant usage on schema auth, public to anon, authenticated, service_role;
  grant execute on function auth.uid() to anon, authenticated, service_role;
  alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
`;

const A = "00000000-0000-0000-0000-00000000000a";
const B = "00000000-0000-0000-0000-00000000000b";
let db: PGlite;

/** Run SQL as a given role/user inside a transaction, like a PostgREST request. */
async function as<T = Record<string, unknown>>(role: "anon" | "authenticated" | "service_role", sub: string | null, sql: string, params: unknown[] = []) {
  await db.exec("begin");
  try {
    await db.query(`select set_config('request.jwt.claim.sub', $1, true)`, [sub ?? ""]);
    await db.exec(`set local role ${role}`);
    const res = await db.query<T>(sql, params);
    await db.exec("commit");
    return res.rows;
  } catch (e) {
    await db.exec("rollback");
    throw e;
  }
}

const insertJob = (owner: string, key: string) =>
  as("service_role", null, `insert into public.jobs (owner_id, dedupe_key, title, company, url, source) values ($1, $2, 'Data Analyst', 'Acme', 'https://x/' || $2, 'greenhouse') returning id`, [owner, key]);

beforeAll(async () => {
  db = new PGlite();
  await db.exec(SUPABASE_STUB);
  const dir = new URL("../migrations/", import.meta.url);
  for (const f of readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()) {
    await db.exec(readFileSync(new URL(f, dir), "utf8"));
  }
  await db.query(`insert into auth.users (id, email) values ($1, 'a@x'), ($2, 'b@x')`, [A, B]);
  await insertJob(A, "a1");
  await insertJob(A, "a2");
  await insertJob(B, "b1");
});

describe("row-level security", () => {
  it("a user sees only their own jobs", async () => {
    const rows = await as<{ dedupe_key: string }>("authenticated", A, "select dedupe_key from public.jobs order by 1");
    expect(rows.map((r) => r.dedupe_key)).toEqual(["a1", "a2"]);
  });

  it("logged-out (anon) requests are refused outright", async () => {
    await expect(as("anon", null, "select * from public.jobs")).rejects.toThrow(/permission denied/);
  });

  it("a user cannot modify someone else's job", async () => {
    const rows = await as("authenticated", A, "update public.jobs set notes = 'hacked' where dedupe_key = 'b1' returning id");
    expect(rows).toHaveLength(0);
    const [b1] = await as<{ notes: string }>("service_role", null, "select notes from public.jobs where dedupe_key = 'b1'");
    expect(b1!.notes).toBe("");
  });

  it("a user cannot give their job to someone else", async () => {
    await expect(as("authenticated", A, `update public.jobs set owner_id = '${B}' where dedupe_key = 'a1'`)).rejects.toThrow(/row-level security/);
  });

  it("users cannot insert jobs; only the fetcher (service role) can", async () => {
    await expect(
      as("authenticated", A, `insert into public.jobs (owner_id, dedupe_key, title, company, url, source) values ('${A}', 'zz', 't', 'c', 'u', 's')`),
    ).rejects.toThrow(/row-level security/);
  });

  it("drafts can only be attached to your own jobs", async () => {
    const [b1] = await as<{ id: string }>("service_role", null, "select id from public.jobs where dedupe_key = 'b1'");
    await expect(as("authenticated", A, `insert into public.drafts (owner_id, job_id) values ('${A}', '${b1!.id}')`)).rejects.toThrow(/row-level security/);
    const [a1] = await as<{ id: string }>("authenticated", A, "select id from public.jobs where dedupe_key = 'a1'");
    const rows = await as("authenticated", A, `insert into public.drafts (owner_id, job_id) values ('${A}', '${a1!.id}') returning state`);
    expect(rows).toEqual([{ state: "pending" }]);
  });

  it("profiles are private", async () => {
    await as("authenticated", B, `insert into public.profiles (user_id, resume_md) values ('${B}', '# B resume')`);
    expect(await as("authenticated", A, "select * from public.profiles")).toEqual([]);
    await expect(as("authenticated", A, `insert into public.profiles (user_id) values ('${B}')`)).rejects.toThrow();
  });
});

describe("status tracking", () => {
  it("ticking Interested moves New → Interested and timestamps the change", async () => {
    const [row] = await as<{ status: string; status_updated_at: string | null }>(
      "authenticated", A, "update public.jobs set interested = true where dedupe_key = 'a2' returning status, status_updated_at",
    );
    expect(row!.status).toBe("interested");
    expect(row!.status_updated_at).not.toBeNull();
  });

  it("does not override a status you set manually", async () => {
    const [row] = await as<{ status: string }>(
      "authenticated", A, "update public.jobs set status = 'applied', interested = true where dedupe_key = 'a1' returning status",
    );
    expect(row!.status).toBe("applied");
  });

  it("dedupe_key is unique per owner (fetcher upserts on it)", async () => {
    await expect(insertJob(A, "a1")).rejects.toThrow(/duplicate key/);
    await expect(insertJob(B, "a1")).resolves.toHaveLength(1); // different owner is fine
  });
});
