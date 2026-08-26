import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(
  supabaseUrl,
  serviceRoleKey
);

export async function GET(request: Request) {
  try {
    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json(
        {
          error:
            "Supabase server configuration is missing.",
        },
        { status: 500 }
      );
    }

    const { searchParams } = new URL(request.url);
    const leadId = searchParams.get("lead_id");

    if (!leadId) {
      return NextResponse.json(
        {
          error:
            "lead_id is required.",
        },
        { status: 400 }
      );
    }

    const numericLeadId = Number(leadId);

    if (
      Number.isNaN(numericLeadId) ||
      numericLeadId <= 0
    ) {
      return NextResponse.json(
        {
          error:
            "Invalid lead_id.",
        },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from("communications")
      .select("*")
      .eq("lead_id", numericLeadId)
      .order("created_at", {
        ascending: false,
      });

    if (error) {
      console.error(
        "Supabase communications GET error:",
        error
      );

      return NextResponse.json(
        {
          error:
            "Unable to load communication history.",
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      communications: data ?? [],
    });
  } catch (error) {
    console.error(
      "GET /api/communications error:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Unexpected server error.",
      },
      { status: 500 }
    );
  }
}