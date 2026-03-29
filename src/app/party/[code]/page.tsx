import { PartyShell } from "@/components/party-shell";

export const dynamic = "force-dynamic";

export default async function PartyPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;

  return <PartyShell code={code.toUpperCase()} />;
}
