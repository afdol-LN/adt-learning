import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectDataSource, InjectRepository } from "@nestjs/typeorm";
import { DataSource, EntityManager, Repository } from "typeorm";
import { BaseService } from "./base.service";
import { Skill } from "src/entity/skill.entity";
import { SkillPrerequisite } from "src/entity/skillPrerequisite.entity";
import { Status } from "src/enums/status.enum";
import {
  CreateSkillWithPrerequisiteDto,
  SkillPrerequisiteItemDto,
  UpdateSkillWithPrerequisiteDto,
} from "src/dto/skill.dto";

@Injectable()
export class skillService extends BaseService<Skill> {
  constructor(
    @InjectRepository(Skill)
    private readonly skillRepository: Repository<Skill>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {
    super(skillRepository);
  }

  async findAll(): Promise<Skill[]> {
    return this.skillRepository.find({
      relations: { skillPrequisite: { prerequisiteSkill: true } },
    });
  }

  async findOne(skillId: number): Promise<Skill> {
    const result = await this.skillRepository.findOne({
      where: { skillId },
      relations: { skillPrequisite: { prerequisiteSkill: true } },
    });
    if (!result) {
      throw new NotFoundException(`Skill ${skillId} not found`);
    }
    return result;
  }

  async remove(skillId: number): Promise<void> {
    const existing = await this.findOne(skillId);
    existing.status = Status.INACTIVE;
    await this.skillRepository.save(existing);
  }

  async createSkillWithPrerequisite(dto: CreateSkillWithPrerequisiteDto): Promise<Skill> {
    const { prerequisites, ...skillData } = dto;

    const existing = await this.skillRepository.findOne({ where: { skillCode: skillData.skillCode} });
    if (existing) {
      throw new BadRequestException(`Skill ${skillData.skillCode} already exists`);
    }

    const skill = await this.dataSource.transaction(async (manager) => {
      const skillRepo = manager.getRepository(Skill);
      const skillPrerequisiteRepo = manager.getRepository(SkillPrerequisite);

      const newSkill = await skillRepo.save(skillRepo.create(skillData));

      await this.validatePrerequisites(manager, newSkill.skillId, prerequisites);

      const prereqRows = prerequisites.map((p) =>
        skillPrerequisiteRepo.create({
          skillId: newSkill.skillId,
          prerequisiteSkillId: p.prerequisiteSkillId,
          prerequisiteLevel: p.prerequisiteLevel,
        }),
      );
      await skillPrerequisiteRepo.save(prereqRows);

      return newSkill;
    });

    return this.findOne(skill.skillId);
  }

  async updateSkillWithPrerequisite(skillId: number, dto: UpdateSkillWithPrerequisiteDto): Promise<Skill> {
    const { prerequisites, ...skillData } = dto;

    await this.findOne(skillId); // throws NotFoundException if missing

    await this.dataSource.transaction(async (manager) => {
      const skillRepo = manager.getRepository(Skill);
      const skillPrerequisiteRepo = manager.getRepository(SkillPrerequisite);

      if (prerequisites) {
        await this.validatePrerequisites(manager, skillId, prerequisites);
      }

      if (Object.keys(skillData).length > 0) {
        await skillRepo.update({ skillId }, skillData);
      }

      if (prerequisites) {
        await skillPrerequisiteRepo.delete({ skillId });
        const prereqRows = prerequisites.map((p) =>
          skillPrerequisiteRepo.create({
            skillId,
            prerequisiteSkillId: p.prerequisiteSkillId,
            prerequisiteLevel: p.prerequisiteLevel,
          }),
        );
        await skillPrerequisiteRepo.save(prereqRows);
      }
    });

    return this.findOne(skillId);
  }

  private async validatePrerequisites(
    manager: EntityManager,
    skillId: number,
    prerequisites: SkillPrerequisiteItemDto[],
  ): Promise<void> {
    const skillRepo = manager.getRepository(Skill);
    for (const p of prerequisites) {
      if (p.prerequisiteSkillId === skillId) {
        throw new BadRequestException(`Skill ${skillId} cannot be its own prerequisite`);
      }
      const found = await skillRepo.findOne({ where: { skillId: p.prerequisiteSkillId } });
      if (!found) {
        throw new BadRequestException(`Prerequisite skill ${p.prerequisiteSkillId} does not exist`);
      }
    }
  }
}
