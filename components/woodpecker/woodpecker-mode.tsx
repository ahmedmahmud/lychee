'use client';

import { Puzzle } from '@/types/lichess-api';
import React, { CSSProperties, useState } from 'react';
import PuzzleBoard from '../puzzle-ui/puzzle-board';
import { PuzzleContext } from '../puzzle-ui/puzzle-mode';
import { Rating } from '@/src/rating/getRating';

interface WoodpeckerModeProps {
  initialPuzzles: Puzzle[];
  initialRating: Rating;
  callback: () => void;
}

const WoodPeckerMode: React.FC<WoodpeckerModeProps> = ({
  initialPuzzles,
  initialRating,
  callback,
}) => {
  const [puzzle, setPuzzle] = useState<Puzzle | undefined>(initialPuzzles[0]);
  const [puzzles, setPuzzles] = useState<Puzzle[]>(initialPuzzles);

  const submitNextPuzzle = (
    _success: boolean,
    _time: number
  ): Promise<Rating> => Promise.resolve(initialRating);

  const getNextPuzzle = () => {
    if (puzzles.length === 1) {
      callback();
      return;
    }
    setPuzzle(puzzles[1]);
    setPuzzles(puzzles.slice(1));
  };

  return (
    <PuzzleContext.Provider value={{ submitNextPuzzle, getNextPuzzle }}>
      <PuzzleBoard
        puzzle={puzzle}
        initialRating={initialRating}
        loading={false}
      />
    </PuzzleContext.Provider>
  );
};

export default WoodPeckerMode;
