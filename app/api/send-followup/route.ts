import { NextResponse } from "next/server";
import nodemailer from "nodemailer";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, serviceRoleKey);

export async function POST(request: Request) {
  try {
    const {
      lead_id,
      to,
      name,
      subject,
      message,
      pipeline_stage,
    } = await request.json();

    if (!lead_id || !to || !message) {
      return NextResponse.json(
        {
          error:
            "Lead ID, recipient email, and message are required.",
        },
        { status: 400 }
      );
    }

    const smtpHost = process.env.SMTP_HOST;
    const smtpPort = Number(process.env.SMTP_PORT || 465);
    const smtpUser = process.env.SMTP_USER;
    const smtpPassword = process.env.SMTP_PASSWORD;
    const smtpFrom = process.env.SMTP_FROM || smtpUser;

    if (
      !smtpHost ||
      !smtpUser ||
      !smtpPassword ||
      !smtpFrom
    ) {
      return NextResponse.json(
        { error: "SMTP configuration is incomplete." },
        { status: 500 }
      );
    }

    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json(
        { error: "Supabase server configuration is missing." },
        { status: 500 }
      );
    }

    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpPort === 465,
      auth: {
        user: smtpUser,
        pass: smtpPassword,
      },
    });

    await transporter.sendMail({
      from: `"Monetcore System Solutions" <${smtpFrom}>`,
      to,
      subject:
        subject ||
        "Following up on your property enquiry",
      text: message,
      html: `
        <div style="font-family:Arial,sans-serif;line-height:1.6;color:#111;">
          <p>${escapeHtml(message).replace(/\n/g, "<br />")}</p>

          <hr style="margin:24px 0;border:none;border-top:1px solid #ddd;" />

          <p style="font-size:12px;color:#666;">
            Sent by Monetcore System Solutions
          </p>
        </div>
      `,
      replyTo: smtpUser,
    });

    const { error: communicationError } = await supabase
      .from("communications")
      .insert({
        lead_id,
        channel: "email",
        direction: "outbound",
        recipient: to,
        subject:
          subject ||
          "Following up on your property enquiry",
        message,
        status: "sent",
      });

    if (communicationError) {
      console.error(
        "Communication history insert error:",
        communicationError
      );

      return NextResponse.json(
        {
          error:
            "Email was sent, but communication history could not be saved.",
        },
        { status: 500 }
      );
    }

    let updatedLead = null;

    if (!pipeline_stage || pipeline_stage === "New") {
      const { data, error: leadUpdateError } = await supabase
        .from("leads")
        .update({
          pipeline_stage: "Contacted",
        })
        .eq("id", lead_id)
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
      message: `Follow-up email sent${name ? ` to ${name}` : ""}.`,
      updatedLead,
    });
  } catch (error) {
    console.error("Send follow-up error:", error);

    return NextResponse.json(
      { error: "Unable to send follow-up email." },
      { status: 500 }
    );
  }
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}