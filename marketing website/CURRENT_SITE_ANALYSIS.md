# Current Website Analysis: Rexford Commercial Capital

## Business Overview

**Company:** Rexford Commercial Capital, LLC
**Location:** Rexford, NY
**Website:** rexfordcommercialcapital.com

### Business Model
Commercial loan broker helping small businesses obtain financing from local banks

### Core Services
- Equipment leasing and financing
- Unsecured lines of credit
- Commercial and investment real estate financing
- Fix-and-flip financing
- SBA loans
- 1-4 family investment property loans

## Current Platform
- **Technology:** WordPress (confirmed by user feedback about excessive JavaScript)
- **Pain Points:**
  - Excessive JavaScript (user's main complaint)
  - Difficult to update and maintain
  - General WordPress overhead

## Requirements for New Site

### Primary Goals
1. **Lead Generation:** Strong source of web traffic leads
2. **SEO Optimization:** High search engine visibility
3. **Responsiveness:** Excellent mobile/tablet experience
4. **Ease of Use:** Simple for referred clients to navigate

### Technical Requirements
1. **Minimal JavaScript:** Lightweight, fast-loading site
2. **Easy Content Management:** Simple to update without technical knowledge
3. **Blog Capability:** Easy to add and manage blog posts
4. **Form Integration:** Embed lead capture forms
5. **Simple Backend:** User-friendly content editing

### Key Features Needed
- Lead capture forms
- Blog/content management system
- Service pages
- About/contact information
- SEO-friendly structure
- Fast page loads
- Mobile-responsive design

## Content Structure (Typical for This Business)

### Expected Pages
1. **Homepage** - Overview of services and value proposition
2. **Services** - Detailed breakdown of financing options
   - Equipment financing
   - Commercial real estate
   - SBA loans
   - Lines of credit
3. **About** - Company history and team
4. **Blog** - Industry insights and news
5. **Contact** - Lead capture form and contact information
6. **Resources** - Tools, calculators, guides

### Forms Needed
- Contact/inquiry form
- Loan application intake form
- Newsletter signup
- Quote request

## Automated Site Crawl (Playwright, Nov 8 2025)

### Technical Snapshot
- Platform detected as WordPress with Gravity Forms powering lead capture (`gform_` IDs)
- 17 external JavaScript files and 20 stylesheets load on the homepage—heavy for a static brochure site
- Homepage is missing a meta description, although the viewport tag is present
- Navigation contains placeholder anchors (`#`) indicating unused dropdown structures that can be simplified

### Navigation Map
- Real Estate Financing
- Fix and Flip Financing
- Rental Property Loans
- Commercial Real Estate Financing
- Bridge Loans
- Business Loan Solutions
- Equipment Financing
- Business Line of Credit
- Small Business Loan
- Blog
- Get Started
- Call (tel:+1-518-791-9771)
- Home
- Privacy Policy

### Key Pages Crawled
- Homepage
- Financial option detail pages (Fix and Flip, Rental Property Loans, Commercial Real Estate, Equipment Financing, Small Business Loan, Business Line of Credit)
- Bridge Loans landing page
- Finance Blog index
- Get Started lead-intake page
- Privacy Policy

### Forms & Lead Capture
- 21 total forms detected; only three unique experiences:
  - Global search (`form-0`) injected site-wide
  - Gravity Form `gform_2` reused on each service/legal page for project inquiries
  - Gravity Form `gform_1` on the Get Started page with ~20 inputs plus reCAPTCHA
- All substantive forms POST to on-site endpoints, so the new stack must support embedded forms or lightweight serverless handlers
- Form fields request overlapping info (name, contact, project details); consolidate into a single, well-designed lead form during rebuild

### Content Structure Observations
- Headings skew toward all caps and duplicate labels, causing weak semantic hierarchy
- Finance Blog exists but is a simple archive with no category/filtering—ideal candidate for a cleaner Markdown-based blog
- Service pages use repeating hero sections and long paragraphs; content can be modularized into reusable components (problem, solution, proof, CTA)
- Recently Funded section references deal stats but lacks visuals/testimonials—opportunity for richer proof modules in the new site

## Analysis Date
November 8, 2025

## Next Steps
Evaluate modern frameworks that meet the following criteria:
- Minimal JavaScript
- Excellent SEO
- Easy content management
- Simple to update
- Blog-friendly
- Form integration
- Responsive design
