import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

import {
  checkRateLimit,
  cleanText,
  isValidEmail,
} from "@/lib/security";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(
  supabaseUrl,
  serviceRoleKey
);

export async function POST(request: Request) {
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

    const rateLimitResponse = checkRateLimit(request, {
      key: "send-followup",
      limit: 10,
      windowMs: 60_000,
    });

    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    const body = await request.json();

    const leadId = Number(body.lead_id);

    if (!Number.isInteger(leadId) || leadId <= 0) {
      return NextResponse.json(
        { error: "Valid lead ID is required." },
        { status: 400 }
      );
    }

    const subject =
      cleanText(body.subject, 200) ||
      "Following up on your property enquiry";

    const message = cleanText(body.message, 5000);

    if (!message) {
      return NextResponse.json(
        { error: "Message is required." },
        { status: 400 }
      );
    }

    /*
      Do not trust the browser-supplied recipient.

      Load the lead directly from Supabase so the
      communication is always attached to the actual
      lead stored in the database.
    */
    const { data: lead, error: leadError } =
      await supabase
        .from("leads")
        .select(
          `
          id,
          name,
          email,
          pipeline_stage
          `
        )
        .eq("id", leadId)
        .single();

    if (leadError || !lead) {
      console.error(
        "Lead lookup error:",
        leadError
      );

      return NextResponse.json(
        { error: "Lead could not be found." },
        { status: 404 }
      );
    }

    const recipient = cleanText(
      lead.email,
      200
    ).toLowerCase();

    if (!recipient || !isValidEmail(recipient)) {
      return NextResponse.json(
        {
          error:
            "This lead does not have a valid email address.",
        },
        { status: 400 }
      );
    }

    /*
      PUBLIC DEMO MODE

      No SMTP message is sent here.

      The communication is recorded so prospects can
      experience the complete CRM workflow without
      allowing the public endpoint to act as an email relay.
    */
    const { error: communicationError } =
      await supabase
        .from("communications")
        .insert({
          lead_id: leadId,
          channel: "email",
          direction: "outbound",
          recipient,
          subject,
          message,
          status: "demo_sent",
        });

    if (communicationError) {
      console.error(
        "Communication history insert error:",
        communicationError
      );

      return NextResponse.json(
        {
          error:
            "Unable to record the demo follow-up.",
        },
        { status: 500 }
      );
    }

    let updatedLead = null;

    if (
      !lead.pipeline_stage ||
      lead.pipeline_stage === "New"
    ) {
      const {
        data,
        error: leadUpdateError,
      } = await supabase
        .from("leads")
        .update({
          pipeline_stage: "Contacted",
        })
        .eq("id", leadId)
        .select()
        .single();

      if (leadUpdateError) {
        console.error(
          "Lead stage update error:",
          leadUpdateError
        );
      } else {
        updatedLead = data;
      }
    }

    return NextResponse.json({
      success: true,
      demo: true,
      message: `Demo follow-up processed${
        lead.name ? ` for ${lead.name}` : ""
      }. No external email was sent.`,
      updatedLead,
    });
  } catch (error) {
    console.error(
      "Demo follow-up error:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Unable to process demo follow-up.",
      },
      { status: 500 }
    );
  }
}