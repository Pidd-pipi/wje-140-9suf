import { Body, Controller, Get, NotFoundException, Param, Patch, Post } from '@nestjs/common';
import { DispatchService } from '../services/dispatch.service';

@Controller('dispatch-orders')
export class DispatchController {
  constructor(private readonly service: DispatchService) {}
  @Get() findAll() { return this.service.findAll(); }
  @Get(':id') findOne(@Param('id') id: string) {
    const row = this.service.findOne(Number(id));
    if (!row) throw new NotFoundException(`调度单 ${id} 不存在`);
    return row;
  }
  @Post() create(@Body() payload: any) { return this.service.create(payload); }
  @Patch(':id/reassign') reassign(@Param('id') id: string, @Body() payload: any) { return this.service.reassign(Number(id), payload); }
  @Patch(':id/start') start(@Param('id') id: string) { return this.service.start(Number(id)); }
  @Patch(':id/complete') complete(@Param('id') id: string) { return this.service.complete(Number(id)); }
  @Patch(':id/cancel') cancel(@Param('id') id: string) { return this.service.cancel(Number(id)); }
}
