import type {
  CreatePresignedUploadInput,
  ObjectStorageReadiness,
  PresignedUpload,
} from '@budstar/contracts';

export type ObjectStoragePresignRequest = CreatePresignedUploadInput & {
  actorAccountId: string;
  campusId?: string;
};

export interface ObjectStorageAdapter {
  readonly provider: 'local' | 'cos';
  createPresignedUpload(
    input: ObjectStoragePresignRequest,
  ): Promise<PresignedUpload>;
  readiness(): ObjectStorageReadiness;
}

export type ResolveObjectStorageAdapterOptions = {
  nodeEnv: string | undefined;
  provider: string | undefined;
  localRoot?: string;
  publicBaseUrl?: string;
  cos?: {
    secretId?: string;
    secretKey?: string;
    bucket?: string;
    region?: string;
    publicBaseUrl?: string;
  };
};

export function resolveObjectStorageAdapter(
  options: ResolveObjectStorageAdapterOptions,
  factories: {
    createLocal: (config: {
      rootDir: string;
      publicBaseUrl: string;
    }) => ObjectStorageAdapter;
    createCos: (config: {
      secretId: string;
      secretKey: string;
      bucket: string;
      region: string;
      publicBaseUrl: string;
    }) => ObjectStorageAdapter;
    createDegraded: (reasons: string[]) => ObjectStorageAdapter;
  },
): ObjectStorageAdapter {
  const requested = (options.provider ?? 'local').toLowerCase();

  if (requested === 'local') {
    return factories.createLocal({
      rootDir: options.localRoot ?? '.data/object-storage',
      publicBaseUrl:
        options.publicBaseUrl ?? 'http://localhost:3001/api/object-storage',
    });
  }

  if (requested === 'cos') {
    const cos = options.cos ?? {};
    const missing = (
      [
        ['COS_SECRET_ID', cos.secretId],
        ['COS_SECRET_KEY', cos.secretKey],
        ['COS_BUCKET', cos.bucket],
        ['COS_REGION', cos.region],
      ] as const
    )
      .filter(([, value]) => !value)
      .map(([name]) => name);

    if (missing.length > 0) {
      if (options.nodeEnv === 'production') {
        throw new Error(
          `Object storage COS adapter is fail-closed in production; missing ${missing.join(', ')}`,
        );
      }
      return factories.createDegraded([
        `COS configuration incomplete: ${missing.join(', ')}`,
      ]);
    }

    return factories.createCos({
      secretId: cos.secretId!,
      secretKey: cos.secretKey!,
      bucket: cos.bucket!,
      region: cos.region!,
      publicBaseUrl:
        cos.publicBaseUrl ??
        `https://${cos.bucket}.cos.${cos.region}.myqcloud.com`,
    });
  }

  if (options.nodeEnv === 'production') {
    throw new Error(`Unknown object storage provider: ${requested}`);
  }
  return factories.createDegraded([`Unknown provider: ${requested}`]);
}
