'use client';

import { Chess, Move, Square } from 'chess.js';
import { useContext, useEffect, useMemo, useState } from 'react';
import { PuzzleContext } from './puzzle-mode';
import LoadingBoard from './loading-board';
import React from 'react';
import ChessboardWrapped from './chessboard-wrapped';
import ControlButtonBar, {
  PlaybackControllerContext,
} from './controls/control-bar-button';
import MoveViewer, { MoveNavigationContext } from './controls/move-viewer';
import { Puzzle } from '@/types/lichess-api';
import './puzzle-board-ui.css';
import RatingComponent from './controls/rating';
import DisplayBox from './controls/display-box';
import useTimer from '@/hooks/useTimer';
import { Rating } from '@/src/rating/getRating';
import { Button } from '../ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import StaticBoard from './static-board';
import PuzzleHintBox from './controls/puzzle-hint';

interface PuzzleBoardProps {
  puzzle?: Puzzle;
  initialRating: Rating;
  loading: boolean;
  similar?: Puzzle[];
}
// set its props to be the puzzle object
const PuzzleBoard: React.FC<PuzzleBoardProps> = ({
  puzzle,
  initialRating,
  loading,
  similar,
}) => {
  const { submitNextPuzzle: submitPuzzle, getNextPuzzle } =
    useContext(PuzzleContext);
  const line = puzzle?.Moves.split(' ') ?? [];
  const side = puzzle?.FEN.split(' ')[1] === 'w' ? 'b' : 'w';

  // game state
  const game = useMemo(() => new Chess(puzzle?.FEN), [puzzle]);
  const [fen, setFen] = useState(game.fen());
  const [linePos, setLinePos] = useState(0);

  // mode related state
  const [rendered, setRendered] = useState(false);
  const [solved, setSolved] = useState<boolean>(false);
  const [playbackPos, setPlaybackPos] = useState(0);
  const [wrong, setWrong] = useState<boolean>(false);
  const [lastMoveWrong, setLastMoveWrong] = useState<boolean>(false);
  const [gaveUp, setGaveUp] = useState<boolean>(false);

  // extra playback state
  const [fens, setFens] = useState([game.fen()]);

  // user's rating
  const [rating, setRating] = useState<Rating>(initialRating);

  // timer/stopwatch
  const [time, startTimer, stopTimer] = useTimer();

  // calculated modes
  const playbackMode = playbackPos !== linePos || solved;
  const inPlay = rendered && !playbackMode && !solved;
  const interactive = inPlay && linePos % 2 === 1;

  /** OVERALL RESET */
  const loadPuzzle = () => {
    if (puzzle) game.load(puzzle.FEN);
    setSolved(false);
    if (puzzle) setFens([puzzle.FEN]);
    if (puzzle) setFen(puzzle.FEN);
    startTimer();
    setPlaybackPos(0);
    setLinePos(0);
    setWrong(false);
    setLastMoveWrong(false);
    setGaveUp(false);
  };

  useEffect(() => {
    loadPuzzle();
  }, [puzzle]);

  // memoized functions for playback
  // playback
  const firstMove = useMemo(() => () => setPlaybackPos(0), [setPlaybackPos]);
  const lastMove = useMemo(
    () => () => setPlaybackPos(linePos),
    [setPlaybackPos, linePos]
  );
  const nextMove = useMemo(
    () => () => setPlaybackPos((pos) => Math.min(linePos, pos + 1)),
    [setPlaybackPos, linePos, playbackPos]
  );
  const prevMove = useMemo(
    () => () => setPlaybackPos((pos) => Math.max(0, pos - 1)),
    [setPlaybackPos, playbackPos]
  );

  /** PLAYBACK MODE */
  useEffect(() => {
    if (playbackMode) setFen(fens[playbackPos]);
    else setFen(game.fen());
  }, [playbackMode, playbackPos, fens, linePos]);

  // MOVEMENT
  // try the bot's first move after rendering
  useEffect(() => {
    if (rendered && linePos === 0) {
      const timeout = setTimeout(botMove, 400);
      return () => clearTimeout(timeout);
    }
  }, [linePos, rendered]);

  // bot move
  function botMove() {
    if (inPlay && linePos < line.length) {
      game.move(line[linePos]);
      setFen(game.fen());
      setLastMoveWrong(false);
      setFens((prev) => [...prev, game.fen()]);
      setLinePos((prev) => prev + 1);
      setPlaybackPos((prev) => prev + 1);
    }
  }

  const playerMoveCallback = (from: Square, to: Square, promotion?: string) => {
    game.move({ from: from, to: to, promotion: promotion });
    console.log(game.fen());
    setFen(game.fen());
    setFens((prev) => [...prev, game.fen()]);
    setLinePos((prev) => prev + 1);
    setPlaybackPos((prev) => prev + 1);
  };

  /** HANDLE PLAYER MOVE VERIFICATION */
  function undoWrongMove() {
    if (submitPuzzle && !wrong) {
      submitPuzzle(false, rating, 0).then((r) => setRating(r));
      setWrong(true);
    }
    game.undo();
    setFen(game.fen());
    setLastMoveWrong(true);
    setFens((prev) => prev.slice(0, -1));
    setLinePos((prev) => prev - 1);
    setPlaybackPos((prev) => prev - 1);
  }

  // player moved correctly
  function correctMove() {
    const timeout = setTimeout(botMove, 300); // start up the bot's move
    return () => clearTimeout(timeout);
  }

  // player finished puzzle
  function finishedGame() {
    stopTimer();
    if (submitPuzzle && !wrong) {
      const elapsed = time;
      submitPuzzle(true, rating, elapsed).then((r) => setRating(r));
    }
    setSolved(true);
  }

  useEffect(() => {
    if (inPlay && !interactive && linePos > 0) {
      if (
        !game.isCheckmate() &&
        game.history({ verbose: true }).pop()?.lan !== line[linePos - 1]
      )
        setTimeout(undoWrongMove, 300);
      else if (linePos >= line.length) finishedGame();
      else return correctMove(); // there's a timeout here so we should return it
      return;
    }
  }, [linePos]);

  if (!puzzle) return <LoadingBoard />;

  /** VIEW SOLUTION / GIVE UP */
  const viewSolution = () => {
    if (rendered && !solved) {
      if (!wrong) {
        submitPuzzle(false, rating, 0).then((r) => setRating(r));
      }
      stopTimer();
      setWrong(true);
      const elapsed = time;
      setSolved(true);
      setGaveUp(true);

      // set the line position to the end maintaining the playback position
      setLinePos(line.length);

      // update the game
      let newFens: Array<string> = [];
      line.slice(playbackPos).forEach((move) => {
        game.move(move);
        newFens.push(game.fen());
      });
      setFens([...fens, ...newFens]);

      // move the game forward by 1
      setPlaybackPos((prev) => prev + 1);
    }
  };

  /** PUZZLE LOGIC **/
  // RENDERED CALLBACK
  const renderedCallback = () => {
    if (!rendered) setRendered(true);
    return {};
  };

  // last move for highlighting
  const lastMoveToHighlight: Move | undefined = game
    .history({ verbose: true })
    .find((_, i) => i === playbackPos - 1);

  return (
    <div className='flex flex-col items-center py-4 md:py-12'>
      <div className='flex flex-col w-full gap-1 md:gap-4 px-4 max-w-md md:flex-row md:max-w-5xl md:justify-center'>
        <div className='flex-1 md:max-w-xl'>
          <ChessboardWrapped
            side={side}
            fen={fen}
            lastMove={lastMoveToHighlight}
            interactive={interactive}
            updateGame={interactive ? playerMoveCallback : () => {}}
            renderedCallback={
              rendered
                ? () => {
                    return;
                  }
                : renderedCallback
            }
          />
        </div>
        <div className='flex-none shrink-0 md:w-80 space-y-1 md:space-y-4'>
          <div className='bg-muted text-center p-2 rounded-md font-mono tracking-widest'>
            {new Date(time).toISOString().substring(14, 19)}
          </div>
          <RatingComponent rating={rating.rating} />
          <div className='move-viewer-container rounded-lg overflow-hidden'>
            <div className='font-sans fromGameHeader bg-controller hover:bg-controller-light'>
              <div className='grid grid-cols-2 gap-6'>
                <p className='text-right font-sans'>
                  Puzzle #{puzzle.PuzzleId}
                </p>
                {solved ? (
                  <span className='text-primary/60 text-left font-sans'>
                    Rating{' '}
                    <span className='font-sans font-bold'>{puzzle.Rating}</span>
                  </span>
                ) : (
                  <span className='text-primary/40 text-left font-sans'>
                    Rating hidden
                  </span>
                )}
              </div>
            </div>
            <MoveNavigationContext.Provider
              value={{ currentIndex: playbackPos, moves: game.history(), side }}
            >
              <MoveViewer />
            </MoveNavigationContext.Provider>
            <PlaybackControllerContext.Provider
              value={{ firstMove, prevMove, nextMove, lastMove }}
            >
              <ControlButtonBar />
            </PlaybackControllerContext.Provider>
          </div>
          <div className='flex items-center bg-controller rounded-lg p-4'>
            <DisplayBox
              loading={loading}
              gaveUp={gaveUp}
              lastMoveWrong={lastMoveWrong}
              solved={solved}
              linePos={linePos}
              side={side}
              viewSolution={viewSolution}
            />
          </div>
          <PuzzleHintBox similar={similar} puzzle={puzzle} solved={solved} />
        </div>
      </div>
    </div>
  );
};

export default React.memo(PuzzleBoard);
