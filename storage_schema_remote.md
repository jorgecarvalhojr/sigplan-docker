# Storage Schema Analysis

## Tables

### storage.buckets

| Column | Type | Nullable |
| --- | --- | --- |
| id | text | NO |
| name | text | NO |
| owner | uuid | YES |
| created_at | timestamp with time zone | YES |
| updated_at | timestamp with time zone | YES |
| public | boolean | YES |
| avif_autodetection | boolean | YES |
| file_size_limit | bigint | YES |
| allowed_mime_types | ARRAY | YES |
| owner_id | text | YES |
| type | USER-DEFINED | NO |

### storage.migrations

| Column | Type | Nullable |
| --- | --- | --- |
| id | integer | NO |
| name | character varying | NO |
| hash | character varying | NO |
| executed_at | timestamp without time zone | YES |

### storage.s3_multipart_uploads_parts

| Column | Type | Nullable |
| --- | --- | --- |
| id | uuid | NO |
| upload_id | text | NO |
| size | bigint | NO |
| part_number | integer | NO |
| bucket_id | text | NO |
| key | text | NO |
| etag | text | NO |
| owner_id | text | YES |
| version | text | NO |
| created_at | timestamp with time zone | NO |

### storage.buckets_vectors

| Column | Type | Nullable |
| --- | --- | --- |
| id | text | NO |
| type | USER-DEFINED | NO |
| created_at | timestamp with time zone | NO |
| updated_at | timestamp with time zone | NO |

### storage.vector_indexes

| Column | Type | Nullable |
| --- | --- | --- |
| id | text | NO |
| name | text | NO |
| bucket_id | text | NO |
| data_type | text | NO |
| dimension | integer | NO |
| distance_metric | text | NO |
| metadata_configuration | jsonb | YES |
| created_at | timestamp with time zone | NO |
| updated_at | timestamp with time zone | NO |

### storage.buckets_analytics

| Column | Type | Nullable |
| --- | --- | --- |
| name | text | NO |
| type | USER-DEFINED | NO |
| format | text | NO |
| created_at | timestamp with time zone | NO |
| updated_at | timestamp with time zone | NO |
| id | uuid | NO |
| deleted_at | timestamp with time zone | YES |

### storage.objects

| Column | Type | Nullable |
| --- | --- | --- |
| id | uuid | NO |
| bucket_id | text | YES |
| name | text | YES |
| owner | uuid | YES |
| created_at | timestamp with time zone | YES |
| updated_at | timestamp with time zone | YES |
| last_accessed_at | timestamp with time zone | YES |
| metadata | jsonb | YES |
| path_tokens | ARRAY | YES |
| version | text | YES |
| owner_id | text | YES |
| user_metadata | jsonb | YES |

### storage.s3_multipart_uploads

| Column | Type | Nullable |
| --- | --- | --- |
| id | text | NO |
| in_progress_size | bigint | NO |
| upload_signature | text | NO |
| bucket_id | text | NO |
| key | text | NO |
| version | text | NO |
| owner_id | text | YES |
| created_at | timestamp with time zone | NO |
| user_metadata | jsonb | YES |
| metadata | jsonb | YES |

## Functions

| Function | Arguments | Result Type |
| --- | --- | --- |
| allow_only_operation | expected_operation text | boolean |
| allow_any_operation | expected_operations text[] | boolean |
| extension | name text | text |
| filename | name text | text |
| foldername | name text | text[] |
| update_updated_at_column |  | trigger |
| can_insert_object | bucketid text, name text, owner uuid, metadata jsonb | void |
| list_multipart_uploads_with_delimiter | bucket_id text, prefix_param text, delimiter_param text, max_keys integer DEFAULT 100, next_key_token text DEFAULT ''::text, next_upload_token text DEFAULT ''::text | TABLE(key text, id text, created_at timestamp with time zone) |
| operation |  | text |
| enforce_bucket_name_length |  | trigger |
| get_common_prefix | p_key text, p_prefix text, p_delimiter text | text |
| list_objects_with_delimiter | _bucket_id text, prefix_param text, delimiter_param text, max_keys integer DEFAULT 100, start_after text DEFAULT ''::text, next_token text DEFAULT ''::text, sort_order text DEFAULT 'asc'::text | TABLE(name text, id uuid, metadata jsonb, updated_at timestamp with time zone, created_at timestamp with time zone, last_accessed_at timestamp with time zone) |
| search_v2 | prefix text, bucket_name text, limits integer DEFAULT 100, levels integer DEFAULT 1, start_after text DEFAULT ''::text, sort_order text DEFAULT 'asc'::text, sort_column text DEFAULT 'name'::text, sort_column_after text DEFAULT ''::text | TABLE(key text, name text, id uuid, updated_at timestamp with time zone, created_at timestamp with time zone, last_accessed_at timestamp with time zone, metadata jsonb) |
| search | prefix text, bucketname text, limits integer DEFAULT 100, levels integer DEFAULT 1, offsets integer DEFAULT 0, search text DEFAULT ''::text, sortcolumn text DEFAULT 'name'::text, sortorder text DEFAULT 'asc'::text | TABLE(name text, id uuid, updated_at timestamp with time zone, created_at timestamp with time zone, last_accessed_at timestamp with time zone, metadata jsonb) |
| search_by_timestamp | p_prefix text, p_bucket_id text, p_limit integer, p_level integer, p_start_after text, p_sort_order text, p_sort_column text, p_sort_column_after text | TABLE(key text, name text, id uuid, updated_at timestamp with time zone, created_at timestamp with time zone, last_accessed_at timestamp with time zone, metadata jsonb) |
| protect_delete |  | trigger |
| get_size_by_bucket |  | TABLE(size bigint, bucket_id text) |
