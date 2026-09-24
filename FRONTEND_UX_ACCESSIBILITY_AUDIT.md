# LeadsDom — Frontend, UX & Accessibility Audit

**Date:** 2026-09-24  
**Repository:** D:\Fine Leads  
**Auditor:** Kilo (Automated Deep Audit)  
**Scope:** Frontend, UX, Accessibility (WCAG 2.1), Component Structure, Forms, Styling, shadcn/ui Usage

---

## Executive Summary

The LeadsDom frontend demonstrates **strong visual design** and a **modern React/Next.js 15 architecture**, but has **significant accessibility gaps**, **inconsistent form patterns**, and **UX inconsistencies** that impact usability and compliance. The codebase uses shadcn/ui primitives extensively, yet many custom components bypass the design system with inline styles and hardcoded values.

**Key Strengths:**
- Modern Next.js 15 App Router with Server Components
- Consistent use of Radix UI primitives via shadcn/ui
- Good loading skeleton coverage in data-heavy pages
- Dark mode support in most components
- Proper use of `cn()` utility for Tailwind class merging

**Critical Blockers:**
- **Missing `<main>` landmark** on multiple dashboard pages
- **Form labels missing** in auth-page.tsx login form (placeholders only)
- **No focus management** in custom modals
- **No skip navigation** link
- **Color contrast issues** in several text/background combinations

---

## 1. Component Structure

### 1.1 Component Organization

| Finding | Severity | Details |
|---------|----------|---------|
| Duplicate form logic | 🟡 Medium | `login-form.tsx` and `auth-page.tsx` both implement login with different patterns |
| Inline type definitions | 🟡 Medium | Repeated `interface AgentData` in `agent-detail-modal.tsx:20-49` and `lead-detail-modal.tsx:26-49` |
| No shared form field components | 🟡 Medium | Each form manually renders `<label>` + `<input>` instead of a shared `FormField` component |
| Magic numbers for colors | 🟡 Medium | `#465FFF`, `#14A800`, `#3B50E0` repeated 50+ times instead of CSS variables |
| Inconsistent className patterns | 🟡 Medium | Some use `cn()`, some use template literals, some use inline concatenation |

### 1.2 Props Typing

**Strengths:**
- Most components have explicit TypeScript interfaces
- Props are generally well-documented

**Concerns:**

| Issue | Severity | File | Details |
|-------|----------|------|---------|
| `as any` casts | 🟡 Medium | `dashboard/layout.tsx:44` | `session.user as { walletBalance?: number }` |
| Optional props without defaults | 🟡 Medium | `kpi-card.tsx:4-20` | `icon`, `iconBg`, `iconColor` optional but no fallback UI |
| Missing React types | 🟢 Low | Multiple files | `React.ReactNode` vs `ReactNode` inconsistency |

### 1.3 Composition Patterns

**Strengths:**
- Good use of composition in `LeadOrderEngine` (SectionNiche, SectionStates, SectionQuantity, SectionGuarantee)
- Compound component pattern in shadcn/ui (Dialog, Card, Select)

**Concerns:**

| Issue | Severity | File | Details |
|-------|----------|------|---------|
| Monolithic page components | 🟡 Medium | `lists/page.tsx:69-648` | 580-line page with embedded table, modals, pagination |
| Nested callback hell | 🟡 Medium | `settings/page.tsx:84-247` | 5+ nested async handlers with repeated error patterns |
| God components | 🟡 Medium | `dashboard/page.tsx:56-430` | Mixes metrics fetching, UI, download logic in one component |

### 1.4 Reusability

**Strengths:**
- shadcn/ui components shared via `@fine-leads/ui` package
- Utility functions in `@fine-leads/utils` (formatNumber, formatCurrency)

**Concerns:**

| Issue | Severity | File | Details |
|-------|----------|------|---------|
| Duplicate input classes | 🟡 Medium | `login-form.tsx:80`, `register-form.tsx:271-272`, `forgot-password-form.tsx:180-181` | Same `h-11 w-full rounded-md...` repeated 3 times |
| Duplicate table markup | 🟡 Medium | `lead-search.tsx:279-363`, `recent-leads-table.tsx:45-116`, `lists/page.tsx:327-411` | Similar table structure repeated 3+ times |
| No shared empty state component | 🟢 Low | Multiple files | Empty state divs repeated with similar styling |

---

## 2. Forms

### 2.1 React Hook Form Usage

**Used in:**
- `auth-page.tsx:153` — `useForm` with `zodResolver`
- `register-form.tsx:283` — `useForm` with `zodResolver`

**Missing in:**
- `login-form.tsx` — Manual `FormData` parsing
- `forgot-password-form.tsx` — Manual `useState` for each field
- `contact/page.tsx` — No form library
- `support/page.tsx` — No form library
- `settings/page.tsx` — No form library
- `billing/page.tsx` — No form library
- `agent-search.tsx` — No form library

### 2.2 Zod Validation Integration

| Form | Zod Validation | Severity |
|------|---------------|----------|
| Register (auth-page) | ✅ Yes | — |
| Register (register-form) | ✅ Yes | — |
| Login | ❌ No | 🟡 Medium |
| Forgot Password | ❌ No | 🟡 Medium |
| Contact | ❌ No | 🟡 Medium |
| Support | ❌ No | 🟡 Medium |
| Settings (name, email, password) | ❌ No | 🟡 Medium |
| Billing (amount) | ❌ No | 🟡 Medium |
| Agent Search | ❌ No | 🟢 Low |

### 2.3 Error Message Display

**Strengths:**
- Consistent red error styling in register form
- Server errors displayed in red alert boxes

**Concerns:**

| Issue | Severity | File | Details |
|-------|----------|------|---------|
| No `aria-live` for errors | 🟡 Medium | `login-form.tsx:61-65` | Error not announced to screen readers |
| No `role="alert"` | 🟡 Medium | `register-form.tsx:481-485` | Error not announced to screen readers |
| Error color contrast | 🟡 Medium | `login-form.tsx:62` | `text-red-600` on `bg-red-50` — contrast ratio ~4.2:1 (passes AA but borderline) |
| Generic error messages | 🟢 Low | Multiple files | "Something went wrong" without actionable guidance |

### 2.4 Loading States

**Strengths:**
- `dashboard/loading.tsx` — Skeleton loaders
- `lists/loading.tsx` — Skeleton loaders
- `settings/loading.tsx` — Skeleton loaders
- `billing/loading.tsx` — Skeleton loaders
- `lead-search.tsx:157-186` — Skeleton table during fetch
- `agent-search.tsx:157-186` — Skeleton table during fetch

**Concerns:**

| Issue | Severity | File | Details |
|-------|----------|------|---------|
| No loading state | 🟡 Medium | `contact/page.tsx` | No visual feedback during form submission |
| No loading state | 🟡 Medium | `support/page.tsx` | No visual feedback during form submission |
| Inconsistent spinner | 🟢 Low | `support/page.tsx:138-159` | Custom SVG spinner instead of shadcn Spinner |
| Loading text only | 🟢 Low | `dashboard/layout.tsx:25` | "Loading..." text without spinner/skeleton |

### 2.5 Submit Handling

**Concerns:**

| Issue | Severity | File | Details |
|-------|----------|------|---------|
| No disabled state on submit | 🟡 Medium | `contact/page.tsx:103-108` | Button not disabled during submission |
| No double-submit prevention | 🟡 Medium | `support/page.tsx:14-37` | No guard against rapid double-clicks |
| Redirect after submit | 🟢 Low | `auth-page.tsx:173` | `router.push("/login")` without success message |
| No optimistic updates | 🟢 Low | Multiple files | All mutations wait for server response |

---

## 3. Styling

### 3.1 TailwindCSS Usage

**Strengths:**
- Consistent use of utility classes
- Good responsive patterns (`md:`, `lg:`, `sm:`)
- Dark mode variants (`dark:`) used extensively

**Concerns:**

| Issue | Severity | Details |
|-------|----------|---------|
| Hardcoded color values | 🟡 Medium | `#465FFF`, `#14A800`, `#3B50E0` used 50+ times instead of CSS custom properties |
| Inconsistent border radius | 🟡 Medium | Mix of `rounded-md`, `rounded-lg`, `rounded-xl`, `rounded-2xl`, `rounded-none` |
| Magic spacing values | 🟢 Low | `p-3.5`, `px-3.5`, `py-2.5` repeated without design system tokens |
| Inline styles | 🟡 Medium | `style={{ background: gradient }}` in bento-features.tsx |
| Long className strings | 🟡 Medium | Some className attributes exceed 300 characters |

### 3.2 Design System Adherence

**Strengths:**
- Consistent surface color palette (`surface-50` through `surface-950`)
- Consistent typography scale
- Consistent shadow patterns (`shadow-2xs`, `shadow-xs`, `shadow-none`)

**Concerns:**

| Issue | Severity | Details |
|-------|----------|---------|
| No CSS custom properties | 🟡 Medium | Colors hardcoded instead of `--color-primary`, `--color-brand` |
| Inconsistent focus rings | 🟡 Medium | `focus:ring-1`, `focus:ring-2`, `focus:ring-offset-0`, `focus:ring-offset-2` |
| No spacing scale enforcement | 🟢 Low | `gap-1.5`, `gap-2`, `gap-3`, `gap-4` mixed without clear scale |

### 3.3 Dark Mode Support

**Strengths:**
- Most components have `dark:` variants
- Dark mode enabled in root layout (`dark:bg-slate-950`)

**Concerns:**

| Issue | Severity | File | Details |
|-------|----------|------|---------|
| Missing dark mode | 🟡 Medium | `auth-page.tsx:76-77` | `BrandShowcase` has no dark mode variant |
| Incomplete dark mode | 🟡 Medium | `agent-search.tsx:160` | `dark:bg-slate-900` but no dark mode for table text |
| Dark mode toggle missing | 🟢 Low | Entire app | No user-facing dark mode toggle |

### 3.4 Responsive Utilities

**Strengths:**
- Good use of responsive grids (`grid-cols-1 md:grid-cols-2 lg:grid-cols-4`)
- Mobile-first approach
- Sticky sidebars and headers

**Concerns:**

| Issue | Severity | File | Details |
|-------|----------|------|---------|
| Fixed widths | 🟡 Medium | `territory-order.tsx:87,100` | `w-[60%]` and `w-[40%]` break on small screens |
| Horizontal scroll | 🟡 Medium | `lead-search.tsx:278` | `overflow-x-auto` on table without `min-w` |
| No mobile menu for dashboard | 🟡 Medium | `sidebar.tsx:130` | Sidebar hidden on mobile but no alternative navigation |

---

## 4. Accessibility (WCAG)

### 4.1 Semantic HTML

**Strengths:**
- Good use of `<header>`, `<nav>`, `<main>`, `<footer>` in landing page
- Proper `<form>` elements with `type="submit"` buttons
- Tables use `<thead>`, `<tbody>`, `<th>`, `<td>`

**Concerns:**

| Issue | Severity | File | Details |
|-------|----------|------|---------|
| Missing `<main>` landmark | 🔴 Critical | `dashboard/page.tsx:127` | No `<main>` wrapper around content |
| Missing `<main>` landmark | 🔴 Critical | `lists/page.tsx:471` | No `<main>` wrapper |
| Missing `<main>` landmark | 🔴 Critical | `settings/page.tsx:260` | No `<main>` wrapper |
| Missing `<nav>` landmark | 🟡 Medium | `sidebar.tsx:63` | `<nav>` exists but no `aria-label` |
| Missing `<header>` landmark | 🟡 Medium | `dashboard/page.tsx` | No page header with skip link |
| Div-heavy structure | 🟡 Medium | Multiple pages | Overuse of `<div>` instead of semantic elements |

### 4.2 ARIA Labels and Roles

**Strengths:**
- `aria-label` on icon buttons (password toggle, menu toggle, close buttons)
- `aria-hidden="true"` on decorative SVGs
- `role="dialog"` and `aria-modal="true"` in `agent-detail-modal.tsx:233-235`
- `aria-expanded` and `aria-controls` in FAQ accordion

**Concerns:**

| Issue | Severity | File | Details |
|-------|----------|------|---------|
| Missing `aria-live` | 🔴 Critical | `login-form.tsx:61-65` | Error not announced to screen readers |
| Missing `role="alert"` | 🔴 Critical | `register-form.tsx:481-485` | Error not announced to screen readers |
| Missing `aria-live` | 🟡 Medium | `forgot-password-form.tsx:198-203` | Success message not announced |
| Missing `aria-label` on inputs | 🟡 Medium | `auth-page.tsx:236-251` | Login inputs rely on placeholders |
| Missing `aria-describedby` | 🟡 Medium | `register-form.tsx:321-327` | Error not associated with input |
| Decorative icons not hidden | 🟡 Medium | `lead-search.tsx:123-129` | Search icon not `aria-hidden` |
| Missing table caption | 🟢 Low | `lead-search.tsx:279` | No `<caption>` for data table |

### 4.3 Keyboard Navigation

**Strengths:**
- OTP inputs support keyboard navigation (backspace, paste)
- FAQ accordion supports Enter/Space
- Radix UI primitives handle keyboard by default

**Concerns:**

| Issue | Severity | File | Details |
|-------|----------|------|---------|
| No keyboard trap prevention | 🟡 Medium | `agent-detail-modal.tsx:228-346` | Custom modal without focus trap |
| No Escape key in some modals | 🟡 Medium | `lead-detail-modal.tsx` | Uses Dialog (Radix) but no explicit Escape handler |
| No skip navigation | 🔴 Critical | Entire app | No "Skip to main content" link |
| Focus not restored | 🟡 Medium | `lists/page.tsx:156` | `leadSearchRef.current?.focus()` after async load |
| Clickable table rows | 🟡 Medium | `lists/page.tsx:352` | `<tr onClick>` without keyboard handler |

### 4.4 Focus Management

**Concerns:**

| Issue | Severity | File | Details |
|-------|----------|------|---------|
| No focus trap in modals | 🟡 Medium | `agent-detail-modal.tsx:228-346` | Modal doesn't trap focus |
| Focus not moved to modal | 🟡 Medium | `agent-detail-modal.tsx:230` | Dialog opens but focus not explicitly set |
| Focus not restored on close | 🟡 Medium | `lead-detail-modal.tsx` | No restoration of focus after modal close |

### 4.5 Color Contrast Ratios

**Known Issues (estimated from class names):**

| Combination | Ratio | Severity | File |
|-------------|-------|----------|------|
| `text-red-600` on `bg-red-50` | ~4.2:1 | 🟡 Medium | `login-form.tsx:62` |
| `text-slate-400` on `bg-white` | ~3.0:1 | 🔴 Critical | `lead-search.tsx:369` |
| `text-neutral-400` on `bg-white` | ~3.0:1 | 🔴 Critical | `contact/page.tsx:25` |
| `text-surface-400` on `bg-surface-50` | ~3.2:1 | 🟡 Medium | `lead-search.tsx:111` |
| `text-emerald-600` on `bg-emerald-50` | ~4.5:1 | 🟢 Low | Various files |

### 4.6 Form Labels

**Strengths:**
- Most inputs have explicit `<label htmlFor="...">`
- Labels are properly associated with inputs

**Concerns:**

| Issue | Severity | File | Details |
|-------|----------|------|---------|
| Placeholder-only inputs | 🔴 Critical | `auth-page.tsx:236-251` | Login inputs use `placeholder` but no `<label>` |
| Missing label association | 🟡 Medium | `settings/page.tsx:285-287` | Label missing `htmlFor` |
| No error association | 🟡 Medium | `register-form.tsx:328-332` | Error `<p>` not linked via `aria-describedby` |

### 4.7 Screen Reader Support

**Concerns:**

| Issue | Severity | File | Details |
|-------|----------|------|---------|
| No `lang` attribute | 🟡 Medium | `app/layout.tsx` | HTML lang not set (defaults to en but should be explicit) |
| No skip link | 🔴 Critical | Entire app | Screen reader users cannot skip navigation |
| Dynamic content not announced | 🟡 Medium | `dashboard/page.tsx:129-168` | Purchase success/cancel not in `aria-live` region |
| Icon-only buttons without text | 🟡 Medium | Multiple files | Some icon buttons lack `aria-label` |

---

## 5. User Experience

### 5.1 Loading Skeletons/Spinners

**Strengths:**
- `Skeleton` component used consistently in data-heavy pages
- Dashboard loading state with animated skeleton
- Lists page loading with skeleton rows
- Settings page loading with skeleton blocks

**Concerns:**

| Issue | Severity | File | Details |
|-------|----------|------|---------|
| No skeleton | 🟡 Medium | `contact/page.tsx` | No loading feedback during submission |
| No skeleton | 🟡 Medium | `support/page.tsx` | No loading feedback during submission |
| Text-only loading | 🟢 Low | `dashboard/layout.tsx:25` | "Loading..." without spinner |

### 5.2 Error States

**Strengths:**
- Error boundaries in `error.tsx` and `global-error.tsx`
- Error alerts in forms
- 404 page with navigation options

**Concerns:**

| Issue | Severity | File | Details |
|-------|----------|------|---------|
| Silent error swallowing | 🟡 Medium | `lists/page.tsx:101-102` | `catch {}` with no error display |
| Generic error messages | 🟢 Low | `agent-search.tsx:189-192` | "Failed to load agents. Please try again." |
| No retry mechanism | 🟢 Low | `agent-search.tsx:188-192` | Error state has no retry button |

### 5.3 Empty States

**Strengths:**
- Good empty states in lists, recent leads, activity feed
- Clear messaging with CTAs where appropriate

**Concerns:**

| Issue | Severity | File | Details |
|-------|----------|------|---------|
| Inconsistent empty states | 🟡 Medium | `exports/page.tsx:10-12` | Simple text, no icon or CTA |
| No empty state | 🟢 Low | `notifications/page.tsx` | Just text, no illustration |

### 5.4 Success Feedback

**Strengths:**
- Toast notifications via `sonner`
- Success banners in dashboard
- Purchase success/cancel alerts

**Concerns:**

| Issue | Severity | File | Details |
|-------|----------|------|---------|
| No success message | 🟡 Medium | `auth-page.tsx:173` | Redirects to `/login` without success toast |
| Toast not accessible | 🟡 Medium | `sonner` Toaster | No `aria-live` region for toasts |

### 5.5 Navigation Clarity

**Strengths:**
- Clear sidebar navigation with active states
- Breadcrumb-like headers
- Back buttons in nested pages

**Concerns:**

| Issue | Severity | File | Details |
|-------|----------|------|---------|
| No breadcrumbs | 🟡 Medium | Dashboard pages | No breadcrumb trail for deep navigation |
| Active state ambiguity | 🟡 Medium | `sidebar.tsx:46-49` | `/dashboard/search` matches `/dashboard` |
| Missing page titles | 🟢 Low | `lists/page.tsx` | No `<title>` or metadata export |

### 5.6 Search/Filter UX

**Strengths:**
- Debounced search inputs
- Clear filter chips
- Reset filters button
- Result counts displayed

**Concerns:**

| Issue | Severity | File | Details |
|-------|----------|------|---------|
| No search debounce | 🟡 Medium | `lead-explorer.tsx:92` | `onChange` fires on every keystroke |
| No keyboard shortcut | 🟢 Low | Search pages | No `Cmd+K` or `/` to focus search |
| Filter state not in URL | 🟢 Low | `lead-search.tsx` | Filters not shareable via URL |

---

## 6. shadcn/ui Usage

### 6.1 Component Consistency

**Available Components:**
- Button, Input, Card, Dialog, Select, Checkbox, Badge, Skeleton, Table, Label, Popover, Accordion, Tabs, Toggle, Switch, Avatar, AlertDialog, DropdownMenu, Tooltip, Separator

**Strengths:**
- Consistent use of `@fine-leads/ui` package
- Proper variant usage in most places
- `cn()` utility used for class merging

**Concerns:**

| Issue | Severity | File | Details |
|-------|----------|------|---------|
| Custom button styles | 🟡 Medium | `login-form.tsx:112-117` | Inline button instead of `<Button variant="default">` |
| Custom input styles | 🟡 Medium | `auth-page.tsx:236-251` | Inline `<input>` instead of `<Input>` |
| Custom checkbox | 🟡 Medium | `lead-order-engine.tsx:362-366` | Native `<input type="checkbox">` instead of `<Checkbox>` |
| Missing Badge variants | 🟢 Low | `lead-search.tsx:355` | Custom badge classes instead of `<Badge variant="success">` |
| No Table usage | 🟡 Medium | `lead-search.tsx:279` | Custom `<table>` instead of `<Table>` component |
| Inline SVG icons | 🟢 Low | `support/page.tsx:139-159` | Custom spinner SVG instead of shadcn Spinner |

### 6.2 Variant Usage

**Strengths:**
- Button variants used correctly in most places
- Badge variants used in agent search

**Concerns:**

| Issue | Severity | File | Details |
|-------|----------|------|---------|
| Variant not used | 🟡 Medium | `settings/page.tsx:299` | Custom `bg-[#465FFF]` instead of `variant="default"` |
| Missing destructive variant | 🟢 Low | `settings/page.tsx:594` | Uses `variant="destructive"` but custom styling overrides |

### 6.3 Custom Component Extensions

**Strengths:**
- `PasswordInput` extends base input with toggle
- `KpiCard` extends basic card pattern
- `LeadDetailModal` wraps Dialog with custom content

**Concerns:**

| Issue | Severity | File | Details |
|-------|----------|------|---------|
| Reimplemented Dialog | 🟡 Medium | `agent-detail-modal.tsx:228-346` | Custom modal instead of `<Dialog>` from shadcn/ui |
| Reimplemented Badge | 🟡 Medium | `lead-search.tsx:355` | Custom badge span instead of `<Badge>` |

---

## 7. Summary Checklist

| Category | P0 Critical | P1 High | P2 Medium | P1 Low | Total |
|----------|-------------|---------|-----------|--------|-------|
| Component Structure | 0 | 3 | 5 | 0 | 8 |
| Forms | 0 | 4 | 6 | 0 | 10 |
| Styling | 0 | 2 | 4 | 0 | 6 |
| Accessibility | 4 | 6 | 5 | 2 | 17 |
| UX | 0 | 3 | 5 | 0 | 8 |
| shadcn/ui | 0 | 3 | 4 | 0 | 7 |
| **Total** | **4** | **21** | **29** | **2** | **56** |

---

## 8. Priority Action Plan

### Phase 1: Critical Accessibility Fixes (Week 1)

1. **Add `<main>` landmarks** to all dashboard pages
2. **Add skip navigation link** in root layout
3. **Fix placeholder-only inputs** in `auth-page.tsx` — add explicit `<label>` elements
4. **Add `aria-live` regions** for form errors and success messages
5. **Add `role="alert"`** to error displays
6. **Add `lang` attribute** to HTML element in `app/layout.tsx`

### Phase 2: Form Consistency (Week 2)

7. **Migrate login form** to React Hook Form + Zod
8. **Migrate forgot-password form** to React Hook Form + Zod
9. **Migrate contact/support forms** to React Hook Form + Zod
10. **Create shared `FormField` component** with label, error, and description
11. **Add `aria-describedby`** linking inputs to error messages
12. **Standardize button usage** — replace inline buttons with `<Button>`

### Phase 3: UX Improvements (Week 3)

13. **Add loading states** to contact and support forms
14. **Fix focus management** in custom modals (add focus trap)
15. **Add retry buttons** to error states
16. **Fix color contrast** — replace `text-slate-400` on white with darker shade
17. **Add breadcrumbs** to nested dashboard pages
18. **Add page-level metadata** exports for SEO

### Phase 4: Design System (Week 4)

19. **Replace hardcoded colors** with CSS custom properties
20. **Standardize spacing scale** enforcement
21. **Create shared empty state component**
22. **Standardize table markup** using shadcn/ui `<Table>`
23. **Add dark mode toggle** in settings
24. **Replace custom modals** with shadcn/ui `<Dialog>`

---

*Audit completed. All findings are based on static code analysis. Dynamic testing with screen readers (NVDA, VoiceOver) and keyboard-only navigation is recommended for full WCAG validation.*
