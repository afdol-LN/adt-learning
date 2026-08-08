import { MigrationInterface, QueryRunner } from 'typeorm';

export class UpdateSchem1783767970151 implements MigrationInterface {
  name = 'UpdateSchem1783767970151';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "userprofile" DROP COLUMN "firstName"`,
    );
    await queryRunner.query(`ALTER TABLE "userprofile" DROP COLUMN "lastName"`);
    await queryRunner.query(
      `ALTER TABLE "userprofile" ADD "fullName" character varying(100) NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "gender" ALTER COLUMN "createdAt" SET DEFAULT now()`,
    );
    await queryRunner.query(
      `ALTER TABLE "gender" ALTER COLUMN "updatedAt" SET DEFAULT now()`,
    );
    await queryRunner.query(
      `ALTER TABLE "major" DROP CONSTRAINT "FK_ac4bdd43e2f613aca140c937fbe"`,
    );
    await queryRunner.query(
      `ALTER TABLE "major" DROP CONSTRAINT "REL_ac4bdd43e2f613aca140c937fb"`,
    );
    await queryRunner.query(
      `ALTER TABLE "faculty" DROP CONSTRAINT "FK_462289c7845fba8356017318f71"`,
    );
    await queryRunner.query(
      `ALTER TABLE "faculty" DROP CONSTRAINT "REL_462289c7845fba8356017318f7"`,
    );
    await queryRunner.query(
      `ALTER TABLE "userprofile" DROP CONSTRAINT "FK_44c83d58803b1edafd245e14713"`,
    );
    await queryRunner.query(
      `ALTER TABLE "userprofile" DROP CONSTRAINT "FK_e270ac3a7edce90f113f77b78a4"`,
    );
    await queryRunner.query(
      `ALTER TABLE "userprofile" DROP CONSTRAINT "FK_d11492054b4aabfbab8cb3045be"`,
    );
    await queryRunner.query(
      `ALTER TABLE "userprofile" DROP CONSTRAINT "FK_aa1ff8b13d8e063f8e9de9a49e5"`,
    );
    await queryRunner.query(
      `ALTER TABLE "userprofile" DROP CONSTRAINT "REL_44c83d58803b1edafd245e1471"`,
    );
    await queryRunner.query(
      `ALTER TABLE "userprofile" ALTER COLUMN "genderId" SET DEFAULT '1'`,
    );
    await queryRunner.query(
      `ALTER TABLE "userprofile" ALTER COLUMN "campusId" DROP NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "userprofile" DROP CONSTRAINT "REL_e270ac3a7edce90f113f77b78a"`,
    );
    await queryRunner.query(
      `ALTER TABLE "userprofile" ALTER COLUMN "facultyId" DROP NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "userprofile" DROP CONSTRAINT "REL_d11492054b4aabfbab8cb3045b"`,
    );
    await queryRunner.query(
      `ALTER TABLE "userprofile" ALTER COLUMN "majorId" DROP NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "userprofile" DROP CONSTRAINT "REL_aa1ff8b13d8e063f8e9de9a49e"`,
    );
    await queryRunner.query(
      `ALTER TABLE "branch" DROP CONSTRAINT "FK_f969fd357b4491268a4520e8a07"`,
    );
    await queryRunner.query(
      `ALTER TABLE "branch" DROP CONSTRAINT "FK_e6aa5e90fc6f46e5a6ef66a3eae"`,
    );
    await queryRunner.query(
      `ALTER TABLE "branch" DROP CONSTRAINT "REL_f969fd357b4491268a4520e8a0"`,
    );
    await queryRunner.query(
      `ALTER TABLE "branch" DROP CONSTRAINT "REL_e6aa5e90fc6f46e5a6ef66a3ea"`,
    );
    await queryRunner.query(
      `ALTER TABLE "major" ADD CONSTRAINT "FK_ac4bdd43e2f613aca140c937fbe" FOREIGN KEY ("facultyId") REFERENCES "faculty"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "faculty" ADD CONSTRAINT "FK_462289c7845fba8356017318f71" FOREIGN KEY ("campusId") REFERENCES "campus"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "userprofile" ADD CONSTRAINT "FK_44c83d58803b1edafd245e14713" FOREIGN KEY ("genderId") REFERENCES "gender"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "userprofile" ADD CONSTRAINT "FK_e270ac3a7edce90f113f77b78a4" FOREIGN KEY ("campusId") REFERENCES "campus"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "userprofile" ADD CONSTRAINT "FK_d11492054b4aabfbab8cb3045be" FOREIGN KEY ("facultyId") REFERENCES "faculty"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "userprofile" ADD CONSTRAINT "FK_aa1ff8b13d8e063f8e9de9a49e5" FOREIGN KEY ("majorId") REFERENCES "major"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "branch" ADD CONSTRAINT "FK_f969fd357b4491268a4520e8a07" FOREIGN KEY ("userId") REFERENCES "userprofile"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "branch" ADD CONSTRAINT "FK_e6aa5e90fc6f46e5a6ef66a3eae" FOREIGN KEY ("goalId") REFERENCES "goal"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "branch" DROP CONSTRAINT "FK_e6aa5e90fc6f46e5a6ef66a3eae"`,
    );
    await queryRunner.query(
      `ALTER TABLE "branch" DROP CONSTRAINT "FK_f969fd357b4491268a4520e8a07"`,
    );
    await queryRunner.query(
      `ALTER TABLE "userprofile" DROP CONSTRAINT "FK_aa1ff8b13d8e063f8e9de9a49e5"`,
    );
    await queryRunner.query(
      `ALTER TABLE "userprofile" DROP CONSTRAINT "FK_d11492054b4aabfbab8cb3045be"`,
    );
    await queryRunner.query(
      `ALTER TABLE "userprofile" DROP CONSTRAINT "FK_e270ac3a7edce90f113f77b78a4"`,
    );
    await queryRunner.query(
      `ALTER TABLE "userprofile" DROP CONSTRAINT "FK_44c83d58803b1edafd245e14713"`,
    );
    await queryRunner.query(
      `ALTER TABLE "faculty" DROP CONSTRAINT "FK_462289c7845fba8356017318f71"`,
    );
    await queryRunner.query(
      `ALTER TABLE "major" DROP CONSTRAINT "FK_ac4bdd43e2f613aca140c937fbe"`,
    );
    await queryRunner.query(
      `ALTER TABLE "branch" ADD CONSTRAINT "REL_e6aa5e90fc6f46e5a6ef66a3ea" UNIQUE ("goalId")`,
    );
    await queryRunner.query(
      `ALTER TABLE "branch" ADD CONSTRAINT "REL_f969fd357b4491268a4520e8a0" UNIQUE ("userId")`,
    );
    await queryRunner.query(
      `ALTER TABLE "branch" ADD CONSTRAINT "FK_e6aa5e90fc6f46e5a6ef66a3eae" FOREIGN KEY ("goalId") REFERENCES "goal"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "branch" ADD CONSTRAINT "FK_f969fd357b4491268a4520e8a07" FOREIGN KEY ("userId") REFERENCES "userprofile"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "userprofile" ADD CONSTRAINT "REL_aa1ff8b13d8e063f8e9de9a49e" UNIQUE ("majorId")`,
    );
    await queryRunner.query(
      `ALTER TABLE "userprofile" ALTER COLUMN "majorId" SET NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "userprofile" ADD CONSTRAINT "REL_d11492054b4aabfbab8cb3045b" UNIQUE ("facultyId")`,
    );
    await queryRunner.query(
      `ALTER TABLE "userprofile" ALTER COLUMN "facultyId" SET NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "userprofile" ADD CONSTRAINT "REL_e270ac3a7edce90f113f77b78a" UNIQUE ("campusId")`,
    );
    await queryRunner.query(
      `ALTER TABLE "userprofile" ALTER COLUMN "campusId" SET NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "userprofile" ALTER COLUMN "genderId" DROP DEFAULT`,
    );
    await queryRunner.query(
      `ALTER TABLE "userprofile" ADD CONSTRAINT "REL_44c83d58803b1edafd245e1471" UNIQUE ("genderId")`,
    );
    await queryRunner.query(
      `ALTER TABLE "userprofile" ADD CONSTRAINT "FK_aa1ff8b13d8e063f8e9de9a49e5" FOREIGN KEY ("majorId") REFERENCES "major"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "userprofile" ADD CONSTRAINT "FK_d11492054b4aabfbab8cb3045be" FOREIGN KEY ("facultyId") REFERENCES "faculty"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "userprofile" ADD CONSTRAINT "FK_e270ac3a7edce90f113f77b78a4" FOREIGN KEY ("campusId") REFERENCES "campus"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "userprofile" ADD CONSTRAINT "FK_44c83d58803b1edafd245e14713" FOREIGN KEY ("genderId") REFERENCES "gender"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "faculty" ADD CONSTRAINT "REL_462289c7845fba8356017318f7" UNIQUE ("campusId")`,
    );
    await queryRunner.query(
      `ALTER TABLE "faculty" ADD CONSTRAINT "FK_462289c7845fba8356017318f71" FOREIGN KEY ("campusId") REFERENCES "campus"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "major" ADD CONSTRAINT "REL_ac4bdd43e2f613aca140c937fb" UNIQUE ("facultyId")`,
    );
    await queryRunner.query(
      `ALTER TABLE "major" ADD CONSTRAINT "FK_ac4bdd43e2f613aca140c937fbe" FOREIGN KEY ("facultyId") REFERENCES "faculty"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "gender" ALTER COLUMN "updatedAt" DROP DEFAULT`,
    );
    await queryRunner.query(
      `ALTER TABLE "gender" ALTER COLUMN "createdAt" DROP DEFAULT`,
    );
    await queryRunner.query(`ALTER TABLE "userprofile" DROP COLUMN "fullName"`);
    await queryRunner.query(
      `ALTER TABLE "userprofile" ADD "lastName" character varying NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "userprofile" ADD "firstName" character varying NOT NULL`,
    );
  }
}
