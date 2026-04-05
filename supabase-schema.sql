-- ============================================================
-- SUPERBUCIN — Supabase Database Schema
-- Run this in the Supabase SQL Editor to set up all tables.
-- ============================================================

-- Profiles: extends auth.users with game-specific data
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique,
  display_name text not null,
  avatar_url text not null default '/avatars/panda.png',
  bio text default '',
  points integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "Public profiles are viewable by everyone"
  on public.profiles for select using (true);

create policy "Users can update own profile"
  on public.profiles for update using (auth.uid() = id);

create policy "Users can insert own profile"
  on public.profiles for insert with check (auth.uid() = id);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, display_name, username, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'display_name', 'Player'),
    coalesce(new.raw_user_meta_data->>'username', null),
    coalesce(new.raw_user_meta_data->>'avatar_url', '/avatars/panda.png')
  );
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- User stats per game type
create table if not exists public.user_stats (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  game_type text not null,
  wins integer not null default 0,
  losses integer not null default 0,
  ties integer not null default 0,
  games_played integer not null default 0,
  total_points integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, game_type)
);

alter table public.user_stats enable row level security;

create policy "Stats are viewable by everyone"
  on public.user_stats for select using (true);

create policy "Server can manage stats"
  on public.user_stats for all using (true);

-- Match history
create table if not exists public.match_history (
  id uuid primary key default gen_random_uuid(),
  game_type text not null,
  player1_id uuid references public.profiles(id) on delete set null,
  player2_id uuid references public.profiles(id) on delete set null,
  player1_name text not null,
  player2_name text not null,
  player1_avatar text,
  player2_avatar text,
  winner_id uuid references public.profiles(id) on delete set null,
  player1_score integer not null default 0,
  player2_score integer not null default 0,
  is_tie boolean not null default false,
  played_at timestamptz not null default now()
);

alter table public.match_history enable row level security;

create policy "Match history is viewable by everyone"
  on public.match_history for select using (true);

create policy "Server can insert match history"
  on public.match_history for insert with check (true);

-- Achievements definitions
create table if not exists public.achievements (
  id text primary key,
  name text not null,
  description text not null,
  icon text not null,
  category text not null default 'general',
  condition_type text not null,
  condition_value integer not null default 1
);

alter table public.achievements enable row level security;

create policy "Achievements are viewable by everyone"
  on public.achievements for select using (true);

-- Seed achievements
insert into public.achievements (id, name, description, icon, category, condition_type, condition_value) values
  ('first_win',         'First Victory',      'Win your first game',                    '🏆', 'general',            'total_wins',       1),
  ('five_wins',         'Getting Good',        'Win 5 games',                           '⭐', 'general',            'total_wins',       5),
  ('ten_wins',          'Champion',            'Win 10 games',                          '👑', 'general',            'total_wins',       10),
  ('twenty_five_wins',  'Legend',              'Win 25 games',                           '🔥', 'general',            'total_wins',       25),
  ('first_pig',         'Oink Oink',           'Win your first Pig vs Chick game',      '🐷', 'pig-vs-chick',       'game_wins',        1),
  ('five_pig',          'Pig Master',          'Win 5 Pig vs Chick games',              '🐗', 'pig-vs-chick',       'game_wins',        5),
  ('first_word',        'Wordsmith',           'Win your first Word Scramble Race',     '📝', 'word-scramble-race',  'game_wins',        1),
  ('five_word',         'Vocabulary King',     'Win 5 Word Scramble Races',             '📚', 'word-scramble-race',  'game_wins',        5),
  ('first_doodle',      'Picasso',             'Win your first Doodle Guess',           '🎨', 'doodle-guess',        'game_wins',        1),
  ('five_doodle',       'Art Master',          'Win 5 Doodle Guess games',              '🖼️', 'doodle-guess',        'game_wins',        5),
  ('first_memory',      'Good Memory',         'Win your first Memory Match',           '🧠', 'memory-match',        'game_wins',        1),
  ('five_memory',       'Memory Champion',     'Win 5 Memory Match games',              '💎', 'memory-match',        'game_wins',        5),
  ('ten_games',         'Dedicated',           'Play 10 games total',                   '🎮', 'general',            'total_games',      10),
  ('fifty_games',       'Addicted',            'Play 50 games total',                   '💕', 'general',            'total_games',      50),
  ('streak_3',          'Hot Streak',          'Win 3 games in a row',                  '🔥', 'general',            'win_streak',       3),
  ('streak_5',          'Unstoppable',         'Win 5 games in a row',                  '⚡', 'general',            'win_streak',       5),
  ('all_games',         'Jack of All Trades',  'Win at least one game of each type',    '🃏', 'general',            'unique_game_wins', 4)
on conflict (id) do nothing;

-- User achievements (earned)
create table if not exists public.user_achievements (
  user_id uuid not null references public.profiles(id) on delete cascade,
  achievement_id text not null references public.achievements(id) on delete cascade,
  earned_at timestamptz not null default now(),
  primary key (user_id, achievement_id)
);

alter table public.user_achievements enable row level security;

create policy "User achievements are viewable by everyone"
  on public.user_achievements for select using (true);

create policy "Server can manage user achievements"
  on public.user_achievements for all using (true);

-- Indexes
create index if not exists idx_user_stats_user on public.user_stats(user_id);
create index if not exists idx_match_history_p1 on public.match_history(player1_id);
create index if not exists idx_match_history_p2 on public.match_history(player2_id);
create index if not exists idx_match_history_time on public.match_history(played_at desc);
create index if not exists idx_user_achievements_user on public.user_achievements(user_id);

-- Updated_at auto-trigger
create or replace function public.update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.update_updated_at();

create trigger user_stats_updated_at before update on public.user_stats
  for each row execute function public.update_updated_at();
