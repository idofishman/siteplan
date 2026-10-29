alter table pages add column if not exists needs_content_update boolean not null default false;
alter table pages add column if not exists content_update_notes text default null;
