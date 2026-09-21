# Set up the attached design system

## What will change
- Load the attached Cupola design-system theme after the app’s existing styles so its tokens take precedence.
- Point shared app providers and future component imports to the attached local design-system package.
- Preserve current routes, data, permissions, and screen behavior.
- Verify the app compiles and the sign-in screen renders correctly.

## Technical notes
- Keep the managed design-system files untouched.
- Resolve the current Tailwind compatibility mismatch only if the theme import exposes it.
- This is wiring only; existing screens will not be redesigned or broadly migrated in this change.
