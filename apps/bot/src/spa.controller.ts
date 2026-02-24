import { Controller, Get, Res } from '@nestjs/common';
import { Response } from 'express';
import { join } from 'path';

@Controller()
export class SpaController {
  @Get('*path')
  serveSpa(@Res() res: Response) {
    const indexPath = join(__dirname, '..', 'public', 'index.html');
    res.sendFile(indexPath, (err) => {
      if (err) {
        res.status(404).json({ message: 'Not found' });
      }
    });
  }
}
