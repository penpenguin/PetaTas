import { TimerState } from '../types/types.js';

export function parseTimeInput(input: string): number | null {
  if (!input.trim()) return 0;
  
  const timeStr = input.trim();
  const parts = timeStr.split(':').map(part => part.trim());
  
  if (parts.length === 2) {
    // M:SS format
    const minutes = parseInt(parts[0] || '0', 10);
    const seconds = parseInt(parts[1] || '0', 10);
    
    if (isNaN(minutes) || isNaN(seconds) || minutes < 0 || seconds < 0 || seconds >= 60) {
      return null;
    }
    
    return (minutes * 60 + seconds) * 1000;
  } else if (parts.length === 3) {
    // H:MM:SS format
    const hours = parseInt(parts[0] || '0', 10);
    const minutes = parseInt(parts[1] || '0', 10);
    const seconds = parseInt(parts[2] || '0', 10);
    
    if (isNaN(hours) || isNaN(minutes) || isNaN(seconds) || 
        hours < 0 || minutes < 0 || seconds < 0 || 
        minutes >= 60 || seconds >= 60) {
      return null;
    }
    
    return (hours * 3600 + minutes * 60 + seconds) * 1000;
  }
  
  return null;
}

export function createTimerState(elapsedMs: number = 0): TimerState {
  return {
    isRunning: false,
    startTime: 0,
    previousElapsed: elapsedMs
  };
}

export function startTimer(state: TimerState, elapsedMs: number): TimerState {
  if (state.isRunning) return state;

  return {
    isRunning: true,
    startTime: Date.now(),
    previousElapsed: elapsedMs
  };
}

export function stopTimer(state: TimerState): { state: TimerState, elapsedMs: number } {
  if (!state.isRunning) return { state, elapsedMs: state.previousElapsed };

  const newElapsed = state.previousElapsed + (Date.now() - state.startTime);
  
  const newState: TimerState = {
    isRunning: false,
    startTime: 0,
    previousElapsed: newElapsed
  };

  return { state: newState, elapsedMs: newElapsed };
}

export function resetTimer(): TimerState {
  return {
    isRunning: false,
    startTime: 0,
    previousElapsed: 0
  };
}

export function getCurrentElapsed(state: TimerState): number {
  return state.isRunning
    ? state.previousElapsed + (Date.now() - state.startTime)
    : state.previousElapsed;
}