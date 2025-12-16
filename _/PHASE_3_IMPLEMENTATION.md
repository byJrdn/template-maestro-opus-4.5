# Phase 3 Implementation Plan - Cloud Migration with Supabase
**Created:** December 13, 2024  
**Target Completion:** 2 weeks

---

## 🎯 Overview

Transform Template Maestro from a local-only application to a cloud-enabled multi-user system while keeping client validation data secure by never uploading it.

### Architecture Principle
```
┌─────────────────────────────────────────────────────────────┐
│                      USER'S BROWSER                         │
│  ┌─────────────────┐    ┌─────────────────────────────────┐ │
│  │  Client Data    │    │  Template Maestro App           │ │
│  │  (Never leaves  │◄──►│  - Validation Engine            │ │
│  │   browser)      │    │  - Grid UI                      │ │
│  │  ⚠️ LOCAL ONLY  │    │  - Export                       │ │
│  └─────────────────┘    └──────────────┬──────────────────┘ │
└─────────────────────────────────────────┼───────────────────┘
                                          │
                                          ▼ (HTTPS)
┌─────────────────────────────────────────────────────────────┐
│                      SUPABASE CLOUD                          │
│  ┌─────────────────┐    ┌─────────────────────────────────┐ │
│  │  Auth           │    │  Database                       │ │
│  │  - Login        │    │  - Templates                    │ │
│  │  - Users        │    │  - Rules                        │ │
│  │  - Roles        │    │  - Users                        │ │
│  │                 │    │  - Audit Logs                   │ │
│  └─────────────────┘    └─────────────────────────────────┘ │
│                         ✅ Synced across all users          │
└─────────────────────────────────────────────────────────────┘
```

---

## 📊 Database Schema

### Tables

#### 1. `profiles` (extends Supabase auth.users)
| Column | Type | Description |
|--------|------|-------------|
| id | uuid | References auth.users |
| email | text | User email |
| full_name | text | Display name |
| role | enum | 'admin', 'editor', 'viewer' |
| status | enum | 'pending', 'active', 'disabled' |
| created_at | timestamp | When registered |
| approved_by | uuid | Admin who approved |
| approved_at | timestamp | When approved |

#### 2. `templates`
| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| name | text | Template name |
| type | text | 'espp', 'rsu', 'options', etc. |
| description | text | Optional description |
| rules | jsonb | Full rules object |
| export_settings | jsonb | Export configuration |
| created_by | uuid | User who created |
| created_at | timestamp | Creation time |
| updated_by | uuid | Last modifier |
| updated_at | timestamp | Last update |

#### 3. `audit_logs`
| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| user_id | uuid | Who performed action |
| action | text | 'create', 'update', 'delete' |
| entity_type | text | 'template', 'user' |
| entity_id | uuid | What was modified |
| changes | jsonb | Before/after (optional) |
| created_at | timestamp | When it happened |

---

## 🔐 Role Permissions

| Action | Admin | Editor | Viewer |
|--------|-------|--------|--------|
| View templates | ✅ | ✅ | ✅ |
| Use templates (validate data) | ✅ | ✅ | ✅ |
| Create templates | ✅ | ✅ | ❌ |
| Edit templates | ✅ | ✅ | ❌ |
| Delete templates | ✅ | ❌ | ❌ |
| View users | ✅ | ❌ | ❌ |
| Approve users | ✅ | ❌ | ❌ |
| Change user roles | ✅ | ❌ | ❌ |

---

## 📅 Implementation Schedule

### Week 1: Core Authentication & Database

#### Day 1-2: Supabase Setup
- [ ] Create Supabase project
- [ ] Design and create database tables
- [ ] Set up Row Level Security (RLS) policies
- [ ] Configure auth settings

#### Day 3-4: Authentication UI
- [ ] Login page
- [ ] Registration page (with admin approval flow)
- [ ] Password reset flow
- [ ] Session management

#### Day 5-7: Template Cloud Sync
- [ ] Replace localStorage with Supabase queries
- [ ] Template CRUD operations via API
- [ ] Sync templates on login
- [ ] Handle offline/online states gracefully

### Week 2: Admin Features & Polish

#### Day 8-9: Admin Dashboard
- [ ] User management page
- [ ] Pending user approvals
- [ ] Role assignment
- [ ] User enable/disable

#### Day 10-11: Audit & Polish
- [ ] Basic audit logging
- [ ] Loading states and error handling
- [ ] Mobile-responsive auth pages
- [ ] Security review

#### Day 12-14: Testing & Deployment
- [ ] Test all user flows
- [ ] Deploy to production (Vercel/Netlify)
- [ ] Documentation update
- [ ] Team walkthrough

---

## 🗂️ New File Structure

```
template-maestro-opus-4.5/
├── index.html                    # Main app (requires auth)
├── login.html                    # Login page
├── register.html                 # Registration page
├── admin.html                    # Admin dashboard
├── js/
│   ├── supabase-client.js        # Supabase initialization
│   ├── auth.js                   # Authentication logic
│   ├── template-api.js           # Template CRUD via Supabase
│   ├── admin-dashboard.js        # Admin functions
│   └── ... (existing files)
└── css/
    └── auth.css                  # Auth page styles
```

---

## 🚀 First Steps (Do This Now)

### Step 1: Create Supabase Account
1. Go to **https://supabase.com**
2. Click "Start your project" 
3. Sign in with GitHub (or email)
4. Create a new project:
   - **Name:** `template-maestro`
   - **Database Password:** (save this somewhere safe!)
   - **Region:** Choose closest to your team

### Step 2: Get Your Keys
After project is created:
1. Go to **Settings** → **API**
2. Copy these values (you'll give them to me):
   - **Project URL** (looks like `https://xxxxx.supabase.co`)
   - **anon/public key** (safe to use in browser)

### Step 3: Let Me Know!
Once you have the Supabase project created, share:
- Your Project URL
- Your anon key

I'll then set up the database schema and start building the auth system.

---

## ❓ Questions Before Starting

1. **First admin user:** What email should be the first admin? (Probably yours)
2. **App name for login page:** "Template Maestro" or something else?
3. **Require email verification?** Or trust anyone with the registration link?

---

## 🔒 Security Notes

- **Client data never leaves browser** - Only templates/rules sync
- **Row Level Security** - Database enforces permissions
- **HTTPS only** - All traffic encrypted
- **Password hashing** - Handled by Supabase (bcrypt)
- **Session tokens** - Short-lived, secure cookies
