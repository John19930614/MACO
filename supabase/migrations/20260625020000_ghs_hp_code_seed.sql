-- ============================================================================
-- GHS H-code and P-code reference data seed
-- ============================================================================
-- Populates public.ghs_hazard_statements and public.ghs_precautionary_statements
-- with the standard GHS (OSHA HazCom-aligned) statement set so that
-- approved_chemical_label_view renders real H/P text on labels.
--
-- Idempotent: re-runnable via ON CONFLICT on the unique code columns.
-- Statements use the standard GHS "..." placeholders where the authoring
-- party must supply specifics (extinguishing media, storage conditions, etc.).
-- ============================================================================

-- ── HAZARD STATEMENTS: Physical hazards (H2xx) ──────────────────────────────
insert into public.ghs_hazard_statements (h_code, statement, hazard_type) values
  ('H200','Unstable explosives','physical'),
  ('H201','Explosive; mass explosion hazard','physical'),
  ('H202','Explosive; severe projection hazard','physical'),
  ('H203','Explosive; fire, blast or projection hazard','physical'),
  ('H204','Fire or projection hazard','physical'),
  ('H205','May mass explode in fire','physical'),
  ('H206','Fire, blast or projection hazard; increased risk of explosion if desensitizing agent is reduced','physical'),
  ('H207','Fire or projection hazard; increased risk of explosion if desensitizing agent is reduced','physical'),
  ('H208','Fire hazard; increased risk of explosion if desensitizing agent is reduced','physical'),
  ('H209','Explosive','physical'),
  ('H210','Very sensitive','physical'),
  ('H211','May be sensitive','physical'),
  ('H220','Extremely flammable gas','physical'),
  ('H221','Flammable gas','physical'),
  ('H222','Extremely flammable aerosol','physical'),
  ('H223','Flammable aerosol','physical'),
  ('H224','Extremely flammable liquid and vapour','physical'),
  ('H225','Highly flammable liquid and vapour','physical'),
  ('H226','Flammable liquid and vapour','physical'),
  ('H227','Combustible liquid','physical'),
  ('H228','Flammable solid','physical'),
  ('H229','Pressurized container: may burst if heated','physical'),
  ('H230','May react explosively even in the absence of air','physical'),
  ('H231','May react explosively even in the absence of air at elevated pressure and/or temperature','physical'),
  ('H232','May ignite spontaneously if exposed to air','physical'),
  ('H240','Heating may cause an explosion','physical'),
  ('H241','Heating may cause a fire or explosion','physical'),
  ('H242','Heating may cause a fire','physical'),
  ('H250','Catches fire spontaneously if exposed to air','physical'),
  ('H251','Self-heating; may catch fire','physical'),
  ('H252','Self-heating in large quantities; may catch fire','physical'),
  ('H260','In contact with water releases flammable gases which may ignite spontaneously','physical'),
  ('H261','In contact with water releases flammable gas','physical'),
  ('H270','May cause or intensify fire; oxidizer','physical'),
  ('H271','May cause fire or explosion; strong oxidizer','physical'),
  ('H272','May intensify fire; oxidizer','physical'),
  ('H280','Contains gas under pressure; may explode if heated','physical'),
  ('H281','Contains refrigerated gas; may cause cryogenic burns or injury','physical'),
  ('H290','May be corrosive to metals','physical')
on conflict (h_code) do nothing;

-- ── HAZARD STATEMENTS: Health hazards (H3xx) ────────────────────────────────
insert into public.ghs_hazard_statements (h_code, statement, hazard_type) values
  ('H300','Fatal if swallowed','health'),
  ('H301','Toxic if swallowed','health'),
  ('H302','Harmful if swallowed','health'),
  ('H304','May be fatal if swallowed and enters airways','health'),
  ('H310','Fatal in contact with skin','health'),
  ('H311','Toxic in contact with skin','health'),
  ('H312','Harmful in contact with skin','health'),
  ('H314','Causes severe skin burns and eye damage','health'),
  ('H315','Causes skin irritation','health'),
  ('H317','May cause an allergic skin reaction','health'),
  ('H318','Causes serious eye damage','health'),
  ('H319','Causes serious eye irritation','health'),
  ('H330','Fatal if inhaled','health'),
  ('H331','Toxic if inhaled','health'),
  ('H332','Harmful if inhaled','health'),
  ('H334','May cause allergy or asthma symptoms or breathing difficulties if inhaled','health'),
  ('H335','May cause respiratory irritation','health'),
  ('H336','May cause drowsiness or dizziness','health'),
  ('H340','May cause genetic defects','health'),
  ('H341','Suspected of causing genetic defects','health'),
  ('H350','May cause cancer','health'),
  ('H351','Suspected of causing cancer','health'),
  ('H360','May damage fertility or the unborn child','health'),
  ('H361','Suspected of damaging fertility or the unborn child','health'),
  ('H362','May cause harm to breast-fed children','health'),
  ('H370','Causes damage to organs','health'),
  ('H371','May cause damage to organs','health'),
  ('H372','Causes damage to organs through prolonged or repeated exposure','health'),
  ('H373','May cause damage to organs through prolonged or repeated exposure','health')
on conflict (h_code) do nothing;

-- ── HAZARD STATEMENTS: Environmental hazards (H4xx) ─────────────────────────
insert into public.ghs_hazard_statements (h_code, statement, hazard_type) values
  ('H400','Very toxic to aquatic life','environmental'),
  ('H401','Toxic to aquatic life','environmental'),
  ('H402','Harmful to aquatic life','environmental'),
  ('H410','Very toxic to aquatic life with long lasting effects','environmental'),
  ('H411','Toxic to aquatic life with long lasting effects','environmental'),
  ('H412','Harmful to aquatic life with long lasting effects','environmental'),
  ('H413','May cause long lasting harmful effects to aquatic life','environmental'),
  ('H420','Harms public health and the environment by destroying ozone in the upper atmosphere','environmental')
on conflict (h_code) do nothing;

-- ── PRECAUTIONARY STATEMENTS: General (P1xx) ────────────────────────────────
insert into public.ghs_precautionary_statements (p_code, statement, category) values
  ('P101','If medical advice is needed, have product container or label at hand.','general'),
  ('P102','Keep out of reach of children.','general'),
  ('P103','Read label before use.','general')
on conflict (p_code) do nothing;

-- ── PRECAUTIONARY STATEMENTS: Prevention (P2xx) ─────────────────────────────
insert into public.ghs_precautionary_statements (p_code, statement, category) values
  ('P201','Obtain special instructions before use.','prevention'),
  ('P202','Do not handle until all safety precautions have been read and understood.','prevention'),
  ('P210','Keep away from heat, hot surfaces, sparks, open flames and other ignition sources. No smoking.','prevention'),
  ('P211','Do not spray on an open flame or other ignition source.','prevention'),
  ('P212','Avoid heating under confinement or reduction of the desensitizing agent.','prevention'),
  ('P220','Keep away from clothing and other combustible materials.','prevention'),
  ('P221','Take any precaution to avoid mixing with combustibles.','prevention'),
  ('P222','Do not allow contact with air.','prevention'),
  ('P223','Do not allow contact with water.','prevention'),
  ('P230','Keep wetted with ...','prevention'),
  ('P231','Handle and store contents under inert gas/...','prevention'),
  ('P232','Protect from moisture.','prevention'),
  ('P233','Keep container tightly closed.','prevention'),
  ('P234','Keep only in original packaging.','prevention'),
  ('P235','Keep cool.','prevention'),
  ('P240','Ground and bond container and receiving equipment.','prevention'),
  ('P241','Use explosion-proof electrical/ventilating/lighting equipment.','prevention'),
  ('P242','Use non-sparking tools.','prevention'),
  ('P243','Take action to prevent static discharges.','prevention'),
  ('P244','Keep valves and fittings free from oil and grease.','prevention'),
  ('P250','Do not subject to grinding/shock/friction.','prevention'),
  ('P251','Do not pierce or burn, even after use.','prevention'),
  ('P260','Do not breathe dust/fume/gas/mist/vapours/spray.','prevention'),
  ('P261','Avoid breathing dust/fume/gas/mist/vapours/spray.','prevention'),
  ('P262','Do not get in eyes, on skin, or on clothing.','prevention'),
  ('P263','Avoid contact during pregnancy and while nursing.','prevention'),
  ('P264','Wash ... thoroughly after handling.','prevention'),
  ('P270','Do not eat, drink or smoke when using this product.','prevention'),
  ('P271','Use only outdoors or in a well-ventilated area.','prevention'),
  ('P272','Contaminated work clothing should not be allowed out of the workplace.','prevention'),
  ('P273','Avoid release to the environment.','prevention'),
  ('P280','Wear protective gloves/protective clothing/eye protection/face protection.','prevention'),
  ('P282','Wear cold insulating gloves and either face shield or eye protection.','prevention'),
  ('P283','Wear fire resistant or flame retardant clothing.','prevention'),
  ('P284','In case of inadequate ventilation wear respiratory protection.','prevention')
on conflict (p_code) do nothing;

-- ── PRECAUTIONARY STATEMENTS: Response (P3xx) ───────────────────────────────
insert into public.ghs_precautionary_statements (p_code, statement, category) values
  ('P301','IF SWALLOWED:','response'),
  ('P302','IF ON SKIN:','response'),
  ('P303','IF ON SKIN (or hair):','response'),
  ('P304','IF INHALED:','response'),
  ('P305','IF IN EYES:','response'),
  ('P306','IF ON CLOTHING:','response'),
  ('P308','IF exposed or concerned:','response'),
  ('P310','Immediately call a POISON CENTER/doctor.','response'),
  ('P311','Call a POISON CENTER/doctor.','response'),
  ('P312','Call a POISON CENTER/doctor if you feel unwell.','response'),
  ('P313','Get medical advice/attention.','response'),
  ('P314','Get medical advice/attention if you feel unwell.','response'),
  ('P315','Get immediate medical advice/attention.','response'),
  ('P320','Specific treatment is urgent (see ... on this label).','response'),
  ('P321','Specific treatment (see ... on this label).','response'),
  ('P330','Rinse mouth.','response'),
  ('P331','Do NOT induce vomiting.','response'),
  ('P332','If skin irritation occurs:','response'),
  ('P333','If skin irritation or rash occurs:','response'),
  ('P334','Immerse in cool water or wrap in wet bandages.','response'),
  ('P335','Brush off loose particles from skin.','response'),
  ('P336','Thaw frosted parts with lukewarm water. Do not rub affected area.','response'),
  ('P337','If eye irritation persists:','response'),
  ('P338','Remove contact lenses, if present and easy to do. Continue rinsing.','response'),
  ('P340','Remove person to fresh air and keep comfortable for breathing.','response'),
  ('P342','If experiencing respiratory symptoms:','response'),
  ('P351','Rinse cautiously with water for several minutes.','response'),
  ('P352','Wash with plenty of water.','response'),
  ('P353','Rinse skin with water or shower.','response'),
  ('P360','Rinse immediately contaminated clothing and skin with plenty of water before removing clothes.','response'),
  ('P361','Take off immediately all contaminated clothing.','response'),
  ('P362','Take off contaminated clothing.','response'),
  ('P363','Wash contaminated clothing before reuse.','response'),
  ('P364','And wash it before reuse.','response'),
  ('P370','In case of fire:','response'),
  ('P371','In case of major fire and large quantities:','response'),
  ('P372','Explosion risk in case of fire.','response'),
  ('P373','DO NOT fight fire when fire reaches explosives.','response'),
  ('P375','Fight fire remotely due to the risk of explosion.','response'),
  ('P376','Stop leak if safe to do so.','response'),
  ('P377','Leaking gas fire: Do not extinguish, unless leak can be stopped safely.','response'),
  ('P378','Use ... to extinguish.','response'),
  ('P380','Evacuate area.','response'),
  ('P381','In case of leakage, eliminate all ignition sources.','response'),
  ('P390','Absorb spillage to prevent material damage.','response'),
  ('P391','Collect spillage.','response')
on conflict (p_code) do nothing;

-- ── PRECAUTIONARY STATEMENTS: Storage (P4xx) ────────────────────────────────
insert into public.ghs_precautionary_statements (p_code, statement, category) values
  ('P401','Store in accordance with ...','storage'),
  ('P402','Store in a dry place.','storage'),
  ('P403','Store in a well-ventilated place.','storage'),
  ('P404','Store in a closed container.','storage'),
  ('P405','Store locked up.','storage'),
  ('P406','Store in a corrosive resistant container with a resistant inner liner.','storage'),
  ('P407','Maintain air gap between stacks or pallets.','storage'),
  ('P410','Protect from sunlight.','storage'),
  ('P411','Store at temperatures not exceeding ... degrees.','storage'),
  ('P412','Do not expose to temperatures exceeding 50 C/122 F.','storage'),
  ('P413','Store bulk masses greater than ... at temperatures not exceeding ... degrees.','storage'),
  ('P420','Store separately.','storage')
on conflict (p_code) do nothing;

-- ── PRECAUTIONARY STATEMENTS: Disposal (P5xx) ───────────────────────────────
insert into public.ghs_precautionary_statements (p_code, statement, category) values
  ('P501','Dispose of contents/container in accordance with local/regional/national/international regulations.','disposal'),
  ('P502','Refer to manufacturer/supplier for information on recovery/recycling.','disposal'),
  ('P503','Refer to manufacturer/supplier for information on disposal/recovery/recycling.','disposal')
on conflict (p_code) do nothing;
