import { ExceptionFilter, Catch, ArgumentsHost, NotFoundException } from '@nestjs/common';
import { Request, Response } from 'express';
import { join } from 'path';

/**
 * Catches NotFoundException for non-API routes and serves index.html so
 * React Router can handle client-side navigation. API 404s are passed through
 * as normal JSON error responses.
 *
 * __dirname here is  .../apps/bot/dist/apps/bot/src/  (due to TypeScript
 * rootDir expansion from the shared-types alias). Four levels up lands at
 * .../apps/bot/ which is where the public/ folder lives.
 */
@Catch(NotFoundException)
export class SpaExceptionFilter implements ExceptionFilter {
  private readonly indexPath = join(__dirname, '..', '..', '..', '..', 'public', 'index.html');

  catch(exception: NotFoundException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const req = ctx.getRequest<Request>();
    const res = ctx.getResponse<Response>();

    if (req.path.startsWith('/api/')) {
      res.status(404).json(exception.getResponse());
      return;
    }

    res.sendFile(this.indexPath, (err) => {
      if (err) res.status(500).json({ message: 'Internal error' });
    });
  }
}
