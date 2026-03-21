-- Seed data for development
--
-- Dev admin: admin@suptours.dk / password
-- GoTrue kræver både auth.users OG auth.identities for email/password-login.
-- Kun at indsætte i auth.users (som tidligere) giver "Invalid login credentials".

DO $$
DECLARE
  admin_uid uuid := '00000000-0000-0000-0000-000000000000';
  inst uuid := '00000000-0000-0000-0000-000000000000';
  admin_email text := 'admin@suptours.dk';
  pw text := crypt('password', gen_salt('bf'));
BEGIN
  INSERT INTO auth.users (
    id, instance_id, aud, role, email, encrypted_password,
    email_confirmed_at, confirmation_token, recovery_token,
    email_change_token_new, email_change,
    last_sign_in_at, raw_app_meta_data, raw_user_meta_data,
    is_super_admin, created_at, updated_at,
    phone, phone_confirmed_at, phone_change, phone_change_sent_at,
    email_change_token_current, email_change_confirm_status,
    banned_until, reauthentication_token, reauthentication_sent_at,
    is_sso_user, deleted_at, is_anonymous
  )
  VALUES (
    admin_uid, inst, 'authenticated', 'authenticated', admin_email, pw,
    now(), '', '', '', '',
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"display_name":"Admin User"}'::jsonb,
    false, now(), now(),
    null, null, '', now(),
    '', 0,
    null, '', now(),
    false, null, false
  )
  ON CONFLICT (id) DO UPDATE SET
    encrypted_password = EXCLUDED.encrypted_password,
    email_confirmed_at = EXCLUDED.email_confirmed_at,
    aud = EXCLUDED.aud,
    role = EXCLUDED.role,
    raw_app_meta_data = EXCLUDED.raw_app_meta_data,
    raw_user_meta_data = EXCLUDED.raw_user_meta_data,
    updated_at = now();

  INSERT INTO auth.identities (
    id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at
  )
  VALUES (
    gen_random_uuid(),
    admin_uid,
    jsonb_build_object(
      'sub', admin_uid::text,
      'email', admin_email,
      'email_verified', true,
      'phone_verified', false
    ),
    'email',
    admin_email,
    now(), now(), now()
  )
  ON CONFLICT (provider_id, provider) DO UPDATE SET
    user_id = EXCLUDED.user_id,
    identity_data = EXCLUDED.identity_data,
    updated_at = now();

  UPDATE public.profiles SET is_admin = true WHERE id = admin_uid;
END $$;

-- Insert sample tours (uses the first profile as creator)
-- If no profile exists yet, these will silently fail; re-run after first user signup.

DO $$
DECLARE
  creator uuid;
BEGIN
  SELECT id INTO creator FROM public.profiles LIMIT 1;

  IF creator IS NULL THEN
    RAISE NOTICE 'No profiles found — skipping tour seed data. Sign up a user first.';
    RETURN;
  END IF;

  -- Insert sample tours
  INSERT INTO public.tours (creator_id, source, status, title, description, image_url, start_date, start_time, locality, latitude, longitude, parking_info, max_participants, age_min, age_max, security_notes, responsible_person, contact_info, tags, featured)
  VALUES
    (creator, 'user', 'published',
     'Sunset Paddle at Amager Strand',
     'Join us for a magical sunset paddle along Amager Strand. Perfect for all levels — we''ll glide along the coast as the sun sets over Copenhagen. Bring warm clothes for afterwards!',
     'https://images.unsplash.com/photo-1544551763-46a013bb70d5?auto=format&fit=crop&w=800&q=80',
     CURRENT_DATE + INTERVAL '2 days', '18:00',
     'Amager Strandpark, Copenhagen', 55.6553, 12.6490,
     'Free parking along Amager Strandvej. Metro: Amager Strand station.',
     20, 12, 120,
     'Life jacket required. Calm conditions expected but always check weather forecast. Swimming ability required.',
     'Christian Nielsen', 'christian@suptours.dk',
     ARRAY['social', 'sunset', 'beginner'], true),

    (creator, 'user', 'published',
     'Morning Coffee Canal Tour',
     'Start your Saturday with a peaceful paddle through Christianshavn''s canals. We''ll stop at a floating café for coffee midway. Easy pace, great for beginners.',
     'https://images.unsplash.com/photo-1502680390548-bdbac40a2aa4?auto=format&fit=crop&w=800&q=80',
     CURRENT_DATE + INTERVAL '3 days', '09:00',
     'Christianshavn, Copenhagen', 55.6721, 12.5891,
     'Bike parking at Christianshavn Torv. No car parking nearby.',
     12, 0, 120,
     'Calm canal waters. Life jacket provided. Children under 10 must be accompanied by adult on same board.',
     'Maria Hansen', 'maria@suptours.dk',
     ARRAY['social', 'beginner', 'family'], true),

    (creator, 'web', 'published',
     'Copenhagen Harbor Race 2026',
     'Official SUP race through Copenhagen Harbor! 5km sprint and 10km endurance categories. Registration includes race bib, post-race refreshments, and a finisher medal.',
     'https://images.unsplash.com/photo-1526188717906-ab4a2f949f78?auto=format&fit=crop&w=800&q=80',
     CURRENT_DATE + INTERVAL '7 days', '10:00',
     'Islands Brygge, Copenhagen', 55.6636, 12.5731,
     'Public parking at Fisketorvet. Bike racks at Islands Brygge.',
     100, 16, 120,
     'PFD mandatory. Race briefing at 09:30. Emergency boat support on course. Medical team on site.',
     'Copenhagen SUP Club', 'race@cphsup.dk',
     ARRAY['race', 'expert', 'adventure'], true),

    (creator, 'user', 'published',
     'SUP Yoga at Køge Bugt',
     'Find your balance — literally! SUP yoga session on the calm morning waters of Køge Bay. Suitable for both yoga beginners and SUP beginners. Mats provided.',
     NULL,
     CURRENT_DATE + INTERVAL '5 days', '07:30',
     'Køge Bugt Strandpark', 55.5872, 12.4653,
     'Large free parking lot at the beach. Bus 300S from Copenhagen.',
     15, 16, 80,
     'Must be able to swim 200m. Calm conditions only — session cancelled if wind > 5 m/s. Instructor certified in water rescue.',
     'Line Andersen', 'line@supyoga.dk',
     ARRAY['yoga', 'beginner', 'nature'], false),

    (creator, 'user', 'published',
     'Family Adventure: Roskilde Fjord',
     'A gentle family paddle exploring Roskilde Fjord. We paddle past the Viking Ship Museum and along the beautiful coastline. Kids sit with parents. Rental boards available.',
     NULL,
     CURRENT_DATE + INTERVAL '10 days', '11:00',
     'Roskilde Havn, Roskilde', 55.6428, 12.0756,
     'Parking at Roskilde Harbor. Train: 25 min from Copenhagen Central.',
     25, 0, 120,
     'All children under 12 must ride with an adult. Life jackets for all sizes provided. Maximum wind speed for departure: 6 m/s.',
     'Peter Jensen', 'peter@suptours.dk',
     ARRAY['family', 'adventure', 'beginner', 'nature'], false),

    (creator, 'user', 'published',
     'Night Paddle with LED Lights',
     'An unforgettable experience — paddle through the harbor at night with LED-lit boards! Copenhagen looks completely different from the water at night.',
     NULL,
     CURRENT_DATE + INTERVAL '14 days', '21:00',
     'Nyhavn, Copenhagen', 55.6798, 12.5916,
     'No parking at Nyhavn. Use Kongens Nytorv car park. Metro: Kongens Nytorv.',
     16, 18, 120,
     'Must be confident paddler (not for beginners). Reflective vest provided. Emergency whistle included. Navigation lights on all boards.',
     'Christian Nielsen', 'christian@suptours.dk',
     ARRAY['adventure', 'social', 'expert', 'city'], false),

    (creator, 'web', 'published',
     'Helsingør Coastal Challenge',
     'Official coastal paddle from Helsingør to Humlebæk — 12km along the stunning North Zealand coast. Support boats follow the group. Intermediate+ level required.',
     NULL,
     CURRENT_DATE + INTERVAL '21 days', '09:00',
     'Helsingør Havn, Helsingør', 56.0360, 12.6136,
     'Parking at Helsingør Station. Train from Copenhagen: 45 min.',
     50, 18, 120,
     'Minimum 5km paddle experience required. PFD mandatory. Support boats on course. Weather-dependent — check website 24h before.',
     'North Zealand SUP', 'info@nzsup.dk',
     ARRAY['race', 'adventure', 'expert', 'waves'], false),

    (creator, 'user', 'published',
     'Beginners Welcome: Svanemøllen',
     'Never tried SUP? This is your chance! Free introductory session at Svanemøllen Beach. Boards and equipment provided. Learn the basics in a safe, shallow area.',
     NULL,
     CURRENT_DATE + INTERVAL '4 days', '14:00',
     'Svanemøllen Strand, Copenhagen', 55.7136, 12.5782,
     'Free parking along Strandpromenaden. S-train: Svanemøllen station.',
     30, 8, 120,
     'Shallow water area. Instructors present. Life jackets for everyone. Children under 12 must be accompanied.',
     'SUP Danmark', 'hello@supdanmark.dk',
     ARRAY['beginner', 'social', 'family'], true);

  -- Insert sample blog post
  INSERT INTO public.blog_posts (title, slug, content_md, author_id, is_draft)
  VALUES
    ('Welcome to SUP Tours!', 'welcome-to-sup-tours',
     '# Welcome to SUP Tours!

We are thrilled to launch **SUP Tours** — your community platform for discovering, planning, and joining Stand Up Paddle adventures across Denmark and beyond.

## What is SUP Tours?

SUP Tours connects paddlers of all levels. Whether you''re a first-timer looking for a gentle introduction or an experienced racer seeking coastal challenges, there''s a tour for you.

## How It Works

1. **Browse Tours** — Check out our timeline of upcoming paddle events
2. **Join** — Found one you like? Hit that Join button!
3. **Create** — Got a favorite spot? Create your own tour and invite the community

## Safety First

Every tour on SUP Tours includes safety information, responsible contact persons, and participant limits. We take water safety seriously.

Happy paddling! 🏄‍♂️',
     creator, false);

  RAISE NOTICE 'Seed data inserted for creator: %', creator;

END $$;
