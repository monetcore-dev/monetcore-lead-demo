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
// Saves a new qualified lead
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