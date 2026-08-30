import { validateLaunchManifest, type LaunchManifestV1 } from "@hoodedheroes/shared";
import { publicError } from "@/lib/server/request-security";

export async function POST(request: Request) {
  try {
    const manifest = await request.json() as LaunchManifestV1;
    return Response.json(validateLaunchManifest(manifest));
  } catch (error) {
    return publicError(error);
  }
}
