import mongoose from 'mongoose';

export type ProductSession = mongoose.ClientSession | undefined;

function isUnsupportedTransaction(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    return false;
  }
  const record = error as Record<string, unknown>;
  const code = record.code;
  const message = typeof record.message === 'string' ? record.message : '';
  return (
    code === 20 ||
    code === 303 ||
    code === 263 ||
    message.toLowerCase().includes('transaction') &&
      (message.toLowerCase().includes('not supported') || message.toLowerCase().includes('replica set'))
  );
}

export async function withProductTransaction<T>(
  work: (session: ProductSession) => Promise<T>
): Promise<T> {
  let session: mongoose.ClientSession | undefined;
  try {
    session = await mongoose.startSession();
    let result: T | undefined;
    await session.withTransaction(async () => {
      result = await work(session);
    });
    if (result === undefined) {
      throw new Error('Transaction completed without a result');
    }
    return result;
  } catch (error) {
    if (!isUnsupportedTransaction(error)) {
      throw error;
    }
    return work(undefined);
  } finally {
    if (session) {
      await session.endSession();
    }
  }
}
