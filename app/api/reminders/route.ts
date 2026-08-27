import { NextResponse } from "next/server";
import nodemailer from "nodemailer";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(
  supabaseUrl,
  serviceRoleKey
);

export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret) {
      return NextResponse.json(
        { error: "Cron secret is not configured." },
        { status: 500 }
      );
    }

    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json(
        { error: "Unauthorized." },
        { status: 401 }
      );
    }

    const smtpHost = process.env.SMTP_HOST;
    const smtpPort = Number(process.env.SMTP_PORT || 465);
    const smtpUser = process.env.SMTP_USER;
    const smtpPassword = process.env.SMTP_PASSWORD;
    const smtpFrom = process.env.SMTP_FROM || smtpUser;

    const reminderRecipient =
      process.env.REMINDER_EMAIL || smtpUser;

    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json(
        {
          error:
            "Supabase server configuration is missing.",
        },
        { status: 500 }
      );
    }

    if (
      !smtpHost ||
      !smtpUser ||
      !smtpPassword ||
      !smtpFrom ||
      !reminderRecipient
    ) {
      return NextResponse.json(
        {
          error:
            "Reminder email configuration is incomplete.",
        },
        { status: 500 }
      );
    }

    const now = new Date();

    const { data: leads, error } = await supabase
      .from("leads")
      .select("*")
      .not("next_follow_up", "is", null)
      .lte("next_follow_up", now.toISOString())
      .not("pipeline_stage", "in", '("Won","Lost")')
      .order("next_follow_up", {
        ascending: true,
      });

    if (error) {
      console.error(
        "Reminder lead lookup error:",
        error
      );

      return NextResponse.json(
        {
          error:
            "Unable to load due follow-ups.",
        },
        { status: 500 }
      );
    }

    const allDueLeads = leads ?? [];

    const dueLeads = allDueLeads.filter((lead) => {
      if (!lead.next_follow_up) {
        return false;
      }

      if (!lead.last_reminder_sent_at) {
        return true;
      }

      const followUpTime = new Date(
        lead.next_follow_up
      ).getTime();

      const lastReminderTime = new Date(
        lead.last_reminder_sent_at
      ).getTime();

      if (
        Number.isNaN(followUpTime) ||
        Number.isNaN(lastReminderTime)
      ) {
        return true;
      }

      return lastReminderTime < followUpTime;
    });

    if (dueLeads.length === 0) {
      return NextResponse.json({
        success: true,
        remindersSent: 0,
        message:
          "No new overdue follow-up reminders are required.",
      });
    }

    const transporter =
      nodemailer.createTransport({
        host: smtpHost,
        port: smtpPort,
        secure: smtpPort === 465,
        auth: {
          user: smtpUser,
          pass: smtpPassword,
        },
      });

    const leadRows = dueLeads
      .map((lead) => {
        const followUpDate =
          lead.next_follow_up
            ? new Date(
                lead.next_follow_up
              ).toLocaleString()
            : "Not available";

        return `
          <tr>
            <td style="padding:10px;border-bottom:1px solid #ddd;">
              ${escapeHtml(lead.name || "Unknown")}
            </td>
            <td style="padding:10px;border-bottom:1px solid #ddd;">
              ${escapeHtml(
                lead.interest || "Not specified"
              )}
            </td>
            <td style="padding:10px;border-bottom:1px solid #ddd;">
              ${escapeHtml(
                lead.location || "Not specified"
              )}
            </td>
            <td style="padding:10px;border-bottom:1px solid #ddd;">
              ${escapeHtml(
                lead.pipeline_stage || "New"
              )}
            </td>
            <td style="padding:10px;border-bottom:1px solid #ddd;">
              ${escapeHtml(
                String(lead.score ?? "Not scored")
              )}
            </td>
            <td style="padding:10px;border-bottom:1px solid #ddd;">
              ${escapeHtml(followUpDate)}
            </td>
          </tr>
        `;
      })
      .join("");

    await transporter.sendMail({
      from: `"Monetcore Lead Automation" <${smtpFrom}>`,
      to: reminderRecipient,
      subject: `Follow-up Reminder: ${dueLeads.length} lead${
        dueLeads.length === 1 ? "" : "s"
      } need attention`,
      text: buildTextReminder(dueLeads),
      html: `
        <div style="font-family:Arial,sans-serif;color:#111;line-height:1.5;">
          <h2>Monetcore Follow-up Reminder</h2>

          <p>
            ${dueLeads.length}
            lead${dueLeads.length === 1 ? "" : "s"}
            currently need follow-up attention.
          </p>

          <table
            style="
              width:100%;
              border-collapse:collapse;
              margin-top:20px;
            "
          >
            <thead>
              <tr style="background:#f4f4f4;">
                <th style="padding:10px;text-align:left;">Lead</th>
                <th style="padding:10px;text-align:left;">Interest</th>
                <th style="padding:10px;text-align:left;">Location</th>
                <th style="padding:10px;text-align:left;">Stage</th>
                <th style="padding:10px;text-align:left;">Score</th>
                <th style="padding:10px;text-align:left;">Follow-up</th>
              </tr>
            </thead>

            <tbody>
              ${leadRows}
            </tbody>
          </table>

          <p style="margin-top:24px;">
            Open the Monetcore Lead Automation dashboard
            to review each lead, generate an AI follow-up,
            and contact the prospect.
          </p>

          <hr
            style="
              margin:24px 0;
              border:none;
              border-top:1px solid #ddd;
            "
          />

          <p style="font-size:12px;color:#666;">
            Automated reminder from Monetcore System Solutions.
          </p>
        </div>
      `,
      replyTo: smtpUser,
    });

    const reminderTimestamp =
      new Date().toISOString();

    const leadIds = dueLeads.map(
      (lead) => lead.id
    );

    const { error: updateError } =
      await supabase
        .from("leads")
        .update({
          last_reminder_sent_at:
            reminderTimestamp,
        })
        .in("id", leadIds);

    if (updateError) {
      console.error(
        "Reminder timestamp update error:",
        updateError
      );

      return NextResponse.json(
        {
          error:
            "Reminder email was sent, but reminder tracking could not be updated.",
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      remindersSent: 1,
      leadsDue: dueLeads.length,
      message:
        "Agent reminder email sent successfully.",
    });
  } catch (error) {
    console.error(
      "Reminder automation error:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Unable to process reminder automation.",
      },
      { status: 500 }
    );
  }
}

function buildTextReminder(
  leads: Array<{
    name?: string;
    interest?: string;
    location?: string;
    pipeline_stage?: string;
    score?: number;
    next_follow_up?: string;
  }>
) {
  const lines = leads.map(
    (lead, index) => {
      const followUpDate =
        lead.next_follow_up
          ? new Date(
              lead.next_follow_up
            ).toLocaleString()
          : "Not available";

      return `
${index + 1}. ${lead.name || "Unknown lead"}
Interest: ${lead.interest || "Not specified"}
Location: ${lead.location || "Not specified"}
Stage: ${lead.pipeline_stage || "New"}
Score: ${lead.score ?? "Not scored"}
Follow-up: ${followUpDate}
      `.trim();
    }
  );

  return `
Monetcore Follow-up Reminder

${leads.length} lead${
    leads.length === 1 ? "" : "s"
  } need attention.

${lines.join("\n\n")}

Open the Monetcore Lead Automation dashboard to review and follow up.
  `.trim();
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}