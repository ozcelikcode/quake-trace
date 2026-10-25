/**
 * Upstream services reachable through `/api/<id>/<path>`. Only the listed paths are
 * forwarded; everything else is rejected so the Worker never acts as an open proxy.
 * Findings behind each entry are recorded in memory-bank/dataSources.md.
 */
export interface Upstream {
  /** Scheme and host of the upstream service. */
  readonly origin: string;
  /** Path prefix prepended to the forwarded path. */
  readonly basePath: string;
  /** Allowed forwarded paths mapped to their cache lifetime in seconds. */
  readonly paths: Readonly<Record<string, number>>;
  readonly headers?: Readonly<Record<string, string>>;
}

/** AFAD's gateway rejects non-browser user agents. */
const BROWSER_USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Safari/537.36';

const DAY_SECONDS = 86_400;

export const upstreams = {
  afad: {
    origin: 'https://servisnet.afad.gov.tr',
    basePath: '/apigateway/deprem/apiv2',
    paths: { '/event/filter': 30 },
    headers: { 'User-Agent': BROWSER_USER_AGENT, Accept: 'application/json' },
  },
  kandilli: {
    origin: 'http://www.koeri.boun.edu.tr',
    basePath: '/scripts',
    paths: { '/lst0.asp': 30 },
  },
  koeri: {
    origin: 'http://eida-service.koeri.boun.edu.tr',
    basePath: '/fdsnws',
    paths: { '/station/1/query': DAY_SECONDS, '/dataselect/1/query': 30 },
  },
} as const satisfies Record<string, Upstream>;

export type UpstreamId = keyof typeof upstreams;
