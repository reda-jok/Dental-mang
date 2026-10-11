-- CreateTable
CREATE TABLE "dashboard_layout" (
    "id" UUID NOT NULL,
    "user_id" UUID,
    "role" TEXT,
    "widgets" JSONB NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "dashboard_layout_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "dashboard_layout_user_id_key" ON "dashboard_layout"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "dashboard_layout_role_key" ON "dashboard_layout"("role");

-- AddForeignKey
ALTER TABLE "dashboard_layout" ADD CONSTRAINT "dashboard_layout_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Exactly one owner of the layout: a user, or a role (the owner's default for it).
ALTER TABLE "dashboard_layout"
  ADD CONSTRAINT "dashboard_layout_one_owner" CHECK (num_nonnulls("user_id", "role") = 1);
