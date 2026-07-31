# Goal Admin Panel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Goal admin panel (list/view/edit/create) to the frontend admin home, backed by a new `/goal` REST resource on the NestJS backend, mirroring the existing `skillPanel`/`skill` pattern.

**Architecture:** Backend: `goalController`/`goalService` extending the shared `BaseController`/`BaseService`, plus two composite endpoints (`with-skill-require`) that transactionally write `Goal` + `GoalSkillRequire` together, exactly like `skillController`/`skillService`'s `with-prerequisite` endpoints. A schema migration renames `Goal.goalName`→`goalDescription` (widened) and adds a `status` enum column. Frontend: a new `goalPanel/` folder (tab, hook-based controller, service, form modal, view modal, skill-picker subcomponent, static SVG dependency diagram) wired into `Adminhome.tsx` as a new sidebar tab.

**Tech Stack:** NestJS 11 + TypeORM (Postgres) on the backend; React 19 + TypeScript + Vite on the frontend. No class-validator/`ValidationPipe` is active in this backend — all DTO validation in this codebase is done manually inside services (see `skillService.validatePrerequisites`), not via decorators.

**Spec:** `adt-learning/docs/superpowers/specs/2026-07-31-goal-admin-panel-design.md`

## Global Constraints

- Backend DTOs in this codebase are plain TS classes with `!`/`?` markers, no `class-validator` decorators (the package isn't installed and no `ValidationPipe` is registered in `main.ts`) — do not add decorator-based validation; validate manually in the service layer instead, matching `skillService`.
- Migrations are hand-authored (not the auto-generated diff), following the exact SQL style already in `src/migrations/*.ts` (e.g. `1783948498879-UpdateSchem.ts` for enum columns, `1784470000000-AddExerciseSkillLevelAndType.ts` for a hand-named file) — raw `queryRunner.query(...)` calls, explicit `up`/`down`.
- `Goal.goal` is the primary/display name (required); `Goal.goalName` is being renamed to `goalDescription` (widened to `varchar(255)`) — this is a rename, not a drop+add, to avoid data loss.
- Soft-delete only: `remove()` sets `status = Status.INACTIVE`, never deletes rows (matches `skillService.remove`).
- This working directory holds two independent git repos — `adt-learning/` (backend) and `G06_adaptive_learning/` (frontend). Commit each repo's changes separately, from within that repo.
- No test suite is configured in `G06_adaptive_learning` — frontend tasks are verified via `npm run build` (type-check) and manual browser walkthroughs, not automated tests.
- The backend has `jest` configured but no existing precedent of testing resource controllers/services (`skillService`/`skillController` have zero spec files) — write jest coverage only for `goalService`'s non-trivial transactional/validation logic (Task 2), skip inventing controller/e2e test scaffolding that has no precedent in this codebase.

---

## Task 1: Goal entity, relation wiring, and schema migration

**Files:**
- Modify: `adt-learning/server/app/src/entity/goal.entity.ts`
- Modify: `adt-learning/server/app/src/entity/goalSkillRequire.entity.ts`
- Create: `adt-learning/server/app/src/migrations/1785200000000-AddGoalStatusAndDescription.ts`

**Interfaces:**
- Produces: `Goal.goal: string` (unchanged, now the required display name), `Goal.goalDescription: string` (renamed from `goalName`, `varchar(255)`), `Goal.status: string` (new, `Status` enum, default `active`), `Goal.goalSkillRequire: GoalSkillRequire[]` (new inverse relation, needed by Task 2's eager-load).

- [ ] **Step 1: Update `goal.entity.ts`** — rename `goalName`→`goalDescription`, widen the column, add `status`, add the `goalSkillRequire` inverse relation (mirrors `Skill.skillPrequisite`):

```ts
import { Column, Entity, OneToMany, PrimaryGeneratedColumn } from "typeorm";
import { Branch } from "./branch.entity";
import { GoalSkillRequire } from "./goalSkillRequire.entity";
import { Status } from "../enums/status.enum";

@Entity('goal')
export class Goal {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ nullable: true })
    goal: string;

    @Column({ name: 'goal_description', type: 'varchar', length: 255, nullable: true })
    goalDescription: string;

    @Column({
        type: 'enum',
        enum: Status,
        default: Status.ACTIVE,
    })
    status: string;

    @Column({
        type: 'timestamp',
        default: () => 'CURRENT_TIMESTAMP',
    })
    createdAt: Date;

    @Column({
        type: 'timestamp',
        default: () => 'CURRENT_TIMESTAMP',
    })
    updatedAt: Date;

    @OneToMany(() => Branch, branch => branch.goal)
    branches: Branch[];

    @OneToMany(() => GoalSkillRequire, require => require.goal)
    goalSkillRequire: GoalSkillRequire[];

}
```

- [ ] **Step 2: Update `goalSkillRequire.entity.ts`** — point its `@ManyToOne(() => Goal)` at the new inverse property (currently it has no inverse specified, which won't satisfy TypeORM's nested `relations: { goalSkillRequire: {...} } }` eager-load used in Task 2):

```ts
import { Column, Entity, JoinColumn, ManyToOne, PrimaryColumn } from "typeorm";
import { Goal } from "./goal.entity";
import { Skill } from "./skill.entity";

@Entity('GoalskillRequire')
export class GoalSkillRequire {
    @PrimaryColumn({ name: 'goal_id', type: 'integer' })
    goalId: number;

    @PrimaryColumn({ name: 'skill_id', type: 'integer' })
    skillId: number;

    @Column({ name: 'level_require', type: 'integer', nullable: true })
    levelRequire: number;

    @ManyToOne(() => Goal, goal => goal.goalSkillRequire)
    @JoinColumn({ name: 'goal_id', referencedColumnName: 'id' })
    goal: Goal;

    @ManyToOne(() => Skill)
    @JoinColumn({ name: 'skill_id', referencedColumnName: 'skillId' })
    skill: Skill;
}
```

- [ ] **Step 3: Write the migration** at `adt-learning/server/app/src/migrations/1785200000000-AddGoalStatusAndDescription.ts` (timestamp chosen above the latest existing migration, `1785056600000-ResyncExerciseSequences.ts`):

```ts
import { MigrationInterface, QueryRunner } from "typeorm";

export class AddGoalStatusAndDescription1785200000000 implements MigrationInterface {
    name = 'AddGoalStatusAndDescription1785200000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "goal" RENAME COLUMN "goal_name" TO "goal_description"`);
        await queryRunner.query(`ALTER TABLE "goal" ALTER COLUMN "goal_description" TYPE character varying(255)`);

        await queryRunner.query(`CREATE TYPE "public"."goal_status_enum" AS ENUM('active', 'inactive')`);
        await queryRunner.query(`ALTER TABLE "goal" ADD "status" "public"."goal_status_enum" NOT NULL DEFAULT 'active'`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "goal" DROP COLUMN "status"`);
        await queryRunner.query(`DROP TYPE "public"."goal_status_enum"`);

        await queryRunner.query(`ALTER TABLE "goal" ALTER COLUMN "goal_description" TYPE character varying(20)`);
        await queryRunner.query(`ALTER TABLE "goal" RENAME COLUMN "goal_description" TO "goal_name"`);
    }

}
```

- [ ] **Step 4: Build and run the migration**

```bash
cd adt-learning/server/app
npm run build
npm run migration:run
```

Expected: build succeeds; the migration runs and the `goal` table now has `goal_description` (`varchar(255)`) and `status` (`goal_status_enum`, default `active`) columns. If there's no reachable dev database configured (`DATABASE_URL`), skip running it live, but confirm `npm run build` compiles cleanly with the new entity shape — the migration will be run in Task 3's manual verification once the full backend is wired up.

- [ ] **Step 5: Commit**

```bash
git add src/entity/goal.entity.ts src/entity/goalSkillRequire.entity.ts src/migrations/1785200000000-AddGoalStatusAndDescription.ts
git commit -m "feat: add Goal status field and rename goalName to goalDescription"
```

---

## Task 2: Goal DTOs and `goalService`

**Files:**
- Modify: `adt-learning/server/app/src/dto/goal.dto.ts`
- Create: `adt-learning/server/app/src/service/goal.service.ts`
- Create: `adt-learning/server/app/src/service/goal.service.spec.ts`

**Interfaces:**
- Consumes: `Goal` entity from Task 1 (`goal`, `goalDescription`, `status`, `goalSkillRequire` relation).
- Produces: `goalService` class with `findAll()`, `findOne(id)`, `remove(id)`, `createGoalWithSkillRequire(dto)`, `updateGoalWithSkillRequire(id, dto)` — consumed by Task 3's `goalController`. DTOs: `CreateGoalDto { goal: string; goalDescription?: string; status?: Status }`, `UpdateGoalDto { goal?: string; goalDescription?: string; status?: Status }`, `GoalSkillRequireItemDto { skillId: number; levelRequire?: number }`, `CreateGoalWithSkillRequireDto extends CreateGoalDto { skillRequires: GoalSkillRequireItemDto[] }`, `UpdateGoalWithSkillRequireDto extends UpdateGoalDto { skillRequires?: GoalSkillRequireItemDto[] }`.

- [ ] **Step 1: Rewrite `dto/goal.dto.ts`**

```ts
import { Status } from "src/enums/status.enum";

export class CreateGoalDto {
  goal!: string;
  goalDescription?: string;
  status?: Status;
}

export class UpdateGoalDto {
  goal?: string;
  goalDescription?: string;
  status?: Status;
}

export class GoalSkillRequireItemDto {
  skillId!: number;
  levelRequire?: number;
}

export class CreateGoalWithSkillRequireDto extends CreateGoalDto {
  skillRequires!: GoalSkillRequireItemDto[];
}

export class UpdateGoalWithSkillRequireDto extends UpdateGoalDto {
  skillRequires?: GoalSkillRequireItemDto[];
}
```

- [ ] **Step 2: Write the failing test** at `src/service/goal.service.spec.ts`

```ts
import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { getRepositoryToken, getDataSourceToken } from '@nestjs/typeorm';
import { goalService } from './goal.service';
import { Goal } from 'src/entity/goal.entity';
import { GoalSkillRequire } from 'src/entity/goalSkillRequire.entity';
import { Skill } from 'src/entity/skill.entity';
import { Status } from 'src/enums/status.enum';

describe('goalService', () => {
  let service: goalService;
  let goalRepo: { find: jest.Mock; findOne: jest.Mock; save: jest.Mock; create: jest.Mock; update: jest.Mock };
  let skillRepo: { findOne: jest.Mock };
  let requireRepo: { create: jest.Mock; save: jest.Mock; delete: jest.Mock };
  let dataSource: { transaction: jest.Mock };

  beforeEach(async () => {
    goalRepo = {
      find: jest.fn(),
      findOne: jest.fn(),
      save: jest.fn((entity) => Promise.resolve({ id: 1, ...entity })),
      create: jest.fn((data) => data),
      update: jest.fn(),
    };
    skillRepo = { findOne: jest.fn() };
    requireRepo = { create: jest.fn((data) => data), save: jest.fn(), delete: jest.fn() };

    const mockManager = {
      getRepository: jest.fn((entity) => {
        if (entity === Goal) return goalRepo;
        if (entity === GoalSkillRequire) return requireRepo;
        if (entity === Skill) return skillRepo;
        throw new Error(`Unexpected repository requested: ${entity}`);
      }),
    };

    dataSource = { transaction: jest.fn((cb) => cb(mockManager)) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        goalService,
        { provide: getRepositoryToken(Goal), useValue: goalRepo },
        { provide: getDataSourceToken(), useValue: dataSource },
      ],
    }).compile();

    service = module.get<goalService>(goalService);
  });

  it('rejects an empty goal name', async () => {
    await expect(
      service.createGoalWithSkillRequire({ goal: '   ', skillRequires: [] }),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects a skillId that does not exist', async () => {
    skillRepo.findOne.mockResolvedValue(null);

    await expect(
      service.createGoalWithSkillRequire({
        goal: 'Become a backend engineer',
        skillRequires: [{ skillId: 999 }],
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects a skillId that is inactive', async () => {
    skillRepo.findOne.mockResolvedValue({ skillId: 5, status: Status.INACTIVE });

    await expect(
      service.createGoalWithSkillRequire({
        goal: 'Become a backend engineer',
        skillRequires: [{ skillId: 5 }],
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('sets status to inactive on remove (soft delete)', async () => {
    goalRepo.findOne.mockResolvedValue({ id: 1, goal: 'x', status: Status.ACTIVE });

    await service.remove(1);

    expect(goalRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ status: Status.INACTIVE }),
    );
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `cd adt-learning/server/app && npx jest src/service/goal.service.spec.ts`
Expected: FAIL — `Cannot find module './goal.service'`.

- [ ] **Step 4: Write `service/goal.service.ts`**

```ts
import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectDataSource, InjectRepository } from "@nestjs/typeorm";
import { DataSource, EntityManager, Repository } from "typeorm";
import { BaseService } from "./base.service";
import { Goal } from "src/entity/goal.entity";
import { GoalSkillRequire } from "src/entity/goalSkillRequire.entity";
import { Skill } from "src/entity/skill.entity";
import { Status } from "src/enums/status.enum";
import {
  CreateGoalWithSkillRequireDto,
  GoalSkillRequireItemDto,
  UpdateGoalWithSkillRequireDto,
} from "src/dto/goal.dto";

const GOAL_RELATIONS = {
  goalSkillRequire: { skill: { skillPrequisite: { prerequisiteSkill: true } } },
};

@Injectable()
export class goalService extends BaseService<Goal> {
  constructor(
    @InjectRepository(Goal)
    private readonly goalRepository: Repository<Goal>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {
    super(goalRepository);
  }

  async findAll(): Promise<Goal[]> {
    return this.goalRepository.find({ relations: GOAL_RELATIONS });
  }

  async findOne(id: number): Promise<Goal> {
    const result = await this.goalRepository.findOne({
      where: { id },
      relations: GOAL_RELATIONS,
    });
    if (!result) {
      throw new NotFoundException(`Goal ${id} not found`);
    }
    return result;
  }

  async remove(id: number): Promise<void> {
    const existing = await this.findOne(id);
    existing.status = Status.INACTIVE;
    await this.goalRepository.save(existing);
  }

  async createGoalWithSkillRequire(dto: CreateGoalWithSkillRequireDto): Promise<Goal> {
    const { skillRequires, ...goalData } = dto;

    if (!goalData.goal || goalData.goal.trim() === '') {
      throw new BadRequestException('Goal name is required');
    }

    const goal = await this.dataSource.transaction(async (manager) => {
      const goalRepo = manager.getRepository(Goal);
      const requireRepo = manager.getRepository(GoalSkillRequire);

      const newGoal = await goalRepo.save(goalRepo.create(goalData));

      await this.validateSkillRequires(manager, skillRequires);

      const requireRows = skillRequires.map((s) =>
        requireRepo.create({
          goalId: newGoal.id,
          skillId: s.skillId,
          levelRequire: s.levelRequire,
        }),
      );
      await requireRepo.save(requireRows);

      return newGoal;
    });

    return this.findOne(goal.id);
  }

  async updateGoalWithSkillRequire(id: number, dto: UpdateGoalWithSkillRequireDto): Promise<Goal> {
    const { skillRequires, ...goalData } = dto;

    await this.findOne(id); // throws NotFoundException if missing

    if (goalData.goal !== undefined && goalData.goal.trim() === '') {
      throw new BadRequestException('Goal name is required');
    }

    await this.dataSource.transaction(async (manager) => {
      const goalRepo = manager.getRepository(Goal);
      const requireRepo = manager.getRepository(GoalSkillRequire);

      if (skillRequires) {
        await this.validateSkillRequires(manager, skillRequires);
      }

      if (Object.keys(goalData).length > 0) {
        await goalRepo.update({ id }, goalData);
      }

      if (skillRequires) {
        await requireRepo.delete({ goalId: id });
        const requireRows = skillRequires.map((s) =>
          requireRepo.create({
            goalId: id,
            skillId: s.skillId,
            levelRequire: s.levelRequire,
          }),
        );
        await requireRepo.save(requireRows);
      }
    });

    return this.findOne(id);
  }

  private async validateSkillRequires(
    manager: EntityManager,
    skillRequires: GoalSkillRequireItemDto[],
  ): Promise<void> {
    const skillRepo = manager.getRepository(Skill);
    for (const s of skillRequires) {
      const found = await skillRepo.findOne({ where: { skillId: s.skillId } });
      if (!found) {
        throw new BadRequestException(`Skill ${s.skillId} does not exist`);
      }
      if (found.status !== Status.ACTIVE) {
        throw new BadRequestException(`Skill ${s.skillId} is not active`);
      }
    }
  }
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `cd adt-learning/server/app && npx jest src/service/goal.service.spec.ts`
Expected: PASS (4 tests).

- [ ] **Step 6: Commit**

```bash
git add src/dto/goal.dto.ts src/service/goal.service.ts src/service/goal.service.spec.ts
git commit -m "feat: add goalService with skill-require validation and soft delete"
```

---

## Task 3: `goalController`, module registration, and rename fallout

**Files:**
- Create: `adt-learning/server/app/src/controller/goal.controller.ts`
- Modify: `adt-learning/server/app/src/app.module.ts`
- Modify: `adt-learning/server/app/src/service/user.service.ts:164`
- Modify: `adt-learning/server/app/src/service/exercise.service.ts:166`

**Interfaces:**
- Consumes: `goalService` from Task 2.
- Produces: `GET /goal`, `GET /goal/:id`, `POST /goal`, `PUT /goal/:id`, `DELETE /goal/:id` (inherited from `BaseController`), `POST /goal/with-skill-require`, `PUT /goal/:id/with-skill-require` — consumed by the frontend `goal.service.ts` in Task 4.

- [ ] **Step 1: Write `controller/goal.controller.ts`**

```ts
import {
  Body,
  Controller,
  Param,
  ParseIntPipe,
  Post,
  Put,
} from '@nestjs/common';
import {
  CreateGoalWithSkillRequireDto,
  UpdateGoalWithSkillRequireDto,
} from 'src/dto/goal.dto';
import { Goal } from 'src/entity/goal.entity';
import { goalService } from 'src/service/goal.service';
import { BaseController } from './base.controller';

@Controller('/goal')
export class goalController extends BaseController<Goal> {
  constructor(private readonly goalService: goalService) {
    super(goalService);
  }

  @Post('/with-skill-require')
  async createWithSkillRequire(
    @Body() dto: CreateGoalWithSkillRequireDto,
  ): Promise<Goal> {
    return await this.goalService.createGoalWithSkillRequire(dto);
  }

  @Put(':id/with-skill-require')
  async updateWithSkillRequire(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateGoalWithSkillRequireDto,
  ): Promise<Goal> {
    return await this.goalService.updateGoalWithSkillRequire(id, dto);
  }
}
```

- [ ] **Step 2: Register in `app.module.ts`** — add the two imports and add both to `controllers`/`providers`:

```ts
import { goalController } from './controller/goal.controller';
import { goalService } from './service/goal.service';
```

In the `controllers` array, add `goalController` (e.g. after `skillController`); in `providers`, add `goalService` (after `skillService`).

- [ ] **Step 3: Fix `user.service.ts:164`** — since `goal` is now the canonical display name (no longer `goalName`), drop the stale fallback:

Before:
```ts
              goals:
                userProfile.branches
                  ?.map((branch) => branch.goal?.goalName || branch.goal?.goal)
                  .filter(Boolean)
                  .join('-') || '-',
```

After:
```ts
              goals:
                userProfile.branches
                  ?.map((branch) => branch.goal?.goal)
                  .filter(Boolean)
                  .join('-') || '-',
```

- [ ] **Step 4: Fix `exercise.service.ts:166`** — rename the stale `goalName` field reference to `goalDescription` (keeps the existing "match by either column" behavior):

Before:
```ts
                const foundGoal = await this.goalRepository.findOne({
                    where: [
                        { goalName: goalId },
                        { goal: goalId }
                    ]
                });
```

After:
```ts
                const foundGoal = await this.goalRepository.findOne({
                    where: [
                        { goalDescription: goalId },
                        { goal: goalId }
                    ]
                });
```

- [ ] **Step 5: Build and verify**

```bash
cd adt-learning/server/app
npm run lint
npm run build
```

Expected: both succeed with no TypeScript errors (confirms the `goalName`→`goalDescription` rename didn't leave any stale references anywhere else in the codebase).

- [ ] **Step 6: Manual smoke test against a running server**

```bash
npm run start:dev
```

In another terminal (adjust host/port to match your `.env`):

```bash
curl -X POST http://localhost:3000/goal/with-skill-require -H "Content-Type: application/json" -d "{\"goal\":\"Become a backend engineer\",\"goalDescription\":\"Covers APIs, databases, and auth\",\"skillRequires\":[]}"
curl http://localhost:3000/goal
```

Expected: the POST returns a created goal with `status: "active"`; the GET returns an array containing it. If migration wasn't run live in Task 1 (no dev DB available), run `npm run migration:run` first — this step is the first point where a live DB is actually required.

- [ ] **Step 7: Commit**

```bash
git add src/controller/goal.controller.ts src/app.module.ts src/service/user.service.ts src/service/exercise.service.ts
git commit -m "feat: wire up goal controller and fix goalName rename fallout"
```

---

## Task 4: Frontend Goal model and API service

**Files:**
- Create: `G06_adaptive_learning/src/models/goalModel.ts`
- Create: `G06_adaptive_learning/src/component/adminHome/goalPanel/goal.service.ts`

**Interfaces:**
- Consumes: `Skill` from `../../../models/skillModel` (for the nested `skill` field on a goal's skill requirement); `AppClient` from `../../../API/appRestApi`; `ApiResponse<T>` from `../../../models/apiResponse`.
- Produces: `Goal`, `GoalSkillRequireEntry`, `GoalSkillRequireInput`, `CreateGoalWithSkillRequireRequest`, `UpdateGoalWithSkillRequireRequest` types, and a `goalService` singleton with `getAllGoals()`, `createGoalWithSkillRequire()`, `updateGoalWithSkillRequire()`, `updateGoalStatus()` — consumed by Task 5's `goal.controller.ts`.

- [ ] **Step 1: Write `src/models/goalModel.ts`**

```ts
import { ApiResponse } from "./apiResponse";
import { Skill } from "./skillModel";

export interface GoalSkillRequireInput {
  skillId: number;
  levelRequire?: number;
}

export interface GoalSkillRequireEntry {
  goalId: number;
  skillId: number;
  levelRequire: number | null;
  skill?: Skill;
}

export interface Goal {
  id: number;
  goal: string;
  goalDescription?: string | null;
  status: string;
  goalSkillRequire?: GoalSkillRequireEntry[];
}

export interface CreateGoalRequest {
  goal: string;
  goalDescription?: string;
  status?: string;
}

export interface UpdateGoalRequest {
  goal?: string;
  goalDescription?: string;
  status?: string;
}

export interface CreateGoalWithSkillRequireRequest extends CreateGoalRequest {
  skillRequires: GoalSkillRequireInput[];
}

export interface UpdateGoalWithSkillRequireRequest extends UpdateGoalRequest {
  skillRequires?: GoalSkillRequireInput[];
}

export type GetGoalsResponse = ApiResponse<Goal[]>;
export type GetGoalResponse = ApiResponse<Goal>;
```

- [ ] **Step 2: Write `src/component/adminHome/goalPanel/goal.service.ts`**

```ts
import { AppClient } from "../../../API/appRestApi";
import { ApiResponse } from "../../../models/apiResponse";
import {
  Goal,
  CreateGoalWithSkillRequireRequest,
  UpdateGoalWithSkillRequireRequest,
} from "../../../models/goalModel";

export class GoalService {
  getAllGoals = async (): Promise<ApiResponse<Goal[]>> => {
    try {
      const result = await AppClient.get("/goal");
      return { isError: false, data: result as Goal[], errorMessage: "" };
    } catch (error: any) {
      return {
        isError: true,
        data: null,
        errorMessage: error.message || "Failed to fetch goals",
      };
    }
  };

  createGoalWithSkillRequire = async (
    data: CreateGoalWithSkillRequireRequest,
  ): Promise<ApiResponse<Goal>> => {
    try {
      const result = await AppClient.post("/goal/with-skill-require", data);
      return { isError: false, data: result as Goal, errorMessage: "" };
    } catch (error: any) {
      return {
        isError: true,
        data: null,
        errorMessage: error.message || "Failed to create goal",
      };
    }
  };

  updateGoalWithSkillRequire = async (
    goalId: number,
    data: UpdateGoalWithSkillRequireRequest,
  ): Promise<ApiResponse<Goal>> => {
    try {
      const result = await AppClient.put(`/goal/${goalId}/with-skill-require`, data);
      return { isError: false, data: result as Goal, errorMessage: "" };
    } catch (error: any) {
      return {
        isError: true,
        data: null,
        errorMessage: error.message || "Failed to update goal",
      };
    }
  };

  updateGoalStatus = async (
    goalId: number,
    status: string,
  ): Promise<ApiResponse<Goal>> => {
    try {
      const result = await AppClient.put(`/goal/${goalId}`, { status });
      return { isError: false, data: result as Goal, errorMessage: "" };
    } catch (error: any) {
      return {
        isError: true,
        data: null,
        errorMessage: error.message || "Failed to update goal status",
      };
    }
  };
}

export const goalService = new GoalService();
```

- [ ] **Step 3: Type-check**

```bash
cd G06_adaptive_learning
npm run build
```

Expected: succeeds with no TypeScript errors.

- [ ] **Step 4: Commit**

```bash
git add src/models/goalModel.ts src/component/adminHome/goalPanel/goal.service.ts
git commit -m "feat: add Goal model and API service"
```

---

## Task 5: Frontend `goal.controller.ts` hook

**Files:**
- Create: `G06_adaptive_learning/src/component/adminHome/goalPanel/goal.controller.ts`

**Interfaces:**
- Consumes: `goalService` (Task 4), `skillService` from `../skillPanel/skill.service` (existing), `getStatusColor` from `../../../utils/adminUi` (existing).
- Produces: `goalController()` hook returning `{ goals, isLoading, error, goalSearch, setGoalSearch, filteredGoals, activeSkills, getStatusColor, isFormOpen, editingGoal, isSaving, formError, openCreateForm, openEditForm, closeForm, saveGoal, viewingGoal, openView, closeView, toggleGoalStatus }`; `GoalFormValues` type and `EMPTY_GOAL_FORM` constant — consumed by Task 6/7/8's components.

- [ ] **Step 1: Write `goal.controller.ts`**

```ts
import { useCallback, useEffect, useMemo, useState } from "react";
import { goalService } from "./goal.service";
import { skillService } from "../skillPanel/skill.service";
import { Goal, GoalSkillRequireInput } from "../../../models/goalModel";
import { Skill } from "../../../models/skillModel";
import { getStatusColor } from "../../../utils/adminUi";

export interface GoalFormValues {
  goal: string;
  goalDescription: string;
  skillRequires: GoalSkillRequireInput[];
}

export const EMPTY_GOAL_FORM: GoalFormValues = {
  goal: "",
  goalDescription: "",
  skillRequires: [],
};

export function goalController() {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [goalSearch, setGoalSearch] = useState<string>("");

  const [activeSkills, setActiveSkills] = useState<Skill[]>([]);

  const [isFormOpen, setIsFormOpen] = useState<boolean>(false);
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [viewingGoal, setViewingGoal] = useState<Goal | null>(null);

  useEffect(() => {
    loadGoals();
    loadSkills();
  }, []);

  const loadGoals = useCallback(async () => {
    setIsLoading(true);
    const result = await goalService.getAllGoals();
    if (result.isError) {
      setError(result.errorMessage);
      setGoals([]);
    } else {
      setGoals(result.data || []);
      setError(null);
    }
    setIsLoading(false);
  }, []);

  const loadSkills = useCallback(async () => {
    const result = await skillService.getAllSkills();
    if (!result.isError) {
      setActiveSkills((result.data || []).filter((s) => s.status === "active"));
    }
  }, []);

  const filteredGoals = useMemo(() => {
    const term = goalSearch.trim().toLowerCase();
    if (!term) return goals;
    return goals.filter((g) => g.goal.toLowerCase().includes(term));
  }, [goals, goalSearch]);

  const openCreateForm = () => {
    setFormError(null);
    setEditingGoal(null);
    setIsFormOpen(true);
  };

  const openEditForm = (goal: Goal) => {
    setFormError(null);
    setEditingGoal(goal);
    setIsFormOpen(true);
  };

  const closeForm = () => {
    setIsFormOpen(false);
    setEditingGoal(null);
    setFormError(null);
  };

  const openView = (goal: Goal) => setViewingGoal(goal);
  const closeView = () => setViewingGoal(null);

  const saveGoal = async (form: GoalFormValues): Promise<boolean> => {
    setIsSaving(true);
    setFormError(null);
    try {
      const payload = {
        goal: form.goal,
        goalDescription: form.goalDescription,
        skillRequires: form.skillRequires,
      };

      const result = editingGoal
        ? await goalService.updateGoalWithSkillRequire(editingGoal.id, payload)
        : await goalService.createGoalWithSkillRequire(payload);

      if (result.isError) {
        setFormError(result.errorMessage);
        return false;
      }

      closeForm();
      await loadGoals();
      return true;
    } finally {
      setIsSaving(false);
    }
  };

  const toggleGoalStatus = async (goal: Goal) => {
    const newStatus = goal.status === "active" ? "inactive" : "active";
    setIsLoading(true);
    const result = await goalService.updateGoalStatus(goal.id, newStatus);
    if (result.isError) {
      setError(result.errorMessage);
    } else {
      setGoals((prev) =>
        prev.map((g) => (g.id === goal.id ? { ...g, status: newStatus } : g)),
      );
    }
    setIsLoading(false);
  };

  return {
    goals,
    isLoading,
    error,
    goalSearch,
    setGoalSearch,
    filteredGoals,
    activeSkills,
    getStatusColor,

    isFormOpen,
    editingGoal,
    isSaving,
    formError,
    openCreateForm,
    openEditForm,
    closeForm,
    saveGoal,

    viewingGoal,
    openView,
    closeView,

    toggleGoalStatus,
  };
}
```

- [ ] **Step 2: Type-check**

```bash
cd G06_adaptive_learning
npm run build
```

Expected: succeeds (the hook isn't consumed by any component yet, but must still type-check cleanly).

- [ ] **Step 3: Commit**

```bash
git add src/component/adminHome/goalPanel/goal.controller.ts
git commit -m "feat: add goalController hook for the admin Goal panel"
```

---

## Task 6: Skill-require editor and Goal form modal

**Files:**
- Create: `G06_adaptive_learning/src/component/adminHome/goalPanel/component/SkillRequireEditor.tsx`
- Create: `G06_adaptive_learning/src/component/adminHome/goalPanel/component/GoalFormModal.tsx`

**Interfaces:**
- Consumes: `GoalFormValues`, `EMPTY_GOAL_FORM` from `../goal.controller` (Task 5); `Skill` from `../../../../models/skillModel`; `Goal`, `GoalSkillRequireInput` from `../../../../models/goalModel`.
- Produces: `SkillRequireEditor` component (props: `{ activeSkills: Skill[]; value: GoalSkillRequireInput[]; onChange: (next: GoalSkillRequireInput[]) => void }`); `GoalFormModal` component (props: `{ isOpen, editingGoal, activeSkills, isSaving, formError, onSave, onClose }`) — consumed by Task 8's `GoalTab.tsx`.

- [ ] **Step 1: Write `SkillRequireEditor.tsx`** (the "skill dropdown" component: a select + level input + add button, appending rows to a list)

```tsx
import { useEffect, useState } from "react";
import { FaPlus, FaTrash } from "react-icons/fa6";
import { Skill } from "../../../../models/skillModel";
import { GoalSkillRequireInput } from "../../../../models/goalModel";

interface SkillRequireEditorProps {
  activeSkills: Skill[];
  value: GoalSkillRequireInput[];
  onChange: (next: GoalSkillRequireInput[]) => void;
}

export default function SkillRequireEditor({
  activeSkills,
  value,
  onChange,
}: SkillRequireEditorProps) {
  const usedIds = new Set(value.map((v) => v.skillId));
  const availableSkills = activeSkills.filter((s) => !usedIds.has(s.skillId));

  const [selectedSkillId, setSelectedSkillId] = useState<number | "">(
    availableSkills[0]?.skillId ?? "",
  );
  const [levelRequire, setLevelRequire] = useState<string>("");

  useEffect(() => {
    if (selectedSkillId !== "" && !availableSkills.some((s) => s.skillId === selectedSkillId)) {
      setSelectedSkillId(availableSkills[0]?.skillId ?? "");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, activeSkills]);

  const handleAdd = () => {
    if (selectedSkillId === "") return;
    const next: GoalSkillRequireInput = {
      skillId: Number(selectedSkillId),
      levelRequire: levelRequire.trim() === "" ? undefined : Number(levelRequire),
    };
    onChange([...value, next]);
    setLevelRequire("");
  };

  const handleRemove = (skillId: number) => {
    onChange(value.filter((v) => v.skillId !== skillId));
  };

  const skillName = (skillId: number) =>
    activeSkills.find((s) => s.skillId === skillId)?.skillsName || `#${skillId}`;

  return (
    <div className="ad-field">
      <label className="ad-label">Skill ที่ต้องใช้</label>

      <div className="ad-field-row">
        <select
          className="ad-select"
          value={selectedSkillId}
          onChange={(e) => setSelectedSkillId(e.target.value === "" ? "" : Number(e.target.value))}
        >
          <option value="" disabled>
            -- เลือก Skill --
          </option>
          {availableSkills.map((s) => (
            <option key={s.skillId} value={s.skillId}>
              {s.skillsName}
            </option>
          ))}
        </select>
        <input
          type="number"
          className="ad-input"
          placeholder="Level ที่ต้องการ"
          value={levelRequire}
          onChange={(e) => setLevelRequire(e.target.value)}
        />
        <button
          type="button"
          className="ad-btn-primary"
          onClick={handleAdd}
          disabled={selectedSkillId === ""}
        >
          <FaPlus /> เพิ่ม
        </button>
      </div>

      <div className="ad-req-tags">
        {value.length === 0 ? (
          <span className="ad-muted">— ยังไม่ได้เลือก Skill —</span>
        ) : (
          value.map((v) => (
            <span key={v.skillId} className="ad-req-tag">
              {skillName(v.skillId)}
              {v.levelRequire != null ? ` (level ${v.levelRequire})` : ""}
              <button
                type="button"
                onClick={() => handleRemove(v.skillId)}
                style={{ marginLeft: 6, border: "none", background: "transparent", cursor: "pointer" }}
              >
                <FaTrash />
              </button>
            </span>
          ))
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Write `GoalFormModal.tsx`**

```tsx
import React, { useEffect, useState } from "react";
import { FaPen, FaPlus } from "react-icons/fa6";
import { Goal } from "../../../../models/goalModel";
import { Skill } from "../../../../models/skillModel";
import { GoalFormValues, EMPTY_GOAL_FORM } from "../goal.controller";
import SkillRequireEditor from "./SkillRequireEditor";

interface GoalFormModalProps {
  isOpen: boolean;
  editingGoal: Goal | null;
  activeSkills: Skill[];
  isSaving: boolean;
  formError: string | null;
  onSave: (form: GoalFormValues) => Promise<boolean>;
  onClose: () => void;
}

export default function GoalFormModal({
  isOpen,
  editingGoal,
  activeSkills,
  isSaving,
  formError,
  onSave,
  onClose,
}: GoalFormModalProps) {
  const [goal, setGoal] = useState<string>("");
  const [goalDescription, setGoalDescription] = useState<string>("");
  const [skillRequires, setSkillRequires] = useState(EMPTY_GOAL_FORM.skillRequires);

  useEffect(() => {
    if (!isOpen) return;
    if (editingGoal) {
      setGoal(editingGoal.goal);
      setGoalDescription(editingGoal.goalDescription || "");
      setSkillRequires(
        (editingGoal.goalSkillRequire || []).map((r) => ({
          skillId: r.skillId,
          levelRequire: r.levelRequire ?? undefined,
        })),
      );
    } else {
      setGoal("");
      setGoalDescription("");
      setSkillRequires([]);
    }
  }, [isOpen, editingGoal]);

  if (!isOpen) return null;

  const isEdit = editingGoal !== null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSave({
      goal: goal.trim(),
      goalDescription: goalDescription.trim(),
      skillRequires,
    });
  };

  return (
    <div className="ad-overlay" onClick={onClose}>
      <div className="ad-modal" onClick={(e) => e.stopPropagation()}>
        <div className="ad-modal-header">
          <span className="ad-modal-title">
            {isEdit ? (
              <>
                <FaPen /> แก้ไข Goal
              </>
            ) : (
              <>
                <FaPlus /> เพิ่ม Goal ใหม่
              </>
            )}
          </span>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="ad-modal-body">
            {formError && (
              <div
                style={{
                  padding: "10px 14px",
                  borderRadius: "8px",
                  background: "#fef2f2",
                  border: "1px solid #fecaca",
                  color: "#dc2626",
                  fontSize: "13px",
                  fontWeight: 600,
                }}
              >
                {formError}
              </div>
            )}

            <div className="ad-field">
              <label className="ad-label">ชื่อ Goal</label>
              <input
                type="text"
                className="ad-input"
                value={goal}
                onChange={(e) => setGoal(e.target.value)}
                required
              />
            </div>

            <div className="ad-field">
              <label className="ad-label">คำอธิบาย</label>
              <textarea
                className="ad-input"
                value={goalDescription}
                onChange={(e) => setGoalDescription(e.target.value)}
                rows={3}
              />
            </div>

            <SkillRequireEditor
              activeSkills={activeSkills}
              value={skillRequires}
              onChange={setSkillRequires}
            />
          </div>

          <div className="ad-modal-footer">
            <button type="button" className="ad-btn-cancel" onClick={onClose} disabled={isSaving}>
              ยกเลิก
            </button>
            <button type="submit" className="ad-btn-primary" disabled={isSaving}>
              {isSaving ? "กำลังบันทึก..." : "บันทึก"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Type-check**

```bash
cd G06_adaptive_learning
npm run build
```

Expected: succeeds with no TypeScript errors.

- [ ] **Step 4: Commit**

```bash
git add src/component/adminHome/goalPanel/component/SkillRequireEditor.tsx src/component/adminHome/goalPanel/component/GoalFormModal.tsx
git commit -m "feat: add skill-require editor and Goal create/edit form modal"
```

---

## Task 7: Learning tree diagram and Goal view modal

**Files:**
- Create: `G06_adaptive_learning/src/component/adminHome/goalPanel/component/GoalLearningTree.tsx`
- Create: `G06_adaptive_learning/src/component/adminHome/goalPanel/component/GoalViewModal.tsx`

**Interfaces:**
- Consumes: `GoalSkillRequireEntry` from `../../../../models/goalModel`; `Goal` from same; `getStatusColor` from `../../../../utils/adminUi`.
- Produces: `GoalLearningTree` component (props: `{ requires: GoalSkillRequireEntry[] }`); `GoalViewModal` component (props: `{ goal: Goal | null; onClose: () => void; onEdit: (goal: Goal) => void }`) — consumed by Task 8's `GoalTab.tsx`.

- [ ] **Step 1: Write `GoalLearningTree.tsx`** — nodes are the goal's required skills, edges are prerequisite relationships between pairs of those required skills (derived from each skill's nested `skillPrequisite`), laid out in depth-ordered columns via a longest-path (Kahn's algorithm) topological sort:

```tsx
import { GoalSkillRequireEntry } from "../../../../models/goalModel";

interface TreeNode {
  skillId: number;
  name: string;
  level: number | null;
  depth: number;
}

interface TreeEdge {
  fromSkillId: number;
  toSkillId: number;
}

function buildTree(requires: GoalSkillRequireEntry[]): { nodes: TreeNode[]; edges: TreeEdge[] } {
  const requiredIds = new Set(requires.map((r) => r.skillId));
  const edges: TreeEdge[] = [];
  requires.forEach((r) => {
    (r.skill?.skillPrequisite || []).forEach((p) => {
      if (requiredIds.has(p.prerequisiteSkillId)) {
        edges.push({ fromSkillId: p.prerequisiteSkillId, toSkillId: r.skillId });
      }
    });
  });

  const outgoing = new Map<number, number[]>();
  const remaining = new Map<number, number>();
  requires.forEach((r) => remaining.set(r.skillId, 0));
  edges.forEach((e) => {
    outgoing.set(e.fromSkillId, [...(outgoing.get(e.fromSkillId) || []), e.toSkillId]);
    remaining.set(e.toSkillId, (remaining.get(e.toSkillId) || 0) + 1);
  });

  const depth = new Map<number, number>();
  let queue: number[] = [];
  requires.forEach((r) => {
    if ((remaining.get(r.skillId) || 0) === 0) {
      depth.set(r.skillId, 0);
      queue.push(r.skillId);
    }
  });

  while (queue.length > 0) {
    const next: number[] = [];
    queue.forEach((current) => {
      const currentDepth = depth.get(current) || 0;
      (outgoing.get(current) || []).forEach((child) => {
        depth.set(child, Math.max(depth.get(child) ?? 0, currentDepth + 1));
        remaining.set(child, (remaining.get(child) || 0) - 1);
        if (remaining.get(child) === 0) {
          next.push(child);
        }
      });
    });
    queue = next;
  }

  requires.forEach((r) => {
    if (!depth.has(r.skillId)) depth.set(r.skillId, 0);
  });

  const nodes: TreeNode[] = requires.map((r) => ({
    skillId: r.skillId,
    name: r.skill?.skillsName || `#${r.skillId}`,
    level: r.levelRequire,
    depth: depth.get(r.skillId) || 0,
  }));

  return { nodes, edges };
}

const NODE_WIDTH = 160;
const NODE_HEIGHT = 56;
const COLUMN_GAP = 80;
const ROW_GAP = 24;

export default function GoalLearningTree({ requires }: { requires: GoalSkillRequireEntry[] }) {
  const { nodes, edges } = buildTree(requires);

  if (nodes.length === 0) {
    return <span className="ad-muted">— ยังไม่มี Skill ที่ต้องใช้ —</span>;
  }

  const columns = new Map<number, TreeNode[]>();
  nodes.forEach((n) => {
    const col = columns.get(n.depth) || [];
    col.push(n);
    columns.set(n.depth, col);
  });

  const positions = new Map<number, { x: number; y: number }>();
  const maxDepth = Math.max(...nodes.map((n) => n.depth));
  for (let d = 0; d <= maxDepth; d++) {
    const col = columns.get(d) || [];
    col.forEach((n, i) => {
      positions.set(n.skillId, {
        x: d * (NODE_WIDTH + COLUMN_GAP),
        y: i * (NODE_HEIGHT + ROW_GAP),
      });
    });
  }

  const maxRows = Math.max(...Array.from(columns.values()).map((c) => c.length));
  const width = (maxDepth + 1) * (NODE_WIDTH + COLUMN_GAP) - COLUMN_GAP + 20;
  const height = maxRows * (NODE_HEIGHT + ROW_GAP) - ROW_GAP + 20;

  return (
    <svg className="ad-goal-tree" width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <defs>
        <marker id="goal-tree-arrow" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto">
          <path d="M0,0 L8,4 L0,8 Z" fill="#94a3b8" />
        </marker>
      </defs>
      {edges.map((e, i) => {
        const from = positions.get(e.fromSkillId);
        const to = positions.get(e.toSkillId);
        if (!from || !to) return null;
        return (
          <line
            key={`${e.fromSkillId}-${e.toSkillId}-${i}`}
            x1={from.x + NODE_WIDTH}
            y1={from.y + NODE_HEIGHT / 2}
            x2={to.x}
            y2={to.y + NODE_HEIGHT / 2}
            stroke="#94a3b8"
            strokeWidth={2}
            markerEnd="url(#goal-tree-arrow)"
          />
        );
      })}
      {nodes.map((n) => {
        const pos = positions.get(n.skillId)!;
        return (
          <g key={n.skillId} transform={`translate(${pos.x}, ${pos.y})`}>
            <rect width={NODE_WIDTH} height={NODE_HEIGHT} rx={8} fill="#eff6ff" stroke="#93c5fd" />
            <text x={12} y={22} fontSize={13} fontWeight={700} fill="#0f172a">
              {n.name}
            </text>
            <text x={12} y={40} fontSize={12} fill="#475569">
              {n.level != null ? `level ${n.level}` : "ไม่ระบุ level"}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
```

- [ ] **Step 2: Write `GoalViewModal.tsx`**

```tsx
import { FaMagnifyingGlass, FaPen } from "react-icons/fa6";
import { Goal } from "../../../../models/goalModel";
import { getStatusColor } from "../../../../utils/adminUi";
import GoalLearningTree from "./GoalLearningTree";

interface GoalViewModalProps {
  goal: Goal | null;
  onClose: () => void;
  onEdit: (goal: Goal) => void;
}

export default function GoalViewModal({ goal, onClose, onEdit }: GoalViewModalProps) {
  if (!goal) return null;

  const requires = goal.goalSkillRequire || [];

  return (
    <div className="ad-overlay" onClick={onClose}>
      <div className="ad-modal" onClick={(e) => e.stopPropagation()}>
        <div className="ad-modal-header">
          <span className="ad-modal-title"><FaMagnifyingGlass /> รายละเอียด Goal</span>
        </div>

        <div className="ad-modal-body">
          <div className="ad-field">
            <label className="ad-label">ชื่อ Goal</label>
            <div>{goal.goal}</div>
          </div>

          <div className="ad-field">
            <label className="ad-label">คำอธิบาย</label>
            <div>{goal.goalDescription || "-"}</div>
          </div>

          <div className="ad-field">
            <label className="ad-label">สถานะ</label>
            <div>
              <span className="ad-status-dot" style={{ background: getStatusColor(goal.status) }} />
              <span className="ad-muted">{goal.status}</span>
            </div>
          </div>

          <div className="ad-field">
            <label className="ad-label">Skill ที่ต้องใช้ (Level ที่ต้องการ)</label>
            <div className="ad-req-tags">
              {requires.length === 0 ? (
                <span className="ad-muted">— ไม่มี Skill ที่ต้องใช้ —</span>
              ) : (
                requires.map((r) => (
                  <span key={r.skillId} className="ad-req-tag">
                    {r.skill?.skillsName || `#${r.skillId}`}
                    {r.levelRequire != null ? ` (level ${r.levelRequire})` : ""}
                  </span>
                ))
              )}
            </div>
          </div>

          <div className="ad-field">
            <label className="ad-label">Learning Tree</label>
            <GoalLearningTree requires={requires} />
          </div>
        </div>

        <div className="ad-modal-footer">
          <button type="button" className="ad-btn-cancel" onClick={onClose}>
            ปิด
          </button>
          <button type="button" className="ad-btn-primary" onClick={() => onEdit(goal)}>
            <FaPen /> แก้ไข
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Type-check**

```bash
cd G06_adaptive_learning
npm run build
```

Expected: succeeds with no TypeScript errors.

- [ ] **Step 4: Commit**

```bash
git add src/component/adminHome/goalPanel/component/GoalLearningTree.tsx src/component/adminHome/goalPanel/component/GoalViewModal.tsx
git commit -m "feat: add Goal learning-tree diagram and view modal"
```

---

## Task 8: Goal list tab and Admin Home wiring

**Files:**
- Create: `G06_adaptive_learning/src/component/adminHome/goalPanel/GoalTab.tsx`
- Modify: `G06_adaptive_learning/src/component/adminHome/Adminhome.tsx`

**Interfaces:**
- Consumes: `goalController` (Task 5), `GoalFormModal` (Task 6), `GoalViewModal` (Task 7).
- Produces: `GoalTab` default export, mounted into `Adminhome.tsx`'s tab-switching UI under the `"goals"` key.

- [ ] **Step 1: Write `GoalTab.tsx`**

```tsx
import {
  FaBullseye,
  FaMagnifyingGlass,
  FaPlus,
  FaEye,
  FaPen,
  FaToggleOff,
  FaToggleOn,
} from "react-icons/fa6";
import GoalFormModal from "./component/GoalFormModal";
import GoalViewModal from "./component/GoalViewModal";
import { goalController } from "./goal.controller";

export default function GoalTab() {
  const {
    goals,
    isLoading,
    error,
    goalSearch,
    setGoalSearch,
    filteredGoals,
    activeSkills,
    getStatusColor,

    isFormOpen,
    editingGoal,
    isSaving,
    formError,
    openCreateForm,
    openEditForm,
    closeForm,
    saveGoal,

    viewingGoal,
    openView,
    closeView,

    toggleGoalStatus,
  } = goalController();

  return (
    <div className="ad-tab-goals">
      <div className="ad-page-header">
        <h1 className="ad-page-title"><FaBullseye /> จัดการ Goal</h1>
        <span className="ad-page-sub">Goal ทั้งหมด {goals.length} รายการ</span>
      </div>

      <div className="ad-toolbar">
        <div className="ad-search-wrap">
          <span className="ad-search-icon"><FaMagnifyingGlass /></span>
          <input
            className="ad-search"
            placeholder="ค้นหาชื่อ Goal..."
            value={goalSearch}
            onChange={(e) => setGoalSearch(e.target.value)}
          />
        </div>
        <button className="ad-btn-primary ad-btn-add" onClick={openCreateForm}>
          <FaPlus /> เพิ่ม Goal ใหม่
        </button>
      </div>

      {error && (
        <div style={{ color: "#dc2626", fontSize: 13, fontWeight: 600, margin: "8px 0" }}>
          {error}
        </div>
      )}

      <div className="ad-card">
        <table className="ad-table">
          <thead>
            <tr>
              <th>Goal</th>
              <th>สถานะ</th>
              <th>Skill Require</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={4} style={{ textAlign: "center", padding: 24 }}>
                  กำลังโหลด...
                </td>
              </tr>
            ) : filteredGoals.length === 0 ? (
              <tr>
                <td colSpan={4} style={{ textAlign: "center", padding: 24 }}>
                  ไม่พบ Goal ที่ตรงกับเงื่อนไข
                </td>
              </tr>
            ) : (
              filteredGoals.map((g) => (
                <tr key={g.id}>
                  <td>
                    <span className="ad-skill-name">{g.goal}</span>
                  </td>
                  <td>
                    <span className="ad-status-dot" style={{ background: getStatusColor(g.status) }} />
                    <span className="ad-muted">{g.status}</span>
                  </td>
                  <td>
                    <div className="ad-req-tags">
                      {!g.goalSkillRequire || g.goalSkillRequire.length === 0 ? (
                        <span className="ad-muted">—</span>
                      ) : (
                        g.goalSkillRequire.map((r) => (
                          <span key={r.skillId} className="ad-req-tag">
                            {r.skill?.skillsName || `#${r.skillId}`}
                          </span>
                        ))
                      )}
                    </div>
                  </td>
                  <td>
                    <div className="ad-action-btns">
                      <button className="ad-btn-sm ad-btn-view" onClick={() => openView(g)}>
                        <FaEye /> ดู
                      </button>
                      <button className="ad-btn-sm ad-btn-view" onClick={() => openEditForm(g)}>
                        <FaPen /> แก้ไข
                      </button>
                      <button className="ad-btn-sm ad-btn-toggle" onClick={() => toggleGoalStatus(g)}>
                        {g.status === "active" ? (
                          <>
                            <FaToggleOff /> ระงับ
                          </>
                        ) : (
                          <>
                            <FaToggleOn /> เปิด
                          </>
                        )}
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <GoalFormModal
        isOpen={isFormOpen}
        editingGoal={editingGoal}
        activeSkills={activeSkills}
        isSaving={isSaving}
        formError={formError}
        onSave={saveGoal}
        onClose={closeForm}
      />

      <GoalViewModal
        goal={viewingGoal}
        onClose={closeView}
        onEdit={(g) => {
          closeView();
          openEditForm(g);
        }}
      />
    </div>
  );
}
```

- [ ] **Step 2: Wire into `Adminhome.tsx`**

Add the import (alongside the other tab imports):

```ts
import GoalTab from "./goalPanel/GoalTab";
```

Add `FaBullseye` to the `react-icons/fa6` import list at the top of the file.

Add a `"goals"` entry to the `TABS` array (after the `"skills"` entry):

```ts
const TABS = [
  { key: "summary", icon: <FaChartPie />, label: "สรุปภาพรวม" },
  { key: "users", icon: <FaUsers />, label: "ผู้ใช้งาน" },
  { key: "skills", icon: <FaTree />, label: "จัดการ Skill" },
  { key: "goals", icon: <FaBullseye />, label: "จัดการ Goal" },
  { key: "exercises", icon: <FaPenToSquare />, label: "จัดการ Exercise" },
  { key: "history", icon: <FaClipboardList />, label: "ประวัติโจทย์" },
];
```

Add the matching lazy-mount render block (after the `"skills"` block, before `"exercises"`):

```tsx
        {/* ══ GOALS ══ */}
        {visitedTabs.has("goals") && (
          <div style={{ display: activeTab === "goals" ? undefined : "none" }}>
            <GoalTab />
          </div>
        )}
```

- [ ] **Step 3: Type-check**

```bash
cd G06_adaptive_learning
npm run build
```

Expected: succeeds with no TypeScript errors.

- [ ] **Step 4: Manual browser verification**

With the backend running (`npm run start:dev` in `adt-learning/server/app`, per Task 3 Step 6), start the frontend dev server and walk the golden path:

```bash
cd G06_adaptive_learning
npm run dev
```

In the browser, navigate to `/admin/home`:
1. Click the "จัดการ Goal" sidebar tab — the list loads (initially empty or showing any goal created during Task 3's curl smoke test).
2. Click "เพิ่ม Goal ใหม่" — fill in a goal name, description, add 2+ existing active skills with levels via the skill picker, save. Confirm the new row appears in the list with the skill tags.
3. Click "ดู" on that row — confirm name, description, status, skill+level list, and the learning-tree SVG all render. If none of the chosen skills have a prerequisite relationship to each other, the tree should render as a single row of disconnected boxes (still valid — verifies the zero-edges case).
4. Click "แก้ไข" from the view modal — confirm the form pre-fills correctly, change the skill list, save, and confirm the view reflects the update.
5. Click "ระงับ" to toggle status to inactive, confirm the status dot/label updates immediately without a full reload.
6. Edge case: create a goal with zero skill requirements — confirm the view shows "— ไม่มี Skill ที่ต้องใช้ —" and the tree shows "— ยังไม่มี Skill ที่ต้องใช้ —" instead of erroring.

- [ ] **Step 5: Commit**

```bash
git add src/component/adminHome/goalPanel/GoalTab.tsx src/component/adminHome/Adminhome.tsx
git commit -m "feat: add Goal list tab and wire into admin home sidebar"
```

---

## Post-implementation

Update the design spec's status or leave as-is (spec docs are historical artifacts, not living docs). No further follow-up tasks — the "select goal" onboarding flow and `SkillTree.tsx`'s pan/zoom engine were explicitly out of scope per the spec.
