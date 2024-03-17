import { validateRequest } from '@/lib/auth';
import { dbConnect } from '@/lib/db';
import { Puzzle } from '@/types/lichess-api';
import { NextRequest } from 'next/server';
import { RatingColl } from '../../../../models/RatingColl';
import {
  DEFAULT_RATING,
  Rating,
  getThemeRatings,
} from '@/src/rating/getRating';
import { UserThemeColl } from '@/models/UserThemeColl';
import addRound from './addRound';
import { RatingHistory } from '@/models/RatingHistory';
import { ActivePuzzleColl } from '@/models/ActivePuzzle';
import { updateLeitner, updateThemedLeitner } from '@/src/LeitnerIntance';
import { toGroupId } from '@/lib/utils';
import { TimeThemeColl } from '@/models/TimeThemeColl';
import updateAndScaleRatings from '@/src/rating/RatingCalculator';

export async function POST(req: NextRequest) {
  await dbConnect();
  const { user } = await validateRequest();
  if (!user) {
    return new Response('Unauthorized', { status: 401 });
  }

  // TODO: Remove these things!
  const { puzzle_, success_, prv_, themeGroupStr, time } = await req.json();
  const puzzle = puzzle_ as Puzzle;
  const success = success_ as boolean;
  const userRating = prv_ as Rating;
  const themeGroup = themeGroupStr as string[];
  const group = themeGroup.length > 0 ? toGroupId(themeGroup) : undefined;
  const t = (time as number) / 1000;

  // Delete active puzzle, as it is solved.
  const activePuzzle = await ActivePuzzleColl.findOneAndDelete({
    username: user.username,
  });
  if (!activePuzzle) {
    throw new Error('No active puzzle found - something is wrong!');
  }
  updateAndScaleRatings(userRating, puzzle, success, activePuzzle.isReview);

  // Update user's rating.
  await RatingColl.updateOne({ username: user.username }, { $set: userRating });
  await RatingHistory.create({
    username: user.username,
    theme: 'overall',
    rating: userRating.rating,
  });

  await addRound(user, puzzle);

  const reviewee = activePuzzle.isReview
    ? (JSON.parse(activePuzzle.reviewee) as Puzzle)
    : puzzle;

  if (group) {
    await updateThemedLeitner(user, reviewee, success, group, t);
  } else {
    await updateLeitner(user, reviewee, success, t);
  }

  // NB: We don't filter out irrelevant themes here. Even if theme is irrelevant, we compute ratings and
  // persist in the DB, as this information is useful for dashboard analysitcs.
  const ratingMap = await getThemeRatings(user, false);

  // Update theme ratings.
  const themes = puzzle.Themes.split(' ');
  themes.forEach(async (theme) => {
    const themeRating: Rating = ratingMap.get(theme) || DEFAULT_RATING;
    updateAndScaleRatings(themeRating, puzzle, success, activePuzzle.isReview);
    await UserThemeColl.updateOne(
      { username: user.username, theme: theme },
      { $set: themeRating },
      { upsert: true } // Insert if not found.
    );
    const moves = puzzle.Moves.split(' ').length / 2;
    console.log(`\t\tTime per move : ${t / moves}`);
    if (success) {
      await TimeThemeColl.updateOne(
        { username: user.username, theme: theme },
        {
          $set: { time: t / moves },
        },
        { upsert: true }
      );
    }
    await RatingHistory.create({
      username: user.username,
      theme: theme,
      rating: themeRating.rating,
    });
  });

  return new Response(JSON.stringify(userRating), { status: 200 });
}
