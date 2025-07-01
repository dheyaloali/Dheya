-- CreateIndex
CREATE INDEX IF NOT EXISTS "Product_name_idx" ON "Product"("name");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "EmployeeLocation_employeeId_timestamp_idx" ON "EmployeeLocation"("employeeId", "timestamp");

-- DropIndex
DROP INDEX IF EXISTS "Product_status_idx";

-- DropIndex
DROP INDEX IF EXISTS "Product_quantity_idx";
