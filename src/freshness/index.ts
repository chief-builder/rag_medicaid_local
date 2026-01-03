// Freshness module exports

export {
  FreshnessChecker,
  getFreshnessChecker,
  resetFreshnessChecker,
} from './checker.js';

export type {
  DataType,
  UpdateFrequency,
  WarningLevel,
  FreshnessCheck,
  FreshnessRule,
  DocumentWithFreshness,
} from './checker.js';

export {
  FreshnessDisplayService,
  getFreshnessDisplayService,
  resetFreshnessDisplayService,
} from './display.js';

export type {
  SourceFreshnessInfo,
  FreshnessWarning,
  DocumentMetadata,
} from './display.js';
