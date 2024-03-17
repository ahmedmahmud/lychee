import { dbConnect } from '@/lib/db';
import React from 'react';
import { validateRequest } from '@/lib/auth';
import { getExistingUserRating } from '@/src/rating/getRating';
import WoodpeckerLoader from '@/components/woodpecker/loader';
import { AllRoundColl } from '@/models/AllRoundColl';
import { LastBatchColl } from '@/models/LastBatch';

export default async function TestBoard() {
  await dbConnect();
  const { user } = await validateRequest();
  if (!user) return new Response('Unauthorized', { status: 401 });

  // Temporarily clear solved puzzles and last batch:
  // await LastBatchColl.deleteOne({ username: user.username });
  // await AllRoundColl.deleteOne({ username: user.username });
  // await AllRoundColl.create({
  //   username: user.username,
  //   solved: [],
  // });

  // Testing aggregation.
  // const puzzles2 = await mongoose.connection.collection('testPuzzles').aggregate([
  //   { $addFields: { theme: { $function: { body: 'function(x) { return x + " bruh"; }', args: ['$Themes'], lang: 'js' } } } },
  //   { $match: { theme: { $not: { $regex: /^P/ } } } },
  //   { $sort: { theme: 1 } },
  //   { $limit: 1 },
  // ]).toArray();

  const rating = await getExistingUserRating(user);
  return <WoodpeckerLoader rating={rating} />;
}
