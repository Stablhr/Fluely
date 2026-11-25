import {createHash} from 'crypto';
import jwt from 'jsonwebtoken';
import {env} from '../../config/env';
import {logger} from '../../logging/logger';

/**
 * Upstash QStash: delivers "publish job X" to the webhook at the job's time.
 *
 * QStash only wakes the server; the job row decides what happens. Without
 * `QSTASH_TOKEN` nothing is enqueued and the due-jobs sweep does the work
 * (a timer in local development, `/api/cron/publish-due` elsewhere).
 */

export const WEBHOOK_PATH = '/api/social-publish/webhook';

/** QStash's free plan caps delays at 7 days; longer waits hop in steps. */
const MAX_DELAY_MS = 6 * 24 * 60 * 60 * 1000;

export function qstashEnabled(): boolean {
  return Boolean(env.QSTASH_TOKEN);
}

/**
 * What stops QStash from delivering on time, or null when it is set up.
 * Without it, scheduled posts wait for the daily `/api/cron/publish-due` sweep.
 */
export function qstashConfigProblem(): string | null {
  if (!env.QSTASH_TOKEN) return 'QSTASH_TOKEN is not set';
  if (!env.QSTASH_CURRENT_SIGNING_KEY && !env.QSTASH_NEXT_SIGNING_KEY) {
    return 'no QStash signing key is set, so every delivery is refused';
  }
  if (/^http:\/\/localhost/.test(env.API_PUBLIC_URL)) return 'API_PUBLIC_URL is not set';
  return null;
}

export function webhookUrl(): string {
  return `${env.API_PUBLIC_URL}${WEBHOOK_PATH}`;
}

/** Returns the QStash message id, or null when QStash is off or refused. */
export async function enqueuePublish(jobId: string, runAt: Date): Promise<string | null> {
  if (!qstashEnabled()) return null;
  const wakeAt = Math.min(runAt.getTime(), Date.now() + MAX_DELAY_MS);
  try {
    const res = await fetch(`${env.QSTASH_URL}/v2/publish/${webhookUrl()}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.QSTASH_TOKEN}`,
        'Content-Type': 'application/json',
        'Upstash-Not-Before': String(Math.floor(wakeAt / 1000)),
        'Upstash-Retries': '3'
      },
      body: JSON.stringify({jobId})
    });
    if (!res.ok) {
      logger.error({status: res.status, body: await res.text()}, 'QStash refused a publish job');
      return null;
    }
    const data = (await res.json()) as {messageId?: string};
    return data.messageId ?? null;
  } catch (error) {
    // The sweep still publishes the job; QStash only makes it punctual.
    logger.error({err: error}, 'Could not reach QStash');
    return null;
  }
}

export async function cancelPublish(messageId: string | null | undefined): Promise<void> {
  if (!messageId || !qstashEnabled()) return;
  try {
    await fetch(`${env.QSTASH_URL}/v2/messages/${encodeURIComponent(messageId)}`, {
      method: 'DELETE',
      headers: {Authorization: `Bearer ${env.QSTASH_TOKEN}`}
    });
  } catch (error) {
    // A delivery that still arrives finds the job cancelled and does nothing.
    logger.warn({err: error}, 'Could not withdraw a QStash message');
  }
}

const strip = (value: string) => value.replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');

/**
 * Checks `Upstash-Signature`: a JWT signed with the current or next signing
 * key whose `body` claim is the SHA-256 of the raw body. Refuses everything
 * when no signing key is configured.
 */
export function verifyQstashSignature(signature: string | undefined, rawBody: Buffer): boolean {
  const keys = [env.QSTASH_CURRENT_SIGNING_KEY, env.QSTASH_NEXT_SIGNING_KEY].filter(Boolean) as string[];
  if (!signature || keys.length === 0) return false;
  const bodyHash = strip(createHash('sha256').update(rawBody).digest('base64'));
  for (const key of keys) {
    try {
      const claims = jwt.verify(signature, key, {
        algorithms: ['HS256'],
        issuer: 'Upstash',
        clockTolerance: 30
      }) as {body?: string; sub?: string};
      if (claims.sub && claims.sub !== webhookUrl()) continue;
      if (typeof claims.body === 'string' && strip(claims.body) === bodyHash) return true;
    } catch {
      // try the next key
    }
  }
  return false;
}
