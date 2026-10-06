-- Database Schema for Sprintify

-- Drop existing tables if they exist (for reset/migration)
DROP TABLE IF EXISTS notification_preferences CASCADE;
DROP TABLE IF EXISTS notifications CASCADE;
DROP TABLE IF EXISTS subtasks CASCADE;
DROP TABLE IF EXISTS attachments CASCADE;
DROP TABLE IF EXISTS comments CASCADE;
DROP TABLE IF EXISTS meeting_participants CASCADE;
DROP TABLE IF EXISTS meetings CASCADE;
DROP TABLE IF EXISTS activity_logs CASCADE;
DROP TABLE IF EXISTS tasks CASCADE;
DROP TABLE IF EXISTS project_members CASCADE;
DROP TABLE IF EXISTS projects CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- Drop custom types if they exist
DROP TYPE IF EXISTS notification_type CASCADE;
DROP TYPE IF EXISTS meeting_status CASCADE;
DROP TYPE IF EXISTS rsvp_status CASCADE;
DROP TYPE IF EXISTS task_status CASCADE;
DROP TYPE IF EXISTS task_priority CASCADE;
DROP TYPE IF EXISTS member_role CASCADE;

-- Create ENUM types
CREATE TYPE task_status AS ENUM ('TODO', 'IN_PROGRESS', 'DONE');
CREATE TYPE task_priority AS ENUM ('LOW', 'MEDIUM', 'HIGH');
CREATE TYPE member_role AS ENUM ('OWNER', 'MEMBER');
CREATE TYPE meeting_status AS ENUM ('SCHEDULED', 'LIVE', 'ENDED');
CREATE TYPE rsvp_status AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED');
CREATE TYPE notification_type AS ENUM ('TASK_ASSIGNED', 'TASK_DUE_SOON', 'TASK_OVERDUE', 'COMMENT_ADDED', 'ADDED_TO_PROJECT', 'MEETING_INVITE');

-- Users Table
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Projects Table
CREATE TABLE projects (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    created_by INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Project Members Table
CREATE TABLE project_members (
    project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role member_role NOT NULL DEFAULT 'MEMBER',
    PRIMARY KEY (project_id, user_id)
);

-- Tasks Table
CREATE TABLE tasks (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    status task_status NOT NULL DEFAULT 'TODO',
    priority task_priority NOT NULL DEFAULT 'MEDIUM',
    position INTEGER NOT NULL DEFAULT 0,
    project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    assignee_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    due_date DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Notifications Table
CREATE TABLE notifications (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type notification_type NOT NULL,
    title TEXT NOT NULL,
    body TEXT,
    project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
    task_id INTEGER REFERENCES tasks(id) ON DELETE CASCADE,
    link TEXT,
    dedupe_key VARCHAR(255),
    read_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_user_dedupe_key UNIQUE (user_id, dedupe_key)
);

-- Notification Preferences Table
CREATE TABLE notification_preferences (
    user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    in_app_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    email_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    email_on_assigned BOOLEAN NOT NULL DEFAULT TRUE,
    email_on_due BOOLEAN NOT NULL DEFAULT TRUE,
    email_on_comment BOOLEAN NOT NULL DEFAULT FALSE
);

-- Activity Logs Table
CREATE TABLE activity_logs (
    id SERIAL PRIMARY KEY,
    task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL,
    from_status task_status,
    to_status task_status,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Meetings Table
CREATE TABLE meetings (
    id SERIAL PRIMARY KEY,
    project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    scheduled_at TIMESTAMP WITH TIME ZONE NOT NULL,
    duration_minutes INTEGER NOT NULL DEFAULT 30,
    room_name VARCHAR(255) UNIQUE NOT NULL,
    status meeting_status NOT NULL DEFAULT 'SCHEDULED',
    notes TEXT,
    created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    started_at TIMESTAMP WITH TIME ZONE,
    ended_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Meeting Participants Table
CREATE TABLE meeting_participants (
    meeting_id INTEGER NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    rsvp rsvp_status NOT NULL DEFAULT 'PENDING',
    PRIMARY KEY (meeting_id, user_id)
);

-- Comments Table
CREATE TABLE comments (
    id SERIAL PRIMARY KEY,
    task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    body TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    edited BOOLEAN NOT NULL DEFAULT FALSE
);

-- Attachments Table
CREATE TABLE attachments (
    id SERIAL PRIMARY KEY,
    task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    uploaded_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    original_name TEXT NOT NULL,
    stored_name TEXT UNIQUE NOT NULL,
    mime_type TEXT NOT NULL,
    size_bytes INTEGER NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Subtasks Table
CREATE TABLE subtasks (
    id SERIAL PRIMARY KEY,
    task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    title VARCHAR(200) NOT NULL,
    done BOOLEAN NOT NULL DEFAULT FALSE,
    position INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for Query Performance
CREATE INDEX idx_tasks_project_status_pos ON tasks(project_id, status, position);
CREATE INDEX idx_project_members_user ON project_members(user_id);
CREATE INDEX idx_activity_logs_task ON activity_logs(task_id);
CREATE INDEX idx_meetings_project_scheduled ON meetings(project_id, scheduled_at);
CREATE INDEX idx_meeting_participants_user ON meeting_participants(user_id);
CREATE INDEX idx_comments_task_created ON comments(task_id, created_at);
CREATE INDEX idx_attachments_task ON attachments(task_id);
CREATE INDEX idx_subtasks_task_position ON subtasks(task_id, position);
CREATE INDEX idx_activity_logs_task_created ON activity_logs(task_id, created_at);
CREATE INDEX idx_notifications_user_created ON notifications(user_id, created_at DESC);
CREATE INDEX idx_notifications_user_unread ON notifications(user_id) WHERE read_at IS NULL;
