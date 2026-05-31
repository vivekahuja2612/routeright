export type Leg = {
  mode: string;
  instruction: string;
  duration_minutes: number;
  cost_inr: number;
};

export type Route = {
  total_time_minutes: number;
  total_cost_inr: number;
  legs: Leg[];
  least_congested_window: string;
  most_congested_window: string;
  google_maps_baseline_minutes: number;
};

export type SearchResult = {
  routes: Route[];
  suggested_leave_by?: string;
  reason?: string;
  disclosures?: string[];
  error?: string;
};

export type SearchParams = {
  source: string;
  destination: string;
  leaving_time: string;
  expected_arrival: string;
};
