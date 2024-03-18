import { AllRoundColl } from '@/models/AllRoundColl';
import {
  Rating,
  getExistingUserRating,
  getThemeRatings,
} from '@/src/rating/getRating';
import { Puzzle } from '@/types/lichess-api';
import { User } from 'lucia';
import mongoose from 'mongoose';
import sm2RandomThemeFromRatingMap from '../../../../src/sm2';
import frequentiallyRandomTheme, { isIrrelevant } from './themeGenerator';
import { ActivePuzzleColl } from '@/models/ActivePuzzle';
import { booleanWithProbability, toGroupId } from '@/lib/utils';
import { nextLeitnerReview } from '@/src/LeitnerIntance';
import { similarBatchForCompromised } from '../similarBatch/similarBatchFor';

const MAX_REPS: number = 12;
const MAX_COMPROMISE: number = 3;

const LEITNER_PROBABILITY: number = 0.2;
const MIN_CANDIDATES: number = 10;

export type PuzzleWithUserRating = {
  puzzle: Puzzle | undefined;
  rating: Rating;
  similar?: Puzzle[];
};

export const getUserSolvedPuzzleIDs = async (user: User): Promise<string[]> => {
  const doc = await AllRoundColl.findOne({ username: user.username });
  if (!doc) {
    throw new Error(
      'AllRound collection not populated with user, should happen on first login'
    );
  }
  return doc.solved;
};

export const puzzleFromDocument = (document: any): Puzzle => {
  let { _id: _, ...rest } = document;
  return rest as any as Puzzle;
};

// Clamp rating between 400 and 2700, similar to
// https://github.com/clarkerubber/lila/blob/1651e001c4e2794a6b6804860fc729401a670469/modules/puzzle/src/main/Selector.scala#L63
export const clampRating = (glicko: number): number =>
  Math.max(400, Math.min(2700, glicko));

// We compute the radius (`ratingFlex`) as in
// https://github.com/lichess-org/lila/blob/e6ce7245b528035ba9bc6ee37ae34799728cdc19/modules/puzzle/src/main/PuzzlePath.scala#L43
// except, since we don't use paths, we allow for a larger initial radius by compromoie = 1, scaling by a factor of 3/4;
export const radiusForRating = (rating: number, compromise: number): number =>
  0.75 * compromise * (100 + Math.abs(1500 - rating) / 4);

const nextPuzzleForThemeAndRating = async (
  theme: string,
  rawRating: number,
  exceptions: any,
  compromise: number = 1
): Promise<Puzzle | undefined> => {
  if (compromise > MAX_COMPROMISE) {
    return undefined;
  }
  const rating = compromise > 1 ? rawRating : clampRating(rawRating);
  const radius = radiusForRating(rating, compromise);
  console.log(`radius = ${radius}, theme = ${theme}, rating = ${rating}`);
  const p = await mongoose.connection.collection('testPuzzles').findOne({
    PuzzleId: { $nin: exceptions },
    Rating: {
      $gt: rating - radius,
      $lt: rating + radius,
    },
    // TODO: Improve this. Maybe transform testPuzzles to not have this annoying
    // space-separated string of themes?
    Themes: { $regex: new RegExp('\\b' + theme + '\\b', 'i') },
  });
  // No puzzle found; increase compromise.
  if (p === null) {
    return await nextPuzzleForThemeAndRating(
      theme,
      rating,
      exceptions,
      compromise + 1
    );
  }
  return puzzleFromDocument(p);
};

const nextPuzzleRepetitions = async (
  username: string,
  userRating: number,
  reps: number,
  ratingMap: Map<string, Rating>,
  exceptions: any
): Promise<Puzzle | undefined> => {
  if (reps == MAX_REPS) {
    console.log('Maximum repetitions reached during puzzle selection');
    return undefined;
  }
  let rating = userRating;
  let theme = frequentiallyRandomTheme();
  // If the theme is not in the rating map, let's try to use it.
  // Otherwise, let's run probabilistic SM2 on the rating map.
  const useSpacedRep = ratingMap.has(theme);
  if (useSpacedRep) {
    theme = await sm2RandomThemeFromRatingMap(username, ratingMap);
    rating = ratingMap.get(theme)!.rating;
    console.log(`Using rating: ${rating} for theme: ${theme}`);
  }
  const p = await nextPuzzleForThemeAndRating(theme, rating, exceptions);
  if (p) {
    if (isIrrelevant(theme)) {
      throw new Error(
        'Irrelevant theme found - incorrect/no filtering has occured.'
      );
    }
    console.log(
      `Found theme ${theme} ${useSpacedRep ? 'through SM2' : 'frequentially'} after ${reps} reps.`
    );
    return p;
  }
  return await nextPuzzleRepetitions(
    username,
    rating,
    reps + 1,
    ratingMap,
    exceptions
  );
};

const nextThemedPuzzlesForRepetitions = async (
  userRating: number,
  ratingMap: Map<string, Rating>,
  reps: number,
  themeGroup: string[],
  expceptions: any
): Promise<Puzzle | undefined> => {
  if (reps == MAX_REPS) {
    console.log('Maximum repetitions reached during puzzle selection');
    return undefined;
  }
  const theme = themeGroup[Math.floor(Math.random() * themeGroup.length)];
  // If theme is present in rating map, use its rating for adaptive difficulty
  // selection. Otherwise, use user's rating.
  const rating = ratingMap.get(theme)?.rating || userRating;
  console.log(`Using rating: ${rating} for theme: ${theme}`);
  const p = await nextPuzzleForThemeAndRating(theme, rating, expceptions);
  if (p) {
    console.log(`Found grouped theme ${theme} after ${reps} reps.`);
    return p;
  }
  return await nextThemedPuzzlesForRepetitions(
    userRating,
    ratingMap,
    reps + 1,
    themeGroup,
    expceptions
  );
};

const nextPuzzleFor = async (
  user: User,
  woodpecker: boolean = false,
  themeGroup: string[] = []
): Promise<PuzzleWithUserRating> =>
  getExistingUserRating(user).then(async (rating) => {
    const groupId = toGroupId(themeGroup);

    if (!woodpecker) {
      const activePuzzle = await ActivePuzzleColl.findOne({
        username: user.username,
      });
      if (activePuzzle) {
        if (groupId !== activePuzzle.groupID) {
          // NB: Preserving active puzzles per-modes is tricky. We can't permit this mode solving that puzzle,
          // then back in previous mode user solving it again.
          await ActivePuzzleColl.deleteOne({ username: user.username });
        } else {
          console.log('Found active puzzle');
          return {
            puzzle: JSON.parse(activePuzzle.puzzle) as Puzzle,
            rating: rating,
            similar: activePuzzle.reviewee
              ? [JSON.parse(activePuzzle.reviewee) as Puzzle]
              : [],
          };
        }
      }
    }

    const result = await (async () => {
      // TODO: Iterate to better handle repeat avoidance.
      const exceptions: string[] = await getUserSolvedPuzzleIDs(user);
      if (!woodpecker && booleanWithProbability(LEITNER_PROBABILITY)) {
        console.log('Trying to use Leitner...');
        const puzzleToReview = await nextLeitnerReview(user, groupId);
        if (puzzleToReview) {
          console.log(
            `Worked! Puzzle Id: ${puzzleToReview.PuzzleId} from Leitner, tags: ${puzzleToReview.hierarchy_tags}`
          );
          const [similarPuzzle] = await similarBatchForCompromised(
            user,
            [puzzleToReview],
            clampRating(rating.rating),
            exceptions,
            MIN_CANDIDATES,
            false
          );
          console.log(
            `Got similar puzzle with tags ${similarPuzzle.hierarchy_tags} and line ${similarPuzzle.Moves}`
          );
          return {
            puzzle: similarPuzzle,
            similar: [puzzleToReview],
          };
        }
      }
      // NB: The persisted rating map may contain irrelevant themes, but we don't
      // want to include these for nextPuzzle / SM2, so we filter them out below.
      const ratingMap = await getThemeRatings(user, true);
      return {
        puzzle: groupId
          ? await nextThemedPuzzlesForRepetitions(
              rating.rating,
              ratingMap,
              0,
              themeGroup,
              exceptions
            )
          : await nextPuzzleRepetitions(
              user.username,
              rating.rating,
              0,
              ratingMap,
              exceptions
            ),
      };
    })();

    if (result.puzzle) {
      console.log(
        `Got puzzle with themes ${result.puzzle.Themes} and rating ${result.puzzle.Rating} and line ${result.puzzle.Moves}`
      );
      // Persist selection as active puzzle.
      if (!woodpecker) {
        await ActivePuzzleColl.updateOne(
          { username: user.username },
          {
            username: user.username,
            puzzle: JSON.stringify(result.puzzle),
            reviewee: result.similar
              ? JSON.stringify(result.similar[0])
              : undefined,
            groupID: groupId,
          },
          { upsert: true }
        );
      }
    }
    return { ...result, rating };
  });

export default nextPuzzleFor;
