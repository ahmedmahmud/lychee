import GlickoRating from './GlickoV2Rating';

export default class GameResult {
  constructor(
    public winner: GlickoRating,
    public loser: GlickoRating
  ) {}

  players(): GlickoRating[] {
    return [this.winner, this.loser];
  }

  participated(player: GlickoRating): boolean {
    return player === this.winner || player === this.loser;
  }

  getScore(player: GlickoRating): number {
    return this.winner === player ? 1.0 : 0.0;
  }

  getOpponent(player: GlickoRating): GlickoRating {
    return this.winner === player ? this.loser : this.winner;
  }
}
