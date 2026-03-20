-- Add label column to phrases table
-- label: short display name shown in the phrase bank sidebar (required for new phrases)
alter table phrases add column if not exists label text not null default '';
