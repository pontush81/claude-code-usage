"use client";

import { useEffect, useState, useMemo } from "react";

interface Session {
  timestamp: string;
  session_id: string;
  org_name: string;
  org_id: string;
  plan: string;
  email: string;
  session_start: string;
  session_end: string;
  tokens: {
    input: number;
    output: number;
    cache_write: number;
    cache_read: number;
  };
  models: Record<
    string,
    {
      input: number;
      output: number;
      cache_write: number;
      cache_read: number;
      requests: number;
    }
  >;
  cost_usd: number;
  cost_per_model: Record<string, number>;
}

function fmt(n: number) {
  return n.toLocaleString("sv-SE");
}

function fmtUsd(n: number) {
  return `$${n.toFixed(2)}`;
}

function shortDate(iso: string) {
  if (!iso) return "-";
  return new Date(iso).toLocaleString("sv-SE", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export default function Dashboard() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [apiKey, setApiKey] = useState("");
  const [filterOrg, setFilterOrg] = useState("");
  const [filterModel, setFilterModel] = useState("");

  useEffect(() => {
    const saved = localStorage.getItem("cc-usage-api-key");
    if (saved) {
      setApiKey(saved);
      loadData(saved);
    } else {
      setLoading(false);
    }
  }, []);

  async function loadData(key: string) {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/sessions?key=${encodeURIComponent(key)}`);
      if (!res.ok) throw new Error("Unauthorized");
      const data = await res.json();
      setSessions(data);
      localStorage.setItem("cc-usage-api-key", key);
    } catch {
      setError("Kunde inte ladda data. Kontrollera API-nyckeln.");
    } finally {
      setLoading(false);
    }
  }

  const orgs = useMemo(
    () => [...new Set(sessions.map((s) => s.org_name))].sort(),
    [sessions]
  );
  const models = useMemo(
    () => [...new Set(sessions.flatMap((s) => Object.keys(s.models)))].sort(),
    [sessions]
  );

  const filtered = useMemo(() => {
    return sessions.filter((s) => {
      if (filterOrg && s.org_name !== filterOrg) return false;
      if (filterModel && !Object.keys(s.models).includes(filterModel))
        return false;
      return true;
    });
  }, [sessions, filterOrg, filterModel]);

  const byOrg = useMemo(() => {
    const map: Record<
      string,
      { cost: number; sessions: number; input: number; output: number; plan: string }
    > = {};
    for (const s of sessions) {
      if (!map[s.org_name]) {
        map[s.org_name] = { cost: 0, sessions: 0, input: 0, output: 0, plan: s.plan };
      }
      map[s.org_name].cost += s.cost_usd;
      map[s.org_name].sessions += 1;
      map[s.org_name].input += s.tokens.input;
      map[s.org_name].output += s.tokens.output;
    }
    return map;
  }, [sessions]);

  const totalCost = sessions.reduce((sum, s) => sum + s.cost_usd, 0);

  if (!apiKey || error) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-950">
        <div className="bg-slate-900 rounded-xl p-8 max-w-sm w-full">
          <h1 className="text-xl font-bold text-white mb-2">Claude Code Usage</h1>
          <p className="text-slate-400 text-sm mb-6">Ange din API-nyckel.</p>
          {error && <p className="text-red-400 text-sm mb-4">{error}</p>}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const key = (
                (e.target as HTMLFormElement).elements.namedItem("key") as HTMLInputElement
              ).value;
              setApiKey(key);
              loadData(key);
            }}
          >
            <input
              name="key"
              type="password"
              placeholder="API-nyckel"
              className="w-full bg-slate-800 text-white border border-slate-700 rounded-lg px-4 py-2 mb-4 text-sm"
              defaultValue={apiKey}
            />
            <button
              type="submit"
              className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-lg px-4 py-2 text-sm"
            >
              Visa dashboard
            </button>
          </form>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-950">
        <p className="text-slate-400">Laddar...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold">Claude Code Usage</h1>
            <p className="text-slate-400 text-sm">{sessions.length} sessioner</p>
          </div>
          <button
            onClick={() => {
              localStorage.removeItem("cc-usage-api-key");
              setApiKey("");
              setSessions([]);
            }}
            className="text-slate-500 hover:text-slate-300 text-sm"
          >
            Logga ut
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          <div className="bg-slate-900 rounded-xl p-5 text-center">
            <div className="text-3xl font-bold text-amber-400">{fmtUsd(totalCost)}</div>
            <div className="text-slate-400 text-xs uppercase tracking-wide mt-1">Total kostnad</div>
          </div>
          <div className="bg-slate-900 rounded-xl p-5 text-center">
            <div className="text-3xl font-bold">{sessions.length}</div>
            <div className="text-slate-400 text-xs uppercase tracking-wide mt-1">Sessioner</div>
          </div>
          <div className="bg-slate-900 rounded-xl p-5 text-center">
            <div className="text-3xl font-bold">{orgs.length}</div>
            <div className="text-slate-400 text-xs uppercase tracking-wide mt-1">Organisationer</div>
          </div>
        </div>

        <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wide border-b border-slate-800 pb-2 mb-4">
          Per organisation
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
          {Object.entries(byOrg)
            .sort(([, a], [, b]) => b.cost - a.cost)
            .map(([org, d]) => (
              <div key={org} className="bg-slate-900 rounded-xl overflow-hidden">
                <div className="flex items-center gap-3 px-5 pt-4 pb-2">
                  <span
                    className={`text-xs font-semibold uppercase tracking-wide px-2.5 py-0.5 rounded-full border ${
                      d.plan === "enterprise"
                        ? "bg-amber-500/10 text-amber-400 border-amber-500/30"
                        : "bg-indigo-500/10 text-indigo-400 border-indigo-500/30"
                    }`}
                  >
                    {d.plan}
                  </span>
                  <h3 className="font-semibold">{org}</h3>
                </div>
                <div className="grid grid-cols-4 gap-3 px-5 pb-4">
                  <div className="text-center">
                    <div className="text-lg font-semibold">{fmtUsd(d.cost)}</div>
                    <div className="text-xs text-slate-500 uppercase">Kostnad</div>
                  </div>
                  <div className="text-center">
                    <div className="text-lg font-semibold">{d.sessions}</div>
                    <div className="text-xs text-slate-500 uppercase">Sessioner</div>
                  </div>
                  <div className="text-center">
                    <div className="text-lg font-semibold">{fmt(d.input)}</div>
                    <div className="text-xs text-slate-500 uppercase">Input tok</div>
                  </div>
                  <div className="text-center">
                    <div className="text-lg font-semibold">{fmt(d.output)}</div>
                    <div className="text-xs text-slate-500 uppercase">Output tok</div>
                  </div>
                </div>
              </div>
            ))}
        </div>

        <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wide border-b border-slate-800 pb-2 mb-4">
          Alla sessioner
        </h2>
        <div className="flex gap-3 mb-4 flex-wrap">
          <select
            value={filterOrg}
            onChange={(e) => setFilterOrg(e.target.value)}
            className="bg-slate-900 text-slate-200 border border-slate-700 rounded-lg px-3 py-1.5 text-sm"
          >
            <option value="">Alla organisationer</option>
            {orgs.map((o) => (
              <option key={o} value={o}>{o}</option>
            ))}
          </select>
          <select
            value={filterModel}
            onChange={(e) => setFilterModel(e.target.value)}
            className="bg-slate-900 text-slate-200 border border-slate-700 rounded-lg px-3 py-1.5 text-sm"
          >
            <option value="">Alla modeller</option>
            {models.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </div>

        <div className="bg-slate-900 rounded-xl overflow-auto max-h-[600px]">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-slate-400 uppercase tracking-wide">
                <th className="text-left px-4 py-3 bg-slate-800/80 sticky top-0">Start</th>
                <th className="text-left px-4 py-3 bg-slate-800/80 sticky top-0">Slut</th>
                <th className="text-left px-4 py-3 bg-slate-800/80 sticky top-0">Organisation</th>
                <th className="text-left px-4 py-3 bg-slate-800/80 sticky top-0">Plan</th>
                <th className="text-left px-4 py-3 bg-slate-800/80 sticky top-0">Modell</th>
                <th className="text-right px-4 py-3 bg-slate-800/80 sticky top-0">Input tok</th>
                <th className="text-right px-4 py-3 bg-slate-800/80 sticky top-0">Output tok</th>
                <th className="text-right px-4 py-3 bg-slate-800/80 sticky top-0">Cache W</th>
                <th className="text-right px-4 py-3 bg-slate-800/80 sticky top-0">Cache R</th>
                <th className="text-right px-4 py-3 bg-slate-800/80 sticky top-0">Kostnad</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((s) => (
                <tr key={s.session_id} className="border-t border-slate-800 hover:bg-slate-800/50">
                  <td className="px-4 py-2.5 whitespace-nowrap">{shortDate(s.session_start)}</td>
                  <td className="px-4 py-2.5 whitespace-nowrap">{shortDate(s.session_end)}</td>
                  <td className="px-4 py-2.5">
                    <span
                      className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                        s.plan === "enterprise"
                          ? "bg-amber-500/10 text-amber-400"
                          : "bg-indigo-500/10 text-indigo-400"
                      }`}
                    >
                      {s.org_name}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-slate-400">{s.plan}</td>
                  <td className="px-4 py-2.5 text-slate-300">{Object.keys(s.models).join(", ")}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{fmt(s.tokens.input)}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{fmt(s.tokens.output)}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-slate-400">{fmt(s.tokens.cache_write)}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-slate-400">{fmt(s.tokens.cache_read)}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums font-semibold text-amber-400">{fmtUsd(s.cost_usd)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <footer className="text-center text-slate-600 text-xs mt-8 py-4 border-t border-slate-800">
          Claude Code Usage Tracker
        </footer>
      </div>
    </div>
  );
}
