# Changelog

All notable changes to Orvelo. Versions follow [Semantic Versioning](https://semver.org):
MAJOR for breaking changes, MINOR for new features, PATCH for fixes.

## [Unreleased]

## [2.1.0] - 2026-11-27

### Added
- Rebrand from B.Tech Hub to Orvelo, with a new favicon and loader wordmark.
- Unit tests (39) for grades, session, auth guard, API errors, rate limits, planner, and helpers.
- CI on every push and PR: typecheck, tests, AKTU parser check, production build.
- CD: production deploys to Vercel only after CI passes on `main`.
- Release workflow: a `vX.Y.Z` tag publishes a GitHub Release from this changelog.
- OpenAPI spec, PRD, color palette doc, and a new README.
- Instant top progress bar, skeletons, lazy widgets, and link prefetching.
- Multi-stage progress bar in onboarding and the upload center.
- AI pages keep their state and running requests across navigation.
- Admin login with username and password.
- Vercel deployment config and dynamic app URL.

### Changed
- **Breaking (API):** error responses now use the faultkit envelope `{ success: false, error: { code, message, details, requestId } }` with an `x-request-id` header. Errors are logged with structured logging. The web frontend is updated.
- Main LLM is NVIDIA Nemotron with Gemini as backup, for chat and for the Vac agent.
- Embeddings moved from Mistral to NVIDIA. Pinecone namespace is now per provider.
- PDF ingestion runs inside the app (serverless) instead of a separate ML service.
- AKTU result PDFs are parsed with the Gemini REST API, with fallback models.
- Guests see only public nav and footer links.
- Every rate-limited route has its own bucket.

### Fixed
- Stale sessions no longer loop between login and dashboard.
- Logout wipes saved chats. Vac AI Studio needs login.
- Planner "Generate plan" no longer fails with Invalid input.
- Vac reads SGPA from saved results instead of calculating zero.
- NVIDIA structured output is validated, with Gemini fallback on a bad reply.
- PDF parsing handles uncompressed streams, xref errors, and keeps line breaks.
- Onboarding "Update profile" reuses the saved result.
- Hydration mismatches in appearance settings and Ask your Syllabus.
- Mobile SGPA calculator layout, Vac chat alignment, dashboard spacing.

## [2.0.0] - 2026-10-22

- First release of the v2 platform.

[Unreleased]: https://github.com/Sahil-coder-30/btech-hub/compare/v2.1.0...HEAD
[2.1.0]: https://github.com/Sahil-coder-30/btech-hub/compare/1d06c16...v2.1.0
[2.0.0]: https://github.com/Sahil-coder-30/btech-hub/commit/1d06c16
