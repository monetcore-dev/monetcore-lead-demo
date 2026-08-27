import { NextResponse } from "next/server";

type RateLimitEntry = {
  count: number;
  resetAt: number;
};

const rateLimitStore = new Map<string, RateLimitEntry>();

export function getClientIp(request: Request) {
  const forwardedFor = request.headers.get("x-forwarded-for");

  if (forwardedFor) {
    return forwardedFor.split(",")[0].trim();
  }

  const realIp = request.headers.get("x-real-ip");

  if (realIp) {
    return realIp.trim();
  }

  return "unknown";
}

export function checkRateLimit(
  request: Request,
  options: {
    key: string;
    limit: number;
    windowMs: number;
  }
) {
  const ip = getClientIp(request);
  const now = Date.now();

  const storageKey = `${options.key}:${ip}`;

  const existing = rateLimitStore.get(storageKey);

  if (!existing || existing.resetAt <= now) {
    rateLimitStore.set(storageKey, {
      count: 1,
      resetAt: now + options.windowMs,
    });

    return null;
  }

  if (existing.count >= options.limit) {
    const retryAfterSeconds = Math.max(
      1,
      Math.ceil((existing.resetAt - now) / 1000)
    );

    return NextResponse.json(
      {
        error:
          "Too many requests. Please wait before trying again.",
      },
      {
        status: 429,
        headers: {
          "Retry-After": String(retryAfterSeconds),
        },
      }
    );
  }

  existing.count += 1;

  rateLimitStore.set(storageKey, existing);

  return null;
}

export function cleanText(
  value: unknown,
  maxLength: number
) {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim().slice(0, maxLength);
}

export function isValidEmail(value: string) {
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  return emailPattern.test(value);
}

export function calculateLeadQualification(
  budget: string,
  timeline: string
) {
  let score = 40;

  const normalizedBudget = budget.toLowerCase();
  const normalizedTimeline = timeline.toLowerCase();

  if (
    normalizedBudget.includes("100") ||
    normalizedBudget.includes("million") ||
    normalizedBudget.includes("m+")
  ) {
    score += 25;
  } else if (
    normalizedBudget.includes("50") ||
    normalizedBudget.includes("75")
  ) {
    score += 15;
  } else if (normalizedBudget) {
    score += 5;
  }

  if (
    normalizedTimeline.includes("immediately") ||
    normalizedTimeline.includes("this month") ||
    normalizedTimeline.includes("30")
  ) {
    score += 25;
  } else if (
    normalizedTimeline.includes("1-3") ||
    normalizedTimeline.includes("3 months")
  ) {
    score += 15;
  } else if (normalizedTimeline) {
    score += 5;
  }

  score = Math.min(100, Math.max(0, score));

  let status = "Cold";

  if (score >= 75) {
    status = "Hot";
  } else if (score >= 55) {
    status = "Warm";
  }

  return {
    score,
    status,
  };
}