import {
  Body,
  Delete,
  Get,
  Param,
  Post,
  Put,
  ParseIntPipe,
} from '@nestjs/common';
import { IBaseService } from 'src/type/base-service.interface';
import type { DeepPartial, ObjectLiteral } from 'typeorm';

export abstract class BaseController<T extends ObjectLiteral> {
  constructor(private readonly service: IBaseService<T>) {}

  @Post()
  async create(@Body() data: DeepPartial<T>): Promise<T> {
    return await this.service.create(data);
  }

  @Get()
  async findAll(): Promise<T[]> {
    return await this.service.findAll();
  }

  @Get(':id')
  async findOne(@Param('id', ParseIntPipe) id: number): Promise<T> {
    return await this.service.findOne(id);
  }

  @Put(':id')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() data: DeepPartial<T>,
  ): Promise<T> {
    return await this.service.update(id, data);
  }

  @Delete(':id')
  async remove(@Param('id', ParseIntPipe) id: number): Promise<void> {
    return await this.service.remove(id);
  }
}
