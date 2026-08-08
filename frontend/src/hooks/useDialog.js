/**
 * useDialog — shared behaviour for overlay surfaces (mobile drawer, modals).
 *
 * When `open` is true it provides the four things every overlay needs and that
 * neither the Sidebar drawer nor the Admin reset-password modal had:
 *
 *   1. Escape closes it.
 *   2. Background scroll is locked (previously the page scrolled behind the
 *      overlay on mobile, and the scrollbar disappearing caused a layout jump).
 *   3. Focus is trapped inside — Tab/Shift+Tab cycle within the surface instead
 *      of walking into the inert content behind it.
 *   4. Focus returns to whatever was focused before opening.
 *
 * @param {boolean}  open    Whether the surface is currently visible
 * @param {Function} onClose Called on Escape
 * @returns {React.RefObject<HTMLElement>} ref to attach to the surface element
 */

import { useEffect, useRef } from 'react';

const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

export function useDialog(open, onClose) {
  const ref = useRef(null);
  const previouslyFocused = useRef(null);

  useEffect(() => {
    if (!open) return undefined;

    previouslyFocused.current = document.activeElement;

    // ── Scroll lock ────────────────────────────────────────────────────────
    // Compensate for the scrollbar width so locking doesn't shift the layout.
    const { body } = document;
    const prevOverflow = body.style.overflow;
    const prevPaddingRight = body.style.paddingRight;
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;

    body.style.overflow = 'hidden';
    if (scrollbarWidth > 0) {
      const current = parseFloat(window.getComputedStyle(body).paddingRight) || 0;
      body.style.paddingRight = `${current + scrollbarWidth}px`;
    }

    // ── Move focus into the surface ────────────────────────────────────────
    const surface = ref.current;
    if (surface) {
      const first = surface.querySelector(FOCUSABLE);
      // rAF so the element is painted (and any entry transition has started)
      requestAnimationFrame(() => (first || surface).focus?.());
    }

    // ── Escape + focus trap ────────────────────────────────────────────────
    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose?.();
        return;
      }

      if (e.key !== 'Tab' || !surface) return;

      const items = Array.from(surface.querySelectorAll(FOCUSABLE))
        .filter((el) => el.offsetParent !== null || el === document.activeElement);
      if (items.length === 0) return;

      const first = items[0];
      const last = items[items.length - 1];

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      body.style.overflow = prevOverflow;
      body.style.paddingRight = prevPaddingRight;
      previouslyFocused.current?.focus?.();
    };
  }, [open, onClose]);

  return ref;
}
