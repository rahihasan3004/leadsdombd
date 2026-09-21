"use client";

import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import {
  Search,
  Download,
  ArrowLeft,
  ArrowRight,
  Database,
  ChevronRight,
  Calendar,
  ExternalLink,
  Filter,
} from "lucide-react";
import { Skeleton } from "@fine-leads/ui";
import {
  AgentDetailModal,
  type AgentData,
} from "@/components/dashboard/agent-detail-modal";

interface OrderRow {
  referenceId: string;
  id: string;
  orderDate: string;
  states: string;
  category: string;
  quantity: number;
  status: "Delivered";
}

const ORDERS: OrderRow[] = [
  {
    referenceId: "LD-ORD-KX9M7P2Q",
    id: "#LD-9482",
    orderDate: "2026-09-19",
    states: "Florida (FL), Texas (TX)",
    category: "Real Estate Agents",
    quantity: 2500,
    status: "Delivered",
  },
  {
    referenceId: "LD-ORD-N4R8W6YJ",
    id: "#LD-9480",
    orderDate: "2026-09-18",
    states: "California (CA)",
    category: "Real Estate Agents",
    quantity: 1000,
    status: "Delivered",
  },
  {
    referenceId: "LD-ORD-B3F5H7K9",
    id: "#LD-9475",
    orderDate: "2026-09-17",
    states: "New York (NY), New Jersey (NJ)",
    category: "Real Estate Agents",
    quantity: 5000,
    status: "Delivered",
  },
  {
    referenceId: "LD-ORD-P8W2M4X7",
    id: "#LD-9470",
    orderDate: "2026-09-15",
    states: "Illinois (IL), Ohio (OH), Michigan (MI)",
    category: "Real Estate Agents",
    quantity: 10000,
    status: "Delivered",
  },
  {
    referenceId: "LD-ORD-R6T9Q1V5",
    id: "#LD-9465",
    orderDate: "2026-09-12",
    states: "Georgia (GA), North Carolina (NC)",
    category: "Real Estate Agents",
    quantity: 1500,
    status: "Delivered",
  },
  {
    referenceId: "LD-ORD-L2N4C8J3",
    id: "#LD-9460",
    orderDate: "2026-09-10",
    states: "Washington (WA), Oregon (OR)",
    category: "Real Estate Agents",
    quantity: 25000,
    status: "Delivered",
  },
  {
    referenceId: "LD-ORD-Y7K1F9D4",
    id: "#LD-9455",
    orderDate: "2026-09-08",
    states: "Arizona (AZ), Nevada (NV), Utah (UT)",
    category: "Real Estate Agents",
    quantity: 2000,
    status: "Delivered",
  },
  {
    referenceId: "LD-ORD-Z5P3W8M2",
    id: "#LD-9450",
    orderDate: "2026-09-05",
    states: "Colorado (CO), New Mexico (NM)",
    category: "Real Estate Agents",
    quantity: 50000,
    status: "Delivered",
  },
  {
    referenceId: "LD-ORD-M8X4Q2W6",
    id: "#LD-9445",
    orderDate: "2026-09-02",
    states: "Massachusetts (MA), Connecticut (CT)",
    category: "Real Estate Agents",
    quantity: 1800,
    status: "Delivered",
  },
  {
    referenceId: "LD-ORD-H3K9N7P1",
    id: "#LD-9440",
    orderDate: "2026-08-29",
    states: "Virginia (VA), Maryland (MD)",
    category: "Real Estate Agents",
    quantity: 3500,
    status: "Delivered",
  },
  {
    referenceId: "LD-ORD-T6W1R5V8",
    id: "#LD-9435",
    orderDate: "2026-08-25",
    states: "Pennsylvania (PA)",
    category: "Real Estate Agents",
    quantity: 2200,
    status: "Delivered",
  },
  {
    referenceId: "LD-ORD-C9F2B8L4",
    id: "#LD-9430",
    orderDate: "2026-08-20",
    states: "Tennessee (TN), Alabama (AL)",
    category: "Real Estate Agents",
    quantity: 4500,
    status: "Delivered",
  },
  {
    referenceId: "LD-ORD-D4J7S1K5",
    id: "#LD-9428",
    orderDate: "2026-08-15",
    states: "South Carolina (SC), Georgia (GA), North Carolina (NC)",
    category: "Real Estate Agents",
    quantity: 7500,
    status: "Delivered",
  },
  {
    referenceId: "LD-ORD-X2T8M3P9",
    id: "#LD-9425",
    orderDate: "2026-08-12",
    states: "Nevada (NV), Arizona (AZ)",
    category: "Real Estate Agents",
    quantity: 500,
    status: "Delivered",
  },
  {
    referenceId: "LD-ORD-W6Q4H7B2",
    id: "#LD-9420",
    orderDate: "2026-08-08",
    states: "Michigan (MI), Indiana (IN), Ohio (OH)",
    category: "Real Estate Agents",
    quantity: 12000,
    status: "Delivered",
  },
  {
    referenceId: "LD-ORD-J9V5L2N8",
    id: "#LD-9415",
    orderDate: "2026-08-05",
    states: "All 50 States + DC",
    category: "Real Estate Agents",
    quantity: 50000,
    status: "Delivered",
  },
  {
    referenceId: "LD-ORD-A1F3G6D9",
    id: "#LD-9410",
    orderDate: "2026-07-29",
    states: "Colorado (CO), Utah (UT)",
    category: "Real Estate Agents",
    quantity: 3200,
    status: "Delivered",
  },
  {
    referenceId: "LD-ORD-E7R5Y8U3",
    id: "#LD-9405",
    orderDate: "2026-07-25",
    states: "Kentucky (KY), Tennessee (TN)",
    category: "Real Estate Agents",
    quantity: 2800,
    status: "Delivered",
  },
  {
    referenceId: "LD-ORD-S4P1W9C6",
    id: "#LD-9400",
    orderDate: "2026-07-22",
    states: "Maryland (MD), Delaware (DE), Virginia (VA)",
    category: "Real Estate Agents",
    quantity: 6000,
    status: "Delivered",
  },
  {
    referenceId: "LD-ORD-M2N7K3H8",
    id: "#LD-9395",
    orderDate: "2026-07-18",
    states: "Missouri (MO), Kansas (KS)",
    category: "Real Estate Agents",
    quantity: 4000,
    status: "Delivered",
  },
  {
    referenceId: "LD-ORD-Q5T1B6X4",
    id: "#LD-9390",
    orderDate: "2026-07-15",
    states: "Wisconsin (WI), Minnesota (MN)",
    category: "Real Estate Agents",
    quantity: 3100,
    status: "Delivered",
  },
  {
    referenceId: "LD-ORD-Z8V3L9D2",
    id: "#LD-9385",
    orderDate: "2026-07-10",
    states: "Louisiana (LA), Mississippi (MS)",
    category: "Real Estate Agents",
    quantity: 2500,
    status: "Delivered",
  },
  {
    referenceId: "LD-ORD-F6G9J1W7",
    id: "#LD-9380",
    orderDate: "2026-07-05",
    states: "Oklahoma (OK), Arkansas (AR)",
    category: "Real Estate Agents",
    quantity: 1800,
    status: "Delivered",
  },
  {
    referenceId: "LD-ORD-R3C8Y4M6",
    id: "#LD-9375",
    orderDate: "2026-06-29",
    states: "Iowa (IA), Nebraska (NE)",
    category: "Real Estate Agents",
    quantity: 2200,
    status: "Delivered",
  },
  {
    referenceId: "LD-ORD-N7P2S5K1",
    id: "#LD-9370",
    orderDate: "2026-06-25",
    states: "New Mexico (NM), Arizona (AZ), Texas (TX)",
    category: "Real Estate Agents",
    quantity: 8500,
    status: "Delivered",
  },
  {
    referenceId: "LD-ORD-B5W1H9T3",
    id: "#LD-9365",
    orderDate: "2026-06-20",
    states: "Maine (ME), New Hampshire (NH), Vermont (VT)",
    category: "Real Estate Agents",
    quantity: 1400,
    status: "Delivered",
  },
  {
    referenceId: "LD-ORD-K8D4X2L7",
    id: "#LD-9360",
    orderDate: "2026-06-15",
    states: "West Virginia (WV), Ohio (OH), Pennsylvania (PA)",
    category: "Real Estate Agents",
    quantity: 5000,
    status: "Delivered",
  },
  {
    referenceId: "LD-ORD-Y1M6V9Q4",
    id: "#LD-9355",
    orderDate: "2026-06-10",
    states: "Hawaii (HI)",
    category: "Real Estate Agents",
    quantity: 500,
    status: "Delivered",
  },
  {
    referenceId: "LD-ORD-T7J3F5C2",
    id: "#LD-9350",
    orderDate: "2026-06-05",
    states: "Alaska (AK)",
    category: "Real Estate Agents",
    quantity: 500,
    status: "Delivered",
  },
  {
    referenceId: "LD-ORD-G4P8N6R1",
    id: "#LD-9345",
    orderDate: "2026-06-01",
    states: "Rhode Island (RI), Massachusetts (MA)",
    category: "Real Estate Agents",
    quantity: 1200,
    status: "Delivered",
  },
  {
    referenceId: "LD-ORD-W9S2B7K5",
    id: "#LD-9340",
    orderDate: "2026-05-27",
    states: "District of Columbia (DC), Maryland (MD)",
    category: "Real Estate Agents",
    quantity: 2000,
    status: "Delivered",
  },
  {
    referenceId: "LD-ORD-C6H9L3M8",
    id: "#LD-9335",
    orderDate: "2026-05-22",
    states: "Montana (MT), Wyoming (WY), Idaho (ID)",
    category: "Real Estate Agents",
    quantity: 1600,
    status: "Delivered",
  },
  {
    referenceId: "LD-ORD-D1X4Z7P2",
    id: "#LD-9330",
    orderDate: "2026-05-18",
    states: "California (CA), Oregon (OR), Washington (WA)",
    category: "Real Estate Agents",
    quantity: 15000,
    status: "Delivered",
  },
  {
    referenceId: "LD-ORD-N8T5R9F3",
    id: "#LD-9325",
    orderDate: "2026-05-12",
    states: "New York (NY), Connecticut (CT), New Jersey (NJ)",
    category: "Real Estate Agents",
    quantity: 20000,
    status: "Delivered",
  },
  {
    referenceId: "LD-ORD-M4Q7V1C6",
    id: "#LD-9320",
    orderDate: "2026-05-08",
    states: "Illinois (IL), Missouri (MO), Iowa (IA)",
    category: "Real Estate Agents",
    quantity: 9500,
    status: "Delivered",
  },
  {
    referenceId: "LD-ORD-J2K5B9S4",
    id: "#LD-9315",
    orderDate: "2026-05-03",
    states: "North Dakota (ND), South Dakota (SD)",
    category: "Real Estate Agents",
    quantity: 800,
    status: "Delivered",
  },
  {
    referenceId: "LD-ORD-H6W1Y8L3",
    id: "#LD-9310",
    orderDate: "2026-04-27",
    states: "Alabama (AL), Georgia (GA), Mississippi (MS)",
    category: "Real Estate Agents",
    quantity: 7200,
    status: "Delivered",
  },
  {
    referenceId: "LD-ORD-U9P5E2R7",
    id: "#LD-9305",
    orderDate: "2026-04-20",
    states: "Texas (TX), Louisiana (LA), Oklahoma (OK)",
    category: "Real Estate Agents",
    quantity: 11000,
    status: "Delivered",
  },
];

function generateAgentsForOrder(order: OrderRow): AgentData[] {
  const stateAbbrs = order.states.match(/\(([A-Z]{2})\)/g)?.map((s) => s.slice(1, 3)) ?? ["US"];
  const count = Math.max(28, Math.min(order.quantity, 30));

  const firstNames = [
    "Sarah", "James", "Emily", "Michael", "Jessica", "David", "Amanda",
    "Robert", "Maria", "Thomas", "Lauren", "Chris", "Jennifer", "Daniel",
    "Patricia", "William", "Elizabeth", "Andrew", "Samantha", "Joseph",
    "Olivia", "Benjamin", "Isabella", "Alexander", "Victoria", "Nicholas",
    "Abigail", "Gabriel",
  ];
  const lastNames = [
    "Mitchell", "Rodriguez", "Chen", "Torres", "Williams", "Kim", "Foster",
    "Sterling", "Gonzalez", "Wright", "Davis", "Nelson", "Adams", "Lee",
    "Brown", "Patel", "O'Brien", "Carter", "Henderson", "Singh", "Lopez",
    "Morgan", "Cooper", "Richardson", "Ward", "Park", "Fisher", "Reynolds",
  ];
  const brokerages = [
    "Compass", "Douglas Elliman", "Sotheby's International",
    "Keller Williams", "eXp Realty", "Corcoran Group",
    "Brown Harris Stevens", "Realty ONE Group", "Russ Lyon Sotheby's",
    "Berkshire Hathaway", "Coldwell Banker", "RE/MAX", "The Agency",
    "Serhant", "Side Inc.", "Real Broker", "John L. Scott",
    "Windermere Real Estate", "Howard Hanna", "Long & Foster",
  ];
  const streets = [
    "425 Market Street", "1200 Brickell Avenue", "9454 Wilshire Blvd",
    "200 E Main Street", "750 Lexington Avenue", "55 Fifth Avenue",
    "330 Madison Avenue", "277 Park Avenue", "100 Congress Avenue",
    "3500 Maple Avenue", "888 Brickell Key Drive", "150 California Street",
    "660 Madison Avenue", "2150 Post Street", "500 Boylston Street",
    "3700 Westheimer Road", "100 Crescent Court", "1901 Avenue of the Stars",
    "2 North Riverside Plaza", "1 South Dearborn Street",
  ];
  const citiesByState: Record<string, string[]> = {
    FL: ["Miami", "Orlando", "Tampa", "Jacksonville", "Fort Lauderdale"],
    TX: ["Austin", "Dallas", "Houston", "San Antonio", "Fort Worth"],
    CA: ["Los Angeles", "San Diego", "San Francisco", "San Jose", "Sacramento"],
    NY: ["Manhattan", "Brooklyn", "Queens", "Bronx", "Staten Island"],
    NJ: ["Newark", "Jersey City", "Paterson", "Elizabeth", "Trenton"],
    IL: ["Chicago", "Aurora", "Naperville", "Joliet", "Rockford"],
    OH: ["Columbus", "Cleveland", "Cincinnati", "Toledo", "Akron"],
    MI: ["Detroit", "Grand Rapids", "Warren", "Sterling Heights", "Ann Arbor"],
    GA: ["Atlanta", "Augusta", "Columbus", "Macon", "Savannah"],
    NC: ["Charlotte", "Raleigh", "Greensboro", "Durham", "Winston-Salem"],
    SC: ["Charleston", "Columbia", "Greenville", "Spartanburg", "Mount Pleasant"],
    WA: ["Seattle", "Spokane", "Tacoma", "Bellevue", "Vancouver"],
    OR: ["Portland", "Salem", "Eugene", "Gresham", "Hillsboro"],
    AZ: ["Phoenix", "Scottsdale", "Tucson", "Mesa", "Chandler"],
    NV: ["Las Vegas", "Henderson", "Reno", "North Las Vegas", "Sparks"],
    UT: ["Salt Lake City", "West Valley City", "Provo", "West Jordan", "Orem"],
    CO: ["Denver", "Colorado Springs", "Aurora", "Fort Collins", "Lakewood"],
    NM: ["Albuquerque", "Las Cruces", "Rio Rancho", "Santa Fe", "Roswell"],
    MA: ["Boston", "Worcester", "Springfield", "Cambridge", "Lowell"],
    CT: ["Bridgeport", "New Haven", "Hartford", "Stamford", "Waterbury"],
    VA: ["Virginia Beach", "Norfolk", "Chesapeake", "Richmond", "Newport News"],
    MD: ["Baltimore", "Columbia", "Germantown", "Silver Spring", "Waldorf"],
    PA: ["Philadelphia", "Pittsburgh", "Allentown", "Erie", "Reading"],
    TN: ["Nashville", "Memphis", "Knoxville", "Chattanooga", "Clarksville"],
    AL: ["Birmingham", "Montgomery", "Mobile", "Huntsville", "Tuscaloosa"],
    IN: ["Indianapolis", "Fort Wayne", "Evansville", "South Bend", "Carmel"],
    KY: ["Louisville", "Lexington", "Bowling Green", "Owensboro", "Covington"],
    DE: ["Wilmington", "Dover", "Newark", "Middletown", "Smyrna"],
    MO: ["Kansas City", "St. Louis", "Springfield", "Columbia", "Independence"],
    KS: ["Wichita", "Overland Park", "Kansas City", "Olathe", "Topeka"],
    WI: ["Milwaukee", "Madison", "Green Bay", "Kenosha", "Racine"],
    MN: ["Minneapolis", "St. Paul", "Rochester", "Duluth", "Bloomington"],
    LA: ["New Orleans", "Baton Rouge", "Shreveport", "Lafayette", "Lake Charles"],
    MS: ["Jackson", "Gulfport", "Southaven", "Hattiesburg", "Biloxi"],
    OK: ["Oklahoma City", "Tulsa", "Norman", "Broken Arrow", "Edmond"],
    AR: ["Little Rock", "Fayetteville", "Fort Smith", "Springdale", "Jonesboro"],
    IA: ["Des Moines", "Cedar Rapids", "Davenport", "Sioux City", "Iowa City"],
    NE: ["Omaha", "Lincoln", "Bellevue", "Grand Island", "Kearney"],
    ME: ["Portland", "Lewiston", "Bangor", "South Portland", "Auburn"],
    NH: ["Manchester", "Nashua", "Concord", "Derry", "Rochester"],
    VT: ["Burlington", "South Burlington", "Rutland", "Barre", "Montpelier"],
    WV: ["Charleston", "Huntington", "Morgantown", "Parkersburg", "Wheeling"],
    HI: ["Honolulu", "Hilo", "Kailua", "Kapolei", "Lahaina"],
    AK: ["Anchorage", "Fairbanks", "Juneau", "Sitka", "Ketchikan"],
    RI: ["Providence", "Warwick", "Cranston", "Pawtucket", "East Providence"],
    DC: ["Washington"],
    MT: ["Billings", "Missoula", "Great Falls", "Bozeman", "Butte"],
    WY: ["Cheyenne", "Casper", "Laramie", "Gillette", "Rock Springs"],
    ID: ["Boise", "Meridian", "Nampa", "Idaho Falls", "Pocatello"],
    ND: ["Fargo", "Bismarck", "Grand Forks", "Minot", "West Fargo"],
    SD: ["Sioux Falls", "Rapid City", "Aberdeen", "Brookings", "Watertown"],
  };

  const agents: AgentData[] = [];
  for (let i = 0; i < count; i++) {
    const st = stateAbbrs[i % stateAbbrs.length];
    const cities = citiesByState[st] ?? ["Unknown"];
    const city = cities[i % cities.length];
    const firstName = firstNames[i % firstNames.length];
    const lastName = lastNames[i % lastNames.length];
    const brokerage = brokerages[i % brokerages.length];
    const street = streets[i % streets.length];
    const rating = +(3.0 + Math.random() * 2.0).toFixed(1);
    const reviewCount = Math.floor(10 + Math.random() * 500);

    agents.push({
      id: `${order.referenceId}-agent-${i + 1}`,
      fullName: `${firstName} ${lastName}`,
      brokerageName: brokerage,
      brokerageAddress: `${street}${i % 3 === 0 ? ", Suite " + (100 + i * 50) : ""}`,
      city,
      state: st,
      zipCode: `${String(10000 + i * 1137).slice(0, 5)}`,
      timezone: st === "CA" || st === "OR" || st === "WA" || st === "NV" ? "America/Los_Angeles"
        : st === "AZ" || st === "CO" || st === "NM" || st === "UT" || st === "ID" || st === "MT" || st === "WY" ? "America/Denver"
        : st === "TX" || st === "IL" || st === "WI" || st === "MN" || st === "MO" || st === "KS" || st === "IA" || st === "NE" || st === "OK" || st === "AR" || st === "LA" || st === "MS" || st === "ND" || st === "SD" || st === "AL" || st === "TN" || st === "KY" ? "America/Chicago"
        : st === "HI" ? "Pacific/Honolulu"
        : st === "AK" ? "America/Anchorage"
        : "America/New_York",
      email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}@${brokerage.toLowerCase().replace(/\s+/g, "")}.com`,
      emailStatus: i % 4 === 0 ? "verified" : i % 5 === 0 ? "catch-all" : "valid",
      phone: `+1 (${String(200 + i * 17).slice(0, 3)}) ${String(500 + i * 73).slice(0, 3)}-${String(1000 + i * 117).slice(0, 4)}`,
      websiteUrl: i % 3 === 0 ? `https://www.${brokerage.toLowerCase().replace(/\s+/g, "")}.com` : null,
      googlePlaceId: `ChIJ${Math.random().toString(36).slice(2, 18).toUpperCase()}`,
      googleMapsLink: `https://maps.google.com/?cid=${Math.floor(1e9 + Math.random() * 9e9)}`,
      rating,
      reviewCount,
      category: "Real Estate Agent",
      googleMainCategory: "Real estate agency",
      googleSubcategories: "Real estate agent, Property management company",
      scrapedAt: new Date(Date.now() - Math.floor(Math.random() * 7 * 86400000)).toISOString(),
      verificationScore: Math.floor(70 + Math.random() * 30),
      dataSource: "Google Places API",
    });
  }
  return agents;
}

const ORDER_LEADS_MAP: Record<string, AgentData[]> = {};
for (const order of ORDERS) {
  ORDER_LEADS_MAP[order.referenceId] = generateAgentsForOrder(order);
}

function formatQuantity(n: number): string {
  return n.toLocaleString("en-US");
}

function formatTimezoneDisplay(tz: string | null): string {
  if (!tz) return "--";
  const map: Record<string, string> = {
    "America/New_York": "Eastern",
    "America/Chicago": "Central",
    "America/Denver": "Mountain",
    "America/Los_Angeles": "Pacific",
    "America/Anchorage": "Alaska",
    "Pacific/Honolulu": "Hawaii",
  };
  return map[tz] ?? tz;
}

const PAGE_SIZE = 10;
const LEAD_PAGE_SIZE = 10;

export default function ListsPage() {
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<OrderRow | null>(null);
  const [orderSearch, setOrderSearch] = useState("");
  const [leadSearch, setLeadSearch] = useState("");
  const [selectedAgent, setSelectedAgent] = useState<AgentData | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [orderPage, setOrderPage] = useState(0);
  const [leadPage, setLeadPage] = useState(0);
  const leadSearchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 600);
    return () => clearTimeout(timer);
  }, []);

  const filteredOrders = useMemo(() => {
    const q = orderSearch.toLowerCase().trim();
    if (!q) return ORDERS;
    return ORDERS.filter(
      (o) =>
        o.referenceId.toLowerCase().includes(q) ||
        o.states.toLowerCase().includes(q),
    );
  }, [orderSearch]);

  useEffect(() => {
    setOrderPage(0);
  }, [orderSearch]);

  useEffect(() => {
    setLeadPage(0);
  }, [leadSearch]);

  const totalOrderPages = Math.ceil(filteredOrders.length / PAGE_SIZE);
  const paginatedOrders = useMemo(() => {
    const start = orderPage * PAGE_SIZE;
    return filteredOrders.slice(start, start + PAGE_SIZE);
  }, [filteredOrders, orderPage]);

  const showingFrom = filteredOrders.length === 0 ? 0 : orderPage * PAGE_SIZE + 1;
  const showingTo = Math.min((orderPage + 1) * PAGE_SIZE, filteredOrders.length);

  const currentLeads = useMemo(() => {
    if (!selectedOrder) return [];
    return ORDER_LEADS_MAP[selectedOrder.referenceId] ?? [];
  }, [selectedOrder]);

  const filteredLeads = useMemo(() => {
    const q = leadSearch.toLowerCase().trim();
    if (!q) return currentLeads;
    return currentLeads.filter(
      (a) =>
        a.fullName.toLowerCase().includes(q) ||
        (a.brokerageName || "").toLowerCase().includes(q) ||
        (a.city || "").toLowerCase().includes(q) ||
        (a.email || "").toLowerCase().includes(q),
    );
  }, [currentLeads, leadSearch]);

  const totalLeadPages = Math.ceil(filteredLeads.length / LEAD_PAGE_SIZE);
  const paginatedLeads = useMemo(() => {
    const start = leadPage * LEAD_PAGE_SIZE;
    return filteredLeads.slice(start, start + LEAD_PAGE_SIZE);
  }, [filteredLeads, leadPage]);

  const leadShowingFrom = filteredLeads.length === 0 ? 0 : leadPage * LEAD_PAGE_SIZE + 1;
  const leadShowingTo = Math.min((leadPage + 1) * LEAD_PAGE_SIZE, filteredLeads.length);

  const handleSelectOrder = useCallback((order: OrderRow) => {
    setSelectedOrder(order);
    setLeadSearch("");
    setLeadPage(0);
    setTimeout(() => leadSearchRef.current?.focus(), 100);
  }, []);

  const handleBackToOrders = useCallback(() => {
    setSelectedOrder(null);
    setLeadSearch("");
    setLeadPage(0);
  }, []);

  const handleOpenAgent = useCallback((agent: AgentData) => {
    setSelectedAgent(agent);
    setModalOpen(true);
  }, []);

  const handleCloseModal = useCallback(() => {
    setModalOpen(false);
    setSelectedAgent(null);
  }, []);

  if (loading) {
    return (
      <div className="w-full min-h-screen bg-[#F4F7FB] p-6 pb-4 space-y-4">
        <div className="bg-white rounded-2xl border-0 shadow-none p-7 md:p-9 space-y-6">
          <div>
            <Skeleton className="h-7 w-48" />
            <Skeleton className="h-5 w-72 mt-2" />
          </div>
          <Skeleton className="h-10 w-64 rounded-xl" />
          <div className="w-full bg-white border border-slate-200 rounded-2xl overflow-hidden">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="border-b border-slate-100 px-4 py-4">
                <Skeleton className="h-5 w-full" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (ORDERS.length === 0) {
    return (
      <div className="w-full min-h-screen bg-[#F4F7FB] p-6 pb-4 space-y-4">
        <div className="bg-white rounded-2xl border-0 shadow-none p-7 md:p-9 space-y-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
              My Leads Vault
            </h1>
            <p className="text-sm text-slate-500 mt-1.5">
              Access, search, and export your unlocked Real Estate Agent databases.
            </p>
          </div>

          <div className="min-h-[400px] border border-dashed border-slate-200 rounded-lg flex flex-col items-center justify-center p-8 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-md bg-slate-100">
              <Database className="h-6 w-6 text-slate-400" />
            </div>
            <h2 className="mt-4 text-base font-semibold text-slate-900">
              Your Lead Vault is Empty
            </h2>
            <p className="mt-1.5 text-sm text-slate-500 max-w-sm">
              You haven&apos;t unlocked any lead databases yet. Start by ordering verified territories.
            </p>
            <a
              href="/dashboard/search"
              className="mt-5 inline-flex items-center gap-1.5 h-9 px-4 bg-slate-950 hover:bg-slate-800 text-white rounded-md text-xs font-semibold transition-colors"
            >
              Order Leads Now
              <ChevronRight className="h-3.5 w-3.5" />
            </a>
          </div>
        </div>
      </div>
    );
  }

  if (selectedOrder) {
    return (
      <>
        <div className="w-full h-screen bg-[#F4F7FB] p-6 overflow-hidden flex flex-col">
          <div className="bg-white border-0 shadow-none rounded-2xl p-6 md:p-8 flex flex-col h-[calc(100vh-48px)] overflow-hidden justify-between">
            <div className="shrink-0">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={handleBackToOrders}
                    className="inline-flex items-center gap-1.5 text-slate-600 hover:text-[#465FFF] hover:bg-[#F0F4FF] font-medium text-xs px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
                  >
                    <ArrowLeft className="h-3.5 w-3.5" />
                    Back to All Orders
                  </button>
                  <div>
                    <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
                      Order #{selectedOrder.referenceId}
                    </h2>
                    <p className="text-sm text-slate-500 mt-1.5">
                      {selectedOrder.states} · {formatQuantity(selectedOrder.quantity)} Verified Leads
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  className="px-4 py-2.5 rounded-xl bg-[#465FFF] hover:bg-[#3B50E0] text-white text-xs font-semibold shadow-none transition-colors flex items-center gap-2 cursor-pointer"
                >
                  <Download className="h-3.5 w-3.5" /> Download Full CSV
                </button>
              </div>

              <div className="mt-6 mb-5 flex items-center justify-between gap-4 flex-wrap">
                <div className="relative w-full sm:w-80">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input
                    ref={leadSearchRef}
                    type="text"
                    value={leadSearch}
                    onChange={(e) => setLeadSearch(e.target.value)}
                    placeholder="Search agents in this order by name, brokerage, city, or email..."
                    className="w-full sm:w-80 px-4 py-2.5 rounded-xl border border-slate-200 text-xs focus:border-[#465FFF] bg-white pl-10 placeholder:text-slate-400 focus:outline-none transition-colors"
                  />
                </div>
              </div>
            </div>

            <div className="w-full flex-1 overflow-hidden my-2">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-slate-100 text-[11px] font-normal text-slate-400 uppercase tracking-wider">
                  <tr className="h-14">
                    <th className="px-4 align-middle text-left">Agent & Company</th>
                    <th className="px-4 align-middle text-left">Category</th>
                    <th className="px-4 align-middle text-left">Direct Phone</th>
                    <th className="px-4 align-middle text-left">Verified Email</th>
                    <th className="px-4 align-middle text-left">Location</th>
                    <th className="px-4 align-middle text-left">Rating & Reviews</th>
                    <th className="px-4 align-middle text-left">Timezone</th>
                    <th className="px-4 align-middle text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {paginatedLeads.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-12 text-center text-sm text-slate-400">
                        No agents match your search.
                      </td>
                    </tr>
                  ) : (
                    paginatedLeads.map((agent) => (
                      <tr
                        key={agent.id}
                        className="h-14 hover:bg-slate-50 transition-colors cursor-pointer"
                        onClick={() => handleOpenAgent(agent)}
                      >
                        <td className="px-4 align-middle text-xs">
                          <span className="font-normal text-slate-900">
                            {agent.fullName}
                          </span>
                          <p className="text-[11px] text-slate-500 mt-0.5">
                            {agent.brokerageName}
                          </p>
                        </td>
                        <td className="px-4 align-middle text-xs">
                          <span className="font-normal text-slate-600">
                            {agent.category ?? "Real Estate Agent"}
                          </span>
                        </td>
                        <td className="px-4 align-middle text-xs font-sans text-sm font-normal text-slate-800">
                          {agent.phone ?? "--"}
                        </td>
                        <td className="px-4 align-middle text-xs">
                          <span className="text-xs text-slate-800 select-all">
                            {agent.email}
                          </span>
                        </td>
                        <td className="px-4 align-middle text-xs">
                          <span className="font-normal text-slate-700">
                            {[agent.city, agent.state].filter(Boolean).join(", ") || "--"}
                          </span>
                        </td>
                        <td className="px-4 align-middle text-xs">
                          <span className="font-normal text-slate-700 tabular-nums">
                            {agent.rating != null
                              ? `★ ${agent.rating.toFixed(1)} (${agent.reviewCount})`
                              : "--"}
                          </span>
                        </td>
                        <td className="px-4 align-middle text-xs">
                          <span className="font-normal text-slate-500">
                            {formatTimezoneDisplay(agent.timezone)}
                          </span>
                        </td>
                        <td className="px-4 align-middle text-xs text-right">
                          {agent.googleMapsLink ? (
                            <a
                              href={agent.googleMapsLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="inline-flex items-center gap-1 text-xs font-normal text-slate-600 hover:text-slate-900 transition-colors"
                            >
                              <ExternalLink className="h-3 w-3" />
                              View on Maps
                            </a>
                          ) : (
                            <span className="text-slate-400">--</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="shrink-0 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
              <span>
                Showing{" "}
                <strong className="text-slate-900 tabular-nums">{leadShowingFrom}&ndash;{leadShowingTo}</strong>{" "}
                of{" "}
                <strong className="text-slate-900 tabular-nums">{filteredLeads.length}</strong>{" "}
                agents
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  disabled={leadPage === 0}
                  onClick={() => setLeadPage((p) => Math.max(0, p - 1))}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Previous
                </button>
                {Array.from({ length: totalLeadPages }, (_, i) => i + 1).map((page) => (
                  <button
                    key={page}
                    type="button"
                    onClick={() => setLeadPage(page - 1)}
                  className={`w-8 h-8 rounded-lg text-xs font-medium transition-colors shadow-none ${
                    leadPage === page - 1
                      ? "bg-[#465FFF] text-white"
                      : "border border-slate-200 text-slate-700 hover:bg-slate-50"
                  }`}
                  >
                    {page}
                  </button>
                ))}
                <button
                  type="button"
                  disabled={leadPage >= totalLeadPages - 1}
                  onClick={() => setLeadPage((p) => p + 1)}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        </div>

        <AgentDetailModal
          agent={selectedAgent}
          open={modalOpen}
          onClose={handleCloseModal}
        />
      </>
    );
  }

  return (
    <div className="w-full h-screen bg-[#F4F7FB] p-6 overflow-hidden flex flex-col">
      <div className="bg-white border-0 shadow-none rounded-2xl p-6 md:p-8 flex flex-col h-[calc(100vh-48px)] overflow-hidden justify-between">
        <div className="shrink-0">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
                My Leads Vault
              </h1>
              <p className="text-sm text-slate-500 mt-1.5">
                Access, search, and export your unlocked Real Estate Agent databases.
              </p>
            </div>
            <a
              href="/dashboard/search"
              className="px-4 py-2.5 rounded-xl bg-[#465FFF] hover:bg-[#3B50E0] text-white text-xs font-semibold shadow-none transition-colors flex items-center gap-2"
            >
              + Order Leads
            </a>
          </div>

          <div className="mt-6 mb-5 flex items-center justify-between gap-4 flex-wrap">
            <div className="relative w-full sm:w-80">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="text"
                value={orderSearch}
                onChange={(e) => setOrderSearch(e.target.value)}
                placeholder="Search orders by Order ID or State..."
                className="w-full sm:w-80 px-4 py-2.5 rounded-xl border border-slate-200 text-xs focus:border-[#465FFF] bg-white pl-10 placeholder:text-slate-400 focus:outline-none transition-colors"
              />
            </div>
            <button
              type="button"
              className="px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-2 transition-colors"
            >
              <Filter className="h-4 w-4" />
              Filter
            </button>
          </div>
        </div>

            <div className="w-full flex-1 overflow-hidden my-2">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-slate-100 text-[11px] font-normal text-slate-400 uppercase tracking-wider">
                  <tr className="h-14">
                    <th className="px-4 align-middle text-left">Order ID & Date</th>
                    <th className="px-4 align-middle text-left">Target States</th>
                    <th className="px-4 align-middle text-left">Category</th>
                    <th className="px-4 align-middle text-right">Quantity</th>
                    <th className="px-4 align-middle text-left">Status</th>
                    <th className="px-4 align-middle text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {paginatedOrders.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-12 text-center text-sm text-slate-400">
                        No orders match your search.
                      </td>
                    </tr>
                  ) : (
                    paginatedOrders.map((order) => (
                      <tr
                        key={order.referenceId}
                        className="h-14 hover:bg-slate-50 transition-colors cursor-pointer"
                        onClick={() => handleSelectOrder(order)}
                      >
                    <td className="px-4 align-middle text-xs">
                      <div>
                        <span className="font-normal text-slate-900 tabular-nums">
                          {order.referenceId}
                        </span>
                        <p className="text-xs text-slate-400 font-normal tabular-nums mt-0.5">
                          {order.orderDate}
                        </p>
                      </div>
                    </td>
                    <td className="px-4 align-middle text-xs">
                      <span className="font-normal text-[11px] text-[#465FFF] bg-[#F0F4FF] px-2 py-0.5 rounded-md">
                        {order.states}
                      </span>
                    </td>
                    <td className="px-4 align-middle text-xs">
                      <span className="font-normal text-slate-600 text-xs">
                        {order.category}
                      </span>
                    </td>
                    <td className="px-4 align-middle text-xs text-right">
                      <span className="font-normal text-slate-800 text-xs tabular-nums">
                        {formatQuantity(order.quantity)}
                      </span>
                    </td>
                    <td className="px-4 align-middle text-xs">
                      <span className="font-normal text-emerald-600 text-xs">
                        {order.status || "Delivered"}
                      </span>
                    </td>
                    <td className="px-4 align-middle text-xs text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSelectOrder(order);
                          }}
                          className="inline-flex items-center gap-1 px-3.5 py-1.5 rounded-lg bg-[#465FFF] hover:bg-[#3B50E0] text-white font-semibold text-xs shadow-none transition-colors cursor-pointer"
                        >
                          View Leads
                          <ArrowRight className="h-3 w-3" />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => e.stopPropagation()}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#F0F4FF] text-[#465FFF] border border-blue-100 hover:bg-blue-100/70 font-semibold text-xs shadow-none transition-colors cursor-pointer"
                        >
                          <Download className="h-3 w-3" />
                          CSV
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="shrink-0 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
          <span>
            Showing{" "}
            <strong className="text-slate-900 tabular-nums">{showingFrom}</strong>
            &ndash;<strong className="text-slate-900 tabular-nums">{showingTo}</strong>{" "}
            of{" "}
            <strong className="text-slate-900 tabular-nums">{filteredOrders.length}</strong>{" "}
            orders
          </span>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              disabled={orderPage === 0}
              onClick={() => setOrderPage((p) => Math.max(0, p - 1))}
              className="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Previous
            </button>
            {Array.from({ length: totalOrderPages }, (_, i) => i + 1).map((page) => (
              <button
                key={page}
                type="button"
                onClick={() => setOrderPage(page - 1)}
                  className={`w-8 h-8 rounded-lg text-xs font-medium transition-colors shadow-none ${
                    orderPage === page - 1
                      ? "bg-[#465FFF] text-white"
                      : "border border-slate-200 text-slate-700 hover:bg-slate-50"
                  }`}
              >
                {page}
              </button>
            ))}
            <button
              type="button"
              disabled={orderPage >= totalOrderPages - 1}
              onClick={() => setOrderPage((p) => p + 1)}
              className="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}