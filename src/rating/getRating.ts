import { RatingColl } from '@/models/RatingColl';
import { Puzzle } from '@/types/lichess-api';
import { User } from 'lucia';
import Rating from './GlickoV2Rating';
import { UserThemeColl } from '@/models/UserThemeColl';
import { isIrrelevant } from '@/app/api/puzzle/nextPuzzle/themeGenerator';

export type RatingHolder = {
  rating: number;
  ratingDeviation: number;
  volatility: number;
  numberOfResults: number;
};

const DEFAULT_VOLATILITY: number = 0.09;

// Default, provisional rating.
export const getDefaultRating = () =>
  new Rating(1500, 350, DEFAULT_VOLATILITY, 0);

// Retrieve all data (execept volatility which isn't public) from Lichess API.
export const fetchLichessRating = async (user: User): Promise<Rating> => {
  const { perfs } = await fetch(
    `https://lichess.org/api/user/${user?.username}`
  ).then((res) => res.json());

  // If the user has solved no puzzles, use the default, provisional rating.
  if (!perfs.puzzle) {
    return getDefaultRating();
  }

  const { games, rating, rd, _ } = perfs.puzzle;
  // Use default volatility since actual is not public.
  return new Rating(rating, rd, DEFAULT_VOLATILITY, games);
};

// Gets a user's rating from through the collection.
// The user must have logged in once before - this function will throw an error if not.
export const getExistingUserRating = async (user: User): Promise<Rating> =>
  RatingColl.findOne({ username: user.username }).then(async (result) => {
    if (result) {
      return new Rating(
        result.rating,
        result.ratingDeviation,
        result.volatility,
        result.numberOfResults
      );
    }
    throw new Error('User not present in rating collection.');
  });

export const getExistingUserRatingByName = async (
  username: string
): Promise<Rating> =>
  RatingColl.findOne({ username: username }).then(async (result) => {
    if (result) {
      return new Rating(
        result.rating,
        result.ratingDeviation,
        result.volatility,
        result.numberOfResults
      );
    }
    throw new Error('User not present in rating collection.');
  });

export const getPuzzleRating = (puzzle: Puzzle): Rating =>
  new Rating(
    puzzle.Rating,
    puzzle.RatingDeviation,
    DEFAULT_VOLATILITY, // Actual volatility not in Lichess' puzzle collection.
    puzzle.NbPlays
  );

export const toHolder = (v: Rating): RatingHolder => {
  return {
    rating: v.rating,
    ratingDeviation: v.ratingDeviation,
    volatility: v.volatility,
    numberOfResults: v.numberOfResults,
  };
};

export const getThemeRatings = async (
  user: User,
  filterOutIrrelevant: boolean // Whether to filter out irrelevant themes.
): Promise<Map<string, Rating>> => {
  const map: Map<string, Rating> = new Map();
  (
    await UserThemeColl.find({
      username: user.username,
    })
  ).forEach((document) => {
    if (filterOutIrrelevant && isIrrelevant(document.theme)) {
      return;
    }
    map.set(
      document.theme,
      new Rating(
        document.rating,
        document.ratingDeviation,
        document.volatility,
        document.numberOfResults
      )
    );
  });
  return map;
};
