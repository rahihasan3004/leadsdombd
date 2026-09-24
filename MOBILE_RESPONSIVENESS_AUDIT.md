# LeadsDom — Mobile & Multi-Viewport Responsiveness Audit

**Date:** 2026-09-24  
**Repository:** D:\Fine Leads  
**Auditor:** Kilo (Automated Responsiveness Audit)  
**Overall Score:** 68 / 100

---

## 1. Executive Summary

The LeadsDom codebase demonstrates **solid responsive design foundations** with consistent use of Tailwind v4 breakpoints, mobile-first patterns, and `overflow-x-auto` wrappers for data tables. However, there are **significant mobile UX gaps** in data table presentation, touch target sizing, form accessibility, and image/media optimization. The application is functional on mobile but requires targeted improvements for production-grade mobile experience.

**Key Strengths:**
- Proper viewport meta tag configured in root layout
- Consistent use of responsive breakpoints (sm, md, lg, xl)
- Mobile hamburger menu on landing page and dashboard
- Font loading with `display: swap` for performance
- `overflow-x-hidden` on root element prevents horizontal scroll

**Critical Gaps:**
- **No card-view fallback for data tables on mobile** — all tables rely on horizontal scroll
- **Several touch targets below 44×44px minimum** (WCAG/Apple HIG)
- **Missing autocomplete and input types** on key form fields
- **Fixed-height sections** that may clip on small screens
- **No lazy loading or responsive image sizing** for non-critical images

---

## 2. Findings by Severity

### P0 — Critical (Must Fix Before Production)

| # | Issue | File | Line(s) | Details |
|---|-------|------|---------|---------|
| 1 | **Data tables lack mobile card-view fallback** | `apps/web/src/components/agent-search.tsx` | 202-266 | Table wrapped in `overflow-x-auto` but no card-view adaptation for mobile. 7-column table forces horizontal scroll on small screens. |
| 2 | **Data tables lack mobile card-view fallback** | `apps/web/src/components/dashboard/recent-leads-table.tsx` | 39-117 | 6-column table with only `overflow-x-auto`. No responsive column hiding or card transformation. |
| 3 | **Data tables lack mobile card-view fallback** | `apps/web/src/components/dashboard/lead-search.tsx` | 278-365 | 6-column agent table with `overflow-x-auto` only. No mobile-optimized layout. |
| 4 | **Data tables lack mobile card-view fallback** | `apps/web/src/components/dashboard/lead-explorer.tsx` | 118-225 | 6-column table with `overflow-x-auto` only. No responsive adaptation. |
| 5 | **Data tables lack mobile card-view fallback** | `apps/web/app/dashboard/page.tsx` | 344-426 | Recent orders table with 6 columns, only `overflow-x-auto`. |
| 6 | **Data tables lack mobile card-view fallback** | `apps/web/app/dashboard/lists/page.tsx` | 326, 513 | Two tables with horizontal scroll only, no mobile card view. |
| 7 | **Data tables lack mobile card-view fallback** | `apps/web/app/dashboard/billing/page.tsx` | 315 | Transaction table with horizontal scroll only. |
| 8 | **Touch target too small — hamburger button** | `apps/web/src/components/landing/navbar.tsx` | 74-80 | Button uses `p-2` (8px padding) with `h-5 w-5` icon. Total touch area ≈ 36×36px, below 44×44px minimum. |
| 9 | **Touch target too small — icon buttons** | `apps/web/src/components/dashboard/activity-feed.tsx` | 83-98 | Period selector buttons use `px-2.5 py-1` with `text-xs`. Height ≈ 28px, below 44px minimum. |
| 10 | **Touch target too small — close buttons** | `apps/web/src/components/dashboard/agent-detail-modal.tsx` | 240-246 | Close button uses `p-1.5` with `h-4 w-4` icon. Total touch area ≈ 32×32px, below 44×44px. |
| 11 | **Missing autocomplete on search inputs** | `apps/web/src/components/agent-search.tsx` | 89-94 | Search input has no `autoComplete` attribute, preventing mobile browser autofill. |
| 12 | **Missing autocomplete on search inputs** | `apps/web/src/components/dashboard/lead-search.tsx` | 124-131 | Search input has no `autoComplete` attribute. |
| 13 | **Missing autocomplete on contact form** | `apps/web/app/contact/page.tsx` | 68-73, 82-87 | Name and email inputs have no `autoComplete` attributes. |
| 14 | **Numeric input lacks mobile optimization** | `apps/web/src/components/agent-search.tsx` | 121-127 | Min Transactions input uses `type="number"` but no `inputMode="numeric"` or pattern optimization. |
| 15 | **Fixed-height section clips content** | `apps/web/src/components/landing/testimonials.tsx` | 137 | `h-[540px]` with `overflow-hidden` may clip testimonial cards on small screens. |

### P1 — High (Should Fix Soon)

| # | Issue | File | Line(s) | Details |
|---|-------|------|---------|---------|
| 16 | **No bottom navigation for mobile dashboard** | `apps/web/src/components/layout/dashboard/layout.tsx` | 47-65 | Mobile users must use hamburger menu for navigation. Bottom nav would improve thumb reach. |
| 17 | **Hardcoded widths may overflow** | `apps/web/src/components/layout/sidebar.tsx` | 130 | Sidebar uses `w-64` (256px) which is fine on desktop but the mobile dialog uses `sm:max-w-xs` (320px) which may be wide for small screens. |
| 18 | **Hardcoded widths in search filters** | `apps/web/src/components/dashboard/lead-search.tsx` | 129, 201 | Search input `w-64` and brokerage select `w-44` are fixed widths that may not adapt on very small screens. |
| 19 | **Form inputs use custom classes, not shared UI** | `apps/web/app/contact/page.tsx` | 68-101 | Contact form uses bespoke input classes instead of `@fine-leads/ui` Input component, leading to inconsistent sizing and missing focus states. |
| 20 | **No `inputMode` for quantity/numeric fields** | `apps/web/src/components/dashboard/search/lead-order-engine.tsx` | 437-445 | Quantity input uses `type="number"` without `inputMode="numeric"`, which may trigger full keyboard on mobile. |
| 21 | **No `inputMode` for quantity fields** | `apps/web/src/components/dashboard/lead-search.tsx` | 253-261 | Quantity input lacks `inputMode="numeric"`. |
| 22 | **Large inline SVG animations** | `apps/web/src/components/landing/hero-section.tsx` | 17-63, 501 | Animated SVG grid background and pulse animation consume mobile GPU/battery. |
| 23 | **Large inline SVG animations** | `apps/web/src/components/landing/cta-banner.tsx` | 6-35 | Animated SVG grid background in CTA section. |
| 24 | **Select component mobile accessibility** | `apps/web/src/components/dashboard/lead-order-engine.tsx` | 299-381 | Popover-based state selector may have z-index/overflow issues on mobile within scrollable containers. |
| 25 | **No `sizes` attribute on Next.js Image** | `apps/web/src/components/logo.tsx` | 13-20 | Logo uses `next/image` but no `sizes` prop for responsive image selection. |
| 26 | **No lazy loading for non-critical images** | `apps/web/public/` | N/A | `dashboard-preview.png`, `landing.png`, `email.png` exist but no evidence of optimized loading strategy. |
| 27 | **Testimonials marquee may be inaccessible** | `apps/web/src/components/landing/testimonials.tsx` | 102-117 | Vertical marquee animation has no pause-on-hover/focus for accessibility and may be distracting on mobile. |

### P2 — Medium (Nice to Have)

| # | Issue | File | Line(s) | Details |
|---|-------|------|---------|---------|
| 28 | **Typography could use better responsive scaling** | `apps/web/src/components/landing/hero-section.tsx` | 504 | Hero heading uses `text-5xl md:text-7xl` but could use `text-4xl sm:text-5xl md:text-7xl` for smoother scaling. |
| 29 | **Some content lacks `truncate` for long text** | `apps/web/src/components/dashboard/lead-explorer.tsx` | 161-167 | Agent names/brokerages could overflow on small screens without truncation. |
| 30 | **No `overscroll-behavior` for modals/dialogs** | Multiple files | N/A | Dialogs and popovers don't use `overscroll-behavior: contain`, which can cause body scroll chaining on mobile. |
| 31 | **No swipe gestures for tabs/carousels** | `apps/web/src/components/dashboard/activity-feed.tsx` | 83-98 | Period selector (7D/30D/90D) is button-based only; swipe would improve mobile UX. |
| 32 | **KPI cards could stack better on mobile** | `apps/web/app/dashboard/page.tsx` | 195-226 | `grid-cols-1 sm:grid-cols-2 lg:grid-cols-4` is good, but card content could be further optimized for very small screens. |
| 33 | **Lead order grid could use better mobile spacing** | `apps/web/src/components/dashboard/search/lead-order-engine.tsx` | 150-171 | `lg:grid-cols-12` layout with sticky sidebar may cause cramped content on tablets. |
| 34 | **No `will-change` optimization for animations** | `apps/web/src/components/landing/hero-section.tsx` | 17-63 | CSS animations could use `will-change: transform` for better mobile compositor performance. |

---

## 3. Responsive Design Assessment

### Breakpoint Usage
- **Good:** Consistent use of `sm:`, `md:`, `lg:`, `xl:` prefixes across components
- **Good:** Mobile-first approach with base styles for mobile, enhanced at breakpoints
- **Examples:**
  - `bento-features.tsx:384` — `grid-cols-1 md:grid-cols-2`
  - `feature-matrix.tsx:89` — `grid-cols-1 sm:grid-cols-2 lg:grid-cols-4`
  - `dashboard/page.tsx:195` — `grid-cols-1 sm:grid-cols-2 lg:grid-cols-4`

### Flexible Layouts
- **Good:** Heavy use of CSS Grid and Flexbox
- **Good:** `min-w-0` and `truncate` used for text overflow
- **Concern:** Some hardcoded widths (`w-64`, `w-44`) limit flexibility on small screens

### Overflow Handling
- **Good:** Root element has `overflow-x-hidden` (`layout.tsx:105-106`)
- **Good:** Tables consistently wrapped in `overflow-x-auto`
- **Concern:** 8+ tables rely solely on horizontal scroll without mobile card alternatives

---

## 4. Navigation Assessment

### Mobile Navigation
| Component | Status | Details |
|-----------|--------|---------|
| Landing Navbar | ✅ Good | Hamburger menu with full-screen overlay (`navbar.tsx:74-127`) |
| Dashboard Sidebar | ✅ Good | Dialog-based mobile menu (`sidebar.tsx:134-143`) |
| Dashboard Header | ✅ Good | Mobile hamburger button (`dashboard/layout.tsx:52-59`) |
| Bottom Nav | ❌ Missing | No bottom navigation bar for mobile dashboard |

### Touch-Friendly Elements
- **Good:** Most buttons use `h-11` (44px) or larger
- **Poor:** Some icon-only buttons below 44px (see P0 items #8-10)
- **Missing:** No `:active` state feedback on some interactive elements

---

## 5. Tables / Data Display Assessment

### Current Approach
All data tables use the same pattern:
```tsx
<div className="w-full overflow-x-auto">
  <Table>...</Table>
</div>
```

### Issues
- **No card-view transformation** on mobile (`< 768px`)
- **No progressive column disclosure** (show name + 1 key field on mobile, expand for details)
- **No sticky first column** for context while scrolling
- **No density adjustments** (font sizes, padding remain constant)

### Affected Components
1. `agent-search.tsx` — 7 columns (Agent, License, Brokerage, Location, Transactions, Volume, Status)
2. `recent-leads-table.tsx` — 6 columns
3. `lead-search.tsx` — 6 columns
4. `lead-explorer.tsx` — 6 columns
5. `dashboard/page.tsx` — 6 columns
6. `dashboard/lists/page.tsx` — 2 tables, 6+ columns each
7. `dashboard/billing/page.tsx` — 6 columns
8. `admin/users/page.tsx` — 8+ columns

---

## 6. Forms on Mobile Assessment

### Input Sizing
- **Good:** Most inputs use `h-11` (44px) meeting minimum touch target
- **Good:** OTP inputs use `h-12` (48px) — excellent for mobile
- **Good:** Consistent border radius and padding

### Keyboard Types
| Input | Current Type | Recommended |
|-------|-------------|-------------|
| Email | `type="email"` ✅ | ✅ Correct |
| Password | `type="password"` ✅ | ✅ Correct |
| Phone | Not found | `type="tel"` |
| Numeric | `type="number"` | Add `inputMode="numeric"` |
| Search | `type="text"` | Add `inputMode="search"` |

### Autocomplete Attributes
| Field | Current | Recommended |
|-------|---------|-------------|
| Login email | Missing | `autoComplete="email"` |
| Login password | `current-password` ✅ | ✅ Correct |
| Register first name | `given-name` ✅ | ✅ Correct |
| Register last name | `family-name` ✅ | ✅ Correct |
| Register email | `email` ✅ | ✅ Correct |
| Register password | `new-password` ✅ | ✅ Correct |
| Agent search | Missing | `autoComplete="off"` |
| Lead search | Missing | `autoComplete="off"` |
| Contact name | Missing | `autoComplete="name"` |
| Contact email | Missing | `autoComplete="email"` |

---

## 7. Images and Media Assessment

### Current Usage
- **Logo:** Uses `next/image` with `priority` and fixed dimensions (`logo.tsx:13-20`)
- **Public assets:** `dashboard-preview.png`, `landing.png`, `email.png` exist in `public/`
- **No evidence** of:
  - `next/image` with `sizes` attribute for responsive selection
  - Lazy loading (`loading="lazy"`) for below-the-fold images
  - Blur placeholder or LQIP strategy
  - WebP/AVIF format usage

### Recommendations
- Add `sizes` prop to `next/image` for responsive image selection
- Implement lazy loading for non-critical images
- Consider converting PNG assets to WebP/AVIF
- Add blur placeholders for better perceived performance

---

## 8. Viewport Meta Tag

### Status: ✅ PASS

**File:** `apps/web/app/layout.tsx`  
**Lines:** 26-30

```tsx
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#09090B",
};
```

This is properly configured with:
- `width: "device-width"` — ensures proper scaling
- `initialScale: 1` — prevents zoom on load
- `themeColor` — matches app theme

**Recommendation:** Consider adding `maximumScale: 1` and `userScalable: false` only if pinch-zoom is intentionally disabled (generally not recommended for accessibility).

---

## 9. Performance on Mobile

### Bundle Size
- **Good:** `experimental.optimizePackageImports` configured for `@fine-leads/ui` and `lucide-react` (`next.config.ts:19`)
- **Good:** Font loading uses `display: swap` (`layout.tsx:17, 23`)
- **Unknown:** No evidence of bundle size analysis or code splitting audit

### Re-renders
- **Good:** Most client components use `"use client"` appropriately
- **Concern:** Some components like `DashboardPage` (`dashboard/page.tsx:1`) fetch data with `useEffect` + `useCallback` which is fine, but could benefit from `React.memo` for expensive renders

### Image Optimization
- **Poor:** No `sizes` attribute on `next/image`
- **Poor:** No lazy loading strategy for non-critical images
- **Poor:** No responsive srcset generation

### Font Loading
- **Good:** `Plus_Jakarta_Sans` and `JetBrains_Mono` loaded with `display: swap`
- **Good:** Font variables set for CSS usage
- **Concern:** Both fonts loaded on every page; consider subsetting or using `font-display: optional` for non-critical fonts

---

## 10. Recommendations Summary

### Immediate Actions (P0)
1. Implement card-view fallback for all 8+ data tables on mobile
2. Increase hamburger button touch target to 44×44px minimum
3. Fix all icon-only buttons below 44px (close buttons, period selectors)
4. Add `autoComplete` attributes to all form inputs
5. Add `inputMode="numeric"` to all numeric inputs
6. Remove or make `h-[540px]` responsive in testimonials section

### Short-term Actions (P1)
1. Add bottom navigation for mobile dashboard
2. Audit and fix all hardcoded widths for small screens
3. Standardize form inputs using `@fine-leads/ui` components
4. Add `sizes` prop to all `next/image` instances
5. Implement lazy loading for non-critical images
6. Add `overscroll-behavior: contain` to modals
7. Reduce SVG animation complexity for mobile performance

### Long-term Actions (P2)
1. Add swipe gesture support for tab components
2. Implement progressive column disclosure pattern for tables
3. Add sticky first column to wide tables
4. Optimize font loading strategy (subsetting, optional display)
5. Add blur placeholders for images
6. Conduct bundle size analysis and implement code splitting

---

## 11. Positive Patterns to Preserve

1. **Consistent breakpoint strategy** — `sm:`, `md:`, `lg:`, `xl:` used predictably
2. **Mobile-first CSS** — Base styles are mobile, enhanced at breakpoints
3. **Overflow-x-hidden on root** — Prevents accidental horizontal scroll
4. **Responsive grids** — `grid-cols-1 sm:grid-cols-2 lg:grid-cols-4` pattern used well
5. **Dialog-based mobile nav** — Clean implementation of mobile sidebar
6. **Font swap strategy** — `display: swap` prevents FOIT
7. **Touch-friendly form inputs** — `h-11` used consistently for inputs

---

*Report generated by Kilo Automated Responsiveness Audit*
