import type { Request } from 'express';
import type { AuthorizationActor } from './campus-authorization.policy';

export type AuthenticatedRequest = Request & {
  authorizationActor?: AuthorizationActor;
  authenticationSessionId?: string;
  campusId?: string;
};
