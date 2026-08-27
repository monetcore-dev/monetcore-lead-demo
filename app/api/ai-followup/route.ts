import { NextResponse } from "next/server";
import OpenAI from "openai";

import {
  checkRateLimit,
  cleanText,
} from "@/lib/security";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: Request) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: "OpenAI API key is missing." },
        { status: 500 }
      );
    }

    const rateLimitResponse = checkRateLimit(request, {
      key: "ai-followup",
      limit: 5,
      windowMs: 60_000,
    });

    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    const body = await request.json();

    const name = cleanText(body.name, 100);
    const interest = cleanText(body.interest, 200);
    const location = cleanText(body.location, 150);
    const budget = cleanText(body.budget, 100);
    const timeline = cleanText(body.timeline, 100);
    const pipelineStage = cleanText(
      body.pipeline_stage,
      50
    );
    const notes = cleanText(body.notes, 1500);

    const score =
      typeof body.score === "number" &&
      Number.isFinite(body.score)
        ? Math.min(100, Math.max(0, body.score))
        : null;

    const status = cleanText(body.status, 20);

    if (!name || !interest || !location) {
      return NextResponse.json(
        { error: "Missing required lead information." },
        { status: 400 }
      );
    }

    const response = await openai.responses.create({
      model: "gpt-5.4-mini",

      instructions: `
You are a professional real estate sales assistant.

Write concise, natural follow-up messages that sound human, helpful, and commercially professional.

Rules:
- Do not invent property availability.
- Do not invent prices.
- Do not invent appointments.
- Do not make promises that were not provided.
- Avoid aggressive sales language.
- Keep the message clear and useful.
      `,

      input: `
Create a personalized follow-up email for this real estate prospect.

Lead details:

Name: ${name}
Property interest: ${interest}
Preferred location: ${location}
Budget: ${budget || "Not specified"}
Purchase timeline: ${timeline || "Not specified"}
Lead score: ${score ?? "Not specified"}
Lead priority: ${status || "Not specified"}
Pipeline stage: ${pipelineStage || "New"}

Agent notes:
${notes || "No previous notes"}

Requirements:

- Address the prospect by first name if possible.
- Keep the email between approximately 80 and 140 words.
- Sound professional but conversational.
- Mention their property interest naturally.
- Mention the preferred location when appropriate.
- Include one clear next step.
- Do not include an email subject line.
- Do not add placeholders such as [Agent Name].
- Return only the email body.
      `,
    });

    const message = response.output_text?.trim();

    if (!message) {
      return NextResponse.json(
        { error: "AI did not return a follow-up message." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message,
    });
  } catch (error) {
    console.error("AI follow-up error:", error);

    return NextResponse.json(
      { error: "Unable to generate follow-up message." },
      { status: 500 }
    );
  }
}