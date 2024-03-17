import mongoose from 'mongoose';
import { Puzzle } from '../types/lichess-api';
//import { puzzleFromDocument } from "../app/api/puzzle/nextPuzzle/nextFor";
import similarity_distance from '../src/similarity';
import { SimilarityColl } from '../models/SimilarityColl';
import { getUserSolvedPuzzleIDs } from '@/app/api/puzzle/nextPuzzle/nextFor';
import { User } from 'lucia';

const cache_size = 30;

const puzzleFromDocument = (document: any): Puzzle => {
  let { _id: _, ...rest } = document;

  return rest as any as Puzzle;
};

export interface SimilarityInstance {
  puzzleId: String;
  cache: Array<String>;
}

export const findSimilarityInstance = async (
  puzzleId: String
): Promise<SimilarityInstance | undefined> => {
  const similarityInstance = await SimilarityColl.findOne({
    puzzleId: puzzleId,
  });

  return similarityInstance
    ? { puzzleId: similarityInstance.puzzleId, cache: similarityInstance.cache }
    : undefined;
};

export const findPuzzlebyId = async (
  puzzleId: String
): Promise<Puzzle | undefined> => {
  const p = await mongoose.connection.collection('testPuzzles').findOne({
    PuzzleId: puzzleId,
  });

  return puzzleFromDocument(p);
};

export const computeSimilarityCache = async (
  puzzle: Puzzle
): Promise<Array<String>> => {
  const radius = 300;
  const allPuzzles = (
    await mongoose.connection
      .collection('testPuzzles')
      .find({
        Rating: {
          $gt: puzzle.Rating - radius,
          $lt: puzzle.Rating + radius,
        },
      })
      .toArray()
  ).map(puzzleFromDocument);

  if (!allPuzzles) {
    throw new Error('cant get all puzzles from testPuzzles');
  }

  let memo = new Map<String, number>();
  let distanceList = allPuzzles.map((p) => {
    if (memo.has(p.hierarchy_tags))
      return [p.PuzzleId, memo.get(p.hierarchy_tags)];
    const distance = similarity_distance(
      p.hierarchy_tags,
      puzzle.hierarchy_tags
    );
    memo.set(p.hierarchy_tags, distance);
    return [p.PuzzleId, distance];
  });
  distanceList.sort((a, b) => (a[1] as number) - (b[1] as number));
  distanceList = distanceList.slice(0, cache_size);
  const similarityCache = distanceList.map((e) => e[0]);

  return similarityCache as String[];
};

export const findSimilarUndoPuzzle = async (
  instance: SimilarityInstance,
  user: User
): Promise<String> => {
  const cache = instance.cache;
  const solved = new Set(await getUserSolvedPuzzleIDs(user));
  for (let i = 0; i < cache.length; i++) {
    const curPuzzleId = cache[i];
    if (solved.has(curPuzzleId.toString())) {
      continue;
    } else {
      return curPuzzleId;
    }
  }
  return 'Whole cache has been solved.';
};
