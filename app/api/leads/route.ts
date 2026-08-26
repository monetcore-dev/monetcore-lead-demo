import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, serviceRoleKey);

// GET /api/leads
// Returns all leads, newest first
export async function GET() {
  try {
    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json(
        { error: "Supabase server configuration is missing." },
        { status: 500 }
      );
    }

    const { data, error } = await supabase
      .from("leads")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Supabase GET error:", error);

      return NextResponse.json(
        { error: "Unable to load leads." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      leads: data ?? [],
    });
  } catch (error) {
    console.error("GET /api/leads error:", error);

    return NextResponse.json(
      { error: "Unexpected server error." },
      { status: 500 }
    );
  }
}

// POST /api/leads
// Creates a new qualified lead
export async function POST(request: Request) {
  try {
    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json(
        { error: "Supabase server configuration is missing." },
        { status: 500 }
      );
    }

    const body = await request.json();

    const {
      name,
      email,
      interest,
      location,
      budget,
      timeline,
      score,
      status,
    } = body;

    if (
      !name ||
      !email ||
      !interest ||
      !location ||
      !budget ||
      !timeline ||
      score === undefined ||
      !status
    ) {
      return NextResponse.json(
        { error: "Missing required lead information." },
        { status: 400 }
      );
    }

    if (
      typeof name !== "string" ||
      typeof email !== "string" ||
      typeof interest !== "string" ||
      typeof location !== "string" ||
      typeof budget !== "string" ||
      typeof timeline !== "string" ||
      typeof score !== "number" ||
      typeof status !== "string"
    ) {
      return NextResponse.json(
        { error: "Invalid lead data." },
        { status: 400 }
      );
    }

    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailPattern.test(email)) {
      return NextResponse.json(
        { error: "Invalid email address." },
        { status: 400 }
      );
    }

    if (score < 0 || score > 100) {
      return NextResponse.json(
        { error: "Lead score must be between 0 and 100." },
        { status: 400 }
      );
    }

    if (!["Hot", "Warm", "Cold"].includes(status)) {
      return NextResponse.json(
        { error: "Invalid lead status." },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from("leads")
      .insert({
        name: name.trim(),
        email: email.trim().toLowerCase(),
        interest: interest.trim(),
        location: location.trim(),
        budget,
        timeline,
        score,
        status,
        pipeline_stage: "New",
      })
      .select()
      .single();

    if (error) {
      console.error("Supabase POST error:", error);

      return NextResponse.json(
        { error: "Unable to save lead." },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        lead: data,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("POST /api/leads error:", error);

    return NextResponse.json(
      { error: "Unexpected server error." },
      { status: 500 }
    );
  }
}

// PATCH /api/leads
// Updates pipeline stage, notes and next follow-up
export async function PATCH(request: Request) {
  try {
    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json(
        { error: "Supabase server configuration is missing." },
        { status: 500 }
      );
    }

    const body = await request.json();

    const {
      id,
      pipeline_stage,
      notes,
      next_follow_up,
    } = body;

    if (!id) {
      return NextResponse.json(
        { error: "Lead ID is required." },
        { status: 400 }
      );
    }

    const allowedStages = [
      "New",
      "Contacted",
      "Viewing Scheduled",
      "Negotiating",
      "Won",
      "Lost",
    ];

    if (
      pipeline_stage !== undefined &&
      !allowedStages.includes(pipeline_stage)
    ) {
      return NextResponse.json(
        { error: "Invalid pipeline stage." },
        { status: 400 }
      );
    }

    if (
      next_follow_up !== undefined &&
      next_follow_up !== null &&
      next_follow_up !== "" &&
      Number.isNaN(Date.parse(next_follow_up))
    ) {
      return NextResponse.json(
        { error: "Invalid follow-up date." },
        { status: 400 }
      );
    }

    const updates: {
      pipeline_stage?: string;
      notes?: string;
      next_follow_up?: string | null;
    } = {};

    if (pipeline_stage !== undefined) {
      updates.pipeline_stage = pipeline_stage;
    }

    if (notes !== undefined) {
      updates.notes = String(notes).trim();
    }

    if (next_follow_up !== undefined) {
      updates.next_follow_up =
        next_follow_up === ""
          ? null
          : next_follow_up;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: "No lead changes were provided." },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from("leads")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("Supabase PATCH error:", error);

      return NextResponse.json(
        { error: "Unable to update lead." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      lead: data,
    });
  } catch (error) {
    console.error("PATCH /api/leads error:", error);

    return NextResponse.json(
      { error: "Unexpected server error." },
      { status: 500 }
    );
  }
}