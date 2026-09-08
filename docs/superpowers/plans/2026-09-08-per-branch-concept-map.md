# Per-Branch Concept Map Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move BKT mastery state (`conceptMapState`) off `userprofile` and onto `branch`, so each learning branch (one user pursuing one goal) tracks skill progress independently instead of sharing one user-wide blob.

**Architecture:** `conceptMapState` is a `jsonb` map of `skillId -> { pL, progress, status, attemptCount }`. Today it lives on `userprofile`, so a skill required by two different goals shares one progress value across both branches. Every read/write site (`sessionService.recommendNextSkill` / `.startSession` / `.submitAnswer`, `exerciseService.submitPretest`, `historyService.getBranchSkills` / `.getBranchStats`) already has the owning `Branch` entity loaded in scope, so the move is a mechanical relocation — no new queries, and three redundant `userprofile` lookups disappear along the way. The REST contract is unchanged: the frontend never reads the raw blob, only the derived per-branch responses from `/branch/:branchId/skills`, `/branch/:branchId/stats`, `/branch/:branchId/recommendation`.

**Tech Stack:** NestJS 11, TypeORM (Postgres/Supabase, `synchronize: false` — migrations only), Jest + `@nestjs/testing`.

## Global Constraints

- All work happens in `adt-learning/server/app`. The frontend repo (`G06_adaptive_learning`) is **not** touched by this plan.
- `synchronize` is always `false` — every schema change is an explicit migration file in `src/migrations/`.
- **🚫 NEVER touch the production database. `.env.dev` only.** `src/config/env-file.ts` picks the file by `NODE_ENV`: `production` → `.env.prod`, anything else → `.env.dev`. Every migration, backfill and smoke-test step in this plan must run with `NODE_ENV` explicitly set to `development`, so the shell cannot inherit a stale `NODE_ENV=production` from an earlier command. Do not run `migration:run`, the backfill, or `start:dev` against `.env.prod` at any point in this plan — migrating prod is a separate, owner-approved deployment step outside this plan's scope.
- **Consequence of dev-only migration:** once Task 2 lands, the code reads `branch."conceptMapState"`, a column that will not exist in the prod database until someone migrates it. The app will therefore fail against `.env.prod` (`column branch.conceptMapState does not exist`) until that deployment happens. This is expected; flag it to whoever owns the prod deploy rather than "fixing" it by migrating prod from here.
- The `.env.dev` database is **live and fully migrated** as of 2026-09-08 (verified with `migration:show`; last applied migration `AddExerciseCode1789000000000`). The claim at `project/CLAUDE.md:108` that the dev Supabase project is dead (`tenant/user ... not found`) is stale — Task 6 corrects it.
- The global `ValidationPipe` in `main.ts` is commented out — `class-validator` decorators are inert. Do not add validation via decorators; this plan adds none.
- `MasteryState` (`src/libs/bkt/masteryState.ts`) is the only place that builds a `ConceptMapEntry`. Never hand-roll `{ pL, progress, status, attemptCount }` objects.
- Migration timestamps must be greater than the current latest file, `1789000000000-AddExerciseCode.ts`. This plan uses `1789100000000` (Task 1) and `1789200000000` (Task 6).
- Commit after every task. Run `npm test` from `adt-learning/server/app` before each commit.
- `strengthWeaknessMatrix` stays on `userprofile` and is **out of scope** — do not touch it.

## File Structure

**Created:**
- `src/migrations/1789100000000-AddConceptMapStateToBranch.ts` — adds `branch."conceptMapState" jsonb`.
- `src/service/session.service.spec.ts` — proves `recommendNextSkill` reads per-branch state.
- `src/seeds/backfill-branch-concept-map-state.seed.ts` — one-time per-branch backfill from `history`.
- `src/migrations/1789200000000-DropConceptMapStateFromUserprofile.ts` — drops the old column.

**Modified:**
- `src/entity/branch.entity.ts` — gains the `conceptMapState` column.
- `src/service/history.service.ts` — read side; drops its `Userprofile` repository dependency.
- `src/service/history.service.spec.ts` — mocks branch state instead of user state.
- `src/service/session.service.ts` — three methods; drops its `Userprofile` repository dependency.
- `src/service/exercise.service.ts` — `submitPretest` writes to the branch.
- `src/service/exercise.service.spec.ts` — new `submitPretest` describe block.
- `src/entity/userprofile.entity.ts`, `src/dto/userprofile.dto.ts` — lose `conceptMapState`.
- `package.json` — backfill script entry.
- `CLAUDE.md`, `GEMINI.md` (both in `adt-learning/` and in the parent `project/` folder) — data-model docs.

**Deleted:**
- `src/seeds/backfill-concept-map-state.seed.ts` — superseded by the per-branch version.

**Not touched:** `src/libs/bkt/masteryState.ts` (already generic over `ConceptMapState`), `src/app.module.ts` (dropping a constructor param needs no module change — `Userprofile` stays registered for `user.service` / `auth.service`), any file under `G06_adaptive_learning/`, and the historical planning artifacts under `.opencode/docs/` and `_bmad-output/`.

---

### Task 1: Add `conceptMapState` to the Branch entity

**Files:**
- Create: `adt-learning/server/app/src/migrations/1789100000000-AddConceptMapStateToBranch.ts`
- Modify: `adt-learning/server/app/src/entity/branch.entity.ts:27-28`

**Interfaces:**
- Consumes: `ConceptMapState` from `src/libs/bkt/masteryState.ts` — `Record<string, ConceptMapEntry>` where `ConceptMapEntry = { pL: number; progress: number; status: string; attemptCount: number }`.
- Produces: `Branch.conceptMapState: ConceptMapState | null` — every later task reads and writes this property; it is `null` for branches that have never been backfilled or practised.

- [ ] **Step 1: Add the column to the entity**

In `src/entity/branch.entity.ts`, add this import below the existing `import { History } from './history.entity';` line:

```ts
import { ConceptMapState } from '../libs/bkt/masteryState';
```

Then insert this property immediately after the `isAlreadyPretest` column (currently line 26-27):

```ts
  // BKT mastery for THIS branch only (skillId -> ConceptMapEntry). Deliberately
  // per-branch and not per-user: the same skill can be required by two different
  // goals, and progress made under one goal must not leak into the other.
  @Column({ name: 'conceptMapState', type: 'jsonb', nullable: true })
  conceptMapState: ConceptMapState | null;
```

- [ ] **Step 2: Write the migration**

Create `src/migrations/1789100000000-AddConceptMapStateToBranch.ts`:

```ts
import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddConceptMapStateToBranch1789100000000
  implements MigrationInterface
{
  name = 'AddConceptMapStateToBranch1789100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "branch" ADD "conceptMapState" jsonb`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "branch" DROP COLUMN "conceptMapState"`,
    );
  }
}
```

- [ ] **Step 3: Verify it compiles and nothing regressed**

Run from `adt-learning/server/app`:

```bash
npm run build && npm test
```

Expected: build succeeds; the existing Jest suites (`branch.service.spec.ts`, `goal.service.spec.ts`, `exercise.service.spec.ts`, `history.service.spec.ts`, plus the `libs/llm` specs) all pass. Nothing reads the new column yet, so no test should change behaviour.

- [ ] **Step 4: Run the migration**

Dev database only. In PowerShell, from `adt-learning/server/app` — set `NODE_ENV` explicitly so the shell cannot inherit `production` from an earlier command:

```bash
$env:NODE_ENV="development"; npm run migration:run
```

Expected output contains: `Migration AddConceptMapStateToBranch1789100000000 has been executed successfully.`

Sanity-check the target before running if you are unsure which database the shell is pointed at (read-only, prints migration names only):

```bash
$env:NODE_ENV="development"; npx typeorm-ts-node-commonjs migration:show -d src/config/data-source.ts
```

- [ ] **Step 5: Commit**

```bash
git add src/entity/branch.entity.ts src/migrations/1789100000000-AddConceptMapStateToBranch.ts
git commit -m "feat: add per-branch conceptMapState column"
```

---

### Task 2: Read the concept map from the branch (history.service)

**Files:**
- Modify: `adt-learning/server/app/src/service/history.service.ts:18-19,26-34,36-41,105-143,145-158`
- Test: `adt-learning/server/app/src/service/history.service.spec.ts` (full rewrite)

**Interfaces:**
- Consumes: `Branch.conceptMapState` (Task 1).
- Produces: `historyService` constructor signature drops its 4th parameter — it now takes only the `History`, `Branch` and `Skill` repositories. The private helper `loadConceptMapState(userId)` is deleted; call sites read `branch.conceptMapState ?? {}` directly. `getBranchSkills` / `getBranchStats` keep their exact current signatures and response shapes.

- [ ] **Step 1: Rewrite the failing test**

Replace the entire contents of `src/service/history.service.spec.ts` with:

```ts
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { historyService } from './history.service';
import { History } from 'src/entity/history.entity';
import { Branch } from 'src/entity/branch.entity';
import { Skill } from 'src/entity/skill.entity';

describe('historyService conceptMapState-driven read side', () => {
  let service: historyService;
  let branchRepo: { findOne: jest.Mock };
  let skillRepo: { find: jest.Mock };
  let historyRepo: { find: jest.Mock };

  const goal = { goalSkillRequire: [{ skillId: 1 }, { skillId: 2 }] };

  // Two branches of the SAME user, requiring the SAME skills, with different
  // mastery — progress must not leak from one branch into the other.
  const practisedBranch = {
    id: 1,
    userId: 42,
    goal,
    conceptMapState: {
      '1': { pL: 0.96, progress: 100, status: 'completed', attemptCount: 5 },
      '2': { pL: 0.1, progress: 11, status: 'unlocked', attemptCount: 0 },
    },
  };
  const freshBranch = { id: 2, userId: 42, goal, conceptMapState: {} };

  const skills = [
    {
      skillId: 1,
      skillCode: 'SK1',
      skillsName: 'Skill 1',
      tier: 'T1',
      status: 'active',
      pL0: 0.25,
      skillPrequisite: [],
    },
    {
      skillId: 2,
      skillCode: 'SK2',
      skillsName: 'Skill 2',
      tier: 'T2',
      status: 'active',
      pL0: 0.25,
      skillPrequisite: [
        { skillId: 2, prerequisiteSkillId: 1, prerequisiteLevel: 1 },
      ],
    },
  ];

  beforeEach(async () => {
    branchRepo = {
      findOne: jest.fn(({ where }: any) =>
        Promise.resolve(where.id === 1 ? practisedBranch : freshBranch),
      ),
    };
    skillRepo = { find: jest.fn().mockResolvedValue(skills) };
    historyRepo = { find: jest.fn().mockResolvedValue([]) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        historyService,
        { provide: getRepositoryToken(History), useValue: historyRepo },
        { provide: getRepositoryToken(Branch), useValue: branchRepo },
        { provide: getRepositoryToken(Skill), useValue: skillRepo },
      ],
    }).compile();

    service = module.get<historyService>(historyService);
  });

  it('getBranchSkills reports progress and attemptCount from the branch conceptMapState', async () => {
    const result = await service.getBranchSkills(1, 42);
    const skill1 = result.find((s) => s.skillId === 1);
    const skill2 = result.find((s) => s.skillId === 2);
    expect(skill1.progressPercent).toBe(100);
    expect(skill1.attemptCount).toBe(5);
    expect(skill2.progressPercent).toBe(11);
    expect(skill2.attemptCount).toBe(0); // not-started, even though pL > 0
  });

  it('getBranchSkills does not leak progress from another branch of the same user', async () => {
    const result = await service.getBranchSkills(2, 42);
    const skill1 = result.find((s) => s.skillId === 1);
    // Branch 1 mastered skill 1; branch 2 must still fall back to skill.pL0.
    expect(skill1.attemptCount).toBe(0);
    expect(skill1.progressPercent).toBe(
      Math.min(100, Math.round((0.25 / 0.95) * 100)),
    );
  });

  it('getBranchStats counts a skill as unlocked only when every prerequisite has pL >= 0.95', async () => {
    const stats = await service.getBranchStats(1, 42);
    // skill 1 has no prereqs -> unlocked; skill 2's prereq (1) is at pL 0.96 -> unlocked too
    expect(stats.skillsUnlockedCount).toBe(2);
  });

  it('getBranchStats does not count a skill as unlocked when its prerequisite is below threshold in that branch', async () => {
    const stats = await service.getBranchStats(2, 42);
    expect(stats.skillsUnlockedCount).toBe(1); // only skill 1 (no prereqs)
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npx jest src/service/history.service.spec.ts
```

Expected: FAIL. Nest cannot construct `historyService` because it still injects the `Userprofile` repository, which the module no longer provides — the error names `UserprofileRepository` as an unresolved dependency.

- [ ] **Step 3: Make the service read the branch**

In `src/service/history.service.ts`:

1. Delete the `Userprofile` import (line 18) — `import { Userprofile } from 'src/entity/userprofile.entity';`
2. Delete the 4th constructor parameter:

```ts
    @InjectRepository(Userprofile)
    private readonly userprofileRepository: Repository<Userprofile>,
```

3. Delete the whole `loadConceptMapState` helper:

```ts
  private async loadConceptMapState(userId: number): Promise<ConceptMapState> {
    const userprofile = await this.userprofileRepository.findOne({
      where: { id: userId },
    });
    return userprofile?.conceptMapState ?? {};
  }
```

4. In `getBranchSkills`, replace the second line of the method body:

```ts
    const conceptMapState = await this.loadConceptMapState(userId);
```

with:

```ts
    const conceptMapState: ConceptMapState = branch.conceptMapState ?? {};
```

5. In `getBranchStats`, make the identical replacement (same two lines).

`ConceptMapState` is already imported on line 19 (`import { MasteryState, ConceptMapState } from 'src/libs/bkt/masteryState';`) — keep that import.

- [ ] **Step 4: Run the tests to verify they pass**

```bash
npx jest src/service/history.service.spec.ts
```

Expected: PASS, 4 tests.

Then the whole suite:

```bash
npm test
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/service/history.service.ts src/service/history.service.spec.ts
git commit -m "refactor: read concept map from branch in history service"
```

---

### Task 3: Write the concept map to the branch (session.service)

**Files:**
- Modify: `adt-learning/server/app/src/service/session.service.ts:15,54-55,83-133,168-213,215-330`
- Test (create): `adt-learning/server/app/src/service/session.service.spec.ts`

**Interfaces:**
- Consumes: `Branch.conceptMapState` (Task 1); `MasteryState.buildEntry(pL: number, attemptCount: number): ConceptMapEntry` and `MasteryState.getEntry(state, skillId, fallbackPL0): ConceptMapEntry` (unchanged).
- Produces: `sessionService` constructor drops its `Userprofile` repository parameter (it becomes: `Branch`, `Skill`, `Exercise`, `Session`, `SessionAndExercise`, `History` repositories, then `DataSource`, then `ktService`). `recommendNextSkill(branchId, userId)` keeps returning `RecommendedSkillDto | null`; `startSession` and `submitAnswer` keep their existing signatures and response DTOs.

- [ ] **Step 1: Write the failing test**

Create `src/service/session.service.spec.ts`:

```ts
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { sessionService } from './session.service';
import { ktService } from './kt.service';
import { Branch } from 'src/entity/branch.entity';
import { Skill } from 'src/entity/skill.entity';
import { Exercise } from 'src/entity/exerciseAndSession/exercise.entity';
import { Session } from 'src/entity/exerciseAndSession/session.entity';
import { SessionAndExercise } from 'src/entity/exerciseAndSession/sessionAndExercise.entity';
import { History } from 'src/entity/history.entity';

describe('sessionService.recommendNextSkill reads per-branch mastery', () => {
  let service: sessionService;
  let branchRepo: { findOne: jest.Mock };
  let skillRepo: { find: jest.Mock };

  const goal = { goalSkillRequire: [{ skillId: 1 }, { skillId: 2 }] };

  // Same user, same goal skills, two branches at different points.
  const practisedBranch = {
    id: 1,
    userId: 42,
    goal,
    conceptMapState: {
      '1': { pL: 0.96, progress: 100, status: 'completed', attemptCount: 5 },
    },
  };
  const freshBranch = { id: 2, userId: 42, goal, conceptMapState: null };

  const skills = [
    {
      skillId: 1,
      skillCode: 'SK1',
      skillsName: 'Skill 1',
      tier: 'T1',
      pL0: 0.25,
      pT: 0.1,
      skillPrequisite: [],
    },
    {
      skillId: 2,
      skillCode: 'SK2',
      skillsName: 'Skill 2',
      tier: 'T2',
      pL0: 0.25,
      pT: 0.1,
      skillPrequisite: [
        { skillId: 2, prerequisiteSkillId: 1, prerequisiteLevel: 1 },
      ],
    },
  ];

  beforeEach(async () => {
    branchRepo = {
      findOne: jest.fn(({ where }: any) =>
        Promise.resolve(where.id === 1 ? practisedBranch : freshBranch),
      ),
    };
    skillRepo = { find: jest.fn().mockResolvedValue(skills) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        sessionService,
        { provide: getRepositoryToken(Branch), useValue: branchRepo },
        { provide: getRepositoryToken(Skill), useValue: skillRepo },
        { provide: getRepositoryToken(Exercise), useValue: {} },
        { provide: getRepositoryToken(Session), useValue: {} },
        { provide: getRepositoryToken(SessionAndExercise), useValue: {} },
        { provide: getRepositoryToken(History), useValue: {} },
        { provide: DataSource, useValue: {} },
        { provide: ktService, useValue: {} },
      ],
    }).compile();

    service = module.get<sessionService>(sessionService);
  });

  it('recommends the follow-on skill for a branch that mastered the prerequisite', async () => {
    const result = await service.recommendNextSkill(1, 42);
    expect(result?.skillId).toBe(2);
  });

  it('recommends the prerequisite skill for a branch with no progress yet', async () => {
    // Proves branch 1's mastery of skill 1 does not unlock skill 2 here.
    const result = await service.recommendNextSkill(2, 42);
    expect(result?.skillId).toBe(1);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npx jest src/service/session.service.spec.ts
```

Expected: FAIL — Nest cannot resolve `sessionService`'s `UserprofileRepository` dependency, which the module does not provide.

- [ ] **Step 3: Make all three methods use the branch**

In `src/service/session.service.ts`:

1. Delete the `Userprofile` import (line 15): `import { Userprofile } from 'src/entity/userprofile.entity';`
2. Delete the constructor parameter:

```ts
    @InjectRepository(Userprofile)
    private readonly userprofileRepository: Repository<Userprofile>,
```

3. In `recommendNextSkill`, replace:

```ts
    const userprofile = await this.userprofileRepository.findOne({
      where: { id: userId },
    });
    const conceptMapState: ConceptMapState = userprofile?.conceptMapState ?? {};
```

with:

```ts
    const conceptMapState: ConceptMapState = branch.conceptMapState ?? {};
```

4. In `startSession`, replace the identical four lines with:

```ts
    const conceptMapState: ConceptMapState = branch.conceptMapState ?? {};
```

5. In `submitAnswer`, replace:

```ts
    const userprofile = await this.userprofileRepository.findOne({
      where: { id: userId },
    });
    const conceptMapState: ConceptMapState = userprofile?.conceptMapState ?? {};
```

with:

```ts
    const branch = session.branch;
    const conceptMapState: ConceptMapState = branch.conceptMapState ?? {};
```

6. Still in `submitAnswer`, inside the `this.dataSource.transaction(...)` callback, replace the trailing block:

```ts
      if (userprofile) {
        const newEntry = MasteryState.buildEntry(
          pLNext,
          currentEntry.attemptCount + 1,
        );
        userprofile.conceptMapState = {
          ...conceptMapState,
          [String(skill.skillId)]: newEntry,
        };
        await manager.save(userprofile);
      }
```

with:

```ts
      branch.conceptMapState = {
        ...conceptMapState,
        [String(skill.skillId)]: MasteryState.buildEntry(
          pLNext,
          currentEntry.attemptCount + 1,
        ),
      };
      await manager.save(branch);
```

`session` is already loaded with `relations: { branch: true }`, so `session.branch` is a full entity — saving it persists the new state. The `recommendNextSkill(session.branchId, userId)` call later in the method re-reads the branch after the transaction commits, so it sees the update.

- [ ] **Step 4: Run the tests to verify they pass**

```bash
npx jest src/service/session.service.spec.ts
```

Expected: PASS, 2 tests.

```bash
npm run build && npm test
```

Expected: build succeeds (no dangling `userprofile` references in `session.service.ts`), full suite passes.

- [ ] **Step 5: Commit**

```bash
git add src/service/session.service.ts src/service/session.service.spec.ts
git commit -m "refactor: track session mastery per branch"
```

---

### Task 4: Seed pretest mastery onto the branch (exercise.service)

**Files:**
- Modify: `adt-learning/server/app/src/service/exercise.service.ts:130-158`
- Test: `adt-learning/server/app/src/service/exercise.service.spec.ts` (append a new describe block)

**Interfaces:**
- Consumes: `Branch.conceptMapState` (Task 1); `PretestMasteryCalculator.computePL0(expForGoal, tierNum, stats, profile)` and `MasteryState.buildEntry` (both unchanged).
- Produces: `submitPretest(userId: number, dto: PretestSubmitDto): Promise<void>` — same signature; it now writes `branch.conceptMapState` and leaves `userprofile` untouched. `PretestSubmitDto` is `{ branchId: number; answers: { exerciseId: number; isCorrect: boolean; startTime: string; endTime: string; chosenAnswer?: string }[] }`.

- [ ] **Step 1: Write the failing test**

Append this to the end of `src/service/exercise.service.spec.ts` (outside the existing `describe`), and add these imports at the top of the file:

```ts
import { Branch } from 'src/entity/branch.entity';
import { Userprofile } from 'src/entity/userprofile.entity';
import { PretestSubmitDto } from 'src/dto/exerciseAndSession/pretestSubmit.dto';
```

```ts
describe('exerciseService.submitPretest', () => {
  let service: exerciseService;
  let branch: any;
  let userprofile: any;

  const dto: PretestSubmitDto = {
    branchId: 7,
    answers: [
      {
        exerciseId: 100,
        isCorrect: true,
        chosenAnswer: '2',
        startTime: '2026-01-01T00:00:00.000Z',
        endTime: '2026-01-01T00:00:20.000Z',
      },
    ],
  };

  beforeEach(async () => {
    branch = {
      id: 7,
      userId: 42,
      goalId: 3,
      expForGoal: 3,
      isAlreadyPretest: false,
      conceptMapState: null,
    };
    userprofile = { id: 42, year: 1, major: { isAboutCs: false } };

    const exerciseRepoInTx = {
      find: jest.fn(() =>
        Promise.resolve([{ id: 100, skillId: 1, expectTime: 30 }]),
      ),
    };
    const goalSkillRequireRepoInTx = {
      find: jest.fn(() => Promise.resolve([{ goalId: 3, skillId: 1 }])),
    };
    const skillRepoInTx = {
      find: jest.fn(() =>
        Promise.resolve([{ skillId: 1, tier: 'T1', pL0: 0.25 }]),
      ),
    };

    let nextId = 0;
    const manager = {
      findOne: jest.fn((entity: any) =>
        Promise.resolve(entity === Branch ? branch : userprofile),
      ),
      create: jest.fn((_entity: any, data: any) => ({ ...(data ?? {}) })),
      save: jest.fn((entity: any) => {
        if (entity && entity.id === undefined) entity.id = ++nextId;
        return Promise.resolve(entity);
      }),
      getRepository: jest.fn((entity: any) => {
        if (entity === Exercise) return exerciseRepoInTx;
        if (entity === GoalSkillRequire) return goalSkillRequireRepoInTx;
        return skillRepoInTx;
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        exerciseService,
        { provide: getRepositoryToken(Exercise), useValue: {} },
        { provide: getRepositoryToken(Goal), useValue: {} },
        { provide: getRepositoryToken(GoalSkillRequire), useValue: {} },
        { provide: getRepositoryToken(Skill), useValue: {} },
        {
          provide: DataSource,
          useValue: { transaction: jest.fn((cb: any) => cb(manager)) },
        },
      ],
    }).compile();

    service = module.get<exerciseService>(exerciseService);
  });

  it('writes pretest mastery into the branch, not the user profile', async () => {
    await service.submitPretest(42, dto);

    expect(branch.conceptMapState['1']).toEqual(
      expect.objectContaining({ attemptCount: 1 }),
    );
    expect(branch.conceptMapState['1'].pL).toBeGreaterThan(0);
    expect(userprofile.conceptMapState).toBeUndefined();
    expect(branch.isAlreadyPretest).toBe(true);
  });

  it('never clobbers an existing entry in the branch state', async () => {
    branch.conceptMapState = {
      '1': { pL: 0.8, progress: 84, status: 'unlocked', attemptCount: 9 },
    };

    await service.submitPretest(42, dto);

    expect(branch.conceptMapState['1'].pL).toBe(0.8);
    expect(branch.conceptMapState['1'].attemptCount).toBe(9);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npx jest src/service/exercise.service.spec.ts -t "submitPretest"
```

Expected: FAIL on the first test — `branch.conceptMapState` is still `null` because the service writes the entry onto `userprofile.conceptMapState` instead (the assertion on `branch.conceptMapState['1']` throws on reading a property of `null`).

- [ ] **Step 3: Point `submitPretest` at the branch**

In `src/service/exercise.service.ts`, first widen the `masteryState` import on line 31 from:

```ts
import { MasteryState } from 'src/libs/bkt/masteryState';
```

to:

```ts
import { MasteryState, ConceptMapState } from 'src/libs/bkt/masteryState';
```

(`newEntries` must be typed as `ConceptMapState`, not `Record<string, unknown>` — `branch.conceptMapState` is `ConceptMapState | null`, and spreading an `unknown`-valued record into it is a compile error.)

Then, inside `submitPretest`, replace this block:

```ts
      if (userprofile) {
        const profileFactors = {
          isAboutCs: userprofile.major?.isAboutCs ?? false,
          year: userprofile.year ?? null,
        };
        const existingState = userprofile.conceptMapState ?? {};
        const newEntries: Record<string, unknown> = {};

        for (const skill of goalSkills) {
          if (existingState[String(skill.skillId)]) continue; // never clobber
          const stats = statsBySkill.get(skill.skillId) ?? [];
          const pL0 = PretestMasteryCalculator.computePL0(
            branch.expForGoal,
            SkillTier.tierNum(skill.tier),
            stats,
            profileFactors,
          );
          newEntries[String(skill.skillId)] = MasteryState.buildEntry(
            pL0,
            stats.length,
          );
        }

        userprofile.conceptMapState = { ...existingState, ...newEntries };
        await manager.save(userprofile);
      }

      branch.isAlreadyPretest = true;
      await manager.save(branch);
```

with:

```ts
      if (userprofile) {
        const profileFactors = {
          isAboutCs: userprofile.major?.isAboutCs ?? false,
          year: userprofile.year ?? null,
        };
        const existingState: ConceptMapState = branch.conceptMapState ?? {};
        const newEntries: ConceptMapState = {};

        for (const skill of goalSkills) {
          if (existingState[String(skill.skillId)]) continue; // never clobber
          const stats = statsBySkill.get(skill.skillId) ?? [];
          const pL0 = PretestMasteryCalculator.computePL0(
            branch.expForGoal,
            SkillTier.tierNum(skill.tier),
            stats,
            profileFactors,
          );
          newEntries[String(skill.skillId)] = MasteryState.buildEntry(
            pL0,
            stats.length,
          );
        }

        branch.conceptMapState = { ...existingState, ...newEntries };
      }

      branch.isAlreadyPretest = true;
      await manager.save(branch);
```

The `userprofile` lookup stays — it is still needed for `profileFactors` (`major.isAboutCs`, `year`). Only the state write moves, and the separate `manager.save(userprofile)` disappears because the existing `manager.save(branch)` at the end now persists both fields in one write.

- [ ] **Step 4: Run the tests to verify they pass**

```bash
npx jest src/service/exercise.service.spec.ts
```

Expected: PASS — the 8 pre-existing `createExercise` tests plus the 2 new `submitPretest` tests.

```bash
npm test
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/service/exercise.service.ts src/service/exercise.service.spec.ts
git commit -m "refactor: seed pretest mastery onto the branch"
```

---

### Task 5: Backfill existing branches from history

**Files:**
- Create: `adt-learning/server/app/src/seeds/backfill-branch-concept-map-state.seed.ts`
- Delete: `adt-learning/server/app/src/seeds/backfill-concept-map-state.seed.ts`
- Modify: `adt-learning/server/app/package.json:23`

**Interfaces:**
- Consumes: `Branch.conceptMapState` (Task 1); `MasteryState.buildEntry(pL, attemptCount)`; the `history` / `sessionAndExercise` / `exercise` / `skill` tables.
- Produces: a runnable script, `npm run backfill:branch-concept-map`. It is idempotent by construction: it only touches branches whose `conceptMapState` is `NULL` or `{}`.

**Why this exists:** every existing branch currently shows progress that came from the user-wide blob. After Tasks 1–4 those branches read `NULL` and would appear reset to zero. This rebuilds each branch's state from that branch's own `history` rows. `history."pL"` holds the pL the BKT engine actually returned for each practice attempt, so the latest one per (branch, skill) is exact; pretest rows have `pL = NULL`, so those skills fall back to the same blend-the-prior heuristic the old per-user script used.

- [ ] **Step 1: Write the backfill script**

Create `src/seeds/backfill-branch-concept-map-state.seed.ts`:

```ts
import { Logger } from '@nestjs/common';
import dataSource from 'src/config/data-source';
import { MasteryState } from 'src/libs/bkt/masteryState';

interface BranchSkillRow {
  branch_id: number;
  skill_id: number;
  pl0: number;
  total: string;
  correct: string;
  latest_pl: number | null;
}

async function backfillBranchConceptMapState() {
  Logger.log('Starting per-branch conceptMapState backfill...');
  const db = await dataSource.initialize();

  try {
    const rows: BranchSkillRow[] = await db.query(`
      SELECT
        b.id AS branch_id,
        e.skill_id AS skill_id,
        s."pL0" AS pl0,
        COUNT(*)::text AS total,
        SUM(CASE WHEN h."isCorrect" THEN 1 ELSE 0 END)::text AS correct,
        (ARRAY_AGG(h."pL" ORDER BY h.id DESC)
           FILTER (WHERE h."pL" IS NOT NULL))[1] AS latest_pl
      FROM branch b
      JOIN history h ON h."branchId" = b.id
      JOIN "sessionAndExercise" se ON h."sessionAndExerciseId" = se.id
      JOIN exercise e ON se."exerciseId" = e.id
      JOIN skill s ON e.skill_id = s.skill_id
      WHERE b."conceptMapState" IS NULL OR b."conceptMapState" = '{}'::jsonb
      GROUP BY b.id, e.skill_id, s."pL0"
      ORDER BY b.id
    `);

    const stateByBranch = new Map<number, Record<string, unknown>>();

    for (const row of rows) {
      const total = Number(row.total);
      const correct = Number(row.correct);
      const accuracy = total > 0 ? correct / total : 0;
      // Prefer the pL the BKT engine actually produced for this branch's most
      // recent attempt on this skill. Pretest rows carry no pL, so those skills
      // fall back to blending the population prior with observed accuracy,
      // capped below the mastery threshold — an approximation for display
      // continuity, not a real BKT re-derivation (that would mean replaying
      // every attempt through /kt/attempt in order).
      const pL =
        row.latest_pl === null || row.latest_pl === undefined
          ? Math.min(0.94, row.pl0 + accuracy * (0.94 - row.pl0))
          : Number(row.latest_pl);

      const state = stateByBranch.get(row.branch_id) ?? {};
      state[String(row.skill_id)] = MasteryState.buildEntry(pL, total);
      stateByBranch.set(row.branch_id, state);
    }

    Logger.log(`Found ${stateByBranch.size} branch(es) needing backfill`);

    for (const [branchId, state] of stateByBranch) {
      await db.query(`UPDATE branch SET "conceptMapState" = $1 WHERE id = $2`, [
        JSON.stringify(state),
        branchId,
      ]);
      Logger.log(
        `Backfilled branch ${branchId}: ${Object.keys(state).length} skill(s)`,
      );
    }

    Logger.log('✅ per-branch conceptMapState backfill completed successfully!');
  } catch (error: any) {
    Logger.error('❌ per-branch conceptMapState backfill failed:', error.message);
    process.exitCode = 1;
  } finally {
    await db.destroy();
  }
}

backfillBranchConceptMapState();
```

- [ ] **Step 2: Replace the old script and its npm entry**

Delete `src/seeds/backfill-concept-map-state.seed.ts` — it writes to `userprofile.conceptMapState`, which Task 6 removes.

In `package.json`, replace line 23:

```json
    "backfill:concept-map": "npm run build && node dist/seeds/backfill-concept-map-state.seed.js",
```

with:

```json
    "backfill:branch-concept-map": "npm run build && node dist/seeds/backfill-branch-concept-map-state.seed.js",
```

- [ ] **Step 3: Verify it compiles**

```bash
npm run build && npm test
```

Expected: build succeeds (no imports left pointing at the deleted seed), full suite passes.

- [ ] **Step 4: Run the backfill**

Dev database only, same as Task 1. From `adt-learning/server/app` in PowerShell:

```bash
$env:NODE_ENV="development"; npm run backfill:branch-concept-map
```

Expected: a `Found N branch(es) needing backfill` line, then one `Backfilled branch <id>: <n> skill(s)` line per branch, then `✅ per-branch conceptMapState backfill completed successfully!`. `N` may legitimately be 0 if no branch has any `history` rows yet — that is a pass, not a failure.

Optional spot-check in the Supabase SQL editor:

```sql
SELECT id, "userId", "goalId", "conceptMapState" FROM branch ORDER BY id;
```

- [ ] **Step 5: Commit**

```bash
git add src/seeds/backfill-branch-concept-map-state.seed.ts package.json
git rm src/seeds/backfill-concept-map-state.seed.ts
git commit -m "feat: backfill per-branch concept map state from history"
```

---

### Task 6: Drop `conceptMapState` from userprofile and sync the docs

**Files:**
- Modify: `adt-learning/server/app/src/entity/userprofile.entity.ts:70-102`
- Modify: `adt-learning/server/app/src/dto/userprofile.dto.ts:57-58,116-117`
- Create: `adt-learning/server/app/src/migrations/1789200000000-DropConceptMapStateFromUserprofile.ts`
- Modify: `adt-learning/CLAUDE.md:68,69,75`, `adt-learning/GEMINI.md:68,69,75`, `project/CLAUDE.md:27,108,127,128`, `project/GEMINI.md:27,121,122`

**Interfaces:**
- Consumes: nothing new. By this point no TypeScript file reads `Userprofile.conceptMapState`; Tasks 2–5 removed the last four references.
- Produces: `Userprofile` without a `conceptMapState` property; `CreateUserprofileDto` / `UpdateUserprofileDto` without the field.

**Ordering:** run this task's migration only *after* Task 5's backfill has run in every environment — the backfill reads `history`, not `userprofile`, so the drop is safe either way, but keeping the old column until the new data is verified leaves a rollback path.

- [ ] **Step 1: Remove the column from the entity**

In `src/entity/userprofile.entity.ts`, delete the `conceptMapState` column together with its example-format comment — everything from:

```ts
  @Column({ name: 'conceptMapState', type: 'jsonb', nullable: true })
  conceptMapState: any;
```

through the end of the commented example block that ends with:

```ts
  //    },
  // }
```

Leave `behaviorScore` above it and `strengthWeaknessMatrix` below it untouched.

- [ ] **Step 2: Remove the field from both DTOs**

In `src/dto/userprofile.dto.ts`, delete these two lines from `CreateUserprofileDto` (currently 57-58):

```ts
  @IsOptional()
  conceptMapState?: any;
```

and the identical two lines from `UpdateUserprofileDto` (currently 116-117). Keep both `strengthWeaknessMatrix` fields.

- [ ] **Step 3: Write the migration**

Create `src/migrations/1789200000000-DropConceptMapStateFromUserprofile.ts`:

```ts
import { MigrationInterface, QueryRunner } from 'typeorm';

export class DropConceptMapStateFromUserprofile1789200000000
  implements MigrationInterface
{
  name = 'DropConceptMapStateFromUserprofile1789200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "userprofile" DROP COLUMN "conceptMapState"`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Restores the column shape only; the per-branch data in
    // branch."conceptMapState" is authoritative and is not copied back.
    await queryRunner.query(
      `ALTER TABLE "userprofile" ADD "conceptMapState" jsonb`,
    );
  }
}
```

- [ ] **Step 4: Verify no references remain**

```bash
npm run build && npm test
```

Expected: build succeeds, full suite passes. A compile error here means a reader was missed in Tasks 2–4 — fix it before continuing.

Also confirm by search (from `adt-learning/server/app`) that the only remaining `conceptMapState` hits are `branch.entity.ts`, the two services, the specs, the seed, `masteryState.ts`, the new migrations, and the two historical migrations (`1783172699382-UpdateSchema.ts`, which created the old column, must **not** be edited — past migrations are immutable).

- [ ] **Step 5: Update the four doc files**

These four files describe the same data model for different tools and are kept in sync. Make the same three edits in each (`adt-learning/CLAUDE.md`, `adt-learning/GEMINI.md`, `project/CLAUDE.md`, `project/GEMINI.md`). Use the Edit/Write tools, **never** `perl -pi`/`sed` — byte-mode rewrites double-encode the Thai text and em-dashes throughout these files.

Edit A — the storage bullet (`adt-learning` line 68 / parent `CLAUDE.md` line 127 / parent `GEMINI.md` line 121). Replace:

> - High-frequency per-action student state (BKT mastery, behavior/Elo history) is **not** stored relationally — it's cached in Redis and flushed as JSON into `userprofile.conceptMapState` / `userprofile.strengthWeaknessMatrix` to avoid write amplification.

with:

> - High-frequency per-action student state (BKT mastery, behavior/Elo history) is **not** stored relationally — it's cached in Redis and flushed as JSON into `branch.conceptMapState` and `userprofile.strengthWeaknessMatrix` to avoid write amplification. **Mastery is per branch, not per user**: the same skill required by two goals tracks progress separately in each branch, so read it from the branch the request is scoped to — never from `userprofile`.

Keep the rest of that bullet (the sentence about curriculum metadata staying relational) unchanged.

Edit B — the unlock-rule bullet (`adt-learning` line 69 / parent `CLAUDE.md` line 128 / parent `GEMINI.md` line 122). Change `in the student's \`conceptMapState\`` to `in that branch's \`conceptMapState\``.

Edit C — the PDPA paragraph (`adt-learning` line 75 / parent line 27). Replace `(\`behaviorScore\`, \`conceptMapState\`, \`strengthWeaknessMatrix\`)` with `(\`behaviorScore\`, \`strengthWeaknessMatrix\`, and \`conceptMapState\` on each of the user's \`branch\` rows)`.

Edit D — ✅ **ALREADY DONE on 2026-09-08, before execution started** (at the repo owner's request). It was applied to `project/CLAUDE.md:108` and mirrored into `project/GEMINI.md` right after the `DATABASE_URL` paragraph, which previously did not carry this note at all. Skip this edit; it is recorded here only so the change is traceable. It replaced:

> **Which `.env` is loaded depends on `NODE_ENV`** (`src/config/env-file.ts`: `production` → `.env.prod`, otherwise `.env.dev`). These currently point at **two different Supabase projects**, and the `.env.dev` one is dead (`tenant/user ... not found`), so `npm run migration:run` fails by default while the running server — started with `NODE_ENV=production` — works fine. Check which one you mean before running a migration.

with:

> **Which `.env` is loaded depends on `NODE_ENV`** (`src/config/env-file.ts`: `production` → `.env.prod`, otherwise `.env.dev`). These point at **two different Supabase projects**, and both are live — the dev one was verified reachable and fully migrated on 2026-09-08 (an older note here claiming it was dead is no longer true). **Migrations and backfills are run against `.env.dev` only**; `.env.prod` is off-limits unless the repo owner explicitly asks for a production deploy. Set `NODE_ENV` explicitly (`$env:NODE_ENV="development"`) rather than relying on the default, so a shell that already exported `production` can't send a migration to the wrong database.

Leave `.opencode/docs/` and `_bmad-output/` alone — those are historical planning artifacts, not maintained docs.

- [ ] **Step 6: Run the migration**

Dev database only, and only after Task 5's backfill has been verified.

```bash
$env:NODE_ENV="development"; npm run migration:run
```

Expected output contains: `Migration DropConceptMapStateFromUserprofile1789200000000 has been executed successfully.`

- [ ] **Step 7: Smoke-test the running app**

Start the API against the **dev** database (`$env:NODE_ENV="development"; npm run start:dev`) and the frontend (`cd G06_adaptive_learning; npm run dev`), log in as a student with at least one branch, and confirm on the Home / Skill Tree tabs that:

1. The skill tree renders with progress values (not all zero, assuming that branch has history).
2. Switching branches via the goal dropdown shows that branch's own progress.
3. Answering a question in a session updates the tree for that branch only.

- [ ] **Step 8: Commit**

```bash
git add src/entity/userprofile.entity.ts src/dto/userprofile.dto.ts src/migrations/1789200000000-DropConceptMapStateFromUserprofile.ts ../../CLAUDE.md ../../GEMINI.md
git commit -m "refactor: drop user-wide conceptMapState"
```

(The parent-folder `project/CLAUDE.md` and `project/GEMINI.md` sit outside this git repo and are not committed here — they are edited in place only.)

---

## Rollback

All rollback commands target the dev database — prefix each with `$env:NODE_ENV="development";`, never `production`.

- Before Task 6's migration: `npm run migration:revert` undoes the last applied migration (run it twice to undo Task 6 then Task 1); the old `userprofile.conceptMapState` data is still intact in dev, and `git revert` of the task commits restores the old readers.
- After Task 6's migration: the old column is gone from dev. Recovery is `migration:revert` (which re-adds an empty column) plus reverting the code commits, then re-running the *old* backfill script from git history to repopulate it.
- Prod needs no rollback at any point in this plan — it is never migrated here. Its `userprofile.conceptMapState` column and data stay exactly as they are.
