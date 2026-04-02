-- Add file_name to document_generations so the documents page can display it
alter table document_generations add column if not exists file_name text;
