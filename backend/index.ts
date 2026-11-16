import app from './app';
import {connectDb} from './api/config/db';
import {env} from './api/config/env';
import {publishDueJobs} from './api/services/social/publisher.service';

let dbInitPromise: Promise<unknown> | null = null;
const ensureDb = () => {
  if (!dbInitPromise) {
    dbInitPromise = connectDb();
  }
  return dbInitPromise;
};

export default async function handler(
  req: import('express').Request,
  res: import('express').Response
) {
  try {
    await ensureDb();
    return app(req, res);
  } catch (error) {
    console.error('Failed to connect to database', error);
    return res.status(500).json({message: 'Database connection failed'});
  }
}

if (process.env.VERCEL !== '1') {
  ensureDb()
    .then(() => {
      app.listen(env.PORT, () => {
        console.log(`Server listening on port ${env.PORT}`);
      });
      // QStash cannot reach localhost, so a long-running server publishes
      // scheduled posts itself. Claims are atomic, so this is safe alongside
      // QStash deliveries.
      setInterval(() => {
        publishDueJobs().catch(error => console.error('Publishing sweep failed', error));
      }, 30_000);
    })
    .catch(error => {
      console.error('Failed to connect to database', error);
      process.exit(1);
    });
}
