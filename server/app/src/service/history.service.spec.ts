import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { historyService } from './history.service';
import { History } from 'src/entity/history.entity';
import { Branch } from 'src/entity/branch.entity';
import { Skill } from 'src/entity/skill.entity';
import { Session } from 'src/entity/exerciseAndSession/session.entity';

describe('historyService conceptMapState-driven read side', () => {
  let service: historyService;
  let branchRepo: { findOne: jest.Mock };
  let skillRepo: { find: jest.Mock };
  let historyRepo: { find: jest.Mock };
  let sessionRepo: { find: jest.Mock };

  const goal = {
    id: 9,
    goal: 'Web Developer',
    goalSkillRequire: [{ skillId: 1 }, { skillId: 2 }],
  };

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
    sessionRepo = { find: jest.fn().mockResolvedValue([]) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        historyService,
        { provide: getRepositoryToken(History), useValue: historyRepo },
        { provide: getRepositoryToken(Branch), useValue: branchRepo },
        { provide: getRepositoryToken(Skill), useValue: skillRepo },
        { provide: getRepositoryToken(Session), useValue: sessionRepo },
      ],
    }).compile();

    service = module.get<historyService>(historyService);
  });

  it('getBranchSkills reports progress and attemptCount from the branch conceptMapState', async () => {
    const { skills: result } = await service.getBranchSkills(1, 42);
    const skill1 = result.find((s) => s.skillId === 1);
    const skill2 = result.find((s) => s.skillId === 2);
    expect(skill1.progressPercent).toBe(100);
    expect(skill1.attemptCount).toBe(5);
    expect(skill2.progressPercent).toBe(10.52); // pL 0.1 → 10.526…, stored 11 was the old rounding
    expect(skill2.attemptCount).toBe(0); // not-started, even though pL > 0
  });

  it('getBranchSkills does not leak progress from another branch of the same user', async () => {
    const { skills: result } = await service.getBranchSkills(2, 42);
    const skill1 = result.find((s) => s.skillId === 1);
    // Branch 1 mastered skill 1; branch 2 must still fall back to skill.pL0.
    expect(skill1.attemptCount).toBe(0);
    expect(skill1.progressPercent).toBe(26.31); // pL0 0.25 → 26.315… truncated
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

  it('getBranchSkills reports each skill draft by the same rule the Exercise page resumes it', async () => {
    sessionRepo.find.mockResolvedValue([
      { id: 7, skillId: 2, exerciseRelate: [{}, {}, {}] },
      { id: 8, skillId: 2, exerciseRelate: [] }, // a later empty visit must not hide the draft
    ]);
    const { skills: result } = await service.getBranchSkills(1, 42);
    expect(result.find((s) => s.skillId === 2).draftAnsweredCount).toBe(3);
    expect(result.find((s) => s.skillId === 1).draftAnsweredCount).toBe(0);
  });

  it('getBranchSkills ends the tree in a goal node that counts required skills at pL >= 0.95 in that branch', async () => {
    const { goal: practised } = await service.getBranchSkills(1, 42);
    expect(practised).toEqual({
      goalId: 9,
      goalName: 'Web Developer',
      requiredSkillIds: [1, 2],
      masteredCount: 1, // skill 1 at pL 0.96; skill 2 at 0.1
      requiredCount: 2,
      // skill 2 is not started (attemptCount 0): it counts 0, not its pL-derived 10.52
      progressPercent: 50,
      isComplete: false,
      completedAt: null,
    });

    // Same goal, same user — but nothing mastered in this branch yet
    const { goal: fresh } = await service.getBranchSkills(2, 42);
    expect(fresh?.masteredCount).toBe(0);
  });

  it('getBranchStats reports the same goal progress as the goal node', async () => {
    const stats = await service.getBranchStats(1, 42);
    const { goal } = await service.getBranchSkills(1, 42);
    expect(stats.goalProgressPercent).toBe(goal?.progressPercent);
    expect(stats).toMatchObject({
      goalProgressPercent: 50,
      goalMasteredCount: 1,
      goalRequiredCount: 2,
      goalComplete: false,
    });
  });

  it('getBranchStats starts a fresh branch at 0% goal progress, not the pL0-derived 26.31%', async () => {
    const stats = await service.getBranchStats(2, 42);
    expect(stats.goalProgressPercent).toBe(0);
  });

  it('a recorded goal completion sticks even after a required skill drops below 0.95', async () => {
    branchRepo.findOne.mockResolvedValueOnce({
      ...practisedBranch,
      goalCompletedAt: new Date('2026-09-10T08:00:00Z'),
    });
    const { goal } = await service.getBranchSkills(1, 42);
    expect(goal).toMatchObject({
      isComplete: true,
      progressPercent: 100,
      masteredCount: 1,
      completedAt: '2026-09-10T08:00:00.000Z',
    });
  });
});
