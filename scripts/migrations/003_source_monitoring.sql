-- Migration: Source Monitoring and Phase 1 Enhancements
-- Adds automated source monitoring, change detection, and regulatory text support

-- Enable UUID extension if not exists
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Add Phase 1 document classification fields to documents table
ALTER TABLE documents ADD COLUMN IF NOT EXISTS source_authority TEXT;  -- 'primary' or 'secondary'
ALTER TABLE documents ADD COLUMN IF NOT EXISTS legal_weight TEXT;       -- 'regulatory', 'guidance', 'informational'
ALTER TABLE documents ADD COLUMN IF NOT EXISTS source_format TEXT;      -- 'pdf', 'html_multipage', 'html_list', etc.
ALTER TABLE documents ADD COLUMN IF NOT EXISTS requires_html_scraping BOOLEAN DEFAULT FALSE;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS requires_regulatory_chunking BOOLEAN DEFAULT FALSE;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS is_change_feed BOOLEAN DEFAULT FALSE;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS monitoring_frequency TEXT;  -- 'weekly', 'monthly', 'quarterly'

-- Source monitoring table for automated change detection
CREATE TABLE IF NOT EXISTS source_monitors (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    source_name TEXT NOT NULL UNIQUE,
    source_url TEXT NOT NULL,
    source_type TEXT NOT NULL,  -- 'oim_ops_memo', 'pa_bulletin', 'dhs_page', 'oim_handbook', 'pa_code'
    check_frequency TEXT NOT NULL,  -- 'weekly', 'monthly', 'quarterly', 'annually'
    last_checked_at TIMESTAMP WITH TIME ZONE,
    last_content_hash TEXT,
    last_change_detected_at TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT true,
    auto_ingest BOOLEAN DEFAULT true,
    filter_keywords TEXT[],  -- For PA Bulletin filtering
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Change history log for tracking source updates
CREATE TABLE IF NOT EXISTS source_change_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    monitor_id UUID NOT NULL REFERENCES source_monitors(id) ON DELETE CASCADE,
    detected_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    previous_hash TEXT,
    new_hash TEXT,
    change_summary TEXT,  -- Brief description of what changed
    items_added INTEGER DEFAULT 0,  -- For list-based sources (ops memos)
    items_removed INTEGER DEFAULT 0,
    auto_ingested BOOLEAN DEFAULT false,
    ingestion_status TEXT DEFAULT 'pending',  -- 'pending', 'success', 'failed', 'skipped'
    ingestion_error TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for efficient lookups
CREATE INDEX IF NOT EXISTS idx_source_monitors_frequency ON source_monitors(check_frequency);
CREATE INDEX IF NOT EXISTS idx_source_monitors_last_checked ON source_monitors(last_checked_at);
CREATE INDEX IF NOT EXISTS idx_source_monitors_active ON source_monitors(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_change_log_monitor ON source_change_log(monitor_id);
CREATE INDEX IF NOT EXISTS idx_change_log_detected_at ON source_change_log(detected_at);

-- Insert Phase 1 source monitors
INSERT INTO source_monitors (source_name, source_url, source_type, check_frequency, filter_keywords) VALUES
    -- OIM Handbooks (monthly check)
    ('OIM Long-Term Care Handbook',
     'http://services.dpw.state.pa.us/oimpolicymanuals/ltc/Long-Term_Care_Handbook.htm',
     'oim_handbook', 'monthly', NULL),
    ('OIM Medical Assistance Handbook',
     'http://services.dpw.state.pa.us/oimpolicymanuals/ma/Medical_Assistance_Handbook.htm',
     'oim_handbook', 'monthly', NULL),

    -- OIM Change Feeds (weekly check)
    ('OIM Operations Memoranda',
     'http://services.dpw.state.pa.us/oimpolicymanuals/ma/300_OpsMemo_PolicyClarifications/300_Operations_Memoranda.htm',
     'oim_ops_memo', 'weekly', NULL),
    ('OIM Policy Clarifications',
     'http://services.dpw.state.pa.us/oimpolicymanuals/ma/300_Forms_Operations_Memoranda_and_Policy_Clarifications/300_Policy_Clarifications.htm',
     'oim_policy_clarification', 'weekly', NULL),

    -- PA Code (as-needed, but check monthly)
    ('PA Code Chapter 258 - Estate Recovery',
     'https://www.pacodeandbulletin.gov/Display/pacode?file=/secure/pacode/data/055/chapter258/chap258toc.html',
     'pa_code', 'monthly', NULL),

    -- PA Bulletin (weekly check with DHS filter)
    ('PA Bulletin - DHS Notices',
     'https://www.pacodeandbulletin.gov/Display/pabull',
     'pa_bulletin', 'weekly',
     ARRAY['Department of Human Services', 'Medical Assistance', 'LIFE', 'CHC', 'Long-Term Care', 'Community HealthChoices'])
ON CONFLICT (source_name) DO NOTHING;

-- Add Phase 1 freshness rules
INSERT INTO data_freshness_rules (data_type, update_frequency, typical_update_month, source_name, source_url) VALUES
    ('oim_ops_memo', 'weekly', NULL, 'PA DHS Office of Income Maintenance',
     'http://services.dpw.state.pa.us/oimpolicymanuals/ma/300_OpsMemo_PolicyClarifications/300_Operations_Memoranda.htm'),
    ('oim_policy_clarification', 'weekly', NULL, 'PA DHS Office of Income Maintenance',
     'http://services.dpw.state.pa.us/oimpolicymanuals/ma/300_Forms_Operations_Memoranda_and_Policy_Clarifications/300_Policy_Clarifications.htm'),
    ('pa_bulletin_dhs', 'weekly', NULL, 'Pennsylvania Bulletin',
     'https://www.pacodeandbulletin.gov/Display/pabull'),
    ('oim_ltc_handbook', 'monthly', NULL, 'PA DHS Office of Income Maintenance',
     'http://services.dpw.state.pa.us/oimpolicymanuals/ltc/Long-Term_Care_Handbook.htm'),
    ('oim_ma_handbook', 'monthly', NULL, 'PA DHS Office of Income Maintenance',
     'http://services.dpw.state.pa.us/oimpolicymanuals/ma/Medical_Assistance_Handbook.htm'),
    ('pa_code_chapter_258', 'as_needed', NULL, 'Pennsylvania Code',
     'https://www.pacodeandbulletin.gov/Display/pacode?file=/secure/pacode/data/055/chapter258/chap258toc.html')
ON CONFLICT (data_type) DO NOTHING;

-- Regulatory chunk metadata table for legal text
CREATE TABLE IF NOT EXISTS regulatory_chunks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    chunk_id UUID NOT NULL REFERENCES chunks(id) ON DELETE CASCADE,
    chapter_number TEXT,
    section_number TEXT,
    subsection_number TEXT,
    section_path TEXT[],
    section_title TEXT,
    source_authority TEXT,  -- 'pa_code', 'oim_handbook', 'pa_bulletin'
    legal_weight TEXT,      -- 'regulatory', 'guidance', 'informational'
    cross_references TEXT[],
    effective_date DATE,
    last_amended DATE,
    amendment_citation TEXT,  -- e.g., "52 Pa.B. 1234"
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for regulatory chunk lookups
CREATE INDEX IF NOT EXISTS idx_regulatory_chunks_section ON regulatory_chunks(section_number);
CREATE INDEX IF NOT EXISTS idx_regulatory_chunks_chapter ON regulatory_chunks(chapter_number);
CREATE INDEX IF NOT EXISTS idx_regulatory_chunks_authority ON regulatory_chunks(source_authority);

-- Apply updated_at trigger to source_monitors
DROP TRIGGER IF EXISTS update_source_monitors_updated_at ON source_monitors;
CREATE TRIGGER update_source_monitors_updated_at
    BEFORE UPDATE ON source_monitors
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Add look_back_period to sensitive topics
INSERT INTO sensitive_topics (category, keywords, disclaimer_template, referral_suggestion) VALUES
    ('look_back_period',
     ARRAY['60 months', '5 years', 'five years', 'penalty period', 'transfer penalty', 'look back', 'lookback'],
     'Pennsylvania applies a 60-month (5-year) look-back period for asset transfers. Transfers made within this period before applying for Medicaid may result in a penalty period that delays your eligibility. The penalty amount depends on the value of the transfer.',
     'Consult an elder law attorney for asset transfer planning: 1-800-932-0311')
ON CONFLICT (category) DO NOTHING;

-- Comment on new tables
COMMENT ON TABLE source_monitors IS 'Tracks sources for automated change detection and ingestion';
COMMENT ON TABLE source_change_log IS 'History of detected changes to monitored sources';
COMMENT ON TABLE regulatory_chunks IS 'Extended metadata for legal/regulatory text chunks with section hierarchy';
