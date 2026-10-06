export type TaskStatus = 'TODO' | 'IN_PROGRESS' | 'DONE';
export type TaskPriority = 'LOW' | 'MEDIUM' | 'HIGH';
export type MemberRole = 'OWNER' | 'MEMBER';
export type MeetingStatus = 'SCHEDULED' | 'LIVE' | 'ENDED';
export type RsvpStatus = 'PENDING' | 'ACCEPTED' | 'DECLINED';

export interface User {
  id: number;
  name: string;
  email: string;
  created_at?: string;
}

export interface ProjectMember {
  id: number;
  name: string;
  email: string;
  role: MemberRole;
}

export interface Project {
  id: number;
  title: string;
  description: string;
  created_by: number;
  created_at: string;
  updated_at: string;
  role?: MemberRole;
  current_user_role?: MemberRole;
  member_count?: number;
  task_count?: number;
  members?: ProjectMember[];
}

export interface Task {
  id: number;
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  position: number;
  project_id: number;
  assignee_id: number | null;
  assignee?: {
    id: number;
    name: string;
    email: string;
  } | null;
  comment_count?: number;
  attachment_count?: number;
  subtask_total?: number;
  subtask_done?: number;
  due_date?: string | null;
  created_at: string;
  updated_at: string;
}

export type NotificationType =
  | 'TASK_ASSIGNED'
  | 'TASK_DUE_SOON'
  | 'TASK_OVERDUE'
  | 'COMMENT_ADDED'
  | 'ADDED_TO_PROJECT'
  | 'MEETING_INVITE';

export interface Notification {
  id: number;
  user_id: number;
  type: NotificationType;
  title: string;
  body: string | null;
  project_id: number | null;
  task_id: number | null;
  link: string | null;
  dedupe_key: string | null;
  read_at: string | null;
  created_at: string;
}

export interface NotificationPreferences {
  user_id: number;
  in_app_enabled: boolean;
  email_enabled: boolean;
  email_on_assigned: boolean;
  email_on_due: boolean;
  email_on_comment: boolean;
}

export interface Subtask {
  id: number;
  task_id: number;
  title: string;
  done: boolean;
  position: number;
  created_at: string;
  updated_at: string;
}

export interface AiAssistResponse {
  description: string;
  subtasks: string[];
  suggested_priority: TaskPriority;
}

export interface ActivityLog {
  id: number;
  task_id: number;
  user_id: number | null;
  action: string;
  from_status: TaskStatus | null;
  to_status: TaskStatus | null;
  metadata: Record<string, any> | null;
  created_at: string;
  user_name?: string;
  user_email?: string;
}

export interface Comment {
  id: number;
  task_id: number;
  user_id: number | null;
  body: string;
  created_at: string;
  updated_at: string;
  edited: boolean;
  author: {
    id: number;
    name: string;
    email: string;
  };
}

export interface Attachment {
  id: number;
  task_id: number;
  uploaded_by: number | null;
  original_name: string;
  stored_name: string;
  mime_type: string;
  size_bytes: number;
  created_at: string;
  uploader?: {
    id: number;
    name: string;
    email: string;
  };
}

export interface MeetingParticipant {
  id: number;
  name: string;
  email: string;
  rsvp: RsvpStatus;
}

export interface Meeting {
  id: number;
  project_id: number;
  title: string;
  description: string | null;
  scheduled_at: string;
  duration_minutes: number;
  room_name: string;
  status: MeetingStatus;
  notes: string | null;
  created_by: number | null;
  creator?: {
    id: number;
    name: string;
    email: string;
  } | null;
  started_at: string | null;
  ended_at: string | null;
  created_at: string;
  updated_at: string;
  participants?: MeetingParticipant[];
}

export interface JoinMeetingResponse {
  provider: 'jaas' | 'jitsi-public';
  roomName: string;
  joinUrl: string;
  jwt?: string;
  appId?: string;
  meeting: Meeting;
}

export interface Actor {
  id: number;
  name: string;
}

export interface OnlineUser {
  id: number;
  name: string;
}

export interface TaskMovedPayload {
  projectId: number;
  task: Task;
  from_status: TaskStatus;
  to_status: TaskStatus;
  affected: Array<{ id: number; status: TaskStatus; position: number }>;
  actor: Actor;
}

export type AnalyticsRange = '7' | '14' | '30' | 'all';

export interface AnalyticsSummary {
  total: number;
  todo: number;
  in_progress: number;
  done: number;
  completion_rate: number;
  avg_cycle_time_hours: number;
  avg_lead_time_hours: number;
  completed_in_range: number;
  completed_in_previous_range: number;
  overdue_count?: number;
}

export interface StatusDistribution {
  status: TaskStatus;
  count: number;
}

export interface PriorityDistribution {
  priority: TaskPriority;
  count: number;
  done: number;
}

export interface WorkloadMember {
  user_id: number | null;
  name: string;
  todo: number;
  in_progress: number;
  done: number;
  total: number;
}

export interface ThroughputPoint {
  date: string;
  completed: number;
}

export interface BurndownPoint {
  date: string;
  remaining: number;
  ideal: number;
}

export interface TopContributor {
  user_id: number;
  name: string;
  completed: number;
}

export interface AnalyticsData {
  summary: AnalyticsSummary;
  status_distribution: StatusDistribution[];
  priority_distribution: PriorityDistribution[];
  workload: WorkloadMember[];
  throughput: ThroughputPoint[];
  burndown: BurndownPoint[];
  top_contributors: TopContributor[];
  insights: string[];
}

export interface ProjectSearchResult {
  id: number;
  title: string;
  description_snippet: string;
  task_count: number;
}

export interface TaskSearchResult {
  id: number;
  title: string;
  status: TaskStatus;
  priority: TaskPriority;
  due_date: string | null;
  project_id: number;
  project_title: string;
  assignee: {
    id: number;
    name: string;
  } | null;
}

export interface SearchResult {
  projects: ProjectSearchResult[];
  tasks: TaskSearchResult[];
}

export type DueFilterOption = 'overdue' | 'today' | 'next7' | 'nodue' | 'all';

export interface BoardFilterState {
  searchQuery: string;
  priorities: TaskPriority[];
  assignees: string[];
  due: DueFilterOption;
  myTasksOnly: boolean;
}

