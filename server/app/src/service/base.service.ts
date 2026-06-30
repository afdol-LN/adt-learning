import { NotFoundException } from '@nestjs/common';
import { IBaseService } from 'src/type/base-service.interface';
import { DeepPartial, ObjectLiteral, Repository } from 'typeorm';

export abstract class BaseService<T extends ObjectLiteral> implements IBaseService<T> {
  constructor(private readonly repo: Repository<T>) {}

  async create(data: DeepPartial<T>): Promise<T> {
    const entity = await this.repo.create(data);
    return await this.repo.save(entity);
  }

  async findAll(): Promise<T[]> {
    const result = await this.repo.find();
    return result;
  }

  async findOne(id: number): Promise<T> {
    const result = await this.repo.findOne({ where: { id } as any });
    if (!result) {
      throw new NotFoundException(`Resource with id ${id} not found`);
    }
    return result;
  }

  async update(id: number, data: DeepPartial<T>): Promise<T> {
    await this.findOne(id); // เช็กก่อนว่ามีตัวตนไหม
    await this.repo.update(id, data as any);
    return this.findOne(id);
  }

  async remove(id: number): Promise<void> {
    const entity = await this.findOne(id);
    await this.repo.remove(entity);
  }
}
