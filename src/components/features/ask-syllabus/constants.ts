export const YEARS = [1, 2, 3, 4] as const;

export const YEAR_SHORT: Record<number, string> = { 1: "1st year", 2: "2nd year", 3: "3rd year", 4: "4th year" };

/** Same breakpoint as the .ask-ws CSS: below it the panes become tabs. */
export const SPLIT_QUERY = "(min-width: 1024px)";
