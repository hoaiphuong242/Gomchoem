import { receiveIpn } from "@/services/payment.service";

export const runtime = "nodejs";
export async function GET(request: Request) {
  try {
    return Response.json(await receiveIpn(new URL(request.url).searchParams), { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ RspCode: "99", Message: "Unable to confirm; retry notification" }, { headers: { "Cache-Control": "no-store" } });
  }
}
