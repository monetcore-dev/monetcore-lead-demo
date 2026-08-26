"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

type LeadStatus = "Hot" | "Warm" | "Cold";

type PipelineStage =
  | "New"
  | "Contacted"
  | "Viewing Scheduled"
  | "Negotiating"
  | "Won"
  | "Lost";

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
  pipeline_stage?: PipelineStage | null;
  notes?: string | null;
  next_follow_up?: string | null;
};

type Communication = {
  id: number;
  created_at: string;
  lead_id: number;
  channel: string;
  direction: string;
  recipient: string;
  subject?: string | null;
  message: string;
  status: string;
};

const pipelineStages: PipelineStage[] = [
  "New",
  "Contacted",
  "Viewing Scheduled",
  "Negotiating",
  "Won",
  "Lost",
];

export default function Home() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);

  const [communications, setCommunications] = useState<Communication[]>([]);
  const [communicationsLoading, setCommunicationsLoading] = useState(false);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [generatingAi, setGeneratingAi] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);

  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const [selectedStage, setSelectedStage] =
    useState<PipelineStage>("New");

  const [notes, setNotes] = useState("");
  const [nextFollowUp, setNextFollowUp] = useState("");

  const [emailSubject, setEmailSubject] = useState(
    "Following up on your property enquiry"
  );

  const [aiMessage, setAiMessage] = useState("");

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

      setError(
        error instanceof Error
          ? error.message
          : "Unable to load leads."
      );
    } finally {
      setLoading(false);
    }
  }

  async function loadCommunications(leadId: number) {
    try {
      setCommunicationsLoading(true);

      const response = await fetch(
        `/api/communications?lead_id=${leadId}`,
        {
          method: "GET",
          cache: "no-store",
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.error || "Unable to load communication history."
        );
      }

      setCommunications(result.communications || []);
    } catch (error) {
      console.error("Communication history error:", error);

      setError(
        error instanceof Error
          ? error.message
          : "Unable to load communication history."
      );
    } finally {
      setCommunicationsLoading(false);
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

      showSuccess("Lead successfully added and qualified.");
    } catch (error) {
      console.error("Save lead error:", error);

      setError(
        error instanceof Error
          ? error.message
          : "Unable to save lead."
      );
    } finally {
      setSaving(false);
    }
  }

  function openLead(lead: Lead) {
    const stage =
      lead.pipeline_stage &&
      pipelineStages.includes(lead.pipeline_stage)
        ? lead.pipeline_stage
        : "New";

    setSelectedLead(lead);
    setSelectedStage(stage);
    setNotes(lead.notes || "");

    setNextFollowUp(
      lead.next_follow_up
        ? formatForDateTimeInput(lead.next_follow_up)
        : ""
    );

    setAiMessage("");

    setEmailSubject(
      `Following up on your ${lead.interest || "property"} enquiry`
    );

    setCommunications([]);
    setError("");
    setSuccessMessage("");

    loadCommunications(lead.id);
  }

  function closeLead() {
    setSelectedLead(null);
    setNotes("");
    setNextFollowUp("");
    setAiMessage("");
    setCommunications([]);
    setEmailSubject("Following up on your property enquiry");
    setSelectedStage("New");
    setError("");
  }

  async function updateLead() {
    if (!selectedLead) return;

    try {
      setUpdating(true);
      setError("");

      let followUpIso: string | null = null;

      if (nextFollowUp.trim() !== "") {
        const parsedDate = new Date(nextFollowUp);

        if (Number.isNaN(parsedDate.getTime())) {
          setError("Please select a valid follow-up date and time.");
          return;
        }

        followUpIso = parsedDate.toISOString();
      }

      const response = await fetch("/api/leads", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: selectedLead.id,
          pipeline_stage: selectedStage,
          notes,
          next_follow_up: followUpIso,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Unable to update lead.");
      }

      const updatedLead = result.lead as Lead;

      setLeads((current) =>
        current.map((lead) =>
          lead.id === updatedLead.id ? updatedLead : lead
        )
      );

      setSelectedLead(updatedLead);
      setSelectedStage(updatedLead.pipeline_stage || "New");
      setNotes(updatedLead.notes || "");

      setNextFollowUp(
        updatedLead.next_follow_up
          ? formatForDateTimeInput(updatedLead.next_follow_up)
          : ""
      );

      showSuccess("Lead updated successfully.");
    } catch (error) {
      console.error("Update lead error:", error);

      setError(
        error instanceof Error
          ? error.message
          : "Unable to update lead."
      );
    } finally {
      setUpdating(false);
    }
  }

  async function generateAiFollowUp() {
    if (!selectedLead) return;

    try {
      setGeneratingAi(true);
      setError("");
      setSuccessMessage("");

      const response = await fetch("/api/ai-followup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: selectedLead.name,
          interest: selectedLead.interest,
          location: selectedLead.location,
          budget: selectedLead.budget,
          timeline: selectedLead.timeline,
          score: selectedLead.score,
          status: selectedLead.status,
          pipeline_stage: selectedStage,
          notes,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.error || "Unable to generate AI follow-up."
        );
      }

      setAiMessage(result.message || "");
    } catch (error) {
      console.error("AI generation error:", error);

      setError(
        error instanceof Error
          ? error.message
          : "Unable to generate AI follow-up."
      );
    } finally {
      setGeneratingAi(false);
    }
  }

  async function sendFollowUpEmail() {
    if (!selectedLead) return;

    if (!aiMessage.trim()) {
      setError("Generate or write a follow-up message before sending.");
      return;
    }

    if (!emailSubject.trim()) {
      setError("Please enter an email subject.");
      return;
    }

    const confirmed = window.confirm(
      `Send this email to ${selectedLead.name} at ${selectedLead.email}?`
    );

    if (!confirmed) return;

    try {
      setSendingEmail(true);
      setError("");
      setSuccessMessage("");

      const response = await fetch("/api/send-followup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          lead_id: selectedLead.id,
          to: selectedLead.email,
          name: selectedLead.name,
          subject: emailSubject.trim(),
          message: aiMessage.trim(),
          pipeline_stage: selectedStage,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.error || "Unable to send follow-up email."
        );
      }

      if (result.updatedLead) {
        const updatedLead = result.updatedLead as Lead;

        setLeads((current) =>
          current.map((lead) =>
            lead.id === updatedLead.id ? updatedLead : lead
          )
        );

        setSelectedLead(updatedLead);
        setSelectedStage(updatedLead.pipeline_stage || "Contacted");
      }

      await loadCommunications(selectedLead.id);

      showSuccess(
        result.message ||
          `Follow-up email sent to ${selectedLead.name}.`
      );
    } catch (error) {
      console.error("Send email error:", error);

      setError(
        error instanceof Error
          ? error.message
          : "Unable to send follow-up email."
      );
    } finally {
      setSendingEmail(false);
    }
  }

  function showSuccess(message: string) {
    setSuccessMessage(message);

    setTimeout(() => {
      setSuccessMessage("");
    }, 5000);
  }

  const stats = useMemo(() => {
    const total = leads.length;

    const hot = leads.filter((lead) => lead.status === "Hot").length;

    const won = leads.filter(
      (lead) => lead.pipeline_stage === "Won"
    ).length;

    const overdue = leads.filter(
      (lead) =>
        getFollowUpState(lead.next_follow_up) === "Overdue"
    ).length;

    const dueToday = leads.filter(
      (lead) =>
        getFollowUpState(lead.next_follow_up) === "Due Today"
    ).length;

    const upcoming = leads.filter(
      (lead) =>
        getFollowUpState(lead.next_follow_up) === "Upcoming"
    ).length;

    return {
      total,
      hot,
      won,
      overdue,
      dueToday,
      upcoming,
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
              AI Lead Automation System
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
        <p className="text-sm text-neutral-500">
          Real Estate Lead Dashboard
        </p>

        <h1 className="mt-2 text-4xl font-semibold tracking-tight">
          Sales Pipeline
        </h1>

        <p className="mt-3 max-w-3xl text-neutral-400">
          Capture, qualify, prioritize, schedule follow-ups, generate
          personalized AI communication, and track every customer interaction.
        </p>

        {error && (
          <div className="mt-6 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
            {error}
          </div>
        )}

        {successMessage && (
          <div className="mt-6 rounded-xl border border-green-500/20 bg-green-500/10 px-4 py-3 text-sm text-green-300">
            {successMessage}
          </div>
        )}

        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
          <StatCard label="Total Leads" value={String(stats.total)} />
          <StatCard label="Hot Leads" value={String(stats.hot)} />
          <StatCard label="Overdue" value={String(stats.overdue)} />
          <StatCard label="Due Today" value={String(stats.dueToday)} />
          <StatCard label="Upcoming" value={String(stats.upcoming)} />
          <StatCard label="Won Deals" value={String(stats.won)} />
        </div>

        <div className="mt-10 overflow-hidden rounded-2xl border border-white/10">
          <div className="flex items-center justify-between border-b border-white/10 px-6 py-5">
            <div>
              <h2 className="text-lg font-semibold">
                Lead Pipeline
              </h2>

              <p className="mt-1 text-sm text-neutral-500">
                Click a lead to manage follow-up and communication.
              </p>
            </div>

            <button
              onClick={loadLeads}
              disabled={loading}
              className="rounded-lg border border-white/10 px-4 py-2 text-sm text-neutral-400"
            >
              {loading ? "Loading..." : "Refresh"}
            </button>
          </div>

          {loading ? (
            <div className="px-6 py-16 text-center text-neutral-500">
              Loading leads...
            </div>
          ) : leads.length === 0 ? (
            <div className="px-6 py-16 text-center text-neutral-500">
              No leads yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="border-b border-white/10 bg-white/[0.02] text-xs uppercase tracking-wider text-neutral-500">
                  <tr>
                    <th className="px-6 py-4">Lead</th>
                    <th className="px-6 py-4">Interest</th>
                    <th className="px-6 py-4">Score</th>
                    <th className="px-6 py-4">Priority</th>
                    <th className="px-6 py-4">Pipeline</th>
                    <th className="px-6 py-4">Follow-up</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-white/10">
                  {leads.map((lead) => (
                    <tr
                      key={lead.id}
                      onClick={() => openLead(lead)}
                      className="cursor-pointer transition hover:bg-white/[0.04]"
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

                      <td className="px-6 py-5">
                        {lead.score} / 100
                      </td>

                      <td className="px-6 py-5">
                        <StatusBadge status={lead.status} />
                      </td>

                      <td className="px-6 py-5">
                        <PipelineBadge
                          stage={lead.pipeline_stage || "New"}
                        />
                      </td>

                      <td className="px-6 py-5">
                        <FollowUpBadge
                          date={lead.next_follow_up}
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
          <div className="max-h-[95vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-white/10 bg-neutral-900 p-8">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-semibold">
                Add a Lead
              </h2>

              <button
                onClick={() => setShowForm(false)}
                className="text-sm text-neutral-400"
              >
                Close
              </button>
            </div>

            <form
              onSubmit={handleAddLead}
              className="mt-8 grid gap-5"
            >
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
                placeholder="3-bedroom apartment"
              />

              <FormField
                label="Preferred location"
                name="location"
                type="text"
                placeholder="Abuja"
              />

              <select
                required
                name="budget"
                defaultValue=""
                className="rounded-xl border border-white/10 bg-neutral-950 px-4 py-3"
              >
                <option value="" disabled>
                  Select budget
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

              <select
                required
                name="timeline"
                defaultValue=""
                className="rounded-xl border border-white/10 bg-neutral-950 px-4 py-3"
              >
                <option value="" disabled>
                  Select timeline
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

              <button
                type="submit"
                disabled={saving}
                className="rounded-lg bg-white px-5 py-3 font-semibold text-black disabled:opacity-50"
              >
                {saving ? "Saving..." : "Qualify & Add Lead"}
              </button>
            </form>
          </div>
        </div>
      )}

      {selectedLead && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/80 px-4 py-6">
          <div className="mx-auto w-full max-w-6xl rounded-2xl border border-white/10 bg-neutral-900 p-8">
            <div className="flex items-start justify-between gap-6">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-neutral-500">
                  Lead Record
                </p>

                <h2 className="mt-2 text-3xl font-semibold">
                  {selectedLead.name}
                </h2>

                <p className="mt-2 text-neutral-400">
                  {selectedLead.email}
                </p>
              </div>

              <button
                onClick={closeLead}
                className="text-sm text-neutral-400"
              >
                Close
              </button>
            </div>

            <div className="mt-8 grid gap-8 lg:grid-cols-2">
              <div className="space-y-4">
                <DetailCard
                  label="Property Interest"
                  value={selectedLead.interest}
                />

                <DetailCard
                  label="Location"
                  value={selectedLead.location}
                />

                <DetailCard
                  label="Budget"
                  value={selectedLead.budget}
                />

                <DetailCard
                  label="Timeline"
                  value={selectedLead.timeline}
                />

                <div className="rounded-xl border border-white/10 p-5">
                  <p className="text-xs text-neutral-500">
                    QUALIFICATION
                  </p>

                  <div className="mt-3 flex items-center justify-between">
                    <p className="text-3xl font-semibold">
                      {selectedLead.score}
                      <span className="text-base text-neutral-600">
                        {" "}
                        / 100
                      </span>
                    </p>

                    <StatusBadge status={selectedLead.status} />
                  </div>
                </div>
              </div>

              <div className="space-y-6">
                <div className="rounded-2xl border border-white/10 p-6">
                  <h3 className="font-semibold">
                    Follow-up Management
                  </h3>

                  <label className="mt-5 block text-sm text-neutral-300">
                    Pipeline Stage

                    <select
                      value={selectedStage}
                      onChange={(event) =>
                        setSelectedStage(
                          event.target.value as PipelineStage
                        )
                      }
                      className="mt-2 w-full rounded-xl border border-white/10 bg-neutral-950 px-4 py-3"
                    >
                      {pipelineStages.map((stage) => (
                        <option key={stage} value={stage}>
                          {stage}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="mt-5 block text-sm text-neutral-300">
                    Next Follow-up

                    <input
                      type="datetime-local"
                      value={nextFollowUp}
                      onChange={(event) =>
                        setNextFollowUp(event.target.value)
                      }
                      className="mt-2 w-full rounded-xl border border-white/10 bg-neutral-950 px-4 py-3"
                    />
                  </label>

                  <label className="mt-5 block text-sm text-neutral-300">
                    Agent Notes

                    <textarea
                      value={notes}
                      onChange={(event) =>
                        setNotes(event.target.value)
                      }
                      rows={5}
                      className="mt-2 w-full resize-none rounded-xl border border-white/10 bg-neutral-950 px-4 py-3"
                    />
                  </label>

                  <button
                    onClick={updateLead}
                    disabled={updating}
                    className="mt-5 w-full rounded-lg bg-white px-5 py-3 font-semibold text-black disabled:opacity-50"
                  >
                    {updating
                      ? "Saving..."
                      : "Save Follow-up"}
                  </button>
                </div>

                <div className="rounded-2xl border border-purple-500/20 bg-purple-500/[0.04] p-6">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-purple-300">
                    AI Assistant
                  </p>

                  <h3 className="mt-2 text-lg font-semibold">
                    Personalized Follow-up
                  </h3>

                  <button
                    onClick={generateAiFollowUp}
                    disabled={generatingAi || sendingEmail}
                    className="mt-5 w-full rounded-lg border border-purple-400/30 bg-purple-500/10 px-5 py-3 font-semibold text-purple-200 disabled:opacity-50"
                  >
                    {generatingAi
                      ? "AI is generating..."
                      : aiMessage
                        ? "Regenerate AI Follow-up"
                        : "Generate AI Follow-up"}
                  </button>

                  {aiMessage && (
                    <div className="mt-6 space-y-5">
                      <label className="block text-sm text-neutral-300">
                        Email Subject

                        <input
                          type="text"
                          value={emailSubject}
                          onChange={(event) =>
                            setEmailSubject(event.target.value)
                          }
                          className="mt-2 w-full rounded-xl border border-white/10 bg-neutral-950 px-4 py-3"
                        />
                      </label>

                      <label className="block text-sm text-neutral-300">
                        Email Message

                        <textarea
                          value={aiMessage}
                          onChange={(event) =>
                            setAiMessage(event.target.value)
                          }
                          rows={10}
                          className="mt-2 w-full rounded-xl border border-white/10 bg-neutral-950 px-4 py-3"
                        />
                      </label>

                      <button
                        onClick={sendFollowUpEmail}
                        disabled={sendingEmail}
                        className="w-full rounded-lg bg-green-500 px-5 py-3 font-semibold text-black disabled:opacity-50"
                      >
                        {sendingEmail
                          ? "Sending Email..."
                          : `Send Email to ${selectedLead.name}`}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="mt-10 border-t border-white/10 pt-8">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-neutral-500">
                    Communication History
                  </p>

                  <h3 className="mt-2 text-2xl font-semibold">
                    Customer Timeline
                  </h3>
                </div>

                <button
                  onClick={() =>
                    loadCommunications(selectedLead.id)
                  }
                  disabled={communicationsLoading}
                  className="rounded-lg border border-white/10 px-4 py-2 text-sm text-neutral-400"
                >
                  {communicationsLoading
                    ? "Loading..."
                    : "Refresh History"}
                </button>
              </div>

              {communicationsLoading ? (
                <div className="mt-6 rounded-xl border border-white/10 p-6 text-sm text-neutral-500">
                  Loading communication history...
                </div>
              ) : communications.length === 0 ? (
                <div className="mt-6 rounded-xl border border-white/10 p-6 text-sm text-neutral-500">
                  No communication has been recorded for this lead yet.
                </div>
              ) : (
                <div className="mt-6 space-y-4">
                  {communications.map((item) => (
                    <CommunicationCard
                      key={item.id}
                      item={item}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

function CommunicationCard({
  item,
}: {
  item: Communication;
}) {
  const created = new Date(item.created_at);

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <span className="rounded-full border border-green-500/30 bg-green-500/10 px-3 py-1 text-xs font-medium text-green-300">
              {item.status}
            </span>

            <span className="text-xs uppercase tracking-wider text-neutral-500">
              {item.channel} • {item.direction}
            </span>
          </div>

          <h4 className="mt-4 font-semibold">
            {item.subject || "No subject"}
          </h4>

          <p className="mt-2 text-sm text-neutral-500">
            To: {item.recipient}
          </p>
        </div>

        <p className="text-sm text-neutral-500">
          {Number.isNaN(created.getTime())
            ? "Unknown date"
            : created.toLocaleString()}
        </p>
      </div>

      <div className="mt-5 whitespace-pre-wrap rounded-xl border border-white/10 bg-black/20 p-4 text-sm leading-6 text-neutral-300">
        {item.message}
      </div>
    </div>
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
  return (
    <span className="rounded-full border border-white/10 px-3 py-1 text-xs">
      {status}
    </span>
  );
}

function PipelineBadge({
  stage,
}: {
  stage: PipelineStage;
}) {
  return (
    <span className="rounded-full border border-white/10 px-3 py-1 text-xs">
      {stage}
    </span>
  );
}

function FollowUpBadge({
  date,
}: {
  date?: string | null;
}) {
  if (!date) {
    return (
      <span className="text-sm text-neutral-600">
        Not scheduled
      </span>
    );
  }

  const parsedDate = new Date(date);

  if (Number.isNaN(parsedDate.getTime())) {
    return (
      <span className="text-sm text-red-300">
        Invalid date
      </span>
    );
  }

  const state = getFollowUpState(date);

  return (
    <div>
      <span className="text-sm">
        {state}
      </span>

      <p className="mt-1 text-xs text-neutral-500">
        {parsedDate.toLocaleString()}
      </p>
    </div>
  );
}

function DetailCard({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-white/10 p-4">
      <p className="text-xs text-neutral-500">
        {label}
      </p>

      <p className="mt-2">
        {value}
      </p>
    </div>
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
    <label className="text-sm">
      {label}

      <input
        required
        name={name}
        type={type}
        placeholder={placeholder}
        className="mt-2 w-full rounded-xl bg-neutral-950 px-4 py-3"
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

  if (interest.length >= 5) score += 10;
  if (location.length >= 2) score += 5;

  return Math.min(score, 100);
}

function getLeadStatus(score: number): LeadStatus {
  if (score >= 80) return "Hot";
  if (score >= 55) return "Warm";
  return "Cold";
}

function getFollowUpState(
  date?: string | null
): "Overdue" | "Due Today" | "Upcoming" | "None" {
  if (!date) return "None";

  const followUp = new Date(date);

  if (Number.isNaN(followUp.getTime())) {
    return "None";
  }

  const now = new Date();

  const todayStart = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate()
  );

  const tomorrowStart = new Date(todayStart);
  tomorrowStart.setDate(tomorrowStart.getDate() + 1);

  if (followUp < now) {
    return "Overdue";
  }

  if (
    followUp >= todayStart &&
    followUp < tomorrowStart
  ) {
    return "Due Today";
  }

  return "Upcoming";
}

function formatForDateTimeInput(date: string) {
  const value = new Date(date);

  if (Number.isNaN(value.getTime())) {
    return "";
  }

  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  const hours = String(value.getHours()).padStart(2, "0");
  const minutes = String(value.getMinutes()).padStart(2, "0");

  return `${year}-${month}-${day}T${hours}:${minutes}`;
}