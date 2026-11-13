import 'reflect-metadata';
import { UnauthorizedException, type ExecutionContext } from '@nestjs/common';
import type { DataSource } from 'typeorm';
import type { AppConfigService } from '../../config/app-config.service';
import { Diver } from '../../modules/divers/diver.entity';
import { CurrentDiverGuard } from './current-diver.guard';

const DIVER_ID = '01900000-0000-7000-8000-000000000001';

const find = jest.fn<Promise<Pick<Diver, 'id'>[]>, [unknown, unknown]>();
const dataSource = { manager: { find } } as unknown as DataSource;

function config(stub: boolean): AppConfigService {
  return { get: () => stub } as unknown as AppConfigService;
}

describe('CurrentDiverGuard', () => {
  const request: { currentDiverId?: string } = {};
  const setHeader = jest.fn<void, [string, string]>();
  const context = {
    switchToHttp: () => ({ getRequest: () => request, getResponse: () => ({ setHeader }) }),
  } as unknown as ExecutionContext;

  beforeEach(() => {
    find.mockReset();
    setHeader.mockReset();
    delete request.currentDiverId;
  });

  it('refuses every request with a 401 when the stub is disabled, without querying', async () => {
    await expect(
      new CurrentDiverGuard(config(false), dataSource).canActivate(context),
    ).rejects.toThrow(UnauthorizedException);
    expect(find).not.toHaveBeenCalled();
    expect(request.currentDiverId).toBeUndefined();
    // Even refused, the response must not be cached (GDPR art. 9).
    expect(setHeader).toHaveBeenCalledWith('Cache-Control', 'no-store');
  });

  it('acts for the first diver created when the stub is enabled', async () => {
    find.mockResolvedValue([{ id: DIVER_ID }]);

    await expect(
      new CurrentDiverGuard(config(true), dataSource).canActivate(context),
    ).resolves.toBe(true);
    expect(request.currentDiverId).toBe(DIVER_ID);
    expect(setHeader).toHaveBeenCalledWith('Cache-Control', 'no-store');
    expect(find).toHaveBeenCalledWith(Diver, {
      select: { id: true },
      order: { createdAt: 'ASC', id: 'ASC' },
      take: 1,
    });
  });

  it('refuses with a 401 when there is no diver', async () => {
    find.mockResolvedValue([]);

    await expect(
      new CurrentDiverGuard(config(true), dataSource).canActivate(context),
    ).rejects.toThrow(UnauthorizedException);
    expect(request.currentDiverId).toBeUndefined();
  });
});
