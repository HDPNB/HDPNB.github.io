type CloudBaseSdk = typeof import('@cloudbase/js-sdk');

export type CloudBaseApp = ReturnType<CloudBaseSdk['init']>;
export type CloudBaseAuth = ReturnType<CloudBaseApp['auth']>;
export type CloudBaseDatabase = ReturnType<CloudBaseApp['database']>;

function createClassicStorage(app: CloudBaseApp) {
  return app.storage.from();
}

export type CloudBaseStorage = ReturnType<typeof createClassicStorage>;

export interface CloudBaseClient {
  app: CloudBaseApp;
  auth: CloudBaseAuth;
  database: CloudBaseDatabase;
  storage: CloudBaseStorage;
}

export type CloudBaseClientResult =
  | { ok: true; client: CloudBaseClient }
  | {
      ok: false;
      code: 'disabled' | 'unconfigured' | 'unavailable';
      message: string;
    };

const enabled = import.meta.env.PUBLIC_CLOUDBASE_ENABLED === 'true';
const envId = (import.meta.env.PUBLIC_CLOUDBASE_ENV_ID || '').trim();

let clientPromise: Promise<CloudBaseClientResult> | undefined;

export const cloudBaseConfig = Object.freeze({
  enabled,
  configured: enabled && Boolean(envId),
});

export function getCloudBaseClient(): Promise<CloudBaseClientResult> {
  if (typeof window === 'undefined') {
    return Promise.resolve({
      ok: false,
      code: 'unavailable',
      message: '互动功能只能在浏览器中使用。',
    });
  }

  if (!enabled) {
    return Promise.resolve({
      ok: false,
      code: 'disabled',
      message: '互动功能暂未开启。',
    });
  }

  if (!envId) {
    return Promise.resolve({
      ok: false,
      code: 'unconfigured',
      message: '互动功能尚未完成配置。',
    });
  }

  if (!clientPromise) {
    clientPromise = import('@cloudbase/js-sdk')
      .then(({ default: cloudbase }) => {
        const app = cloudbase.init({ env: envId });
        return {
          ok: true,
          client: {
            app,
            auth: app.auth(),
            database: app.database(),
            storage: createClassicStorage(app),
          },
        } satisfies CloudBaseClientResult;
      })
      .catch(() => ({
        ok: false,
        code: 'unavailable',
        message: '互动功能暂时无法连接，请稍后再试。',
      }));
  }

  return clientPromise;
}
