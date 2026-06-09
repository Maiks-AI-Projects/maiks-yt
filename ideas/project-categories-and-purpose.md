# Project Categories and Purpose

## Idea

Projects should have categories that explain why they exist.

Project type describes the shape of the project, such as one-time purchase, milestone-only, subscription, or multi-item build. Project category describes the purpose.

Possible categories:

- personal
- family
- content improvement
- stream infrastructure
- software/project work
- hobby
- community
- health/accessibility
- experiment
- ongoing operating cost

## Why It Matters

Categories help viewers understand the intent behind a project before donating, following, voting, or engaging.

They also help with filtering. A viewer may want to see only content-improvement projects, while another may want to support personal or family-related goals.

## Data Needed

- category ID
- category name
- category description
- category visibility
- category display order
- project-to-category relationship
- default category per landing page or channel
- optional category icon/color

## Build Requirements

- category model
- admin category manager
- project category selection
- public category filters
- category labels on project cards
- optional category-specific disclosure text
- analytics/reporting grouped by category

## UX Notes

Categories should avoid hiding the nature of a project. If something is personal, content-related, or family-related, the label should make that clear.

This can strengthen transparency without turning every project page into a long explanation.

## Type-safety Notes

Categories should be separate from project types. A `multiItemBuild` project could belong to `contentImprovement`, `personal`, or `streamInfrastructure`.

## Open Questions

- Should projects allow one category or multiple categories?
- Which categories should exist in version one?
- Should categories be public-facing, admin-only, or both?
- Should some categories require extra disclosure before donations?
- Should category filters appear on landing pages?
