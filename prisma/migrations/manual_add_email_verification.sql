-- Add verification token fields to User model
ALTER TABLE \
User\ ADD COLUMN IF NOT EXISTS \verificationToken\ TEXT;
ALTER TABLE \
User\ ADD COLUMN IF NOT EXISTS \verificationTokenExpires\ TIMESTAMP(3);
