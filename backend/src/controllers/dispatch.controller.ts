import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { DispatchService } from '../services/dispatch.service';
@Controller('dispatch-orders')
export class DispatchController {
  constructor(private readonly service: DispatchService) {}
  @Get() findAll() { return this.service.findAll(); }
  @Get(':id') findOne(@Param('id') id: string) { return this.service.findOne(Number(id)); }
  @Post() create(@Body() payload: any) { return this.service.create(payload); }
  @Post(':id/reassign') reassign(@Param('id') id: string, @Body() payload: any) { return this.service.reassign(Number(id), payload); }
  @Post(':id/start') start(@Param('id') id: string) { return this.service.start(Number(id)); }
  @Post(':id/complete') complete(@Param('id') id: string) { return this.service.complete(Number(id)); }
  @Post(':id/cancel') cancel(@Param('id') id: string) { return this.service.cancel(Number(id)); }
}
