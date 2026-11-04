/**
 * The free tariff is one calendar day of access: it starts when the FREE code is
 * activated and runs on the wall clock (not only while the VPN is on).
 * TRIAL_DURATION_HOURS overrides the length (default 24).
 */
export function trialDurationSeconds() {
  const hours = Number(process.env.TRIAL_DURATION_HOURS ?? 24);
  if (!Number.isFinite(hours) || hours <= 0) throw new Error('TRIAL_DURATION_HOURS must be a positive number');
  return Math.round(hours * 3600);
}

type TrialClock = { status: string; startedAt: Date; expiresAt: Date; bonusSeconds?: number };

export function trialSecondsLeft(trial: TrialClock, now = Date.now()) {
  if (trial.status !== 'ACTIVE') return 0;
  return Math.max(0, Math.floor((trial.expiresAt.getTime() - now) / 1000));
}

export function trialSecondsUsed(trial: TrialClock, now = Date.now()) {
  return Math.max(0, Math.floor((Math.min(now, trial.expiresAt.getTime()) - trial.startedAt.getTime()) / 1000));
}

/** Full length of this trial including referral bonus time. */
export function trialLimitSeconds(trial: TrialClock) {
  return Math.max(0, Math.floor((trial.expiresAt.getTime() - trial.startedAt.getTime()) / 1000));
}
