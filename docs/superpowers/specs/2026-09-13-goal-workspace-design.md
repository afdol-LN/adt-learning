# Goal Workspace — Design Spec

Date: 2026-09-13

## Summary

การสร้าง goal 1 ตัวที่มีหลาย skill และแต่ละ skill มีหลายข้อ ตอนนี้ต้องทำ **จากล่างขึ้นบนข้าม 3 แท็บ** (Skill → Exercise → Goal) โดยเปิด modal ทีละรายการ — goal ขนาด 5 skill × 5 ข้อ ใช้ประมาณ 31 modal และไม่มีที่ไหนบอกว่า goal "พร้อมให้นักศึกษาใช้หรือยัง"

spec นี้เพิ่ม **Goal Workspace**: หน้าเดียวที่ทำงาน **จากบนลงล่าง** — tree ของ goal, แผงข้อสอบของ skill ที่เลือก, checklist ความพร้อม และปุ่มเปิดใช้งานทั้งก้อน พร้อมกฎใหม่จากผู้ใช้: **skill ที่ `inactive` ผูกกับ goal และ exercise ได้ทุกที่** เพื่อให้ร่างทั้ง goal ไว้เป็น inactive ได้จนกว่าจะพร้อม

## Scope

**อยู่ใน spec นี้**
- กฎการผูก skill ที่ inactive (backend + ฟอร์มเดิมทุกตัว)
- Goal Workspace ใน `goalPanel/`
- Backend: `GET /goal/:id/workspace`, `POST /goal/:id/publish`, readiness checks, การตรวจวงวนของ prerequisite
- ปุ่ม "ร่างข้อที่ขาดด้วย AI" ต่อ skill (ใช้ endpoint `/ai-draft/*` ที่มีอยู่)

**นอก spec นี้ (แยก spec ภายหลัง)**
- AI สร้างโครงทั้ง goal (skill + prereq + ข้อสอบ) ในครั้งเดียว
- Import จาก spreadsheet, clone goal เป็น template, โหมดตาราง (grid) ของ exercise
- การลากเส้นบน tree เพื่อต่อ prerequisite (ใน spec นี้ใช้ตัวเลือกในแผงแทน)
- ใส่ `AdminMiddleware` ให้ route เขียนเดิมของ `/skill`, `/goal`, `/exercise` — เป็นช่องโหว่ที่มีอยู่แล้ว (ดู CLAUDE.md หัวข้อ Security) ควรแก้แยก

## Requirements (จากผู้ใช้)

- เพิ่ม goal ที่มี skill หลายตัวและข้อสอบหลายข้อได้โดยไม่สับสนหรือต้องสลับหน้าไปมา
- skill ที่ `inactive` ต้องผูกกับ goal และ exercise ได้ทั้งหมด
- สนใจความถูกต้องของ system flow มากกว่าปริมาณงาน implement

## ข้อเท็จจริงจากโค้ดปัจจุบันที่ spec นี้ยึด

| เรื่อง | สถานะตอนนี้ | ที่มา |
|---|---|---|
| Goal ↔ skill inactive | **ถูกปฏิเสธ** `Skill X is not active` (เฉพาะ skill ที่เพิ่งผูกใหม่) | `goal.service.ts` `validateSkillRequires` |
| Exercise ↔ skill inactive | backend **รับอยู่แล้ว** (`validateSkillExists` เช็คแค่มีจริง) | `exercise.service.ts` `createExercise` |
| ฟอร์มฝั่ง admin | กรองเหลือ skill active | `exercise.controller.ts` (`setActiveSkills`), `goal.controller.ts` (`setActiveSkills`), `ai.controller.ts` (`activeSkills`) |
| AI prompt | ส่ง skill **ทุกสถานะ** อยู่แล้ว | `aiDraft.service.ts` `loadSkillContext` |
| Tree ของนักศึกษา | แสดง skill ใน closure **โดยไม่กรอง `skill.status`** | `history.service.ts` `getBranchSkills` + `SkillGraph.getRelevantSkillIds` |
| ข้อที่นักศึกษาได้ทำ | กรองแค่ `exercise.status = active` | `session.service.ts` |
| Goal ที่นักศึกษาเห็น | เฉพาะ `active` | `goal.service.ts` `findAll` |
| Pretest | ใช้ข้อ active ของ skill ใน `goalSkillRequire` เท่านั้น ถ้าไม่มีเลยจะไปใช้ข้อ active **ทั้งระบบ** | `exercise.service.ts` `findPretestByGoal` |
| Prerequisite | กันแค่อ้างตัวเอง **ยังไม่กันวงวน** | `skill.service.ts` `validatePrerequisites` |
| Exercise inactive | ใช้เป็น "เลิกใช้ / ผู้สมัคร" (สกิล `/find-exercises` อ่านข้อ inactive เป็นต้นแบบ) | CLAUDE.md |

ข้อสรุปสำคัญ: **goal ที่ `inactive` ปลอดภัยสำหรับใช้เป็นร่าง** (นักศึกษาไม่เห็น) แต่ **skill ที่ inactive ไม่ได้ถูกซ่อน** ถ้าอยู่ใน closure ของ goal ที่ active — spec จึงกันด้วย readiness gate ตอน publish และ dialog ยืนยันตอนผูกกับ goal ที่ active อยู่แล้ว

## คำศัพท์

- **Required skill** — skill ใน `goalSkillRequire` ของ goal
- **Closure** — required skill + prerequisite ทุกชั้นของมัน (ผลของ `SkillGraph.getRelevantSkillIds`) = tree ที่นักศึกษาเห็นจริง
- **Pulled-in skill** — skill ที่อยู่ใน closure แต่ไม่ใช่ required skill (ถูกดึงมาเพราะเป็น prerequisite)
- **ข้อที่นับได้** — exercise ของ skill นั้นที่ `status = active`

## 1. กฎการผูก skill ที่ inactive

> **Superseded by [the implementation plan](../plans/2026-09-14-goal-workspace.md) (owner decisions 1–2):** ทั้งหัวข้อนี้ถูกยกเลิก — skill ที่ inactive ยังผูกกับ goal ไม่ได้, `goal.service.ts` และฟอร์มเดิม (`activeSkills`) ไม่ถูกแก้, ไม่มี dialog ยืนยันการผูก skill inactive; skill ที่สร้างจาก workspace เป็น `active`

### Backend
- `goalService.validateSkillRequires` เช็คแค่ว่า skill มีอยู่จริง — **เอาเงื่อนไข `found.status !== Status.ACTIVE` ออก**
- ใน `updateGoalWithSkillRequire` การกรอง `newSkillRequires` (และ comment เรื่อง full-replace lockout) ไม่จำเป็นอีกต่อไป — ให้ validate ทุก `skillRequires` ด้วยกฎเดียว (มีจริง + ไม่ซ้ำ)
- Exercise ไม่ต้องแก้ backend

### Frontend (ฟอร์มเดิม)
- `exercise.controller.ts`, `goal.controller.ts`, `ai.controller.ts` เลิกกรอง `status === "active"` ส่ง skill ทุกตัวให้ฟอร์ม และเปลี่ยนชื่อ prop `activeSkills` → `skills` ใน `ExerciseFormModal`, `GoalFormModal`, `SkillRequireEditor`, `AiGenerateForm`
- dropdown / ตัวเลือก skill แสดง skill ที่ inactive พร้อมป้ายต่อท้าย (i18n key ใหม่ `admin.common.inactiveTag` — th: "ปิดใช้งาน", en: "inactive") เรียง active ก่อน
- ตัวกรองในตาราง Exercise (`ExerciseTab` dropdown "ทุก skill") ใช้รายการเดียวกัน

### ผูก skill inactive กับ goal ที่ active อยู่แล้ว
อนุญาต แต่ UI ต้องขึ้น dialog ยืนยันก่อนบันทึก:
> "goal นี้เปิดใช้งานอยู่ มีนักศึกษา {branchCount} branch จะเห็น skill "{name}" ทันที ทั้งที่ skill ยังปิดใช้งาน"

ใช้ได้ทั้งใน `GoalFormModal` และใน Workspace (`branchCount` มาจาก `GET /goal/:id/workspace`) — backend ไม่บล็อก เพราะผู้ใช้ต้องการให้ผูกได้ทุกที่

## 2. Goal Workspace — frontend

### ตำแหน่งและการเข้า
- อยู่ใน `goalPanel/` เป็น **มุมมองย่อยของแท็บ Goal** (สลับ list ↔ workspace ภายใน `GoalTab`) — ไม่เพิ่มแท็บใหม่ใน `TABS` / `Adminhome.tsx`
- ปุ่ม "เพิ่ม goal" เปิดฟอร์มสั้น (ชื่อ + คำอธิบาย) → สร้าง goal ด้วย `status: inactive` และ `skillRequires: []` → เข้า workspace ของ goal นั้นทันที
- ตาราง goal มีปุ่ม "เปิด workspace" ต่อแถว (เพิ่มใน `ActionButtons` แถวนั้น) ปุ่ม view/edit เดิมยังอยู่

### Layout
| ส่วน | เนื้อหา |
|---|---|
| Header | ชื่อ goal, ป้ายสถานะ (ร่าง/เปิดใช้งาน), ช่องค้นหา-เพิ่ม skill, ปุ่มกลับไป list |
| Tree | closure ของ goal จัดด้วย dagre, จบที่ goal node (เหมือนที่นักศึกษาเห็นตาม ADR 0005) |
| แผง skill | ข้อมูลและข้อสอบของ skill ที่เลือก |
| Checklist | ผล readiness + ปุ่ม "เปิดใช้งาน goal" |

### Tree

> **Superseded by the implementation plan (owner decisions 2–3):** tree ของ workspace ใช้ React Flow (`@xyflow/react`) + dagre แยกต่างหาก — ไม่แยก `layoutTree` และไม่แก้ `GoalLearningTree.tsx`
- ใช้ layout เดียวกับ `GoalLearningTree` — **แยก `layoutTree` ออกเป็น util ใช้ร่วม** ทั้ง `GoalLearningTree` และ `WorkspaceTree` (ปรับให้รับ closure ไม่ใช่แค่ `goalSkillRequire`)
- สถานะ node (จากค่าที่ backend ส่งมา): `empty` = 0 ข้อที่นับได้, `partial` = น้อยกว่า `minExercisesPerSkill`, `ready` = ครบ
- pulled-in skill = กรอบเส้นประ + subtitle "prerequisite"
- skill ที่ inactive = ป้าย "ปิดใช้งาน" บน node
- subtitle บน node: `{นับได้}/{min} ข้อ` และ `· ร่าง {n}` ถ้ามีร่าง AI ค้าง
- สีมาจาก class ใน `Adminhome.css` (`ad-ws-node--empty|partial|ready`) มี token ทั้ง light และ dark — ไม่ใส่ `fill="var(...)"` เป็น attribute (SVG attribute อ้าง CSS variable ไม่ได้)

### เพิ่ม skill
ช่องค้นหาช่องเดียว ค้นจาก `skillsName` / `skillCode` ของ skill **ทุกสถานะ**:
- **เจอ** → เลือกแล้วเพิ่มเป็น required skill (`PUT /goal/:id/with-skill-require` แบบ full replace ด้วยรายการเดิม + ตัวใหม่) รายการผลค้นแสดง "ใช้ใน N goal · มี M ข้อ"
- **ไม่เจอ** → "สร้าง skill ใหม่ชื่อนี้" เปิดฟอร์มสั้น (code, name, tier) → `POST /skill/with-prerequisite` ด้วย `status: inactive` แล้วผูกเป็น required skill ต่อทันที
  - สองคำขอนี้ไม่ atomic: ถ้าขั้นผูกล้ม skill ยังอยู่ในระบบ (inactive, ค้นเจอได้) และ UI แจ้ง error พร้อมให้กดผูกซ้ำ
- ถ้า goal active และ skill ที่จะผูก inactive → dialog ยืนยันตามข้อ 1

### แผง skill
- หัว: ชื่อ, tier, สถานะ, "ใช้ใน N goal"
- ถ้า N > 1: ข้อความเตือน "การแก้ skill นี้ (ชื่อ/prerequisite) มีผลกับอีก N−1 goal"
- ถ้าเป็น pulled-in: ข้อความ "ไม่ได้เลือกไว้ใน goal แต่เป็นพื้นฐานของ {skill ลูก} นักศึกษาจะเห็นใน tree ด้วย" + ปุ่ม "ทำเป็น required skill"
- **Prerequisite**: รายการ "ต้องเรียนก่อน" แก้ได้ด้วยตัวเลือกแบบเดียวกับ `SkillFormModal` → `PUT /skill/:id/with-prerequisite` ถ้า backend ตอบวงวน (400) ให้แสดง error และไม่เปลี่ยน tree
- ปุ่มถอด required skill ออกจาก goal (ไม่ลบ skill)
- **รายการข้อสอบ**: คำอธิบาย (ตัด 60 ตัวอักษร), ระดับ, ชนิด, สถานะ; คลิกเปิด `ExerciseFormModal` แก้ไข
- **เพิ่มข้อ**: เปิด `ExerciseFormModal` โดยเพิ่ม prop ใหม่ 2 ตัว
  - `lockedSkillId?: number` — ล็อก skill (select ถูก disable)
  - `onSaveAndNext?: (form) => Promise<boolean>` — แสดงปุ่มที่สอง "บันทึกและเพิ่มข้อถัดไป" ที่บันทึกแล้วล้างฟอร์ม (คง skill / ชนิด / ระดับไว้) โดยไม่ปิด modal
- **ร่างข้อที่ขาดด้วย AI**: เรียก `POST /ai-draft/generate` (`entityType: exercise`, `skillId`, `count = max(min − นับได้ − ร่างค้าง, 1)`) ผ่าน `AiClient` (ไม่ใช่ `AppClient`); ร่างที่ pending ของ skill นี้แสดงในรายการพร้อมปุ่ม "อนุมัติ" (→ `POST /ai-draft/:id/approve` status `active`), "แก้" และ "ปฏิเสธ" — ร่างไม่นับเป็นข้อจนกว่าจะอนุมัติ

### Checklist + publish
- แสดงผล readiness จาก backend ทีละกฎ (ผ่าน/ไม่ผ่าน + รายชื่อ skill ที่ติด)
- ปุ่ม "เปิดใช้งาน goal" ไม่ disable (ตามหลักให้ตอบเมื่อกด): ถ้ายังไม่ผ่านจะแสดงว่าติดกฎไหน; ถ้าผ่านเปิด dialog ยืนยันที่ลิสต์ **goal และ skill ที่จะถูกเปลี่ยนเป็น active** แล้วเรียก `POST /goal/:id/publish`
- goal ที่ active แต่ไม่ผ่าน checklist (เช่นเพิ่งผูก skill inactive) → แถบเตือนบนสุดของ workspace "goal นี้เปิดใช้งานอยู่แต่ยังไม่พร้อม" และปุ่มเปลี่ยนเป็น "เปิดใช้งาน skill ที่เหลือ" (เรียก publish ตัวเดียวกัน)
- หลังทุกการเขียน (เพิ่ม skill, ข้อ, prereq, อนุมัติร่าง) ให้โหลด workspace ใหม่ — ไม่คำนวณ readiness ซ้ำที่ frontend

### Convention
- UI → `workspace.controller.ts` → `workspace.service.ts` (ใน `goalPanel/workspace/`), service คืน `ApiResponse<T>`; เรียก endpoint ปกติผ่าน `AppClient`, AI ผ่าน `AiClient`
- ไฟล์ component: `GoalWorkspace.tsx`, `WorkspaceTree.tsx`, `SkillDetailPanel.tsx`, `ReadinessChecklist.tsx`, `AddSkillBox.tsx`; dialog ยืนยันใช้ `common/Modal` *(superseded: ใช้ `ConfirmDialog.tsx` บน `ad-overlay`/`ad-modal` เพราะ `common/Modal` อ่านไม่ออกในธีมมืด)*
- ข้อความทุกตัวผ่าน `t()` — key ใหม่ใน `admin.th.ts` / `admin.en.ts` (prefix `admin.workspace.`)
- style ใน `Adminhome.css` (prefix `ad-ws-`), ไอคอนจาก `react-icons/fa6` เท่านั้น, ไม่มี emoji, ไม่มี inline style ใหม่
- model type ใหม่ใน `src/models/goalModel.ts` (`GoalWorkspace`, `WorkspaceSkill`, `ReadinessResult`)

## 3. Backend

### `GET /goal/:id/workspace` — `@UseGuards(AdminMiddleware)`
คืน (ห่อด้วย envelope `{ isError, data, errorMessage }`):
```ts
{
  goal: { id, goal, goalDescription, status },
  branchCount: number,                 // branch ที่ goalId = id
  minExercisesPerSkill: number,        // MIN_EXERCISES_PER_SKILL
  skills: Array<{
    skillId, skillCode, skillsName, tier, status,
    required: boolean,                 // อยู่ใน goalSkillRequire
    levelRequire: number | null,       // เฉพาะ required
    prerequisiteSkillIds: number[],
    goalCount: number,                 // จำนวน goal (ทุกสถานะ) ที่ closure มี skill นี้ — ใช้ SkillGraph.getRelevantSkillIds กับ goalSkillRequire ของแต่ละ goal
    activeExerciseCount: number,
    activeExerciseLevels: number[],    // skillLevel ที่ไม่ซ้ำของข้อ active
    pendingDraftCount: number,         // aiDraft pending entityType=exercise, payload.skillId = skillId
    readiness: 'empty' | 'partial' | 'ready',
  }>,
  readiness: ReadinessResult,
}
```
- ไม่ส่งเนื้อหาข้อสอบใน response นี้ — แผง skill โหลดข้อสอบของ skill ที่เลือกผ่าน endpoint exercise ที่มีอยู่ (กรองด้วย `skillId`)
- ไม่มีข้อมูลนักศึกษาใน response (มีแค่ `branchCount`) — สอดคล้องกับ PDPA minimization

### `POST /goal/:id/publish` — `@UseGuards(AdminMiddleware)`
ใน transaction เดียว:
1. โหลด workspace data แล้วคำนวณ readiness ใหม่ (ไม่เชื่อค่าจาก client)
2. ไม่ผ่าน → `BadRequestException` พร้อมรายการกฎที่ไม่ผ่าน (message อ่านได้ ไม่มี stack)
3. ผ่าน → ตั้ง `goal.status = active` และ skill ใน closure ที่ `inactive` → `active`
4. **ไม่แตะ `exercise.status`** (ข้อ inactive = เลิกใช้ / ผู้สมัคร)
5. คืน `{ activatedGoal: boolean, activatedSkillIds: number[] }`

เรียกซ้ำได้ (idempotent) ทั้งตอน goal inactive และ active

### Readiness — pure function
ไฟล์ใหม่ `src/libs/goal/goalReadiness.ts` (ไม่มี DB, รับ skills + edges + counts + requiredIds) คืน:
```ts
type ReadinessRule =
  | 'HAS_REQUIRED_SKILL'
  | 'MIN_EXERCISES'
  | 'LEVEL_COVERAGE'
  | 'NO_PREREQ_CYCLE'
  | 'NO_PENDING_DRAFTS';
interface ReadinessResult {
  ready: boolean;
  checks: { rule: ReadinessRule; passed: boolean; skillIds: number[] }[];
}
```
`MIN_EXERCISES_PER_SKILL = 3` เป็นค่าคงที่ที่ export จากไฟล์เดียวกัน

| กฎ | ผ่านเมื่อ | เหตุผล |
|---|---|---|
| `HAS_REQUIRED_SKILL` | goal มี required skill ≥ 1 | goal ว่างจะ complete ทันที และ pretest จะไปใช้ข้อทั้งระบบแทน |
| `MIN_EXERCISES` | **ทุก skill ใน closure** มีข้อที่นับได้ ≥ `MIN_EXERCISES_PER_SKILL` | pulled-in skill ที่ไม่มีข้อ = skill ถัดไปล็อกถาวร (unlock ต้อง Progress 100%) |
| `LEVEL_COVERAGE` | ทุก required skill ที่มี `levelRequire` มีข้อที่นับได้อย่างน้อย 1 ข้อที่ `skillLevel ≥ min(levelRequire, 5)` | `levelRequire` เป็น Bloom 1–6 แต่ `skillLevel` มีแค่ 1–5 (`SLIP_BY_LEVEL`) → Bloom 6 นับเท่ากับ 5 |
| `NO_PREREQ_CYCLE` | ไม่มีวงวนใน prerequisite ของ closure | ข้อมูลเก่าอาจมีวงวนก่อนมีการตรวจตอนเขียน |
| `NO_PENDING_DRAFTS` | ไม่มี aiDraft ที่ pending สำหรับ skill ใน closure | ร่างที่ยังไม่ตรวจอาจทำให้ admin เข้าใจผิดว่ามีข้อพอแล้ว |

หมายเหตุ: ไม่มีกฎ "ต้องมี root" แยก เพราะเมื่อ closure ไม่ว่าง (`HAS_REQUIRED_SKILL`) และไม่มีวงวน (`NO_PREREQ_CYCLE`) จะมี skill ที่ไม่มี prerequisite อย่างน้อย 1 ตัวเสมอ และไม่มีกฎ skill status เพราะ publish เปิด skill ให้เอง

### ตรวจวงวนตอนเขียน prerequisite
- เพิ่ม `SkillGraph.wouldCreateCycle(allSkills, skillId, prerequisiteIds): boolean` (pure) ใน `libs/bkt/skillGraph.ts`
- `skillService.validatePrerequisites` เรียกใช้ทั้งตอน create และ update → `BadRequestException('Prerequisite creates a cycle')`
- ใช้ฟังก์ชันเดียวกันใน readiness `NO_PREREQ_CYCLE` (อย่ามีการตรวจวงวน 2 แบบ)

### Layering และการลงทะเบียน
- logic ของ workspace/publish อยู่ใน `goalService` (หรือ service ใหม่ `goalWorkspaceService` ที่ลงทะเบียนใน `providers` ของ `AppModule` ด้วย — provider ที่ลืมลงทะเบียนจะพังแบบเงียบ) controller แค่ส่งต่อ
- endpoint ใหม่อยู่ใน `goal.controller.ts`; ใส่ `@UseGuards(AdminMiddleware)` ต่อ route (route อยู่ใต้ `AuthMiddleWare` อยู่แล้ว เพราะไม่ได้ exclude)

## 4. ผลกระทบต่อ goal ที่มีนักศึกษาใช้อยู่
- goal node คำนวณใหม่ทุกครั้งที่อ่าน (ADR 0005) — เพิ่ม/ถอด required skill มีผลกับ progress ของทุก branch ทันที
- `goalCompletedAt` ไม่ถูกลบ (sticky) คนที่ complete ไปแล้วยัง complete แม้จะเพิ่ม skill
- mastery อยู่ต่อ branch (`branch.conceptMapState`) — skill ที่เพิ่มใหม่เริ่มที่ "ยังไม่เริ่ม"
- workspace แสดง `branchCount` ใน header ทุกครั้งที่ goal active และในทุก dialog ยืนยันที่เปลี่ยนโครง goal

## 5. Error handling
- ทุก endpoint ใหม่คืน envelope เดิม; error ของ validation เป็น `BadRequestException` ข้อความอ่านได้
- publish ไม่ผ่าน → 400 พร้อม `checks` ที่ไม่ผ่าน frontend แสดงใน checklist ไม่ใช่ toast ลอย ๆ
- วงวน prerequisite → 400 แสดงในแผง skill; tree ไม่เปลี่ยน
- ขั้นผูก skill ล้มหลังสร้าง skill สำเร็จ → error + ปุ่ม "ผูกอีกครั้ง" (skill ที่สร้างแล้วยังอยู่)
- 401 ใช้ interceptor เดิมของ `AppClient` / `AiClient`

## 6. Testing
**Backend (jest)**
- `goal.service.spec.ts`: **กลับ assertion ของ test เดิม 2 ตัว** — `rejects a skillId that is inactive` และ `rejects adding a new inactive skillId on update even though existing ones are exempt` → กลายเป็น "accepts"; คง test ที่ปฏิเสธ skill ที่ไม่มีอยู่จริงและ skillId ซ้ำ
- `libs/goal/goalReadiness.spec.ts` (ใหม่): กฎละอย่างน้อย 1 เคสผ่าน/ไม่ผ่าน, pulled-in skill ที่ 0 ข้อทำให้ `MIN_EXERCISES` ไม่ผ่าน, `levelRequire = 6` ผ่านด้วยข้อ `skillLevel = 5`, `levelRequire = null` ไม่ถูกเช็ค, ข้อ inactive ไม่ถูกนับ
- `libs/bkt/skillGraph.spec.ts` (ใหม่): `wouldCreateCycle` — อ้างตัวเอง, วงวน 2 ชั้น, 3 ชั้น, DAG ที่ถูกต้อง
- publish: เปิดเฉพาะ goal + skill ใน closure ที่ inactive, ไม่เรียกเขียน exercise, ไม่ผ่าน readiness → 400 และไม่มีการเขียนใด ๆ

**Frontend**
- ไม่มี test suite — `npx tsc -b` กรองเฉพาะไฟล์ที่แตะ (เทียบกับ baseline error เดิม) เป็นด่านเดียว
- ตรวจด้วยมือบน dev server: สร้าง goal 5 skill (prereq 2 ชั้น + pulled-in 1 ตัว) × 3 ข้อจาก workspace ล้วน ๆ, ลองกด publish ก่อนพร้อม, ผูก skill inactive กับ goal ที่ active แล้วเห็น dialog, ธีมมืด/สว่าง และ TH/EN

**End-to-end (ฝั่งนักศึกษา, ใช้ `.env.dev` เท่านั้น)**
- goal ที่ publish แล้ว → สร้าง branch → pretest ได้ข้อจาก goal นี้ (ไม่ใช่ข้อทั้งระบบ) → ทุก skill ใน tree มีข้อให้ทำ → root skill unlock → goal node นับ `requiredCount` ถูก

## Decisions (ตั้งค่าเริ่มต้นไว้ ผู้ใช้ปรับได้ตอนรีวิว)
1. ร่าง = `status: inactive` เดิม (ไม่มี staging table ใหม่)
2. `MIN_EXERCISES_PER_SKILL = 3`
3. Bloom 6 นับเท่ากับ `skillLevel` 5 ในกฎความครอบคลุม
4. ผูก skill inactive กับ goal ที่ active ได้ แต่มี dialog ยืนยัน (backend ไม่บล็อก)
5. publish ไม่เปลี่ยนสถานะ exercise
6. ต่อ prerequisite ผ่านตัวเลือกในแผง ไม่ใช่ลากบน tree
