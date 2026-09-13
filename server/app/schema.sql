


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE TYPE "public"."exercise_status_enum" AS ENUM (
    'active',
    'inactive'
);


ALTER TYPE "public"."exercise_status_enum" OWNER TO "postgres";


CREATE TYPE "public"."exercise_type_enum" AS ENUM (
    'CHOICE',
    'FILL_IN_BLANK'
);


ALTER TYPE "public"."exercise_type_enum" OWNER TO "postgres";


CREATE TYPE "public"."goal_status_enum" AS ENUM (
    'active',
    'inactive'
);


ALTER TYPE "public"."goal_status_enum" OWNER TO "postgres";


CREATE TYPE "public"."skill_status_enum" AS ENUM (
    'active',
    'inactive'
);


ALTER TYPE "public"."skill_status_enum" OWNER TO "postgres";


CREATE TYPE "public"."userprofile_role_enum" AS ENUM (
    'admin',
    'user'
);


ALTER TYPE "public"."userprofile_role_enum" OWNER TO "postgres";


CREATE TYPE "public"."userprofile_status_enum" AS ENUM (
    'active',
    'inactive'
);


ALTER TYPE "public"."userprofile_status_enum" OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."GoalskillRequire" (
    "goal_id" integer NOT NULL,
    "skill_id" integer NOT NULL,
    "level_require" integer
);


ALTER TABLE "public"."GoalskillRequire" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."branch" (
    "id" integer NOT NULL,
    "userId" integer NOT NULL,
    "goalId" integer NOT NULL,
    "createdAt" timestamp without time zone DEFAULT "now"() NOT NULL,
    "updatedAt" timestamp without time zone DEFAULT "now"() NOT NULL,
    "exp_for_goal" integer,
    "isAlreadyPretest" boolean DEFAULT false NOT NULL
);


ALTER TABLE "public"."branch" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."branch_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."branch_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."branch_id_seq" OWNED BY "public"."branch"."id";



CREATE TABLE IF NOT EXISTS "public"."campus" (
    "id" integer NOT NULL,
    "campus" character varying NOT NULL,
    "createdAt" timestamp without time zone DEFAULT "now"() NOT NULL,
    "updatedAt" timestamp without time zone DEFAULT "now"() NOT NULL,
    "campusId" character varying NOT NULL
);


ALTER TABLE "public"."campus" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."campus_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."campus_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."campus_id_seq" OWNED BY "public"."campus"."id";



CREATE TABLE IF NOT EXISTS "public"."exercise" (
    "id" integer NOT NULL,
    "description" character varying NOT NULL,
    "level" integer NOT NULL,
    "status" "public"."exercise_status_enum" DEFAULT 'active'::"public"."exercise_status_enum" NOT NULL,
    "createdAt" timestamp without time zone DEFAULT "now"() NOT NULL,
    "updatedAt" timestamp without time zone DEFAULT "now"() NOT NULL,
    "expect_time" integer,
    "skill_id" integer NOT NULL,
    "fillInBlank" character varying,
    "isCasesensitive" character varying DEFAULT 'NO'::character varying,
    "skill_level" integer NOT NULL,
    "type" "public"."exercise_type_enum" DEFAULT 'CHOICE'::"public"."exercise_type_enum" NOT NULL,
    "pG" double precision DEFAULT '0.1'::double precision NOT NULL,
    "pS" double precision DEFAULT '0.1'::double precision NOT NULL
);


ALTER TABLE "public"."exercise" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."exerciseChoice" (
    "id" integer NOT NULL,
    "isAnswer" boolean NOT NULL,
    "createdAt" timestamp without time zone DEFAULT "now"() NOT NULL,
    "updatedAt" timestamp without time zone DEFAULT "now"() NOT NULL,
    "exerciseId" integer,
    "script" character varying(80)
);


ALTER TABLE "public"."exerciseChoice" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."exerciseChoice_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."exerciseChoice_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."exerciseChoice_id_seq" OWNED BY "public"."exerciseChoice"."id";



CREATE SEQUENCE IF NOT EXISTS "public"."exercise_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."exercise_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."exercise_id_seq" OWNED BY "public"."exercise"."id";



CREATE TABLE IF NOT EXISTS "public"."exercise_session" (
    "session_id" integer NOT NULL,
    "exercise_id" integer NOT NULL
);


ALTER TABLE "public"."exercise_session" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."faculty" (
    "id" integer NOT NULL,
    "faculty" character varying NOT NULL,
    "campusId" integer NOT NULL,
    "createdAt" timestamp without time zone DEFAULT "now"() NOT NULL,
    "updatedAt" timestamp without time zone DEFAULT "now"() NOT NULL,
    "facultyId" character varying NOT NULL
);


ALTER TABLE "public"."faculty" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."faculty_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."faculty_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."faculty_id_seq" OWNED BY "public"."faculty"."id";



CREATE TABLE IF NOT EXISTS "public"."gender" (
    "id" integer NOT NULL,
    "gender" character varying NOT NULL,
    "createdAt" timestamp without time zone DEFAULT "now"() NOT NULL,
    "updatedAt" timestamp without time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."gender" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."gender_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."gender_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."gender_id_seq" OWNED BY "public"."gender"."id";



CREATE TABLE IF NOT EXISTS "public"."goal" (
    "id" integer NOT NULL,
    "goal" character varying,
    "createdAt" timestamp without time zone DEFAULT "now"() NOT NULL,
    "updatedAt" timestamp without time zone DEFAULT "now"() NOT NULL,
    "goal_description" character varying(255),
    "status" "public"."goal_status_enum" DEFAULT 'active'::"public"."goal_status_enum" NOT NULL
);


ALTER TABLE "public"."goal" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."goal_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."goal_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."goal_id_seq" OWNED BY "public"."goal"."id";



CREATE TABLE IF NOT EXISTS "public"."history" (
    "id" integer NOT NULL,
    "branchId" integer NOT NULL,
    "sessionAndExerciseId" integer NOT NULL,
    "isCorrect" boolean DEFAULT false NOT NULL,
    "isPretest" boolean DEFAULT false NOT NULL,
    "startTime" timestamp without time zone NOT NULL,
    "endTime" timestamp without time zone DEFAULT "now"() NOT NULL,
    "chosenAnswer" character varying,
    "pL" double precision
);


ALTER TABLE "public"."history" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."history_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."history_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."history_id_seq" OWNED BY "public"."history"."id";



CREATE TABLE IF NOT EXISTS "public"."major" (
    "id" integer NOT NULL,
    "major" character varying NOT NULL,
    "facultyId" integer NOT NULL,
    "createdAt" timestamp without time zone DEFAULT "now"() NOT NULL,
    "updatedAt" timestamp without time zone DEFAULT "now"() NOT NULL,
    "majorId" character varying NOT NULL,
    "isAboutCs" boolean DEFAULT false NOT NULL
);


ALTER TABLE "public"."major" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."major_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."major_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."major_id_seq" OWNED BY "public"."major"."id";



CREATE TABLE IF NOT EXISTS "public"."migrations" (
    "id" integer NOT NULL,
    "timestamp" bigint NOT NULL,
    "name" character varying NOT NULL
);


ALTER TABLE "public"."migrations" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."migrations_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."migrations_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."migrations_id_seq" OWNED BY "public"."migrations"."id";



CREATE TABLE IF NOT EXISTS "public"."session" (
    "session_id" integer NOT NULL,
    "create_at" timestamp without time zone DEFAULT "now"() NOT NULL,
    "branchId" integer,
    "skillId" integer,
    "endedAt" timestamp without time zone,
    "stopReason" character varying
);


ALTER TABLE "public"."session" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."sessionAndExercise" (
    "id" integer NOT NULL,
    "exerciseId" integer NOT NULL,
    "sessionId" integer NOT NULL
);


ALTER TABLE "public"."sessionAndExercise" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."sessionAndExercise_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."sessionAndExercise_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."sessionAndExercise_id_seq" OWNED BY "public"."sessionAndExercise"."id";



CREATE TABLE IF NOT EXISTS "public"."sessionExcercise" (
    "id" integer NOT NULL
);


ALTER TABLE "public"."sessionExcercise" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."sessionExcercise_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."sessionExcercise_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."sessionExcercise_id_seq" OWNED BY "public"."sessionExcercise"."id";



CREATE TABLE IF NOT EXISTS "public"."session_excercise_exercises_exercise" (
    "sessionExcerciseId" integer NOT NULL,
    "exerciseId" integer NOT NULL
);


ALTER TABLE "public"."session_excercise_exercises_exercise" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."session_session_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."session_session_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."session_session_id_seq" OWNED BY "public"."session"."session_id";



CREATE TABLE IF NOT EXISTS "public"."skill" (
    "skill_id" integer NOT NULL,
    "skills_name" character varying(30) NOT NULL,
    "tier" character varying(10),
    "status" "public"."skill_status_enum" DEFAULT 'active'::"public"."skill_status_enum" NOT NULL,
    "skillCode" character varying NOT NULL,
    "pL0" double precision DEFAULT '0.25'::double precision NOT NULL,
    "pT" double precision DEFAULT '0.1'::double precision NOT NULL
);


ALTER TABLE "public"."skill" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."skill_skill_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."skill_skill_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."skill_skill_id_seq" OWNED BY "public"."skill"."skill_id";



CREATE TABLE IF NOT EXISTS "public"."skills_prerequisite" (
    "skill_id" integer NOT NULL,
    "prerequisite_skill" integer NOT NULL,
    "Prerequisite_level" integer
);


ALTER TABLE "public"."skills_prerequisite" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."userprofile" (
    "id" integer NOT NULL,
    "genderId" integer DEFAULT 1 NOT NULL,
    "birthDate" character varying NOT NULL,
    "campusId" integer,
    "facultyId" integer,
    "majorId" integer,
    "createdAt" timestamp without time zone DEFAULT "now"() NOT NULL,
    "updatedAt" timestamp without time zone DEFAULT "now"() NOT NULL,
    "role" "public"."userprofile_role_enum" DEFAULT 'user'::"public"."userprofile_role_enum" NOT NULL,
    "username" character varying(20),
    "behaviorScore" numeric(4,3),
    "conceptMapState" "jsonb",
    "strengthWeaknessMatrix" "jsonb",
    "password" character varying(80),
    "fullName" character varying(100) NOT NULL,
    "status" "public"."userprofile_status_enum" DEFAULT 'active'::"public"."userprofile_status_enum" NOT NULL,
    "year" integer,
    "isEverTour" boolean DEFAULT false NOT NULL
);


ALTER TABLE "public"."userprofile" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."userprofile_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."userprofile_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."userprofile_id_seq" OWNED BY "public"."userprofile"."id";



ALTER TABLE ONLY "public"."branch" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."branch_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."campus" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."campus_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."exercise" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."exercise_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."exerciseChoice" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."exerciseChoice_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."faculty" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."faculty_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."gender" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."gender_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."goal" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."goal_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."history" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."history_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."major" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."major_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."migrations" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."migrations_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."session" ALTER COLUMN "session_id" SET DEFAULT "nextval"('"public"."session_session_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."sessionAndExercise" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."sessionAndExercise_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."sessionExcercise" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."sessionExcercise_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."skill" ALTER COLUMN "skill_id" SET DEFAULT "nextval"('"public"."skill_skill_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."userprofile" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."userprofile_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."major"
    ADD CONSTRAINT "PK_00341ff87e17ae50751c5da05ad" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."campus"
    ADD CONSTRAINT "PK_150aa1747b3517c47f9bd98ea6d" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."branch"
    ADD CONSTRAINT "PK_2e39f426e2faefdaa93c5961976" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."sessionExcercise"
    ADD CONSTRAINT "PK_3b41efd64df03e82c9274cd9898" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."faculty"
    ADD CONSTRAINT "PK_635ca3484f9c747b6635a494ad9" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."sessionAndExercise"
    ADD CONSTRAINT "PK_64c310cf8715d77e3a09cada1bc" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."userprofile"
    ADD CONSTRAINT "PK_7611eb6ce0cfd2de134000d0b8f" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."exercise_session"
    ADD CONSTRAINT "PK_880463192f1f9705afa5e2c5cf5" PRIMARY KEY ("session_id", "exercise_id");



ALTER TABLE ONLY "public"."goal"
    ADD CONSTRAINT "PK_88c8e2b461b711336c836b1e130" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."session"
    ADD CONSTRAINT "PK_8ba62b11184a8d3312278d4d1ac" PRIMARY KEY ("session_id");



ALTER TABLE ONLY "public"."migrations"
    ADD CONSTRAINT "PK_8c82d7f526340ab734260ea46be" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."history"
    ADD CONSTRAINT "PK_9384942edf4804b38ca0ee51416" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."skills_prerequisite"
    ADD CONSTRAINT "PK_9871929a234489a25c79c59881c" PRIMARY KEY ("skill_id", "prerequisite_skill");



ALTER TABLE ONLY "public"."gender"
    ADD CONSTRAINT "PK_98a711129bc073e6312d08364e8" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."skill"
    ADD CONSTRAINT "PK_9ad49f5c60b5cfd0c7bd4fe87a4" PRIMARY KEY ("skill_id");



ALTER TABLE ONLY "public"."exercise"
    ADD CONSTRAINT "PK_a0f107e3a2ef2742c1e91d97c14" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."session_excercise_exercises_exercise"
    ADD CONSTRAINT "PK_b4dfc1f5e40e0f21817e71e7ec0" PRIMARY KEY ("sessionExcerciseId", "exerciseId");



ALTER TABLE ONLY "public"."GoalskillRequire"
    ADD CONSTRAINT "PK_c9a4e8037ca1fc72e1fde3d6932" PRIMARY KEY ("goal_id", "skill_id");



ALTER TABLE ONLY "public"."exerciseChoice"
    ADD CONSTRAINT "PK_e88943facf79c0f5daf47a5e28d" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."campus"
    ADD CONSTRAINT "UQ_43400407f9d1a0498c3dc0ecc45" UNIQUE ("campusId");



ALTER TABLE ONLY "public"."major"
    ADD CONSTRAINT "UQ_47e1c8a19666fc7ba8e94ff9c12" UNIQUE ("majorId");



ALTER TABLE ONLY "public"."skill"
    ADD CONSTRAINT "UQ_a36c25f4a6a10500e264d263822" UNIQUE ("skillCode");



ALTER TABLE ONLY "public"."faculty"
    ADD CONSTRAINT "UQ_dc61338eeb239be5c072b974bc0" UNIQUE ("facultyId");



CREATE INDEX "IDX_03dcc399e441f687b42468fcce" ON "public"."exercise_session" USING "btree" ("session_id");



CREATE INDEX "IDX_29f8d8ee6bf309d2407f64f0bb" ON "public"."exercise_session" USING "btree" ("exercise_id");



CREATE INDEX "IDX_408bea27e7252cef96ac54f201" ON "public"."session_excercise_exercises_exercise" USING "btree" ("exerciseId");



CREATE INDEX "IDX_4d606e0535d4660e72378ee51c" ON "public"."exercise" USING "btree" ("skill_id");



CREATE INDEX "IDX_943f1e701505b2c3a2768c8cd7" ON "public"."sessionAndExercise" USING "btree" ("exerciseId");



CREATE INDEX "IDX_9b403df1cd6c12e25fc6ed36b6" ON "public"."sessionAndExercise" USING "btree" ("sessionId");



CREATE INDEX "IDX_9e202b54d367400e0c24be6c80" ON "public"."history" USING "btree" ("branchId");



CREATE INDEX "IDX_b8b144ec75b276a19f69b60f12" ON "public"."exercise" USING "btree" ("level");



CREATE INDEX "IDX_e186da3fbc4e778e129595d2e0" ON "public"."history" USING "btree" ("sessionAndExerciseId");



CREATE INDEX "IDX_f9b60dd8b013aedc7d39e37efe" ON "public"."session_excercise_exercises_exercise" USING "btree" ("sessionExcerciseId");



ALTER TABLE ONLY "public"."exercise_session"
    ADD CONSTRAINT "FK_03dcc399e441f687b42468fcce8" FOREIGN KEY ("session_id") REFERENCES "public"."session"("session_id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."GoalskillRequire"
    ADD CONSTRAINT "FK_1103603a537595a59e13d330bdc" FOREIGN KEY ("skill_id") REFERENCES "public"."skill"("skill_id");



ALTER TABLE ONLY "public"."exercise_session"
    ADD CONSTRAINT "FK_29f8d8ee6bf309d2407f64f0bb7" FOREIGN KEY ("exercise_id") REFERENCES "public"."exercise"("id");



ALTER TABLE ONLY "public"."skills_prerequisite"
    ADD CONSTRAINT "FK_37576f552aa89a3499312d86785" FOREIGN KEY ("skill_id") REFERENCES "public"."skill"("skill_id");



ALTER TABLE ONLY "public"."session_excercise_exercises_exercise"
    ADD CONSTRAINT "FK_408bea27e7252cef96ac54f201d" FOREIGN KEY ("exerciseId") REFERENCES "public"."exercise"("id");



ALTER TABLE ONLY "public"."userprofile"
    ADD CONSTRAINT "FK_44c83d58803b1edafd245e14713" FOREIGN KEY ("genderId") REFERENCES "public"."gender"("id");



ALTER TABLE ONLY "public"."faculty"
    ADD CONSTRAINT "FK_462289c7845fba8356017318f71" FOREIGN KEY ("campusId") REFERENCES "public"."campus"("id");



ALTER TABLE ONLY "public"."exercise"
    ADD CONSTRAINT "FK_4d606e0535d4660e72378ee51c7" FOREIGN KEY ("skill_id") REFERENCES "public"."skill"("skill_id");



ALTER TABLE ONLY "public"."GoalskillRequire"
    ADD CONSTRAINT "FK_55f3d243ed490d95ac2ae555293" FOREIGN KEY ("goal_id") REFERENCES "public"."goal"("id");



ALTER TABLE ONLY "public"."exerciseChoice"
    ADD CONSTRAINT "FK_844b1a843ec0efffd77b293a0ed" FOREIGN KEY ("exerciseId") REFERENCES "public"."exercise"("id");



ALTER TABLE ONLY "public"."skills_prerequisite"
    ADD CONSTRAINT "FK_9051a94500517a33b1454f0b8df" FOREIGN KEY ("prerequisite_skill") REFERENCES "public"."skill"("skill_id");



ALTER TABLE ONLY "public"."sessionAndExercise"
    ADD CONSTRAINT "FK_943f1e701505b2c3a2768c8cd77" FOREIGN KEY ("exerciseId") REFERENCES "public"."exercise"("id");



ALTER TABLE ONLY "public"."sessionAndExercise"
    ADD CONSTRAINT "FK_9b403df1cd6c12e25fc6ed36b63" FOREIGN KEY ("sessionId") REFERENCES "public"."session"("session_id");



ALTER TABLE ONLY "public"."history"
    ADD CONSTRAINT "FK_9e202b54d367400e0c24be6c807" FOREIGN KEY ("branchId") REFERENCES "public"."branch"("id");



ALTER TABLE ONLY "public"."userprofile"
    ADD CONSTRAINT "FK_aa1ff8b13d8e063f8e9de9a49e5" FOREIGN KEY ("majorId") REFERENCES "public"."major"("id");



ALTER TABLE ONLY "public"."major"
    ADD CONSTRAINT "FK_ac4bdd43e2f613aca140c937fbe" FOREIGN KEY ("facultyId") REFERENCES "public"."faculty"("id");



ALTER TABLE ONLY "public"."userprofile"
    ADD CONSTRAINT "FK_d11492054b4aabfbab8cb3045be" FOREIGN KEY ("facultyId") REFERENCES "public"."faculty"("id");



ALTER TABLE ONLY "public"."session"
    ADD CONSTRAINT "FK_d352d1ff0a85e7c48ddd45a772c" FOREIGN KEY ("skillId") REFERENCES "public"."skill"("skill_id");



ALTER TABLE ONLY "public"."history"
    ADD CONSTRAINT "FK_e186da3fbc4e778e129595d2e06" FOREIGN KEY ("sessionAndExerciseId") REFERENCES "public"."sessionAndExercise"("id");



ALTER TABLE ONLY "public"."session"
    ADD CONSTRAINT "FK_e21b828aabfcb00966b88118e2c" FOREIGN KEY ("branchId") REFERENCES "public"."branch"("id");



ALTER TABLE ONLY "public"."userprofile"
    ADD CONSTRAINT "FK_e270ac3a7edce90f113f77b78a4" FOREIGN KEY ("campusId") REFERENCES "public"."campus"("id");



ALTER TABLE ONLY "public"."branch"
    ADD CONSTRAINT "FK_e6aa5e90fc6f46e5a6ef66a3eae" FOREIGN KEY ("goalId") REFERENCES "public"."goal"("id");



ALTER TABLE ONLY "public"."branch"
    ADD CONSTRAINT "FK_f969fd357b4491268a4520e8a07" FOREIGN KEY ("userId") REFERENCES "public"."userprofile"("id");



ALTER TABLE ONLY "public"."session_excercise_exercises_exercise"
    ADD CONSTRAINT "FK_f9b60dd8b013aedc7d39e37efee" FOREIGN KEY ("sessionExcerciseId") REFERENCES "public"."sessionExcercise"("id") ON UPDATE CASCADE ON DELETE CASCADE;





ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";





































































































































































GRANT ALL ON TABLE "public"."GoalskillRequire" TO "anon";
GRANT ALL ON TABLE "public"."GoalskillRequire" TO "authenticated";
GRANT ALL ON TABLE "public"."GoalskillRequire" TO "service_role";



GRANT ALL ON TABLE "public"."branch" TO "anon";
GRANT ALL ON TABLE "public"."branch" TO "authenticated";
GRANT ALL ON TABLE "public"."branch" TO "service_role";



GRANT ALL ON SEQUENCE "public"."branch_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."branch_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."branch_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."campus" TO "anon";
GRANT ALL ON TABLE "public"."campus" TO "authenticated";
GRANT ALL ON TABLE "public"."campus" TO "service_role";



GRANT ALL ON SEQUENCE "public"."campus_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."campus_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."campus_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."exercise" TO "anon";
GRANT ALL ON TABLE "public"."exercise" TO "authenticated";
GRANT ALL ON TABLE "public"."exercise" TO "service_role";



GRANT ALL ON TABLE "public"."exerciseChoice" TO "anon";
GRANT ALL ON TABLE "public"."exerciseChoice" TO "authenticated";
GRANT ALL ON TABLE "public"."exerciseChoice" TO "service_role";



GRANT ALL ON SEQUENCE "public"."exerciseChoice_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."exerciseChoice_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."exerciseChoice_id_seq" TO "service_role";



GRANT ALL ON SEQUENCE "public"."exercise_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."exercise_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."exercise_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."exercise_session" TO "anon";
GRANT ALL ON TABLE "public"."exercise_session" TO "authenticated";
GRANT ALL ON TABLE "public"."exercise_session" TO "service_role";



GRANT ALL ON TABLE "public"."faculty" TO "anon";
GRANT ALL ON TABLE "public"."faculty" TO "authenticated";
GRANT ALL ON TABLE "public"."faculty" TO "service_role";



GRANT ALL ON SEQUENCE "public"."faculty_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."faculty_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."faculty_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."gender" TO "anon";
GRANT ALL ON TABLE "public"."gender" TO "authenticated";
GRANT ALL ON TABLE "public"."gender" TO "service_role";



GRANT ALL ON SEQUENCE "public"."gender_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."gender_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."gender_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."goal" TO "anon";
GRANT ALL ON TABLE "public"."goal" TO "authenticated";
GRANT ALL ON TABLE "public"."goal" TO "service_role";



GRANT ALL ON SEQUENCE "public"."goal_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."goal_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."goal_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."history" TO "anon";
GRANT ALL ON TABLE "public"."history" TO "authenticated";
GRANT ALL ON TABLE "public"."history" TO "service_role";



GRANT ALL ON SEQUENCE "public"."history_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."history_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."history_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."major" TO "anon";
GRANT ALL ON TABLE "public"."major" TO "authenticated";
GRANT ALL ON TABLE "public"."major" TO "service_role";



GRANT ALL ON SEQUENCE "public"."major_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."major_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."major_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."migrations" TO "anon";
GRANT ALL ON TABLE "public"."migrations" TO "authenticated";
GRANT ALL ON TABLE "public"."migrations" TO "service_role";



GRANT ALL ON SEQUENCE "public"."migrations_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."migrations_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."migrations_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."session" TO "anon";
GRANT ALL ON TABLE "public"."session" TO "authenticated";
GRANT ALL ON TABLE "public"."session" TO "service_role";



GRANT ALL ON TABLE "public"."sessionAndExercise" TO "anon";
GRANT ALL ON TABLE "public"."sessionAndExercise" TO "authenticated";
GRANT ALL ON TABLE "public"."sessionAndExercise" TO "service_role";



GRANT ALL ON SEQUENCE "public"."sessionAndExercise_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."sessionAndExercise_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."sessionAndExercise_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."sessionExcercise" TO "anon";
GRANT ALL ON TABLE "public"."sessionExcercise" TO "authenticated";
GRANT ALL ON TABLE "public"."sessionExcercise" TO "service_role";



GRANT ALL ON SEQUENCE "public"."sessionExcercise_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."sessionExcercise_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."sessionExcercise_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."session_excercise_exercises_exercise" TO "anon";
GRANT ALL ON TABLE "public"."session_excercise_exercises_exercise" TO "authenticated";
GRANT ALL ON TABLE "public"."session_excercise_exercises_exercise" TO "service_role";



GRANT ALL ON SEQUENCE "public"."session_session_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."session_session_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."session_session_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."skill" TO "anon";
GRANT ALL ON TABLE "public"."skill" TO "authenticated";
GRANT ALL ON TABLE "public"."skill" TO "service_role";



GRANT ALL ON SEQUENCE "public"."skill_skill_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."skill_skill_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."skill_skill_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."skills_prerequisite" TO "anon";
GRANT ALL ON TABLE "public"."skills_prerequisite" TO "authenticated";
GRANT ALL ON TABLE "public"."skills_prerequisite" TO "service_role";



GRANT ALL ON TABLE "public"."userprofile" TO "anon";
GRANT ALL ON TABLE "public"."userprofile" TO "authenticated";
GRANT ALL ON TABLE "public"."userprofile" TO "service_role";



GRANT ALL ON SEQUENCE "public"."userprofile_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."userprofile_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."userprofile_id_seq" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";































