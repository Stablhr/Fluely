import mongoose from 'mongoose';
import dotenv from 'dotenv';
import {UserModel} from '../api/models/User.model';

dotenv.config();

const MONGO_URI = process.env.MONGO_URI;
if (!MONGO_URI) {
  console.error('MONGO_URI is not defined in .env');
  process.exit(1);
}

/**
 * Fail-closed backfill: every account that has no stored `profileVisibility`
 * (older accounts, or accounts created before the field existed) defaults to
 * `me` for email, phone and the other profile fields, so nothing is shared
 * with collaborators until the owner explicitly widens it.
 *
 * The serializer in `api/services/account.service.ts` already treats a missing
 * value as `me` at read time; this migration makes the default durable in the
 * database so a future serializer change cannot accidentally loosen it.
 */
async function migrate() {
  await mongoose.connect(MONGO_URI!);
  console.log('Connected to MongoDB');

  const result = await UserModel.updateMany(
    {
      $or: [
        { profileVisibility: { $exists: false } },
        { profileVisibility: null },
        { profileVisibility: {} },
      ],
    },
    {
      $set: {
        profileVisibility: { email: 'me', phone: 'me', others: 'me' },
      },
    }
  );

  console.log(
    `Backfilled profileVisibility for ${result.modifiedCount} users (${result.matchedCount} matched).`,
  );
  await mongoose.disconnect();
}

migrate().catch((err) => {
  console.error(err);
  process.exit(1);
});
