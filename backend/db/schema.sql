-- Cwenda schema reference
-- Apply with:  psql -d cwenda -f db/schema.sql  (safe to re-run)
-- This file is the source of truth for structure; it does not seed data.
--
-- Deletion model: junction rows are links, not ownership, so they cascade away
-- with the parent (see the FKs below). Tags deliberately outlive events --
-- deleting an event never deletes a tag, because tags are a shared vocabulary
-- that other events may still be linked to.

CREATE TABLE IF NOT EXISTS "event" (
    id              SERIAL PRIMARY KEY,
    name            VARCHAR(255),
    description     TEXT,
    associate_links JSONB,
    start_time      TIMESTAMPTZ,
    end_time        TIMESTAMPTZ,
    timezone        VARCHAR(255)
);

-- tag_name_key prevents two tags sharing a name, which would make "which tag
-- is this?" ambiguous when linking by id. Nullable: Postgres permits many NULLs
-- here, so the API rejects blank/null names before insert. Declared inline
-- (not via ALTER TABLE) so re-running this file doesn't fail.
CREATE TABLE IF NOT EXISTS "tag" (
    id   SERIAL PRIMARY KEY,
    name VARCHAR(255),
    CONSTRAINT "tag_name_key" UNIQUE (name)
);

-- Many-to-many between event and tag. Composite primary key means the same
-- pair cannot be linked twice, which backs ON CONFLICT DO NOTHING in postEvent.
CREATE TABLE IF NOT EXISTS "junction" (
    event_id INTEGER NOT NULL,
    tag_id   INTEGER NOT NULL,
    CONSTRAINT "junction_pkey" PRIMARY KEY (event_id, tag_id),
    CONSTRAINT "fk_event" FOREIGN KEY (event_id) REFERENCES "event"(id) ON DELETE CASCADE,
    CONSTRAINT "fk_tag"   FOREIGN KEY (tag_id)   REFERENCES "tag"(id)   ON DELETE CASCADE
);

-- The composite PK already indexes this lookup by event_id; kept as an
-- explicit index for the reverse direction (tag -> its events).
CREATE INDEX IF NOT EXISTS "junction_tag_id_idx" ON "junction"(tag_id);
