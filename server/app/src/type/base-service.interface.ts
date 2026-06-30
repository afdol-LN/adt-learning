import { DeepPartial } from "typeorm";

export interface IBaseService<T>{
    create(data: DeepPartial<T>): Promise<T>;
    findAll(): Promise<T[]>;
    findOne(id: number): Promise<T>;
    update(id: number, data: DeepPartial<T>): Promise<T>;
    remove(id: number): Promise<void>;
}