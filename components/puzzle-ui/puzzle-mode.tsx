'use client';
import { Puzzle } from '@/types/lichess-api';
import React, { useState, useEffect } from 'react';
import PuzzleBoard from './puzzle-board';
import { PuzzleWithUserRating } from '@/app/api/puzzle/nextPuzzle/nextFor';
import { Rating } from '@/src/rating/getRating';

interface PuzzleModeProps {
  initialPuzzle: Puzzle | undefined;
  initialRating: Rating;
  initialSimilar: Puzzle[] | undefined;
  group: string[];
}

export const PuzzleContext = React.createContext({
  submitNextPuzzle: (_success: boolean, _time: number): Promise<Rating> => {
    throw new Error();
  },
  getNextPuzzle: () => {},
});

const NoPuzzles = (
  <div className='min-h-svh flex flex-col items-center py-12 px-2'>
    <div className='flex flex-col max-w-5xl w-full items-stretch gap-8'>
      <div className='space-y-2'>
        <h1 className='scroll-m-20 text-4xl font-extrabold tracking-tight lg:text-5xl text-center'>
          No Puzzles
        </h1>
        <p className='text-xl text-muted-foreground text-center'>
          <br />
          Wow, we have no puzzles left for you!
          <br />
          We can&apos;t find a puzzle that matches your rating and selected
          theme group.
          <br />
          Head back to the dashboard, and try again later.
        </p>
      </div>
    </div>
  </div>
);

const PuzzleMode: React.FC<PuzzleModeProps> = ({
  initialPuzzle,
  initialRating,
  initialSimilar,
  group,
}) => {
  /** PUZZLE CODE */
  const [puzzle, setPuzzle] = useState<Puzzle | undefined>(initialPuzzle);
  const [rating, setRating] = useState<Rating>(initialRating);
  const [similar, setSimilar] = useState<Puzzle[] | undefined>(initialSimilar);
  const [loading, setLoading] = useState(false);

  // TODO: Handle when no more puzzles!
  useEffect(() => {
    if (puzzle) {
      fetch(`/api/puzzle/computeBatch`, {
        method: 'POST',
        body: JSON.stringify({ puzzleId: puzzle.PuzzleId }),
      }).then(() => console.log('Computed similarity cachee of last puzzle'));
    }
  }, [puzzle]);

  // submit the puzzle success/failure to the server
  const submitNextPuzzle = (success: boolean, time: number): Promise<Rating> =>
    fetch(`/api/puzzle/submit`, {
      method: 'POST',
      body: JSON.stringify({
        successStr: success,
        themeGroupStr: group,
        timeStr: time,
      }),
    })
      .then((response) => response.text())
      .then((s) => JSON.parse(s) as Rating);

  // get the next puzzle
  const getNextPuzzle = () => {
    setLoading(true);
    fetch(`/api/puzzle/nextPuzzle`, {
      method: 'POST',
      body: JSON.stringify({ themeGroupStr: group }),
    })
      .then((response) => response.text())
      .then((s) => JSON.parse(s) as PuzzleWithUserRating)
      .then((response) => {
        setPuzzle(response.puzzle);
        setRating(response.rating);
        setSimilar(response.similar);
      })
      .finally(() => setLoading(false));
  };

  return puzzle ? (
    <PuzzleContext.Provider value={{ submitNextPuzzle, getNextPuzzle }}>
      <PuzzleBoard
        puzzle={puzzle}
        initialRating={rating}
        loading={loading}
        similar={similar}
      />
    </PuzzleContext.Provider>
  ) : (
    NoPuzzles
  );
};

export default PuzzleMode;
