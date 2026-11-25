export interface SkeletonProperties {
  /** How many lines of text it stands for (3 by default). */
  lines?: number;
  /** What is loading, read aloud once ("Loading devices…"). */
  label: string;
  /** A block (a picture, a card) instead of lines, this many pixels tall. */
  height?: number;
}
