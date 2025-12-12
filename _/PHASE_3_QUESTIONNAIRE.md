# Phase 3 Planning Questionnaire
## Template Maestro - Multi-User Cloud Platform

**Instructions:** Fill in your answers below each question. If unsure, write "Recommend" and I'll provide a suggestion.

---

## 🔐 1. Authentication & Identity

### a) Existing Infrastructure
**Does insightsoftware have an existing identity provider (Azure AD, Okta, Auth0, etc.) that this should integrate with?**

> Your answer: 


**Is there a required SSO/SAML integration for enterprise clients, or can we start with email/password?**

> Your answer: 


### b) Authentication Scope
**Should users self-register, or will an admin create all user accounts?**

> Your answer: 


**Is multi-factor authentication (MFA) a requirement from day one, or a future enhancement?**

> Your answer: 


### c) User Roles
**What roles do you need? Check all that apply:**

- [ ] Admin – Can manage all templates, users, and settings
- [ ] Editor – Can create/modify templates  
- [ ] Viewer – Can only use templates to validate data
- [ ] Other (describe): 

**Or simpler approach:**
- [ ] Just "admin" vs "regular user" for now

> Additional notes on roles: 


---

## ☁️ 2. Backend Technology

### a) Build vs Buy
**Which approach do you prefer?**

- [ ] **Backend-as-a-Service** (Supabase, Firebase, AWS Amplify)
  - Faster to build, built-in auth, real-time sync, managed infrastructure
  - Less control, potential vendor lock-in, costs scale with usage

- [ ] **Custom Backend Server** (Node.js/Express, .NET, Python/FastAPI)
  - Full control, can integrate with existing systems
  - More development time, need to handle hosting/scaling

- [ ] **Integrate with existing insightsoftware infrastructure**
  - Describe what exists: 

- [ ] **Recommend** – Let me suggest based on your other requirements

> Additional notes: 


### b) If Backend-as-a-Service
**Preference between:**

- [ ] **Supabase** – PostgreSQL-based, open-source, good for SQL-familiar teams
- [ ] **Firebase** – Google, NoSQL (Firestore), excellent real-time features
- [ ] **AWS Amplify** – AWS ecosystem, good if already using AWS
- [ ] **No preference / Recommend**

> Additional notes: 


### c) Database Requirements
**Data residency requirements?**

- [ ] Data must stay in US
- [ ] Data must stay in EU  
- [ ] Data must stay in specific region: ____________
- [ ] No specific requirements

> Additional notes: 


---

## 🏢 3. Organization & Team Structure

### a) Multi-Tenancy Model
**Who will use this system?**

- [ ] Single organization (insightsoftware internal tool)
- [ ] Multiple client companies (each needs isolated data)
- [ ] Both (insightsoftware uses it AND provides to clients)

> Additional notes: 


### b) Team Structure
**How should template sharing work?**

- [ ] Users belong to teams/departments that automatically share templates
- [ ] Ad-hoc sharing (share with specific email addresses)
- [ ] Both options available
- [ ] Start simple (ad-hoc), add teams later

> Additional notes: 


---

## 🔒 4. Security & Compliance

### a) Compliance Requirements
**Check all that apply:**

- [ ] SOC 2
- [ ] HIPAA
- [ ] GDPR
- [ ] Other: ____________
- [ ] None specifically required
- [ ] Not sure – need to check with IT/Legal

> Additional notes: 


### b) Audit Requirements
**How detailed should audit logs be?**

- [ ] Basic: User X created/modified template at timestamp
- [ ] Detailed: Track every field change with before/after values
- [ ] Minimal: Just login/logout tracking for now

> Additional notes: 


---

## 📦 5. Deployment & Operations

### a) Hosting
**Where should this be deployed?**

- [ ] AWS
- [ ] Azure
- [ ] Google Cloud (GCP)
- [ ] On-premise data center
- [ ] Wherever makes sense / Recommend

> Additional notes: 


### b) Environments
**Do you need multiple environments?**

- [ ] Just production for now
- [ ] Development + Production
- [ ] Development + Staging + Production

> Additional notes: 


### c) CI/CD
**Any existing deployment pipelines to integrate with?**

> Your answer: 


---

## 🔄 6. Migration Strategy

### a) Existing Local Templates
**When cloud storage launches, what happens to templates stored in browser localStorage?**

- [ ] Auto-migrate to cloud on first login
- [ ] Show a "migrate" prompt and let users choose
- [ ] Keep them separate (local stays local, cloud is new)
- [ ] Recommend

> Additional notes: 


---

## 📊 7. Phase 3 MVP Scope

**Rate each feature: Must-Have (M), Nice-to-Have (N), or Later (L)**

| Feature | Priority (M/N/L) |
|---------|-----------------|
| Email/password login | |
| SSO/SAML integration | |
| Cloud template storage (save/load) | |
| Share template with specific user email | |
| Team/organization-based sharing | |
| Role-based permissions (admin/editor/viewer) | |
| Audit logging (who did what) | |
| Multi-factor authentication | |
| Template version history | |
| Template approval workflows | |

> Additional features needed: 


---

## ⏰ 8. Timeline & Resources

### a) Target Timeline
**When do you need Phase 3 completed?**

- [ ] ASAP (within 2 weeks)
- [ ] Within 1 month
- [ ] Within 3 months
- [ ] No specific deadline

> Additional notes: 


### b) Budget Considerations
**Any budget constraints that affect technology choices?**

- [ ] Should be free/minimal cost (open-source preferred)
- [ ] Reasonable monthly costs OK ($50-200/month)
- [ ] Enterprise budget available
- [ ] Need to discuss with management first

> Additional notes: 


### c) Development Approach
**Preference for initial release?**

- [ ] Proof-of-concept first (test internally before polish)
- [ ] Production-ready from the start
- [ ] MVP first, then iterate based on feedback

> Additional notes: 


---

## 📝 9. Additional Notes

**Anything else I should know about your requirements, constraints, or vision for Phase 3?**

> Your notes: 


---

## ✅ Checklist Before Submission

Before returning this questionnaire, please confirm:

- [ ] I've answered all questions or marked "Recommend" where unsure
- [ ] I've checked with IT/Legal on compliance requirements if needed
- [ ] I've confirmed hosting/deployment preferences with relevant stakeholders

---

*Return this completed file and I'll create a detailed implementation plan for Phase 3.*
