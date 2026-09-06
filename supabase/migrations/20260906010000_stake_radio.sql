-- Public stake radio calendar and information, editable only by specialists.
-- Schedules and initial copy supplied by Allen Carter's August 23, 2026 email.
create table public.radio_events (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(trim(title)) between 1 and 160),
  description text not null default '' check (char_length(description) <= 4000),
  start_date date not null,
  start_time time not null,
  end_time time check (end_time is null or end_time > start_time),
  recurrence text not null default 'once' check (recurrence in ('once', 'weekly', 'monthly')),
  weekday integer check (weekday between 0 and 6),
  month_weeks integer[] not null default '{}',
  repeat_until date check (repeat_until is null or repeat_until >= start_date),
  skipped_dates date[] not null default '{}',
  location text not null default '' check (char_length(location) <= 300),
  frequency text not null default '' check (char_length(frequency) <= 200),
  status text not null default 'scheduled' check (status in ('scheduled', 'tentative', 'cancelled')),
  updated_at timestamptz not null default now(),
  check (recurrence = 'once' or weekday is not null),
  check (recurrence <> 'monthly' or (cardinality(month_weeks) > 0 and month_weeks <@ array[1,2,3,4,5]))
);

create table public.radio_information (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(trim(title)) between 1 and 160),
  body text not null check (char_length(trim(body)) between 1 and 6000),
  link_url text not null default '' check (link_url = '' or link_url ~* '^(https?://|mailto:)'),
  link_label text not null default '' check (char_length(link_label) <= 120),
  sort_order integer not null default 0,
  updated_at timestamptz not null default now()
);

alter table public.radio_events enable row level security;
alter table public.radio_information enable row level security;
grant select on public.radio_events, public.radio_information to anon, authenticated;
grant insert, update, delete on public.radio_events, public.radio_information to authenticated;

create policy "Radio events are public" on public.radio_events for select to anon, authenticated using (true);
create policy "Specialists manage radio events" on public.radio_events for all to authenticated
using (public.is_admin()) with check (public.is_admin());
create policy "Radio information is public" on public.radio_information for select to anon, authenticated using (true);
create policy "Specialists manage radio information" on public.radio_information for all to authenticated
using (public.is_admin()) with check (public.is_admin());

create trigger radio_events_touch_updated_at before update on public.radio_events
for each row execute function public.touch_updated_at();
create trigger radio_information_touch_updated_at before update on public.radio_information
for each row execute function public.touch_updated_at();

insert into public.radio_events (title, description, start_date, start_time, end_time, recurrence, weekday, month_weeks, location, frequency, status) values
('Spanish Fork Stake Amateur Radio Net', 'Join fellow stake amateur radio operators for an equipment check and a check-in. Even five minutes on the radio is welcome! Schedule supplied by Allen Carter on August 23, 2026.', '2026-08-23', '19:30', null, 'monthly', 0, '{2,4}', 'On the radio', '146.640 MHz · simplex', 'scheduled'),
('Stake radio meet & greet', 'All amateur radio operators within the Spanish Fork Stake boundaries are invited. Casual dress. Announced by Allen Carter on August 23, 2026.', '2026-08-23', '15:45', null, 'once', null, '{}', 'Benson Building · 275 South 1400 East', '', 'scheduled'),
('Stake Emergency Drill', 'Proposed date and time from Allen Carter’s August 23, 2026 email. Final details and location are awaiting confirmation.', '2026-09-24', '18:00', '20:30', 'once', null, '{}', 'To be announced', '', 'tentative'),
('UARC Information Net', 'Utah Amateur Radio Club information net. Listed in Allen Carter’s August 23, 2026 email. Club information: https://user.xmission.com/~uarc/', '2026-08-23', '20:30', null, 'weekly', 0, '{}', 'On the radio', '146.620 MHz', 'scheduled'),
('Mapleton West Stake Net · simplex', 'First Sunday of each month. Net controller: Steve (KF7VMD). Schedule supplied by Allen Carter on August 23, 2026.', '2026-08-23', '20:30', null, 'monthly', 0, '{1}', 'On the radio', '146.500 MHz · simplex', 'scheduled'),
('Mapleton West Stake Net · repeater', 'All Sundays except the first Sunday of the month. Net controller: Steve (KF7VMD). Schedule supplied by Allen Carter on August 23, 2026.', '2026-08-23', '20:30', null, 'monthly', 0, '{2,3,4,5}', 'On the radio', '146.800 MHz · −600 kHz offset · tone 100 Hz', 'scheduled'),
('UVARC Ladies Net', 'Ladies-only net hosted by the Utah Valley Amateur Radio Club. Schedule supplied by Allen Carter on August 23, 2026. Club information: https://uvarc.club/', '2026-08-23', '19:00', null, 'weekly', 2, '{}', 'On the radio', '146.780 MHz · tone 100 Hz', 'scheduled');

insert into public.radio_information (title, body, link_url, link_label, sort_order) values
('Join the stake radio net', E'Spanish Fork Stake amateur radio operators meet over the radio every second and fourth Sunday at 7:30 PM on 146.640 MHz, simplex. A short check-in is a useful way to test your equipment and stay connected. Even five minutes is welcome.\n\nInitial information and calendar schedules are from Allen Carter’s August 23, 2026 email. All calendar times are Mountain Time.', '', '', 10),
('Stake communications contact', E'Allen Carter is the stake communications specialist. Contact Allen with questions about the stake net or to express interest in volunteering at radio events.\n\nallencarter1@gmail.com', 'mailto:allencarter1@gmail.com', 'Email Allen Carter', 20),
('Volunteer with UCARES', 'Allen shared opportunities for HAM radio operators to volunteer at events throughout Utah through clubs such as the Utah County Amateur Radio Emergency Service (UCARES). Let Allen know if you are interested.', 'https://www.ucares.org/', 'Visit UCARES', 30),
('UCARES events', 'Find public-service events and volunteering opportunities with the Utah County Amateur Radio Emergency Service.', 'https://www.ucares.org/docs/details/events/', 'Browse UCARES events', 40),
('Utah Amateur Radio Club', 'UARC’s Sunday Information Net is listed in the calendar at 8:30 PM on 146.620 MHz. Visit the club for more information.', 'https://user.xmission.com/~uarc/', 'Visit UARC', 50),
('Utah Valley Amateur Radio Club', 'UVARC hosts the Tuesday Ladies Net at 7:00 PM on 146.780 MHz, tone 100 Hz. Visit the club for activities and information.', 'https://uvarc.club/', 'Visit UVARC', 60),
('More nets to listen to', 'Allen shared this directory of additional amateur radio nets. Some nets also welcome check-ins; consult the host’s participation details.', 'https://user.xmission.com/~uarc/netsched.html', 'View the UARC net schedule', 70),
('Amateur radio testing', 'Use HamStudy to find amateur radio study tools and testing information.', 'https://hamstudy.org/', 'Open HamStudy', 80),
('Fire information: Watch Duty', 'Allen recommended the Watch Duty phone app for fire information.', 'https://www.watchduty.org/', 'Get Watch Duty', 90),
('From the August email: Springville job notice', 'On August 23, 2026, Allen shared a Springville City Emergency Management Coordinator opening under Public Safety, with office space at the police department. The notice said “open until filled.” Current availability has not been verified; check the original posting for its status.', 'https://springville.casellehire.com/jobs/317467', 'Check the original job posting', 100);
