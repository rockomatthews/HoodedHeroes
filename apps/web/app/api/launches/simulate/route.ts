import { z } from "zod";
import { simulateProRataLaunch } from "@hoodedheroes/shared";
import { publicError } from "@/lib/server/request-security";

const schema = z.object({
  saleTokenAllocation: z.string().regex(/^\d+$/),
  maximumRaise: z.string().regex(/^\d+$/),
  contributions: z.array(z.object({ wallet: z.string().min(1).max(80), amount: z.string().regex(/^\d+$/) })).max(1_000),
});

export async function POST(request: Request) {
  try {
    const input = schema.parse(await request.json());
    const result = simulateProRataLaunch({ saleTokenAllocation: BigInt(input.saleTokenAllocation), maximumRaise: BigInt(input.maximumRaise), contributions: input.contributions.map((item) => ({ wallet: item.wallet, amount: BigInt(item.amount) })) });
    return Response.json({
      totalContributed: result.totalContributed.toString(),
      totalAccepted: result.totalAccepted.toString(),
      totalRefunded: result.totalRefunded.toString(),
      totalTokensAllocated: result.totalTokensAllocated.toString(),
      wallets: result.wallets.map((wallet) => ({ ...wallet, contributed: wallet.contributed.toString(), accepted: wallet.accepted.toString(), refund: wallet.refund.toString(), tokenAllocation: wallet.tokenAllocation.toString() })),
    }, { status: 200 });
  } catch (error) {
    return publicError(error);
  }
}
