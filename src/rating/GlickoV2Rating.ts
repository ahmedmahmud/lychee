import { DEFAULT_RATING } from './getRating';

const MULTIPLIER: number = 173.7178;

const convertRatingToOriginalGlickoScale = (r: number): number =>
  r * MULTIPLIER + DEFAULT_RATING.rating;

const convertRatingToGlicko2Scale = (r: number): number =>
  (r - DEFAULT_RATING.rating) / MULTIPLIER;

const convertRatingDeviationToOriginalGlickoScale = (r: number): number =>
  r * MULTIPLIER;

const convertRatingDeviationToGlicko2Scale = (r: number): number =>
  r / MULTIPLIER;

export default class GlickoRating {
  constructor(
    public rating: number,
    public ratingDeviation: number,
    public volatility: number,
    public numberOfResults: number
  ) {}

  workingRating: number = 0;
  workingRatingDeviation: number = 0;
  workingVolatility: number = 0;

  getGlicko2Rating(): number {
    return convertRatingToGlicko2Scale(this.rating);
  }

  setGlicko2Rating(r: number): void {
    this.rating = convertRatingToOriginalGlickoScale(r);
  }

  getGlicko2RatingDeviation(): number {
    return convertRatingDeviationToGlicko2Scale(this.ratingDeviation);
  }

  setGlicko2RatingDeviation(rd: number): void {
    this.ratingDeviation = convertRatingDeviationToOriginalGlickoScale(rd);
  }

  finaliseRating(): void {
    this.setGlicko2Rating(this.workingRating);
    this.setGlicko2RatingDeviation(this.workingRatingDeviation);
    this.volatility = this.workingVolatility;
    this.workingRatingDeviation = 0;
    this.workingRating = 0;
    this.workingVolatility = 0;
  }

  incrementNumberOfResults(increment: number): void {
    this.numberOfResults += increment;
  }
}
