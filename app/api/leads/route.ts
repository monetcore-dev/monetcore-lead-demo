import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

import {
  calculateLeadQualification,
  checkRateLimit,
  cleanText,
  isValidEmail,
} from "@/lib/security";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, serviceRoleKey);

const allowedStages = [
  "New",
  "Contacted",
  "Viewing Scheduled",
  "Negotiating",
  "Won",
  "Lost",
];

export async function GET(request: Request) {
  try {
    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json(
        { error: "Supabase server configuration is missing." },
        { status: 500 }
      );
    }

    const rateLimitResponse = checkRateLimit(request, {
      key: "leads-get",
      limit: 60,
      windowMs: 60_000,
    });

    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    const { data, error } = await supabase
      .from("leads")
      .select(
        `
        id,
        name,
        email,
        interest,
        location,
        budget,
        timeline,
        score,
        status,
        pipeline_stage,
        notes,
        next_follow_up,
        created_at
        `
      )
      .order("created_at", {
        ascending: false,
      })
      .limit(100);

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

export async function POST(request: Request) {
  try {
    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json(
        { error: "Supabase server configuration is missing." },
        { status: 500 }
      );
    }

    const rateLimitResponse = checkRateLimit(request, {
      key: "leads-post",
      limit: 10,
      windowMs: 60_000,
    });

    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    const body = await request.json();

    const name = cleanText(body.name, 100);
    const email = cleanText(body.email, 200).toLowerCase();
    const interest = cleanText(body.interest, 200);
    const location = cleanText(body.location, 150);
    const budget = cleanText(body.budget, 100);
    const timeline = cleanText(body.timeline, 100);

    if (
      !name ||
      !email ||
      !interest ||
      !location ||
      !budget ||
      !timeline
    ) {
      return NextResponse.json(
        { error: "Missing required lead information." },
        { status: 400 }
      );
    }

    if (!isValidEmail(email)) {
      return NextResponse.json(
        { error: "Invalid email address." },
        { status: 400 }
      );
    }

    const { score, status } =
      calculateLeadQualification(budget, timeline);

    const { data, error } = await supabase
      .from("leads")
      .insert({
        name,
        email,
        interest,
        location,
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

export async function PATCH(request: Request) {
  try {
    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json(
        { error: "Supabase server configuration is missing." },
        { status: 500 }
      );
    }

    const rateLimitResponse = checkRateLimit(request, {
      key: "leads-patch",
      limit: 30,
      windowMs: 60_000,
    });

    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    const body = await request.json();

    const id = Number(body.id);

    if (!Number.isInteger(id) || id <= 0) {
      return NextResponse.json(
        { error: "Valid lead ID is required." },
        { status: 400 }
      );
    }

    const updates: {
      pipeline_stage?: string;
      notes?: string;
      next_follow_up?: string | null;
    } = {};

    if (body.pipeline_stage !== undefined) {
      const pipelineStage = cleanText(
        body.pipeline_stage,
        50
      );

      if (!allowedStages.includes(pipelineStage)) {
        return NextResponse.json(
          { error: "Invalid pipeline stage." },
          { status: 400 }
        );
      }

      updates.pipeline_stage = pipelineStage;
    }

    if (body.notes !== undefined) {
      updates.notes = cleanText(body.notes, 2000);
    }

    if (body.next_follow_up !== undefined) {
      if (
        body.next_follow_up === null ||
        body.next_follow_up === ""
      ) {
        updates.next_follow_up = null;
      } else {
        const followUp = cleanText(
          body.next_follow_up,
          100
        );

        if (
          !followUp ||
          Number.isNaN(Date.parse(followUp))
        ) {
          return NextResponse.json(
            { error: "Invalid follow-up date." },
            { status: 400 }
          );
        }

        updates.next_follow_up = followUp;
      }
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