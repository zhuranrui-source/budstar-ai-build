import { HttpStatus, Injectable } from '@nestjs/common';
import {
  PLATFORM_ENTITY_FIELDS,
  assertNoArbitrarySql,
  type PlatformBrowsableEntity,
  type PlatformDataBrowseQuery,
  type PlatformDataBrowseResult,
} from '@budstar/contracts';
import { ApiException } from '../http/api-error';
import { maskPhone } from '../privacy/mask-phone';

export type PlatformBrowseRow = Record<string, unknown>;

export interface PlatformDataStore {
  list(
    entity: PlatformBrowsableEntity,
    campusId: string | undefined,
    limit: number,
  ): Promise<PlatformBrowseRow[]>;
}

export class InMemoryPlatformDataStore implements PlatformDataStore {
  private readonly rows = new Map<
    PlatformBrowsableEntity,
    PlatformBrowseRow[]
  >();

  seed(entity: PlatformBrowsableEntity, rows: PlatformBrowseRow[]): void {
    this.rows.set(
      entity,
      rows.map((row) => ({ ...row })),
    );
  }

  list(
    entity: PlatformBrowsableEntity,
    campusId: string | undefined,
    limit: number,
  ): Promise<PlatformBrowseRow[]> {
    const rows = (this.rows.get(entity) ?? []).filter((row) => {
      if (!campusId) return true;
      if (entity === 'campus') return row.id === campusId;
      return row.campusId === campusId;
    });
    return Promise.resolve(rows.slice(0, limit).map((row) => ({ ...row })));
  }
}

@Injectable()
export class PlatformAdminService {
  constructor(private readonly store: PlatformDataStore) {}

  async browse(
    query: PlatformDataBrowseQuery,
  ): Promise<PlatformDataBrowseResult> {
    try {
      assertNoArbitrarySql(query);
    } catch {
      throw new ApiException(
        HttpStatus.BAD_REQUEST,
        'VALIDATION_ERROR',
        '数据浏览器禁止任意 SQL',
      );
    }
    const fields = [...PLATFORM_ENTITY_FIELDS[query.entity]];
    const raw = await this.store.list(
      query.entity,
      query.campusId,
      query.limit + 1,
    );
    const truncated = raw.length > query.limit;
    const rows = raw.slice(0, query.limit).map((row) => {
      const projected: PlatformBrowseRow = {};
      for (const field of fields) {
        if (field === 'phoneMasked' && typeof row.phone === 'string') {
          projected.phoneMasked = maskPhone(row.phone);
          continue;
        }
        projected[field] = row[field] ?? null;
      }
      return projected;
    });
    return {
      entity: query.entity,
      fields,
      rows,
      truncated,
    };
  }
}
