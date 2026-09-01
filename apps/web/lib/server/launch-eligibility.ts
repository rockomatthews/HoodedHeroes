import "server-only";

import { randomBytes, randomUUID } from "node:crypto";
import { getAddress, type Address, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { db } from "./database";

export async function screenLaunchWallet(wallet: Address, jurisdiction: string) {
  const endpoint = process.env.WALLET_SCREENING_API_URL;
  const token = process.env.WALLET_SCREENING_API_TOKEN;
  if (!endpoint || !token) throw new Error("Wallet screening is not configured");
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify({ wallet, chainId: 4663, jurisdiction, purpose: "hooded-launch-contribution" }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error("Wallet screening is unavailable");
  const result = await response.json() as { reference: string; sanctionsClear: boolean; jurisdictionAllowed: boolean; expiresAt?: string };
  if (!result.reference || !result.sanctionsClear || !result.jurisdictionAllowed) throw new Error("Wallet is not eligible for this launch");
  const expiresAt = result.expiresAt && Date.parse(result.expiresAt) > Date.now() ? new Date(result.expiresAt) : new Date(Date.now() + 15 * 60_000);
  const sql = db();
  await sql`insert into wallet_screening_checks (id, wallet_address, provider_reference, sanctions_clear, jurisdiction_allowed, checked_at, expires_at) values (${randomUUID()}, ${wallet.toLowerCase()}, ${result.reference}, true, true, now(), ${expiresAt.toISOString()})`;
  return { reference: result.reference, expiresAt };
}

export async function issueEligibilityPermit(input: { projectId: string; wallet: Address; sale: Address; allowance: bigint; jurisdiction: string }) {
  const key = process.env.LAUNCH_ELIGIBILITY_SIGNER_PRIVATE_KEY as Hex | undefined;
  if (!key || !/^0x[a-fA-F0-9]{64}$/.test(key)) throw new Error("Eligibility signing is not configured");
  const screening = await screenLaunchWallet(input.wallet, input.jurisdiction);
  const account = privateKeyToAccount(key);
  const nonce = BigInt(`0x${randomBytes(16).toString("hex")}`);
  const deadline = BigInt(Math.floor(Math.min(screening.expiresAt.getTime(), Date.now() + 15 * 60_000) / 1_000));
  const signature = await account.signTypedData({
    domain: { name: "HOODED Launch Eligibility", version: "1", chainId: 4663, verifyingContract: getAddress(input.sale) },
    types: { Eligibility: [
      { name: "contributor", type: "address" }, { name: "launch", type: "address" }, { name: "allowance", type: "uint256" },
      { name: "nonce", type: "uint256" }, { name: "deadline", type: "uint256" },
    ] },
    primaryType: "Eligibility",
    message: { contributor: getAddress(input.wallet), launch: getAddress(input.sale), allowance: input.allowance, nonce, deadline },
  });
  const sql = db();
  await sql`insert into launch_eligibility_permits (project_id, wallet_address, nonce, allowance, expires_at) values (${input.projectId}, ${input.wallet.toLowerCase()}, ${nonce.toString()}, ${input.allowance.toString()}, ${new Date(Number(deadline) * 1_000).toISOString()})`;
  return { contributor: input.wallet, launch: input.sale, allowance: input.allowance.toString(), nonce: nonce.toString(), deadline: deadline.toString(), signature, screeningReference: screening.reference };
}
