-- Migration: Senior-focused enhancements for Medicaid RAG
-- Adds document classification, freshness tracking, and sensitive topic handling

-- Enable UUID extension if not exists
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Add document classification fields to documents table
ALTER TABLE documents ADD COLUMN IF NOT EXISTS document_type TEXT;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS target_programs TEXT[];
ALTER TABLE documents ADD COLUMN IF NOT EXISTS effective_date DATE;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS expiration_date DATE;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS update_frequency TEXT;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS source_url TEXT;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS last_verified TIMESTAMP WITH TIME ZONE;

-- Data freshness tracking rules
CREATE TABLE IF NOT EXISTS data_freshness_rules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    data_type TEXT NOT NULL UNIQUE,
    update_frequency TEXT NOT NULL,
    typical_update_month INTEGER,  -- 1=Jan, 4=Apr, 10=Oct
    source_name TEXT NOT NULL,
    source_url TEXT,
    last_known_update DATE,
    next_expected_update DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert freshness rules for key Medicaid/Medicare data types
INSERT INTO data_freshness_rules (data_type, update_frequency, typical_update_month, source_name, source_url) VALUES
    ('federal_poverty_level', 'annually_january', 1, 'Federal Register', 'https://aspe.hhs.gov/poverty-guidelines'),
    ('msp_income_limits', 'annually_april', 4, 'CMS/PHLP', NULL),
    ('nursing_home_fbr', 'annually_january', 1, 'SSA', 'https://www.ssa.gov/oact/cola/SSI.html'),
    ('spousal_protection', 'annually_january', 1, 'CMS', NULL),
    ('part_d_costs', 'annually_october', 10, 'Medicare.gov', 'https://www.medicare.gov/drug-coverage-part-d'),
    ('pace_pacenet_limits', 'annually_january', 1, 'PA Aging', 'https://www.aging.pa.gov'),
    ('chester_county_contacts', 'quarterly', NULL, 'County websites', NULL)
ON CONFLICT (data_type) DO NOTHING;

-- Sensitive topic categories and disclaimer templates
CREATE TABLE IF NOT EXISTS sensitive_topics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    category TEXT NOT NULL UNIQUE,
    keywords TEXT[] NOT NULL,
    disclaimer_template TEXT NOT NULL,
    referral_suggestion TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

INSERT INTO sensitive_topics (category, keywords, disclaimer_template, referral_suggestion) VALUES
    ('estate_planning',
     ARRAY['estate plan', 'will', 'trust', 'inheritance', 'heir'],
     'This is general information only. For estate planning advice, please consult an elder law attorney.',
     'PA Elder Law Attorney referral: 1-800-932-0356'),
    ('spend_down',
     ARRAY['spend down', 'reduce assets', 'gift', 'transfer assets'],
     'Medicaid has strict rules about asset transfers. Improper transfers can result in penalty periods.',
     'Contact PHLP for guidance: 1-800-274-3258'),
    ('asset_transfer',
     ARRAY['transfer home', 'give away', 'deed', 'put in child''s name'],
     'Asset transfers within 5 years of applying for Medicaid can result in penalties. Consult an attorney.',
     'PA Elder Law Attorney referral: 1-800-932-0356'),
    ('spousal_complex',
     ARRAY['divorce for medicaid', 'spousal refusal', 'separate'],
     'Spousal situations can be complex. PHLP offers free counseling on these matters.',
     'PHLP Helpline: 1-800-274-3258'),
    ('appeals',
     ARRAY['appeal', 'denied', 'fair hearing', 'dispute'],
     'You have the right to appeal Medicaid decisions. Free help is available.',
     'PHLP Appeals Assistance: 1-800-274-3258')
ON CONFLICT (category) DO NOTHING;

-- Query metrics for tracking senior-focused queries
CREATE TABLE IF NOT EXISTS query_metrics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    query_text TEXT NOT NULL,
    query_hash TEXT NOT NULL,
    intent_category TEXT,
    sensitive_category TEXT,
    disclaimer_added BOOLEAN DEFAULT FALSE,
    answer_confidence REAL,
    latency_ms INTEGER,
    citation_count INTEGER,
    no_answer BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for query metrics analysis
CREATE INDEX IF NOT EXISTS idx_query_metrics_created_at ON query_metrics(created_at);
CREATE INDEX IF NOT EXISTS idx_query_metrics_intent ON query_metrics(intent_category);
CREATE INDEX IF NOT EXISTS idx_query_metrics_sensitive ON query_metrics(sensitive_category);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply trigger to freshness rules
DROP TRIGGER IF EXISTS update_data_freshness_rules_updated_at ON data_freshness_rules;
CREATE TRIGGER update_data_freshness_rules_updated_at
    BEFORE UPDATE ON data_freshness_rules
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Comment on tables for documentation
COMMENT ON TABLE data_freshness_rules IS 'Tracks expected update schedules for various Medicaid/Medicare data types';
COMMENT ON TABLE sensitive_topics IS 'Categories of sensitive queries that require disclaimers and professional referrals';
COMMENT ON TABLE query_metrics IS 'Analytics for query patterns and system performance';
