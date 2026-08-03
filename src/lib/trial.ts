export const TRIAL_DAYS = 7;

export function newTrialEndsAt(daysFromNow: number = TRIAL_DAYS): Date {
  return new Date(Date.now() + daysFromNow * 24 * 60 * 60 * 1000);
}

export function isTrialExpired(trialEndsAt: Date | null): boolean {
  return trialEndsAt !== null && trialEndsAt.getTime() < Date.now();
}

export function trialDaysLeft(trialEndsAt: Date | null): number | null {
  if (trialEndsAt === null) return null;
  const msLeft = trialEndsAt.getTime() - Date.now();
  return Math.ceil(msLeft / (24 * 60 * 60 * 1000));
}
