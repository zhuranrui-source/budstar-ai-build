import type {
  AuthenticatedSession,
  ConsumerIdentity,
} from '@budstar/contracts';

export type ConsumerRole = ConsumerIdentity;

export function identitiesOf(
  session: AuthenticatedSession | null | undefined,
): ConsumerIdentity[] {
  if (!session) return [];
  if (session.availableIdentities?.length) {
    return session.availableIdentities;
  }
  if (session.activeIdentity) return [session.activeIdentity];
  if (session.actor.kind === 'parent' || session.actor.kind === 'student') {
    return [session.actor.kind];
  }
  return [];
}

export function resolveLandingIdentity(input: {
  session: AuthenticatedSession;
  lastIdentity?: ConsumerIdentity | null;
  forceIdentity?: ConsumerIdentity | null;
}): ConsumerIdentity {
  const identities = identitiesOf(input.session);
  if (input.forceIdentity && identities.includes(input.forceIdentity)) {
    return input.forceIdentity;
  }
  if (identities.length === 1) {
    return identities[0]!;
  }
  if (input.lastIdentity && identities.includes(input.lastIdentity)) {
    return input.lastIdentity;
  }
  if (identities.includes('parent')) {
    return 'parent';
  }
  return identities[0] ?? 'parent';
}

export function needsIdentityChoice(input: {
  session: AuthenticatedSession;
  lastIdentity?: ConsumerIdentity | null;
  forceIdentity?: ConsumerIdentity | null;
}): boolean {
  if (input.forceIdentity) return false;
  const identities = identitiesOf(input.session);
  if (identities.length < 2) return false;
  return !(input.lastIdentity && identities.includes(input.lastIdentity));
}

/** 登录后统一进入星芽星球（家庭、学习等旧门户已下线）。 */
export function landingPathForIdentity(identity: ConsumerIdentity): string {
  void identity;
  return '/planet';
}
