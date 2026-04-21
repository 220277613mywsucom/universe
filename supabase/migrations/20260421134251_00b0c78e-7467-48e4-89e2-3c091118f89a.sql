
-- PROFILES
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null,
  display_name text not null,
  avatar_url text,
  bio text,
  uwc_school text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.profiles enable row level security;

create policy "Profiles are viewable by authenticated users"
  on public.profiles for select to authenticated using (true);
create policy "Users can insert own profile"
  on public.profiles for insert to authenticated with check (auth.uid() = id);
create policy "Users can update own profile"
  on public.profiles for update to authenticated using (auth.uid() = id);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  base_username text;
  final_username text;
  counter int := 0;
begin
  base_username := lower(split_part(new.email, '@', 1));
  base_username := regexp_replace(base_username, '[^a-z0-9_]', '', 'g');
  if length(base_username) < 3 then
    base_username := 'user' || substr(new.id::text, 1, 6);
  end if;
  final_username := base_username;
  while exists (select 1 from public.profiles where username = final_username) loop
    counter := counter + 1;
    final_username := base_username || counter::text;
  end loop;

  insert into public.profiles (id, username, display_name, uwc_school)
  values (
    new.id,
    final_username,
    coalesce(new.raw_user_meta_data->>'display_name', final_username),
    new.raw_user_meta_data->>'uwc_school'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- updated_at trigger
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();

-- POSTS (Instagram)
create table public.posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  image_url text not null,
  caption text,
  created_at timestamptz not null default now()
);
alter table public.posts enable row level security;
create index posts_user_id_idx on public.posts(user_id);
create index posts_created_at_idx on public.posts(created_at desc);

create policy "Posts viewable by authenticated"
  on public.posts for select to authenticated using (true);
create policy "Users insert own posts"
  on public.posts for insert to authenticated with check (auth.uid() = user_id);
create policy "Users update own posts"
  on public.posts for update to authenticated using (auth.uid() = user_id);
create policy "Users delete own posts"
  on public.posts for delete to authenticated using (auth.uid() = user_id);

-- MOMENTS (Snapchat - 24h)
create table public.moments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  image_url text not null,
  caption text,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '24 hours')
);
alter table public.moments enable row level security;
create index moments_expires_idx on public.moments(expires_at);

create policy "Moments viewable when not expired"
  on public.moments for select to authenticated using (expires_at > now());
create policy "Users insert own moments"
  on public.moments for insert to authenticated with check (auth.uid() = user_id);
create policy "Users delete own moments"
  on public.moments for delete to authenticated using (auth.uid() = user_id);

-- WHISPERS (Twitter)
create table public.whispers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  content text not null check (char_length(content) between 1 and 280),
  created_at timestamptz not null default now()
);
alter table public.whispers enable row level security;
create index whispers_created_at_idx on public.whispers(created_at desc);

create policy "Whispers viewable by authenticated"
  on public.whispers for select to authenticated using (true);
create policy "Users insert own whispers"
  on public.whispers for insert to authenticated with check (auth.uid() = user_id);
create policy "Users delete own whispers"
  on public.whispers for delete to authenticated using (auth.uid() = user_id);

-- LIKES (polymorphic via target_type)
create table public.likes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  target_type text not null check (target_type in ('post','whisper')),
  target_id uuid not null,
  created_at timestamptz not null default now(),
  unique (user_id, target_type, target_id)
);
alter table public.likes enable row level security;
create index likes_target_idx on public.likes(target_type, target_id);

create policy "Likes viewable by authenticated"
  on public.likes for select to authenticated using (true);
create policy "Users insert own likes"
  on public.likes for insert to authenticated with check (auth.uid() = user_id);
create policy "Users delete own likes"
  on public.likes for delete to authenticated using (auth.uid() = user_id);

-- COMMENTS
create table public.comments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  target_type text not null check (target_type in ('post','whisper')),
  target_id uuid not null,
  body text not null check (char_length(body) between 1 and 500),
  created_at timestamptz not null default now()
);
alter table public.comments enable row level security;
create index comments_target_idx on public.comments(target_type, target_id);

create policy "Comments viewable by authenticated"
  on public.comments for select to authenticated using (true);
create policy "Users insert own comments"
  on public.comments for insert to authenticated with check (auth.uid() = user_id);
create policy "Users delete own comments"
  on public.comments for delete to authenticated using (auth.uid() = user_id);

-- MESSAGES (WhatsApp 1:1)
create table public.messages (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references auth.users(id) on delete cascade,
  recipient_id uuid not null references auth.users(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 2000),
  read boolean not null default false,
  created_at timestamptz not null default now()
);
alter table public.messages enable row level security;
create index messages_pair_idx on public.messages(sender_id, recipient_id, created_at desc);
create index messages_recipient_idx on public.messages(recipient_id, created_at desc);

create policy "Users view their messages"
  on public.messages for select to authenticated
  using (auth.uid() = sender_id or auth.uid() = recipient_id);
create policy "Users send messages"
  on public.messages for insert to authenticated with check (auth.uid() = sender_id);
create policy "Recipients mark as read"
  on public.messages for update to authenticated
  using (auth.uid() = recipient_id) with check (auth.uid() = recipient_id);

-- STORAGE BUCKETS
insert into storage.buckets (id, name, public) values
  ('avatars','avatars', true),
  ('posts','posts', true)
on conflict (id) do nothing;

create policy "Avatar images publicly viewable"
  on storage.objects for select using (bucket_id = 'avatars');
create policy "Users upload own avatar"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "Users update own avatar"
  on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "Users delete own avatar"
  on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "Post images publicly viewable"
  on storage.objects for select using (bucket_id = 'posts');
create policy "Users upload own post images"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'posts' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "Users delete own post images"
  on storage.objects for delete to authenticated
  using (bucket_id = 'posts' and (storage.foldername(name))[1] = auth.uid()::text);
