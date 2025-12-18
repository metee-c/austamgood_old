import { useEffect, useState } from 'react';

/**
 * Custom hook for server-side search with debouncing
 *
 * @param initialValue - Initial search term
 * @param delay - Debounce delay in milliseconds (default: 500ms)
 * @returns Object containing searchTerm, debouncedSearchTerm, and setSearchTerm
 *
 * @example
 * const { searchTerm, debouncedSearchTerm, setSearchTerm } = useServerSideSearch('', 500);
 *
 * // In your input
 * <input value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
 *
 * // In your API call useEffect
 * useEffect(() => {
 *   fetchData(debouncedSearchTerm); // Use debouncedSearchTerm
 * }, [debouncedSearchTerm]);
 */
export function useServerSideSearch(initialValue: string = '', delay: number = 500) {
  const [searchTerm, setSearchTerm] = useState(initialValue);
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState(initialValue);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, delay);

    return () => clearTimeout(timer);
  }, [searchTerm, delay]);

  return {
    searchTerm,
    debouncedSearchTerm,
    setSearchTerm,
  };
}
