-- Create verification_codes table
CREATE TABLE IF NOT EXISTS verification_codes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    phone_number VARCHAR(20) NOT NULL,
    code VARCHAR(6) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    used BOOLEAN NOT NULL DEFAULT FALSE,
    used_at TIMESTAMP WITH TIME ZONE,
    
    -- Indexes
    CONSTRAINT uq_phone_code UNIQUE (phone_number, code)
);

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_verification_codes_phone_number ON verification_codes(phone_number);
CREATE INDEX IF NOT EXISTS idx_verification_codes_expires_at ON verification_codes(expires_at);

-- Create function to clean up expired codes
CREATE OR REPLACE FUNCTION clean_expired_verification_codes()
RETURNS TRIGGER AS $$
BEGIN
    DELETE FROM verification_codes 
    WHERE expires_at < NOW() - INTERVAL '1 day';
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to clean up old codes (runs daily)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger 
        WHERE tgname = 'trigger_clean_expired_verification_codes'
    ) THEN
        CREATE TRIGGER trigger_clean_expired_verification_codes
        AFTER INSERT OR UPDATE ON verification_codes
        EXECUTE FUNCTION clean_expired_verification_codes();
    END IF;
END $$;
