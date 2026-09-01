import { downloadApprovedSource, githubConfigured } from "@/lib/server/github-control";
import { getSocietySession } from "@/lib/server/session";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET() {
  const society = await getSocietySession();
  if (!society || society.access !== "hero") return Response.json({ error: "A Genesis-Hero-gated session is required" }, { status: 403 });
  if (!githubConfigured()) return Response.json({ error: "GitHub App access is not configured" }, { status: 503 });
  const ref = process.env.SANDBOX_BASE_COMMIT;
  if (!ref) return Response.json({ error: "Approved source commit is not configured" }, { status: 503 });
  const archive = await downloadApprovedSource(ref);
  if (!archive.ok || !archive.body) return Response.json({ error: "Approved source archive is unavailable" }, { status: 502 });
  return new Response(archive.body, {
    headers: {
      "content-type": archive.headers.get("content-type") ?? "application/zip",
      "content-disposition": `attachment; filename="hooded-launch-bay-${ref.slice(0, 8)}.zip"`,
      "cache-control": "private, no-store",
      "x-content-type-options": "nosniff",
    },
  });
}
