import React from 'react';
import '@testing-library/jest-dom';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

// Cleanup after each test
afterEach(() => {
  cleanup();
});

// Helper to filter framer-motion props from DOM elements
function filterMotionProps(props: Record<string, unknown>) {
  const {
    initial, animate, exit, transition, variants,
    whileHover, whileTap, whileFocus, whileInView, whileDrag,
    drag, dragConstraints, dragElastic, dragMomentum,
    layout, layoutId, onAnimationComplete, onAnimationStart,
    ...rest
  } = props;
  return rest;
}

// Create motion component mock factory
function createMotionComponent(Element: string) {
  return function MotionComponent({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) {
    const filteredProps = filterMotionProps(props);
    return React.createElement(Element, filteredProps, children);
  };
}

// Mock framer-motion to avoid animation issues in tests
vi.mock('framer-motion', () => ({
  motion: {
    div: createMotionComponent('div'),
    span: createMotionComponent('span'),
    button: createMotionComponent('button'),
    form: createMotionComponent('form'),
    input: createMotionComponent('input'),
    textarea: createMotionComponent('textarea'),
    a: createMotionComponent('a'),
    p: createMotionComponent('p'),
    section: createMotionComponent('section'),
    article: createMotionComponent('article'),
    header: createMotionComponent('header'),
    footer: createMotionComponent('footer'),
    nav: createMotionComponent('nav'),
    ul: createMotionComponent('ul'),
    li: createMotionComponent('li'),
  },
  AnimatePresence: ({ children }: React.PropsWithChildren) => <>{children}</>,
}));

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value;
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

// Reset localStorage before each test
afterEach(() => {
  localStorageMock.clear();
});
