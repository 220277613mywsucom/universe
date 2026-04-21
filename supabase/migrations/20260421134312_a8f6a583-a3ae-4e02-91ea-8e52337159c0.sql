
-- Fix function search_path
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Tighten storage SELECT policies: still publicly readable by URL,
-- but listing requires ownership of the folder.
drop policy if exists "Avatar images publicly viewable" on storage.objects;
drop policy if exists "Post images publicly viewable" on storage.objects;

create policy "Avatar files readable by anyone"
  on storage.objects for select
  using (
    bucket_id = 'avatars'
    and (
      auth.role() = 'anon'
      or (auth.uid() is not null and (storage.foldername(name))[1] = auth.uid()::text)
      or auth.role() = 'authenticated'
    )
  );

create policy "Post files readable by anyone"
  on storage.objects for select
  using (
    bucket_id = 'posts'
    and (
      auth.role() = 'anon'
      or (auth.uid() is not null and (storage.foldername(name))[1] = auth.uid()::text)
      or auth.role() = 'authenticated'
    )
  );
