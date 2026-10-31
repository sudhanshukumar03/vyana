import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {startLiveSync} from './liveSync';

let stop: (() => void) | undefined;
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(0);
  vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');
  vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true);
});
afterEach(() => { stop?.(); stop=undefined; vi.useRealTimers(); });
const actions = () => ({refresh:vi.fn(),reconnect:vi.fn(),streaming:vi.fn(()=>false),tick:vi.fn(),insights:vi.fn()});

describe('automatic live updates', () => {
  it('refreshes every five seconds while the socket is unavailable', () => {
    const a=actions(); stop=startLiveSync(a);
    vi.advanceTimersByTime(15000);
    expect(a.refresh).toHaveBeenCalledTimes(4);
    expect(a.reconnect).toHaveBeenCalledTimes(4);
    expect(a.tick).toHaveBeenCalledTimes(15);
    expect(a.insights).toHaveBeenCalledTimes(1);
  });
  it('uses a slower reconciliation poll with a working socket and recovers after it drops', () => {
    const a=actions(); a.streaming.mockReturnValue(true); stop=startLiveSync(a);
    vi.advanceTimersByTime(29000); expect(a.refresh).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(1000); expect(a.refresh).toHaveBeenCalledTimes(2);
    expect(a.insights).toHaveBeenCalledTimes(2);
    a.streaming.mockReturnValue(false);
    vi.advanceTimersByTime(5000); expect(a.refresh).toHaveBeenCalledTimes(3);
  });
  it('refreshes immediately on network recovery and deduplicates simultaneous focus/visibility events', () => {
    const a=actions(); stop=startLiveSync(a);
    window.dispatchEvent(new Event('online'));
    window.dispatchEvent(new Event('focus'));
    document.dispatchEvent(new Event('visibilitychange'));
    expect(a.refresh).toHaveBeenCalledTimes(2);
    expect(a.reconnect).toHaveBeenCalledTimes(2);
    vi.advanceTimersByTime(1000);
    window.dispatchEvent(new Event('focus'));
    expect(a.refresh).toHaveBeenCalledTimes(3);
  });
  it('pauses background/offline requests, keeps freshness ticking, and catches up when visible', () => {
    const a=actions(); stop=startLiveSync(a);
    const visibility=vi.spyOn(document,'visibilityState','get').mockReturnValue('hidden');
    vi.advanceTimersByTime(60000); expect(a.refresh).toHaveBeenCalledTimes(1);
    expect(a.tick).toHaveBeenCalledTimes(60);
    visibility.mockReturnValue('visible');
    const online=vi.spyOn(navigator,'onLine','get').mockReturnValue(false);
    window.dispatchEvent(new Event('focus'));
    vi.advanceTimersByTime(10000); expect(a.refresh).toHaveBeenCalledTimes(1);
    online.mockReturnValue(true);
    document.dispatchEvent(new Event('visibilitychange'));
    expect(a.refresh).toHaveBeenCalledTimes(2);
  });
  it('removes timers and listeners on unmount', () => {
    const a=actions(); const cleanup=startLiveSync(a); cleanup();
    vi.advanceTimersByTime(60000);
    window.dispatchEvent(new Event('online'));
    window.dispatchEvent(new Event('focus'));
    document.dispatchEvent(new Event('visibilitychange'));
    expect(a.refresh).toHaveBeenCalledTimes(1);
    expect(a.tick).not.toHaveBeenCalled();
  });
});
