import { validateRequest } from '@/lib/auth';
import { dbConnect } from '@/lib/db';
import { Puzzle } from '@/types/lichess-api';
import { NextRequest } from 'next/server';
import { RatingColl } from '../../../../models/RatingColl';
import {
  DEFAULT_RATING,
  Rating,
  getExistingUserRating,
  getThemeRatings,
} from '@/src/rating/getRating';
import { UserThemeColl } from '@/models/UserThemeColl';
import addRound from './addRound';
import { RatingHistory } from '@/models/RatingHistory';
import { ActivePuzzleColl } from '@/models/ActivePuzzle';
import { updateLeitner } from '@/src/LeitnerIntance';
import { toGroupId } from '@/lib/utils';
import { TimeThemeColl } from '@/models/TimeThemeColl';
import updateAndScaleRatings from '@/src/rating/RatingCalculator';

const MILLISECONDS_IN_SECOND = 1000;

export async function POST(req: NextRequest) {
  await dbConnect();
  const { user } = await validateRequest();
  if (!user) {
    return new Response('Unauthorized', { status: 401 });
  }

  // Delete active puzzle, as it is solved.
  const activePuzzle = await ActivePuzzleColl.findOneAndDelete({
    username: user.username,
  });
  if (!activePuzzle) {
    throw new Error('No active puzzle found - something is wrong!');
  }

  const userRating = await getExistingUserRating(user);
  const { successStr, themeGroupStr, timeStr } = await req.json();
  const puzzle = JSON.parse(activePuzzle.puzzle) as Puzzle;
  const success = successStr as boolean;
  const moves = puzzle.Moves.split(' ').length / 2;
  const timePerMove = (timeStr as number) / MILLISECONDS_IN_SECOND / moves;
  const isReview = !!activePuzzle.reviewee;

  // Update and persist user's rating.
  updateAndScaleRatings(userRating, puzzle, success, isReview);
  await RatingColl.updateOne({ username: user.username }, { $set: userRating });
  await RatingHistory.create({
    username: user.username,
    theme: 'overall',
    rating: userRating.rating,
  });
  // Mark puzzle as solved by user.
  await addRound(user, puzzle);
  // Update Leitner instance (of original puzzle if review).
  await updateLeitner(
    user,
    isReview ? (JSON.parse(activePuzzle.reviewee) as Puzzle) : puzzle,
    success,
    toGroupId(themeGroupStr as string[]),
    timePerMove
  );

  // NB: We don't filter out irrelevant themes here. Even if theme is irrelevant, we compute ratings and
  // persist in the DB, as this information may be useful for dashboard analyitcs.
  const ratingMap = await getThemeRatings(user, false);

  puzzle.Themes.split(' ').forEach(async (theme) => {
    const themeRating: Rating = ratingMap.get(theme) || DEFAULT_RATING;
    // Update and persist per-theme ratings.
    updateAndScaleRatings(themeRating, puzzle, success, isReview);
    await UserThemeColl.updateOne(
      { username: user.username, theme: theme },
      { $set: themeRating },
      { upsert: true }
    );
    // Persist LAST time taken for each theme.
    if (success) {
      await TimeThemeColl.updateOne(
        { username: user.username, theme: theme },
        { $set: { time: timePerMove } },
        { upsert: true }
      );
    }
    // Add entry in theme's rating history.
    await RatingHistory.create({
      username: user.username,
      theme: theme,
      rating: themeRating.rating,
    });
  });

  return new Response(JSON.stringify(userRating), { status: 200 });
}
