# Global Mobile UI/UX Design Guide — Implementation

## Overview

Implement the Global Mobile UI/UX Design Guide across the HEMORA mobile app. This is a comprehensive design system overhaul that standardizes all UI components, navigation, and theming to match the healthcare professional identity described in the design guide.

## Delivery Steps

### ✓ Step 1: Update design tokens to match the guide
Align theme.ts tokens with the design guide specifications.
- Update spacing tokens: add 12px (MD) and 20px (XL) as specified in the guide.
- Reduce h1 fontSize from 32px to 28px, h2 from 24px to 22px to match guide.
- Add semantic badge background colors for all status variants.
- Add new typography entries: small labels (11-12px Medium), card heading (15-17px Semibold).
- Keep all existing tokens for backward compatibility — only add and adjust.
- Verify mobile TypeScript compilation passes.

### ✓ Step 2: Build form input components
Create the missing form components: PasswordInput, SearchInput, Dropdown, DatePicker, and Modal.
- Create `PasswordInput.tsx` — wraps existing Input with Eye/EyeOff toggle, following the pattern from sign-in.tsx.
- Create `SearchInput.tsx` — Input with search icon, placeholder, and clear button.
- Create `Dropdown.tsx` — ActionSheet-based dropdown for single and multi-select (no native picker dependency).
- Create `DatePicker.tsx` — ActionSheet-based date picker with selected date display.
- Create `Modal.tsx` — wrapper around React Native Modal with overlay, animations, and close-on-outside-press.
- Update `components/ui/index.ts` to export all new components.
- Verify mobile TypeScript compilation passes.

### ✓ Step 3: Build navigation primitives
Create BottomNavigation, SideDrawer, and ScreenHeader components.
- Install `@react-navigation/drawer` for the side drawer.
- Create `BottomNavigation.tsx` — 4-tab bottom nav using @react-navigation/bottom-tabs, with icons above labels, burgundy active state, white background, subtle top border, and safe area support.
- Create `SideDrawer.tsx` — slide-out drawer with user profile (initials), name, role, navigation links, and logout action. White background, smooth animations, close on outside tap.
- Create `ScreenHeader.tsx` — consistent header with menu button (opens drawer), screen title, notification button, and contextual action.
- Create `components/navigation/index.ts` for exports.
- Verify mobile TypeScript compilation passes.

### ✓ Step 4: Build feedback components
Create Toast, Skeleton, ConfirmationDialog, and ErrorState components.
- Install `react-native-toast-message` for toast notifications.
- Create `Toast.tsx` — success/error/warning/info toasts with icons and auto-dismiss.
- Create `Skeleton.tsx` — shimmer loading placeholders for cards, text, and circles.
- Create `ConfirmationDialog.tsx` — modal confirm dialog with title, message, confirm/cancel buttons, and variant support (danger, warning, info).
- Create `ErrorState.tsx` — error message with icon, description, and retry button, using EmptyState pattern.
- Create `components/feedback/index.ts` for exports.
- Verify mobile TypeScript compilation passes.

### ✓ Step 5: Apply new components to auth screens
Update auth screens to use the new design system components and validate visual consistency.
- Update `sign-in.tsx` to use PasswordInput instead of manual eye toggle.
- Update `sign-up.tsx` to use PasswordInput and new form components.
- Update `forgot-password.tsx` to use new Input and Button components.
- Add ScreenHeader to auth screens where appropriate.
- Ensure all screens use theme tokens instead of hardcoded values.
- Verify mobile TypeScript compilation passes.
- Test visual consistency across auth screens.
