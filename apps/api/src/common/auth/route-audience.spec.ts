import 'reflect-metadata';
import { Controller, Get } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { audienceOfPath, routePath } from './route-audience';

@Controller('/Admin/')
class AdminController {
  @Get('/me/')
  me(): void {}
}

describe('audienceOfPath', () => {
  it.each([
    ['admin/me', 'admin'],
    ['Admin/me', 'admin'],
    ['ADMIN', 'admin'],
    ['dives/:id', 'web'],
    ['administrators', 'web'],
    ['me/admin', 'web'],
    ['', 'web'],
  ])('%p → %s', (path, audience) => {
    expect(audienceOfPath(path)).toBe(audience);
  });
});

describe('routePath', () => {
  it('joins the controller and handler paths without empty segments', () => {
    const handler: unknown = Reflect.get(AdminController.prototype, 'me');
    if (typeof handler !== 'function') {
      throw new Error('No handler');
    }

    expect(routePath(new Reflector(), AdminController, handler)).toBe('Admin/me');
  });
});
