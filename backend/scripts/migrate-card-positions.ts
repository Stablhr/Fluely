import mongoose from 'mongoose';
import dotenv from 'dotenv';
import {ListDocument, ListModel} from '../api/models/List.model';
import {CardDocument, CardModel} from '../api/models/Card.model';

dotenv.config();

const MONGO_URI = process.env.MONGO_URI;
if (!MONGO_URI) {
  console.error('MONGO_URI is not defined in .env');
  process.exit(1);
}

async function migrate() {
  await mongoose.connect(MONGO_URI!);
  console.log('Connected to MongoDB');

  const lists = await ListModel.find({}).exec();
  let migrated = 0;

  for (const list of lists) {
    const cards = await CardModel.find({listId: list._id}).sort({createdAt: 1}).exec();
    const ids = (list.cardOrder ?? [])
      .map(id => id.toString())
      .filter(id => cards.some(card => card._id.toString() === id));
    for (const card of cards) {
      if (!ids.includes(card._id.toString())) ids.push(card._id.toString());
    }

    const updates = ids.map((id, index) => ({
      updateOne: {
        filter: {_id: id},
        update: {$set: {position: index * 1024}}
      }
    }));
    if (updates.length > 0) {
      await CardModel.bulkWrite(updates);
      migrated += updates.length;
    }
  }

  console.log(`Migrated ${migrated} cards across ${lists.length} lists.`);
  await mongoose.disconnect();
}

migrate().catch(err => {
  console.error(err);
  process.exit(1);
});