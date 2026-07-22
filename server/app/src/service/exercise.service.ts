import { Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { BaseService } from "src/service/base.service";
import { Exercise } from "src/entity/exerciseAndSession/exercise.entity";
import { In, Repository } from "typeorm";
import { ExerciseChoice } from "src/entity/exerciseAndSession/exerciseChoice.entity";
import { Goal } from "src/entity/goal.entity";
import { GoalSkillRequire } from "src/entity/goalSkillRequire.entity";
import { Status } from "src/enums/status.enum";
import { CreateExerciseChoiceDto } from "src/dto/exerciseAndSession/exerciseChoice.dto";
import { CreateExerciseDto } from "src/dto/exerciseAndSession/exercise.dto";

@Injectable()
export class exerciseService extends BaseService<Exercise> {
    private readonly logger = new Logger(exerciseService.name);
    constructor(
        @InjectRepository(Exercise)
        private readonly exerciseRepository: Repository<Exercise>,
        @InjectRepository(ExerciseChoice)
        private readonly exerciseChoiceRepository: Repository<ExerciseChoice>,
        @InjectRepository(Goal)
        private readonly goalRepository: Repository<Goal>,
        @InjectRepository(GoalSkillRequire)
        private readonly goalSkillRequireRepository: Repository<GoalSkillRequire>,
    ) {
        super(exerciseRepository);
    }

    async findPretestByGoal(goalId?: number | string, userId?: number | string, level?: number) {
        this.logger.log(`Fetching pretest exercises for goalId=${goalId}, userId=${userId}, level=${level}`);
        
        let skillIds: number[] = [];
        if (goalId !== undefined && goalId !== null && goalId !== '') {
            let numericGoalId = !isNaN(Number(goalId)) ? Number(goalId) : -1;
            if (numericGoalId === -1 && typeof goalId === 'string') {
                const foundGoal = await this.goalRepository.findOne({
                    where: [
                        { goalName: goalId },
                        { goal: goalId }
                    ]
                });
                if (foundGoal) {
                    numericGoalId = foundGoal.id;
                }
            }
            if (numericGoalId !== -1) {
                const reqs = await this.goalSkillRequireRepository.find({
                    where: { goalId: numericGoalId }
                });
                skillIds = reqs.map(r => r.skillId);
            }
        }

        let choiceExercises: Exercise[] = [];
        let blankExercises: Exercise[] = [];

        if (skillIds.length > 0) {
            const allMatch = await this.exerciseRepository.find({
                where: {
                    skillId: In(skillIds),
                    status: Status.ACTIVE
                },
                relations: { exerciseChoices: true, skill: true }
            });
            choiceExercises = allMatch.filter(ex => !ex.fillInBlank || ex.fillInBlank.trim() === '');
            blankExercises = allMatch.filter(ex => ex.fillInBlank && ex.fillInBlank.trim() !== '');
        }

        if (choiceExercises.length === 0 && blankExercises.length === 0) {
            this.logger.warn(`No exercises found for goalId=${goalId} (or no skills mapped). Falling back to active DB exercises.`);
            const allExercises = await this.exerciseRepository.find({
                where: { status: Status.ACTIVE },
                relations: { exerciseChoices: true, skill: true }
            });
            choiceExercises = allExercises.filter(ex => !ex.fillInBlank || ex.fillInBlank.trim() === '');
            blankExercises = allExercises.filter(ex => ex.fillInBlank && ex.fillInBlank.trim() !== '');
        }

        if (choiceExercises.length === 0 && blankExercises.length === 0) {
            this.logger.warn("DB has 0 exercises. Returning mock fallback choice & fill-in-blank exercises for pretest.");
            return this.getMockPretestExercises();
        }

        const targetTotal = 5;
        const resultPool: Exercise[] = [];
        const shuffledChoices = [...choiceExercises].sort(() => 0.5 - Math.random());
        const shuffledBlanks = [...blankExercises].sort(() => 0.5 - Math.random());

        let cIdx = 0;
        let bIdx = 0;
        while (resultPool.length < targetTotal && (cIdx < shuffledChoices.length || bIdx < shuffledBlanks.length)) {
            const pickChoice = Math.random() < 0.5;
            if (pickChoice && cIdx < shuffledChoices.length) {
                resultPool.push(shuffledChoices[cIdx++]);
            } else if (!pickChoice && bIdx < shuffledBlanks.length) {
                resultPool.push(shuffledBlanks[bIdx++]);
            } else if (cIdx < shuffledChoices.length) {
                resultPool.push(shuffledChoices[cIdx++]);
            } else if (bIdx < shuffledBlanks.length) {
                resultPool.push(shuffledBlanks[bIdx++]);
            }
        }

        const selected = resultPool.sort(() => 0.5 - Math.random());

        return selected.map(ex => {
            const isBlank = Boolean(ex.fillInBlank && ex.fillInBlank.trim() !== '');
            const choices = ex.exerciseChoices || [];
            const answerChoiceIndex = choices.findIndex(c => c.isAnswer);
            return {
                id: ex.id,
                skillId: ex.skillId,
                skillName: ex.skill?.skillsName || `Skill ${ex.skillId}`,
                level: ex.level || 1,
                description: ex.description,
                text: ex.description,
                type: isBlank ? 'FILL_IN_BLANK' : 'CHOICE',
                fillInBlank: isBlank ? ex.fillInBlank : null,
                isCasesensitive: ex.isCasesensitive || 'NO',
                exerciseChoices: choices,
                choices: choices.map(c => c.script),
                answer: isBlank ? ex.fillInBlank : answerChoiceIndex
            };
        });
    }

    private getMockPretestExercises() {
        return [
            {
                id: 101,
                skillId: 1,
                skillName: 'Python Fundamentals',
                level: 1,
                description: 'ผลลัพธ์ของโค้ด x = 10; y = 3; print(x % y) คืออะไร?',
                text: 'ผลลัพธ์ของโค้ด x = 10; y = 3; print(x % y) คืออะไร?',
                type: 'CHOICE',
                fillInBlank: null,
                isCasesensitive: 'NO',
                exerciseChoices: [
                    { id: 1, script: '0', isAnswer: false },
                    { id: 2, script: '1', isAnswer: true },
                    { id: 3, script: '3', isAnswer: false },
                    { id: 4, script: '3.33', isAnswer: false }
                ],
                choices: ['0', '1', '3', '3.33'],
                answer: 1
            },
            {
                id: 102,
                skillId: 2,
                skillName: 'Control Flow',
                level: 2,
                description: 'คำสั่งใน Python สำหรับวนลูปที่มีจำนวนรอบแน่นอน คือคำสั่งใด (พิมพ์คำสั่ง 1 คำ)?',
                text: 'คำสั่งใน Python สำหรับวนลูปที่มีจำนวนรอบแน่นอน คือคำสั่งใด (พิมพ์คำสั่ง 1 คำ)?',
                type: 'FILL_IN_BLANK',
                fillInBlank: 'for',
                isCasesensitive: 'NO',
                exerciseChoices: [],
                choices: [],
                answer: 'for'
            },
            {
                id: 103,
                skillId: 3,
                skillName: 'Functions',
                level: 3,
                description: 'ฟังก์ชัน mystery(n) ที่คืนค่า n * mystery(n-1) เมื่อ n <= 1 คืนค่า 1 ถ้าเรียก mystery(4) จะได้ผลลัพธ์เท่าใด?',
                text: 'ฟังก์ชัน mystery(n) ที่คืนค่า n * mystery(n-1) เมื่อ n <= 1 คืนค่า 1 ถ้าเรียก mystery(4) จะได้ผลลัพธ์เท่าใด?',
                type: 'CHOICE',
                fillInBlank: null,
                isCasesensitive: 'NO',
                exerciseChoices: [
                    { id: 5, script: '12', isAnswer: false },
                    { id: 6, script: '24', isAnswer: true },
                    { id: 7, script: '6', isAnswer: false },
                    { id: 8, script: '16', isAnswer: false }
                ],
                choices: ['12', '24', '6', '16'],
                answer: 1
            },
            {
                id: 104,
                skillId: 4,
                skillName: 'Data Structures',
                level: 2,
                description: 'เมธอดที่ใช้สำหรับเพิ่มสมาชิกใหม่ต่อท้าย List ใน Python คือคำสั่งใด (พิมพ์ชื่อเมธอด)?',
                text: 'เมธอดที่ใช้สำหรับเพิ่มสมาชิกใหม่ต่อท้าย List ใน Python คือคำสั่งใด (พิมพ์ชื่อเมธอด)?',
                type: 'FILL_IN_BLANK',
                fillInBlank: 'append',
                isCasesensitive: 'NO',
                exerciseChoices: [],
                choices: [],
                answer: 'append'
            },
            {
                id: 105,
                skillId: 5,
                skillName: 'Sort & Search',
                level: 4,
                description: 'Binary Search มีเงื่อนไขสำคัญอะไรในการใช้งาน?',
                text: 'Binary Search มีเงื่อนไขสำคัญอะไรในการใช้งาน?',
                type: 'CHOICE',
                fillInBlank: null,
                isCasesensitive: 'NO',
                exerciseChoices: [
                    { id: 9, script: 'Array ไม่จำเป็นต้องเรียงลำดับ', isAnswer: false },
                    { id: 10, script: 'Array ต้องเรียงลำดับ (Sorted) มาก่อนเสมอ', isAnswer: true },
                    { id: 11, script: 'Array ต้องมีเฉพาะตัวเลขจำนวนเต็มเท่านั้น', isAnswer: false },
                    { id: 12, script: 'ใช้ได้เฉพาะกับ Linked List', isAnswer: false }
                ],
                choices: ['Array ไม่จำเป็นต้องเรียงลำดับ', 'Array ต้องเรียงลำดับ (Sorted) มาก่อนเสมอ', 'Array ต้องมีเฉพาะตัวเลขจำนวนเต็มเท่านั้น', 'ใช้ได้เฉพาะกับ Linked List'],
                answer: 1
            }
        ];
    }

    async createExercise(exercise: CreateExerciseDto, exerciseChoices: CreateExerciseChoiceDto[]){
        const result = await this.exerciseRepository.save(exercise);
        this.logger.log("exercise result",result)
        exerciseChoices.forEach(exerciseChoice => {
            exerciseChoice.exerciseId = result.id;
        });
        const resultOfChoice = await this.exerciseChoiceRepository.save(exerciseChoices);
        this.logger.log("exercise choice result",resultOfChoice)
        const response = {
            exercise: result,
            exerciseChoices: resultOfChoice
        }
        return response;
    }
}
