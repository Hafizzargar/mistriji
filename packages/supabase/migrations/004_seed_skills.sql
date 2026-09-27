-- ============================================================
-- MistriJi — 004_seed_skills.sql
-- Seed the 10 launch service categories
-- ============================================================

INSERT INTO public.skills (name, name_hi, icon, category, sort_order) VALUES
  ('Electrician',     'बिजली मिस्त्री',   '⚡',  'electrical',    1),
  ('Plumber',         'प्लम्बर',           '🔧',  'plumbing',      2),
  ('AC Technician',   'AC टेक्नीशियन',    '❄️',  'appliance',     3),
  ('Mason',           'राजमिस्त्री',       '🧱',  'construction',  4),
  ('Carpenter',       'बढ़ई',             '🪚',  'construction',  5),
  ('Painter',         'पेंटर',            '🖌️',  'interior',      6),
  ('Helper',          'हेल्पर',           '👷',  'general',       7),
  ('Welder',          'वेल्डर',           '🔥',  'construction',  8),
  ('Pest Control',    'कीट नियंत्रण',     '🐛',  'cleaning',      9),
  ('House Cleaning',  'घर सफाई',          '🧹',  'cleaning',     10);
