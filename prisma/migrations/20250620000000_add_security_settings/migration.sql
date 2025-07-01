-- CreateTable
CREATE TABLE "SecuritySettings" (
    "id" INTEGER NOT NULL PRIMARY KEY CHECK (id = 1),
    "requireMfa" BOOLEAN NOT NULL DEFAULT false,
    "passwordMinLength" INTEGER NOT NULL DEFAULT 8,
    "passwordRequireSpecialChar" BOOLEAN NOT NULL DEFAULT true,
    "passwordRequireNumber" BOOLEAN NOT NULL DEFAULT true,
    "passwordRequireUppercase" BOOLEAN NOT NULL DEFAULT true,
    "sessionTimeout" INTEGER NOT NULL DEFAULT 60,
    "maxLoginAttempts" INTEGER NOT NULL DEFAULT 5,
    "recaptchaEnabled" BOOLEAN NOT NULL DEFAULT false,
    "recaptchaSiteKey" TEXT,
    "recaptchaSecretKey" TEXT,
    "allowedDomains" TEXT,
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP NOT NULL
);

-- Insert default security settings
INSERT INTO "SecuritySettings" (
    "id", 
    "requireMfa", 
    "passwordMinLength", 
    "passwordRequireSpecialChar", 
    "passwordRequireNumber", 
    "passwordRequireUppercase", 
    "sessionTimeout", 
    "maxLoginAttempts", 
    "recaptchaEnabled",
    "updatedAt"
) 
VALUES (
    1, 
    false, 
    8, 
    true, 
    true, 
    true, 
    60, 
    5, 
    false,
    CURRENT_TIMESTAMP
); 