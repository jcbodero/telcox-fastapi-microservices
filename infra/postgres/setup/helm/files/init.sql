-- PostgreSQL initialization script for TelcoX audit system

CREATE TABLE IF NOT EXISTS audit_events (
    id UUID PRIMARY KEY,
    service VARCHAR(100) NOT NULL,
    action VARCHAR(50) NOT NULL,
    resource_type VARCHAR(100) NOT NULL,
    resource_id VARCHAR(255) NOT NULL,
    user_id VARCHAR(255),
    status VARCHAR(20) NOT NULL,
    payload_in JSONB,
    payload_out JSONB,
    ip_address VARCHAR(45),
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
    duration_ms FLOAT,
    error_message TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT chk_audit_action CHECK (action IN ('CREATE', 'READ', 'UPDATE', 'DELETE', 'PROCESS', 'ACTIVATE', 'VERIFY')),
    CONSTRAINT chk_audit_status CHECK (status IN ('SUCCESS', 'FAILED')),
    CONSTRAINT chk_audit_duration CHECK (duration_ms IS NULL OR duration_ms >= 0)
);

CREATE INDEX IF NOT EXISTS idx_audit_resource ON audit_events(resource_id);
CREATE INDEX IF NOT EXISTS idx_audit_service ON audit_events(service);
CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON audit_events(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_audit_status ON audit_events(status);
CREATE INDEX IF NOT EXISTS idx_audit_resource_type ON audit_events(resource_type);
CREATE INDEX IF NOT EXISTS idx_audit_user_timestamp ON audit_events(user_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_audit_metadata ON audit_events USING GIN(metadata);
CREATE INDEX IF NOT EXISTS idx_audit_service_resource ON audit_events(service, resource_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_audit_resource_timeline ON audit_events(resource_type, resource_id, timestamp DESC);

CREATE TABLE IF NOT EXISTS customers (
    id VARCHAR(255) PRIMARY KEY,
    document_id VARCHAR(50) UNIQUE,
    full_name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE,
    phone VARCHAR(20),
    status VARCHAR(50),
    segment VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS invoices (
    id VARCHAR(255) PRIMARY KEY,
    customer_id VARCHAR(255) NOT NULL REFERENCES customers(id),
    amount DECIMAL(15, 2),
    currency VARCHAR(3),
    description TEXT,
    due_date DATE,
    status VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS payments (
    id VARCHAR(255) PRIMARY KEY,
    customer_id VARCHAR(255) NOT NULL REFERENCES customers(id),
    invoice_id VARCHAR(255) REFERENCES invoices(id),
    amount DECIMAL(15, 2),
    currency VARCHAR(3),
    method VARCHAR(50),
    status VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_invoices_customer ON invoices(customer_id);
CREATE INDEX IF NOT EXISTS idx_payments_customer ON payments(customer_id);
CREATE INDEX IF NOT EXISTS idx_payments_invoice ON payments(invoice_id);

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_customers_updated_at ON customers;
CREATE TRIGGER trg_customers_updated_at
BEFORE UPDATE ON customers
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_invoices_updated_at ON invoices;
CREATE TRIGGER trg_invoices_updated_at
BEFORE UPDATE ON invoices
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_payments_updated_at ON payments;
CREATE TRIGGER trg_payments_updated_at
BEFORE UPDATE ON payments
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE OR REPLACE VIEW audit_summary AS
SELECT
    service,
    action,
    resource_type,
    status,
    COUNT(*) as event_count,
    AVG(duration_ms) as avg_duration_ms,
    MAX(timestamp) as last_event
FROM audit_events
GROUP BY service, action, resource_type, status
ORDER BY last_event DESC;

CREATE OR REPLACE VIEW failed_operations AS
SELECT
    id,
    service,
    action,
    resource_type,
    resource_id,
    status,
    error_message,
    timestamp,
    duration_ms
FROM audit_events
WHERE status = 'FAILED'
ORDER BY timestamp DESC;
