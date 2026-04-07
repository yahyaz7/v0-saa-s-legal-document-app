-- Drop unused tables that were superseded by the current architecture.
-- Kept: audit_logs (reserved for future audit trail implementation)
--
-- Dependency order: child tables first, then parents.

-- document_versions depends on documents
drop table if exists document_versions cascade;

-- document_field_values depends on documents
drop table if exists document_field_values cascade;

-- generated_documents depends on documents (replaced by document_generations)
drop table if exists generated_documents cascade;

-- documents (superseded by saved_form_drafts + document_generations)
drop table if exists documents cascade;

-- template_field_options (superseded by template_fields.field_options JSONB)
drop table if exists template_field_options cascade;
