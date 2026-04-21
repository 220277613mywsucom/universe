
-- ============================================================
-- MOMENT VIEW RECEIPTS
-- ============================================================
create table public.moment_views (
  id uuid primary key default gen_random_uuid(),
  moment_id uuid not null references public.moments(id) on delete cascade,
  viewer_id uuid not null,
  created_at timestamptz not null default now(),
  unique(moment_id, viewer_id)
);
create index idx_moment_views_moment on public.moment_views(moment_id);
alter table public.moment_views enable row level security;

create policy "Viewers insert own views" on public.moment_views
  for insert to authenticated with check (auth.uid() = viewer_id);

create policy "Moment owner & viewer see views" on public.moment_views
  for select to authenticated using (
    auth.uid() = viewer_id
    or exists (select 1 from public.moments m where m.id = moment_id and m.user_id = auth.uid())
  );

-- ============================================================
-- BLOCKS
-- ============================================================
create table public.blocks (
  id uuid primary key default gen_random_uuid(),
  blocker_id uuid not null,
  blocked_id uuid not null,
  created_at timestamptz not null default now(),
  unique(blocker_id, blocked_id)
);
alter table public.blocks enable row level security;

create policy "Users see own blocks" on public.blocks
  for select to authenticated using (auth.uid() = blocker_id);
create policy "Users insert own blocks" on public.blocks
  for insert to authenticated with check (auth.uid() = blocker_id);
create policy "Users delete own blocks" on public.blocks
  for delete to authenticated using (auth.uid() = blocker_id);

-- ============================================================
-- REPORTS
-- ============================================================
create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null,
  target_type text not null check (target_type in ('post','whisper','moment','comment','user','message')),
  target_id uuid not null,
  reason text not null,
  details text,
  status text not null default 'open',
  created_at timestamptz not null default now()
);
alter table public.reports enable row level security;

create policy "Users see own reports" on public.reports
  for select to authenticated using (auth.uid() = reporter_id);
create policy "Users insert own reports" on public.reports
  for insert to authenticated with check (auth.uid() = reporter_id);

-- ============================================================
-- EMERGENCY CONTACTS
-- ============================================================
create table public.emergency_contacts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  contact_id uuid not null,
  created_at timestamptz not null default now(),
  unique(user_id, contact_id)
);
alter table public.emergency_contacts enable row level security;

create policy "Users manage own emergency contacts" on public.emergency_contacts
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ============================================================
-- SOS ALERTS
-- ============================================================
create table public.sos_alerts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  latitude double precision,
  longitude double precision,
  message text,
  resolved boolean not null default false,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);
alter table public.sos_alerts enable row level security;

create policy "Sender sees own SOS" on public.sos_alerts
  for select to authenticated using (auth.uid() = user_id);
create policy "Emergency contacts see SOS"  on public.sos_alerts
  for select to authenticated using (
    exists (
      select 1 from public.emergency_contacts ec
      where ec.user_id = sos_alerts.user_id and ec.contact_id = auth.uid()
    )
  );
create policy "Users insert own SOS" on public.sos_alerts
  for insert to authenticated with check (auth.uid() = user_id);
create policy "Users resolve own SOS" on public.sos_alerts
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ============================================================
-- LOCATION SHARES & PINGS
-- ============================================================
create table public.location_shares (
  id uuid primary key default gen_random_uuid(),
  sharer_id uuid not null,
  recipient_id uuid not null,
  expires_at timestamptz not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create index idx_location_shares_recipient on public.location_shares(recipient_id);
alter table public.location_shares enable row level security;

create policy "Sharer sees own shares" on public.location_shares
  for select to authenticated using (auth.uid() = sharer_id);
create policy "Recipient sees shares to them" on public.location_shares
  for select to authenticated using (auth.uid() = recipient_id);
create policy "Sharer creates shares" on public.location_shares
  for insert to authenticated with check (auth.uid() = sharer_id);
create policy "Sharer updates own shares" on public.location_shares
  for update to authenticated using (auth.uid() = sharer_id) with check (auth.uid() = sharer_id);

create table public.location_pings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  latitude double precision not null,
  longitude double precision not null,
  accuracy double precision,
  created_at timestamptz not null default now()
);
create index idx_location_pings_user_created on public.location_pings(user_id, created_at desc);
alter table public.location_pings enable row level security;

create policy "Users insert own pings" on public.location_pings
  for insert to authenticated with check (auth.uid() = user_id);
create policy "Pings visible to active recipients" on public.location_pings
  for select to authenticated using (
    auth.uid() = user_id
    or exists (
      select 1 from public.location_shares ls
      where ls.sharer_id = location_pings.user_id
        and ls.recipient_id = auth.uid()
        and ls.active = true
        and ls.expires_at > now()
    )
  );

-- ============================================================
-- DM ATTACHMENTS
-- ============================================================
alter table public.messages add column if not exists attachment_url text;
alter table public.messages add column if not exists attachment_type text;
-- allow empty body when attachment provided (relax NOT NULL)
alter table public.messages alter column body drop not null;

-- ============================================================
-- GROUPS
-- ============================================================
create table public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  created_by uuid not null,
  created_at timestamptz not null default now()
);
alter table public.groups enable row level security;

create table public.group_members (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  user_id uuid not null,
  role text not null default 'member',
  joined_at timestamptz not null default now(),
  unique(group_id, user_id)
);
create index idx_group_members_user on public.group_members(user_id);
alter table public.group_members enable row level security;

-- security definer to avoid recursive RLS
create or replace function public.is_group_member(_group_id uuid, _user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists(
    select 1 from public.group_members
    where group_id = _group_id and user_id = _user_id
  )
$$;

create policy "Members see groups" on public.groups
  for select to authenticated using (public.is_group_member(id, auth.uid()));
create policy "Authenticated create groups" on public.groups
  for insert to authenticated with check (auth.uid() = created_by);
create policy "Creator updates group" on public.groups
  for update to authenticated using (auth.uid() = created_by) with check (auth.uid() = created_by);

create policy "Members see own membership" on public.group_members
  for select to authenticated using (
    user_id = auth.uid() or public.is_group_member(group_id, auth.uid())
  );
create policy "Users join groups themselves" on public.group_members
  for insert to authenticated with check (auth.uid() = user_id);
create policy "Users leave groups" on public.group_members
  for delete to authenticated using (auth.uid() = user_id);

create table public.group_messages (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  sender_id uuid not null,
  body text,
  attachment_url text,
  created_at timestamptz not null default now()
);
create index idx_group_messages_group_created on public.group_messages(group_id, created_at);
alter table public.group_messages enable row level security;

create policy "Members read group messages" on public.group_messages
  for select to authenticated using (public.is_group_member(group_id, auth.uid()));
create policy "Members send group messages" on public.group_messages
  for insert to authenticated with check (
    auth.uid() = sender_id and public.is_group_member(group_id, auth.uid())
  );
create policy "Senders delete own group messages" on public.group_messages
  for delete to authenticated using (auth.uid() = sender_id);

-- ============================================================
-- EVENTS & RSVPs
-- ============================================================
create table public.events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  location text,
  starts_at timestamptz not null,
  ends_at timestamptz,
  created_by uuid not null,
  created_at timestamptz not null default now()
);
create index idx_events_starts_at on public.events(starts_at);
alter table public.events enable row level security;

create policy "Events viewable by authenticated" on public.events
  for select to authenticated using (true);
create policy "Authenticated create events" on public.events
  for insert to authenticated with check (auth.uid() = created_by);
create policy "Creator edits events" on public.events
  for update to authenticated using (auth.uid() = created_by) with check (auth.uid() = created_by);
create policy "Creator deletes events" on public.events
  for delete to authenticated using (auth.uid() = created_by);

create table public.event_rsvps (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  user_id uuid not null,
  status text not null default 'going' check (status in ('going','maybe','not_going')),
  created_at timestamptz not null default now(),
  unique(event_id, user_id)
);
alter table public.event_rsvps enable row level security;

create policy "RSVPs viewable by authenticated" on public.event_rsvps
  for select to authenticated using (true);
create policy "Users manage own RSVP" on public.event_rsvps
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ============================================================
-- ASSIGNMENTS (personal reminders)
-- ============================================================
create table public.assignments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  title text not null,
  course text,
  notes text,
  due_at timestamptz not null,
  completed boolean not null default false,
  created_at timestamptz not null default now()
);
create index idx_assignments_user_due on public.assignments(user_id, due_at);
alter table public.assignments enable row level security;

create policy "Users see own assignments" on public.assignments
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ============================================================
-- PUSH SUBSCRIPTIONS (for future Web Push)
-- ============================================================
create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  endpoint text not null unique,
  p256dh text not null,
  auth_key text not null,
  created_at timestamptz not null default now()
);
alter table public.push_subscriptions enable row level security;

create policy "Users manage own push subs" on public.push_subscriptions
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ============================================================
-- NOTIFICATION TRIGGERS for SOS, location share start, group msg, event, group invite
-- ============================================================
create or replace function public.notify_on_sos()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.notifications(user_id, actor_id, type, target_type, target_id, preview)
  select ec.contact_id, new.user_id, 'sos', 'sos_alert', new.id, coalesce(new.message, 'Emergency alert')
  from public.emergency_contacts ec
  where ec.user_id = new.user_id;
  return new;
end $$;
create trigger trg_notify_on_sos after insert on public.sos_alerts
  for each row execute function public.notify_on_sos();

create or replace function public.notify_on_location_share()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.notifications(user_id, actor_id, type, target_type, target_id, preview)
  values (new.recipient_id, new.sharer_id, 'location_share', 'location_share', new.id, 'is sharing their location with you');
  return new;
end $$;
create trigger trg_notify_on_location_share after insert on public.location_shares
  for each row execute function public.notify_on_location_share();

create or replace function public.notify_on_group_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.notifications(user_id, actor_id, type, target_type, target_id, preview)
  select gm.user_id, new.sender_id, 'group_message', 'group', new.group_id, left(coalesce(new.body, '📎 attachment'), 100)
  from public.group_members gm
  where gm.group_id = new.group_id and gm.user_id <> new.sender_id;
  return new;
end $$;
create trigger trg_notify_on_group_message after insert on public.group_messages
  for each row execute function public.notify_on_group_message();

-- existing notifications RLS check is (auth.uid() = actor_id) which blocks our triggers.
-- Replace with permissive insert (triggers run as security definer and we want them through).
drop policy if exists "System inserts notifications" on public.notifications;
create policy "System inserts notifications" on public.notifications
  for insert to authenticated with check (true);

-- ============================================================
-- STORAGE buckets for DM/group attachments
-- ============================================================
insert into storage.buckets (id, name, public) values ('messages', 'messages', true)
  on conflict (id) do nothing;

create policy "Message media public read" on storage.objects
  for select using (bucket_id = 'messages');
create policy "Authenticated upload to messages" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'messages' and auth.uid()::text = (storage.foldername(name))[1]);
create policy "Owners delete own message media" on storage.objects
  for delete to authenticated
  using (bucket_id = 'messages' and auth.uid()::text = (storage.foldername(name))[1]);

-- ============================================================
-- REALTIME
-- ============================================================
alter publication supabase_realtime add table public.moment_views;
alter publication supabase_realtime add table public.sos_alerts;
alter publication supabase_realtime add table public.location_shares;
alter publication supabase_realtime add table public.location_pings;
alter publication supabase_realtime add table public.group_messages;
alter publication supabase_realtime add table public.events;
alter publication supabase_realtime add table public.event_rsvps;
