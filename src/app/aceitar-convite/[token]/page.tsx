import { finalizeInviteAcceptance } from "@/lib/actions/team";

export default async function AceitarConvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  await finalizeInviteAcceptance(token);
  return null;
}
