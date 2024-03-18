import { Puzzle } from '@/types/lichess-api';
import { Popover, PopoverContent, PopoverTrigger } from '../../ui/popover';
import React from 'react';
import StaticBoard from '../static-board';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { capitalize } from '@/lib/utils';

const hintMode = (similar: Puzzle[] | undefined, themes: string[]) => {
  return (
    <div className='space-y-2'>
      {similar && similar.length > 0 && (
        <div className='flex justify-between items-center'>
          <p className='text-sm'>View similar puzzle</p>
          <Popover>
            <PopoverTrigger asChild>
              <Button size='sm'>Show</Button>
            </PopoverTrigger>
            <PopoverContent className={`p-2 ${!similar ? 'w-fit' : ''}`}>
              {similar && similar.length > 0 ? (
                similar.map((p) => <StaticBoard key={p.PuzzleId} puzzle={p} />)
              ) : (
                <p className='text-center'>Non review puzzle</p>
              )}
            </PopoverContent>
          </Popover>
        </div>
      )}
      <div className='flex justify-between items-center'>
        <p className='text-sm'>View themes</p>
        <Popover>
          <PopoverTrigger asChild>
            <Button size='sm'>Show</Button>
          </PopoverTrigger>
          <PopoverContent className={`p-2 max-w-72 w-fit`}>
            <div className='flex gap-1 flex-wrap justify-center'>
              {themes.map((t) => (
                <Badge key={t} variant={'outline'}>
                  {capitalize(t).toLowerCase()}
                </Badge>
              ))}
            </div>
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
};

const noHintMode = () => (
  <p className='text-sm'>
    <i>No hints available</i>
  </p>
);

const solvedMode = (puzzle: Puzzle) => {
  return (
    <div className='flex items-center gap-4 justify-between'>
      <div className='flex grow gap-1 flex-wrap justify-center'>
        {puzzle.Themes.split(' ').map((t) => (
          <Badge key={t} variant={'secondary'}>
            {capitalize(t).toLowerCase()}
          </Badge>
        ))}
      </div>
    </div>
  );
};

const PuzzleHintBox = ({
  similar,
  puzzle,
  solved,
}: {
  similar?: Puzzle[];
  puzzle: Puzzle;
  solved: boolean;
}) => {
  const mode = () => {
    if (solved) {
      return solvedMode(puzzle);
    }
    return hintMode(similar, puzzle.Themes.split(' '));
  };

  const openAnalysisBoard = () => {
    // window.open(
    //   `https://lichess.org/analysis/${puzzle.FEN}`,
    //   '_blank'
    // )
    window.open(`https://lichess.org/training/${puzzle.PuzzleId}`, '_blank');
  };

  return (
    <>
      <div className='bg-controller rounded-lg p-2 pl-4'>{mode()}</div>
      {solved && (
        <Button
          size='sm'
          variant={'secondary'}
          className='w-full'
          onClick={openAnalysisBoard}
        >
          Analyse in Lichess
        </Button>
      )}
    </>
  );
};

export default PuzzleHintBox;
