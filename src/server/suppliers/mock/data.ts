/**
 * Fixture data for the mock adapter.
 *
 * TESTS ONLY. Nothing in this directory may be reached on the production path
 * — the registry refuses to construct the mock adapter unless
 * SUPPLIER_MOCK_ENABLED is true, and the environment check rejects that
 * combination in production (section 15).
 */

export const AIRPORTS = [
  { code: "CAI", name: "Cairo International Airport", city: "Cairo", country: "EG" },
  { code: "HRG", name: "Hurghada International Airport", city: "Hurghada", country: "EG" },
  { code: "DXB", name: "Dubai International Airport", city: "Dubai", country: "AE" },
  { code: "AUH", name: "Zayed International Airport", city: "Abu Dhabi", country: "AE" },
  { code: "JED", name: "King Abdulaziz International Airport", city: "Jeddah", country: "SA" },
  { code: "RUH", name: "King Khalid International Airport", city: "Riyadh", country: "SA" },
  { code: "IST", name: "Istanbul Airport", city: "Istanbul", country: "TR" },
  { code: "LHR", name: "Heathrow Airport", city: "London", country: "GB" },
  { code: "CDG", name: "Charles de Gaulle Airport", city: "Paris", country: "FR" },
  { code: "FRA", name: "Frankfurt Airport", city: "Frankfurt", country: "DE" },
  { code: "JFK", name: "John F. Kennedy International Airport", city: "New York", country: "US" },
  { code: "DOH", name: "Hamad International Airport", city: "Doha", country: "QA" },
] as const;

export const CARRIERS = [
  { code: "MS", name: "EgyptAir" },
  { code: "EK", name: "Emirates" },
  { code: "SV", name: "Saudia" },
  { code: "TK", name: "Turkish Airlines" },
  { code: "QR", name: "Qatar Airways" },
  { code: "LH", name: "Lufthansa" },
  { code: "BA", name: "British Airways" },
  { code: "AF", name: "Air France" },
] as const;

export const AIRCRAFT = ["320", "321", "738", "77W", "789", "35K"] as const;
