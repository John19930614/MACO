-- ============================================================================
-- Storage buckets for the Chemical & GHS Intelligence module
-- ============================================================================
--   * sds-documents   private, tenant-scoped  ({tenant_id}/... folder convention)
--                     -> SDS PDFs / scanned safety data sheets
--   * ghs-pictograms  public-read, admin-write
--                     -> the 9 standard GHS symbol images (shared reference data)
--
-- Follows the existing client-documents bucket pattern (tenant folder + RLS on
-- storage.objects). Policy names are globally unique on storage.objects, so they
-- are prefixed per bucket and dropped-if-exists for idempotency.
-- ============================================================================

-- ── Bucket: sds-documents (private, tenant-scoped) ──────────────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'sds-documents', 'sds-documents', false, 52428800,
  array[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'image/png','image/jpeg','image/tiff'
  ]
)
on conflict (id) do nothing;

drop policy if exists "sds_docs_upload"     on storage.objects;
drop policy if exists "sds_docs_read_own"   on storage.objects;
drop policy if exists "sds_docs_update_own" on storage.objects;
drop policy if exists "sds_docs_delete_own" on storage.objects;
drop policy if exists "sds_docs_admin_read" on storage.objects;

-- Upload only into your own tenant's folder.
create policy "sds_docs_upload" on storage.objects for insert to authenticated
  with check (bucket_id = 'sds-documents'
    and (storage.foldername(name))[1] = (select tenant_id::text from public.profiles where id = auth.uid()));

-- Read your own tenant's files.
create policy "sds_docs_read_own" on storage.objects for select to authenticated
  using (bucket_id = 'sds-documents'
    and (storage.foldername(name))[1] = (select tenant_id::text from public.profiles where id = auth.uid()));

-- Update (e.g. replace) only your own tenant's files.
create policy "sds_docs_update_own" on storage.objects for update to authenticated
  using (bucket_id = 'sds-documents'
    and (storage.foldername(name))[1] = (select tenant_id::text from public.profiles where id = auth.uid()))
  with check (bucket_id = 'sds-documents'
    and (storage.foldername(name))[1] = (select tenant_id::text from public.profiles where id = auth.uid()));

-- Delete only your own tenant's files.
create policy "sds_docs_delete_own" on storage.objects for delete to authenticated
  using (bucket_id = 'sds-documents'
    and (storage.foldername(name))[1] = (select tenant_id::text from public.profiles where id = auth.uid()));

-- Reliance admins (tenant_id IS NULL) may read every tenant's SDS files.
create policy "sds_docs_admin_read" on storage.objects for select to authenticated
  using (bucket_id = 'sds-documents'
    and (select tenant_id is null from public.profiles where id = auth.uid()));

-- ── Bucket: ghs-pictograms (public-read, admin-write) ───────────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'ghs-pictograms', 'ghs-pictograms', true, 5242880,
  array['image/png','image/jpeg','image/svg+xml']
)
on conflict (id) do nothing;

drop policy if exists "ghs_pictograms_read"   on storage.objects;
drop policy if exists "ghs_pictograms_insert" on storage.objects;
drop policy if exists "ghs_pictograms_update" on storage.objects;
drop policy if exists "ghs_pictograms_delete" on storage.objects;

-- Anyone may read pictogram images (standard GHS reference symbols).
create policy "ghs_pictograms_read" on storage.objects for select
  using (bucket_id = 'ghs-pictograms');

-- Only Reliance admins may add / replace / remove pictogram images.
create policy "ghs_pictograms_insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'ghs-pictograms' and public.is_reliance_admin());

create policy "ghs_pictograms_update" on storage.objects for update to authenticated
  using (bucket_id = 'ghs-pictograms' and public.is_reliance_admin())
  with check (bucket_id = 'ghs-pictograms' and public.is_reliance_admin());

create policy "ghs_pictograms_delete" on storage.objects for delete to authenticated
  using (bucket_id = 'ghs-pictograms' and public.is_reliance_admin());
