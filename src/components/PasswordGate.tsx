import { useEffect, useState } from "react";

const PASSWORD = import.meta.env.VITE_APP_PASSWORD ?? "changeme";
const STORAGE_KEY = "auth_ok";

export function PasswordGate({ children }: { children: React.ReactNode }) {
  const [authorized, setAuthorized] = useState(false);
  const [input, setInput] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const saved = sessionStorage.getItem(STORAGE_KEY);
    if (saved === "yes") setAuthorized(true);
  }, []);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (input.trim() === PASSWORD) {
      sessionStorage.setItem(STORAGE_KEY, "yes");
      setAuthorized(true);
      setError("");
      return;
    }
    setError("Incorrect password. Please try again.");
  }

  if (authorized) return <>{children}</>;

  return (
    <div className="container">
      <div className="card" style={{ maxWidth: 420, margin: "0 auto" }}>
        <div className="h1">Enter Password</div>
        <p className="p">This area is private. Please enter the access password to continue.</p>
        <form onSubmit={handleSubmit} style={{ display: "grid", gap: 12 }}>
          <input
            className="input"
            type="password"
            placeholder="Password"
            value={input}
            onChange={(e) => setInput(e.target.value)}
          />
          {error && <div className="small" style={{ color: "#fca5a5" }}>{error}</div>}
          <button className="btn primary" type="submit">Unlock</button>
        </form>
      </div>
    </div>
  );
}
