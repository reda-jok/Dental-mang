-- CreateEnum
CREATE TYPE "ConditionScope" AS ENUM ('surfaces', 'tooth');

-- CreateEnum
CREATE TYPE "ConditionKind" AS ENUM ('problem', 'existing');

-- CreateTable
CREATE TABLE "tooth_condition" (
    "code" TEXT NOT NULL,
    "name" TEXT,
    "color" TEXT NOT NULL,
    "scope" "ConditionScope" NOT NULL,
    "kind" "ConditionKind" NOT NULL,
    "built_in" BOOLEAN NOT NULL DEFAULT false,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "hidden_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "tooth_condition_pkey" PRIMARY KEY ("code")
);

-- The built-in conditions (TOOTH_CONDITIONS in src/features/chart/teeth.ts), so the
-- findings and procedures that use them keep working.
INSERT INTO "tooth_condition" ("code", "color", "scope", "kind", "built_in", "sort_order", "updated_at") VALUES
  ('caries',       '#dc2626', 'surfaces', 'problem',  true, 1,  now()),
  ('fracture',     '#ea580c', 'surfaces', 'problem',  true, 2,  now()),
  ('root_remnant', '#b91c1c', 'tooth',    'problem',  true, 3,  now()),
  ('impacted',     '#4b5563', 'tooth',    'problem',  true, 4,  now()),
  ('filling',      '#2563eb', 'surfaces', 'existing', true, 5,  now()),
  ('crown',        '#ca8a04', 'tooth',    'existing', true, 6,  now()),
  ('root_canal',   '#7c3aed', 'tooth',    'existing', true, 7,  now()),
  ('bridge',       '#a16207', 'tooth',    'existing', true, 8,  now()),
  ('veneer',       '#db2777', 'tooth',    'existing', true, 9,  now()),
  ('implant',      '#0d9488', 'tooth',    'existing', true, 10, now()),
  ('missing',      '#6b7280', 'tooth',    'existing', true, 11, now());

ALTER TABLE "tooth_condition"
  ADD CONSTRAINT "tooth_condition_color" CHECK ("color" ~ '^#[0-9a-f]{6}$'),
  ADD CONSTRAINT "tooth_condition_named" CHECK ("built_in" OR "name" IS NOT NULL),
  ADD CONSTRAINT "tooth_condition_name_length" CHECK ("name" IS NULL OR char_length("name") BETWEEN 1 AND 40);

-- A condition is hidden, never deleted, and keeps its code, scope and kind: findings
-- already drawn with it must not change meaning.
CREATE FUNCTION tooth_condition_guard() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'tooth conditions are hidden, never deleted';
  END IF;
  IF NEW.code <> OLD.code OR NEW.scope <> OLD.scope OR NEW.kind <> OLD.kind
     OR NEW.built_in <> OLD.built_in THEN
    RAISE EXCEPTION 'a tooth condition keeps its code, scope, kind and origin';
  END IF;
  RETURN NEW;
END
$$ LANGUAGE plpgsql;

CREATE TRIGGER tooth_condition_guard
  BEFORE UPDATE OR DELETE ON "tooth_condition"
  FOR EACH ROW EXECUTE FUNCTION tooth_condition_guard();

-- AddForeignKey
ALTER TABLE "procedure" ADD CONSTRAINT "procedure_chart_result_fkey" FOREIGN KEY ("chart_result") REFERENCES "tooth_condition"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tooth_finding" ADD CONSTRAINT "tooth_finding_condition_fkey" FOREIGN KEY ("condition") REFERENCES "tooth_condition"("code") ON DELETE RESTRICT ON UPDATE CASCADE;
