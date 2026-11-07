CREATE SCHEMA audit_guard;
CREATE TABLE audit_guard.audit_test_marker (identity text PRIMARY KEY);
INSERT INTO audit_guard.audit_test_marker (identity) VALUES ('pm-audit-isolated-v1');
