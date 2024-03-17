import { RatingCalculator } from '../../src/rating/RatingCalculator';
import GameResult from '../../src/rating/GameResult';
import GlickoRating from '../../src/rating/GlickoV2Rating';

const INT_EPSILON = -0.5;

const ratingCalculator: RatingCalculator = new RatingCalculator();

const glicko = (
  rating: number,
  deviation: number,
  volatility: number
): GlickoRating => new GlickoRating(rating, deviation, volatility, 0);

describe('Testing Glicko rating calculation', () => {
  test('Two default deviations, same rating', () => {
    const r1: GlickoRating = glicko(1500.0, 500.0, 0.09);
    const r2: GlickoRating = glicko(1500.0, 500.0, 0.09);

    ratingCalculator.updateRatings(new GameResult(r1, r2));

    expect(r1.rating).toBeCloseTo(1741, INT_EPSILON);
    expect(r2.rating).toBeCloseTo(1258, INT_EPSILON);

    expect(r1.ratingDeviation).toBeCloseTo(396, INT_EPSILON);
    expect(r2.ratingDeviation).toBeCloseTo(396, INT_EPSILON);

    expect(r1.volatility).toBeCloseTo(0.0899983, 4);
    expect(r2.volatility).toBeCloseTo(0.0899983, 4);

    expect(r1.numberOfResults).toBe(1);
    expect(r2.numberOfResults).toBe(1);
  });

  test('Two low deviations, same ratings', () => {
    const r1: GlickoRating = glicko(1500.0, 80, 0.06);
    const r2: GlickoRating = glicko(1500.0, 80, 0.06);

    ratingCalculator.updateRatings(new GameResult(r1, r2));

    expect(r1.rating).toBeCloseTo(1517, INT_EPSILON);
    expect(r2.rating).toBeCloseTo(1482, INT_EPSILON);

    expect(r1.ratingDeviation).toBeCloseTo(78, INT_EPSILON);
    expect(r2.ratingDeviation).toBeCloseTo(78, INT_EPSILON);

    expect(r1.volatility).toBeCloseTo(0.06, 3);
    expect(r2.volatility).toBeCloseTo(0.06, 3);

    expect(r1.numberOfResults).toBe(1);
    expect(r2.numberOfResults).toBe(1);
  });

  test('Slightly different ratings and deviations', () => {
    const r1: GlickoRating = glicko(1400, 79, 0.06);
    const r2: GlickoRating = glicko(1550, 110, 0.065);

    ratingCalculator.updateRatings(new GameResult(r1, r2));

    expect(r1.rating).toBeCloseTo(1422, INT_EPSILON);
    expect(r2.rating).toBeCloseTo(1506, INT_EPSILON);

    expect(r1.ratingDeviation).toBeCloseTo(77, INT_EPSILON);
    expect(r2.ratingDeviation).toBeCloseTo(105, INT_EPSILON);

    expect(r1.volatility).toBeCloseTo(0.06, 3);
    expect(r2.volatility).toBeCloseTo(0.065, 3);

    expect(r1.numberOfResults).toBe(1);
    expect(r2.numberOfResults).toBe(1);
  });

  // TODO(sm3421): Work out why this test is worse than others, then reduce epsilon.
  test('Greatly different ratings and deviations - lower wins', () => {
    const r1: GlickoRating = glicko(1200, 60, 0.053);
    const r2: GlickoRating = glicko(1850, 200, 0.062);

    ratingCalculator.updateRatings(new GameResult(r1, r2));

    expect(r1.rating).toBeCloseTo(1216.7, INT_EPSILON);
    expect(r2.rating).toBeCloseTo(1636, INT_EPSILON);

    expect(r1.ratingDeviation).toBeCloseTo(59.9, INT_EPSILON);
    expect(r2.ratingDeviation).toBeCloseTo(196.9, INT_EPSILON);

    expect(r1.volatility).toBeCloseTo(0.053013, 5);
    expect(r2.volatility).toBeCloseTo(0.062028, 5);
  });

  test('Greatly different ratings and deviations - higher wins', () => {
    const r1: GlickoRating = glicko(1200, 60, 0.053);
    const r2: GlickoRating = glicko(1850, 200, 0.062);

    ratingCalculator.updateRatings(new GameResult(r2, r1));

    expect(r1.rating).toBeCloseTo(1199.3, INT_EPSILON);
    expect(r2.rating).toBeCloseTo(1855.4, INT_EPSILON);

    expect(r1.ratingDeviation).toBeCloseTo(59.9, INT_EPSILON);
    expect(r2.ratingDeviation).toBeCloseTo(196.9, INT_EPSILON);

    expect(r1.volatility).toBeCloseTo(0.052999, 5);
    expect(r2.volatility).toBeCloseTo(0.061999, 5);
  });
});
