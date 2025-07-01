-- CreateIndex
CREATE INDEX "Attendance_employeeId_date_idx" ON "Attendance"("employeeId", "date");

-- CreateIndex
CREATE INDEX "Attendance_status_date_idx" ON "Attendance"("status", "date");

-- CreateIndex
CREATE INDEX "EmployeeLocation_employeeId_timestamp_idx" ON "EmployeeLocation"("employeeId", "timestamp");

-- CreateIndex
CREATE INDEX "Sale_employeeId_date_idx" ON "Sale"("employeeId", "date");

-- CreateIndex
CREATE INDEX "Sale_date_idx" ON "Sale"("date");
