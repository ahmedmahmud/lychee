import { Puzzle } from '@/types/lichess-api';
import GameResult from './GameResult';
import GlickoRating from './GlickoV2Rating';
import { Rating, getPuzzleRating } from './getRating';

const REVIEW_SCALING_FACTOR = 0.7;

// If the puzzle was a review, we scale the rating change by 70%.
// We apply this both to user's overrall rating and to theme ratings.
// TODO: This also reduces rating decrease for failed reviews (the idea being
// not to penalise a user being bad at something), but one can argue that
// we should be harsher instead on a failed review.
// TODO: Should we scale the rating deviation and volatility as well? Not
// sure how safe it is to solely scale the rating.
const scaleRatingDelta = (oldRating: number, newGlicko: GlickoRating): void => {
  const delta = newGlicko.rating - oldRating;
  newGlicko.rating = oldRating + REVIEW_SCALING_FACTOR * delta;
};

const toGlickoRating = (rating: Rating): GlickoRating =>
  new GlickoRating(
    rating.rating,
    rating.ratingDeviation,
    rating.volatility,
    rating.numberOfResults
  );

const updateAndScaleRatings = (
  userRating: Rating,
  puzzle: Puzzle,
  success: boolean,
  isReview: boolean
): void => {
  const oldRating = userRating.rating;
  const userGlicko = toGlickoRating(userRating);
  if (success) {
    new RatingCalculator().updateRatings(
      new GameResult(userGlicko, toGlickoRating(getPuzzleRating(puzzle)))
    );
  } else {
    new RatingCalculator().updateRatings(
      new GameResult(toGlickoRating(getPuzzleRating(puzzle)), userGlicko)
    );
  }
  if (isReview) {
    scaleRatingDelta(oldRating, userGlicko);
  }
  userRating.rating = userGlicko.rating;
  userRating.ratingDeviation = userGlicko.ratingDeviation;
  userRating.volatility = userGlicko.volatility;
  userRating.numberOfResults = userGlicko.numberOfResults;
};

const CONVERGENCE_TOLERANCE: number = 0.000001;
const ITERATION_MAX: number = 1000;

// TODO(sm3421): https://github.com/lichess-org/lila/blob/master/modules/puzzle/src/main/PuzzleFinisher.scala#L200.
// export for sake of testing.
export class RatingCalculator {
  constructor(private tau: number = 0.75) {}

  updateRatings(
    result: GameResult,
    skipDeviationIncrease: boolean = false
  ): void {
    const players: GlickoRating[] = result.players();
    players.forEach((player) => {
      this.calculateNewRating(player, [result], skipDeviationIncrease ? 0 : 1);
    });
    players.forEach((player) => player.finaliseRating());
  }

  private calculateNewRating(
    player: GlickoRating,
    results: GameResult[],
    elapsedRatingPeriods: number
  ): void {
    const phi = player.getGlicko2RatingDeviation();
    const sigma = player.volatility;
    const a = Math.log(Math.pow(sigma, 2));
    const delta = this.deltaOf(player, results);
    const v = this.vOf(player, results);

    let A = a;
    let B = 0;

    if (Math.pow(delta, 2) > Math.pow(phi, 2) + v) {
      B = Math.log(Math.pow(delta, 2) - Math.pow(phi, 2) - v);
    } else {
      let k = 1;
      B = a - k * Math.abs(this.tau);
      while (this.f(B, delta, phi, v, a, this.tau) < 0) {
        k++;
        B = a - k * Math.abs(this.tau);
      }
    }

    let fA = this.f(A, delta, phi, v, a, this.tau);
    let fB = this.f(B, delta, phi, v, a, this.tau);

    let iterations = 0;
    while (
      Math.abs(B - A) > CONVERGENCE_TOLERANCE &&
      iterations < ITERATION_MAX
    ) {
      iterations++;
      const C = A + ((A - B) * fA) / (fB - fA);
      const fC = this.f(C, delta, phi, v, a, this.tau);

      if (fC * fB <= 0) {
        A = B;
        fA = fB;
      } else {
        fA = fA / 2.0;
      }

      B = C;
      fB = fC;
    }

    if (iterations === ITERATION_MAX) {
      console.log(`Convergence fail at ${iterations} iterations!`);
      throw new Error('Convergence fail');
    }

    const newSigma = Math.exp(A / 2.0);
    player.workingVolatility = newSigma;

    const phiStar = this.calculateNewRD(phi, newSigma, elapsedRatingPeriods);
    const newPhi = 1.0 / Math.sqrt(1.0 / Math.pow(phiStar, 2) + 1.0 / v);
    player.workingRating =
      player.getGlicko2Rating() +
      Math.pow(newPhi, 2) * this.outcomeBasedRating(player, results);
    player.workingRatingDeviation = newPhi;
    player.incrementNumberOfResults(results.length);
  }

  private f(
    x: number,
    delta: number,
    phi: number,
    v: number,
    a: number,
    tau: number
  ): number {
    return (
      (Math.exp(x) *
        (Math.pow(delta, 2) - Math.pow(phi, 2) - v - Math.exp(x))) /
        (2.0 * Math.pow(Math.pow(phi, 2) + v + Math.exp(x), 2)) -
      (x - a) / Math.pow(tau, 2)
    );
  }

  private g(deviation: number): number {
    return (
      1.0 /
      Math.sqrt(1.0 + (3.0 * Math.pow(deviation, 2)) / Math.pow(Math.PI, 2))
    );
  }

  private E(
    playerRating: number,
    opponentRating: number,
    opponentDeviation: number
  ): number {
    return (
      1.0 /
      (1.0 +
        Math.exp(
          -1.0 * this.g(opponentDeviation) * (playerRating - opponentRating)
        ))
    );
  }

  private vOf(player: GlickoRating, results: GameResult[]): number {
    let v = 0.0;
    results.forEach((result) => {
      v +=
        Math.pow(
          this.g(result.getOpponent(player).getGlicko2RatingDeviation()),
          2
        ) *
        this.E(
          player.getGlicko2Rating(),
          result.getOpponent(player).getGlicko2Rating(),
          result.getOpponent(player).getGlicko2RatingDeviation()
        ) *
        (1.0 -
          this.E(
            player.getGlicko2Rating(),
            result.getOpponent(player).getGlicko2Rating(),
            result.getOpponent(player).getGlicko2RatingDeviation()
          ));
    });
    return 1 / v;
  }

  private deltaOf(player: GlickoRating, results: GameResult[]): number {
    return this.vOf(player, results) * this.outcomeBasedRating(player, results);
  }

  private outcomeBasedRating(
    player: GlickoRating,
    results: GameResult[]
  ): number {
    let outcomeBasedRating = 0;
    results.forEach((result) => {
      outcomeBasedRating +=
        this.g(result.getOpponent(player).getGlicko2RatingDeviation()) *
        (result.getScore(player) -
          this.E(
            player.getGlicko2Rating(),
            result.getOpponent(player).getGlicko2Rating(),
            result.getOpponent(player).getGlicko2RatingDeviation()
          ));
    });
    return outcomeBasedRating;
  }

  private calculateNewRD(
    phi: number,
    sigma: number,
    elapsedRatingPeriods: number
  ): number {
    return Math.sqrt(
      Math.pow(phi, 2) + elapsedRatingPeriods * Math.pow(sigma, 2)
    );
  }
}

export default updateAndScaleRatings;
