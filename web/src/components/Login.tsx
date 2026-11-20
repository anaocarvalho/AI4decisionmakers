import { useState, type FormEvent } from "react";
import { supabase } from "../supabase";

export function Login() {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [error, setError] = useState("");

  async function submit(e: FormEvent) {
    e.preventDefault();
    setState("sending");
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      // shouldCreateUser: false → unknown emails can't create accounts, even if signups were left on.
      options: { emailRedirectTo: window.location.origin, shouldCreateUser: false },
    });
    if (error) {
      setError(error.message);
      setState("error");
    } else setState("sent");
  }

  return (
    <main className="center-card">
      <h1>🔎 JobScout</h1>
      {state === "sent" ? (
        <p>Check your inbox for a sign-in link. You can close this tab.</p>
      ) : (
        <form onSubmit={submit} className="stack">
          <label htmlFor="email">Email</label>
          <input id="email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <button type="submit" className="primary" disabled={state === "sending"}>
            {state === "sending" ? "Sending…" : "Email me a sign-in link"}
          </button>
          {state === "error" && <p className="error">{error}</p>}
        </form>
      )}
    </main>
  );
}
