# Database Simplification & E-Learning Path Guide

This document explains the architectural rationale behind the database simplification (reducing the schema to 13 tables) and details how to resolve skill prerequisites to construct the e-learning path.

---

## 1. Relational Database Schema (13 Core Tables)

To optimize read/write performance for active student loops while supporting **Staff CRUD operations** for curriculum planning, the database uses **13 tables**:

### 1.1 University & User Profile Group (🟣)
1. **`userprofile`**: Stores student credentials, metadata, and dynamic learning states (BKT and behavior tracking).
2. **`gender`**: Demographic directory.
3. **`campus`**: University campus directory.
4. **`faculty`**: University faculty directory.
5. **`major`**: University major directory.
6. **`branch`**: Maps a student's active track to a specific curriculum goal.

### 1.2 Session & Exercise Group (🟢)
7. **`session`**: Tracks historical student learning sessions.
8. **`exercise`**: Store of code blanks, MCQs, and level/expect_time metrics.
9. **`exerciseChoice`**: Options (1-4) mapped to each exercise.

### 1.3 Goal & Skill Tree Group (🔴) - CRUD-able by Staff
10. **`goal`**: The target career pathway (e.g., "Data Analyst").
11. **`skill`**: Stores individual competencies (skills/concepts).
12. **`skills_prerequisite`**: Defines prerequisites and dependency levels between skills.
13. **`GoalskillRequire`**: Links goals to their required skills and target levels.

---

## 2. Rationale: What Was Simplified and What Was Kept Relational

* **Why Student Tracking Tables Were Simplified (JSONB)**:
  Tables like `UserBehavior`, `UserPotential`, `UserSkillsPerformance`, and `EloUpdateHistory` are updated in real-time on every student action. To avoid high write amplification, these runtime values are cached in **Redis** and flushed in a single JSON block to `Userprofile.conceptMapState` and `Userprofile.strengthWeaknessMatrix` columns on **[Userprofile](file:///D:/userprofile_project/adt-learning/server/app/src/entity/userprofile.entity.ts)**.
* **Why Curriculum Tables Were Kept Relational**:
  Since staff and administrators need to perform **CRUD operations** on skills, define prerequisite links, add exercises, and update goal requirements via an admin dashboard, the metadata structures (`Skill`, `SkillPrerequisite`, `GoalSkillRequire`) must exist as distinct relational tables in the database.

---

## 3. Resolving Prerequisites & Learning Path Generation

### 3.1 Prerequisite Unlock Rule
> [!IMPORTANT]
> A Concept Node unlocks if and only if **all its parent prerequisites** (defined in the `skills_prerequisite` table) have reached **at least 60% progress** in the student's `conceptMapState`.

### 3.2 Implementation Example

The relationships can be queried from the database using TypeORM repositories:

```typescript
// Example: Resolving a goal's required skills from the GoalskillRequire table
const requirements = await this.goalSkillRequireRepository.find({
  where: { goalId },
  relations: ['skill']
});

// Example: Checking if a student satisfies prerequisites
const prerequisites = await this.skillPrerequisiteRepository.find({
  where: { skillId }
});

const isUnlocked = prerequisites.every(prereq => {
  const currentProgress = conceptMapState?.[prereq.prerequisiteSkillId]?.progress || 0;
  return currentProgress >= 60;
});
```
