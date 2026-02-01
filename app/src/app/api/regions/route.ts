import { NextResponse } from "next/server";

/**
 * Region metadata with display information.
 */
const REGIONS = [
  {
    code: "AU",
    name: "Australia",
    flag: "🇦🇺",
    flag_url: "/flags/au.svg",
  },
  {
    code: "UK",
    name: "United Kingdom",
    flag: "🇬🇧",
    flag_url: "/flags/gb.svg",
  },
  {
    code: "US",
    name: "United States",
    flag: "🇺🇸",
    flag_url: "/flags/us.svg",
  },
];

/**
 * GET /api/regions
 * Returns list of supported regions with flags.
 * Public endpoint - no authentication required.
 */
export async function GET() {
  return NextResponse.json({ regions: REGIONS });
}
