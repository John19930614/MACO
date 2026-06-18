-- ════════════════════════════════════════════════════════════════════════
-- AMAYA seed for live mode. Inserts site/location reference data and ARC
-- cross-vertical intelligence that does NOT depend on auth.users. Safety Cells
-- are created through the app (created_by must reference a real profile), so
-- this seed deliberately stops at the reference + ARC layer.
--
-- Note: mock mode (NEXT_PUBLIC_AMAYA_MOCK=true) ships a far richer fixture set
-- in src/lib/data/mock.ts — this SQL seed is the live-mode starting point.
-- ════════════════════════════════════════════════════════════════════════

insert into tenants (id, name, slug) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Pacific Terminals Co.', 'pacific'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Summit Construction Group', 'summit')
on conflict (id) do nothing;

insert into sites (id, tenant_id, name, vertical, center) values
  ('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Harbor Point Terminal', 'maritime', array[-122.302, 37.801]),
  ('22222222-2222-2222-2222-222222222222', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Ridgeline Tower 3', 'construction', array[-104.991, 39.742])
on conflict (id) do nothing;

insert into locations (tenant_id, site_id, label, kind, lng, lat, floor, asset) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'Loading Dock A — blind corner', 'point', -122.3014, 37.8019, null, null),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'Ship-to-shore Crane 3', 'asset', -122.3001, 37.8027, null, 'STS-3'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '22222222-2222-2222-2222-222222222222', 'Level 12 — west deck', 'floor_zone', -104.9905, 39.7424, '12', null),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '22222222-2222-2222-2222-222222222222', 'Level 3 — electrical room', 'floor_zone', -104.9913, 39.7427, '3', null)
on conflict do nothing;

insert into vela_insights (pattern, origin_vertical, applies_to, confidence, summary) values
  ('Controls bypassed under production pressure', 'mining', array['construction','maritime','manufacturing','oil-gas'], 0.88,
   'Interlock/guard bypass spikes when crews fall behind schedule. Pre-empt by gating high-tempo windows.'),
  ('Removed-for-work protection not reinstated at shift change', 'construction', array['maritime','utilities','telecom'], 0.79,
   'Edge/guard protection removed for a task is most dangerous at the handoff. A reinstatement sign-off closes the window.'),
  ('Movable segregation degrades to no segregation', 'warehousing', array['maritime','manufacturing','transportation'], 0.74,
   'Cones/tape used for pedestrian-vehicle separation reliably drift open. Treat movable segregation as weak proof by default.')
on conflict do nothing;
