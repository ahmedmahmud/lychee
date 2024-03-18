import mongoose, { Schema } from 'mongoose';

const activePuzzleSchema = new Schema({
  username: { type: String, required: true },
  puzzle: { type: String, required: true },
  reviewee: String, // Original puzzle, if it's a similar one.
  groupID: { type: String, required: true },
});

// Index on username for fast lookups.
activePuzzleSchema.index({ username: 1 }, { unique: true });

export const ActivePuzzleColl =
  mongoose.models.ActivePuzzle ||
  mongoose.model('ActivePuzzle', activePuzzleSchema);
