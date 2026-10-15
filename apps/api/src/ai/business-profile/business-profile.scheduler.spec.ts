import { BusinessProfileScheduler } from './business-profile.scheduler';

describe('BusinessProfileScheduler', () => {
  it('does not schedule anything when the interval is 0', () => {
    const setIntervalSpy = jest.spyOn(global, 'setInterval');
    new BusinessProfileScheduler({ refreshAll: jest.fn() } as any, { AI_PROFILE_REFRESH_MINUTES: 0 }).onApplicationBootstrap();
    expect(setIntervalSpy).not.toHaveBeenCalled();
    setIntervalSpy.mockRestore();
  });

  it('skips a tick while the previous refresh is still running', async () => {
    let release!: () => void;
    const refreshAll = jest.fn(() => new Promise<{ refreshed: number; failed: number }>((r) => (release = () => r({ refreshed: 1, failed: 0 }))));
    const scheduler = new BusinessProfileScheduler({ refreshAll } as any, { AI_PROFILE_REFRESH_MINUTES: 5 });
    const first = scheduler.tick();
    await scheduler.tick();
    expect(refreshAll).toHaveBeenCalledTimes(1);
    release();
    await first;
    const third = scheduler.tick();
    expect(refreshAll).toHaveBeenCalledTimes(2);
    release();
    await third;
  });
});
