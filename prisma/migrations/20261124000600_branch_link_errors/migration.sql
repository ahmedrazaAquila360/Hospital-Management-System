CREATE OR REPLACE FUNCTION hospital_check_visible_links() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE fk record; value text; visible boolean;
BEGIN
 IF current_user <> 'hospital_branch_runtime' THEN RETURN NEW; END IF;
 IF TG_OP='UPDATE' AND to_jsonb(OLD)->>'branchId' IS DISTINCT FROM to_jsonb(NEW)->>'branchId' THEN
  RAISE EXCEPTION 'Record branch cannot be changed';
 END IF;
 FOR fk IN SELECT c.confrelid::regclass AS target, a.attname AS source_col, b.attname AS target_col
 FROM pg_constraint c JOIN pg_attribute a ON a.attrelid=c.conrelid AND a.attnum=c.conkey[1]
 JOIN pg_attribute b ON b.attrelid=c.confrelid AND b.attnum=c.confkey[1]
 WHERE c.contype='f' AND c.conrelid=TG_RELID AND array_length(c.conkey,1)=1 LOOP
  value := to_jsonb(NEW)->>fk.source_col;
  IF value IS NOT NULL THEN
   EXECUTE format('SELECT EXISTS(SELECT 1 FROM %s WHERE %I::text=$1)',fk.target,fk.target_col) INTO visible USING value;
   IF NOT visible THEN RAISE EXCEPTION USING ERRCODE='23503', MESSAGE='Linked record is unavailable in the active branch'; END IF;
  END IF;
 END LOOP;
 RETURN NEW;
END $$;
GRANT hospital_branch_runtime TO CURRENT_USER;
