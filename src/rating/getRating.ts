import { RatingColl } from '@/models/RatingColl';
import { Puzzle } from '@/types/lichess-api';
import { User } from 'lucia';
import { UserThemeColl } from '@/models/UserThemeColl';
import { isIrrelevant } from '@/app/api/puzzle/nextPuzzle/themeGenerator';

export type Rating = {
  rating: number;
  ratingDeviation: number;
  volatility: number;
  numberOfResults: number;
};

export const DEFAULT_RATING: Rating = {
  rating: 1500,
  ratingDeviation: 350,
  volatility: 0.09,
  numberOfResults: 0,
};

// Retrieve all data (execept volatility which isn't public) from Lichess API.
export const fetchLichessRating = async (user: User): Promise<Rating> => {
  const { perfs } = await fetch(
    `https://lichess.org/api/user/${user?.username}`
  ).then((res) => res.json());
  // If the user has solved no puzzles, use the default, provisional rating.
  if (!perfs.puzzle) {
    return DEFAULT_RATING;
  }
  const { games, rating, rd, _ } = perfs.puzzle;
  // Use default volatility since actual is not public.
  return {
    rating: rating,
    ratingDeviation: rd,
    volatility: DEFAULT_RATING.volatility,
    numberOfResults: games,
  };
};

// Gets a user's rating from through the collection.
// The user must have logged in once before - this function will throw an error if not.
export const getExistingUserRating = async (user: User): Promise<Rating> =>
  RatingColl.findOne({ username: user.username }).then(async (result) => {
    if (result) {
      return {
        rating: result.rating,
        ratingDeviation: result.ratingDeviation,
        volatility: result.volatility,
        numberOfResults: result.numberOfResults,
      };
    }
    throw new Error('User not present in rating collection.');
  });

export const getPuzzleRating = (puzzle: Puzzle): Rating => ({
  rating: puzzle.Rating,
  ratingDeviation: puzzle.RatingDeviation,
  volatility: DEFAULT_RATING.volatility, // Actual volatility not in Lichess' puzzle collection.
  numberOfResults: puzzle.NbPlays,
});

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
    map.set(document.theme, {
      rating: document.rating,
      ratingDeviation: document.ratingDeviation,
      volatility: document.volatility,
      numberOfResults: document.numberOfResults,
    });
  });
  return map;
};
