import 'reflect-metadata';
import { Controller, Get, type Type } from '@nestjs/common';
import { DiscoveryModule } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { AccessMetadataCheck } from './access-metadata.check';
import { Public } from './public.decorator';
import { Roles } from './roles.decorator';

@Controller('health')
@Public()
class PublicController {
  @Get()
  check(): void {}
}

@Controller('admin/me')
@Roles('admin')
class RolesController {
  @Get()
  me(): void {}
}

@Controller('mixed')
@Public()
class MixedController {
  @Get()
  @Roles('support')
  contradictory(): void {}
}

async function boot(...controllers: Type[]): Promise<void> {
  const moduleRef = await Test.createTestingModule({
    imports: [DiscoveryModule],
    controllers,
    providers: [AccessMetadataCheck],
  }).compile();
  await moduleRef.init();
  await moduleRef.close();
}

describe('AccessMetadataCheck', () => {
  it('boots with public routes and role routes kept apart', async () => {
    await expect(boot(PublicController, RolesController)).resolves.toBeUndefined();
  });

  it('fails the boot on a route both @Public() and @Roles(), naming it', async () => {
    await expect(boot(PublicController, MixedController)).rejects.toThrow(
      '@Public() and @Roles() on the same route: MixedController.contradictory',
    );
  });
});
