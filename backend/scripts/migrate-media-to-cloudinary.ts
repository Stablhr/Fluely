import fs from 'fs/promises';
import path from 'path';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import {
  CloudinaryResourceType,
  folderForMedia,
  uploadToCloudinary
} from '../api/services/cloudinary.service';

dotenv.config();

/**
 * One-off migration: move media that was stored on local disk onto Cloudinary.
 *
 *   npm run migrate:media-to-cloudinary -- --dir=uploads
 *
 * Run this *before* the old uploads folder is deleted, in an environment where
 * the files still exist. It is idempotent: every document that already has a
 * `publicId` is skipped, so a failed run can simply be repeated.
 *
 * Files that cannot be found (or uploaded) are reported rather than silently
 * skipped, so they can be reviewed by hand.
 */

interface LegacyMediaDoc {
  _id: mongoose.Types.ObjectId;
  boardId?: mongoose.Types.ObjectId | null;
  cardId?: mongoose.Types.ObjectId | null;
  kind?: string;
  mimeType?: string;
  storedName?: string | null;
  publicId?: string | null;
}

function resourceTypeForMime(mimeType: string | undefined): CloudinaryResourceType {
  const mime = (mimeType ?? '').toLowerCase();
  if (mime.startsWith('image/')) return 'image';
  if (mime.startsWith('video/') || mime.startsWith('audio/')) return 'video';
  return 'raw';
}

function argValue(name: string): string | undefined {
  const prefix = `--${name}=`;
  const match = process.argv.find(arg => arg.startsWith(prefix));
  return match ? match.slice(prefix.length) : undefined;
}

async function main() {
  const sourceDir = path.resolve(
    process.cwd(),
    argValue('dir') ?? process.env.MEDIA_UPLOAD_DIR ?? 'uploads'
  );

  const uri = process.env.MONGO_URI;
  if (!uri) {
    console.error('MONGO_URI is required');
    process.exit(1);
  }

  console.log(`Source directory: ${sourceDir}`);

  await mongoose.connect(uri);
  const collection = mongoose.connection.collection<LegacyMediaDoc>('media_attachments');

  const pending = await collection
    .find({
      storedName: {$type: 'string'},
      $or: [{publicId: {$exists: false}}, {publicId: null}, {publicId: ''}]
    })
    .toArray();

  console.log(`${pending.length} media record(s) still on local disk`);

  let migrated = 0;
  const failures: {id: string; storedName: string; reason: string}[] = [];

  for (const doc of pending) {
    const storedName = doc.storedName ?? '';
    const filePath = path.join(sourceDir, path.basename(storedName));

    let buffer: Buffer;
    try {
      buffer = await fs.readFile(filePath);
    } catch (error) {
      failures.push({
        id: doc._id.toString(),
        storedName,
        reason: `file not readable at ${filePath}: ${(error as Error).message}`
      });
      continue;
    }

    try {
      const result = await uploadToCloudinary(buffer, {
        folder: folderForMedia({
          boardId: doc.boardId ? doc.boardId.toString() : null,
          cardId: doc.cardId ? doc.cardId.toString() : null
        }),
        resource_type: 'auto',
        use_filename: true,
        unique_filename: true
      });

      await collection.updateOne(
        {_id: doc._id},
        {
          $set: {
            url: result.secure_url,
            publicId: result.public_id,
            resourceType: result.resource_type === 'video' || result.resource_type === 'raw'
              ? result.resource_type
              : resourceTypeForMime(doc.mimeType)
          }
        }
      );
      migrated += 1;
      console.log(`  ✓ ${storedName} -> ${result.secure_url}`);
    } catch (error) {
      failures.push({
        id: doc._id.toString(),
        storedName,
        reason: (error as Error).message
      });
    }
  }

  console.log(`\nMigrated ${migrated}/${pending.length}`);
  if (failures.length > 0) {
    console.error(`\n${failures.length} failure(s) — review these manually:`);
    for (const failure of failures) {
      console.error(`  ✗ ${failure.storedName} (${failure.id}): ${failure.reason}`);
    }
  }

  await mongoose.disconnect();
  if (failures.length > 0) process.exitCode = 1;
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
