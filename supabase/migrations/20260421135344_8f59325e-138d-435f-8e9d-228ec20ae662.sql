-- FOLLOWS
create table if not exists public.follows (
  id uuid primary key default gen_random_uuid(),
  follower_id uuid not null,
  following_id uuid not null,
  created_at timestamptz not null default now(),
  unique(follower_id, following_id),
  check (follower_id <> following_id)
);
alter table public.follows enable row level security;
create policy "Follows viewable by authenticated" on public.follows for select to authenticated using (true);
create policy "Users insert own follows" on public.follows for insert to authenticated with check (auth.uid() = follower_id);
create policy "Users delete own follows" on public.follows for delete to authenticated using (auth.uid() = follower_id);
create index if not exists follows_follower_idx on public.follows(follower_id);
create index if not exists follows_following_idx on public.follows(following_id);

-- BOOKMARKS
create table if not exists public.bookmarks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  target_id uuid not null,
  target_type text not null check (target_type in ('post','whisper')),
  created_at timestamptz not null default now(),
  unique(user_id, target_type, target_id)
);
alter table public.bookmarks enable row level security;
create policy "Users view own bookmarks" on public.bookmarks for select to authenticated using (auth.uid() = user_id);
create policy "Users insert own bookmarks" on public.bookmarks for insert to authenticated with check (auth.uid() = user_id);
create policy "Users delete own bookmarks" on public.bookmarks for delete to authenticated using (auth.uid() = user_id);

-- NOTIFICATIONS
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,        -- recipient
  actor_id uuid not null,       -- who did it
  type text not null check (type in ('like','comment','follow','message','mention')),
  target_type text,             -- 'post' | 'whisper' | 'moment' | null
  target_id uuid,
  preview text,
  read boolean not null default false,
  created_at timestamptz not null default now()
);
alter table public.notifications enable row level security;
create policy "Users view own notifications" on public.notifications for select to authenticated using (auth.uid() = user_id);
create policy "Users update own notifications" on public.notifications for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users delete own notifications" on public.notifications for delete to authenticated using (auth.uid() = user_id);
create policy "System inserts notifications" on public.notifications for insert to authenticated with check (auth.uid() = actor_id);
create index if not exists notif_user_idx on public.notifications(user_id, created_at desc);

-- TRIGGER FUNCTIONS to create notifications automatically
create or replace function public.notify_on_like()
returns trigger language plpgsql security definer set search_path = public as $$
declare owner_id uuid;
begin
  if new.target_type = 'post' then select user_id into owner_id from public.posts where id = new.target_id;
  elsif new.target_type = 'whisper' then select user_id into owner_id from public.whispers where id = new.target_id;
  elsif new.target_type = 'moment' then select user_id into owner_id from public.moments where id = new.target_id;
  end if;
  if owner_id is not null and owner_id <> new.user_id then
    insert into public.notifications(user_id, actor_id, type, target_type, target_id)
    values (owner_id, new.user_id, 'like', new.target_type, new.target_id);
  end if;
  return new;
end $$;
drop trigger if exists trg_notify_like on public.likes;
create trigger trg_notify_like after insert on public.likes for each row execute function public.notify_on_like();

create or replace function public.notify_on_comment()
returns trigger language plpgsql security definer set search_path = public as $$
declare owner_id uuid;
begin
  if new.target_type = 'post' then select user_id into owner_id from public.posts where id = new.target_id;
  elsif new.target_type = 'whisper' then select user_id into owner_id from public.whispers where id = new.target_id;
  end if;
  if owner_id is not null and owner_id <> new.user_id then
    insert into public.notifications(user_id, actor_id, type, target_type, target_id, preview)
    values (owner_id, new.user_id, 'comment', new.target_type, new.target_id, left(new.body, 100));
  end if;
  return new;
end $$;
drop trigger if exists trg_notify_comment on public.comments;
create trigger trg_notify_comment after insert on public.comments for each row execute function public.notify_on_comment();

create or replace function public.notify_on_follow()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.notifications(user_id, actor_id, type)
  values (new.following_id, new.follower_id, 'follow');
  return new;
end $$;
drop trigger if exists trg_notify_follow on public.follows;
create trigger trg_notify_follow after insert on public.follows for each row execute function public.notify_on_follow();

create or replace function public.notify_on_message()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.notifications(user_id, actor_id, type, target_type, target_id, preview)
  values (new.recipient_id, new.sender_id, 'message', 'message', new.id, left(new.body, 100));
  return new;
end $$;
drop trigger if exists trg_notify_message on public.messages;
create trigger trg_notify_message after insert on public.messages for each row execute function public.notify_on_message();

-- Realtime
alter publication supabase_realtime add table public.posts;
alter publication supabase_realtime add table public.moments;
alter publication supabase_realtime add table public.whispers;
alter publication supabase_realtime add table public.likes;
alter publication supabase_realtime add table public.comments;
alter publication supabase_realtime add table public.follows;
alter publication supabase_realtime add table public.notifications;
alter publication supabase_realtime add table public.messages;