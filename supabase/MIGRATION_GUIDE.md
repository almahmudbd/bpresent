# Test Database Migration Guide

## একবার দেখুন কি error দেখাচ্ছে, তারপর এই steps follow করুন:

### Step-by-Step Migration (3 টা file, ক্রমে run করুন)

#### ✅ Step 1: Basic Tables (প্রথমে এটা)
```
📁 supabase/test_migration_step1.sql
```
**এটা run করলে:** polls, slides, options, votes, saved_presentations, admin_users tables তৈরি হবে

---

#### ✅ Step 2: Indexes & Functions (দ্বিতীয়)
```
📁 supabase/test_migration_step2.sql
```
**এটা run করলে:** সব indexes এবং functions তৈরি হবে (grant_admin_access, is_admin, cleanup functions)

---

#### ✅ Step 3: RLS Policies (তৃতীয়)
```
📁 supabase/test_migration_step3.sql
```
**এটা run করলে:** Row Level Security policies তৈরি হবে

---

### সব step complete হলে:

#### Grant admin access:
```sql
-- First sign up with almahmudzh@gmail.com in your test app
-- Then run this:
SELECT grant_admin_access('almahmudzh@gmail.com');
```

#### Verify everything:
```sql
-- Check tables
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;

-- Check functions
SELECT routine_name FROM information_schema.routines 
WHERE routine_schema = 'public';

-- Check admin user (after granting access)
SELECT * FROM admin_users;
```

---

## Common Errors & Solutions:

### Error: "relation already exists"
**Solution:** Table already আছে, এটা ignore করতে পারেন বা DROP করে আবার করুন:
```sql
DROP TABLE IF EXISTS admin_users CASCADE;
-- তারপর step 1 আবার run করুন
```

### Error: "function does not exist"
**Solution:** Step 2 আবার run করুন

### Error: "permission denied"
**Solution:** Supabase dashboard এ SQL Editor থেকে run করছেন তো?

---

## Quick Test:
```sql
-- After all steps, run this:
SELECT 
    'Tables: ' || COUNT(*) as check_tables
FROM information_schema.tables 
WHERE table_schema = 'public';

SELECT 
    'Functions: ' || COUNT(*) as check_functions
FROM information_schema.routines 
WHERE routine_schema = 'public';
```

Expected Result:
- Tables: 6 (polls, slides, options, votes, saved_presentations, admin_users)
- Functions: 4+ (grant_admin_access, is_admin, cleanup_expired_anonymous_polls, complete_poll)
