import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

/**
 * One-off migration. Run once per environment:
 *
 *   npm run fix:slug-index
 *
 * `Board.publicSlug` used to be indexed `{unique: true, sparse: true}`. Sparse
 * skips documents where the field is absent, not where it is `null` — and every
 * unpublished board stores `null` — so the index permitted exactly one private
 * board and rejected every later one with E11000, surfacing as a 500 on
 * "create board". The schema now declares a partial index over real strings.
 *
 * MongoDB will not replace an index whose options differ, so the old one has to
 * be dropped before the new definition can be created. That is the whole reason
 * this is a script and not just a schema edit.
 */
async function main() {
  const uri = process.env.MONGO_URI;
  if (!uri) {
    console.error('MONGO_URI is not defined in .env');
    process.exit(1);
  }
  await mongoose.connect(uri);
  const boards = mongoose.connection.collection('boards');

  const before = await boards.indexes();
  const old = before.find(index => index.name === 'publicSlug_1');
  console.log('current publicSlug_1:', JSON.stringify(old));

  if (old && old.sparse) {
    await boards.dropIndex('publicSlug_1');
    console.log('dropped the sparse index');
  } else if (old) {
    console.log('index is not the sparse variant; leaving it alone');
  }

  await mongoose.connection.collection('boards').createIndex(
    {publicSlug: 1},
    {unique: true, partialFilterExpression: {publicSlug: {$type: 'string'}}}
  );
  console.log('created the partial index');

  const after = await boards.indexes();
  console.log('now:', JSON.stringify(after.find(index => index.name === 'publicSlug_1')));

  await mongoose.disconnect();
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
