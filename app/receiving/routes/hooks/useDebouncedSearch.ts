import { useState, useEffect, useRef, useCallback } from 'react';

interface UseDebouncedSearchOptions {
  delay?: number;
  minLength?: number;
}

export function useDebouncedSearch(
  searchFn: (term: string) => void | Promise<void>,
  options: UseDebouncedSearchOptions = {}
) {
  const { delay = 300, minLength = 0 } = options;
  
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedTerm, setDebouncedTerm] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  
  // Debounce effect
  useEffect(() => {
    // Clear previous timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    
    // Don't search if below minimum length
    if (searchTerm.length > 0 && searchTerm.length < minLength) {
      return;
    }
    
    // Set new timeout
    timeoutRef.current = setTimeout(() => {
      setDebouncedTerm(searchTerm);
    }, delay);
    
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [searchTerm, delay, minLength]);
  
  // Execute search when debounced term changes
  useEffect(() => {
    const executeSearch = async () => {
      // Cancel previous search
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      
      // Create new abort controller
      abortControllerRef.current = new AbortController();
      
      try {
        setIsSearching(true);
        await searchFn(debouncedTerm);
      } catch (error) {
        if (error instanceof Error && error.name !== 'AbortError') {
          console.error('Search error:', error);
        }
      } finally {
        setIsSearching(false);
      }
    };
    
    executeSearch();
  }, [debouncedTerm, searchFn]);
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);
  
  const clearSearch = useCallback(() => {
    setSearchTerm('');
    setDebouncedTerm('');
  }, []);
  
  return {
    searchTerm,
    setSearchTerm,
    debouncedTerm,
    isSearching,
    clearSearch,
  };
}
