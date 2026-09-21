import { db } from "../src";

function seedRandom() {
  return Math.random();
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(seedRandom() * arr.length)];
}

function randomFloat(min: number, max: number, decimals = 1): number {
  const val = min + seedRandom() * (max - min);
  return parseFloat(val.toFixed(decimals));
}

function randomInt(min: number, max: number): number {
  return Math.floor(min + seedRandom() * (max - min + 1));
}

const FL_BROKERAGES = [
  "Premier Miami Realty",
  "Compass Florida",
  "Douglas Elliman Florida",
  "One Sotheby's International Realty",
  "Coldwell Banker Realty Florida",
  "Berkshire Hathaway HomeServices Florida",
  "Keller Williams Realty Miami",
  "The Corcoran Group Miami",
  "Brown Harris Stevens Miami",
  "RE/MAX Advance Realty",
  "Avanti Way Realty",
  "London Foster Realty",
  "Related ISG International Realty",
  "Fortune International Realty",
  "Beachfront Realty Inc",
  "EWM Realty International",
  "Miami Luxury Homes",
  "Keyes Company Realtors",
  "Royal Shell Real Estate",
  "Premier Sotheby's International",
];

const CA_BROKERAGES = [
  "Compass California",
  "Sotheby's International Realty Los Angeles",
  "Douglas Elliman California",
  "Coldwell Banker Realty Beverly Hills",
  "Berkshire Hathaway HomeServices California",
  "Keller Williams Realty LA",
  "The Agency RE",
  "Hilton & Hyland",
  "Westside Estate Agency",
  "Pacific Union International",
  "Rodeo Realty",
  "John Aaroe Group",
  "Partners Trust Real Estate",
  "Deasy Penner Podley",
  "Pinnacle Estate Properties",
  "Dilbeck Real Estate",
  "Vista Sotheby's International",
  "Surterre Properties",
  "Village Properties Realtors",
  "Coastal Premier Properties",
];

const TX_BROKERAGES = [
  "Austin Luxury Homes",
  "Compass Texas",
  "Keller Williams Realty Texas",
  "Coldwell Banker Realty Dallas",
  "Berkshire Hathaway HomeServices Texas",
  "RE/MAX DFW Associates",
  "Ebby Halliday Realtors",
  "Briggs Freeman Sotheby's",
  "Dave Perry-Miller Real Estate",
  "Allie Beth Allman & Associates",
  "Greenwood King Properties",
  "Martha Turner Sotheby's",
  "Kuper Sotheby's International",
  "Realty Austin",
  "Compass RE Texas",
  "Douglas Elliman Texas",
  "Bramlett Residential",
  "Moreland Properties",
  "Texas Premier Realty",
  "Metroplex Real Estate",
];

const NY_BROKERAGES = [
  "Manhattan Properties",
  "Compass New York",
  "Douglas Elliman New York",
  "The Corcoran Group",
  "Brown Harris Stevens",
  "Sotheby's International Realty NYC",
  "Coldwell Banker Warburg",
  "Berkshire Hathaway HomeServices New York",
  "Halstead Real Estate",
  "Stribling & Associates",
  "Leslie J. Garfield",
  "Modlin Group",
  "Nest Seekers International",
  "Serhant",
  "Elegran Real Estate",
  "Level Group",
  "Citi Habitats",
  "Bond New York",
  "Miron Properties",
  "Keller Williams NYC",
];

const AZ_BROKERAGES = [
  "Scottsdale Luxury Estates",
  "Russ Lyon Sotheby's International",
  "Realty ONE Group Phoenix",
  "Coldwell Banker Realty Arizona",
  "Berkshire Hathaway HomeServices Arizona",
  "Keller Williams Realty Arizona",
  "HomeSmart International",
  "Launch Real Estate",
  "My Home Group Real Estate",
  "Walt Danley Realty",
  "Engel & Volkers Scottsdale",
  "Silverleaf Realty",
  "Arizona Best Real Estate",
  "The Brokery",
  "West USA Realty",
  "Revelation Real Estate",
  "Hague Partners",
  "RETSY",
  "Realty Executives Phoenix",
  "North&Co Real Estate",
];

const FL_CITIES = [
  "Miami", "Orlando", "Tampa", "Jacksonville", "Fort Lauderdale",
  "West Palm Beach", "Naples", "Sarasota", "St. Petersburg", "Boca Raton",
  "Destin", "Pensacola", "Key West", "Coral Gables", "Palm Beach",
];

const CA_CITIES = [
  "Los Angeles", "San Diego", "San Francisco", "San Jose", "Beverly Hills",
  "Santa Monica", "Palo Alto", "Newport Beach", "Laguna Beach", "Malibu",
  "Pasadena", "Santa Barbara", "Irvine", "Walnut Creek", "Napa",
];

const TX_CITIES = [
  "Dallas", "Austin", "Houston", "San Antonio", "Fort Worth",
  "Plano", "Frisco", "Southlake", "The Woodlands", "Highland Park",
  "West Lake Hills", "Rollingwood", "Bellaire", "Colleyville", "University Park",
];

const NY_CITIES = [
  "New York City", "Brooklyn", "Manhattan", "Long Island", "Hamptons",
  "Westchester", "Buffalo", "Rochester", "Albany", "Syracuse",
  "Tribeca", "Upper East Side", "Soho", "Greenwich Village", "Chelsea",
];

const AZ_CITIES = [
  "Phoenix", "Scottsdale", "Tucson", "Mesa", "Chandler",
  "Gilbert", "Paradise Valley", "Tempe", "Glendale", "Peoria",
  "Fountain Hills", "Cave Creek", "Carefree", "Sedona", "Flagstaff",
];

const FL_ZIPS = [
  "33101", "33102", "33109", "33122", "33125", "33126", "33127", "33128", "33129", "33130",
  "32801", "32802", "32803", "32804", "32805", "32806", "32807", "32808", "32809", "32810",
  "33601", "33602", "33603", "33604", "33605", "33606", "33607", "33608", "33609", "33610",
  "32201", "32202", "32203", "32204", "32205", "32206", "32207", "32208", "32209", "32210",
  "33301", "33302", "33303", "33304", "33305", "33306", "33307", "33308", "33309", "33310",
  "33401", "33402", "33403", "33404", "33405", "33406", "33407", "33408", "33409", "33410",
  "34101", "34102", "34103", "34104", "34105", "34106", "34107", "34108", "34109", "34110",
  "34201", "34202", "34203", "34204", "34205", "34206", "34207", "34208", "34209", "34210",
  "33701", "33702", "33703", "33704", "33705", "33706", "33707", "33708", "33709", "33710",
  "33431", "33432", "33433", "33434", "33435", "33436", "33437", "33438", "33439", "33440",
  "32541", "32542", "32543", "32544", "32545", "32546", "32547", "32548", "32549", "32550",
  "32501", "32502", "32503", "32504", "32505", "32506", "32507", "32508", "32509", "32510",
  "33040", "33041", "33042", "33043", "33044", "33045", "33046", "33047", "33048", "33049",
  "33134", "33135", "33136", "33137", "33138", "33139", "33140", "33141", "33142", "33143",
  "33480", "33481", "33482", "33483", "33484", "33485", "33486", "33487", "33488", "33489",
  "33490", "33491", "33492", "33493", "33494", "33495", "33496", "33497", "33498", "33499",
  "33611", "33612", "33613", "33614", "33615", "33616", "33617", "33618", "33619", "33620",
  "32811", "32812", "32813", "32814", "32815", "32816", "32817", "32818", "32819", "32820",
  "33144", "33145", "33146", "33147", "33148", "33149", "33150", "33151", "33152", "33153",
  "34112", "34113", "34114", "34115", "34116", "34117", "34118", "34119", "34120", "34121",
];

const CA_ZIPS = [
  "90001", "90002", "90003", "90004", "90005", "90006", "90007", "90008", "90009", "90010",
  "90011", "90012", "90013", "90014", "90015", "90016", "90017", "90018", "90019", "90020",
  "92101", "92102", "92103", "92104", "92105", "92106", "92107", "92108", "92109", "92110",
  "94101", "94102", "94103", "94104", "94105", "94106", "94107", "94108", "94109", "94110",
  "95101", "95102", "95103", "95104", "95105", "95106", "95107", "95108", "95109", "95110",
  "90210", "90211", "90212", "90213", "90214", "90215", "90216", "90217", "90218", "90219",
  "90401", "90402", "90403", "90404", "90405", "90406", "90407", "90408", "90409", "90410",
  "94301", "94302", "94303", "94304", "94305", "94306", "94307", "94308", "94309", "94310",
  "92660", "92661", "92662", "92663", "92664", "92665", "92666", "92667", "92668", "92669",
  "92651", "92652", "92653", "92654", "92655", "92656", "92657", "92658", "92659", "92650",
  "90265", "90266", "90267", "90268", "90269", "90270", "90271", "90272", "90273", "90274",
  "91101", "91102", "91103", "91104", "91105", "91106", "91107", "91108", "91109", "91110",
  "93101", "93102", "93103", "93104", "93105", "93106", "93107", "93108", "93109", "93110",
  "92602", "92603", "92604", "92605", "92606", "92607", "92608", "92609", "92610", "92611",
  "94596", "94597", "94598", "94599", "94595", "94594", "94593", "94592", "94591", "94590",
  "94558", "94559", "94560", "94561", "94562", "94563", "94564", "94565", "94566", "94567",
  "92111", "92112", "92113", "92114", "92115", "92116", "92117", "92118", "92119", "92120",
  "90021", "90022", "90023", "90024", "90025", "90026", "90027", "90028", "90029", "90030",
  "92612", "92613", "92614", "92615", "92616", "92617", "92618", "92619", "92620", "92621",
  "90291", "90292", "90293", "90294", "90295", "90296", "90297", "90298", "90299", "90300",
];

const TX_ZIPS = [
  "75201", "75202", "75203", "75204", "75205", "75206", "75207", "75208", "75209", "75210",
  "73301", "73302", "73303", "73304", "73305", "73306", "73307", "73308", "73309", "73310",
  "77001", "77002", "77003", "77004", "77005", "77006", "77007", "77008", "77009", "77010",
  "78201", "78202", "78203", "78204", "78205", "78206", "78207", "78208", "78209", "78210",
  "76101", "76102", "76103", "76104", "76105", "76106", "76107", "76108", "76109", "76110",
  "75023", "75024", "75025", "75026", "75027", "75028", "75029", "75030", "75031", "75032",
  "75033", "75034", "75035", "75036", "75037", "75038", "75039", "75040", "75041", "75042",
  "76092", "76093", "76094", "76095", "76096", "76097", "76098", "76099", "76120", "76121",
  "77380", "77381", "77382", "77383", "77384", "77385", "77386", "77387", "77388", "77389",
  "75211", "75212", "75213", "75214", "75215", "75216", "75217", "75218", "75219", "75220",
  "75221", "75222", "75223", "75224", "75225", "75226", "75227", "75228", "75229", "75230",
  "78701", "78702", "78703", "78704", "78705", "78706", "78707", "78708", "78709", "78710",
  "78711", "78712", "78713", "78714", "78715", "78716", "78717", "78718", "78719", "78720",
  "77011", "77012", "77013", "77014", "77015", "77016", "77017", "77018", "77019", "77020",
  "77021", "77022", "77023", "77024", "77025", "77026", "77027", "77028", "77029", "77030",
  "78211", "78212", "78213", "78214", "78215", "78216", "78217", "78218", "78219", "78220",
  "75093", "75094", "75095", "75096", "75097", "75098", "75099", "75100", "75101", "75102",
  "76111", "76112", "76113", "76114", "76115", "76116", "76117", "76118", "76119", "76122",
  "77401", "77402", "77403", "77404", "77405", "77406", "77407", "77408", "77409", "77410",
  "75043", "75044", "75045", "75046", "75047", "75048", "75049", "75050", "75051", "75052",
];

const NY_ZIPS = [
  "10001", "10002", "10003", "10004", "10005", "10006", "10007", "10008", "10009", "10010",
  "11201", "11202", "11203", "11204", "11205", "11206", "11207", "11208", "11209", "11210",
  "10011", "10012", "10013", "10014", "10015", "10016", "10017", "10018", "10019", "10020",
  "11501", "11502", "11503", "11504", "11505", "11506", "11507", "11508", "11509", "11510",
  "11962", "11963", "11964", "11965", "11966", "11967", "11968", "11969", "11970", "11971",
  "10601", "10602", "10603", "10604", "10605", "10606", "10607", "10608", "10609", "10610",
  "14201", "14202", "14203", "14204", "14205", "14206", "14207", "14208", "14209", "14210",
  "14601", "14602", "14603", "14604", "14605", "14606", "14607", "14608", "14609", "14610",
  "12201", "12202", "12203", "12204", "12205", "12206", "12207", "12208", "12209", "12210",
  "13201", "13202", "13203", "13204", "13205", "13206", "13207", "13208", "13209", "13210",
  "10021", "10022", "10023", "10024", "10025", "10026", "10027", "10028", "10029", "10030",
  "10031", "10032", "10033", "10034", "10035", "10036", "10037", "10038", "10039", "10040",
  "11211", "11212", "11213", "11214", "11215", "11216", "11217", "11218", "11219", "11220",
  "11221", "11222", "11223", "11224", "11225", "11226", "11227", "11228", "11229", "11230",
  "11511", "11512", "11513", "11514", "11515", "11516", "11517", "11518", "11519", "11520",
  "10611", "10612", "10613", "10614", "10615", "10616", "10617", "10618", "10619", "10620",
  "14211", "14212", "14213", "14214", "14215", "14216", "14217", "14218", "14219", "14220",
  "10041", "10042", "10043", "10044", "10045", "10046", "10047", "10048", "10049", "10050",
  "11231", "11232", "11233", "11234", "11235", "11236", "11237", "11238", "11239", "11240",
  "13211", "13212", "13213", "13214", "13215", "13216", "13217", "13218", "13219", "13220",
];

const AZ_ZIPS = [
  "85001", "85002", "85003", "85004", "85005", "85006", "85007", "85008", "85009", "85010",
  "85251", "85252", "85253", "85254", "85255", "85256", "85257", "85258", "85259", "85260",
  "85701", "85702", "85703", "85704", "85705", "85706", "85707", "85708", "85709", "85710",
  "85201", "85202", "85203", "85204", "85205", "85206", "85207", "85208", "85209", "85210",
  "85224", "85225", "85226", "85227", "85228", "85229", "85230", "85231", "85232", "85233",
  "85295", "85296", "85297", "85298", "85299", "85300", "85301", "85302", "85303", "85304",
  "85261", "85262", "85263", "85264", "85265", "85266", "85267", "85268", "85269", "85270",
  "85281", "85282", "85283", "85284", "85285", "85286", "85287", "85288", "85289", "85290",
  "85301", "85302", "85303", "85304", "85305", "85306", "85307", "85308", "85309", "85310",
  "85381", "85382", "85383", "85384", "85385", "85386", "85387", "85388", "85389", "85390",
  "85011", "85012", "85013", "85014", "85015", "85016", "85017", "85018", "85019", "85020",
  "85021", "85022", "85023", "85024", "85025", "85026", "85027", "85028", "85029", "85030",
  "85271", "85272", "85273", "85274", "85275", "85276", "85277", "85278", "85279", "85280",
  "85711", "85712", "85713", "85714", "85715", "85716", "85717", "85718", "85719", "85720",
  "85211", "85212", "85213", "85214", "85215", "85216", "85217", "85218", "85219", "85220",
  "85234", "85235", "85236", "85237", "85238", "85239", "85240", "85241", "85242", "85243",
  "85311", "85312", "85313", "85314", "85315", "85316", "85317", "85318", "85319", "85320",
  "85031", "85032", "85033", "85034", "85035", "85036", "85037", "85038", "85039", "85040",
  "85291", "85292", "85293", "85294", "85295", "85296", "85297", "85298", "85299", "85330",
  "85721", "85722", "85723", "85724", "85725", "85726", "85727", "85728", "85729", "85730",
];

const STREETS_FL = [
  "100 Ocean Dr", "250 Collins Ave", "500 Brickell Ave", "750 Lincoln Rd", "1200 Alton Rd",
  "1450 Washington Ave", "1680 Michigan Ave", "1900 Sunny Isles Blvd", "2100 Biscayne Blvd",
  "2400 SW 27th Ave", "2700 Coral Way", "3000 Ponce de Leon Blvd", "3300 S Dixie Hwy",
  "3600 Main Hwy", "3900 Bird Rd", "4200 Le Jeune Rd", "4500 NW 7th St", "4800 Flagler St",
  "5100 W Flagler St", "5400 SW 8th St",
];

const STREETS_CA = [
  "100 Santa Monica Blvd", "250 Sunset Blvd", "500 Wilshire Blvd", "750 Rodeo Dr",
  "1200 Hollywood Blvd", "1450 Ventura Blvd", "1680 Melrose Ave", "1900 La Cienega Blvd",
  "2100 Pico Blvd", "2400 Olympic Blvd", "2700 Beverly Blvd", "3000 San Vicente Blvd",
  "3300 Robertson Blvd", "3600 Main St", "3900 Colorado Ave", "4200 Ocean Park Blvd",
  "4500 Lincoln Blvd", "4800 Pacific Coast Hwy", "5100 El Camino Real", "5400 El Cajon Blvd",
];

const STREETS_TX = [
  "100 Congress Ave", "250 South Congress", "500 Lamar Blvd", "750 Guadalupe St",
  "1200 Burnet Rd", "1450 N Lamar Blvd", "1680 S 1st St", "1900 Barton Springs Rd",
  "2100 Riverside Dr", "2400 E 6th St", "2700 Manor Rd", "3000 W Anderson Ln",
  "3300 Bee Caves Rd", "3600 Capital of Texas Hwy", "3900 Research Blvd", "4200 N Mopac Expy",
  "4500 McKinney Ave", "4800 Lemmon Ave", "5100 Preston Rd", "5400 Northwest Hwy",
];

const STREETS_NY = [
  "100 Broadway", "250 Park Ave", "500 Fifth Ave", "750 Madison Ave",
  "1200 Lexington Ave", "1450 Third Ave", "1680 Second Ave", "1900 First Ave",
  "2100 York Ave", "2400 West End Ave", "2700 Riverside Dr", "3000 Central Park West",
  "3300 Broadway", "3600 Amsterdam Ave", "3900 Columbus Ave", "4200 Greenwich St",
  "4500 Hudson St", "4800 Varick St", "5100 Canal St", "5400 Grand St",
];

const STREETS_AZ = [
  "100 N Scottsdale Rd", "250 E Camelback Rd", "500 N Central Ave", "750 E Indian School Rd",
  "1200 E Thomas Rd", "1450 N 44th St", "1680 E McDowell Rd", "1900 W Bell Rd",
  "2100 E Baseline Rd", "2400 N Tatum Blvd", "2700 E Shea Blvd", "3000 N Hayden Rd",
  "3300 S Mill Ave", "3600 N Oracle Rd", "3900 E Speedway Blvd", "4200 N Campbell Ave",
  "4500 E Broadway Blvd", "4800 N Kolb Rd", "5100 W Ina Rd", "5400 N Pima Rd",
];

const FIRST_NAMES = [
  "James", "Sarah", "Michael", "Emily", "David", "Jessica", "Robert", "Amanda",
  "Christopher", "Jennifer", "Matthew", "Lauren", "Daniel", "Ashley", "Andrew",
  "Stephanie", "Joshua", "Nicole", "Ryan", "Brittany", "Brandon", "Samantha",
  "Nicholas", "Rachel", "Anthony", "Megan", "William", "Taylor", "Joseph", "Heather",
];

const LAST_NAMES = [
  "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller", "Davis", "Rodriguez",
  "Martinez", "Hernandez", "Lopez", "Gonzalez", "Wilson", "Anderson", "Thomas",
  "Taylor", "Moore", "Jackson", "Martin", "Lee", "Perez", "Thompson", "White",
  "Harris", "Sanchez", "Clark", "Ramirez", "Lewis", "Robinson", "Walker",
];

const EST_TIMEZONE = "EST";
const CST_TIMEZONE = "CST";
const PST_TIMEZONE = "PST";

const GOOGLE_CATEGORY = "Real estate agency";
const GOOGLE_SUBCATEGORIES = "Real estate consultant, Commercial real estate agency";
const CATEGORY = "Real Estate Agents";

function generatePhone(): string {
  const area = randomInt(200, 999);
  const prefix = randomInt(200, 999);
  const suffix = randomInt(1000, 9999);
  return `+1 (${area}) ${prefix}-${suffix}`;
}

function generatePlaceId(state: string, index: number): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let id = "ChIJ";
  for (let i = 0; i < 20; i++) {
    id += chars[Math.floor(seedRandom() * chars.length)];
  }
  return `${id}_${state}_${String(index + 1).padStart(4, "0")}`;
}

function generateMapsLink(placeId: string): string {
  return `https://maps.google.com/?q=place_id:${placeId}`;
}

function generateWebsite(company: string): string {
  const slug = company
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, "")
    .slice(0, 20);
  const tlds = [".com", ".net", ".co"];
  return `https://www.${slug}${pick(tlds)}`;
}

function generateEmail(firstName: string, lastName: string, company: string): string {
  const domain = company
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, "")
    .slice(0, 15);
  const patterns = [
    `${firstName.toLowerCase()}.${lastName.toLowerCase()}@${domain}.com`,
    `${firstName.toLowerCase().charAt(0)}${lastName.toLowerCase()}@${domain}.com`,
    `${firstName.toLowerCase()}@${domain}.com`,
    `${lastName.toLowerCase()}.${firstName.toLowerCase()}@${domain}.com`,
  ];
  return pick(patterns);
}

interface AgentSeedData {
  fullName: string;
  firstName: string;
  lastName: string;
  brokerageName: string;
  brokerageAddress: string;
  city: string;
  state: string;
  zipCode: string;
  phone: string;
  email: string;
  websiteUrl: string;
  timezone: string;
  category: string;
  googleMainCategory: string;
  googleSubcategories: string;
  rating: number;
  reviewCount: number;
  scrapedAt: Date;
  emailStatus: string;
  googlePlaceId: string;
  googleMapsLink: string;
  isVerified: boolean;
  verificationScore: number;
  dataSource: string;
}

function generateAgent(
  state: string,
  index: number,
  brokerages: string[],
  cities: string[],
  zips: string[],
  streets: string[],
  timezone: string,
): AgentSeedData {
  const firstName = pick(FIRST_NAMES);
  const lastName = pick(LAST_NAMES);
  const companyName = brokerages[index % brokerages.length];
  const city = cities[index % cities.length];
  const zip = zips[index % zips.length];
  const street = streets[index % streets.length];
  const fullAddress = `${street}, ${city}, ${state} ${zip}`;
  const email = generateEmail(firstName, lastName, companyName);
  const website = generateWebsite(companyName);
  const placeId = generatePlaceId(state, index);
  const mapsLink = generateMapsLink(placeId);
  const rating = randomFloat(4.5, 5.0, 1);
  const reviewCount = randomInt(25, 450);
  const scrapedAt = new Date(Date.now() - randomInt(1, 30) * 24 * 60 * 60 * 1000);
  const verificationScore = randomInt(85, 100);

  return {
    fullName: `${firstName} ${lastName}`,
    firstName,
    lastName,
    brokerageName: companyName,
    brokerageAddress: fullAddress,
    city,
    state,
    zipCode: zip,
    phone: generatePhone(),
    email,
    websiteUrl: website,
    timezone,
    category: CATEGORY,
    googleMainCategory: GOOGLE_CATEGORY,
    googleSubcategories: GOOGLE_SUBCATEGORIES,
    rating,
    reviewCount,
    scrapedAt,
    emailStatus: "validated",
    googlePlaceId: placeId,
    googleMapsLink: mapsLink,
    isVerified: true,
    verificationScore,
    dataSource: "google_maps_scraper",
  };
}
