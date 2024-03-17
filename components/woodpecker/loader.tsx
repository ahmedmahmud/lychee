'use client';

import { Puzzle } from '@/types/lichess-api';
import { CSSProperties, useState } from 'react';
import WoodPeckerMode from './woodpecker-mode';
import WoodLoadingBoard from './loading';
import './loader.css';
import { cn } from '@/lib/utils';
import { Rating } from '@/src/rating/getRating';

interface Props {
  rating: Rating;
}

const colWrapperStyle = {
  flex: 'align-center',
  justifyContent: 'center',
  margin: '3rem auto',
};

const randomShuffle = (arr: any[]) => {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
};

const WoodpeckerLoader: React.FC<Props> = ({ rating }) => {
  const [puzzles, setPuzzles] = useState<Puzzle[]>([]);

  const newBatch = async () => {
    // This will find puzzles, persisting them in AllRound and in LastBatch.
    // TODO: which of these do we want to do on (1) now, (2) mode completion, (3) puzzle completion?
    // (Should just be the callback to WoodPeckerMode for (2), and submitNextPuzzle within the mode for (3))
    await fetch(`/api/puzzle/nextBatch`, {
      method: 'GET',
    })
      .then((response) => response.text())
      .then((s) => JSON.parse(s) as Puzzle[])
      .then((response) => {
        setPuzzles(response);
      });
  };

  const sameReview = async () => {
    // We need not persist anything since the batch is the same as before!
    await fetch(`/api/puzzle/lastBatch`, {
      method: 'GET',
    })
      .then((response) => response.text())
      .then((s) => JSON.parse(s) as Puzzle[])
      .then((response) => {
        console.log(`response: ${response}`);
        if (response.length === 0) {
          console.log('No puzzles to review.');
          return;
        }
        randomShuffle(response);
        setPuzzles(response);
      });
  };

  const similarReview = async () => {
    // This will find similar puzzles, persisting them in AllRound and in LastBatch.
    await fetch(`/api/puzzle/similarBatch`, {
      method: 'GET',
    })
      .then((response) => response.text())
      .then((s) => JSON.parse(s) as Puzzle[])
      .then((response) => {
        console.log(`response: ${response}`);
        if (response.length === 0) {
          console.log('No puzzles to review.');
          return;
        }
        // TODO: uncomment! Just for debugging.
        // randomShuffle(response);
        setPuzzles(response);
      });
  };

  return puzzles.length === 0 ? (
    <div style={colWrapperStyle as CSSProperties}>
      <WoodLoadingBoard />
      <div className={cn('flex', 'justify-center')}>
        <button
          className='buttonstylec bg-controller-dark hover:bg-controller-light'
          onClick={newBatch}
        >
          New Batch
        </button>
        <button
          className='buttonstylec bg-controller-dark hover:bg-controller-light'
          onClick={similarReview}
        >
          Similar Review
        </button>
        <button
          className='buttonstylec bg-controller-dark hover:bg-controller-light'
          onClick={sameReview}
        >
          Identical Review
        </button>
      </div>
    </div>
  ) : (
    <WoodPeckerMode
      initialPuzzles={puzzles}
      initialRating={rating}
      callback={() => setPuzzles([])}
    />
  );
};

export default WoodpeckerLoader;
