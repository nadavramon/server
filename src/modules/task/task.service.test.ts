import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('./task.schema.ts', () => ({
  TaskModel: {
    find: vi.fn(),
    create: vi.fn(),
    findOneAndUpdate: vi.fn(),
    findOneAndDelete: vi.fn(),
  },
}));

vi.mock('./task.cache.ts', () => ({
  read: vi.fn(),
  write: vi.fn(),
  invalidate: vi.fn(),
}));

import { TaskModel } from './task.schema.ts';
import * as taskCache from './task.cache.ts';
import { getAllTasks, getTasksByStatus } from './task.service.ts';

const userId = 'user-1';
const docA = {
  _id: { toString: () => 't1' },
  userId: { toString: () => userId },
  title: 'A',
  isCompleted: false,
};
const entityA = { id: 't1', userId, title: 'A', isCompleted: false };
const entityDone = { id: 't2', userId, title: 'B', isCompleted: true };

beforeEach(() => vi.clearAllMocks());

describe('getAllTasks cache-aside', () => {
  it('returns cached tasks without hitting Mongo on hit', async () => {
    vi.mocked(taskCache.read).mockResolvedValue([entityA]);
    const result = await getAllTasks(userId);
    expect(result).toEqual([entityA]);
    expect(TaskModel.find).not.toHaveBeenCalled();
    expect(taskCache.write).not.toHaveBeenCalled();
  });

  it('queries Mongo and writes cache on miss', async () => {
    vi.mocked(taskCache.read).mockResolvedValue(null);
    vi.mocked(TaskModel.find).mockReturnValue({
      lean: () => Promise.resolve([docA]),
    } as never);
    const result = await getAllTasks(userId);
    expect(result).toEqual([entityA]);
    expect(TaskModel.find).toHaveBeenCalledWith({ userId });
    expect(taskCache.write).toHaveBeenCalledWith(userId, [entityA]);
  });
});

describe('getTasksByStatus derives from the cached list', () => {
  it('filters the cached list in memory without a status query', async () => {
    vi.mocked(taskCache.read).mockResolvedValue([entityA, entityDone]);
    const result = await getTasksByStatus(userId, true);
    expect(result).toEqual([entityDone]);
    expect(TaskModel.find).not.toHaveBeenCalled();
  });
});