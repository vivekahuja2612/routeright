import type { SearchResult, SearchParams } from './types';

let _result: SearchResult | null = null;
let _params: SearchParams | null = null;

export function storeSearch(params: SearchParams, result: SearchResult): void {
  _params = params;
  _result = result;
}

export function getResult(): SearchResult | null {
  return _result;
}

export function getParams(): SearchParams | null {
  return _params;
}
