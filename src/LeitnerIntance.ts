import { booleanWithProbability } from '@/lib/utils';
import { LeitnerColl } from '@/models/LeitnerColl';
import { ThemedLeitnerColl } from '@/models/ThemedLeitnerColl';
import { Puzzle } from '@/types/lichess-api';
import { User } from 'lucia';

const BOX_A_PROB: number = 0.8;
const BOX_LIMIT: number = 50;

// If the user solves a puzzle in Box A in < 2 seconds per move, we can remove it
// immediately from system (i.e. promote it twice).
const TIME_THRESHOLD: number = 2;

interface LeitnerInstance {
  boxA: Array<Puzzle>;
  boxB: Array<Puzzle>;
}

const findThemedLeitner = async (
  user: User,
  groupID: string
): Promise<LeitnerInstance | undefined> => {
  const leitner = await ThemedLeitnerColl.findOne({
    username: user.username,
    groupID: groupID,
  });
  if (!leitner) {
    return undefined;
  }
  return { boxA: leitner.boxA, boxB: leitner.boxB };
};

const findLeitner = async (
  user: User
): Promise<LeitnerInstance | undefined> => {
  const leitner = await LeitnerColl.findOne({ username: user.username });
  return leitner ? { boxA: leitner.boxA, boxB: leitner.boxB } : undefined;
};

const nextPuzzle = ({ boxA, boxB }: LeitnerInstance): Puzzle | undefined => {
  console.log(
    `boxA = ${boxA.map((puzzle) => puzzle.PuzzleId)}, boxB = ${boxB.map((puzzle) => puzzle.PuzzleId)}`
  );
  const tryBoxA = booleanWithProbability(BOX_A_PROB);
  const lastA = boxA.length > 0 ? boxA[boxA.length - 1] : undefined;
  const lastB = boxB.length > 0 ? boxB[boxB.length - 1] : undefined;
  // The cases where we can do what `tryBoxA` suggests.
  if (tryBoxA && lastA) {
    return lastA;
  } else if (!tryBoxA && lastB) {
    return lastB;
  }
  // Otherwise, at most one box is non-empty - let's pick from it if it exists.
  return lastA || lastB;
};

const filterOutPuzzle = (box: Array<Puzzle>, puzzle: Puzzle): Array<Puzzle> =>
  box.filter((boxedPuzzle) => boxedPuzzle.PuzzleId !== puzzle.PuzzleId);

// Note: Comparing on ID here is required; a `includes` or `indexOf` check on puzzles does NOT work.
const boxContains = (box: Array<Puzzle>, puzzle: Puzzle): boolean =>
  filterOutPuzzle(box, puzzle).length < box.length;

const updateIncorrect = (leitner: LeitnerInstance, puzzle: Puzzle): void => {
  // Add to Box A, both when it's not present in a box and when it's in Box B (the latter
  // corresponds to demotion). And if already in Box A, move to front.
  leitner.boxA = [puzzle, ...filterOutPuzzle(leitner.boxA, puzzle)].slice(
    0,
    BOX_LIMIT
  );
  leitner.boxB = filterOutPuzzle(leitner.boxB, puzzle).slice(0, BOX_LIMIT);
};

const updateCorrect = (
  leitner: LeitnerInstance,
  puzzle: Puzzle,
  time: number
): void => {
  if (boxContains(leitner.boxA, puzzle)) {
    // Remove from A.
    leitner.boxA = filterOutPuzzle(leitner.boxA, puzzle).slice(0, BOX_LIMIT);
    if (time >= TIME_THRESHOLD) {
      // Promote to B.
      leitner.boxB = [puzzle, ...leitner.boxB].slice(0, BOX_LIMIT);
    }
  } else if (boxContains(leitner.boxB, puzzle)) {
    // Remove from Leitner entirely.
    leitner.boxB = filterOutPuzzle(leitner.boxB, puzzle).slice(0, BOX_LIMIT);
  } // Else, when not present in Leitner, do nothing.
};

export const nextLeitnerReview = async (
  user: User
): Promise<Puzzle | undefined> => {
  const leitner = await findLeitner(user);
  if (!leitner) {
    return undefined;
  }
  return nextPuzzle(leitner);
};

export const nextThemedLeitnerReview = async (
  user: User,
  groupID: string
): Promise<Puzzle | undefined> => {
  const leitner = await findThemedLeitner(user, groupID);
  if (!leitner) {
    return undefined;
  }
  return nextPuzzle(leitner);
};

export const updateLeitner = async (
  user: User,
  puzzle: Puzzle,
  correct: boolean,
  time: number
): Promise<void> => {
  const leitner = await findLeitner(user);
  if (!leitner) {
    if (!correct) {
      // We should initialise a default Leitner instance with this puzzle in Box A.
      await LeitnerColl.create({
        username: user.username,
        boxA: [puzzle],
        boxB: [],
      });
    }
    return;
  }
  console.log(
    `Before update: boxA = ${leitner.boxA.map((puzzle) => puzzle.PuzzleId)}, boxB = ${leitner.boxB.map((puzzle) => puzzle.PuzzleId)}`
  );
  if (correct) {
    updateCorrect(leitner, puzzle, time);
  } else {
    updateIncorrect(leitner, puzzle);
  }
  console.log(
    `After update: boxA = ${leitner.boxA.map((puzzle) => puzzle.PuzzleId)}, boxB = ${leitner.boxB.map((puzzle) => puzzle.PuzzleId)}`
  );
  await LeitnerColl.updateOne({ username: user.username }, leitner);
};

export const updateThemedLeitner = async (
  user: User,
  puzzle: Puzzle,
  correct: boolean,
  groupID: string,
  time: number
): Promise<void> => {
  const leitner = await findThemedLeitner(user, groupID);
  if (!leitner) {
    if (!correct) {
      // We should initialise a default Leitner instance with this puzzle in Box A.
      console.log('Creating themed Leiitner');
      await ThemedLeitnerColl.create({
        username: user.username,
        boxA: [puzzle],
        boxB: [],
        groupID: groupID,
      });
    }
    return;
  }
  console.log(
    `Before update: boxA = ${leitner.boxA.map((puzzle) => puzzle.PuzzleId)}, boxB = ${leitner.boxB.map((puzzle) => puzzle.PuzzleId)}`
  );
  if (correct) {
    updateCorrect(leitner, puzzle, time);
  } else {
    updateIncorrect(leitner, puzzle);
  }
  console.log(
    `After update: boxA = ${leitner.boxA.map((puzzle) => puzzle.PuzzleId)}, boxB = ${leitner.boxB.map((puzzle) => puzzle.PuzzleId)}`
  );
  await ThemedLeitnerColl.updateOne(
    { username: user.username, groupID: groupID },
    { boxA: leitner.boxA, boxB: leitner.boxB }
  );
};
