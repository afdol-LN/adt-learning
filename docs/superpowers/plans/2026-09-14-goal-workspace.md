# Goal Workspace Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a new admin screen ("Goal Workspace") where a whole goal — its skill tree, each skill's exercises, and a readiness checklist — is authored top-down in one place and published in one action, instead of ~31 modals across three tabs.

**Architecture:** Backend adds one pure readiness module (`libs/goal/goalReadiness.ts`), one cycle-detection helper on the existing `SkillGraph`, and one new service (`goalWorkspaceService`) exposed as two admin-only routes on the existing `goal.controller.ts`. Frontend adds a self-contained sub-view inside the existing Goal tab (`goalPanel/workspace/`) following the repo's UI → controller → service split, with the skill tree rendered by **React Flow (`@xyflow/react`)** laid out by the already-installed `dagre`. No new DB table, no migration, no new admin tab.

**Tech Stack:** NestJS 11 + TypeORM (Postgres) + jest on the backend; React 19 + TypeScript + Vite + `@xyflow/react` v12 + `dagre` + react-icons/fa6 on the frontend.

---

## THREE OWNER DECISIONS THAT OVERRIDE THE SPEC

The design spec is `adt-learning/docs/superpowers/specs/2026-09-13-goal-workspace-design.md`. Three of its decisions were reversed by the repo owner after it was written. **This plan wins where they disagree.** When the work is done, annotate those spec sections with a short "superseded by this plan" note rather than rewriting the spec.

### 1. Inactive skills still cannot be linked to a goal

Spec §1 and Decision 4 ("skill ที่ inactive ผูกกับ goal และ exercise ได้ทุกที่") are **dropped**. `goalService.validateSkillRequires` keeps throwing `Skill X is not active`, and `goal.service.ts` / `goal.service.spec.ts` are **not modified by this plan at all**.

Consequences baked into every task below:
- A skill created from inside the workspace is created **`status: active`** (the entity default) — otherwise the very next call, linking it as a required skill, would 400.
- The "confirm before linking an inactive skill to an active goal" dialog from spec §1 does not exist.
- "Draft" means **the goal is `inactive`**, not the skills. Students never see an inactive goal (`goalService.findAll` filters to active), so an inactive goal is a safe drafting surface on its own.
- Publish still activates inactive skills found in the closure, because a *prerequisite* skill can be inactive — `skillService.validatePrerequisites` never checked status and still doesn't.

### 2. The feature is additive — existing admin screens must not change

- **Do not** touch `exercisePanel/exercise.controller.ts`, `goalPanel/goal.controller.ts` or `aiPanel/ai.controller.ts` — their `activeSkills` filters stay.
- **Do not** rename the `activeSkills` prop on `ExerciseFormModal`, `GoalFormModal`, `SkillRequireEditor` or `AiGenerateForm` (spec §1's rename is dropped).
- **Do not** change what any existing tab's dropdown lists, or add an "inactive" tag to them.
- **Do not** refactor `GoalLearningTree.tsx` — spec §2's shared-`layoutTree` extraction is dropped. That component keeps its own dagre + hand-rolled SVG; the workspace tree is a separate React Flow implementation.

Exactly two existing frontend files are edited, both strictly backwards compatible:

1. `ExerciseFormModal.tsx` gains **two optional props** (`lockedSkillId`, `onSaveAndNext`). Every existing call site omits them and renders identically (Task 10).
2. `GoalTab.tsx` gains **one new button per row** plus an if/else that swaps the list for the workspace. Existing buttons, columns, filters and modals stay as they are (Task 11).

### 3. The workspace tree uses React Flow, not hand-rolled SVG

Spec §2's `WorkspaceTree` was a hand-drawn `<svg>`. Instead, add **`@xyflow/react`** (v12) and render the closure as a React Flow graph with custom HTML nodes. `dagre` (already a dependency, already used by `GoalLearningTree`) computes the positions — React Flow ships no auto-layout of its own.

Why this matters for the rest of the plan:
- **Nodes are HTML `<div>`s, not SVG.** The "SVG can't resolve `var(--token)`" trap does not apply to node bodies — style them with normal CSS classes. Edge strokes are still SVG: colour them through React Flow's `style={{ stroke: ... }}` prop with a literal read from CSS, or a class on the edge, never a `stroke="var(--x)"` attribute.
- **React Flow needs its stylesheet** (`import "@xyflow/react/dist/style.css"`) and a container with an explicit height, or it renders 0px tall.
- **React Flow v12 has a `colorMode` prop** (`"light" | "dark" | "system"`) — feed it from `usePreferences().theme` so the canvas follows the app theme.
- Pan/zoom/selection come for free, so the workspace tree is click-to-select with no extra code.

---

## Repo layout (read this first)

Two independent git repos sit side by side under `D:\userprofile_project\project`:

- `adt-learning/` — backend. Backend paths below are relative to **`adt-learning/server/app/`**.
- `G06_adaptive_learning/` — frontend. Frontend paths below are relative to **`G06_adaptive_learning/`**.

Both repos are already on branch **`feat/goal-workspace`** (cut from `feat/complete-goal-node`). Commit in the repo whose files the task touches. No task touches both repos.

```bash
cd adt-learning/server/app
npx jest src/path/to/file.spec.ts   # single test file
npm test                             # all unit tests
npm run build                        # nest build (type check)

cd G06_adaptive_learning
npx tsc -b                           # the ONLY correctness gate on this side
npm run dev                          # manual verification
```

## Global Constraints

- **`npx tsc -b` on the frontend has ~148 pre-existing errors.** Task 7 captures a baseline file; every later frontend task diffs against it. Never "fix" unrelated pre-existing errors.
- **The global `ValidationPipe` is commented out** in `src/main.ts`. `class-validator` decorators do nothing at runtime. Validate by hand inside services and throw `BadRequestException`.
- **Every new admin-only route must carry `@UseGuards(AdminMiddleware)` itself.** `AuthMiddleWare` only proves the JWT is valid. Never add a new route to `AuthMiddleWare`'s `exclude()` list — `AdminMiddleware` reads `req.user`, which `AuthMiddleWare` populates; excluding a route makes the guard reject everyone (that is the live `/kt/*` bug).
- **A new provider must be added to `providers` in `src/app.module.ts`** or it fails silently at runtime. All entities this plan uses (`Goal`, `Skill`, `SkillPrerequisite`, `GoalSkillRequire`, `Exercise`, `Branch`, `AiDraft`) are **already** in `TypeOrmModule.forFeature` — do not re-add them.
- **`MIN_EXERCISES_PER_SKILL = 3`**, exported from `src/libs/goal/goalReadiness.ts`. One definition, imported everywhere.
- **Bloom `levelRequire` is 1–6 but `exercise.skillLevel` is effectively 1–5** (`SLIP_BY_LEVEL` in `libs/bkt/questionSelection.ts` covers 1–5 and silently falls back to 3 outside that range). Level coverage compares against `Math.min(levelRequire, 5)`.
- **Publish never touches `exercise.status`.** An `inactive` exercise means "retired / candidate" (the `/find-exercises` skill reads them as templates).
- **Frontend: no emoji, no new inline `style={{...}}` for layout/colour.** Icons come from `react-icons/fa6` only; styles go in `src/component/decorate/Adminhome.css` with the `ad-ws-` prefix. Every colour must be a token with both a light and a dark value. (React Flow's own `style` props for edge stroke/width are the one allowed exception, and are called out where used.)
- **Every user-visible string goes through `t(key, vars)`** from `usePreferences()`. New admin keys are prefixed `admin.` and must be added to **both** `src/i18n/admin.th.ts` and `src/i18n/admin.en.ts` — `admin.en.ts` is typed against `adminTh`, so a missing English string fails `npx tsc -b`.
- **Long-running (LLM) calls go through `AiClient`** (`src/API/aiRestApi.ts`, 180s, no global loader). Everything else goes through `AppClient` (5s timeout, global loader).
- **Backend controllers in this repo return raw DTOs/entities**; the frontend `*.service.ts` wraps them into `ApiResponse<T>` (`{ isError, data, errorMessage }`). Follow that, not the spec's "controller returns the envelope".
- **Do not run anything against `.env.prod`.** Manual verification uses `.env.dev` only.

## Remaining deviations from the spec (accepted, flagged for review)

1. **Publish transaction.** The spec says "load + recompute + write in one transaction". This plan reads and recomputes readiness first, then performs **all writes inside one transaction**. Residual risk: two admins editing the same goal in the same second. Threading an `EntityManager` through every workspace query buys little.
2. **Confirm dialog does not use `common/Modal`.** That component hardcodes `background: "#fff"` and slate text inline, so it is unreadable in dark theme. The workspace ships `ConfirmDialog.tsx` built from the themed `ad-overlay` / `ad-modal` markup `GoalFormModal` already uses.
3. **The selected skill's exercises are filtered client-side.** `GET /exercise` (BaseController) ignores query params, and `ExerciseTab` already fetches all and filters in memory. The workspace does the same rather than adding a backend filter.

## File Structure

**Backend — `adt-learning/server/app/`**

| File | Responsibility |
|---|---|
| `src/libs/bkt/skillGraph.ts` (modify) | add `wouldCreateCycle` beside the existing `getRelevantSkillIds` — one place that knows prerequisite-graph shape |
| `src/libs/bkt/skillGraph.spec.ts` (create) | cycle-detection unit tests |
| `src/libs/goal/goalReadiness.ts` (create) | pure readiness rules + `MIN_EXERCISES_PER_SKILL`. No DB, no Nest |
| `src/libs/goal/goalReadiness.spec.ts` (create) | a passing and a failing case per rule |
| `src/service/skill.service.ts` (modify) | reject prerequisite writes that would create a cycle |
| `src/service/skill.service.spec.ts` (create) | cycle rejection at the service boundary |
| `src/dto/goalWorkspace.dto.ts` (create) | response shapes for the two new routes |
| `src/service/goalWorkspace.service.ts` (create) | assembles the workspace read model; publishes |
| `src/service/goalWorkspace.service.spec.ts` (create) | closure / counting / publish behaviour |
| `src/controller/goal.controller.ts` (modify) | `GET :id/workspace`, `POST :id/publish`, both `@UseGuards(AdminMiddleware)` |
| `src/app.module.ts` (modify) | register `goalWorkspaceService` in `providers` |

**Frontend — `G06_adaptive_learning/`**

| File | Responsibility |
|---|---|
| `package.json` (modify) | add `@xyflow/react` |
| `src/i18n/admin.th.ts`, `src/i18n/admin.en.ts` (modify) | append `admin.workspace.*` keys; nothing existing is edited |
| `src/models/goalModel.ts` (modify) | append `GoalWorkspace`, `WorkspaceSkill`, `ReadinessResult`, `PublishGoalResult` |
| `src/component/adminHome/goalPanel/workspace/workspace.service.ts` (create) | HTTP only; returns `ApiResponse<T>` |
| `.../workspace/workspace.controller.ts` (create) | all workspace state + actions; components stay dumb |
| `.../workspace/GoalWorkspace.tsx` (create) | layout shell: header, tree, skill panel, checklist |
| `.../workspace/treeLayout.ts` (create) | dagre → React Flow `nodes`/`edges` |
| `.../workspace/WorkspaceTree.tsx` (create) | the `<ReactFlow>` canvas |
| `.../workspace/SkillNode.tsx` (create) | custom React Flow node for a skill |
| `.../workspace/GoalNode.tsx` (create) | custom React Flow node for the terminal goal node |
| `.../workspace/AddSkillBox.tsx` (create) | search-or-create skill box |
| `.../workspace/SkillDetailPanel.tsx` (create) | selected skill: info, prerequisites, exercises, AI drafts |
| `.../workspace/ReadinessChecklist.tsx` (create) | rule list + publish button |
| `.../workspace/ConfirmDialog.tsx` (create) | themed yes/no dialog |
| `.../exercisePanel/component/ExerciseFormModal.tsx` (modify) | **+2 optional props only** |
| `.../goalPanel/GoalTab.tsx` (modify) | **+1 button per row, + list/workspace switch** |
| `src/component/decorate/Adminhome.css` (modify) | append `ad-ws-*` styles, light + dark |

## Task list

| # | Repo | Task | Deliverable |
|---|---|---|---|
| 1 | backend | `SkillGraph.wouldCreateCycle` | pure helper + unit tests |
| 2 | backend | Cycle check in `skillService.validatePrerequisites` | 400 on cyclic prerequisite writes |
| 3 | backend | `libs/goal/goalReadiness.ts` | the five readiness rules, pure + tested |
| 4 | backend | `goalWorkspaceService.getWorkspace` + DTOs | the workspace read model |
| 5 | backend | `goalWorkspaceService.publish` | idempotent activation behind the readiness gate |
| 6 | backend | Routes + `AppModule` registration | `GET /goal/:id/workspace`, `POST /goal/:id/publish` |
| 7 | frontend | Dependency, i18n keys, models, tsc baseline | compiles, nothing rendered yet |
| 8 | frontend | `workspace.service.ts` + `workspace.controller.ts` | data layer for the screen |
| 9 | frontend | `treeLayout.ts`, `WorkspaceTree`, `SkillNode`, `GoalNode` | the React Flow canvas |
| 10 | frontend | `ExerciseFormModal`: `lockedSkillId` + `onSaveAndNext` | reusable add-exercise flow |
| 11 | frontend | `GoalWorkspace` shell, `AddSkillBox`, `ConfirmDialog`, `GoalTab` entry | navigable screen |
| 12 | frontend | `SkillDetailPanel` | prerequisites, exercises, AI drafts |
| 13 | frontend | `ReadinessChecklist` + publish + CSS + manual verification | the feature, finished |

---

## Task 1: `SkillGraph.wouldCreateCycle`

**Files:**
- Modify: `adt-learning/server/app/src/libs/bkt/skillGraph.ts`
- Test: `adt-learning/server/app/src/libs/bkt/skillGraph.spec.ts` (create)

**Interfaces:**
- Consumes: the existing `SkillWithPrerequisites` interface in that file — `{ skillId: number; skillPrequisite: { prerequisiteSkillId: number }[] }`. The misspelling `skillPrequisite` matches the TypeORM relation name; do not rename it.
- Produces: `SkillGraph.wouldCreateCycle(allSkills: T[], skillId: number, prerequisiteIds: number[]): boolean` — `true` when making `prerequisiteIds` the prerequisites of `skillId` puts `skillId` on a cycle. Used by Task 2 (write-time validation) and Task 3 (readiness rule `NO_PREREQ_CYCLE`).

- [ ] **Step 1: Write the failing test**

Create `src/libs/bkt/skillGraph.spec.ts`:

```ts
import { SkillGraph, SkillWithPrerequisites } from './skillGraph';

// helper: each row is [skillId, ...prerequisiteIds]
const graph = (...rows: number[][]): SkillWithPrerequisites[] =>
  rows.map(([skillId, ...prereqs]) => ({
    skillId,
    skillPrequisite: prereqs.map((prerequisiteSkillId) => ({ prerequisiteSkillId })),
  }));

describe('SkillGraph.wouldCreateCycle', () => {
  it('flags a skill listed as its own prerequisite', () => {
    expect(SkillGraph.wouldCreateCycle(graph([1], [2]), 1, [1])).toBe(true);
  });

  it('flags a two-step cycle (1 -> 2 -> 1)', () => {
    // skill 2 already requires skill 1; making 2 a prerequisite of 1 closes the loop
    expect(SkillGraph.wouldCreateCycle(graph([1], [2, 1]), 1, [2])).toBe(true);
  });

  it('flags a three-step cycle (1 -> 2 -> 3 -> 1)', () => {
    expect(SkillGraph.wouldCreateCycle(graph([1], [2, 1], [3, 2]), 1, [3])).toBe(true);
  });

  it('allows a diamond, which is a DAG and not a cycle', () => {
    // 4 requires 2 and 3; both require 1. Adding 1 directly is still acyclic.
    expect(
      SkillGraph.wouldCreateCycle(graph([1], [2, 1], [3, 1], [4, 2, 3]), 4, [2, 3, 1]),
    ).toBe(false);
  });

  it('allows an empty prerequisite list', () => {
    expect(SkillGraph.wouldCreateCycle(graph([1], [2, 1]), 2, [])).toBe(false);
  });

  it('ignores prerequisite ids that are not in the graph', () => {
    expect(SkillGraph.wouldCreateCycle(graph([1]), 1, [99])).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd adt-learning/server/app && npx jest src/libs/bkt/skillGraph.spec.ts`
Expected: FAIL — `SkillGraph.wouldCreateCycle is not a function`.

- [x] **Step 3: Write the implementation**

In `src/libs/bkt/skillGraph.ts`, inside `class SkillGraph`, below `getRelevantSkillIds`:

```ts
  /**
   * จะเกิดวงวนไหม ถ้าให้ prerequisiteIds เป็น prerequisite ของ skillId
   * เดินขึ้นจาก prerequisite ทีละชั้น ถ้าวนกลับมาเจอ skillId แปลว่าเป็นวง
   * ใช้ทั้งตอนเขียน (skillService.validatePrerequisites) และตอนตรวจความพร้อมของ goal
   */
  static wouldCreateCycle<T extends SkillWithPrerequisites>(
    allSkills: T[],
    skillId: number,
    prerequisiteIds: number[],
  ): boolean {
    const prereqsOf = new Map<number, number[]>(
      allSkills.map((s) => [
        s.skillId,
        (s.skillPrequisite || []).map((p) => p.prerequisiteSkillId),
      ]),
    );
    // ค่าที่กำลังจะบันทึก ทับของเดิมที่อยู่ในฐานข้อมูล
    prereqsOf.set(skillId, [...prerequisiteIds]);

    const visited = new Set<number>();
    const stack = [...prerequisiteIds];

    while (stack.length > 0) {
      const current = stack.pop()!;
      if (current === skillId) return true;
      if (visited.has(current)) continue;
      visited.add(current);
      for (const p of prereqsOf.get(current) ?? []) {
        stack.push(p);
      }
    }

    return false;
  }
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd adt-learning/server/app && npx jest src/libs/bkt/skillGraph.spec.ts`
Expected: PASS, 6 tests.

- [ ] **Step 5: Commit**

```bash
cd adt-learning
git add server/app/src/libs/bkt/skillGraph.ts server/app/src/libs/bkt/skillGraph.spec.ts
git commit -m "feat(bkt): add SkillGraph.wouldCreateCycle

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 2: Reject prerequisite writes that create a cycle

**Files:**
- Modify: `adt-learning/server/app/src/service/skill.service.ts:154-175` (`validatePrerequisites`)
- Test: `adt-learning/server/app/src/service/skill.service.spec.ts` (create)

**Interfaces:**
- Consumes: `SkillGraph.wouldCreateCycle` from Task 1.
- Produces: `createSkillWithPrerequisite` / `updateSkillWithPrerequisite` throw `BadRequestException('Prerequisite creates a cycle')`. `SkillDetailPanel` (Task 12) shows that message verbatim and leaves the tree unchanged.

- [ ] **Step 1: Write the failing test**

Create `src/service/skill.service.spec.ts`:

```ts
import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { getRepositoryToken, getDataSourceToken } from '@nestjs/typeorm';
import { skillService } from './skill.service';
import { Skill } from 'src/entity/skill.entity';
import { SkillPrerequisite } from 'src/entity/skillPrerequisite.entity';

describe('skillService prerequisite cycles', () => {
  let service: skillService;
  let skillRepo: {
    find: jest.Mock;
    findOne: jest.Mock;
    save: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
  };
  let prereqRepo: { create: jest.Mock; save: jest.Mock; delete: jest.Mock };
  let dataSource: { transaction: jest.Mock };

  beforeEach(async () => {
    skillRepo = {
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn(),
      save: jest.fn((e) => Promise.resolve({ skillId: 1, ...e })),
      create: jest.fn((d) => d),
      update: jest.fn(),
    };
    prereqRepo = { create: jest.fn((d) => d), save: jest.fn(), delete: jest.fn() };

    const mockManager = {
      getRepository: jest.fn((entity) => {
        if (entity === Skill) return skillRepo;
        if (entity === SkillPrerequisite) return prereqRepo;
        throw new Error(`Unexpected repository requested: ${String(entity)}`);
      }),
    };
    dataSource = { transaction: jest.fn((cb) => cb(mockManager)) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        skillService,
        { provide: getRepositoryToken(Skill), useValue: skillRepo },
        { provide: getDataSourceToken(), useValue: dataSource },
      ],
    }).compile();

    service = module.get<skillService>(skillService);
  });

  it('rejects a prerequisite chain that loops back to the skill', async () => {
    // skill 2 already requires skill 1. Making 2 a prerequisite of 1 closes a cycle.
    skillRepo.findOne.mockResolvedValue({ skillId: 1, skillPrequisite: [] });
    skillRepo.find.mockResolvedValue([
      { skillId: 1, skillPrequisite: [] },
      { skillId: 2, skillPrequisite: [{ prerequisiteSkillId: 1 }] },
    ]);

    await expect(
      service.updateSkillWithPrerequisite(1, {
        prerequisites: [{ prerequisiteSkillId: 2 }],
      }),
    ).rejects.toThrow(BadRequestException);

    expect(prereqRepo.save).not.toHaveBeenCalled();
  });

  it('accepts a prerequisite that keeps the graph acyclic', async () => {
    skillRepo.findOne.mockResolvedValue({ skillId: 3, skillPrequisite: [] });
    skillRepo.find.mockResolvedValue([
      { skillId: 1, skillPrequisite: [] },
      { skillId: 2, skillPrequisite: [{ prerequisiteSkillId: 1 }] },
      { skillId: 3, skillPrequisite: [] },
    ]);

    await service.updateSkillWithPrerequisite(3, {
      prerequisites: [{ prerequisiteSkillId: 2 }],
    });

    expect(prereqRepo.save).toHaveBeenCalledWith([
      { skillId: 3, prerequisiteSkillId: 2, prerequisiteLevel: undefined },
    ]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd adt-learning/server/app && npx jest src/service/skill.service.spec.ts`
Expected: FAIL — the first test resolves instead of rejecting; no cycle check exists yet.

- [x] **Step 3: Write the implementation**

Add the import at the top of `src/service/skill.service.ts`:

```ts
import { SkillGraph } from 'src/libs/bkt/skillGraph';
```

Replace the whole `validatePrerequisites` method (lines 154-175) with:

```ts
  private async validatePrerequisites(
    manager: EntityManager,
    skillId: number,
    prerequisites: SkillPrerequisiteItemDto[],
  ): Promise<void> {
    const skillRepo = manager.getRepository(Skill);
    for (const p of prerequisites) {
      if (p.prerequisiteSkillId === skillId) {
        throw new BadRequestException(
          `Skill ${skillId} cannot be its own prerequisite`,
        );
      }
      const found = await skillRepo.findOne({
        where: { skillId: p.prerequisiteSkillId },
      });
      if (!found) {
        throw new BadRequestException(
          `Prerequisite skill ${p.prerequisiteSkillId} does not exist`,
        );
      }
    }

    // กันวงวนข้ามหลายชั้น (1 -> 2 -> 3 -> 1) ที่การเช็คอ้างตัวเองด้านบนจับไม่ได้
    const allSkills = await skillRepo.find({
      relations: { skillPrequisite: true },
    });
    const prerequisiteIds = prerequisites.map((p) => p.prerequisiteSkillId);
    if (SkillGraph.wouldCreateCycle(allSkills, skillId, prerequisiteIds)) {
      throw new BadRequestException('Prerequisite creates a cycle');
    }
  }
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd adt-learning/server/app && npx jest src/service/skill.service.spec.ts && npm test`
Expected: the new file PASSes (2 tests) and the whole suite is still green.

- [ ] **Step 5: Commit**

```bash
cd adt-learning
git add server/app/src/service/skill.service.ts server/app/src/service/skill.service.spec.ts
git commit -m "feat(skill): reject prerequisite writes that create a cycle

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 3: `libs/goal/goalReadiness.ts` — the five rules

**Files:**
- Create: `adt-learning/server/app/src/libs/goal/goalReadiness.ts`
- Test: `adt-learning/server/app/src/libs/goal/goalReadiness.spec.ts`

**Interfaces:**
- Consumes: `SkillGraph.wouldCreateCycle` from Task 1.
- Produces, all exported from `goalReadiness.ts` and used by Tasks 4, 5, 6 and (as mirrored TypeScript types) Task 7:

```ts
export const MIN_EXERCISES_PER_SKILL = 3;
export const MAX_SKILL_LEVEL = 5;
export type SkillReadiness = 'empty' | 'partial' | 'ready';
export type ReadinessRule =
  | 'HAS_REQUIRED_SKILL' | 'MIN_EXERCISES' | 'LEVEL_COVERAGE'
  | 'NO_PREREQ_CYCLE' | 'NO_PENDING_DRAFTS';
export interface ReadinessCheck { rule: ReadinessRule; passed: boolean; skillIds: number[] }
export interface ReadinessResult { ready: boolean; checks: ReadinessCheck[] }
export interface ReadinessSkillInput {
  skillId: number;
  required: boolean;
  levelRequire: number | null;
  prerequisiteSkillIds: number[];
  activeExerciseCount: number;
  activeExerciseLevels: number[];
  pendingDraftCount: number;
}
export function skillReadinessOf(activeExerciseCount: number): SkillReadiness;
export function evaluateReadiness(skills: ReadinessSkillInput[]): ReadinessResult;
```

`skills` is the **whole closure** (required skills plus every prerequisite pulled in behind them), which is exactly the tree a student sees. The function is pure: no DB, no Nest, no I/O.

- [ ] **Step 1: Write the failing test**

Create `src/libs/goal/goalReadiness.spec.ts`:

```ts
import {
  MIN_EXERCISES_PER_SKILL,
  ReadinessRule,
  ReadinessSkillInput,
  evaluateReadiness,
  skillReadinessOf,
} from './goalReadiness';

const skill = (over: Partial<ReadinessSkillInput> = {}): ReadinessSkillInput => ({
  skillId: 1,
  required: true,
  levelRequire: null,
  prerequisiteSkillIds: [],
  activeExerciseCount: MIN_EXERCISES_PER_SKILL,
  activeExerciseLevels: [1, 2, 3],
  pendingDraftCount: 0,
  ...over,
});

const check = (skills: ReadinessSkillInput[], rule: ReadinessRule) =>
  evaluateReadiness(skills).checks.find((c) => c.rule === rule)!;

describe('skillReadinessOf', () => {
  it('is empty at zero, partial below the minimum, ready at or above it', () => {
    expect(skillReadinessOf(0)).toBe('empty');
    expect(skillReadinessOf(MIN_EXERCISES_PER_SKILL - 1)).toBe('partial');
    expect(skillReadinessOf(MIN_EXERCISES_PER_SKILL)).toBe('ready');
    expect(skillReadinessOf(MIN_EXERCISES_PER_SKILL + 10)).toBe('ready');
  });
});

describe('evaluateReadiness', () => {
  it('passes every rule for a healthy one-skill goal', () => {
    const result = evaluateReadiness([skill({ levelRequire: 3 })]);
    expect(result.ready).toBe(true);
    expect(result.checks.every((c) => c.passed)).toBe(true);
  });

  it('fails HAS_REQUIRED_SKILL when nothing is required', () => {
    expect(check([], 'HAS_REQUIRED_SKILL').passed).toBe(false);
    expect(check([skill({ required: false })], 'HAS_REQUIRED_SKILL').passed).toBe(false);
  });

  it('fails MIN_EXERCISES for a pulled-in prerequisite with no exercises', () => {
    // skill 2 is required and complete; skill 1 is only a prerequisite and empty.
    // Students would hit a permanent lock: unlocking 2 needs Progress 100% on 1.
    const failing = check(
      [
        skill({ skillId: 1, required: false, activeExerciseCount: 0, activeExerciseLevels: [] }),
        skill({ skillId: 2, prerequisiteSkillIds: [1] }),
      ],
      'MIN_EXERCISES',
    );
    expect(failing.passed).toBe(false);
    expect(failing.skillIds).toEqual([1]);
  });

  it('counts only active exercises, which the caller has already filtered', () => {
    const failing = check([skill({ activeExerciseCount: MIN_EXERCISES_PER_SKILL - 1 })], 'MIN_EXERCISES');
    expect(failing.passed).toBe(false);
    expect(failing.skillIds).toEqual([1]);
  });

  it('passes LEVEL_COVERAGE when a level at or above levelRequire exists', () => {
    expect(check([skill({ levelRequire: 3, activeExerciseLevels: [1, 3] })], 'LEVEL_COVERAGE').passed).toBe(true);
    expect(check([skill({ levelRequire: 3, activeExerciseLevels: [1, 4] })], 'LEVEL_COVERAGE').passed).toBe(true);
  });

  it('fails LEVEL_COVERAGE when every exercise sits below levelRequire', () => {
    const failing = check([skill({ levelRequire: 4, activeExerciseLevels: [1, 2, 3] })], 'LEVEL_COVERAGE');
    expect(failing.passed).toBe(false);
    expect(failing.skillIds).toEqual([1]);
  });

  it('treats Bloom level 6 as satisfied by a skillLevel 5 exercise', () => {
    // levelRequire is Bloom 1-6; exercise.skillLevel only goes to 5.
    expect(check([skill({ levelRequire: 6, activeExerciseLevels: [5] })], 'LEVEL_COVERAGE').passed).toBe(true);
  });

  it('does not check level coverage when levelRequire is null', () => {
    expect(check([skill({ levelRequire: null, activeExerciseLevels: [1] })], 'LEVEL_COVERAGE').passed).toBe(true);
  });

  it('does not check level coverage for a pulled-in skill', () => {
    const result = check(
      [
        skill({ skillId: 1, required: false, levelRequire: 5, activeExerciseLevels: [1] }),
        skill({ skillId: 2, prerequisiteSkillIds: [1] }),
      ],
      'LEVEL_COVERAGE',
    );
    expect(result.passed).toBe(true);
  });

  it('fails NO_PREREQ_CYCLE on legacy cyclic data and names both skills', () => {
    const failing = check(
      [
        skill({ skillId: 1, prerequisiteSkillIds: [2] }),
        skill({ skillId: 2, prerequisiteSkillIds: [1] }),
      ],
      'NO_PREREQ_CYCLE',
    );
    expect(failing.passed).toBe(false);
    expect(failing.skillIds).toEqual([1, 2]);
  });

  it('fails NO_PENDING_DRAFTS while an AI draft is still unreviewed', () => {
    const failing = check([skill({ pendingDraftCount: 2 })], 'NO_PENDING_DRAFTS');
    expect(failing.passed).toBe(false);
    expect(failing.skillIds).toEqual([1]);
  });

  it('reports the rules in a stable order', () => {
    expect(evaluateReadiness([skill()]).checks.map((c) => c.rule)).toEqual([
      'HAS_REQUIRED_SKILL',
      'MIN_EXERCISES',
      'LEVEL_COVERAGE',
      'NO_PREREQ_CYCLE',
      'NO_PENDING_DRAFTS',
    ]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd adt-learning/server/app && npx jest src/libs/goal/goalReadiness.spec.ts`
Expected: FAIL — `Cannot find module './goalReadiness'`.

- [x] **Step 3: Write the implementation**

Create `src/libs/goal/goalReadiness.ts`:

```ts
import { SkillGraph } from 'src/libs/bkt/skillGraph';

/** ข้อที่นับได้ต่อ skill ขั้นต่ำ ก่อนที่ goal จะเปิดใช้งานได้ */
export const MIN_EXERCISES_PER_SKILL = 3;

/** exercise.skillLevel ใช้จริงแค่ 1-5 (SLIP_BY_LEVEL) ส่วน Bloom มีถึง 6 */
export const MAX_SKILL_LEVEL = 5;

export type SkillReadiness = 'empty' | 'partial' | 'ready';

export type ReadinessRule =
  | 'HAS_REQUIRED_SKILL'
  | 'MIN_EXERCISES'
  | 'LEVEL_COVERAGE'
  | 'NO_PREREQ_CYCLE'
  | 'NO_PENDING_DRAFTS';

export interface ReadinessCheck {
  rule: ReadinessRule;
  /** skill ที่ทำให้กฎนี้ไม่ผ่าน (ว่างถ้าผ่าน หรือถ้ากฎไม่ผูกกับ skill ใดเป็นพิเศษ) */
  skillIds: number[];
  passed: boolean;
}

export interface ReadinessResult {
  ready: boolean;
  checks: ReadinessCheck[];
}

/**
 * ข้อมูลของ skill 1 ตัวใน closure ของ goal (required + prerequisite ทุกชั้น)
 * ผู้เรียกเป็นคนนับมาให้แล้ว — ไฟล์นี้ไม่แตะฐานข้อมูล
 */
export interface ReadinessSkillInput {
  skillId: number;
  /** อยู่ใน goalSkillRequire ของ goal นี้หรือไม่ (false = ถูกดึงมาเพราะเป็น prerequisite) */
  required: boolean;
  levelRequire: number | null;
  prerequisiteSkillIds: number[];
  activeExerciseCount: number;
  /** skillLevel ที่ไม่ซ้ำของข้อที่ active */
  activeExerciseLevels: number[];
  pendingDraftCount: number;
}

export function skillReadinessOf(activeExerciseCount: number): SkillReadiness {
  if (activeExerciseCount <= 0) return 'empty';
  if (activeExerciseCount < MIN_EXERCISES_PER_SKILL) return 'partial';
  return 'ready';
}

const failing = (rule: ReadinessRule, skillIds: number[]): ReadinessCheck => ({
  rule,
  skillIds,
  passed: skillIds.length === 0,
});

export function evaluateReadiness(skills: ReadinessSkillInput[]): ReadinessResult {
  const hasRequired = skills.some((s) => s.required);

  // ข้อไม่พอ: เช็คทุก skill ใน closure ไม่ใช่แค่ required
  // skill ที่เป็น prerequisite แล้วไม่มีข้อเลย = skill ถัดไปล็อกถาวร
  // เพราะการปลดล็อกต้อง Progress 100% ซึ่งทำไม่ได้ถ้าไม่มีข้อให้ทำ
  const notEnoughExercises = skills
    .filter((s) => s.activeExerciseCount < MIN_EXERCISES_PER_SKILL)
    .map((s) => s.skillId);

  // ความครอบคลุมระดับ: เฉพาะ required skill ที่ระบุ levelRequire ไว้
  const levelGap = skills
    .filter((s) => s.required && s.levelRequire != null)
    .filter((s) => {
      const target = Math.min(s.levelRequire!, MAX_SKILL_LEVEL);
      return !s.activeExerciseLevels.some((level) => level >= target);
    })
    .map((s) => s.skillId);

  // วงวน: ใช้ตัวตรวจเดียวกับตอนเขียน prerequisite (อย่ามี 2 แบบ)
  // skill X อยู่บนวง ก็ต่อเมื่อเดินขึ้นจาก prerequisite ของ X แล้ววนกลับมาเจอ X
  const graph = skills.map((s) => ({
    skillId: s.skillId,
    skillPrequisite: s.prerequisiteSkillIds.map((prerequisiteSkillId) => ({
      prerequisiteSkillId,
    })),
  }));
  const onCycle = skills
    .filter((s) => SkillGraph.wouldCreateCycle(graph, s.skillId, s.prerequisiteSkillIds))
    .map((s) => s.skillId);

  const withPendingDrafts = skills
    .filter((s) => s.pendingDraftCount > 0)
    .map((s) => s.skillId);

  const checks: ReadinessCheck[] = [
    { rule: 'HAS_REQUIRED_SKILL', skillIds: [], passed: hasRequired },
    failing('MIN_EXERCISES', notEnoughExercises),
    failing('LEVEL_COVERAGE', levelGap),
    failing('NO_PREREQ_CYCLE', onCycle),
    failing('NO_PENDING_DRAFTS', withPendingDrafts),
  ];

  return { ready: checks.every((c) => c.passed), checks };
}
```

Note there is deliberately **no "must have a root" rule**: once the closure is non-empty (`HAS_REQUIRED_SKILL`) and acyclic (`NO_PREREQ_CYCLE`), at least one skill with no prerequisites always exists. And no skill-status rule, because publish activates the closure's skills itself.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd adt-learning/server/app && npx jest src/libs/goal/goalReadiness.spec.ts`
Expected: PASS, 13 tests.

- [ ] **Step 5: Commit**

```bash
cd adt-learning
git add server/app/src/libs/goal/goalReadiness.ts server/app/src/libs/goal/goalReadiness.spec.ts
git commit -m "feat(goal): add pure goal readiness rules

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 4: `goalWorkspaceService.getWorkspace` + DTOs

**Files:**
- Create: `adt-learning/server/app/src/dto/goalWorkspace.dto.ts`
- Create: `adt-learning/server/app/src/service/goalWorkspace.service.ts`
- Test: `adt-learning/server/app/src/service/goalWorkspace.service.spec.ts`

**Interfaces:**
- Consumes: `SkillGraph.getRelevantSkillIds(allSkills, goalSkillRequire)` (existing), `evaluateReadiness` / `skillReadinessOf` / `MIN_EXERCISES_PER_SKILL` / `ReadinessResult` / `SkillReadiness` from Task 3.
- Produces:

```ts
export class goalWorkspaceService {
  async getWorkspace(goalId: number): Promise<GoalWorkspaceDto>;
}
```

DTO shapes (Task 6 returns them; Task 7 mirrors them in TypeScript on the frontend):

```ts
GoalWorkspaceDto = {
  goal: { id, goal, goalDescription, status },
  branchCount: number,
  minExercisesPerSkill: number,
  skills: WorkspaceSkillDto[],
  readiness: ReadinessResult,
}
WorkspaceSkillDto = {
  skillId, skillCode, skillsName, tier, status,
  required, levelRequire, prerequisiteSkillIds,
  goalCount, activeExerciseCount, activeExerciseLevels,
  pendingDraftCount, readiness,
}
```

**No student data is returned** — only `branchCount`. Keep it that way (PDPA minimisation).

- [x] **Step 1: Write the DTO file**

Create `src/dto/goalWorkspace.dto.ts`:

```ts
import { ReadinessResult, SkillReadiness } from 'src/libs/goal/goalReadiness';

export class WorkspaceGoalDto {
  id!: number;
  goal!: string;
  goalDescription!: string | null;
  status!: string;
}

export class WorkspaceSkillDto {
  skillId!: number;
  skillCode!: string;
  skillsName!: string;
  tier!: string | null;
  status!: string;
  /** อยู่ใน goalSkillRequire ของ goal นี้ (false = ถูกดึงมาเพราะเป็น prerequisite) */
  required!: boolean;
  levelRequire!: number | null;
  prerequisiteSkillIds!: number[];
  /** จำนวน goal ทุกสถานะที่ closure มี skill นี้ — เตือน admin ว่าแก้แล้วกระทบที่อื่น */
  goalCount!: number;
  activeExerciseCount!: number;
  /** skillLevel ที่ไม่ซ้ำของข้อที่ active */
  activeExerciseLevels!: number[];
  pendingDraftCount!: number;
  readiness!: SkillReadiness;
}

/** ไม่มีข้อมูลนักศึกษาในนี้ นอกจากจำนวน branch (PDPA: ส่งเท่าที่หน้าจอใช้) */
export class GoalWorkspaceDto {
  goal!: WorkspaceGoalDto;
  branchCount!: number;
  minExercisesPerSkill!: number;
  skills!: WorkspaceSkillDto[];
  readiness!: ReadinessResult;
}

export class PublishGoalResultDto {
  activatedGoal!: boolean;
  activatedSkillIds!: number[];
}
```

- [ ] **Step 2: Write the failing test**

Create `src/service/goalWorkspace.service.spec.ts`:

```ts
import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { getRepositoryToken, getDataSourceToken } from '@nestjs/typeorm';
import { goalWorkspaceService } from './goalWorkspace.service';
import { Goal } from 'src/entity/goal.entity';
import { Skill } from 'src/entity/skill.entity';
import { Branch } from 'src/entity/branch.entity';
import { Exercise } from 'src/entity/exerciseAndSession/exercise.entity';
import { AiDraft } from 'src/entity/aiDraft.entity';
import { Status } from 'src/enums/status.enum';
import { AiDraftEntityType, AiDraftStatus } from 'src/enums/ai-draft.enum';
import { MIN_EXERCISES_PER_SKILL } from 'src/libs/goal/goalReadiness';

describe('goalWorkspaceService.getWorkspace', () => {
  let service: goalWorkspaceService;
  let goalRepo: { findOne: jest.Mock; find: jest.Mock };
  let skillRepo: { find: jest.Mock };
  let exerciseRepo: { find: jest.Mock };
  let branchRepo: { count: jest.Mock };
  let aiDraftRepo: { find: jest.Mock };
  let dataSource: { transaction: jest.Mock };

  // goal 1 requires skill 2; skill 2 requires skill 1 (a pulled-in prerequisite)
  const theGoal = {
    id: 1,
    goal: 'Become a backend engineer',
    goalDescription: 'desc',
    status: Status.INACTIVE,
    goalSkillRequire: [{ goalId: 1, skillId: 2, levelRequire: 3 }],
  };
  const allSkills = [
    {
      skillId: 1,
      skillCode: 'S1',
      skillsName: 'Variables',
      tier: 'T1',
      status: Status.INACTIVE,
      skillPrequisite: [],
    },
    {
      skillId: 2,
      skillCode: 'S2',
      skillsName: 'Loops',
      tier: 'T2',
      status: Status.ACTIVE,
      skillPrequisite: [{ prerequisiteSkillId: 1 }],
    },
    {
      skillId: 3,
      skillCode: 'S3',
      skillsName: 'Unrelated',
      tier: 'T1',
      status: Status.ACTIVE,
      skillPrequisite: [],
    },
  ];

  beforeEach(async () => {
    goalRepo = {
      findOne: jest.fn().mockResolvedValue(theGoal),
      find: jest.fn().mockResolvedValue([theGoal]),
    };
    skillRepo = { find: jest.fn().mockResolvedValue(allSkills) };
    exerciseRepo = { find: jest.fn().mockResolvedValue([]) };
    branchRepo = { count: jest.fn().mockResolvedValue(4) };
    aiDraftRepo = { find: jest.fn().mockResolvedValue([]) };
    dataSource = { transaction: jest.fn((cb) => cb({ update: jest.fn() })) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        goalWorkspaceService,
        { provide: getRepositoryToken(Goal), useValue: goalRepo },
        { provide: getRepositoryToken(Skill), useValue: skillRepo },
        { provide: getRepositoryToken(Exercise), useValue: exerciseRepo },
        { provide: getRepositoryToken(Branch), useValue: branchRepo },
        { provide: getRepositoryToken(AiDraft), useValue: aiDraftRepo },
        { provide: getDataSourceToken(), useValue: dataSource },
      ],
    }).compile();

    service = module.get<goalWorkspaceService>(goalWorkspaceService);
  });

  it('throws NotFoundException for a goal that does not exist', async () => {
    goalRepo.findOne.mockResolvedValue(null);
    await expect(service.getWorkspace(99)).rejects.toThrow(NotFoundException);
  });

  it('returns the closure — required skills plus their prerequisites, nothing else', async () => {
    const result = await service.getWorkspace(1);

    expect(result.skills.map((s) => s.skillId).sort()).toEqual([1, 2]);
    expect(result.skills.find((s) => s.skillId === 2)!.required).toBe(true);
    expect(result.skills.find((s) => s.skillId === 2)!.levelRequire).toBe(3);
    // pulled in only because skill 2 depends on it
    expect(result.skills.find((s) => s.skillId === 1)!.required).toBe(false);
    expect(result.skills.find((s) => s.skillId === 1)!.levelRequire).toBeNull();
    expect(result.skills.find((s) => s.skillId === 2)!.prerequisiteSkillIds).toEqual([1]);
  });

  it('reports the branch count and the shared exercise minimum', async () => {
    const result = await service.getWorkspace(1);
    expect(result.branchCount).toBe(4);
    expect(result.minExercisesPerSkill).toBe(MIN_EXERCISES_PER_SKILL);
    expect(branchRepo.count).toHaveBeenCalledWith({ where: { goalId: 1 } });
  });

  it('counts active exercises per skill and collects their distinct levels', async () => {
    exerciseRepo.find.mockResolvedValue([
      { skillId: 2, skillLevel: 3 },
      { skillId: 2, skillLevel: 3 },
      { skillId: 2, skillLevel: 5 },
      { skillId: 1, skillLevel: 1 },
    ]);

    const result = await service.getWorkspace(1);
    const loops = result.skills.find((s) => s.skillId === 2)!;
    const variables = result.skills.find((s) => s.skillId === 1)!;

    expect(loops.activeExerciseCount).toBe(3);
    expect(loops.activeExerciseLevels.sort()).toEqual([3, 5]);
    expect(loops.readiness).toBe('ready');
    expect(variables.activeExerciseCount).toBe(1);
    expect(variables.readiness).toBe('partial');
    // only active exercises are ever loaded
    expect(exerciseRepo.find).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ status: Status.ACTIVE }) }),
    );
  });

  it('counts pending exercise drafts for skills in the closure only', async () => {
    aiDraftRepo.find.mockResolvedValue([
      { id: 10, entityType: AiDraftEntityType.EXERCISE, status: AiDraftStatus.PENDING, payload: { skillId: 2 } },
      { id: 11, entityType: AiDraftEntityType.EXERCISE, status: AiDraftStatus.PENDING, payload: { skillId: 3 } },
      { id: 12, entityType: AiDraftEntityType.EXERCISE, status: AiDraftStatus.PENDING, payload: {} },
    ]);

    const result = await service.getWorkspace(1);
    expect(result.skills.find((s) => s.skillId === 2)!.pendingDraftCount).toBe(1);
    expect(result.skills.find((s) => s.skillId === 1)!.pendingDraftCount).toBe(0);
  });

  it('counts how many goals pull each skill into their closure', async () => {
    goalRepo.find.mockResolvedValue([
      theGoal,
      { id: 2, goal: 'Another', status: Status.ACTIVE, goalSkillRequire: [{ skillId: 1 }] },
    ]);

    const result = await service.getWorkspace(1);
    // skill 1 is in goal 1's closure (as a prerequisite) and is goal 2's required skill
    expect(result.skills.find((s) => s.skillId === 1)!.goalCount).toBe(2);
    expect(result.skills.find((s) => s.skillId === 2)!.goalCount).toBe(1);
  });

  it('reports readiness for the whole closure', async () => {
    const result = await service.getWorkspace(1);
    // no exercises anywhere, so MIN_EXERCISES must fail and name both skills
    const minExercises = result.readiness.checks.find((c) => c.rule === 'MIN_EXERCISES')!;
    expect(result.readiness.ready).toBe(false);
    expect(minExercises.passed).toBe(false);
    expect(minExercises.skillIds.sort()).toEqual([1, 2]);
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `cd adt-learning/server/app && npx jest src/service/goalWorkspace.service.spec.ts`
Expected: FAIL — `Cannot find module './goalWorkspace.service'`.

- [x] **Step 4: Write the implementation**

Create `src/service/goalWorkspace.service.ts`:

```ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';

import { AiDraft } from 'src/entity/aiDraft.entity';
import { Branch } from 'src/entity/branch.entity';
import { Exercise } from 'src/entity/exerciseAndSession/exercise.entity';
import { Goal } from 'src/entity/goal.entity';
import { Skill } from 'src/entity/skill.entity';
import { AiDraftEntityType, AiDraftStatus } from 'src/enums/ai-draft.enum';
import { Status } from 'src/enums/status.enum';
import { SkillGraph } from 'src/libs/bkt/skillGraph';
import {
  MIN_EXERCISES_PER_SKILL,
  ReadinessSkillInput,
  evaluateReadiness,
  skillReadinessOf,
} from 'src/libs/goal/goalReadiness';
import {
  GoalWorkspaceDto,
  WorkspaceSkillDto,
} from 'src/dto/goalWorkspace.dto';

/**
 * read model ของหน้า Goal Workspace — รวม tree, จำนวนข้อ, ร่างที่ค้าง และผลตรวจความพร้อม
 * ไว้ในคำขอเดียว เพื่อให้หน้าจอโหลดใหม่ทั้งก้อนหลังทุกการเขียน (ไม่คำนวณซ้ำที่ frontend)
 *
 * หมายเหตุ: ต้องลงทะเบียนใน providers ของ AppModule ด้วย ไม่งั้นพังแบบเงียบ
 */
@Injectable()
export class goalWorkspaceService {
  constructor(
    @InjectRepository(Goal)
    private readonly goalRepository: Repository<Goal>,
    @InjectRepository(Skill)
    private readonly skillRepository: Repository<Skill>,
    @InjectRepository(Exercise)
    private readonly exerciseRepository: Repository<Exercise>,
    @InjectRepository(Branch)
    private readonly branchRepository: Repository<Branch>,
    @InjectRepository(AiDraft)
    private readonly aiDraftRepository: Repository<AiDraft>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  async getWorkspace(goalId: number): Promise<GoalWorkspaceDto> {
    const goal = await this.goalRepository.findOne({
      where: { id: goalId },
      relations: { goalSkillRequire: true },
    });
    if (!goal) {
      throw new NotFoundException(`Goal ${goalId} not found`);
    }

    const allSkills = await this.skillRepository.find({
      relations: { skillPrequisite: true },
    });

    const requires = goal.goalSkillRequire ?? [];
    const closureIds = SkillGraph.getRelevantSkillIds(allSkills, requires);
    const skillIds = [...closureIds];

    const levelRequireBySkillId = new Map<number, number | null>(
      requires.map((r) => [r.skillId, r.levelRequire ?? null]),
    );

    const [branchCount, exercises, pendingDrafts, allGoals] = await Promise.all([
      this.branchRepository.count({ where: { goalId } }),
      // In([]) ทำให้ SQL พัง จึงข้ามการ query ไปเลยเมื่อ closure ว่าง
      skillIds.length === 0
        ? Promise.resolve([] as Exercise[])
        : this.exerciseRepository.find({
            where: { skillId: In(skillIds), status: Status.ACTIVE },
            select: { id: true, skillId: true, skillLevel: true },
          }),
      this.aiDraftRepository.find({
        where: {
          entityType: AiDraftEntityType.EXERCISE,
          status: AiDraftStatus.PENDING,
        },
      }),
      this.goalRepository.find({ relations: { goalSkillRequire: true } }),
    ]);

    const exerciseCount = new Map<number, number>();
    const exerciseLevels = new Map<number, Set<number>>();
    for (const ex of exercises) {
      exerciseCount.set(ex.skillId, (exerciseCount.get(ex.skillId) ?? 0) + 1);
      const levels = exerciseLevels.get(ex.skillId) ?? new Set<number>();
      levels.add(ex.skillLevel);
      exerciseLevels.set(ex.skillId, levels);
    }

    // payload ของร่างเป็น jsonb — กรองใน JS แทนการ query ลงไปในคอลัมน์ jsonb
    // จำนวนร่างที่ pending มีน้อยอยู่แล้ว
    const draftCount = new Map<number, number>();
    for (const draft of pendingDrafts) {
      const draftSkillId = Number(draft.payload?.skillId);
      if (!closureIds.has(draftSkillId)) continue;
      draftCount.set(draftSkillId, (draftCount.get(draftSkillId) ?? 0) + 1);
    }

    // skill นี้ถูกดึงเข้า closure ของ goal กี่ตัว (ทุกสถานะ)
    const goalCount = new Map<number, number>();
    for (const other of allGoals) {
      const otherClosure = SkillGraph.getRelevantSkillIds(
        allSkills,
        other.goalSkillRequire ?? [],
      );
      for (const id of otherClosure) {
        goalCount.set(id, (goalCount.get(id) ?? 0) + 1);
      }
    }

    const skillById = new Map(allSkills.map((s) => [s.skillId, s]));
    const skills: WorkspaceSkillDto[] = skillIds
      .map((skillId) => skillById.get(skillId))
      .filter((s): s is Skill => s !== undefined)
      .map((s) => {
        const activeExerciseCount = exerciseCount.get(s.skillId) ?? 0;
        return {
          skillId: s.skillId,
          skillCode: s.skillCode,
          skillsName: s.skillsName,
          tier: s.tier ?? null,
          status: s.status,
          required: levelRequireBySkillId.has(s.skillId),
          levelRequire: levelRequireBySkillId.get(s.skillId) ?? null,
          prerequisiteSkillIds: (s.skillPrequisite ?? []).map(
            (p) => p.prerequisiteSkillId,
          ),
          goalCount: goalCount.get(s.skillId) ?? 0,
          activeExerciseCount,
          activeExerciseLevels: [...(exerciseLevels.get(s.skillId) ?? [])],
          pendingDraftCount: draftCount.get(s.skillId) ?? 0,
          readiness: skillReadinessOf(activeExerciseCount),
        };
      });

    const readinessInput: ReadinessSkillInput[] = skills.map((s) => ({
      skillId: s.skillId,
      required: s.required,
      levelRequire: s.levelRequire,
      prerequisiteSkillIds: s.prerequisiteSkillIds,
      activeExerciseCount: s.activeExerciseCount,
      activeExerciseLevels: s.activeExerciseLevels,
      pendingDraftCount: s.pendingDraftCount,
    }));

    return {
      goal: {
        id: goal.id,
        goal: goal.goal,
        goalDescription: goal.goalDescription ?? null,
        status: goal.status,
      },
      branchCount,
      minExercisesPerSkill: MIN_EXERCISES_PER_SKILL,
      skills,
      readiness: evaluateReadiness(readinessInput),
    };
  }
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `cd adt-learning/server/app && npx jest src/service/goalWorkspace.service.spec.ts`
Expected: PASS, 7 tests.

- [ ] **Step 6: Commit**

```bash
cd adt-learning
git add server/app/src/dto/goalWorkspace.dto.ts server/app/src/service/goalWorkspace.service.ts server/app/src/service/goalWorkspace.service.spec.ts
git commit -m "feat(goal): add goal workspace read model

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 5: `goalWorkspaceService.publish`

**Files:**
- Modify: `adt-learning/server/app/src/service/goalWorkspace.service.ts` (add one method)
- Test: `adt-learning/server/app/src/service/goalWorkspace.service.spec.ts` (add a `describe` block)

**Interfaces:**
- Consumes: `this.getWorkspace` from Task 4.
- Produces: `async publish(goalId: number): Promise<PublishGoalResultDto>` — `{ activatedGoal: boolean; activatedSkillIds: number[] }`. Throws `BadRequestException` with a body of `{ message, checks }` when readiness fails, writing nothing. Safe to call twice (the second call activates nothing and returns empty).

- [ ] **Step 1: Write the failing test**

Append to `src/service/goalWorkspace.service.spec.ts` (the `beforeEach` above already provides the mocks; add `BadRequestException` to the `@nestjs/common` import):

```ts
describe('goalWorkspaceService.publish', () => {
  // Re-uses the suite above by driving getWorkspace through a spy, so these
  // tests state publish's behaviour without re-mocking every repository query.
  let service: goalWorkspaceService;
  let goalRepo: { findOne: jest.Mock; find: jest.Mock };
  let managerUpdate: jest.Mock;
  let dataSource: { transaction: jest.Mock };

  const readyWorkspace = {
    goal: { id: 1, goal: 'G', goalDescription: null, status: Status.INACTIVE },
    branchCount: 0,
    minExercisesPerSkill: MIN_EXERCISES_PER_SKILL,
    skills: [
      { skillId: 1, status: Status.INACTIVE },
      { skillId: 2, status: Status.ACTIVE },
    ],
    readiness: { ready: true, checks: [] },
  };

  beforeEach(async () => {
    goalRepo = { findOne: jest.fn(), find: jest.fn() };
    managerUpdate = jest.fn();
    dataSource = {
      transaction: jest.fn((cb) => cb({ update: managerUpdate })),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        goalWorkspaceService,
        { provide: getRepositoryToken(Goal), useValue: goalRepo },
        { provide: getRepositoryToken(Skill), useValue: { find: jest.fn() } },
        { provide: getRepositoryToken(Exercise), useValue: { find: jest.fn() } },
        { provide: getRepositoryToken(Branch), useValue: { count: jest.fn() } },
        { provide: getRepositoryToken(AiDraft), useValue: { find: jest.fn() } },
        { provide: getDataSourceToken(), useValue: dataSource },
      ],
    }).compile();

    service = module.get<goalWorkspaceService>(goalWorkspaceService);
  });

  it('activates the goal and every inactive skill in the closure', async () => {
    jest.spyOn(service, 'getWorkspace').mockResolvedValue(readyWorkspace as any);

    const result = await service.publish(1);

    expect(result).toEqual({ activatedGoal: true, activatedSkillIds: [1] });
    expect(managerUpdate).toHaveBeenCalledWith(Goal, { id: 1 }, { status: Status.ACTIVE });
    expect(managerUpdate).toHaveBeenCalledWith(
      Skill,
      { skillId: In([1]) },
      { status: Status.ACTIVE },
    );
  });

  it('never writes to exercise', async () => {
    jest.spyOn(service, 'getWorkspace').mockResolvedValue(readyWorkspace as any);

    await service.publish(1);

    const touchedEntities = managerUpdate.mock.calls.map((call) => call[0]);
    expect(touchedEntities).not.toContain(Exercise);
  });

  it('is idempotent — a second publish activates nothing', async () => {
    jest.spyOn(service, 'getWorkspace').mockResolvedValue({
      ...readyWorkspace,
      goal: { ...readyWorkspace.goal, status: Status.ACTIVE },
      skills: [
        { skillId: 1, status: Status.ACTIVE },
        { skillId: 2, status: Status.ACTIVE },
      ],
    } as any);

    const result = await service.publish(1);

    expect(result).toEqual({ activatedGoal: false, activatedSkillIds: [] });
    expect(managerUpdate).not.toHaveBeenCalled();
  });

  it('throws BadRequestException with the failing checks and writes nothing', async () => {
    jest.spyOn(service, 'getWorkspace').mockResolvedValue({
      ...readyWorkspace,
      readiness: {
        ready: false,
        checks: [
          { rule: 'MIN_EXERCISES', passed: false, skillIds: [1] },
          { rule: 'NO_PENDING_DRAFTS', passed: true, skillIds: [] },
        ],
      },
    } as any);

    await expect(service.publish(1)).rejects.toThrow(BadRequestException);
    expect(dataSource.transaction).not.toHaveBeenCalled();

    // only the failing rules travel back to the admin
    await service.publish(1).catch((err: BadRequestException) => {
      expect((err.getResponse() as { checks: unknown[] }).checks).toEqual([
        { rule: 'MIN_EXERCISES', passed: false, skillIds: [1] },
      ]);
    });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd adt-learning/server/app && npx jest src/service/goalWorkspace.service.spec.ts`
Expected: FAIL — `service.publish is not a function`.

- [ ] **Step 3: Write the implementation**

In `src/service/goalWorkspace.service.ts`, add `BadRequestException` to the `@nestjs/common` import, `PublishGoalResultDto` to the DTO import, and add this method below `getWorkspace`:

```ts
  /**
   * เปิดใช้งาน goal ทั้งก้อน — คำนวณความพร้อมใหม่ที่ server เสมอ ไม่เชื่อค่าจาก client
   * เรียกซ้ำได้: ถ้าเปิดอยู่แล้วจะไม่เขียนอะไรและคืนรายการว่าง
   * ไม่แตะ exercise.status เพราะข้อ inactive แปลว่า "เลิกใช้ / ผู้สมัคร" ไม่ใช่ "ยังไม่เปิด"
   */
  async publish(goalId: number): Promise<PublishGoalResultDto> {
    const workspace = await this.getWorkspace(goalId);

    if (!workspace.readiness.ready) {
      throw new BadRequestException({
        message: `Goal ${goalId} is not ready to publish`,
        checks: workspace.readiness.checks.filter((c) => !c.passed),
      });
    }

    const activatedGoal = workspace.goal.status !== Status.ACTIVE;
    const activatedSkillIds = workspace.skills
      .filter((s) => s.status !== Status.ACTIVE)
      .map((s) => s.skillId);

    if (!activatedGoal && activatedSkillIds.length === 0) {
      return { activatedGoal: false, activatedSkillIds: [] };
    }

    await this.dataSource.transaction(async (manager) => {
      if (activatedGoal) {
        await manager.update(Goal, { id: goalId }, { status: Status.ACTIVE });
      }
      if (activatedSkillIds.length > 0) {
        await manager.update(
          Skill,
          { skillId: In(activatedSkillIds) },
          { status: Status.ACTIVE },
        );
      }
    });

    return { activatedGoal, activatedSkillIds };
  }
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd adt-learning/server/app && npx jest src/service/goalWorkspace.service.spec.ts && npm test`
Expected: PASS, 11 tests in that file; whole suite green.

- [ ] **Step 5: Commit**

```bash
cd adt-learning
git add server/app/src/service/goalWorkspace.service.ts server/app/src/service/goalWorkspace.service.spec.ts
git commit -m "feat(goal): publish a goal behind the readiness gate

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 6: Routes + `AppModule` registration

**Files:**
- Modify: `adt-learning/server/app/src/controller/goal.controller.ts`
- Modify: `adt-learning/server/app/src/app.module.ts`

**Interfaces:**
- Consumes: `goalWorkspaceService` from Tasks 4–5.
- Produces: `GET /goal/:id/workspace` → `GoalWorkspaceDto`, `POST /goal/:id/publish` → `PublishGoalResultDto`. Both admin-only. Task 8's frontend service calls exactly these paths.

There is no unit test here — a controller that only forwards has nothing to assert that the service specs don't already cover. Step 4 verifies it end to end against the running dev server.

- [ ] **Step 1: Add the routes**

In `src/controller/goal.controller.ts`, extend the imports:

```ts
import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AdminMiddleware } from 'src/middleware/adminMiddleWare';
import {
  GoalWorkspaceDto,
  PublishGoalResultDto,
} from 'src/dto/goalWorkspace.dto';
import { goalWorkspaceService } from 'src/service/goalWorkspace.service';
```

Widen the constructor:

```ts
  constructor(
    private readonly goalService: goalService,
    private readonly goalWorkspaceService: goalWorkspaceService,
  ) {
    super(goalService);
  }
```

Add both routes at the end of the class. **`AdminMiddleware` goes on each route** — `BaseController`'s inherited CRUD must stay exactly as open (or closed) as it is today, so do not put the guard at class level:

```ts
  /**
   * ข้อมูลทั้งหน้าของ Goal Workspace ในคำขอเดียว
   * admin เท่านั้น (route นี้อยู่ใต้ AuthMiddleWare อยู่แล้ว เพราะไม่ได้ถูก exclude)
   */
  @Get(':id/workspace')
  @UseGuards(AdminMiddleware)
  async getWorkspace(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<GoalWorkspaceDto> {
    return await this.goalWorkspaceService.getWorkspace(id);
  }

  /** เปิดใช้งาน goal + skill ใน closure ที่ยังปิดอยู่ (ตรวจความพร้อมใหม่ที่ server) */
  @Post(':id/publish')
  @UseGuards(AdminMiddleware)
  async publish(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<PublishGoalResultDto> {
    return await this.goalWorkspaceService.publish(id);
  }
```

- [ ] **Step 2: Register the provider**

In `src/app.module.ts`, add the import beside the other service imports:

```ts
import { goalWorkspaceService } from './service/goalWorkspace.service';
```

and add `goalWorkspaceService,` to the `providers` array, directly after `goalService,`. Do **not** add anything to `TypeOrmModule.forFeature` — `Goal`, `Skill`, `Exercise`, `Branch` and `AiDraft` are already there. Do **not** add anything to `AuthMiddleWare`'s `exclude()` list.

- [ ] **Step 3: Type check**

Run: `cd adt-learning/server/app && npm run build && npm test`
Expected: build succeeds, all tests pass.

- [ ] **Step 4: Verify both routes against the dev database**

```bash
cd adt-learning/server/app
# .env.dev only — never point this at .env.prod
$env:NODE_ENV="development"; npm run start:dev
```

In a second shell, with `$TOKEN` set to a JWT for an **admin** user and `$GOAL` an existing goal id:

```bash
curl -s -H "Authorization: Bearer $TOKEN" http://localhost:3000/goal/$GOAL/workspace
curl -s -X POST -H "Authorization: Bearer $TOKEN" http://localhost:3000/goal/$GOAL/publish
```

Expected: the first returns `{ goal, branchCount, minExercisesPerSkill, skills, readiness }`. The second returns either `{ activatedGoal, activatedSkillIds }` or HTTP 400 with `checks`. Repeat the first call with a **non-admin** token and confirm HTTP 403 — if it returns 200, the guard is missing.

- [ ] **Step 5: Commit**

```bash
cd adt-learning
git add server/app/src/controller/goal.controller.ts server/app/src/app.module.ts
git commit -m "feat(goal): expose workspace and publish routes

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---
