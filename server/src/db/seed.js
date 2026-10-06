const { Client } = require('pg');
const bcrypt = require('bcryptjs');
require('dotenv').config();

async function seedDatabase() {
  const dbUrl = process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/sprintify_db';
  const client = new Client({ connectionString: dbUrl });

  try {
    await client.connect();
    console.log('Connected to database. Starting seed process...');

    // Clear existing data in reverse order of dependencies
    await client.query('TRUNCATE TABLE subtasks, attachments, comments, meeting_participants, meetings, activity_logs, tasks, project_members, projects, users RESTART IDENTITY CASCADE;');

    // Hash passwords
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash('password123', saltRounds);

    // 1. Insert Users
    const usersQuery = `
      INSERT INTO users (name, email, password)
      VALUES 
        ($1, $2, $7),
        ($3, $4, $7),
        ($5, $6, $7)
      RETURNING id, name, email;
    `;
    const usersRes = await client.query(usersQuery, [
      'Rahul Sharma', 'rahul@example.com',
      'Sarah Chen', 'sarah@example.com',
      'Alex Rivera', 'alex@example.com',
      hashedPassword
    ]);
    const users = usersRes.rows;
    console.log(`Seeded ${users.length} users.`);

    const rahulId = users.find(u => u.email === 'rahul@example.com').id;
    const sarahId = users.find(u => u.email === 'sarah@example.com').id;
    const alexId = users.find(u => u.email === 'alex@example.com').id;

    // 2. Insert Demo Project
    const projectQuery = `
      INSERT INTO projects (title, description, created_by)
      VALUES ($1, $2, $3)
      RETURNING id, title;
    `;
    const projectRes = await client.query(projectQuery, [
      'Sprintify Web & Mobile App',
      'Q4 Core Sprint for launching interactive drag-and-drop Kanban project management system.',
      rahulId
    ]);
    const project = projectRes.rows[0];
    console.log(`Seeded project '${project.title}' (ID: ${project.id}).`);

    // 3. Insert Project Members
    const membersQuery = `
      INSERT INTO project_members (project_id, user_id, role)
      VALUES 
        ($1, $2, 'OWNER'),
        ($1, $3, 'MEMBER'),
        ($1, $4, 'MEMBER');
    `;
    await client.query(membersQuery, [project.id, rahulId, sarahId, alexId]);
    console.log('Seeded project members.');

    // 4. Insert ~25 Tasks across 21 days with realistic activity log history
    const dayMs = 24 * 60 * 60 * 1000;
    const nowMs = Date.now();

    const tasksSeedData = [
      // Completed tasks in past 21 days
      { title: 'Set up CI/CD deployment pipeline', description: 'Automate GitHub actions for automated testing and staging deployments.', priority: 'HIGH', assignee_id: sarahId, createdDaysAgo: 20, startDaysAgo: 19, doneDaysAgo: 16 },
      { title: 'Design user notification icons', description: 'Create SVG vector icons following the soft pastel design system.', priority: 'LOW', assignee_id: alexId, createdDaysAgo: 19, startDaysAgo: 17, doneDaysAgo: 15 },
      { title: 'Implement Google OAuth integration', description: 'Allow members to log in using Google workspace credentials.', priority: 'MEDIUM', assignee_id: rahulId, createdDaysAgo: 18, startDaysAgo: 16, doneDaysAgo: 12 },
      { title: 'Refactor Kanban board DnD state handling', description: 'Optimize @dnd-kit optimistic updates for seamless card dragging.', priority: 'HIGH', assignee_id: rahulId, createdDaysAgo: 18, startDaysAgo: 15, doneDaysAgo: 11 },
      { title: 'Optimize database indexes & slow queries', description: 'Add composite indexes for project_id, status, and position columns.', priority: 'MEDIUM', assignee_id: sarahId, createdDaysAgo: 17, startDaysAgo: 14, doneDaysAgo: 10 },
      { title: 'Write integration test suite for REST APIs', description: 'Coverage for auth middleware, project isolation, and task drag endpoint.', priority: 'LOW', assignee_id: alexId, createdDaysAgo: 16, startDaysAgo: 13, doneDaysAgo: 9 },
      { title: 'Establish color tokens and design system', description: 'Defined warm cream background #FAF7F2, pastel accents, and soft typography.', priority: 'MEDIUM', assignee_id: rahulId, createdDaysAgo: 20, startDaysAgo: 19, doneDaysAgo: 18 },
      { title: 'Architect PostgreSQL schema and migrations', description: 'Created strict ENUM constraints, activity logs, and cascade relations.', priority: 'HIGH', assignee_id: rahulId, createdDaysAgo: 20, startDaysAgo: 19, doneDaysAgo: 17 },
      { title: 'Implement Socket.io real-time engine', description: 'Real-time WebSocket events for instant collaborative board updates.', priority: 'HIGH', assignee_id: sarahId, createdDaysAgo: 15, startDaysAgo: 13, doneDaysAgo: 8 },
      { title: 'Build Jitsi video meeting room integration', description: 'Integrated Jitsi Meet & 8x8 JaaS video room embeds for team syncs.', priority: 'MEDIUM', assignee_id: alexId, createdDaysAgo: 14, startDaysAgo: 11, doneDaysAgo: 7 },
      { title: 'Add task comment threads & rich formatting', description: 'Full chat discussion threads with author avatars and live typing indicators.', priority: 'MEDIUM', assignee_id: rahulId, createdDaysAgo: 13, startDaysAgo: 10, doneDaysAgo: 6 },
      { title: 'Support drag & drop file attachments', description: 'File attachment upload handling with clipboard screenshot pasting support.', priority: 'HIGH', assignee_id: sarahId, createdDaysAgo: 12, startDaysAgo: 9, doneDaysAgo: 5 },
      { title: 'Create subtasks checklist component', description: 'Interactive subtask checklist with visual completion progress bar.', priority: 'MEDIUM', assignee_id: alexId, createdDaysAgo: 11, startDaysAgo: 8, doneDaysAgo: 4 },
      { title: 'Integrate Gemini AI task assistant API', description: 'AI assistant prompt engineering for task description and checklist generation.', priority: 'HIGH', assignee_id: rahulId, createdDaysAgo: 10, startDaysAgo: 7, doneDaysAgo: 2 },
      { title: 'Build project analytics metrics dashboard', description: 'Productivity insights, cycle time calculation, and burndown chart metrics.', priority: 'HIGH', assignee_id: sarahId, createdDaysAgo: 9, startDaysAgo: 5, doneDaysAgo: 1 },
      { title: 'Implement CSV export for project tasks', description: 'Downloadable task data export formatted in standard RFC-4180 CSV.', priority: 'MEDIUM', assignee_id: alexId, createdDaysAgo: 8, startDaysAgo: 4, doneDaysAgo: 1 },

      // Task moved to DONE then moved back to IN_PROGRESS
      { title: 'Add burndown chart calculation logic', description: 'Calculate daily remaining and ideal workload lines for burndown analytics.', priority: 'HIGH', assignee_id: rahulId, createdDaysAgo: 7, startDaysAgo: 5, doneDaysAgo: 3, movedBackDaysAgo: 1, dueDateOffsetDays: -2 },

      // In Progress tasks
      { title: 'Design mobile responsive layout for Kanban', description: 'Ensure smooth touch dragging and responsive card columns on mobile.', priority: 'MEDIUM', assignee_id: sarahId, createdDaysAgo: 6, startDaysAgo: 3, dueDateOffsetDays: -1 },
      { title: 'Add dark mode toggle prototype', description: 'Test custom theme tokens for high-contrast dark mode surface colors.', priority: 'LOW', assignee_id: alexId, createdDaysAgo: 5, startDaysAgo: 2, dueDateOffsetDays: 1 },
      { title: 'Audit security headers and CORS policy', description: 'Review Helmet security policies and JWT token expiration limits.', priority: 'HIGH', assignee_id: rahulId, createdDaysAgo: 4, startDaysAgo: 1, dueDateOffsetDays: 0 },

      // To Do tasks
      { title: 'Configure automated database backup cron', description: 'Schedule daily pg_dump database snapshots to cloud storage.', priority: 'LOW', assignee_id: sarahId, createdDaysAgo: 5, dueDateOffsetDays: 2 },
      { title: 'Setup Sentry error tracking dashboard', description: 'Integrate front-end error boundary and backend exception reporting.', priority: 'MEDIUM', assignee_id: alexId, createdDaysAgo: 4, dueDateOffsetDays: 4 },
      { title: 'Write user onboarding guide & docs', description: 'Comprehensive guide covering board features, video meetings, and AI assist.', priority: 'LOW', assignee_id: null, createdDaysAgo: 3, dueDateOffsetDays: 7 },
      { title: 'Optimize image asset size & webp conversion', description: 'Compress attachment previews and avatar images for fast page load.', priority: 'LOW', assignee_id: null, createdDaysAgo: 2 },
      { title: 'Add team member activity feed filter', description: 'Filter activity log timeline by user, action type, and date range.', priority: 'MEDIUM', assignee_id: null, createdDaysAgo: 1 },
    ];

    const createdTaskIds = [];
    let posMap = { TODO: 0, IN_PROGRESS: 0, DONE: 0 };

    for (const t of tasksSeedData) {
      const createdAt = new Date(nowMs - t.createdDaysAgo * dayMs);
      
      let finalStatus = 'TODO';
      let updatedAt = createdAt;

      if (t.movedBackDaysAgo !== undefined) {
        finalStatus = 'IN_PROGRESS';
        updatedAt = new Date(nowMs - t.movedBackDaysAgo * dayMs);
      } else if (t.doneDaysAgo !== undefined) {
        finalStatus = 'DONE';
        updatedAt = new Date(nowMs - t.doneDaysAgo * dayMs);
      } else if (t.startDaysAgo !== undefined) {
        finalStatus = 'IN_PROGRESS';
        updatedAt = new Date(nowMs - t.startDaysAgo * dayMs);
      }

      const pos = posMap[finalStatus]++;
      const dueDateStr = (t.dueDateOffsetDays !== undefined && finalStatus !== 'DONE')
        ? new Date(nowMs + t.dueDateOffsetDays * dayMs).toISOString().substring(0, 10)
        : null;

      const taskRes = await client.query(
        `INSERT INTO tasks (title, description, status, priority, position, project_id, assignee_id, due_date, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING id, title;`,
        [t.title, t.description, finalStatus, t.priority, pos, project.id, t.assignee_id, dueDateStr, createdAt, updatedAt]
      );
      const taskId = taskRes.rows[0].id;
      createdTaskIds.push(taskId);

      // 1. Log CREATED
      await client.query(
        `INSERT INTO activity_logs (task_id, user_id, action, from_status, to_status, metadata, created_at)
         VALUES ($1, $2, 'CREATED', NULL, 'TODO', $3, $4);`,
        [taskId, t.assignee_id || rahulId, JSON.stringify({ title: t.title }), createdAt]
      );

      // 2. Log MOVED to IN_PROGRESS if applicable
      if (t.startDaysAgo !== undefined) {
        const startAt = new Date(nowMs - t.startDaysAgo * dayMs);
        await client.query(
          `INSERT INTO activity_logs (task_id, user_id, action, from_status, to_status, metadata, created_at)
           VALUES ($1, $2, 'MOVED', 'TODO', 'IN_PROGRESS', $3, $4);`,
          [taskId, t.assignee_id || rahulId, JSON.stringify({ note: 'Started working on task' }), startAt]
        );
      }

      // 3. Log MOVED to DONE if applicable
      if (t.doneDaysAgo !== undefined) {
        const doneAt = new Date(nowMs - t.doneDaysAgo * dayMs);
        await client.query(
          `INSERT INTO activity_logs (task_id, user_id, action, from_status, to_status, metadata, created_at)
           VALUES ($1, $2, 'MOVED', 'IN_PROGRESS', 'DONE', $3, $4);`,
          [taskId, t.assignee_id || rahulId, JSON.stringify({ note: 'Completed task' }), doneAt]
        );
      }

      // 4. Log MOVED back from DONE to IN_PROGRESS if applicable
      if (t.movedBackDaysAgo !== undefined) {
        const movedBackAt = new Date(nowMs - t.movedBackDaysAgo * dayMs);
        await client.query(
          `INSERT INTO activity_logs (task_id, user_id, action, from_status, to_status, metadata, created_at)
           VALUES ($1, $2, 'MOVED', 'DONE', 'IN_PROGRESS', $3, $4);`,
          [taskId, t.assignee_id || rahulId, JSON.stringify({ note: 'Reopened task for burndown edge case testing' }), movedBackAt]
        );
      }
    }
    console.log(`Seeded ${tasksSeedData.length} tasks with 21-day historical activity logs.`);

    // 5. Seed Comments on Task 1 and Task 4
    const task1Id = createdTaskIds[0];
    const task4Id = createdTaskIds[3];

    await client.query(
      `INSERT INTO comments (task_id, user_id, body) VALUES 
       ($1, $2, 'I have initiated the GitHub Actions workflow definition for staging.'),
       ($1, $3, 'Great! Make sure to store the AWS credentials in GitHub Secrets.'),
       ($4, $2, 'Refactored pointer sensors constraint to prevent accidental dragging on click.')`,
      [task1Id, sarahId, rahulId, task4Id]
    );

    // Log COMMENTED activity for seeded comments
    await client.query(
      `INSERT INTO activity_logs (task_id, user_id, action, metadata) VALUES
       ($1, $2, 'COMMENTED', $3),
       ($1, $4, 'COMMENTED', $5),
       ($6, $2, 'COMMENTED', $7)`,
      [
        task1Id, sarahId, JSON.stringify({ comment_preview: 'I have initiated the GitHub Actions workflow definition for staging.' }),
        rahulId, JSON.stringify({ comment_preview: 'Great! Make sure to store the AWS credentials in GitHub Secrets.' }),
        task4Id, JSON.stringify({ comment_preview: 'Refactored pointer sensors constraint to prevent accidental dragging on click.' })
      ]
    );
    console.log('Seeded comments on demo tasks.');

    // 5.5. Seed Subtasks
    await client.query(
      `INSERT INTO subtasks (task_id, title, done, position) VALUES 
       ($1, 'Define GitHub workflow YAML syntax', true, 0),
       ($1, 'Configure secret variables for staging environment', true, 1),
       ($1, 'Run dry-run build on feature branch', false, 2),
       ($1, 'Verify automated rollback policy', false, 3),
       ($2, 'Audit pointer sensor activation constraints', true, 0),
       ($2, 'Test touch interactions on mobile safari', false, 1),
       ($2, 'Add unit tests for drag end callbacks', false, 2)`,
      [task1Id, task4Id]
    );
    console.log('Seeded subtasks on demo tasks.');

    // 6. Seed Meetings
    const now = new Date();
    const pastTime = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000); // 2 days ago
    const upcoming1Time = new Date(now.getTime() + 2 * 60 * 60 * 1000); // 2 hours from now
    const upcoming2Time = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 1 day from now

    // Past Meeting
    const pastMeetingRes = await client.query(
      `INSERT INTO meetings 
       (project_id, title, description, scheduled_at, duration_minutes, room_name, status, notes, created_by, started_at, ended_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING id`,
      [
        project.id,
        'Sprint Planning & Backlog Grooming',
        'Kickoff meeting to align on Q4 roadmap and task priorities.',
        pastTime,
        45,
        `sprintify-${project.id}-pastmeetingseed123`,
        'ENDED',
        'Key takeaways: Focus on UI polish, dnd-kit performance, and Jitsi video meeting integration.',
        rahulId,
        pastTime,
        new Date(pastTime.getTime() + 45 * 60 * 1000)
      ]
    );
    const pastMeetingId = pastMeetingRes.rows[0].id;
    await client.query(
      `INSERT INTO meeting_participants (meeting_id, user_id, rsvp)
       VALUES ($1, $2, 'ACCEPTED'), ($1, $3, 'ACCEPTED'), ($1, $4, 'ACCEPTED')`,
      [pastMeetingId, rahulId, sarahId, alexId]
    );

    // Upcoming Meeting 1
    const upcoming1Res = await client.query(
      `INSERT INTO meetings 
       (project_id, title, description, scheduled_at, duration_minutes, room_name, status, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
      [
        project.id,
        'Daily Standup & Architecture Sync',
        'Quick 15-minute sync on drag-and-drop bug fixes and API response times.',
        upcoming1Time,
        15,
        `sprintify-${project.id}-upcomingsync456`,
        'SCHEDULED',
        rahulId
      ]
    );
    const upcoming1Id = upcoming1Res.rows[0].id;
    await client.query(
      `INSERT INTO meeting_participants (meeting_id, user_id, rsvp)
       VALUES ($1, $2, 'ACCEPTED'), ($1, $3, 'PENDING'), ($1, $4, 'PENDING')`,
      [upcoming1Id, rahulId, sarahId, alexId]
    );

    // Upcoming Meeting 2
    const upcoming2Res = await client.query(
      `INSERT INTO meetings 
       (project_id, title, description, scheduled_at, duration_minutes, room_name, status, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
      [
        project.id,
        'Sprint Demo & Retrospective',
        'End-of-sprint demo with project stakeholders.',
        upcoming2Time,
        30,
        `sprintify-${project.id}-retrodemo789`,
        'SCHEDULED',
        rahulId
      ]
    );
    const upcoming2Id = upcoming2Res.rows[0].id;
    await client.query(
      `INSERT INTO meeting_participants (meeting_id, user_id, rsvp)
       VALUES ($1, $2, 'ACCEPTED'), ($1, $3, 'ACCEPTED'), ($1, $4, 'DECLINED')`,
      [upcoming2Id, rahulId, sarahId, alexId]
    );

    console.log('Seeded 3 demo meetings.');

    // 7. Seed Notification Preferences
    await client.query(
      `INSERT INTO notification_preferences (user_id, in_app_enabled, email_enabled, email_on_assigned, email_on_due, email_on_comment)
       VALUES 
         ($1, true, false, true, true, false),
         ($2, true, false, true, true, false),
         ($3, true, false, true, true, false);`,
      [rahulId, sarahId, alexId]
    );

    // 8. Seed 7 Sample Notifications for Rahul Sharma
    const todayStr = new Date().toISOString().substring(0, 10);
    const yesterdayStr = new Date(nowMs - dayMs).toISOString().substring(0, 10);

    await client.query(
      `INSERT INTO notifications (user_id, type, title, body, project_id, task_id, link, dedupe_key, read_at, created_at)
       VALUES
         ($1, 'TASK_ASSIGNED', 'Sarah Chen assigned you a task', 'Refactor Kanban board DnD state handling', $2, 4, '/projects/1', NULL, NULL, $3),
         ($1, 'COMMENT_ADDED', 'New comment on "Set up CI/CD deployment pipeline"', 'Great! Make sure to store the AWS credentials in GitHub Secrets.', $2, 1, '/projects/1', NULL, $4, $5),
         ($1, 'TASK_DUE_SOON', 'Task due soon', 'Audit security headers and CORS policy is due today', $2, 20, '/projects/1', $6, NULL, $7),
         ($1, 'TASK_OVERDUE', 'Task overdue!', 'Add burndown chart calculation logic was due 2 days ago', $2, 17, '/projects/1', $8, NULL, $9),
         ($1, 'ADDED_TO_PROJECT', 'Added to project', 'You were added to Sprintify Web & Mobile App as OWNER', $2, NULL, '/projects/1', NULL, $4, $10),
         ($1, 'MEETING_INVITE', 'Meeting Invitation', 'Daily Standup & Architecture Sync scheduled for today', $2, NULL, '/projects/1?tab=meetings', NULL, NULL, $11),
         ($1, 'TASK_ASSIGNED', 'Sarah Chen assigned you a task', 'Integrate Gemini AI task assistant API', $2, 14, '/projects/1', NULL, $4, $12)`,
      [
        rahulId,
        project.id,
        new Date(nowMs - 2 * 60 * 60 * 1000), // 2h ago
        new Date(nowMs - 1 * 60 * 60 * 1000), // read 1h ago
        new Date(nowMs - 3 * 60 * 60 * 1000), // created 3h ago
        `due_soon:20:${todayStr}`,
        new Date(nowMs - 4 * 60 * 60 * 1000), // 4h ago
        `overdue:17:${yesterdayStr}`,
        new Date(nowMs - 5 * 60 * 60 * 1000), // 5h ago
        new Date(nowMs - 24 * 60 * 60 * 1000), // 1d ago
        new Date(nowMs - 30 * 60 * 1000), // 30m ago
        new Date(nowMs - 48 * 60 * 60 * 1000), // 2d ago
      ]
    );
    console.log('Seeded sample notifications and preferences.');

    console.log('\nSeed successful! Demo login credentials:');
    console.log(' - rahul@example.com / password123');
    console.log(' - sarah@example.com / password123');
    console.log(' - alex@example.com / password123');
  } catch (err) {
    console.error('Seeding failed:', err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

seedDatabase();
