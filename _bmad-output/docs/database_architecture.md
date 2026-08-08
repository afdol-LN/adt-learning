# Database Simplification & E-Learning Path Guide

This document explains the architectural rationale behind the database simplification (reducing the schema to 10 core tables) and details how to resolve skill prerequisites to construct the e-learning path.

---

## 1. Relational Database Simplification (10 Core Tables)

To optimize read/write performance, eliminate join latency, and maintain a flexible curriculum structure, the database has been simplified to use only the following **10 necessary tables**:

1. **`userprofile`**: Stores student credentials, metadata, and dynamic learning states.
2. **`gender`**: General demographic directories.
3. **`campus`**: prince of Songkla University campus directories.
4. **`faculty`**: Prince of Songkla University faculty directories.
5. **`major`**: Prince of Songkla University major directories.
6. **`branch`**: Maps a student's active track to a specific curriculum goal.
7. **`goal`**: The target career pathway (e.g., "Data Analyst").
8. **`session`**: Tracks historical student learning sessions.
9. **`exercise`**: Store of code blanks, MCQs, and level/expect_time metrics.
10. **`exerciseChoice`**: Options (1-4) mapped to each exercise.

### Why 9 Tables Were Removed
* **Reduced Write Amplification**: Tracking tables like `UserBehavior`, `UserPotential`, `UserSkillsPerformance`, and `EloUpdateHistory` require high-frequency writes during the Socket.IO exercise loop. Instead of writing database records on every answer, current states are kept in **Redis** and flushed as a single JSON update to `userprofile` upon session completion.
* **Flexible Dynamic Schema**: Moving competencies and prerequisites (`Skill`, `SkillPrerequisite`, `GoalSkillRequire`) into relational tables locks the curriculum into a rigid schema, requiring recursive SQL joins. Consolidating this state into the `conceptMapState` and `strengthWeaknessMatrix` `JSONB` fields of the `Userprofile` entity provides infinite schema flexibility.

---

## 2. Dynamic JSONB State Structure

The **[Userprofile](file:///D:/userprofile_project/adt-learning/server/app/src/entity/userprofile.entity.ts)** entity contains two main `jsonb` columns mapping learner status:

### 2.1 `conceptMapState`
Stores progress, BKT mastery probability ($P(L_t)$), and status (`locked`, `unlocked`, `completed`) for each Concept Node ID:
```json
{
  "variables": { "progress": 100, "mastery": 0.98, "status": "completed" },
  "loops": { "progress": 65, "mastery": 0.72, "status": "unlocked" },
  "linked-list": { "progress": 40, "mastery": 0.45, "status": "unlocked" },
  "recursion": { "progress": 0, "mastery": 0.15, "status": "locked" },
  "oop-inheritance": { "progress": 0, "mastery": 0.15, "status": "locked" }
}
```

### 2.2 `strengthWeaknessMatrix`
Stores diagnostic vector profiles based on category tags:
```json
{
  "control-flow": { "strength": 0.85, "weakness": 0.15 },
  "memory-management": { "strength": 0.40, "weakness": 0.60 }
}
```

---

## 3. Resolving Prerequisites & Learning Path Generation

The curriculum's Directed Acyclic Graph (DAG) configuration is stored statically in the backend (or cached in Redis) rather than queried via self-referential tables.

### 3.1 Prerequisite Unlock Rule
> [!IMPORTANT]
> A Concept Node unlocks if and only if **all its parent prerequisites** have reached **at least 60% progress** in the student's `conceptMapState`.

### 3.2 Implementation Example

You can implement this resolving logic in a NestJS service (e.g., `LearningEngineService` or `userProfileService`):

```typescript
// Define curriculum DAG interface
export interface ConceptNode {
  id: string;
  name: string;
  prerequisites: string[]; // List of parent Node IDs
}

// Static definition of curriculum structure
export const CURRICULUM_DAG: Record<string, ConceptNode> = {
  'variables': { id: 'variables', name: 'Variables Basics', prerequisites: [] },
  'operators': { id: 'operators', name: 'Operators', prerequisites: ['variables'] },
  'loops': { id: 'loops', name: 'Loops & Iterations', prerequisites: ['variables'] },
  'recursion': { id: 'recursion', name: 'Recursion', prerequisites: ['loops'] },
  'linked-list': { id: 'linked-list', name: 'Linked List', prerequisites: ['variables'] },
  'oop-inheritance': { id: 'oop-inheritance', name: 'OOP Inheritance', prerequisites: ['recursion', 'linked-list'] }
};

/**
 * Checks if a concept node can be unlocked for the user.
 */
export function canUnlockNode(nodeId: string, conceptMapState: any): boolean {
  const node = CURRICULUM_DAG[nodeId];
  if (!node) return false;

  // Root nodes with no prerequisites are always unlocked
  if (node.prerequisites.length === 0) return true;

  // Ensure all prerequisite nodes have progress >= 60%
  return node.prerequisites.every((prereqId) => {
    const state = conceptMapState?.[prereqId];
    return state && state.progress >= 60;
  });
}

/**
 * Computes all available nodes that the student can currently attempt.
 */
export function getAvailableLearningPath(conceptMapState: any): string[] {
  const mapState = conceptMapState || {};
  
  return Object.keys(CURRICULUM_DAG).filter((nodeId) => {
    const isCompleted = mapState[nodeId]?.status === 'completed';
    // Must not be completed yet, and all prerequisites must be satisfied
    return !isCompleted && canUnlockNode(nodeId, mapState);
  });
}
```
