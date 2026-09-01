export function GET() {
  return Response.json({ service: "hooded-web", status: "ok", mode: "owner-only-mainnet-canary", chain: "No deployment configured" });
}
