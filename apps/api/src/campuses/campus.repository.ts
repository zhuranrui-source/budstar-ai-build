import type { PublicCampus } from '@budstar/contracts';

export type { PublicCampus } from '@budstar/contracts';

export const CAMPUS_REPOSITORY = Symbol('CAMPUS_REPOSITORY');

export interface CampusRepository {
  listPublic(): Promise<PublicCampus[]>;
}

export class InMemoryCampusRepository implements CampusRepository {
  listPublic(): Promise<PublicCampus[]> {
    return Promise.resolve([{ id: 'shenzhen-nanshan', name: '深圳南山校区' }]);
  }
}
