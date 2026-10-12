import { SetMetadata } from '@nestjs/common';
import type {
  CampusCapability,
  PlatformCapability,
} from './campus-authorization.policy';

export const CAMPUS_CAPABILITY = 'budstar:campus-capability';
export const PLATFORM_CAPABILITY = 'budstar:platform-capability';
export const AUDITED_WRITE = 'budstar:audited-write';
export const PUBLIC_ROUTE = 'budstar:public-route';

export const Public = () => SetMetadata(PUBLIC_ROUTE, true);

export const RequireCampusCapability = (capability: CampusCapability) =>
  SetMetadata(CAMPUS_CAPABILITY, capability);

export const RequirePlatformCapability = (capability: PlatformCapability) =>
  SetMetadata(PLATFORM_CAPABILITY, capability);

export const AuditBusinessWrite = (resourceType: string) =>
  SetMetadata(AUDITED_WRITE, resourceType);
