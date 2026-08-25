"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

type LeadStatus = "Hot" | "Warm" | "Cold";

type Lead = {
  id: number;
  created_at?: string;
  name: string;
  email: string;
  interest: string;
  location: string;
  budget: string;
  timeline: string;
  score: number;
  status: LeadStatus;
};

export default function Home() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    loadLeads();
  }, []);

  async function loadLeads() {
    try {
      setLoading(true);
      setError("");

      const response = await fetch("/api/leads", {
        method: "GET",
        cache: "no-store",
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Unable to load leads.");
      }

      setLeads(result.leads || []);
    } catch (error) {
      console.error("Load leads error:", error);
      setError("Unable to load leads from the database.");
    } finally {
      setLoading(false);
    }
  }

  async function handleAddLead(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const form = event.currentTarget;
    const formData = new FormData(form);

    const name = String(formData.get("name") || "").trim();
    const email = String(formData.get("email") || "").trim();
    const interest = String(formData.get("interest") || "").trim();
    const location = String(formData.get("location") || "").trim();
    const budget = String(formData.get("budget") || "");
    const timeline = String(formData.get("timeline") || "");

    const score = calculateLeadScore({
      budget,
      timeline,
      interest,
      location,
    });

    const status = getLeadStatus(score);

    try {
      setSaving(true);
      setError("");

      const response = await fetch("/api/leads", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name,
          email,
          interest,
          location,
          budget,
          timeline,
          score,
          status,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Unable to save lead.");
      }

      setLeads((current) => [result.lead, ...current]);

      form.reset();
      setShowForm(false);
    } catch (error) {
      console.error("Save lead error:", error);
      setError(
        error instanceof Error
          ? error.message
          : "Unable to save the lead."
      );
    } finally {
      setSaving(false);
    }
  }

  const stats = useMemo(() => {
    const total = leads.length;

    const hot = leads.filter(
      (lead) => lead.status === "Hot"
    ).length;

    const followUps = leads.filter(
      (lead) =>
        lead.status === "Hot" ||
        lead.status === "Warm"
    ).length;

    const hotLeadRate =
      total === 0
        ? 0
        : Math.round((hot / total) * 100);

    return {
      total,
      hot,
      followUps,
      hotLeadRate,
    };
  }, [leads]);

  return (
    <main className="min-h-screen bg-neutral-950 text-white">
      <header className="border-b border-white/10">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
          <div>
            <p className="text-sm font-semibold tracking-[0.16em]">
              MONETCORE
            </p>

            <p className="mt-1 text-xs text-neutral-500">
              Lead Automation Demo
            </p>
          </div>

          <button
            onClick={() => {
              setError("");
              setShowForm(true);
            }}
            className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-black transition hover:bg-neutral-200"
          >
            + Add Lead
          </button>
        </div>
      </header>

      <section className="mx-auto max-w-7xl px-6 py-10">
        <div className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
          <div>
            <p className="text-sm text-neutral-500">
              Real Estate Lead Dashboard
            </p>

            <h1 className="mt-2 text-4xl font-semibold tracking-tight">
              Sales Pipeline
            </h1>

            <p className="mt-3 max-w-2xl text-neutral-400">
              Capture, qualify, prioritize, and manage property enquiries from
              one place.
            </p>
          </div>

          <div className="text-sm text-neutral-500">
            Supabase connected
          </div>
        </div>

        {error && (
          <div className="mt-6 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
            {error}
          </div>
        )}

        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Total Leads"
            value={loading ? "—" : String(stats.total)}
          />

          <StatCard
            label="Hot Leads"
            value={loading ? "—" : String(stats.hot)}
          />

          <StatCard
            label="Follow-ups Due"
            value={loading ? "—" : String(stats.followUps)}
          />

          <StatCard
            label="Hot Lead Rate"
            value={
              loading
                ? "—"
                : `${stats.hotLeadRate}%`
            }
          />
        </div>

        <div className="mt-10 overflow-hidden rounded-2xl border border-white/10">
          <div className="flex items-center justify-between border-b border-white/10 px-6 py-5">
            <div>
              <h2 className="text-lg font-semibold">
                Recent Leads
              </h2>

              <p className="mt-1 text-sm text-neutral-500">
                Qualified property enquiries stored in Supabase.
              </p>
            </div>

            <button
              onClick={loadLeads}
              disabled={loading}
              className="rounded-lg border border-white/10 px-4 py-2 text-sm text-neutral-400 transition hover:bg-white/5 hover:text-white disabled:opacity-50"
            >
              {loading ? "Loading..." : "Refresh"}
            </button>
          </div>

          {loading ? (
            <div className="px-6 py-16 text-center text-neutral-500">
              Loading leads...
            </div>
          ) : leads.length === 0 ? (
            <div className="px-6 py-16 text-center">
              <p className="text-neutral-300">
                No leads yet.
              </p>

              <p className="mt-2 text-sm text-neutral-500">
                Add your first property enquiry to test the system.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="border-b border-white/10 bg-white/[0.02] text-xs uppercase tracking-wider text-neutral-500">
                  <tr>
                    <th className="px-6 py-4">Lead</th>
                    <th className="px-6 py-4">Interest</th>
                    <th className="px-6 py-4">Location</th>
                    <th className="px-6 py-4">Budget</th>
                    <th className="px-6 py-4">Timeline</th>
                    <th className="px-6 py-4">Score</th>
                    <th className="px-6 py-4">Status</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-white/10">
                  {leads.map((lead) => (
                    <tr
                      key={lead.id}
                      className="transition hover:bg-white/[0.025]"
                    >
                      <td className="px-6 py-5">
                        <p className="font-medium">
                          {lead.name}
                        </p>

                        <p className="mt-1 text-sm text-neutral-500">
                          {lead.email}
                        </p>
                      </td>

                      <td className="px-6 py-5 text-sm text-neutral-300">
                        {lead.interest}
                      </td>

                      <td className="px-6 py-5 text-sm text-neutral-300">
                        {lead.location}
                      </td>

                      <td className="px-6 py-5 text-sm text-neutral-300">
                        {lead.budget}
                      </td>

                      <td className="px-6 py-5 text-sm text-neutral-300">
                        {lead.timeline}
                      </td>

                      <td className="px-6 py-5">
                        <span className="font-semibold">
                          {lead.score}
                        </span>

                        <span className="text-neutral-600">
                          {" "}
                          / 100
                        </span>
                      </td>

                      <td className="px-6 py-5">
                        <StatusBadge
                          status={lead.status}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-4">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-white/10 bg-neutral-900 p-6 sm:p-8">
            <div className="flex items-start justify-between gap-6">
              <div>
                <p className="text-xs uppercase tracking-[0.25em] text-neutral-500">
                  New Property Enquiry
                </p>

                <h2 className="mt-2 text-2xl font-semibold">
                  Add a Lead
                </h2>

                <p className="mt-2 text-sm text-neutral-400">
                  Enter the prospect&apos;s requirements and the system will
                  automatically qualify and store the lead.
                </p>
              </div>

              <button
                onClick={() => setShowForm(false)}
                disabled={saving}
                className="rounded-lg border border-white/10 px-3 py-2 text-sm text-neutral-400 transition hover:bg-white/5 hover:text-white disabled:opacity-50"
              >
                Close
              </button>
            </div>

            <form
              onSubmit={handleAddLead}
              className="mt-8 grid gap-5"
            >
              <div className="grid gap-5 md:grid-cols-2">
                <FormField
                  label="Full name"
                  name="name"
                  type="text"
                  placeholder="Prospect name"
                />

                <FormField
                  label="Email"
                  name="email"
                  type="email"
                  placeholder="name@example.com"
                />

                <FormField
                  label="Property interest"
                  name="interest"
                  type="text"
                  placeholder="e.g. 3-bedroom apartment"
                />

                <FormField
                  label="Preferred location"
                  name="location"
                  type="text"
                  placeholder="e.g. Abuja"
                />
              </div>

              <label className="text-sm text-neutral-300">
                Budget
                <select
                  required
                  name="budget"
                  defaultValue=""
                  className="mt-2 w-full rounded-xl border border-white/10 bg-neutral-950 px-4 py-3 text-white outline-none focus:border-white/30"
                >
                  <option value="" disabled>
                    Select budget range
                  </option>

                  <option value="Under $50,000">
                    Under $50,000
                  </option>

                  <option value="$50,000 – $100,000">
                    $50,000 – $100,000
                  </option>

                  <option value="$100,000 – $250,000">
                    $100,000 – $250,000
                  </option>

                  <option value="$250,000 – $500,000">
                    $250,000 – $500,000
                  </option>

                  <option value="$500,000+">
                    $500,000+
                  </option>
                </select>
              </label>

              <label className="text-sm text-neutral-300">
                Purchase timeline
                <select
                  required
                  name="timeline"
                  defaultValue=""
                  className="mt-2 w-full rounded-xl border border-white/10 bg-neutral-950 px-4 py-3 text-white outline-none focus:border-white/30"
                >
                  <option value="" disabled>
                    Select timeframe
                  </option>

                  <option value="Within 30 days">
                    Within 30 days
                  </option>

                  <option value="1–3 months">
                    1–3 months
                  </option>

                  <option value="3–6 months">
                    3–6 months
                  </option>

                  <option value="Just researching">
                    Just researching
                  </option>
                </select>
              </label>

              {error && (
                <p className="text-sm text-red-300">
                  {error}
                </p>
              )}

              <div className="mt-3 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  disabled={saving}
                  className="rounded-lg border border-white/10 px-5 py-3 text-sm font-medium text-neutral-300 transition hover:bg-white/5 disabled:opacity-50"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-lg bg-white px-5 py-3 text-sm font-semibold text-black transition hover:bg-neutral-200 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {saving
                    ? "Saving..."
                    : "Qualify & Add Lead"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}

function StatCard({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-6">
      <p className="text-sm text-neutral-500">
        {label}
      </p>

      <p className="mt-3 text-3xl font-semibold">
        {value}
      </p>
    </div>
  );
}

function StatusBadge({
  status,
}: {
  status: LeadStatus;
}) {
  const styles =
    status === "Hot"
      ? "border-red-500/30 bg-red-500/10 text-red-300"
      : status === "Warm"
        ? "border-yellow-500/30 bg-yellow-500/10 text-yellow-300"
        : "border-blue-500/30 bg-blue-500/10 text-blue-300";

  return (
    <span
      className={`inline-flex rounded-full border px-3 py-1 text-xs font-medium ${styles}`}
    >
      {status}
    </span>
  );
}

function FormField({
  label,
  name,
  type,
  placeholder,
}: {
  label: string;
  name: string;
  type: string;
  placeholder: string;
}) {
  return (
    <label className="text-sm text-neutral-300">
      {label}

      <input
        required
        name={name}
        type={type}
        placeholder={placeholder}
        className="mt-2 w-full rounded-xl border border-white/10 bg-neutral-950 px-4 py-3 text-white outline-none placeholder:text-neutral-600 focus:border-white/30"
      />
    </label>
  );
}

function calculateLeadScore({
  budget,
  timeline,
  interest,
  location,
}: {
  budget: string;
  timeline: string;
  interest: string;
  location: string;
}) {
  let score = 20;

  const budgetScores: Record<string, number> = {
    "Under $50,000": 10,
    "$50,000 – $100,000": 15,
    "$100,000 – $250,000": 20,
    "$250,000 – $500,000": 25,
    "$500,000+": 30,
  };

  const timelineScores: Record<string, number> = {
    "Within 30 days": 35,
    "1–3 months": 25,
    "3–6 months": 15,
    "Just researching": 5,
  };

  score += budgetScores[budget] || 0;
  score += timelineScores[timeline] || 0;

  if (interest.trim().length >= 5) {
    score += 10;
  }

  if (location.trim().length >= 2) {
    score += 5;
  }

  return Math.min(score, 100);
}

function getLeadStatus(
  score: number
): LeadStatus {
  if (score >= 80) {
    return "Hot";
  }

  if (score >= 55) {
    return "Warm";
  }

  return "Cold";
}